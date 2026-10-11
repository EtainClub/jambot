"use client";

import { getApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";

import { firebaseAuth } from "./client";

/**
 * 이 기기에서 푸시 알림 켜고 끄기.
 *
 * 받은 메시지는 서비스 워커(public/sw.js)가 직접 그린다. 그래서 FCM이 기본으로 찾는
 * firebase-messaging-sw.js를 따로 두지 않고, 이미 있는 /sw.js 등록을 넘긴다.
 *
 * 아이폰은 홈 화면에 추가한 앱에서만 알림을 받는다(iOS 16.4+). 사파리 탭에서는
 * Notification이 없거나 isSupported()가 false다.
 */

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

const KEY = "fc-push-token";
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function store(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    // 저장소가 막혀도 알림 자체는 켜진다. 화면이 꺼짐으로 보일 뿐이다.
  }
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  const supported = "Notification" in window && "serviceWorker" in navigator && (await isSupported().catch(() => false));
  if (!supported) return isIos() && !standalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && stored() ? "on" : "off";
}

type Api = (path: string, init?: RequestInit) => Promise<Response>;

/** 권한을 묻고, 토큰을 받아 서버에 등록한다. 반드시 버튼 클릭 안에서 불러야 한다(iOS). */
export async function enablePush(api: Api): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  firebaseAuth(); // 앱 초기화
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error("알림 토큰을 받지 못했습니다.");
  const res = await api("/api/my/push", { method: "POST", body: JSON.stringify({ token }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "알림을 켜지 못했습니다.");
  store(token);
  return "on";
}

export async function disablePush(api: Api): Promise<PushState> {
  const token = stored();
  if (token) {
    await api("/api/my/push", { method: "DELETE", body: JSON.stringify({ token }) }).catch(() => null);
    firebaseAuth();
    await deleteToken(getMessaging(getApp())).catch(() => false);
  }
  store(null);
  return "off";
}
