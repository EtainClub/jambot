import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/auth/member";

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

export async function runTaskAction(id: string, action: TaskAction, actor: Actor): Promise<void> {
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
