import { errorResponse, HttpError, requireMember } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/** 작업 상세. 게시물, 최신 판정, 판정 이력, 제보를 함께 준다. */
export async function GET(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    await requireMember(request);
    const { id } = await ctx.params;
    const [task, post, checks, reports] = await Promise.all([
      db().collection("fc_tasks").doc(id).get(),
      db().collection("fc_posts").doc(id).get(),
      db().collection("fc_checks").where("postId", "==", id).orderBy("createdAt", "desc").limit(10).get(),
      db().collection("fc_reports").where("shortcode", "==", id).orderBy("createdAt", "desc").limit(20).get(),
    ]);
    if (!task.exists) throw new HttpError(404, "작업을 찾을 수 없습니다.");
    const p = post.data() ?? {};
    return Response.json({
      task: { id, ...task.data() },
      post: {
        url: p.url,
        caption: p.caption ?? null,
        contentText: p.contentText ?? null,
        claimHints: p.claimHints ?? [],
        imageCount: (p.imagePaths ?? []).length,
        reportCount: p.reportCount ?? 0,
      },
      checks: checks.docs.map((d) => ({ id: d.id, ...d.data() })),
      // 제보자 식별 정보(ipHash)는 내보내지 않는다.
      reports: reports.docs.map((d) => {
        const r = d.data();
        return { id: d.id, claim: r.claim, memo: r.memo, createdAt: r.createdAt };
      }),
    });
  } catch (error) {
    return errorResponse(error, "tasks:get");
  }
}
