"use client";

import { use, useCallback, useEffect, useState } from "react";

import { Shell } from "@/components/Shell";
import { Button, Card, ErrorLine, formatTime, STATUS_LABEL, StatusTag, Stepper, VerdictBadge } from "@/components/ui";
import { VERDICT_LABEL, type ClaimJudgment, type Verdict } from "@/lib/check/types";
import type { FactEntry } from "@/lib/factbase/types";
import { useAuth } from "@/lib/firebase/auth";
import { atLeast } from "@/lib/tasks/transitions";

interface Check {
  id: string;
  verdict: Verdict | null;
  claims: ClaimJudgment[];
  comment: string | null;
  cited: FactEntry[];
  validationErrors: string[];
  factbaseVersion: string;
  model: string;
  createdAt: number;
}

interface Detail {
  task: {
    id: string;
    url: string;
    status: string;
    verdict: Verdict | null;
    assignee: string | null;
    assigneeName: string | null;
    expiresAt: number | null;
    draftComment: string | null;
    finalComment: string | null;
    postedUrl?: string;
    skipReason?: string;
    pipelineNote?: string;
    reporterReply?: string;
    reporterReplyAt?: number;
    history: { at: number; name: string; action: string; note?: string }[];
  };
  post: { url: string; caption: string | null; contentText: string | null; claimHints: string[]; imageCount: number };
  checks: Check[];
  reports: { id: string; claim: string | null; memo: string | null; createdAt: number }[];
}

export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const { id } = use(params);
  return (
    <Shell access="reviewer" share>
      <Task id={id} />
    </Shell>
  );
}

