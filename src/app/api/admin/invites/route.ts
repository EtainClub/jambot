import { z } from "zod";

import { errorResponse, HttpError, requireMember } from "@/lib/auth/member";
import { inviteByEmail } from "@/lib/members";
import { ROLES } from "@/lib/tasks/transitions";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().max(200), role: z.enum(ROLES) });

/** 아직 가입하지 않은 사람을 이메일로 미리 지정한다. role이 contributor면 초대 취소. */
export async function POST(request: Request) {
  try {
    const actor = await requireMember(request, "admin");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    await inviteByEmail(actor, parsed.data.email, parsed.data.role);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "admin:invite");
  }
}
