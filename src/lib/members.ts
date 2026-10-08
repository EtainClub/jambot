import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { HttpError, type User } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";
import { OPERATOR_ROLES, ROLES, type Actor, type OperatorRole, type Role } from "@/lib/tasks/transitions";

/**
 * 운영자 지정.
 *
 * fc_members/{uid}에 역할을 적는다. contributor로 내리면 문서를 지우지 않고
 * active를 끈다 — 그 사람이 게시한 댓글의 기록이 누가 운영자였는지를 가리키므로,
 * 지정·해제의 흔적이 남아 있어야 한다. 바꿀 때마다 fc_member_log에 한 줄씩 쌓는다.
 *
 * ★ 자기 역할은 바꿀 수 없다.
 *   관리자가 스스로를 내리면 관리자가 하나도 남지 않을 수 있다. 바꾸는 사람은
 *   언제나 관리자이고 자기 자신은 못 바꾸므로, 관리자는 늘 한 명 이상 남는다.
 *
 * ★ 이메일로 미리 지정할 수 있다.
 *   아직 구글을 연결하지 않은 사람은 uid가 없다. fc_invites/{email}에 역할을 적어
 *   두면, 그 사람이 구글을 연결하는 순간(ensureProfile) 반영된다. 구글이 확인한
 *   이메일일 때만 받는다.
 */

const members = () => db().collection("fc_members");
const invites = () => db().collection("fc_invites");

export interface Person {
  uid: string;
  email: string | null;
  displayName: string;
  linkedAt: number;
  reportCount: number;
  role: Role;
}

export interface Invite {
  email: string;
  role: OperatorRole;
  invitedByName: string;
  createdAt: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listPeople(): Promise<{ people: Person[]; invites: Invite[] }> {
  const [users, active, pending] = await Promise.all([
    db().collection("fc_users").orderBy("linkedAt", "desc").limit(500).get(),
    members().where("active", "==", true).get(),
    invites().get(),
  ]);
  const roles = new Map(active.docs.map((d) => [d.id, d.data().role as OperatorRole]));
  return {
    people: users.docs.map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        email: u.email ?? null,
        displayName: u.displayName ?? u.email ?? "이름 없음",
        linkedAt: u.linkedAt,
        reportCount: u.reportCount ?? 0,
        role: roles.get(d.id) ?? "contributor",
      };
    }),
    invites: pending.docs.map((d) => d.data() as Invite),
  };
}

async function writeRole(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  email: string | null,
  displayName: string,
  from: Role,
  to: Role,
  by: { uid: string; name: string },
) {
  const now = Date.now();
  if (to === "contributor") {
    tx.set(members().doc(uid), { active: false, role: FieldValue.delete(), updatedAt: now, updatedBy: by.uid }, { merge: true });
  } else {
    tx.set(
      members().doc(uid),
      { role: to, active: true, email, displayName, updatedAt: now, updatedBy: by.uid },
      { merge: true },
    );
  }
  tx.create(db().collection("fc_member_log").doc(), { at: now, uid, email, from, to, by: by.uid, byName: by.name });
}

export async function setRole(actor: Actor, uid: string, to: Role): Promise<void> {
  if (!ROLES.includes(to)) throw new HttpError(400, "알 수 없는 역할입니다.");
  if (actor.role !== "admin") throw new HttpError(403, "관리자만 운영자를 지정할 수 있습니다.");
  if (actor.uid === uid) throw new HttpError(409, "자기 역할은 바꿀 수 없습니다. 다른 관리자에게 요청해 주세요.");

  await db().runTransaction(async (tx) => {
    const [user, member] = await Promise.all([tx.get(db().collection("fc_users").doc(uid)), tx.get(members().doc(uid))]);
    if (!user.exists) throw new HttpError(404, "구글을 연결한 사용자가 아닙니다.");
    const m = member.data();
    const from: Role = m?.active === true && OPERATOR_ROLES.includes(m.role) ? m.role : "contributor";
    if (from === to) return;
    const u = user.data()!;
    await writeRole(tx, uid, u.email ?? null, u.displayName ?? u.email ?? "", from, to, actor);
  });
}

/** 아직 구글을 연결하지 않은 사람을 이메일로 미리 지정한다. contributor면 초대를 지운다. */
export async function inviteByEmail(actor: Actor, rawEmail: string, role: Role): Promise<void> {
  if (actor.role !== "admin") throw new HttpError(403, "관리자만 운영자를 지정할 수 있습니다.");
  const email = normalizeEmail(rawEmail);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "이메일 형식이 아닙니다.");
  const existing = await db().collection("fc_users").where("email", "==", email).limit(1).get();
  if (!existing.empty) throw new HttpError(409, "이미 가입한 사용자입니다. 목록에서 역할을 바꿔 주세요.");
  if (role === "contributor") {
    await invites().doc(email).delete();
    return;
  }
  if (!OPERATOR_ROLES.includes(role as OperatorRole)) throw new HttpError(400, "알 수 없는 역할입니다.");
  await invites().doc(email).set({ email, role, invitedBy: actor.uid, invitedByName: actor.name, createdAt: Date.now() });
}

/** 구글을 연결한 사람에게 이메일 초대가 있으면 반영하고 초대를 지운다. */
export async function applyInvite(user: User, displayName: string): Promise<void> {
  if (!user.google || !user.emailVerified || !user.email) return;
  const ref = invites().doc(normalizeEmail(user.email));
  await db().runTransaction(async (tx) => {
    const [invite, member] = await Promise.all([tx.get(ref), tx.get(members().doc(user.uid))]);
    if (!invite.exists) return;
    const i = invite.data()!;
    tx.delete(ref);
    // 이미 운영자면 초대로 덮어쓰지 않는다. 관리자가 직접 바꾼 역할이 우선이다.
    if (member.data()?.active === true) return;
    await writeRole(tx, user.uid, user.email, displayName, "contributor", i.role as OperatorRole, {
      uid: i.invitedBy,
      name: i.invitedByName,
    });
  });
}