function Task({ id }: { id: string }) {
  const { api, member } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [postedUrl, setPostedUrl] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  /** 맡은 작업 안에서의 단계(1 다듬기, 2 게시, 3 기록). 서버 상태가 아니라 화면 안내용이다. */
  const [workStep, setWorkStep] = useState(1);

  const fetchDetail = useCallback(
    () => api(`/api/tasks/${id}`).then(async (res) => ({ res, data: await res.json() })),
    [api, id],
  );

  const apply = useCallback(({ res, data }: { res: Response; data: Detail & { error?: string } }) => {
    if (!res.ok) {
      setError(data.error ?? "불러오지 못했습니다.");
      return;
    }
    setDetail(data);
    setComment(data.task.finalComment ?? data.task.draftComment ?? "");
    setReply(data.task.reporterReply ?? "");
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchDetail().then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
  }, [fetchDetail, apply]);

  const load = useCallback(async () => apply(await fetchDetail()), [fetchDetail, apply]);

  async function act(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/api/tasks/${id}/action`, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "처리하지 못했습니다.");
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function rerun() {
    setBusy(true);
    const res = await api(`/api/checks/${id}/rerun`, { method: "POST" });
    setBusy(false);
    if (!res.ok) setError((await res.json()).error ?? "재판정을 요청하지 못했습니다.");
    else setError("재판정을 시작했습니다. 잠시 후 새로고침해 주세요.");
  }

  async function copy() {
    await navigator.clipboard.writeText(comment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!detail) return error ? <ErrorLine message={error} /> : <p className="text-[14px] text-smoke">불러오는 중…</p>;

  const { task, post, checks } = detail;
  const latest = checks[0];
  const mine = task.status === "claimed" && task.assignee === member?.uid;
  const role = member?.role ?? "contributor";
  const canReview = atLeast(role, "reviewer");
  const isAdmin = atLeast(role, "moderator");

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag status={task.status} />
          <VerdictBadge verdict={task.verdict} />
          {task.assigneeName ? (
            <span className="text-[12px] text-smoke">
              담당 {task.assigneeName}
              {task.expiresAt ? ` · ${formatTime(task.expiresAt)}까지` : ""}
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-[28px] font-light tracking-[-0.02em]">
          <a href={post.url} target="_blank" rel="noreferrer" className="underline decoration-stone underline-offset-4 hover:decoration-ink">
            게시물 {id}
          </a>
        </h1>
        {task.pipelineNote ? <p className="mt-2 text-[13px] text-smoke">{task.pipelineNote}</p> : null}
      </header>

      <ErrorLine message={error} />

      {/* 댓글 게시 — 가장 먼저 해야 할 일이 맨 위에 온다. 단계마다 할 일 하나와 버튼 하나 */}
      {(task.draftComment || task.finalComment) && task.status !== "no_action" ? (
        <Card>
          <Stepper
            steps={WORK_STEPS}
            current={task.status === "posted" ? WORK_STEPS.length : mine ? workStep : 0}
            onSelect={mine ? (i) => i > 0 && setWorkStep(i) : undefined}
            label="작업 단계"
          />
          <div className="mt-6 border-t border-stone pt-6">
            {task.status === "posted" ? (
              <div className="step-detail">
                <h2 className="text-[18px] font-semibold text-navy">✓ 게시를 마친 작업입니다</h2>
                <p className="mt-3 whitespace-pre-wrap rounded-[10px] bg-taupe p-4 text-[14px] leading-relaxed text-graphite">{comment}</p>
                {task.postedUrl ? (
                  <a className="mt-3 inline-block text-[13px] underline" href={task.postedUrl} target="_blank" rel="noreferrer">
                    인스타그램에서 게시한 댓글 보기
                  </a>
                ) : null}
              </div>
            ) : !mine ? (
              <div className="step-detail">
                <h2 className="text-[18px] font-semibold">
                  {task.status === "claimed"
                    ? `${task.assigneeName ?? "다른 운영자"}님이 처리 중입니다`
                    : task.status === "queued"
                      ? "이 작업을 맡아 주세요"
                      : `지금은 수락할 수 없는 작업입니다 (${STATUS_LABEL[task.status] ?? task.status})`}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-smoke">
                  {task.status === "claimed"
                    ? `${task.expiresAt ? `${formatTime(task.expiresAt)}까지 ` : ""}담당자가 있습니다. 시간이 지나면 다시 대기열로 돌아옵니다.`
                    : task.status === "queued"
                      ? "수락하면 30분 동안 내 작업이 됩니다. 아래 댓글 초안과 판정 근거를 읽어 보고 맡을지 정하세요."
                      : "운영 관리자가 아래 '다른 처리'에서 대기열로 되돌리면 맡을 수 있습니다."}
                </p>
                <p className="mt-4 whitespace-pre-wrap rounded-[10px] bg-taupe p-4 text-[14px] leading-relaxed text-graphite">{comment}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {task.status === "queued" && canReview ? (
                    <Button tone="primary" disabled={busy} onClick={() => void act({ type: "claim" }).then((ok) => ok && setWorkStep(1))}>
                      작업 수락
                    </Button>
                  ) : null}
                  {task.status === "claimed" && isAdmin ? (
                    <Button disabled={busy} onClick={() => void act({ type: "release" })}>
                      담당 해제
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : workStep === 1 ? (
              <div className="step-detail">
                <h2 className="text-[18px] font-semibold">댓글을 읽고 다듬으세요</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-smoke">
                  아래 <a href="#judgment" className="underline">판정과 근거</a>를 확인하고, 틀린 말이나 어색한 문장이 있으면 고치세요. 고칠 게 없으면 그대로 다음으로.
                </p>
                <textarea
                  className="mt-4 min-h-48 w-full rounded-[4px] border border-stone bg-eggshell p-3 text-[15px] leading-relaxed"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  aria-label="댓글 내용"
                />
                <p className="mt-1 text-right text-[12px] text-ash tabular">{comment.length}자</p>
                <div className="mt-4 flex justify-end">
                  <Button
                    tone="primary"
                    disabled={busy || !comment.trim()}
                    onClick={() =>
                      void (comment === task.finalComment ? Promise.resolve(true) : act({ type: "edit", comment })).then(
                        (ok) => ok && setWorkStep(2),
                      )
                    }
                  >
                    {comment === task.finalComment ? "다음 →" : "저장하고 다음 →"}
                  </Button>
                </div>
              </div>
            ) : workStep === 2 ? (
              <div className="step-detail">
                <h2 className="text-[18px] font-semibold">인스타그램에 댓글을 다세요</h2>
                <ol className="mt-4 space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 font-mono text-[12px] text-ash">1</span>
                    <div className="flex-1">
                      <Button tone="primary" onClick={() => void copy()}>
                        {copied ? "✓ 복사했습니다" : "댓글 복사"}
                      </Button>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 font-mono text-[12px] text-ash">2</span>
                    <div className="flex-1">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ui-button inline-block rounded-full border border-stone px-4 py-2 text-[13px] font-semibold text-graphite hover:border-graphite"
                      >
                        인스타그램 게시물 열기 ↗
                      </a>
                      <p className="mt-2 text-[13px] text-smoke">게시물 댓글 칸에 붙여넣고 게시하세요.</p>
                    </div>
                  </li>
                </ol>
                <p className="mt-4 whitespace-pre-wrap rounded-[10px] bg-taupe p-4 text-[13px] leading-relaxed text-graphite">{comment}</p>
                <div className="mt-5 flex items-center gap-2">
                  <Button onClick={() => setWorkStep(1)}>← 이전</Button>
                  <Button tone="primary" className="ml-auto" onClick={() => setWorkStep(3)}>
                    댓글을 달았어요 →
                  </Button>
                </div>
              </div>
            ) : (
              <div className="step-detail">
                <h2 className="text-[18px] font-semibold">게시한 주소를 남기세요</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-smoke">
                  인스타그램에서 내 댓글(또는 게시물)의 링크를 복사해 붙여넣으세요. 이 단계를 마쳐야 게시가 기록됩니다.
                </p>
                <input
                  className="mt-4 w-full rounded-[4px] border border-stone bg-eggshell px-3 py-2.5 text-[14px]"
                  placeholder="https://www.instagram.com/p/…"
                  inputMode="url"
                  value={postedUrl}
                  onChange={(e) => setPostedUrl(e.target.value)}
                  aria-label="게시한 댓글 주소"
                />
                <div className="mt-5 flex items-center gap-2">
                  <Button onClick={() => setWorkStep(2)}>← 이전</Button>
                  <Button tone="primary" className="ml-auto" disabled={busy || !postedUrl.trim()} onClick={() => void act({ type: "posted", postedUrl, comment })}>
                    게시 완료
                  </Button>
                </div>
              </div>
            )}
          </div>

          {mine ? (
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-stone pt-4 text-[12px] text-smoke">
              <span>{task.expiresAt ? `${formatTime(task.expiresAt)}까지 내 작업` : "내 작업"}</span>
              <Button className="ml-auto" disabled={busy} onClick={() => void act({ type: "extend" })}>
                30분 연장
              </Button>
              <Button disabled={busy} onClick={() => void act({ type: "release" })}>
                반납
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {latest ? <Judgment check={latest} /> : null}

      <Card>
        <h2 className="text-[13px] font-semibold text-smoke">게시물에서 읽은 글</h2>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-graphite">
          {post.contentText ?? post.caption ?? "아직 읽은 글이 없습니다."}
        </p>
        {post.imageCount > 0 ? <Screenshots id={id} count={post.imageCount} /> : null}
        {detail.reports.length ? (
          <div className="mt-6 border-t border-stone pt-4">
            <h3 className="text-[12px] font-semibold text-smoke">제보 {detail.reports.length}건</h3>
            <ul className="mt-2 space-y-1 text-[13px] text-graphite">
              {detail.reports.map((r) => (
                <li key={r.id}>
                  <span className="text-ash tabular">{formatTime(r.createdAt)}</span> {r.claim ?? ""} {r.memo ? `— ${r.memo}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {detail.reports.length ? (
        <Card>
          <h2 className="text-[13px] font-semibold text-smoke">제보자에게 답변</h2>
          <p className="mt-2 text-[13px] text-graphite">
            제보한 사람 모두의 내 기록에 보입니다. 운영자 이름은 보이지 않습니다. 판정 초안이나 다른 제보자 정보는 쓰지 마세요.
          </p>
          {task.reporterReply ? (
            <p className="mt-2 text-[12px] text-ash tabular">마지막 답변 {formatTime(task.reporterReplyAt)}</p>
          ) : null}
          <textarea
            className="mt-3 min-h-24 w-full rounded-[4px] border border-stone bg-eggshell p-3 text-[14px] disabled:bg-taupe"
            maxLength={1000}
            value={reply}
            disabled={!canReview}
            onChange={(e) => setReply(e.target.value)}
            aria-label="제보자에게 답변"
          />
          {canReview ? (
            <div className="mt-2">
              <Button disabled={busy || !reply.trim() || reply === task.reporterReply} onClick={() => void act({ type: "reply", text: reply })}>
                답변 저장
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {canReview || isAdmin ? (
        <Card>
          <h2 className="text-[13px] font-semibold text-smoke">다른 처리</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-[4px] border border-stone bg-eggshell px-3 py-2 text-[14px]"
              placeholder="건너뛰는 이유 (예: 이미 정정됨, 중복)"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              aria-label="건너뛰는 이유"
            />
            <Button disabled={busy || !skipReason} onClick={() => void act({ type: "skip", reason: skipReason })}>
              건너뛰기
            </Button>
          </div>
          {isAdmin ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void act({ type: "requeue" })}>
                대기열로 되돌리기
              </Button>
              <Button disabled={busy} onClick={() => void rerun()}>
                다시 판정
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <section>
        <h2 className="text-[13px] font-semibold text-smoke">기록</h2>
        <ul className="mt-3 space-y-1 text-[13px] text-graphite">
          {[...task.history].reverse().map((h, i) => (
            <li key={i}>
              <span className="text-ash tabular">{formatTime(h.at)}</span> {h.name} · {h.action}
              {h.note ? ` — ${h.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const WORK_STEPS = ["작업 수락", "댓글 다듬기", "인스타그램 게시", "게시 기록"];

function Judgment({ check }: { check: Check }) {
  const byAnchor = new Map(check.cited.map((c) => [c.anchor, c]));
  return (
    <Card className="scroll-mt-24">
      <span id="judgment" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-smoke">판정</h2>
        <span className="font-mono text-[11px] text-ash">
          잼통 v{check.factbaseVersion} · {check.model} · {formatTime(check.createdAt)}
        </span>
      </div>
      {check.validationErrors.length ? (
        <div className="mt-3 rounded-[10px] bg-pending-tint p-3 text-[13px] text-pending">
          서버 검사를 통과하지 못한 판정입니다. 근거를 직접 확인해 주세요.
          <ul className="mt-1 list-disc pl-5">
            {check.validationErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ol className="mt-4 space-y-6">
        {check.claims.map((c, i) => (
          <li key={i}>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={c.verdict} />
              {c.gapTopic ? <span className="text-[12px] text-smoke">공백 주제: {c.gapTopic}</span> : null}
            </div>
            <p className="mt-2 text-[15px]">“{c.claim}”</p>
            <p className="mt-1 text-[13px] leading-relaxed text-graphite">{c.reasoning}</p>
            {c.anchors.length ? (
              <ul className="mt-3 space-y-2">
                {c.anchors.map((a) => {
                  const e = byAnchor.get(a);
                  return (
                    <li key={a} className="rounded-[10px] border border-stone p-3 text-[13px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`https://jamtong.kr${e?.path ?? "/"}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-stone px-2.5 py-0.5 font-mono text-[11px] text-graphite hover:border-graphite"
                        >
                          {a}
                        </a>
                        {e?.assertionType && e.assertionType !== "FACT" ? (
                          <span className="text-[11px] font-semibold text-pending">
                            {e.assertionType}
                            {e.assertedBy ? ` · ${e.assertedBy}의 주장` : ""}
                          </span>
                        ) : null}
                        {e?.status && e.status !== "done" ? (
                          <span className="text-[11px] text-smoke">{e.status === "planned" ? "계획" : "추진 중"}</span>
                        ) : null}
                        {e?.date ? <span className="text-[11px] text-ash tabular">{e.date}</span> : null}
                      </div>
                      {e ? <p className="mt-2 leading-relaxed text-graphite">{e.text}</p> : null}
                      {e?.sources.length ? (
                        <p className="mt-1 text-[12px] text-smoke">
                          출처:{" "}
                          {e.sources.map((s, j) => (
                            <span key={s.id}>
                              {j ? ", " : ""}
                              {s.url ? (
                                <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                                  {s.publisher}
                                </a>
                              ) : (
                                s.publisher
                              )}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[12px] text-ash">
        판정 종류: {Object.values(VERDICT_LABEL).join(" · ")}. 잼통에 근거가 없는 주장은 판정하지 않고 자료 공백으로 보냅니다.
      </p>
    </Card>
  );
}

/** 스크린샷은 운영자 토큰으로 받아 blob으로 띄운다. img 태그는 Authorization 헤더를 못 보낸다. */
function Screenshots({ id, count }: { id: string; count: number }) {
  const { api } = useAuth();
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    void (async () => {
      for (let n = 0; n < count; n++) {
        const res = await api(`/api/posts/${id}/images/${n}`);
        if (!res.ok) continue;
        const url = URL.createObjectURL(await res.blob());
        made.push(url);
        if (alive) setUrls([...made]);
      }
    })();
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [api, id, count]);
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto">
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL이라 next/image가 다룰 수 없다
        <img key={u} src={u} alt={`제보 스크린샷 ${i + 1}`} className="h-48 rounded-[10px] border border-stone object-contain" />
      ))}
    </div>
  );
}
