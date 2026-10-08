import { errorResponse, requireCron } from "@/lib/auth/member";
import { expireClaims } from "@/lib/tasks/store";

export const runtime = "nodejs";

/** 방치된 수락을 대기열로 돌린다. Cloud Scheduler가 5분마다 부른다. */
export async function POST(request: Request) {
  try {
    requireCron(request);
    return Response.json({ expired: await expireClaims() });
  } catch (error) {
    return errorResponse(error, "jobs:expire");
  }
}
