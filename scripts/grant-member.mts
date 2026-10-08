/**
 * 운영자 지정 (터미널).
 *
 *   pnpm grant-member <email> <reviewer|moderator|admin|contributor>
 *
 * 화면(/members)이 같은 일을 한다. 이 스크립트는 첫 관리자를 세울 때처럼
 * 화면에 들어갈 관리자가 아직 없을 때 쓴다. contributor는 운영자 해제다.
 *
 * 구글을 이미 연결한 사람이면 바로 반영하고, 아니면 이메일 초대(fc_invites)로
 * 적어 두어 그 사람이 구글을 연결할 때 반영되게 한다.
 * 자격 증명은 ADC다: `gcloud auth application-default login`.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const ROLES = ["contributor", "reviewer", "moderator", "admin"];

async function main() {
  const [rawEmail, role] = process.argv.slice(2);
  if (!rawEmail || !ROLES.includes(role)) {
    console.error("사용법: pnpm grant-member <email> <reviewer|moderator|admin|contributor>");
    process.exit(1);
  }
  const email = rawEmail.trim().toLowerCase();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID가 없습니다 (.env.local)");
  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();
  const now = Date.now();

  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch {
    user = null;
  }
  const google = user?.providerData.some((p) => p.providerId === "google.com");

  if (!user || !google) {
    if (role === "contributor") {
      await db.collection("fc_invites").doc(email).delete();
      console.log(`${email}: 초대 취소`);
    } else {
      await db.collection("fc_invites").doc(email).set({
        email,
        role,
        invitedBy: "cli",
        invitedByName: "터미널",
        createdAt: now,
      });
      console.log(`${email}: 아직 구글 연결 전 → 초대로 적어 둠 (${role}). 구글을 연결하면 반영됩니다.`);
    }
    return;
  }

  const ref = db.collection("fc_members").doc(user.uid);
  const before = (await ref.get()).data();
  const from = before?.active === true ? before.role : "contributor";
  const displayName = user.displayName ?? email;
  if (role === "contributor") {
    await ref.set({ active: false, role: FieldValue.delete(), updatedAt: now, updatedBy: "cli" }, { merge: true });
  } else {
    await ref.set({ role, active: true, email, displayName, updatedAt: now, updatedBy: "cli" }, { merge: true });
  }
  // 프로필이 없을 때만 만든다(create는 있으면 실패한다). 운영자 관리 화면이 fc_users를 기준으로 사람을 보여 준다.
  await db
    .collection("fc_users")
    .doc(user.uid)
    .create({ uid: user.uid, email, displayName, linkedAt: now, updatedAt: now, reportCount: 0 })
    .catch((error: { code?: number }) => {
      if (error.code !== 6) throw error; // 6 = ALREADY_EXISTS
    });
  await db.collection("fc_member_log").add({ at: now, uid: user.uid, email, from, to: role, by: "cli", byName: "터미널" });
  console.log(`${email} (${user.uid}): ${from} → ${role}`);
}

void main();
