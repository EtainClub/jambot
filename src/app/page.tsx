"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Shell } from "@/components/Shell";
import { ErrorLine, formatTime, Heading, StatusTag, STATUS_LABEL, VerdictBadge } from "@/components/ui";
import type { Verdict } from "@/lib/check/types";
import { useAuth } from "@/lib/firebase/auth";

interface TaskRow {
  id: string;
  url: string;
  status: string;
  verdict: Verdict | null;
  reportCount: number;
  assigneeName: string | null;
  expiresAt: number | null;
  pipelineNote: string | null;
  draftComment: string | null;
  updatedAt: number;
}

/** 탭 순서가 곧 일의 순서다. 손이 가야 하는 것부터. */
const TABS = ["queued", "claimed", "needs_review", "waiting_for_content", "processing", "posted", "no_action", "no_content", "skipped"];

export default function QueuePage() {
  return (
    <Shell>
      <Queue />
    </Shell>
  );
}

function Queue() {
  const { api } = useAuth();
  const [tab, setTab] = useState("queued");
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = () =>
      api(`/api/tasks?status=${tab}`).then(async (res) => {
        const data = await res.json();
        if (!alive) return;
        setError(res.ok ? null : (data.error ?? "목록을 불러오지 못했습니다."));
        setTasks(res.ok ? data.tasks : []);
      });
    void run();
    // 실시간 구독 대신 30초마다 다시 읽는다. 브라우저가 Firestore를 직접 읽지 않기 때문이다.
    const timer = setInterval(() => void run(), 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [api, tab]);

  function choose(next: string) {
    if (next === tab) return;
    setTasks(null);
    setTab(next);
  }

  return (
    <>
      <Heading lede="잼통 근거와 대조한 게시물입니다. 작업을 수락하면 30분 동안 내 담당이 되고, 실제로 댓글을 단 뒤 게시 완료를 눌러야 기록됩니다.">
        무엇을 바로잡아야 하나
      </Heading>

      <div role="tablist" aria-label="작업 상태" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => choose(s)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${tab === s ? "bg-ink text-eggshell" : "border border-stone text-graphite hover:border-graphite"}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <ErrorLine message={error} />
      {tasks === null ? (
        <p className="text-[14px] text-smoke">불러오는 중…</p>
      ) : tasks.length === 0 ? (
        <p className="text-[14px] text-smoke">이 상태의 작업이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-stone border-y border-stone">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link href={`/tasks/${t.id}`} className="block py-4 hover:bg-taupe/60 sm:px-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusTag status={t.status} />
                  <VerdictBadge verdict={t.verdict} />
                  <span className="font-mono text-[12px] text-smoke">{t.id}</span>
                  {t.reportCount > 1 ? <span className="text-[12px] text-smoke">제보 {t.reportCount}건</span> : null}
                  <span className="ml-auto text-[12px] text-ash tabular">{formatTime(t.updatedAt)}</span>
                </div>
                {t.draftComment ? (
                  <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-graphite">{t.draftComment}</p>
                ) : t.pipelineNote ? (
                  <p className="mt-2 text-[13px] text-smoke">{t.pipelineNote}</p>
                ) : null}
                {t.assigneeName ? (
                  <p className="mt-1 text-[12px] text-smoke">
                    담당 {t.assigneeName}
                    {t.expiresAt ? ` · ${formatTime(t.expiresAt)}까지` : ""}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
