import type { FactEntry } from "@/lib/factbase/types";

import { ANCHORED, COMMENTABLE, type Judgment } from "./types";

/**
 * 모델 판정의 서버 검사.
 *
 * 프롬프트로 부탁한 것을 여기서 다시 본다. 모델이 지키리라 믿지 않는다 —
 * 지키지 않은 판정이 저장되면 그것이 운영자 화면에 "근거 있음"으로 뜨고,
 * 운영자는 그 근거를 열어 보지 않은 채 댓글을 복사한다.
 *
 * 돌려주는 것은 오류 문장 목록이다. 비어 있으면 통과. 오류는 재시도 때
 * 모델에게 그대로 돌려준다.
 */

export const COMMENT_MAX = 300;

const URL_PATTERN = /(https?:\/\/|www\.|[a-z0-9-]+\.(?:kr|com|net|org|go\.kr)\b)/i;

export function validateJudgment(
  judgment: Judgment,
  candidates: Map<string, FactEntry>,
): string[] {
  const errors: string[] = [];

  if (judgment.claims.length === 0) {
    errors.push("판정한 주장이 없다");
  }

  for (const [i, claim] of judgment.claims.entries()) {
    const at = `claims[${i}]`;
    for (const anchor of claim.anchors) {
      if (!candidates.has(anchor)) {
        errors.push(`${at}: 후보 목록에 없는 앵커 "${anchor}"`);
      }
    }
    if (ANCHORED.has(claim.verdict) && claim.anchors.length === 0) {
      errors.push(`${at}: ${claim.verdict} 판정에는 근거 앵커가 하나 이상 있어야 한다`);
    }
    if (claim.verdict === "out_of_scope" && claim.anchors.length > 0) {
      errors.push(`${at}: out_of_scope인데 앵커를 달았다. 근거가 있으면 범위 밖이 아니다`);
    }
    if (claim.verdict === "out_of_scope" && !claim.gapTopic?.trim()) {
      errors.push(`${at}: out_of_scope에는 gapTopic이 필요하다`);
    }
    if (claim.verdict === "outdated") {
      const dated = claim.anchors.some((a) => Boolean(candidates.get(a)?.date));
      if (!dated) errors.push(`${at}: outdated는 날짜가 있는 근거로만 판정한다`);
    }
  }

  const needsComment = judgment.claims.some((c) => COMMENTABLE.has(c.verdict));
  const body = judgment.commentBody?.trim() ?? "";

  if (needsComment && !body) {
    errors.push("정정이 필요한 판정이 있는데 commentBody가 없다");
  }
  if (!needsComment && body) {
    errors.push("정정할 판정이 없는데 commentBody를 썼다");
  }
  if (body) {
    if (body.length > COMMENT_MAX) {
      errors.push(`commentBody가 ${body.length}자다. ${COMMENT_MAX}자 이내로`);
    }
    if (URL_PATTERN.test(body)) {
      errors.push("commentBody에 주소를 쓰지 않는다. 링크는 서버가 붙인다");
    }
    /*
     * 남의 주장을 우리 사실처럼 옮기지 않았는지 본다.
     * 댓글에 쓴 근거가 CLAIM이면 그 주체의 이름이 본문에 나와야 한다.
     */
    const cited = judgment.claims
      .filter((c) => COMMENTABLE.has(c.verdict))
      .flatMap((c) => c.anchors)
      .map((a) => candidates.get(a))
      .filter((e): e is FactEntry => Boolean(e));
    for (const entry of cited) {
      if (entry.assertionType === "CLAIM" && entry.assertedBy && !body.includes(entry.assertedBy)) {
        errors.push(
          `근거 ${entry.anchor}는 ${entry.assertedBy}의 주장(CLAIM)이다. 댓글에 "${entry.assertedBy}에 따르면"처럼 주체를 밝혀야 한다`,
        );
      }
    }
  }

  return errors;
}
