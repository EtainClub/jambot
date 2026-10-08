import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInstagramUrl } from "@/lib/instagram/url";
import { topicKey } from "@/lib/gaps/topic";

import { buildIndex, candidatesFor } from "./search";
import type { FactEntry } from "./types";

const entry = (anchor: string, text: string): FactEntry => ({
  anchor,
  kind: "claim",
  title: "",
  text,
  sources: [],
  path: "/",
  categories: [],
});

test("조사가 붙어도 같은 근거를 찾는다", () => {
  const index = buildIndex([
    entry("a", "공소청은 기소를 맡는다"),
    entry("b", "북극항로 시범운항"),
  ]);
  const found = index.search("공소청이 수사까지 한다던데", 5).map((c) => c.entry.anchor);
  assert.deepEqual(found, ["a"]);
});

test("주장마다 후보를 나눠 담는다", () => {
  const index = buildIndex([entry("a", "원유 비축"), entry("b", "청년미래적금 가입")]);
  const anchors = candidatesFor(index, ["원유 비축량", "청년미래적금"]).map((e) => e.anchor);
  assert.deepEqual(anchors.sort(), ["a", "b"]);
});

test("인스타그램 주소에서 shortcode를 뽑는다", () => {
  assert.equal(parseInstagramUrl("https://www.instagram.com/reel/DAbc_12-x/?igsh=xyz")?.shortcode, "DAbc_12-x");
  assert.equal(parseInstagramUrl("https://instagram.com/someone/p/Cxyz123/")?.shortcode, "Cxyz123");
  assert.equal(parseInstagramUrl("https://example.com/p/abc"), null);
});

test("공백 주제 키는 띄어쓰기와 기호를 무시한다", () => {
  assert.equal(topicKey("고유가 피해지원금"), topicKey("고유가피해 지원금!"));
});
