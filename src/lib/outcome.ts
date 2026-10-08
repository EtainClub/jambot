import type { Verdict } from "@/lib/check/types";

/**
 * 제보자에게 보이는 처리 결과.
 *
 * ★ 사람이 확인하기 전의 판정은 내보내지 않는다.
 *   모델 판정은 운영자가 검토하기 전까지 초안이다. 게시 대기·처리 중·검토 필요
 *   상태에서 판정을 보여 주면, 아직 아무도 확인하지 않은 "사실과 다름"이 제보자
 *   화면에 결론처럼 뜬다. 그래서 단계만 알리고, 끝난 뒤에 결과를 연다.
 *
 * 운영자 이름도 내보내지 않는다. 게시된 댓글은 인스타그램에 이미 공개된 글이라
 * 그 내용과 주소만 보여 준다.
 */

export type Stage = "checking" | "reviewing" | "waiting" | "done";

export interface Outcome {
  stage: Stage;
  label: string;
  verdict: Verdict | null;
  comment: string | null;
  postedUrl: string | null;
  reply: string | null;
  replyAt: number | null;
}

const LABEL: Record<string, [Stage, string]> = {
  processing: ["checking", "근거와 대조하는 중"],
  queued: ["reviewing", "운영자 확인 중"],
  claimed: ["reviewing", "운영자 확인 중"],
  needs_review: ["reviewing", "운영자 확인 중"],
  waiting_for_content: ["waiting", "잼통 자료 등록 대기"],
  posted: ["done", "근거 안내 댓글 게시"],
  no_action: ["done", "정정할 내용 없음"],
  no_content: ["done", "게시물 본문을 확인하지 못함"],
  skipped: ["done", "처리하지 않음"],
};

export function outcomeOf(task: FirebaseFirestore.DocumentData | undefined): Outcome {
  const status = (task?.status as string | undefined) ?? "processing";
  const [stage, label] = LABEL[status] ?? ["reviewing", "운영자 확인 중"];
  const reviewed = stage === "done" || stage === "waiting";
  return {
    stage,
    label,
    verdict: reviewed ? ((task?.verdict as Verdict | null) ?? null) : null,
    comment: status === "posted" ? (task?.finalComment ?? null) : null,
    postedUrl: status === "posted" ? (task?.postedUrl ?? null) : null,
    reply: task?.reporterReply ?? null,
    replyAt: task?.reporterReplyAt ?? null,
  };
}
