/**
 * 판정 경로 연기 시험 (Firebase 없이).
 *
 *   FACTBASE_URL=file:///…/factbase.json pnpm smoke "게시물 글"
 *
 * 읽기 → 후보 검색 → 판정 → 서버 검사 → 댓글 조립을 실제 모델로 한 번 돌린다.
 * 모델을 두세 번 부르므로 비용이 든다.
 */
import { composeComment } from "@/lib/check/comment";
import { extract, judge } from "@/lib/check/model";
import { validateJudgment } from "@/lib/check/validate";
import { loadFactbase } from "@/lib/factbase/load";
import { candidatesFor } from "@/lib/factbase/search";

const caption = process.argv.slice(2).join(" ");
if (!caption) {
  console.error('사용법: pnpm smoke "게시물 글"');
  process.exit(1);
}

const { index, factbase } = await loadFactbase();
const extraction = await extract({ caption, hints: [], images: [] });
console.log("## 읽기", JSON.stringify(extraction, null, 2));
if (!extraction.claims.length) process.exit(0);

const candidates = candidatesFor(index, extraction.claims);
const byAnchor = new Map(candidates.map((c) => [c.anchor, c]));
console.log(`## 후보 ${candidates.length}건 (factbase v${factbase.version})`);

let judgment = await judge({ contentText: extraction.contentText, claims: extraction.claims, candidates });
let errors = validateJudgment(judgment, byAnchor);
if (errors.length) {
  console.log("## 1차 검사 탈락", errors);
  judgment = await judge({ contentText: extraction.contentText, claims: extraction.claims, candidates, retryErrors: errors });
  errors = validateJudgment(judgment, byAnchor);
}
console.log("## 판정", JSON.stringify(judgment, null, 2));
console.log("## 검사", errors.length ? errors : "통과");
console.log("## 댓글\n" + (errors.length ? "(없음)" : (composeComment(judgment, byAnchor) ?? "(없음)")));
