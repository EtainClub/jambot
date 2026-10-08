/**
 * 인스타그램 게시물 주소 → shortcode.
 *
 * shortcode가 곧 fc_posts의 문서 id다. 같은 게시물이 어느 경로로 들어오든
 * 같은 문서로 모이게 하는 것이 이 함수의 일이다 — 그래서 주소의 꼬리
 * (`?igsh=`, `?img_index=`)나 사용자명 경로(`/username/p/…`)를 모두 떼고
 * shortcode만 남긴다.
 */

const PATTERN =
  /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/;

export function parseInstagramUrl(raw: string): { shortcode: string; url: string } | null {
  const match = PATTERN.exec(raw.trim());
  if (!match) return null;
  const shortcode = match[1];
  return { shortcode, url: `https://www.instagram.com/p/${shortcode}/` };
}

/** 게시 완료로 적는 댓글 주소. 댓글 고유 주소가 없을 때도 있어 게시물 주소까지 받는다. */
export function isInstagramUrl(raw: string): boolean {
  return /^https?:\/\/(?:www\.|m\.)?instagram\.com\//.test(raw.trim());
}
