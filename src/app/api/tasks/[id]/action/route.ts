import { z } from "zod";

import { errorResponse, HttpError, requireMember } from "@/lib/auth/member";
import { runTaskAction } from "@/lib/tasks/store";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("claim") }),
  z.object({ type: z.literal("release") }),
  z.object({ type: z.literal("extend") }),
  z.object({ type: z.literal("edit"), comment: z.string().max(2000) }),
  z.object({ type: z.literal("posted"), postedUrl: z.string().max(500), comment: z.string().max(2000) }),
  z.object({ type: z.literal("skip"), reason: z.string().max(500) }),
  z.object({ type: z.literal("requeue") }),
  z.object({ type: z.literal("reply"), text: z.string().max(1000) }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/tasks/[id]/action">) {
  try {
    const actor = await requireMember(request);
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    const { id } = await ctx.params;
    await runTaskAction(id, parsed.data, actor);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "tasks:action");
  }
}
