import { z } from "zod";

import { errorResponse, HttpError, requireUser } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";
import { ensureProfile } from "@/lib/users";

export const runtime = "nodejs";

/**
 * 알림 받을 기기 등록·해제. 토큰은 FCM이 기기마다 준다.
 *
 * 한 사람이 쓰는 기기 수는 많지 않다. 새 토큰을 앞에 두고 MAX_DEVICES개만 남긴다 —
 * 브라우저를 지우고 다시 켜면 토큰이 바뀌어 옛것이 쌓이기 때문이다.
 */

const MAX_DEVICES = 5;
const bodySchema = z.object({ token: z.string().min(20).max(4096) });

async function parse(request: Request): Promise<string> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
  return parsed.data.token;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request, { google: true });
    const token = await parse(request);
    await ensureProfile(user);
    const ref = db().collection("fc_users").doc(user.uid);
    const devices = await db().runTransaction(async (tx) => {
      const current = ((await tx.get(ref)).data()?.pushTokens as string[] | undefined) ?? [];
      const next = [token, ...current.filter((t) => t !== token)].slice(0, MAX_DEVICES);
      tx.update(ref, { pushTokens: next, updatedAt: Date.now() });
      return next.length;
    });
    return Response.json({ devices });
  } catch (error) {
    return errorResponse(error, "my:push");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request, { google: true });
    const token = await parse(request);
    const ref = db().collection("fc_users").doc(user.uid);
    const devices = await db().runTransaction(async (tx) => {
      const current = ((await tx.get(ref)).data()?.pushTokens as string[] | undefined) ?? [];
      const next = current.filter((t) => t !== token);
      tx.update(ref, { pushTokens: next, updatedAt: Date.now() });
      return next.length;
    });
    return Response.json({ devices });
  } catch (error) {
    return errorResponse(error, "my:push:delete");
  }
}
