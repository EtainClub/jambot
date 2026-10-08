"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * 파이어베이스 클라이언트. 로그인에만 쓴다.
 *
 * 데이터는 전부 API로 오간다(admin.ts 참고). 그래서 여기에는 Firestore가 없다.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

function app(): FirebaseApp | null {
  if (typeof window === "undefined" || !firebaseConfigured) return null;
  return getApps().length ? getApp() : initializeApp(config);
}

export function firebaseAuth(): Auth | null {
  const instance = app();
  return instance ? getAuth(instance) : null;
}
