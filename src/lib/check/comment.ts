import type { FactEntry } from "@/lib/factbase/types";

import { COMMENTABLE, type Judgment } from "./types";

export const COMMENT_HEADER = "[잼통 근거 안내]";
export const SITE = "https://jamtong.kr";

/**
 * 댓글을 조립한다.
 *
 * 모델은 본문만 쓴다. 머리말과 링크는 여기서 붙인다 — 주소를 모델이 쓰게 하면
 * 그럴듯한 가짜 주소가 섞여 나가고, 그 주소가 열리지 않으면 근거 안내 전체가
 * 거짓말이 된다. 링크는 실제로 인용한 앵커의 화면 경로에서만 나온다.
 */
export function composeComment(judgment: Judgment, candidates: Map<string, FactEntry>): string | null {
  const body = judgment.commentBody?.trim();
  if (!body) return null;

  const paths: string[] = [];
  for (const claim of judgment.claims) {
    if (!COMMENTABLE.has(claim.verdict)) continue;
    for (const anchor of claim.anchors) {
      const path = candidates.get(anchor)?.path;
      if (path && !paths.includes(path)) paths.push(path);
    }
  }

  const links = paths.slice(0, 2).map((p) => `${SITE}${p}`);
  return [COMMENT_HEADER, body, ...(links.length ? ["", `근거: ${links.join(" ")}`] : [])].join("\n");
}
