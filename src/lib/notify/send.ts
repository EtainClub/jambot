import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { db, messaging } from "@/lib/firebase/admin";
import { OPERATOR_ROLES } from "@/lib/tasks/transitions";

import type { Notice } from "./plan";

/**
 * 푸시 알림 보내기 (FCM).
 *
 * 받는 기기는 fc_users/{uid}.pushTokens에 있다. 사용자가 MY에서 알림을 켜면 생긴다.
 *
 * ★ 알림 실패는 본래 일을 막지 않는다.
 *   판정과 작업 전이가 먼저고 알림은 덤이다. 그래서 여기서 나는 오류는 전부
 *   로그로만 남기고 삼킨다(notifySafely). 부르는 쪽은 결과를 기다리지 않아도 된다.
 *
 * ★ 데이터 메시지만 보낸다.
 *   알림 모양은 서비스 워커(public/sw.js)가 data.title·body·link로 그린다.
 *   FCM 쪽 알림 필드를 쓰면 브라우저마다 표시와 클릭 동작이 달라진다.
 */

const DEAD = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);

async function tokensOf(uids: string[]): Promise<Map<string, string>> {
  const owner = new Map<string, string>(); // token → uid
  if (!uids.length) return owner;
  const refs = [...new Set(uids)].map((uid) => db().collection("fc_users").doc(uid));
  for (const snap of await db().getAll(...refs)) {
    for (const token of (snap.data()?.pushTokens as string[] | undefined) ?? []) owner.set(token, snap.id);
  }
  return owner;
}

export async function sendTo(uids: string[], notice: Notice): Promise<number> {
  const owner = await tokensOf(uids);
  const tokens = [...owner.keys()];
  if (!tokens.length) return 0;
  const res = await messaging().sendEachForMulticast({
    tokens,
    data: { title: notice.title, body: notice.body, link: notice.link },
    webpush: { headers: { Urgency: "high", TTL: String(3 * 86_400) } },
  });
  // 지워진 기기(앱 삭제, 권한 회수)의 토큰은 치운다.
  await Promise.all(
    res.responses.map((r, i) => {
      if (r.success || !DEAD.has(r.error?.code ?? "")) return null;
      const token = tokens[i];
      return db().collection("fc_users").doc(owner.get(token)!).update({ pushTokens: FieldValue.arrayRemove(token) });
    }),
  );
  return res.successCount;
}

/** 이 게시물을 제보한 사람들(탈퇴로 끊긴 제보는 빠진다). */
export async function reportersOf(shortcode: string): Promise<string[]> {
  const snap = await db().collection("fc_reports").where("shortcode", "==", shortcode).get();
  return snap.docs.map((d) => d.data().reporterUid as string | null).filter((u): u is string => Boolean(u));
}

/** 활성 운영자 전원. */
export async function operators(): Promise<string[]> {
  const snap = await db().collection("fc_members").where("active", "==", true).get();
  return snap.docs.filter((d) => (OPERATOR_ROLES as readonly string[]).includes(d.data().role)).map((d) => d.id);
}

export async function notifySafely(where: string, job: () => Promise<unknown>): Promise<void> {
  try {
    await job();
  } catch (error) {
    console.error(`[notify] ${where}`, error);
  }
}

/** planNotices 결과를 보낸다. */
export async function deliver(shortcode: string, plan: { reporter: Notice | null; operators: Notice | null }): Promise<void> {
  await Promise.all([
    plan.reporter ? notifySafely(`reporter ${shortcode}`, async () => sendTo(await reportersOf(shortcode), plan.reporter!)) : null,
    plan.operators ? notifySafely(`operators ${shortcode}`, async () => sendTo(await operators(), plan.operators!)) : null,
  ]);
}
