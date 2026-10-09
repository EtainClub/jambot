"use client";

import { useCallback, useEffect, useState } from "react";

import { Shell } from "@/components/Shell";
import { Button, Card, ErrorLine, formatTime, Heading } from "@/components/ui";
import { useAuth } from "@/lib/firebase/auth";
import { atLeast } from "@/lib/tasks/transitions";

interface Gap {
  key: string;
  topic: string;
  count: number;
  status: string;
  examples: { postId: string; claim: string }[];
  issueUrl?: string;
  updatedAt: number;
}

const TABS = [
  { id: "open", label: "열림" },
  { id: "requested", label: "잼통에 요청함" },
  { id: "resolved", label: "해결됨" },
  { id: "dismissed", label: "보류" },
];

export default function GapsPage() {
  return (
    <Shell access="reviewer">
      <Gaps />
    </Shell>
  );
}

function Gaps() {
  const { api, member } = useAuth();
  const [tab, setTab] = useState("open");
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchGaps = useCallback(
    () => api(`/api/gaps?status=${tab}`).then(async (res) => ({ res, data: await res.json() })),
    [api, tab],
  );

  const apply = useCallback(({ res, data }: { res: Response; data: { gaps?: Gap[]; error?: string } }) => {
    setError(res.ok ? null : (data.error ?? "불러오지 못했습니다."));
    setGaps(res.ok ? (data.gaps ?? []) : []);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchGaps().then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
  }, [fetchGaps, apply]);

  const load = useCallback(async () => apply(await fetchGaps()), [fetchGaps, apply]);

  function choose(next: string) {
    if (next === tab) return;
    setGaps(null);
    setTab(next);
  }

  return (
    <>
      <Heading lede="잼통에 근거가 없어 판정하지 못한 주제입니다. 많이 걸린 것부터 잼통에 자료 등록을 요청하세요. 잼통이 배포되면 기다리던 게시물을 자동으로 다시 판정합니다.">
        잼통에 없는 것
      </Heading>
      <div role="tablist" aria-label="공백 상태" className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => choose(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${tab === t.id ? "bg-ink text-eggshell" : "border border-stone text-graphite hover:border-graphite"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ErrorLine message={error} />
      {gaps === null ? (
        <p className="text-[14px] text-smoke">불러오는 중…</p>
      ) : gaps.length === 0 ? (
        <p className="text-[14px] text-smoke">없습니다.</p>
      ) : (
        <div className="space-y-4">
          {gaps.map((g) => (
            <GapCard
              key={g.key}
              gap={g}
              others={gaps.filter((o) => o.key !== g.key)}
              canAct={atLeast(member?.role ?? "contributor", "moderator")}
              onChange={load}
            />
          ))}
        </div>
      )}
    </>
  );
}

function GapCard({
  gap,
  others,
  canAct,
  onChange,
}: {
  gap: Gap;
  /** 같은 탭의 다른 공백. 합칠 대상으로 고른다. */
  others: Gap[];
  canAct: boolean;
  onChange: () => Promise<void>;
}) {
  const { api } = useAuth();
  const [urls, setUrls] = useState("");
  const [note, setNote] = useState("");
  const [manual, setManual] = useState<{ title: string; body: string } | null>(null);
  const [issueUrl, setIssueUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/api/gaps/${gap.key}`, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "처리하지 못했습니다.");
      if (data.manual) setManual(data.manual);
      else await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[20px] font-light tracking-[-0.01em]">{gap.topic}</h2>
        <span className="font-mono text-[13px] text-graphite tabular">{gap.count}건</span>
        <span className="ml-auto text-[12px] text-ash tabular">{formatTime(gap.updatedAt)}</span>
      </div>
      <ul className="mt-3 space-y-1 text-[13px] text-graphite">
        {gap.examples.slice(-3).map((e) => (
          <li key={e.postId}>
            “{e.claim}”{" "}
            <a className="text-smoke underline" href={`/tasks/${e.postId}`}>
              {e.postId}
            </a>
          </li>
        ))}
      </ul>
      {gap.issueUrl ? (
        <p className="mt-3 text-[13px]">
          <a className="underline" href={gap.issueUrl} target="_blank" rel="noreferrer">
            잼통 이슈
          </a>
        </p>
      ) : null}

      {canAct && gap.status === "open" ? (
        <div className="mt-5 space-y-2 border-t border-stone pt-4">
          <textarea
            className="w-full rounded-[4px] border border-stone bg-eggshell p-2 text-[13px]"
            placeholder="공식 자료 주소 후보 (한 줄에 하나, 선택)"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            aria-label="공식 자료 주소"
          />
          <input
            className="w-full rounded-[4px] border border-stone bg-eggshell p-2 text-[13px]"
            placeholder="메모 (선택)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="메모"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              tone="primary"
              disabled={busy}
              onClick={() =>
                void post({
                  action: "request",
                  officialUrls: urls.split("\n").map((u) => u.trim()).filter(Boolean),
                  note,
                })
              }
            >
              잼통에 요청
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                const reason = prompt("보류 이유");
                if (reason) void post({ action: "dismiss", reason });
              }}
            >
              보류
            </Button>
          </div>
          {others.length ? (
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <select
                className="flex-1 rounded-full border border-stone bg-eggshell px-3 py-1.5 text-[13px]"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                aria-label="합칠 공백"
              >
                <option value="">같은 주제의 다른 공백에 합치기…</option>
                {others.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.topic} ({o.count}건)
                  </option>
                ))}
              </select>
              <Button
                disabled={busy || !mergeTarget}
                onClick={() => {
                  const target = others.find((o) => o.key === mergeTarget);
                  if (target && confirm(`'${gap.topic}'을(를) '${target.topic}'에 합칠까요?`)) {
                    void post({ action: "merge", into: mergeTarget });
                  }
                }}
              >
                합치기
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {manual ? (
        <div className="mt-4 rounded-[10px] bg-taupe p-3 text-[13px]">
          <p className="text-graphite">GITHUB_TOKEN이 없어 이슈를 직접 올려야 합니다. 아래 내용을 잼통 저장소 이슈로 올린 뒤 주소를 넣어 주세요.</p>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[12px]">{`${manual.title}\n\n${manual.body}`}</pre>
          <div className="mt-2 flex gap-2">
            <input
              className="flex-1 rounded-[4px] border border-stone bg-eggshell px-2 py-1.5"
              placeholder="https://github.com/…/issues/…"
              value={issueUrl}
              onChange={(e) => setIssueUrl(e.target.value)}
              aria-label="이슈 주소"
            />
            <Button disabled={busy || !issueUrl} onClick={() => void post({ action: "link", issueUrl })}>
              주소 저장
            </Button>
          </div>
        </div>
      ) : null}
      <ErrorLine message={error} />
    </Card>
  );
}
