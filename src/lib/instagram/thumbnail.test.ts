import assert from "node:assert/strict";
import { test } from "node:test";

import { ogImageUrl } from "./thumbnail";

test("인스타그램 CDN 주소를 꺼내고 &amp;를 푼다", () => {
  const html = `<meta property="og:image" content="https://scontent-gmp1-1.cdninstagram.com/v/a.jpg?stp=x&amp;_nc_cat=110" />`;
  assert.equal(ogImageUrl(html), "https://scontent-gmp1-1.cdninstagram.com/v/a.jpg?stp=x&_nc_cat=110");
});

test("다른 호스트나 http는 받지 않는다", () => {
  assert.equal(ogImageUrl(`<meta property="og:image" content="https://evil.example/a.jpg" />`), null);
  assert.equal(ogImageUrl(`<meta property="og:image" content="http://scontent.cdninstagram.com/a.jpg" />`), null);
});

test("태그가 없으면 null", () => {
  assert.equal(ogImageUrl("<html></html>"), null);
});
