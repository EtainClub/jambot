/**
 * 판정 실패의 종류. 순수 함수다.
 *
 * ★ 일시적인 실패는 사람에게 넘기지 않는다.
 *   크레딧 부족·사용량 초과·서버 오류·연결 끊김은 기다리면 풀린다. 이런 실패로
 *   작업을 "검토 필요"로 보내면 자동 재판정 대상에서 빠지고, 운영자가 하나씩
 *   다시 눌러야 한다(2026-10-10 크레딧 소진 때 실제로 그랬다). 그래서 원래 상태로
 *   되돌리고 다음 회차에 다시 시도한다. MAX_ATTEMPTS번 연속 실패하면 그때 사람에게 넘긴다.
 */

export const MAX_ATTEMPTS = 5;

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isTransient(error: unknown): boolean {
  const status = statusOf(error);
  const message = messageOf(error);
  if (/credit balance/i.test(message)) return true;
  if (status === 408 || status === 409 || status === 429 || status === 529) return true;
  if (status !== undefined && status >= 500) return true;
  // SDK의 연결 오류(APIConnectionError·APIConnectionTimeoutError)는 name이 "Error"이고 status가 없다.
  // 운영 빌드는 서버 코드를 압축해 클래스 이름도 바뀔 수 있으니 메시지로 본다.
  return /^Connection error\.|^Request timed out|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|overloaded/i.test(message);
}

/**
 * 운영자 화면에 남길 말. 오류 원문(API 응답 JSON 등)은 화면에 내지 않고
 * 서버 로그에만 남긴다.
 */
export function failureNote(error: unknown, willRetry = false): string {
  const status = statusOf(error);
  const message = messageOf(error);
  const reason = /credit balance/i.test(message)
    ? "모델 사용 크레딧 부족"
    : status === 429 || status === 529 || /overloaded|rate limit/i.test(message)
      ? "모델 사용량 초과·혼잡"
      : "일시적인 오류";
  return willRetry
    ? `판정하지 못했습니다(${reason}). 잠시 뒤 저절로 다시 시도합니다.`
    : `판정하지 못했습니다(${reason}). 잠시 뒤 재판정해 주세요.`;
}
