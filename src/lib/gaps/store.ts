import "server-only";

import type { Judgment } from "@/lib/check/types";
import { HttpError } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";
import type { Actor } from "@/lib/tasks/transitions";

import { addPost, desiredGaps, mergeInto, removePost, type GapState } from "./plan";

/**
 * 공백 저장. 계획은 plan.ts가 세우고 여기서는 트랜잭션으로 적는다.
 *
 * count는 늘 postIds.length다. 따로 세면 빼고 더하는 사이에 어긋난다.
 */

const gaps = () => db().collection("fc_gaps");

function stateOf(data: FirebaseFirestore.DocumentData | undefined): GapState | undefined {
  if (!data) return undefined;
  return {
    topic: data.topic,
    status: data.status ?? "open",
    postIds: data.postIds ?? [],
    examples: data.examples ?? [],
  };
}

function write(tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference, gap: GapState, existed: boolean, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  tx.set(
    ref,
    {
      ...gap,
      count: gap.postIds.length,
      updatedAt: now,
      ...(existed ? {} : { createdAt: now }),
      ...(gap.status === "resolved" ? { resolvedAt: now } : {}),
      ...extra,
    },
    { merge: true },
  );
}

/** 게시물 하나의 판정 결과에 맞춰 공백을 맞춘다. 판정이 서버 검사를 통과했을 때만 부른다. */
export async function syncGapsForPost(postId: string, judgment: Judgment): Promise<void> {
  const desired = desiredGaps(judgment);
  const current = await gaps().where("postIds", "array-contains", postId).get();
  const keys = new Set([...desired.keys(), ...current.docs.map((d) => d.id)]);

  for (const key of keys) {
    const ref = gaps().doc(key);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const gap = stateOf(snap.data());
      const want = desired.get(key);
      if (want) {
        write(tx, ref, addPost(gap, want.topic, postId, want.claims), snap.exists);
      } else if (gap?.postIds.includes(postId)) {
        write(tx, ref, removePost(gap, postId), true);
      }
    });
  }
}

/** 운영자가 같은 주제의 공백을 하나로 합친다. */
export async function mergeGaps(actor: Actor, fromKey: string, intoKey: string): Promise<void> {
  if (fromKey === intoKey) throw new HttpError(400, "같은 공백끼리는 합칠 수 없습니다.");
  const fromRef = gaps().doc(fromKey);
  const intoRef = gaps().doc(intoKey);
  await db().runTransaction(async (tx) => {
    const [fromSnap, intoSnap] = await Promise.all([tx.get(fromRef), tx.get(intoRef)]);
    const from = stateOf(fromSnap.data());
    const into = stateOf(intoSnap.data());
    if (!from || !into) throw new HttpError(404, "공백을 찾을 수 없습니다.");
    if (from.status === "merged" || into.status === "merged") throw new HttpError(409, "이미 합쳐진 공백입니다.");
    const result = mergeInto(from, into);
    write(tx, fromRef, result.from, true, { mergedInto: intoKey, mergedBy: { uid: actor.uid, name: actor.name, at: Date.now() } });
    write(tx, intoRef, result.into, true);
  });
}
