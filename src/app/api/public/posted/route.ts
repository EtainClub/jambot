import { db } from "@/lib/firebase/admin";
import { errorResponse } from "@/lib/auth/member";

export const runtime = "nodejs";

/**
 * 공개 기록 — 인스타그램에 실제로 게시한 근거 안내 댓글.
 *
 * 로그인 없이 읽는다. 이미 공개된 댓글이므로 내용과 주소를 내보내되,
 * 누가 게시했는지(운영자)와 누가 제보했는지는 내보내지 않는다.
 * 게시 전의 판정·초안은 여기 나오지 않는다.
 */
export async function GET() {
  try {
    const snap = await db()
      .collection("fc_tasks")
      .where("status", "==", "posted")
      .orderBy("postedAt", "desc")
      .limit(30)
      .get();
    return Response.json(
      {
        posted: snap.docs.map((d) => {
          const t = d.data();
          return {
            id: d.id,
            url: t.url,
            verdict: t.verdict ?? null,
            comment: t.finalComment ?? null,
            postedUrl: t.postedUrl ?? null,
            postedAt: t.postedAt ?? null,
          };
        }),
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    return errorResponse(error, "public:posted");
  }
}
