import "server-only";

import { adminAuth, db } from "@/lib/firebase/admin";
import { atLeast, ROLES, type Actor, type Role } from "@/lib/tasks/transitions";

/**
 * 요청한 사람이 운영자인가.
 *
 * 토큰을 검증하고 fc_members/{uid}를 읽는다. 문서가 없거나 active가 거짓이면
 * 운영자가 아니다. 역할이 모자라면 403.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireMember(request: Request, min: Role = "observer"): Promise<Actor & { email: string | null }> {
  const header = request.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) throw new HttpError(401, "로그인이 필요합니다.");

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    throw new HttpError(401, "로그인이 만료됐습니다. 다시 로그인해 주세요.");
  }

  const snap = await db().collection("fc_members").doc(decoded.uid).get();
  const data = snap.data();
  const role = data?.role as Role | undefined;
  if (!snap.exists || data?.active !== true || !role || !ROLES.includes(role)) {
    throw new HttpError(403, "운영자 명단에 없습니다. 소유자에게 등록을 요청해 주세요.");
  }
  if (!atLeast(role, min)) throw new HttpError(403, "권한이 부족합니다.");

  return {
    uid: decoded.uid,
    name: (data?.displayName as string | undefined) ?? decoded.name ?? decoded.email ?? "운영자",
    email: decoded.email ?? null,
    role,
  };
}

/** 스케줄 작업용. Cloud Scheduler가 `Authorization: Bearer $CRON_SECRET`을 보낸다. */
export function requireCron(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_SECRET이 설정되지 않았습니다.");
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new HttpError(401, "인증되지 않은 작업 요청입니다.");
  }
}

/** 라우트 공통 오류 처리. HttpError만 밖으로 내보내고 나머지는 로그에만 남긴다. */
export function errorResponse(error: unknown, where: string): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(`[${where}]`, error);
  return Response.json({ error: "처리하지 못했습니다." }, { status: 500 });
}
