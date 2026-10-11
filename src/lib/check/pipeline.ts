import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { getConfig } from "@/lib/config";
import { planNotices } from "@/lib/notify/plan";
import { deliver } from "@/lib/notify/send";
import { loadFactbase } from "@/lib/factbase/load";
import { candidatesFor } from "@/lib/factbase/search";
import type { FactEntry } from "@/lib/factbase/types";
import { bucket, db } from "@/lib/firebase/admin";
import { syncGapsForPost } from "@/lib/gaps/store";
import { fetchCaption } from "@/lib/instagram/oembed";
import type { TaskStatus } from "@/lib/tasks/transitions";

import { composeComment } from "./comment";
import { failureNote, isTransient, MAX_ATTEMPTS } from "./failure";
import { CHECK_MODEL, extract, judge, ModelRefusal, type PostImage } from "./model";
import { COMMENTABLE, headlineVerdict, type Judgment } from "./types";
import { validateJudgment } from "./validate";

/**
 * 게시물 하나를 판정한다.
 *
 * 순서: 본문 확보 → 읽기(모델) → 후보 검색 → 판정(모델) → 서버 검사 →
 * 댓글 조립 → 저장. 어느 단계에서 멈추든 작업 상태가 그 이유를 말한다.
 *
 *   no_content           읽을 것이 없다. 판정하지 않는다
 *   no_action            정책 주장이 없거나, 전부 사실·의견이다
 *   waiting_for_content  잼통에 근거가 없다. 공백으로 쌓고 잼통 갱신을 기다린다
 *   needs_review         모델 실패, 거절, 검사 탈락, 근거 불충분 — 사람이 본다
 *   queued               댓글 초안이 있다
 *
 * 이미 사람이 잡은 작업(claimed·posted·skipped)은 상태를 건드리지 않는다.
 * 재판정 결과는 판정 기록으로만 남는다.
 */

const MAX_IMAGES = 4;
const PIPELINE_OWNED: ReadonlySet<TaskStatus> = new Set([
  "processing",
  "queued",
  "needs_review",
  "waiting_for_content",
  "no_action",
  "no_content",
]);

/** 판정 하나가 길어야 1~2분이다. 이보다 오래 processing이면 멈춘 것으로 본다. */
const STUCK_MS = 15 * 60_000;

const posts = () => db().collection("fc_posts");
const tasks = () => db().collection("fc_tasks");

