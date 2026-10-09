"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Shell } from "@/components/Shell";
import { HowItWorks, ReportFAQ } from "@/components/HowItWorks";
import { Button, Card, formatTime, LoadingCards, VerdictBadge } from "@/components/ui";
import type { Verdict } from "@/lib/check/types";

interface Posted {
  id: string;
  url: string;
  verdict: Verdict | null;
  comment: string | null;
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
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetch("/api/public/posted")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()).posted as Posted[];
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
          </div>
        </div>
        <HowItWorks />
      </div>

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
        <div className="space-y-4">
          {posted.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center gap-2">
                <VerdictBadge verdict={p.verdict} />
                <a href={p.url} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-smoke underline">
                  {p.id}
                </a>
                <span className="ml-auto text-[12px] text-ash tabular">{formatTime(p.postedAt)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-graphite">{p.comment}</p>
              {p.postedUrl ? (
                <a href={p.postedUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[12px] text-smoke underline">
                  인스타그램에서 보기
                </a>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <ReportFAQ />
    </Shell>
  );
}
