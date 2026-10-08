import "server-only";

/**
 * 게시물 캡션 받기 (선택).
 *
 * Meta oEmbed는 앱 토큰이 있어야 하고, 응답에 캡션이 어떤 필드로 오는지는
 * 실제 앱 등록 후 확인해야 한다(설계 문서 12장). 토큰이 없거나 실패하면 null을
 * 돌려주고, 판정은 제보자가 올린 스크린샷과 주장으로 진행한다.
 */
export async function fetchCaption(url: string): Promise<string | null> {
  const token = process.env.INSTAGRAM_OEMBED_TOKEN;
  if (!token) return null;
  const endpoint = new URL("https://graph.facebook.com/v23.0/instagram_oembed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("omitscript", "true");
  endpoint.searchParams.set("access_token", token);
  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[oembed] ${res.status} ${url}`);
      return null;
    }
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === "string" && data.title.trim() ? data.title.trim() : null;
  } catch (error) {
    console.warn("[oembed] 실패", error);
    return null;
  }
}
