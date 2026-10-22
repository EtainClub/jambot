/**
 * 게시물 대표 이미지(og:image) 받기.
 *
 * 인스타그램은 로그인 없이 게시물 페이지를 열면 미리보기용 og:image를 준다.
 * 링크 미리보기 봇(facebookexternalhit)으로 요청해야 로그인 화면 대신 그 태그가 온다.
 * 캐러셀은 첫 장, 릴스는 표지 한 장뿐이고 640px로 줄어 있다. 나머지는 제보자의
 * 스크린샷이 보탠다. 실패하면 null을 돌려주고 판정은 그대로 진행한다.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"] as const);

export interface Thumbnail {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

export function ogImageUrl(html: string): string | null {
  const match = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (!match) return null;
  const url = match[1].replaceAll("&amp;", "&");
  // 다른 곳으로 요청이 새지 않도록 인스타그램 CDN만 받는다.
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && (hostname.endsWith(".cdninstagram.com") || hostname.endsWith(".fbcdn.net")) ? url : null;
  } catch {
    return null;
  }
}

export async function fetchThumbnail(postUrl: string): Promise<Thumbnail | null> {
  try {
    const page = await fetch(postUrl, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!page.ok) {
      console.warn(`[thumbnail] ${page.status} ${postUrl}`);
      return null;
    }
    const imageUrl = ogImageUrl(await page.text());
    if (!imageUrl) return null;
    const image = await fetch(imageUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const contentType = image.headers.get("content-type")?.split(";")[0] as Thumbnail["contentType"] | undefined;
    if (!image.ok || !contentType || !TYPES.has(contentType)) return null;
    const buffer = Buffer.from(await image.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;
    return { buffer, contentType };
  } catch (error) {
    console.warn("[thumbnail] 실패", error);
    return null;
  }
}
