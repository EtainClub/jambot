import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/auth/member";
import { getConfig } from "@/lib/config";

import { applyAction, expire, type Actor, type TaskAction, type TaskState } from "./transitions";

/**
 * 작업 문서에 상태 전이를 적용한다.
 *
 * 읽기와 쓰기를 한 트랜잭션에 묶는다. 두 운영자가 같은 순간 수락을 누르면
 * 둘 다 queued를 읽지만, 트랜잭션은 하나만 통과시키고 다른 하나를 다시 돌린다.
 * 다시 돈 쪽은 claimed를 읽고 applyAction에서 거절된다.
 */

const tasks = () => db().collection("fc_tasks");

function stateOf(data: FirebaseFirestore.DocumentData): TaskState {
  return {
    status: data.status,
    assignee: data.assignee ?? null,
    expiresAt: data.expiresAt ?? null,
    finalComment: data.finalComment ?? null,
  };
}

/** 한국 시간 오늘 0시(ms). */
export function kstDayStart(now: number): number {
  const KST = 9 * 3_600_000;
  return Math.floor((now + KST) / 86_400_000) * 86_400_000 - KST;
}

/**
 * 오늘 게시한 수와 지금 쥐고 있는 수락을 합쳐 상한을 넘는지 본다.
 * 수락 시점에 막는다 — 이미 인스타그램에 단 댓글의 기록은 막지 않는다.
 * 트랜잭션 밖이라 동시에 누르면 한두 건 넘을 수 있다. 상한은 느슨한 안전장치다.
 */
async function assertDailyQuota(actor: Actor): Promise<void> {
  const { dailyPostLimit } = await getConfig();
  const [posted, held] = await Promise.all([
    tasks()
      .where("postedBy", "==", actor.uid)
      .where("postedAt", ">=", kstDayStart(Date.now()))
      .orderBy("postedAt", "desc")
      .count()
      .get(),
    tasks().where("status", "==", "claimed").where("assignee", "==", actor.uid).count().get(),
  ]);
  if (posted.data().count + held.data().count >= dailyPostLimit) {
    throw new HttpError(429, `오늘 게시 상한(${dailyPostLimit}건)에 닿았습니다. 내일 다시 수락해 주세요.`);
  }
}

export async function runTaskAction(id: string, action: TaskAction, actor: Actor): Promise<void> {
  if (action.type === "claim") await assertDailyQuota(actor);
  const ref = tasks().doc(id);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "작업을 찾을 수 없습니다.");
    const t = applyAction(stateOf(snap.data()!), action, actor, Date.now());
    if (!t.ok) throw new HttpError(409, t.error);
    tx.update(ref, { ...t.patch, updatedAt: Date.now(), history: FieldValue.arrayUnion(t.history) });
  });
}

/** 만료된 수락을 대기열로 돌린다. 돌린 개수를 돌려준다. */
export async function expireClaims(now = Date.now()): Promise<number> {
  const stale = await tasks().where("status", "==", "claimed").where("expiresAt", "<=", now).get();
  let count = 0;
  for (const doc of stale.docs) {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const t = expire(stateOf(snap.data()!), now);
      if (!t.ok) return; // 그 사이 연장했거나 게시했다
      tx.update(doc.ref, { ...t.patch, updatedAt: now, history: FieldValue.arrayUnion(t.history) });
      count++;
    });
  }
  return count;
}
