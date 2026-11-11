import { db } from "@/lib/firebase/admin";
import { errorResponse } from "@/lib/auth/member";
import { COMMENTABLE, type ClaimJudgment } from "@/lib/check/types";

export const runtime = "nodejs";

/**
 * 공개 기록 — 인스타그램에 실제로 게시한 근거 안내 댓글.
 *
 * 로그인 없이 읽는다. 이미 공개된 댓글이므로 내용과 주소를 내보내되,
 * 누가 게시했는지(운영자)와 누가 제보했는지는 내보내지 않는다.
 * 게시 전의 판정·초안은 여기 나오지 않는다.
 *
 * claims는 댓글이 바로잡은 게시물 속 주장이다(최근 판정에서 정정 대상인 것만).
 * 게시물에 이미 공개된 말이고, 이게 있어야 댓글이 무엇에 답했는지 링크를 열지 않고 안다.
 *
 * stats는 숫자만 낸다(제보 수, 확인한 게시물, 게시한 댓글, 잼통 자료 대기). 처음 온 사람이
 * 이 서비스가 실제로 돌아가는지 볼 근거다. 무엇이 제보됐는지는 담지 않는다.
 */
export async function GET() {
  try {
    const tasks = db().collection("fc_tasks");
    const [snap, reports, all, processing, waiting, postedCount] = await Promise.all([
      tasks.where("status", "==", "posted").orderBy("postedAt", "desc").limit(30).get(),
      db().collection("fc_reports").count().get(),
      tasks.count().get(),
      tasks.where("status", "==", "processing").count().get(),
      tasks.where("status", "==", "waiting_for_content").count().get(),
      tasks.where("status", "==", "posted").count().get(),
    ]);
    const checkRefs = snap.docs
      .map((d) => d.data().latestCheckId as string | undefined)
      .filter((id): id is string => Boolean(id))
      .map((id) => db().collection("fc_checks").doc(id));
    const checks = checkRefs.length ? await db().getAll(...checkRefs) : [];
    const claimsByCheck = new Map(
      checks.map((c) => {
        const claims = ((c.data()?.claims ?? []) as ClaimJudgment[])
          .filter((j) => COMMENTABLE.has(j.verdict))
          .map((j) => j.claim);
        return [c.id, claims];
      }),
    );

    return Response.json(
      {
        stats: {
          reports: reports.data().count,
          checked: all.data().count - processing.data().count,
          posted: postedCount.data().count,
          waiting: waiting.data().count,
        },
        posted: snap.docs.map((d) => {
          const t = d.data();
          return {
            id: d.id,
            url: t.url,
            verdict: t.verdict ?? null,
            comment: t.finalComment ?? null,
            claims: claimsByCheck.get(t.latestCheckId) ?? [],
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
