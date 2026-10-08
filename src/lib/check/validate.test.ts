import assert from "node:assert/strict";
import { test } from "node:test";

import type { FactEntry } from "@/lib/factbase/types";

import { composeComment } from "./comment";
import type { Judgment } from "./types";
import { validateJudgment } from "./validate";

const fact = (anchor: string, extra: Partial<FactEntry> = {}): FactEntry => ({
  anchor,
  kind: "claim",
  title: "검찰개혁",
  text: "검찰청은 2026년 10월 2일 폐지됐다.",
  assertionType: "FACT",
  date: "2026-10-02",
  sources: [],
  path: "/achievement/prosecution-reform",
  categories: [],
  ...extra,
});

const candidates = new Map<string, FactEntry>([
  ["prosecution-reform#c1", fact("prosecution-reform#c1")],
  [
    "oil-supply#c2",
    fact("oil-supply#c2", {
      assertionType: "CLAIM",
      assertedBy: "산업통상부",
      path: "/achievement/oil-supply",
    }),
  ],
  ["undated#c3", fact("undated#c3", { date: undefined })],
]);

const judgment = (over: Partial<Judgment> = {}): Judgment => ({
  claims: [
    {
      claim: "검찰청은 아직 그대로다",
      verdict: "false",
      anchors: ["prosecution-reform#c1"],
      reasoning: "",
      gapTopic: null,
    },
  ],
  commentBody: "검찰청은 2026년 10월 2일 폐지되고 공소청·중수청이 설치됐습니다.",
  ...over,
});

test("통과하는 판정", () => {
  assert.deepEqual(validateJudgment(judgment(), candidates), []);
});

test("후보에 없는 앵커는 거절한다", () => {
  const j = judgment();
  j.claims[0].anchors = ["made-up#x"];
  assert.ok(validateJudgment(j, candidates).some((e) => e.includes("made-up#x")));
});

test("정정 판정에 앵커가 없으면 거절한다", () => {
  const j = judgment();
  j.claims[0].anchors = [];
  assert.ok(validateJudgment(j, candidates).some((e) => e.includes("하나 이상")));
});

test("범위 밖 판정에는 주제가 필요하고 앵커가 없어야 한다", () => {
  const errors = validateJudgment(
    judgment({
      claims: [{ claim: "x", verdict: "out_of_scope", anchors: ["prosecution-reform#c1"], reasoning: "", gapTopic: null }],
      commentBody: null,
    }),
    candidates,
  );
  assert.ok(errors.some((e) => e.includes("gapTopic")));
  assert.ok(errors.some((e) => e.includes("범위 밖이 아니다")));
});

test("날짜 없는 근거로 outdated를 내리지 않는다", () => {
  const j = judgment();
  j.claims[0] = { ...j.claims[0], verdict: "outdated", anchors: ["undated#c3"] };
  assert.ok(validateJudgment(j, candidates).some((e) => e.includes("날짜")));
});

test("댓글 본문에 주소를 쓰면 거절한다", () => {
  const errors = validateJudgment(judgment({ commentBody: "자세히는 jamtong.kr 참고" }), candidates);
  assert.ok(errors.some((e) => e.includes("주소")));
});

test("CLAIM 근거를 쓰면 주체를 밝혀야 한다", () => {
  const j = judgment({ commentBody: "원유가 북한으로 간 사실은 없습니다." });
  j.claims[0].anchors = ["oil-supply#c2"];
  assert.ok(validateJudgment(j, candidates).some((e) => e.includes("산업통상부")));

  j.commentBody = "산업통상부에 따르면 원유가 북한으로 간 사실은 없습니다.";
  assert.deepEqual(validateJudgment(j, candidates), []);
});

test("정정할 것이 없으면 댓글도 없어야 한다", () => {
  const j = judgment();
  j.claims[0].verdict = "accurate";
  assert.ok(validateJudgment(j, candidates).some((e) => e.includes("정정할 판정이 없는데")));
});

test("댓글 링크는 인용한 앵커의 경로에서만 나온다", () => {
  const comment = composeComment(judgment(), candidates);
  assert.equal(
    comment,
    "[잼통 근거 안내]\n검찰청은 2026년 10월 2일 폐지되고 공소청·중수청이 설치됐습니다.\n\n근거: https://jamtong.kr/achievement/prosecution-reform",
  );
});
