import assert from "node:assert/strict";
import { test } from "node:test";

import { applyAction, expire, type Actor, type TaskState } from "./transitions";

const a: Actor = { uid: "a", name: "A", role: "reviewer" };
const b: Actor = { uid: "b", name: "B", role: "reviewer" };
const admin: Actor = { uid: "z", name: "Z", role: "admin" };
const viewer: Actor = { uid: "v", name: "V", role: "observer" };

const queued: TaskState = { status: "queued", assignee: null, expiresAt: null, finalComment: null };
const claimedByA: TaskState = { status: "claimed", assignee: "a", expiresAt: 10_000, finalComment: null };

test("수락하면 담당자와 만료 시각이 생긴다", () => {
  const t = applyAction(queued, { type: "claim" }, a, 0);
  assert.ok(t.ok);
  assert.equal(t.patch.status, "claimed");
  assert.equal(t.patch.assignee, "a");
  assert.equal(t.patch.expiresAt, 30 * 60_000);
});

test("이미 수락된 작업은 다른 사람이 수락할 수 없다", () => {
  const t = applyAction(claimedByA, { type: "claim" }, b, 0);
  assert.equal(t.ok, false);
});

test("열람자는 수락할 수 없다", () => {
  assert.equal(applyAction(queued, { type: "claim" }, viewer, 0).ok, false);
});

test("남의 작업은 고치거나 게시 완료할 수 없다", () => {
  assert.equal(applyAction(claimedByA, { type: "edit", comment: "x" }, b, 0).ok, false);
  assert.equal(
    applyAction(claimedByA, { type: "posted", comment: "x", postedUrl: "https://www.instagram.com/p/abc/" }, b, 0).ok,
    false,
  );
});

test("게시 완료에는 인스타그램 주소가 필요하다", () => {
  assert.equal(applyAction(claimedByA, { type: "posted", comment: "x", postedUrl: "" }, a, 0).ok, false);
  const t = applyAction(
    claimedByA,
    { type: "posted", comment: "x", postedUrl: "https://www.instagram.com/p/abc/c/123/" },
    a,
    5,
  );
  assert.ok(t.ok);
  assert.equal(t.patch.status, "posted");
});

test("운영 관리자는 남의 작업을 반납시킬 수 있다", () => {
  const t = applyAction(claimedByA, { type: "release" }, admin, 0);
  assert.ok(t.ok);
  assert.equal(t.patch.status, "queued");
  assert.equal(t.patch.assignee, null);
});

test("건너뛰려면 이유가 필요하다", () => {
  assert.equal(applyAction(queued, { type: "skip", reason: " " }, a, 0).ok, false);
  assert.ok(applyAction(queued, { type: "skip", reason: "중복" }, a, 0).ok);
});

test("만료 시각이 지난 수락만 되돌린다", () => {
  assert.equal(expire(claimedByA, 9_999).ok, false);
  const t = expire(claimedByA, 10_000);
  assert.ok(t.ok);
  assert.equal(t.patch.status, "queued");
});
