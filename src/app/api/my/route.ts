import { z } from "zod";

import { errorResponse, HttpError, requireUser, roleOf } from "@/lib/auth/member";
import { deleteAccount, ensureProfile, getProfile, renameProfile } from "@/lib/users";

export const runtime = "nodejs";

/**
 * 내 계정.
 *
 * 익명이면 프로필 없이 상태만 돌려준다(role: null). 구글이 연결돼 있으면 프로필을
 * 만들거나 맞추고 역할을 준다 — 운영자가 아니면 contributor. 화면은 이 하나로 메뉴와
 * 권한을 정한다.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!user.google) return Response.json({ uid: user.uid, google: false, profile: null, role: null });
    // 프로필을 먼저 만든다. 이메일로 미리 지정된 운영자 초대가 여기서 반영된다.
    const profile = await ensureProfile(user);
    const role = await roleOf(user.uid);
    return Response.json({ uid: user.uid, google: true, profile, role });
  } catch (error) {
    return errorResponse(error, "my");
  }
}

const patchSchema = z.object({ displayName: z.string().max(40) });

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request, { google: true });
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    await ensureProfile(user);
    await renameProfile(user.uid, parsed.data.displayName);
    return Response.json({ profile: await getProfile(user.uid) });
  } catch (error) {
    return errorResponse(error, "my:patch");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json(await deleteAccount(user.uid));
  } catch (error) {
    return errorResponse(error, "my:delete");
  }
}