function mediaTypeOf(path: string): PostImage["mediaType"] {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function loadImages(paths: string[]): Promise<PostImage[]> {
  return Promise.all(
    paths.slice(0, MAX_IMAGES).map(async (path) => {
      const [buf] = await bucket().file(path).download();
      return { mediaType: mediaTypeOf(path), base64: buf.toString("base64") };
    }),
  );
}

interface Outcome {
  status: TaskStatus;
  note: string;
  check?: Record<string, unknown>;
  /**
   * 연속 시도 횟수. 판정을 시작할 때 하나 올리고, 판정이 끝나면(성공이든 사람에게 넘기든) 0으로 돌린다.
   * 시작할 때 세므로 인스턴스가 내려가 실패 처리조차 못 한 경우도 들어간다.
   */
  attempts?: number;
}

async function settle(shortcode: string, outcome: Outcome): Promise<void> {
  const now = Date.now();
  const taskRef = tasks().doc(shortcode);
  let checkId: string | null = null;
  if (outcome.check) {
    const ref = await db().collection("fc_checks").add({ postId: shortcode, createdAt: now, ...outcome.check });
    checkId = ref.id;
  }

  const plan = await db().runTransaction(async (tx) => {
    const snap = await tx.get(taskRef);
    const current = snap.data()?.status as TaskStatus | undefined;
    const owned = !current || PIPELINE_OWNED.has(current);
    const check = outcome.check ?? {};
    const notices = owned ? planNotices(snap.data(), outcome.status, shortcode, now) : null;
    tx.set(
      taskRef,
      {
        ...(owned ? { status: outcome.status } : {}),
        ...(notices?.patch ?? {}),
        ...(checkId
          ? {
              latestCheckId: checkId,
              verdict: check.verdict ?? null,
              draftComment: check.comment ?? null,
              factbaseVersion: check.factbaseVersion ?? null,
              // 사람이 아직 손대지 않았으면 초안을 그대로 편집본으로 둔다.
              ...(owned ? { finalComment: check.comment ?? null } : {}),
            }
          : {}),
        pipelineNote: outcome.note,
        checkAttempts: outcome.attempts ?? 0,
        updatedAt: now,
        history: FieldValue.arrayUnion({ at: now, uid: "system", name: "판정", action: "pipeline", note: outcome.note }),
      },
      { merge: true },
    );
    return notices;
  });
  if (plan) await deliver(shortcode, plan);
}

/** blocked: 선거 기간이나 오래된 게시물이라 일부러 댓글을 만들지 않은 경우. */
function statusFor(judgment: Judgment, comment: string | null, blocked: boolean): Outcome["status"] {
  const verdicts = judgment.claims.map((c) => c.verdict);
  if (verdicts.some((v) => COMMENTABLE.has(v))) {
    if (comment) return "queued";
    return blocked ? "no_action" : "needs_review";
  }
  if (verdicts.includes("insufficient")) return "needs_review";
  if (verdicts.includes("out_of_scope")) return "waiting_for_content";
  return "no_action";
}

export async function runCheck(shortcode: string): Promise<void> {
  const before = (await tasks().doc(shortcode).get()).data();
  const attempts = ((before?.checkAttempts as number | undefined) ?? 0) + 1;
  try {
    await settle(shortcode, { status: "processing", note: "판정 중", attempts });
    const post = (await posts().doc(shortcode).get()).data();
    if (!post) throw new Error(`게시물이 없습니다: ${shortcode}`);

    const caption: string | null = post.caption ?? (await fetchCaption(post.url));
    if (caption && !post.caption) await posts().doc(shortcode).update({ caption });
    const hints: string[] = post.claimHints ?? [];
    const imagePaths: string[] = post.imagePaths ?? [];

    if (!caption && imagePaths.length === 0) {
      // 제보자가 적은 주장만으로는 판정하지 않는다. 게시물에 정말 그렇게 쓰였는지 모른다.
      await settle(shortcode, { status: "no_content", note: "캡션과 스크린샷이 없어 게시물 본문을 확보하지 못했습니다." });
      return;
    }

    const extraction = await extract({ caption, hints, images: await loadImages(imagePaths) });
    if (!extraction.readable && !caption) {
      await settle(shortcode, { status: "no_content", note: "스크린샷에서 글을 읽지 못했습니다." });
      return;
    }
    await posts().doc(shortcode).update({ contentText: extraction.contentText, updatedAt: Date.now() });
    if (extraction.claims.length === 0) {
      await settle(shortcode, { status: "no_action", note: "정책에 관한 사실 주장이 없습니다." });
      return;
    }

    const { factbase, index } = await loadFactbase();
    const candidates = candidatesFor(index, extraction.claims);
    const byAnchor = new Map<string, FactEntry>(candidates.map((c) => [c.anchor, c]));

    let judgment = await judge({ contentText: extraction.contentText, claims: extraction.claims, candidates });
    let errors = validateJudgment(judgment, byAnchor);
    if (errors.length) {
      judgment = await judge({
        contentText: extraction.contentText,
        claims: extraction.claims,
        candidates,
        retryErrors: errors,
      });
      errors = validateJudgment(judgment, byAnchor);
    }

    const config = await getConfig();
    const stale = Date.now() - (post.createdAt ?? Date.now()) > config.staleDays * 86_400_000;
    const comment =
      errors.length || config.electionFreeze || stale ? null : composeComment(judgment, byAnchor);
    const verdict = headlineVerdict(judgment.claims.map((c) => c.verdict));

    const check = {
      verdict,
      claims: judgment.claims,
      commentBody: judgment.commentBody,
      comment,
      validationErrors: errors,
      // 판정 화면에서 근거를 펴 보려면 인용한 항목을 함께 남긴다. factbase가 바뀌어도 이 판정의 근거는 그대로다.
      cited: judgment.claims.flatMap((c) => c.anchors).filter((a, i, all) => all.indexOf(a) === i).map((a) => byAnchor.get(a)).filter(Boolean),
      candidateCount: candidates.length,
      factbaseVersion: factbase.version,
      model: CHECK_MODEL,
    };

    if (errors.length) {
      await settle(shortcode, { status: "needs_review", note: `서버 검사를 통과하지 못했습니다: ${errors.join(" / ")}`, check });
      return;
    }

    // 재판정이면 근거를 찾은 주장은 공백에서 빠지고, 비면 공백이 닫힌다.
    await syncGapsForPost(shortcode, judgment);
    const status = statusFor(judgment, comment, config.electionFreeze || stale);
    const note = config.electionFreeze
      ? "선거 기간 차단으로 댓글 초안을 만들지 않았습니다."
      : stale && judgment.claims.some((c) => COMMENTABLE.has(c.verdict))
        ? `게시물이 ${config.staleDays}일보다 오래돼 댓글 초안을 만들지 않았습니다.`
        : "판정 완료";
    await settle(shortcode, { status, note, check });
  } catch (error) {
    console.error(`[pipeline] ${shortcode}`, error);
    if (error instanceof ModelRefusal) {
      await settle(shortcode, { status: "needs_review", note: error.message });
      return;
    }
    if (!isTransient(error) || attempts >= MAX_ATTEMPTS) {
      await settle(shortcode, { status: "needs_review", note: failureNote(error) });
      return;
    }
    await settle(shortcode, { status: retryStatus(before?.status), note: failureNote(error, true), attempts });
  }
}

/**
 * 일시적인 실패 뒤 돌아갈 상태.
 *
 *   자료 대기·게시 대기 등 판정이 끝나 있던 작업 → 그 상태 그대로. 초안도 그대로 남는다.
 *     자료 대기는 factbase-sync가 버전이 다른 것을 보고 다시 판정한다.
 *   처음 판정이던 작업(processing) → processing. 멈춘 판정 복구(recoverStuck)가 다시 돌린다.
 */
function retryStatus(previous: unknown): TaskStatus {
  const status = previous as TaskStatus | undefined;
  return status && status !== "processing" && PIPELINE_OWNED.has(status) ? status : "processing";
}

/**
 * 판정 중(processing)에 멈춘 작업을 다시 판정한다.
 *
 * 제보 판정은 응답을 보낸 뒤 after()로 돈다. 그 사이 인스턴스가 내려가거나
 * 일시적인 실패로 processing에 남은 작업은 아무도 다시 부르지 않는다.
 * expire-claims(5분마다, 마감 60초)가 부른다. 판정 하나가 10~20초라 budgetMs 안에서
 * 시작할 수 있는 만큼만 돌리고 나머지는 다음 회차로 넘긴다.
 */
export async function recoverStuck(now = Date.now(), budgetMs = 25_000): Promise<{ stuck: number; rechecked: number }> {
  const snap = await tasks().where("status", "==", "processing").get();
  const stuck = snap.docs
    .filter((d) => ((d.data().updatedAt as number | undefined) ?? 0) < now - STUCK_MS)
    .sort((a, b) => (a.data().updatedAt ?? 0) - (b.data().updatedAt ?? 0));
  let rechecked = 0;
  for (const doc of stuck) {
    if (Date.now() - now > budgetMs) break;
    if (((doc.data().checkAttempts as number | undefined) ?? 0) >= MAX_ATTEMPTS) {
      await settle(doc.id, { status: "needs_review", note: "여러 번 판정하지 못했습니다. 재판정해 주세요." });
      continue;
    }
    await runCheck(doc.id);
    rechecked++;
  }
  return { stuck: stuck.length, rechecked };
}

