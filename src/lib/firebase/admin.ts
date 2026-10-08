import "server-only";

import { applicationDefault, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * 서버 쪽 파이어베이스.
 *
 * ★ 브라우저는 Firestore를 직접 읽지 않는다.
 *   모든 읽기·쓰기가 API를 거친다. 규칙(firestore.rules)은 전부 닫혀 있고,
 *   여기서 쓰는 Admin SDK만 문을 연다. 권한 검사가 규칙과 서버 두 곳에
 *   갈라져 있으면 한쪽은 반드시 덜 검사된다 — 그래서 한 곳(서버)에만 둔다.
 *
 * 자격 증명은 Application Default Credentials다. App Hosting에서는 저절로
 * 잡히고, 손에서는 `gcloud auth application-default login`이 필요하다.
 */

function app(): App {
  if (getApps().length) return getApp();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID가 없습니다.");
  return initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminAuth = () => getAuth(app());
export const db = () => getFirestore(app());
export const bucket = () => getStorage(app()).bucket();
