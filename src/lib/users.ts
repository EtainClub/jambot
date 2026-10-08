import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import type { User } from "@/lib/auth/member";
import { adminAuth, db } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/auth/member";
import { applyInvite } from "@/lib/members";

/**
 * 사용자 프로필 — fc_users/{uid}.
 *
 * ★ 담는 것을 최소로 한다.
 *   구글 연결 때 받는 이메일과 이름, 그리고 집계 숫자뿐이다. 제보 본문은
 *   fc_reports에 있고 reporterUid로만 잇는다. 프로필을 지우면 그 고리를 끊는다.
 *
 * ★ 화면에 보여 주는 것이 저장된 것 전부다.
 *   "무엇을 갖고 있나"를 사용자가 그대로 읽을 수 있어야 관리라고 할 수 있다.
 *   그래서 GET /api/my는 이 문서를 가공하지 않고 내보낸다.
 */

export interface Profile {
  uid: string;
  email: string | null;
  displayName: string;
  linkedAt: number;
  updatedAt: number;
  reportCount: number;
}

const users = () => db().collection("fc_users");

/** 구글이 연결된 사용자의 프로필을 만들거나 이메일을 맞춘다. 이름은 사용자가 고친 것을 지킨다. */
export async function ensureProfile(user: User): Promise<Profile> {
  if (!user.google) throw new HttpError(403, "구글 계정을 연결해야 합니다.");
  const ref = users().doc(user.uid);
  const now = Date.now();
  const profile = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as Profile | undefined;
    const next: Profile = {
      uid: user.uid,
      email: user.email,
      displayName: data?.displayName ?? user.name,
      linkedAt: data?.linkedAt ?? now,
      updatedAt: data ? data.updatedAt : now,
      reportCount: data?.reportCount ?? 0,
    };
    if (!data || data.email !== user.email) tx.set(ref, { ...next, updatedAt: now }, { merge: true });
    return next;
  });
  await applyInvite(user, profile.displayName);
  return profile;
}

export async function getProfile(uid: string): Promise<Profile | null> {
  return ((await users().doc(uid).get()).data() as Profile | undefined) ?? null;
}

export async function renameProfile(uid: string, displayName: string): Promise<void> {
  const name = displayName.trim();
  if (!name || name.length > 40) throw new HttpError(400, "이름은 1~40자로 써 주세요.");
  await users().doc(uid).update({ displayName: name, updatedAt: Date.now() });
}

export async function countReport(uid: string): Promise<void> {
  await users().doc(uid).set({ reportCount: FieldValue.increment(1), updatedAt: Date.now() }, { merge: true });
}

/**
 * 탈퇴.
 *
 * 제보 자체는 남긴다 — 남의 공개 게시물에 대한 기록이고, 다른 사람의 제보와
 * 합쳐져 있어 하나만 빼면 작업 기록이 맞지 않는다. 대신 나와 잇는 것을 모두
 * 끊는다: reporterUid, 접속 지점 해시(ipHash), 제보 메모(사람이 쓴 글이라
 * 개인 사정이 섞일 수 있다). 그다음 프로필과 로그인 계정을 지운다.
 *
 * 운영자는 탈퇴할 수 없다. 운영 기록(누가 무엇을 게시했나)이 남아야 하므로
 * 관리자가 먼저 운영자에서 해제해야 한다.
 */
export async function deleteAccount(uid: string): Promise<{ unlinkedReports: number }> {
  const member = (await db().collection("fc_members").doc(uid).get()).data();
  if (member?.active) {
    throw new HttpError(409, "운영자 계정은 바로 탈퇴할 수 없습니다. 관리자에게 운영자 해제를 먼저 요청해 주세요.");
  }

  const reports = await db().collection("fc_reports").where("reporterUid", "==", uid).get();
  for (let i = 0; i < reports.docs.length; i += 400) {
    const batch = db().batch();
    for (const doc of reports.docs.slice(i, i + 400)) {
      batch.update(doc.ref, { reporterUid: null, ipHash: null, memo: null, unlinkedAt: Date.now() });
    }
    await batch.commit();
  }
  await users().doc(uid).delete();
  await adminAuth().deleteUser(uid);
  return { unlinkedReports: reports.size };
}
