"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Shell } from "@/components/Shell";
import { Card, formatTime, Heading, VerdictBadge } from "@/components/ui";
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
  }, []);

  return (
    <Shell>
      <Heading
        lede={
          <>
            인스타그램에 도는 정부 정책 주장을 <a className="underline" href="https://jamtong.kr">잼통</a>의 근거 자료와
            대조합니다. 운영자가 확인한 뒤, 출처를 붙인 안내 댓글을 직접 답니다. 잼통에 근거가 없는 주장은 판정하지 않고, 자료를
            먼저 등록합니다.
          </>
        }
      >
        근거로 답합니다
      </Heading>

      <div className="mb-12 flex flex-wrap gap-2">
        <Link href="/report" className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-eggshell hover:opacity-85">
          게시물 제보하기
        </Link>
        <Link href="/my" className="rounded-full border border-stone px-4 py-2 text-[13px] font-semibold text-graphite hover:border-graphite">
          내 기록
        </Link>
      </div>

      <h2 className="mb-4 text-[13px] font-semibold text-smoke">최근 게시한 근거 안내</h2>
      {posted === null ? (
        <p className="text-[14px] text-smoke">불러오는 중…</p>
      ) : failed ? (
        <p className="text-[14px] text-smoke">기록을 불러오지 못했습니다.</p>
      ) : posted.length === 0 ? (
        <p className="text-[14px] text-smoke">아직 게시한 안내가 없습니다.</p>
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
    </Shell>
  );
}
