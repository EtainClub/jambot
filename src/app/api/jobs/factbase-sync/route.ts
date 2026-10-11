import { errorResponse, requireCron } from "@/lib/auth/member";
import { runCheck } from "@/lib/check/pipeline";
import { loadFactbase } from "@/lib/factbase/load";
import { db } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 900;

/** 새 판정을 시작하는 마감. maxDuration(Cloud Scheduler 마감도 900초)보다 판정 하나만큼 짧게 둔다. */
const BUDGET_MS = 12 * 60_000;

/**
 * 잼통 자료 반영 → 자료 대기 작업 재판정.
 *
 * 잼통에 자료가 등록되어 배포되면 factbase 버전이 바뀐다. 자료 대기(waiting_for_content)
 * 작업 가운데 **지금 버전으로 판정하지 않은 것**만 다시 판정한다. 근거가 생긴 것은 큐로 가고,
 * 여전히 없는 것은 지금 버전을 적은 채 그대로 기다린다.
 *
 * ★ 버전을 "봤다"가 아니라 작업마다 "이 버전으로 판정했다"로 센다.
 *   예전에는 버전을 먼저 저장하고 재판정했다. 그러면 재판정이 중간에 실패하거나
 *   시간이 다 되면 남은 작업은 다음 잼통 배포까지 다시 판정되지 않았다. 이제는
 *   작업의 factbaseVersion이 지금 버전과 다르면 대상이다. 시간 안에 못 한 것과
 *   일시적으로 실패한 것(파이프라인이 자료 대기로 되돌린다)은 다음 회차가 이어 받는다.
 *
 * 재판정은 순서대로 돈다. 한꺼번에 돌리면 모델 호출이 몰려 한도에 걸린다.
 * Cloud Scheduler가 30분마다 부른다.
 */
export async function POST(request: Request) {
  const started = Date.now();
  try {
    requireCron(request);
    const { factbase } = await loadFactbase(true);
    await db()
      .collection("fc_config")
      .doc("factbase")
      .set({ version: factbase.version, builtAt: factbase.builtAt, checkedAt: started }, { merge: true });

    const waiting = await db().collection("fc_tasks").where("status", "==", "waiting_for_content").get();
    const stale = waiting.docs
      .filter((d) => d.data().factbaseVersion !== factbase.version)
      .sort((a, b) => (a.data().updatedAt ?? 0) - (b.data().updatedAt ?? 0));

    let rechecked = 0;
    for (const doc of stale) {
      if (Date.now() - started > BUDGET_MS) break;
      await runCheck(doc.id);
      rechecked++;
    }
    return Response.json({ version: factbase.version, stale: stale.length, rechecked, remaining: stale.length - rechecked });
  } catch (error) {
    return errorResponse(error, "jobs:factbase-sync");
  }
}
