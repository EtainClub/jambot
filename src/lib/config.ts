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
  /**
   * 운영자 한 명이 하루(한국 시간)에 게시할 수 있는 댓글 수. 수락할 때 센다.
   * 한 계정이 몰아서 다는 댓글은 스팸 신고와 계정 정지를 부른다.
   */
  dailyPostLimit: number;
}

const DEFAULTS: AppConfig = { electionFreeze: false, staleDays: 7, dailyPostLimit: 20 };

export async function getConfig(): Promise<AppConfig> {
  const snap = await db().collection("fc_config").doc("main").get();
  return { ...DEFAULTS, ...(snap.data() as Partial<AppConfig> | undefined) };
}
