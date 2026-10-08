/**
 * 운영자 등록.
 *
 *   pnpm grant-member <email> <observer|reviewer|admin|owner>
 *   pnpm grant-member <email> off        ← 비활성화
 *
 * 그 사람이 앱에 구글로 한 번 로그인한 뒤에 실행한다(계정이 있어야 uid를 안다).
 * 자격 증명은 ADC다: `gcloud auth application-default login`.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ROLES = ["observer", "reviewer", "admin", "owner"];
const [email, role] = process.argv.slice(2);
if (!email || !role || (!ROLES.includes(role) && role !== "off")) {
  console.error("사용법: pnpm grant-member <email> <observer|reviewer|admin|owner|off>");
  process.exit(1);
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID가 없습니다 (.env.local)");
initializeApp({ credential: applicationDefault(), projectId });

const user = await getAuth().getUserByEmail(email);
const ref = getFirestore().collection("fc_members").doc(user.uid);
if (role === "off") {
  await ref.set({ active: false, updatedAt: Date.now() }, { merge: true });
  console.log(`${email} 비활성화`);
} else {
  await ref.set(
    { email, displayName: user.displayName ?? email, role, active: true, updatedAt: Date.now() },
    { merge: true },
  );
  console.log(`${email} (${user.uid}) → ${role}`);
}
