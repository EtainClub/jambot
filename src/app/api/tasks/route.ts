import { errorResponse, requireMember } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";
import { TASK_STATUSES, type TaskStatus } from "@/lib/tasks/transitions";

export const runtime = "nodejs";

/** 작업 목록. status 하나로 거른다. 기본은 처리할 것(queued)이다. */
export async function GET(request: Request) {
  try {
    await requireMember(request);
    const param = new URL(request.url).searchParams.get("status") ?? "queued";
    if (!TASK_STATUSES.includes(param as TaskStatus)) {
      return Response.json({ error: "알 수 없는 상태입니다." }, { status: 400 });
    }
    const snap = await db()
      .collection("fc_tasks")
      .where("status", "==", param)
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();
    const tasks = snap.docs.map((d) => {
      const t = d.data();
      return {
        id: d.id,
        url: t.url,
        status: t.status,
        verdict: t.verdict ?? null,
        reportCount: t.reportCount ?? 0,
        assigneeName: t.assigneeName ?? null,
        expiresAt: t.expiresAt ?? null,
        pipelineNote: t.pipelineNote ?? null,
        draftComment: t.draftComment ?? null,
        updatedAt: t.updatedAt,
      };
    });
    return Response.json({ tasks });
  } catch (error) {
    return errorResponse(error, "tasks");
  }
}
