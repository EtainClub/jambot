import type { ButtonHTMLAttributes } from "react";

import { VERDICT_LABEL, type Verdict } from "@/lib/check/types";

/*
 * 공용 조각. 잼통 디자인 시스템 규칙:
 *   - 누를 수 있는 것은 알약(rounded-full), 담는 것은 카드(rounded-[20px]), 입력은 거의 각지게(rounded-[4px])
 *   - 그림자 없음. 면은 stone 1px 헤어라인으로 나눈다
 *   - 기본 조각은 무채색, 판정과 안내·선택 상태는 의미에 맞는 색
 */

type Tone = "primary" | "quiet";

export function Button({ tone = "quiet", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  const base =
    "ui-button rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed";
  const look =
    tone === "primary"
      ? "bg-ink text-eggshell hover:opacity-85"
      : "border border-stone text-graphite hover:border-graphite hover:text-ink";
  return <button className={`${base} ${look} ${className}`} {...rest} />;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`surface-card rounded-[20px] border border-stone bg-eggshell p-5 sm:p-8 ${className}`}>{children}</section>;
}

/**
 * 접히는 묶음. 머리(summary)만 보이고 눌러야 내용이 열린다.
 * 닫혀도 내용은 그대로 마운트돼 있어 입력 중인 값이 날아가지 않는다.
 */
export function Fold({
  summary,
  children,
  defaultOpen = false,
  className = "",
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={`faq-item ${className}`}>
      <summary className="flex min-h-6 items-center gap-3">
        <div className="min-w-0 flex-1">{summary}</div>
        <span className="faq-toggle text-[20px] font-light leading-none text-smoke" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="faq-answer">{children}</div>
    </details>
  );
}

export function Heading({ children, lede }: { children: React.ReactNode; lede?: React.ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="text-[32px] font-light leading-tight tracking-[-0.02em] sm:text-[36px]">{children}</h1>
      {lede ? <p className="mt-3 max-w-[34em] text-[15px] leading-relaxed text-graphite">{lede}</p> : null}
    </header>
  );
}

/**
 * 판정 배지. 이 앱에서 색이 붙는 몇 안 되는 자리다.
 *   burgundy — 정정이 필요한 판정 (사실과 다름·맥락 누락·과거에는 사실)
 *   navy     — 근거와 일치
 *   pending  — 사람이 봐야 하거나 근거가 모자람
 * 나머지는 무채색이다. 색만으로 구분하지 않도록 글자를 늘 함께 쓴다.
 */
export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return null;
  const tone =
    verdict === "false" || verdict === "missing_context" || verdict === "outdated"
      ? "bg-burgundy-tint text-burgundy"
      : verdict === "accurate"
        ? "bg-navy-tint text-navy"
        : verdict === "insufficient"
          ? "bg-pending-tint text-pending"
          : "border border-stone text-graphite";
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>{VERDICT_LABEL[verdict]}</span>;
}

export const STATUS_LABEL: Record<string, string> = {
  processing: "판정 중",
  queued: "게시 대기",
  claimed: "처리 중",
  posted: "게시 완료",
  skipped: "건너뜀",
  needs_review: "검토 필요",
  waiting_for_content: "잼통 자료 대기",
  no_action: "조치 없음",
  no_content: "본문 미확보",
};

export function StatusTag({ status }: { status: string }) {
  const tone = status === "needs_review" ? "bg-pending-tint text-pending" : "bg-taupe text-graphite";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>
    {status === "processing" ? <span className="status-dot" aria-hidden="true" /> : null}
    {STATUS_LABEL[status] ?? status}
  </span>;
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="feedback-enter mt-3 text-[13px] text-burgundy">
      {message}
    </p>
  );
}

export function LoadingCards({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((n) => (
        <div key={n} aria-hidden="true" className="rounded-[20px] border border-stone p-5">
          <div className="skeleton mb-4 h-3 w-24 rounded-full" />
          <div className="skeleton h-3 w-4/5 rounded-full" />
          <div className="skeleton mt-2 h-3 w-3/5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function formatTime(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
