/**
 * 알림 규칙. 순수 함수다 — 작업 문서와 바뀔 상태를 받아 보낼 알림과 표시 필드를 돌려준다.
 *
 *   제보자  처리 결과가 정해졌을 때(게시·조치 없음·자료 대기·본문 없음·건너뜀)
 *   운영자  게시 대기 작업이 처음 생겼을 때
 *
 * ★ 같은 알림을 두 번 보내지 않는다.
 *   factbase-sync가 30분마다 자료 대기 작업을 다시 판정한다. 그때 상태는
 *   waiting → processing → waiting으로 돈다. 바로 앞 상태와 비교하면 매번 알림이
 *   간다. 그래서 마지막으로 알린 상태를 작업에 적어 두고(reporterNotified) 그것과 비교한다.
 *   운영자 알림은 작업마다 한 번(opsNotifiedAt)이다.
 */

export interface Notice {
  title: string;
  body: string;
  /** 앱 안의 경로. 알림을 누르면 연다. */
  link: string;
}

const REPORTER_BODY: Record<string, string> = {
  posted: "제보하신 게시물에 근거 안내 댓글이 달렸어요.",
  no_action: "확인해 보니 정정할 내용이 없었어요.",
  waiting_for_content: "잼통에 근거 자료가 아직 없어요. 자료가 등록되면 다시 확인할게요.",
  no_content: "게시물 본문을 확인하지 못했어요. 스크린샷과 함께 다시 제보해 주세요.",
  skipped: "운영자가 이 제보는 처리하지 않기로 했어요.",
};

export interface NotifyState {
  reporterNotified?: string | null;
  opsNotifiedAt?: number | null;
}

export interface NoticePlan {
  reporter: Notice | null;
  operators: Notice | null;
  patch: Record<string, unknown>;
}

export function planNotices(task: NotifyState | undefined, next: string, shortcode: string, now: number): NoticePlan {
  const plan: NoticePlan = { reporter: null, operators: null, patch: {} };
  const body = REPORTER_BODY[next];
  if (body && task?.reporterNotified !== next) {
    plan.reporter = { title: "제보 처리 결과", body, link: "/my" };
    plan.patch.reporterNotified = next;
  }
  if (next === "queued" && !task?.opsNotifiedAt) {
    plan.operators = { title: "새 게시 대기 작업", body: "근거 안내 댓글 초안이 준비됐어요. 수락해 게시해 주세요.", link: `/tasks/${shortcode}` };
    plan.patch.opsNotifiedAt = now;
  }
  return plan;
}

export function replyNotice(text: string): Notice {
  const body = text.length > 80 ? `${text.slice(0, 80)}…` : text;
  return { title: "운영자 답변이 왔어요", body, link: "/my" };
}
