import { errorResponse, HttpError, requireMember } from "@/lib/auth/member";
import { bucket, db } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * 제보 스크린샷. 운영자만 본다.
 *
 * 서명 URL을 쓰지 않는 이유: 손에서 쓰는 사용자 자격 증명(ADC)은 URL에 서명할
 * 수 없다. 서버가 직접 읽어 넘기면 환경과 상관없이 같은 방식으로 동작한다.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/posts/[id]/images/[n]">) {
  try {
    await requireMember(request);
    const { id, n } = await ctx.params;
    const paths: string[] = (await db().collection("fc_posts").doc(id).get()).data()?.imagePaths ?? [];
    const path = paths[Number(n)];
    if (!path) throw new HttpError(404, "이미지가 없습니다.");
    const file = bucket().file(path);
    const [[buf], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": meta.contentType ?? "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    return errorResponse(error, "posts:image");
  }
}
