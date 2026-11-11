"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Shell } from "@/components/Shell";
import { HowItWorks, ReportFAQ } from "@/components/HowItWorks";
import { Button, Card, Fold, formatTime, LoadingCards, VerdictBadge } from "@/components/ui";
import { PRIORITY, type Verdict } from "@/lib/check/types";

interface Stats {
  reports: number;
  checked: number;
  posted: number;
  waiting: number;
}

interface Posted {
  id: string;
  url: string;
  verdict: Verdict | null;
  comment: string | null;
  /** 댓글이 바로잡은 게시물 속 주장. 예전 기록에는 없을 수 있다 */
  claims?: string[];
  postedUrl: string | null;
  postedAt: number | null;
}

/**
 * 첫 화면. 누구나 본다.
 *
 * 실제로 게시한 근거 안내 댓글만 보여 준다. 게시 전의 판정과 초안은 운영자가
 * 확인하기 전이라 내보내지 않는다(공개 API가 애초에 주지 않는다).
 */
export default function HomePage() {
  const [posted, setPosted] = useState<Posted[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetch("/api/public/posted")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { posted: Posted[]; stats?: Stats };
        if (alive && body.stats) setStats(body.stats);
        return body.posted;
      })
      .then((rows) => alive && setPosted(rows))
      .catch(() => alive && (setFailed(true), setPosted([])));
    return () => {
      alive = false;
    };
  }, [retry]);

  return (
    <Shell>
      <div className="mb-12 grid items-center gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
        <div>
          <p className="mb-4 text-[12px] font-semibold tracking-wide text-smoke">함께 확인하고, 근거로 전합니다</p>
          <h1 className="text-[40px] font-light leading-[1.2] tracking-[-0.04em] sm:text-[48px]">
            의심스러운 주장에<br /><span className="font-semibold">근거로 답합니다</span>
          </h1>
          <p className="mt-5 max-w-[34em] text-[15px] leading-relaxed text-graphite">
            인스타그램에 도는 정부 정책 주장을 <a className="underline underline-offset-4" href="https://jamtong.kr">잼통</a>의 근거 자료와
            대조합니다. 운영자가 확인한 뒤, 출처를 붙인 팩트 체크 댓글을 직접 답니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/report" className="ui-button rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-eggshell hover:opacity-85">
              게시물 제보하기 <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/my" className="ui-button rounded-full border border-stone px-5 py-3 text-[14px] font-semibold text-graphite hover:border-graphite">내 기록</Link>
            <Link href="/guide" className="ui-button rounded-full border border-stone px-5 py-3 text-[14px] font-semibold text-graphite hover:border-graphite">사용법</Link>
          </div>
        </div>
        <HowItWorks />
      </div>

      {stats ? (
        <dl className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-stone bg-stone sm:grid-cols-4">
          {(
            [
              ["제보", stats.reports],
              ["근거와 대조한 게시물", stats.checked],
              ["게시한 근거 댓글", stats.posted],
              ["잼통 자료 대기", stats.waiting],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-eggshell px-5 py-4">
              <dt className="text-[12px] text-smoke">{label}</dt>
              <dd className="mt-1 font-mono text-[26px] font-light tabular">{value.toLocaleString("ko-KR")}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <h2 className="mb-4 text-[13px] font-semibold text-smoke">최근 게시한 근거 안내</h2>
      {posted === null ? (
        <LoadingCards label="게시한 근거 안내를 불러오는 중" />
      ) : failed ? (
        <Card>
          <p className="text-[14px] text-smoke" role="status">기록을 불러오지 못했습니다.</p>
          <Button className="mt-4" onClick={() => { setFailed(false); setPosted(null); setRetry((n) => n + 1); }}>다시 불러오기</Button>
        </Card>
      ) : posted.length === 0 ? (
        <Card className="text-center">
          <p className="text-[16px] font-semibold">첫 근거 안내를 기다리고 있습니다</p>
          <p className="mt-2 text-[14px] text-smoke">의심스러운 게시물을 제보해 주세요. 운영자가 확인하고 게시한 댓글이 여기에 모입니다.</p>
          <Link href="/report" className="ui-button mt-4 text-[13px] font-semibold underline underline-offset-4">게시물 제보하기 <span aria-hidden="true">→</span></Link>
        </Card>
      ) : (
        <PostedGroups posted={posted} />
      )}
      <ReportFAQ />
    </Shell>
  );
}

/** 판정 종류별로 접어 둔다. 손이 더 가는 판정(사실과 다름)이 위. 처음에는 모두 닫아 종류와 건수만 보인다. */
function PostedGroups({ posted }: { posted: Posted[] }) {
  const groups = new Map<Verdict | null, Posted[]>();
  for (const p of posted) groups.set(p.verdict, [...(groups.get(p.verdict) ?? []), p]);
  const order: (Verdict | null)[] = [...PRIORITY, null].filter((v) => groups.has(v));

  return (
    <div className="divide-y divide-stone rounded-[20px] border border-stone bg-eggshell px-5 sm:px-6">
      {order.map((verdict) => {
        const rows = groups.get(verdict) ?? [];
        return (
          <Fold
            key={verdict ?? "none"}
            className="py-4"
            summary={
              <span className="flex items-center gap-2">
                {verdict ? <VerdictBadge verdict={verdict} /> : <span className="text-[14px] font-semibold">판정 없음</span>}
                <span className="font-mono text-[12px] text-smoke tabular">{rows.length}건</span>
              </span>
            }
          >
            <div className="mt-2 divide-y divide-stone border-t border-stone">
              {rows.map((p) => (
                <PostedCard key={p.id} p={p} />
              ))}
            </div>
          </Fold>
        );
      })}
    </div>
  );
}

/** 주장만 보이고, 누르면 근거 안내 댓글과 원 게시물 링크가 펼쳐진다. */
function PostedCard({ p }: { p: Posted }) {
  // 판정 기록이 없는 옛 게시 건은 주장 대신 댓글 첫 문장을 제목으로 쓴다.
  const fallback = p.comment?.replace(/^\[잼통 근거 안내\]\s*/, "").split(/(?<=다\.)\s/)[0] ?? p.id;
  return (
    <Fold
      className="py-4"
      summary={
        <>
          {p.claims?.length ? (
            <ul className="space-y-1 text-[14px] font-semibold leading-relaxed">
              {p.claims.map((c) => (
                <li key={c}>“{c}”</li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] font-semibold leading-relaxed">{fallback}</p>
          )}
          <p className="mt-1 text-[12px] text-ash tabular">{formatTime(p.postedAt)}</p>
        </>
      }
    >
      <div className="mt-3 rounded-[10px] bg-taupe px-4 py-3">
        <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-graphite">{p.comment}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-smoke">
          <a href={p.url} target="_blank" rel="noreferrer" className="underline">
            원 게시물 <span className="font-mono">{p.id}</span>
          </a>
          {p.postedUrl ? (
            <a href={p.postedUrl} target="_blank" rel="noreferrer" className="underline">
              인스타그램에서 보기
            </a>
          ) : null}
        </div>
      </div>
    </Fold>
  );
}
