import { z } from "zod";

import { errorResponse, HttpError, requireMember } from "@/lib/auth/member";
import { setRole } from "@/lib/members";
import { ROLES } from "@/lib/tasks/transitions";

export const runtime = "nodejs";

const bodySchema = z.object({ role: z.enum(ROLES) });

/** 역할 변경. contributor로 내리면 운영자 해제다. */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/people/[uid]">) {
  try {
    const actor = await requireMember(request, "admin");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    const { uid } = await ctx.params;
    await setRole(actor, uid, parsed.data.role);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "admin:role");
  }
}
