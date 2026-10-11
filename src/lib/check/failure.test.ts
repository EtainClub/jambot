import assert from "node:assert/strict";
import { test } from "node:test";

import { failureNote, isTransient } from "./failure";

const apiError = (status: number, message: string) => Object.assign(new Error(message), { status });

test("크레딧 부족·사용량 초과·서버 오류·연결 끊김은 일시적이다", () => {
  assert.ok(isTransient(apiError(400, '400 {"error":{"message":"Your credit balance is too low"}}')));
  assert.ok(isTransient(apiError(429, "rate limit")));
  assert.ok(isTransient(apiError(529, "overloaded")));
  assert.ok(isTransient(apiError(503, "unavailable")));
  assert.ok(isTransient(new Error("Connection error."))); // SDK APIConnectionError의 실제 모양
  assert.ok(isTransient(new Error("Request timed out.")));
  assert.ok(isTransient(new TypeError("fetch failed")));
});

test("형식 오류나 코드 오류는 일시적이지 않다", () => {
  assert.equal(isTransient(apiError(400, "invalid_request_error: max_tokens")), false);
  assert.equal(isTransient(new Error("게시물이 없습니다: abc")), false);
  assert.equal(isTransient(new Error("판정 결과를 해석하지 못했습니다.")), false);
});

test("안내 문구에 오류 원문을 싣지 않는다", () => {
  const note = failureNote(apiError(400, '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}'), true);
  assert.match(note, /크레딧 부족/);
  assert.match(note, /저절로 다시 시도/);
  assert.doesNotMatch(note, /invalid_request_error|\{/);
});
