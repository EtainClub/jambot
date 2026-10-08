import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";

import { adminAuth, db } from "@/lib/firebase/admin";
import { atLeast, OPERATOR_ROLES, type Actor, type OperatorRole, type Role } from "@/lib/tasks/transitions";

/**
 * 요청한 사람이 누구인가.
 *
 * 단계가 있다.
 *   익명                — 둘러보기. 처음 들어오면 저절로 생긴다
 *   구글 연결(contributor) — 제보할 수 있다. 내 기록이 이 계정에 쌓인다
 *   운영자(reviewer 이상)  — 구글 연결 + fc_members에 역할이 있다. 역할은 transitions.ts의 ROLES
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function verify(request: Request): Promise<DecodedIdToken> {
  const header = request.headers.get("authorization") ?? "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) throw new HttpError(401, "로그인이 필요합니다.");
  try {
    return await adminAuth().verifyIdToken(idToken);
  } catch {
    throw new HttpError(401, "로그인이 만료됐습니다. 다시 시도해 주세요.");
  }
}

/**
 * 구글이 연결된 계정인가.
 *
 * 익명 계정에 구글을 연결하면 uid는 그대로이고 토큰의 identities에
 * google.com이 생긴다. sign_in_provider는 마지막 로그인 수단이라 연결 직후에도
 * anonymous로 남을 수 있어 그것으로는 판단하지 않는다.
 */
export function isGoogleLinked(token: DecodedIdToken): boolean {
  return Boolean(token.firebase.identities?.["google.com"]?.length);
}

export interface User {
  uid: string;
  email: string | null;
  /** 구글이 확인한 이메일인가. 이메일로 미리 지정한 운영자 초대는 이것이 참일 때만 받는다. */
  emailVerified: boolean;
  name: string;
  google: boolean;
}

export async function requireUser(request: Request, opts: { google?: boolean } = {}): Promise<User> {
  const token = await verify(request);
  const google = isGoogleLinked(token);
  if (opts.google && !google) throw new HttpError(403, "구글 계정을 연결해야 쓸 수 있습니다.");
  return {
    uid: token.uid,
    email: token.email ?? null,
    emailVerified: token.email_verified === true,
    name: token.name ?? token.email ?? "익명",
    google,
  };
}

export async function requireMember(request: Request, min: OperatorRole = "reviewer"): Promise<Actor & { email: string | null }> {
  const token = await verify(request);
  const snap = await db().collection("fc_members").doc(token.uid).get();
  const data = snap.data();
  const role = data?.role as OperatorRole | undefined;
  if (!snap.exists || data?.active !== true || !role || !OPERATOR_ROLES.includes(role) || !isGoogleLinked(token)) {
    throw new HttpError(403, "운영자만 볼 수 있습니다.");
  }
  if (!atLeast(role, min)) throw new HttpError(403, "권한이 부족합니다.");

  return {
    uid: token.uid,
    name: (data?.displayName as string | undefined) ?? token.name ?? token.email ?? "운영자",
    email: token.email ?? null,
    role,
  };
}

/** 구글이 연결된 사람의 역할. 운영자가 아니면 contributor다. */
export async function roleOf(uid: string): Promise<Role> {
  const data = (await db().collection("fc_members").doc(uid).get()).data();
  return data?.active === true && OPERATOR_ROLES.includes(data.role) ? (data.role as OperatorRole) : "contributor";
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
  /*
   * Firestore 복합 인덱스가 없거나 아직 만드는 중이다(gRPC 9 FAILED_PRECONDITION).
   * 배포 직후 몇 분 동안 생기는 일이라, 고장이 아니라 기다리면 된다고 알린다.
   * 인덱스는 firestore.indexes.json → `firebase deploy --only firestore:indexes`.
   */
  if ((error as { code?: number }).code === 9 && String((error as Error).message).includes("index")) {
    return Response.json(
      { error: "데이터 색인을 준비하는 중입니다. 몇 분 뒤 다시 열어 주세요." },
      { status: 503 },
    );
  }
  return Response.json({ error: "처리하지 못했습니다." }, { status: 500 });
}
