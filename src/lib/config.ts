import "server-only";

import { db } from "@/lib/firebase/admin";

/**
 * 운영 설정. fc_config/main 한 문서다.
 *
 * electionFreeze가 켜지면 판정은 계속 하되 댓글 초안을 만들지 않는다.
 * 선거 기간에 조직적 댓글로 읽힐 일을 앱이 먼저 멈춘다.
 */
export interface AppConfig {
  electionFreeze: boolean;
  /** 재판정 때 이보다 오래된 게시물에는 댓글 초안을 만들지 않는다. */
  staleDays: number;
}

const DEFAULTS: AppConfig = { electionFreeze: false, staleDays: 7 };

export async function getConfig(): Promise<AppConfig> {
  const snap = await db().collection("fc_config").doc("main").get();
  return { ...DEFAULTS, ...(snap.data() as Partial<AppConfig> | undefined) };
}
