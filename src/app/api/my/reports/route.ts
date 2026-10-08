import { errorResponse, requireUser } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";
import { outcomeOf } from "@/lib/outcome";

export const runtime = "nodejs";

/** 내가 한 제보와 그 처리 결과. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request, { google: true });
    const reports = await db()
      .collection("fc_reports")
      .where("reporterUid", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const ids = [...new Set(reports.docs.map((d) => d.data().shortcode as string))];
    const tasks = ids.length
      ? await db().getAll(...ids.map((id) => db().collection("fc_tasks").doc(id)))
      : [];
    const byId = new Map(tasks.map((t) => [t.id, t.data()]));

    return Response.json({
      reports: reports.docs.map((d) => {
        const r = d.data();
        return {
          id: d.id,
          shortcode: r.shortcode,
          url: r.url,
          claim: r.claim ?? null,
          memo: r.memo ?? null,
          imageCount: (r.imagePaths ?? []).length,
          createdAt: r.createdAt,
          outcome: outcomeOf(byId.get(r.shortcode)),
        };
      }),
    });
  } catch (error) {
    return errorResponse(error, "my:reports");
  }
}
