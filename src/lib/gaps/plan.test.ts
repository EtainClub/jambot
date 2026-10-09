import assert from "node:assert/strict";
import { test } from "node:test";

import type { Judgment } from "@/lib/check/types";

import { addPost, desiredGaps, mergeInto, removePost, type GapState } from "./plan";

const judgment = (claims: [string, string, string | null][]): Judgment => ({
  claims: claims.map(([claim, verdict, gapTopic]) => ({
    claim,
    verdict: verdict as Judgment["claims"][number]["verdict"],
    anchors: [],
    reasoning: "",
    gapTopic,
  })),
  commentBody: null,
});

test("같은 주제의 주장 둘은 공백 하나로 모이고 예시는 둘 다 남는다", () => {
  const d = desiredGaps(
    judgment([
      ["수입 원가 39,000원", "out_of_scope", "브라질산 계란 수입"],
      ["4,980원에 판다", "out_of_scope", "브라질산 계란 수입 "],
      ["사실인 주장", "accurate", null],
    ]),
  );
  assert.equal(d.size, 1);
  const [only] = [...d.values()];
  assert.deepEqual(only.claims, ["수입 원가 39,000원", "4,980원에 판다"]);

  const gap = addPost(undefined, only.topic, "P1", only.claims);
  assert.deepEqual(gap.postIds, ["P1"]);
  assert.equal(gap.examples.length, 2);
});

test("같은 게시물을 다시 넣어도 중복되지 않는다", () => {
  const once = addPost(undefined, "t", "P1", ["a"]);
  const twice = addPost(once, "t", "P1", ["a"]);
  assert.deepEqual(twice.postIds, ["P1"]);
  assert.equal(twice.examples.length, 1);
});

test("마지막 게시물이 빠지면 공백이 해결됨으로 닫힌다", () => {
  const gap: GapState = { topic: "t", status: "requested", postIds: ["P1"], examples: [{ postId: "P1", claim: "a" }] };
  const after = removePost(gap, "P1");
  assert.equal(after.status, "resolved");
  assert.equal(after.examples.length, 0);
});

test("보류한 공백은 게시물이 빠져도 보류로 남는다", () => {
  const gap: GapState = { topic: "t", status: "dismissed", postIds: ["P1"], examples: [] };
  assert.equal(removePost(gap, "P1").status, "dismissed");
});

test("해결된 공백에 새 게시물이 오면 다시 열린다", () => {
  const gap: GapState = { topic: "t", status: "resolved", postIds: [], examples: [] };
  assert.equal(addPost(gap, "t", "P2", ["b"]).status, "open");
});

test("합치면 게시물과 예시가 한쪽으로 모이고 다른 쪽은 합쳐짐이 된다", () => {
  const a: GapState = { topic: "A", status: "open", postIds: ["P1"], examples: [{ postId: "P1", claim: "x" }] };
  const b: GapState = { topic: "B", status: "open", postIds: ["P1", "P2"], examples: [{ postId: "P2", claim: "y" }] };
  const { from, into } = mergeInto(a, b);
  assert.equal(from.status, "merged");
  assert.deepEqual(into.postIds, ["P1", "P2"]);
  assert.equal(into.examples.length, 2);
});
