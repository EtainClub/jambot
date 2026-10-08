import "server-only";

import { createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/firebase/admin";

/**
 * 제보 남용 방지.
 *
 * 잼통 guard.ts는 프로세스 메모리에 센다. 여기서는 Firestore 카운터를 쓴다 —
 * 인스턴스가 여럿이면 메모리 한도는 인스턴스 수만큼 배가 되고, 제보는 한 건마다
 * 모델을 두 번 부르므로 그 배수가 그대로 비용이다.
 *
 * IP는 해시만 남긴다. 원래 주소를 보관할 이유가 없다.
 */

const IP_LIMIT = Number(process.env.REPORT_IP_LIMIT ?? 10); // 1시간당
const DAILY_LIMIT = Number(process.env.REPORT_DAILY_LIMIT ?? 200);

export function clientIpHash(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return createHash("sha256").update(`fc:${ip}`).digest("hex").slice(0, 32);
}

/** 한도 안이면 true를 돌려주고 센다. 넘었으면 false. */
export async function consume(ipHash: string, now = new Date()): Promise<boolean> {
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const ipRef = db().collection("fc_counters").doc(`ip_${ipHash}_${hour}`);
  const dayRef = db().collection("fc_counters").doc(`day_${day}`);

  return db().runTransaction(async (tx) => {
    const [ip, total] = await Promise.all([tx.get(ipRef), tx.get(dayRef)]);
    if ((ip.data()?.count ?? 0) >= IP_LIMIT) return false;
    if ((total.data()?.count ?? 0) >= DAILY_LIMIT) return false;
    tx.set(ipRef, { count: FieldValue.increment(1), at: now }, { merge: true });
    tx.set(dayRef, { count: FieldValue.increment(1), at: now }, { merge: true });
    return true;
  });
}
