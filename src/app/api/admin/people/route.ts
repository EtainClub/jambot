import { errorResponse, requireMember } from "@/lib/auth/member";
import { listPeople } from "@/lib/members";

export const runtime = "nodejs";

/** 구글을 연결한 사람 전부와 그 역할, 이메일로 미리 지정한 초대. 관리자만. */
export async function GET(request: Request) {
  try {
    await requireMember(request, "admin");
    return Response.json(await listPeople());
  } catch (error) {
    return errorResponse(error, "admin:people");
  }
}
