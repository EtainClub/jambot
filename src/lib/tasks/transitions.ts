/**
 * 작업 상태 전이.
 *
 * 순수 함수다. Firestore 트랜잭션 안에서 읽은 문서와 요청을 받아 바뀔 필드나
 * 거절 사유를 돌려준다. 저장은 부르는 쪽이 한다 — 그래야 동시 수락 같은
 * 경합을 트랜잭션이 맡고, 규칙 자체는 저장소 없이 시험할 수 있다.
 *
 *   queued ──claim──▶ claimed ──posted──▶ posted
 *     ▲                 │ edit/extend
 *     └──release/expire─┘
 *   queued·needs_review·claimed ──skip──▶ skipped
 *   needs_review·skipped·no_action ──requeue(admin)──▶ queued
 *
 * waiting_for_content·no_content·no_action은 파이프라인이 정한다. 사람이
 * 손으로 옮기는 것은 requeue뿐이다.
 */

export const TASK_STATUSES = [
  "queued",
  "claimed",
  "posted",
  "skipped",
  "needs_review",
  "waiting_for_content",
  "no_action",
  "no_content",
  "processing",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ROLES = ["observer", "reviewer", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export function atLeast(role: Role, min: Role): boolean {
  return ROLES.indexOf(role) >= ROLES.indexOf(min);
}

export const CLAIM_MINUTES = 30;

export interface Actor {
  uid: string;
  name: string;
  role: Role;
}

export interface TaskState {
  status: TaskStatus;
  assignee: string | null;
  expiresAt: number | null;
  finalComment: string | null;
}

export type TaskAction =
  | { type: "claim" }
  | { type: "release" }
  | { type: "extend" }
  | { type: "edit"; comment: string }
  | { type: "posted"; postedUrl: string; comment: string }
  | { type: "skip"; reason: string }
  | { type: "requeue" };

export interface HistoryEntry {
  at: number;
  uid: string;
  name: string;
  action: TaskAction["type"] | "expire" | "pipeline";
  note?: string;
}

export type Transition =
  | { ok: true; patch: Partial<TaskState> & Record<string, unknown>; history: HistoryEntry }
  | { ok: false; error: string };

const fail = (error: string): Transition => ({ ok: false, error });

export function applyAction(task: TaskState, action: TaskAction, actor: Actor, now: number): Transition {
  const mine = task.status === "claimed" && task.assignee === actor.uid;
  const entry = (note?: string): HistoryEntry => ({
    at: now,
    uid: actor.uid,
    name: actor.name,
    action: action.type,
    ...(note ? { note } : {}),
  });

  switch (action.type) {
    case "claim":
      if (!atLeast(actor.role, "reviewer")) return fail("검토자 이상만 수락할 수 있습니다.");
      if (task.status === "claimed") return fail("다른 운영자가 이미 처리 중입니다.");
      if (task.status !== "queued") return fail("대기 중인 작업만 수락할 수 있습니다.");
      return {
        ok: true,
        patch: {
          status: "claimed",
          assignee: actor.uid,
          assigneeName: actor.name,
          claimedAt: now,
          expiresAt: now + CLAIM_MINUTES * 60_000,
        },
        history: entry(),
      };

    case "release":
      if (!mine && !(task.status === "claimed" && atLeast(actor.role, "admin"))) {
        return fail("담당자나 운영 관리자만 반납할 수 있습니다.");
      }
      return { ok: true, patch: unassigned("queued"), history: entry() };

    case "extend":
      if (!mine) return fail("담당자만 연장할 수 있습니다.");
      return { ok: true, patch: { expiresAt: now + CLAIM_MINUTES * 60_000 }, history: entry() };

    case "edit": {
      if (!mine) return fail("담당자만 댓글을 고칠 수 있습니다.");
      const comment = action.comment.trim();
      if (!comment) return fail("댓글이 비어 있습니다.");
      return { ok: true, patch: { finalComment: comment }, history: entry() };
    }

    case "posted": {
      if (!mine) return fail("담당자만 게시 완료로 바꿀 수 있습니다.");
      const comment = action.comment.trim();
      if (!comment) return fail("게시한 댓글 내용이 필요합니다.");
      if (!/^https?:\/\/(?:www\.|m\.)?instagram\.com\//.test(action.postedUrl.trim())) {
        return fail("게시한 댓글의 인스타그램 주소를 넣어 주세요.");
      }
      return {
        ok: true,
        patch: {
          status: "posted",
          finalComment: comment,
          postedUrl: action.postedUrl.trim(),
          postedAt: now,
          postedBy: actor.uid,
          postedByName: actor.name,
          expiresAt: null,
        },
        history: entry(action.postedUrl.trim()),
      };
    }

    case "skip": {
      const reason = action.reason.trim();
      if (!reason) return fail("건너뛰는 이유를 적어 주세요.");
      if (!atLeast(actor.role, "reviewer")) return fail("검토자 이상만 건너뛸 수 있습니다.");
      const open = task.status === "queued" || task.status === "needs_review" || mine;
      if (!open) return fail("이 상태에서는 건너뛸 수 없습니다.");
      return { ok: true, patch: { ...unassigned("skipped"), skipReason: reason }, history: entry(reason) };
    }

    case "requeue":
      if (!atLeast(actor.role, "admin")) return fail("운영 관리자만 다시 대기열에 넣을 수 있습니다.");
      if (!["needs_review", "skipped", "no_action"].includes(task.status)) {
        return fail("이 상태에서는 다시 대기열에 넣을 수 없습니다.");
      }
      return { ok: true, patch: unassigned("queued"), history: entry() };
  }
}

/** 방치된 수락을 돌려놓는다. 스케줄 작업이 부른다. */
export function expire(task: TaskState, now: number): Transition {
  if (task.status !== "claimed" || task.expiresAt === null || task.expiresAt > now) {
    return fail("만료 대상이 아닙니다.");
  }
  return {
    ok: true,
    patch: unassigned("queued"),
    history: { at: now, uid: "system", name: "시스템", action: "expire" },
  };
}

function unassigned(status: TaskStatus) {
  return { status, assignee: null, assigneeName: null, claimedAt: null, expiresAt: null };
}
