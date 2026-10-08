import { errorResponse, requireCron } from "@/lib/auth/member";
import { runCheck } from "@/lib/check/pipeline";
import { loadFactbase } from "@/lib/factbase/load";
import { db } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 900;

/**
 * 잼통 버전 확인 → 공백 대기 작업 재판정.
 *
 * 잼통에 자료가 등록되어 배포되면 factbase 버전이 바뀐다. 바뀐 것을 보면
 * waiting_for_content 작업을 전부 다시 판정한다. 근거가 생긴 것은 큐로 가고,
 * 여전히 없는 것은 그대로 기다린다.
 *
 * 재판정은 순서대로 돈다. 한꺼번에 돌리면 모델 호출이 몰려 한도에 걸린다.
 * Cloud Scheduler가 30분마다 부른다.
 */
export async function POST(request: Request) {
  try {
    requireCron(request);
    const { factbase } = await loadFactbase(true);
    const stateRef = db().collection("fc_config").doc("factbase");
    const previous = (await stateRef.get()).data()?.version as string | undefined;
    await stateRef.set({ version: factbase.version, builtAt: factbase.builtAt, checkedAt: Date.now() }, { merge: true });

    if (previous === factbase.version) {
      return Response.json({ version: factbase.version, changed: false, rechecked: 0 });
    }

    const waiting = await db().collection("fc_tasks").where("status", "==", "waiting_for_content").limit(200).get();
    for (const doc of waiting.docs) await runCheck(doc.id);
    return Response.json({ version: factbase.version, previous: previous ?? null, changed: true, rechecked: waiting.size });
  } catch (error) {
    return errorResponse(error, "jobs:factbase-sync");
  }
}
