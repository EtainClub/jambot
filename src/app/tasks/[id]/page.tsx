"use client";

import { use, useCallback, useEffect, useState } from "react";

import { Shell } from "@/components/Shell";
import { Button, Card, ErrorLine, formatTime, StatusTag, VerdictBadge } from "@/components/ui";
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
    history: { at: number; name: string; action: string; note?: string }[];
  };
  post: { url: string; caption: string | null; contentText: string | null; claimHints: string[]; imageCount: number };
  checks: Check[];
  reports: { id: string; claim: string | null; memo: string | null; createdAt: number }[];
}

export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const { id } = use(params);
  return (
    <Shell>
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
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchDetail().then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
  }, [fetchDetail, apply]);

  const load = useCallback(async () => apply(await fetchDetail()), [fetchDetail, apply]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/api/tasks/${id}/action`, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "처리하지 못했습니다.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
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
  const role = member?.role ?? "observer";
  const canReview = atLeast(role, "reviewer");
  const isAdmin = atLeast(role, "admin");

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

      {/* 댓글 — 가장 먼저 해야 할 일이 맨 위에 온다 */}
      {(task.draftComment || task.finalComment) && task.status !== "no_action" ? (
        <Card>
          <h2 className="text-[13px] font-semibold text-smoke">댓글</h2>
          <textarea
            className="mt-3 min-h-40 w-full rounded-[4px] border border-stone bg-eggshell p-3 text-[15px] leading-relaxed disabled:bg-taupe"
            value={comment}
            disabled={!mine}
            onChange={(e) => setComment(e.target.value)}
            aria-label="댓글 내용"
          />
          <p className="mt-1 text-right text-[12px] text-ash tabular">{comment.length}자</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {task.status === "queued" && canReview ? (
              <Button tone="primary" disabled={busy} onClick={() => void act({ type: "claim" })}>
                작업 수락
              </Button>
            ) : null}
            {mine ? (
              <>
                <Button onClick={() => void copy()}>{copied ? "복사했습니다" : "댓글 복사"}</Button>
                <Button disabled={busy} onClick={() => void act({ type: "edit", comment })}>
                  저장
                </Button>
                <Button disabled={busy} onClick={() => void act({ type: "extend" })}>
                  30분 연장
                </Button>
                <Button disabled={busy} onClick={() => void act({ type: "release" })}>
                  반납
                </Button>
              </>
            ) : task.status === "claimed" && isAdmin ? (
              <Button disabled={busy} onClick={() => void act({ type: "release" })}>
                담당 해제
              </Button>
            ) : null}
          </div>

          {mine ? (
            <div className="mt-6 border-t border-stone pt-5">
              <p className="text-[13px] text-graphite">
                인스타그램에 실제로 댓글을 단 뒤, 그 댓글(또는 게시물) 주소를 넣고 게시 완료를 누르세요. 복사만으로는 기록되지
                않습니다.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="flex-1 rounded-[4px] border border-stone bg-eggshell px-3 py-2 text-[14px]"
                  placeholder="https://www.instagram.com/p/…"
                  value={postedUrl}
                  onChange={(e) => setPostedUrl(e.target.value)}
                  aria-label="게시한 댓글 주소"
                />
                <Button tone="primary" disabled={busy || !postedUrl} onClick={() => void act({ type: "posted", postedUrl, comment })}>
                  게시 완료
                </Button>
              </div>
            </div>
          ) : null}
          {task.postedUrl ? (
            <p className="mt-4 text-[13px] text-graphite">
              게시됨:{" "}
              <a className="underline" href={task.postedUrl} target="_blank" rel="noreferrer">
                {task.postedUrl}
              </a>
            </p>
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

function Judgment({ check }: { check: Check }) {
  const byAnchor = new Map(check.cited.map((c) => [c.anchor, c]));
  return (
    <Card>
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
