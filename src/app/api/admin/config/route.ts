import { z } from "zod";

import { errorResponse, HttpError, requireMember } from "@/lib/auth/member";
import { getConfig, updateConfig } from "@/lib/config";

export const runtime = "nodejs";

/** 운영 설정(fc_config/main). 관리자만. */
export async function GET(request: Request) {
  try {
    await requireMember(request, "admin");
    return Response.json(await getConfig());
  } catch (error) {
    return errorResponse(error, "admin:config");
  }
}

const patchSchema = z
  .object({
    electionFreeze: z.boolean(),
    staleDays: z.number().int().min(1).max(365),
    dailyPostLimit: z.number().int().min(1).max(200),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "바꿀 값이 없습니다.");

export async function PATCH(request: Request) {
  try {
    const actor = await requireMember(request, "admin");
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "값이 올바르지 않습니다.");
    return Response.json(await updateConfig(parsed.data, { uid: actor.uid, name: actor.name }));
  } catch (error) {
    return errorResponse(error, "admin:config:patch");
  }
}
