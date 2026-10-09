import type { Judgment } from "@/lib/check/types";

import { topicKey } from "./topic";

/**
 * 공백 갱신 계획 (순수 함수).
 *
 * 게시물 하나를 판정(또는 재판정)할 때마다, 그 게시물이 어느 공백에 들어 있어야
 * 하는지를 판정 결과에서 다시 계산한다.
 *
 *   - 판정에 out_of_scope·insufficient 주장이 있으면 그 gapTopic의 공백에 넣는다
 *   - 예전에 들어 있던 공백인데 이번 판정에는 없으면 뺀다
 *     → 잼통에 자료가 들어가 재판정에서 근거를 찾으면 공백이 저절로 줄어든다
 *   - 게시물이 하나도 남지 않은 공백은 '해결됨'으로 닫는다
 *
 * 저장은 부르는 쪽(store.ts)이 트랜잭션으로 한다.
 */

export const GAP_VERDICTS = new Set(["out_of_scope", "insufficient"]);

export type GapStatus = "open" | "requested" | "dismissed" | "resolved" | "merged";

export interface GapExample {
  postId: string;
  claim: string;
}

export interface GapState {
  topic: string;
  status: GapStatus;
  postIds: string[];
  examples: GapExample[];
}

const MAX_POSTS = 200;
const MAX_EXAMPLES = 20;

/** 판정에서 이 게시물이 들어가야 할 공백들: key → { topic, claims } */
export function desiredGaps(judgment: Judgment): Map<string, { topic: string; claims: string[] }> {
  const out = new Map<string, { topic: string; claims: string[] }>();
  for (const c of judgment.claims) {
    const topic = c.gapTopic?.trim();
    if (!GAP_VERDICTS.has(c.verdict) || !topic) continue;
    const key = topicKey(topic);
    const entry = out.get(key) ?? { topic, claims: [] };
    entry.claims.push(c.claim);
    out.set(key, entry);
  }
  return out;
}

/** 게시물을 공백에 넣는다. 닫혀 있던 공백(해결됨)은 다시 연다. 보류·합쳐짐은 그대로 둔다. */
export function addPost(gap: GapState | undefined, topic: string, postId: string, claims: string[]): GapState {
  const base: GapState = gap ?? { topic, status: "open", postIds: [], examples: [] };
  const postIds = base.postIds.includes(postId) ? base.postIds : [...base.postIds, postId].slice(-MAX_POSTS);
  const known = new Set(base.examples.map((e) => `${e.postId}\u0000${e.claim}`));
  const examples = [
    ...base.examples,
    ...claims.filter((claim) => !known.has(`${postId}\u0000${claim}`)).map((claim) => ({ postId, claim })),
  ].slice(-MAX_EXAMPLES);
  const status: GapStatus = base.status === "resolved" ? "open" : base.status;
  return { ...base, status, postIds, examples };
}

/** 게시물을 공백에서 뺀다. 남은 게시물이 없으면 열림·요청함 상태를 '해결됨'으로 닫는다. */
export function removePost(gap: GapState, postId: string): GapState {
  const postIds = gap.postIds.filter((id) => id !== postId);
  const examples = gap.examples.filter((e) => e.postId !== postId);
  const closable = gap.status === "open" || gap.status === "requested";
  return { ...gap, postIds, examples, status: postIds.length === 0 && closable ? "resolved" : gap.status };
}

/** 공백 둘을 합친다. from은 '합쳐짐'이 되고 into가 게시물과 예시를 모두 갖는다. */
export function mergeInto(from: GapState, into: GapState): { from: GapState; into: GapState } {
  let merged = into.status === "resolved" ? { ...into, status: "open" as GapStatus } : into;
  for (const postId of from.postIds) {
    const claims = from.examples.filter((e) => e.postId === postId).map((e) => e.claim);
    merged = addPost(merged, merged.topic, postId, claims);
  }
  return { from: { ...from, status: "merged", postIds: [], examples: [] }, into: merged };
}
