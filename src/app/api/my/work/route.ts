import { errorResponse, requireMember } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/** 운영자가 맡은 일: 지금 처리 중인 것, 게시한 것, 건너뛴 것. */
export async function GET(request: Request) {
  try {
    const me = await requireMember(request);
    const tasks = db().collection("fc_tasks");
    const [claimed, posted, skipped] = await Promise.all([
      tasks.where("assignee", "==", me.uid).where("status", "==", "claimed").get(),
      tasks.where("postedBy", "==", me.uid).orderBy("postedAt", "desc").limit(100).get(),
      tasks.where("skippedBy", "==", me.uid).orderBy("skippedAt", "desc").limit(50).get(),
    ]);
    const row = (d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const t = d.data();
      return {
        id: d.id,
        url: t.url,
        status: t.status,
        verdict: t.verdict ?? null,
        finalComment: t.finalComment ?? null,
        postedUrl: t.postedUrl ?? null,
        postedAt: t.postedAt ?? null,
        expiresAt: t.expiresAt ?? null,
        skipReason: t.skipReason ?? null,
        skippedAt: t.skippedAt ?? null,
      };
    };
    return Response.json({
      claimed: claimed.docs.map(row),
      posted: posted.docs.map(row),
      skipped: skipped.docs.map(row),
    });
  } catch (error) {
    return errorResponse(error, "my:work");
  }
}
