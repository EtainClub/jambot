import assert from "node:assert/strict";
import { test } from "node:test";

import { planNotices, replyNotice } from "./plan";

test("처리 결과가 정해지면 제보자에게 한 번 알린다", () => {
  const first = planNotices({}, "waiting_for_content", "abc", 1);
  assert.ok(first.reporter);
  assert.equal(first.patch.reporterNotified, "waiting_for_content");
  // 30분 뒤 재판정에서 같은 상태로 돌아와도 다시 알리지 않는다.
  const again = planNotices({ reporterNotified: "waiting_for_content" }, "waiting_for_content", "abc", 2);
  assert.equal(again.reporter, null);
  assert.deepEqual(again.patch, {});
});

test("결과가 바뀌면 다시 알린다", () => {
  const plan = planNotices({ reporterNotified: "waiting_for_content" }, "posted", "abc", 1);
  assert.match(plan.reporter!.body, /댓글/);
});

test("진행 중 상태는 제보자에게 알리지 않는다", () => {
  for (const s of ["processing", "queued", "claimed", "needs_review"]) {
    assert.equal(planNotices({}, s, "abc", 1).reporter, null, s);
  }
});

test("게시 대기는 운영자에게 작업마다 한 번 알린다", () => {
  const first = planNotices({}, "queued", "abc", 5);
  assert.equal(first.operators!.link, "/tasks/abc");
  assert.equal(first.patch.opsNotifiedAt, 5);
  assert.equal(planNotices({ opsNotifiedAt: 5 }, "queued", "abc", 9).operators, null);
});

test("답변 알림은 길면 자른다", () => {
  assert.equal(replyNotice("가".repeat(100)).body.length, 81);
});
