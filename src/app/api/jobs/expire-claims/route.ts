import { errorResponse, requireCron } from "@/lib/auth/member";
import { recoverStuck } from "@/lib/check/pipeline";
import { expireClaims } from "@/lib/tasks/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 5분마다 Cloud Scheduler가 부른다(마감 60초).
 *
 *   1. 방치된 수락을 대기열로 돌린다.
 *   2. 판정 중(processing)에 멈춘 작업을 다시 판정한다 — 25초 안에 시작할 수 있는 만큼만.
 */
export async function POST(request: Request) {
  try {
    requireCron(request);
    const expired = await expireClaims();
    const recovered = await recoverStuck();
    return Response.json({ expired, ...recovered });
  } catch (error) {
    return errorResponse(error, "jobs:expire");
  }
}
