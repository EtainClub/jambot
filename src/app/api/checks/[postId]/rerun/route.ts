import { after } from "next/server";

import { errorResponse, HttpError, requireMember } from "@/lib/auth/member";
import { runCheck } from "@/lib/check/pipeline";
import { db } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 재판정. 운영 관리자 이상. 사람이 잡은 작업이면 상태는 그대로 두고 판정 기록만 더한다. */
export async function POST(request: Request, ctx: RouteContext<"/api/checks/[postId]/rerun">) {
  try {
    await requireMember(request, "admin");
    const { postId } = await ctx.params;
    if (!(await db().collection("fc_posts").doc(postId).get()).exists) {
      throw new HttpError(404, "게시물을 찾을 수 없습니다.");
    }
    after(() => runCheck(postId));
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    return errorResponse(error, "checks:rerun");
  }
}
