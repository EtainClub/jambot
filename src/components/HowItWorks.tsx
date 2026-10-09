"use client";

import { useState } from "react";
import Link from "next/link";

const STEPS = [
  { title: "게시물 제보", eyebrow: "의심스러운 주장 발견", description: "인스타그램 게시물 주소와 스크린샷을 보내 주세요. 의심스러운 주장을 함께 적으면 확인에 도움이 됩니다.", detail: "주소 하나로 시작할 수 있습니다", action: "게시물 제보하기", href: "/report" },
  { title: "근거 확인", eyebrow: "출처를 따라 확인", description: "잼통에 등록된 근거 자료와 주장을 대조하고 운영자가 확인합니다. 근거가 부족하면 먼저 자료를 모읍니다.", detail: "근거가 없으면 판정하지 않습니다", action: "잼통 근거 자료 보기", href: "https://jamtong.kr" },
  { title: "댓글 게시", eyebrow: "확인한 내용을 함께 전달", description: "운영자가 출처를 붙인 팩트 체크 댓글을 직접 게시합니다. 내 제보의 처리 결과는 내 기록에서 확인할 수 있습니다.", detail: "실제로 게시한 댓글만 공개합니다", action: "내 기록 보기", href: "/my" },
];

export function HowItWorks() {
  const [selected, setSelected] = useState(0);
  const step = STEPS[selected];
  return (
    <section className="hero-panel rounded-[24px] border border-stone p-5 sm:p-7" aria-labelledby="workflow-heading">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="workflow-heading" className="text-[14px] font-semibold">제보는 이렇게 이어집니다</h2>
        <span className="font-mono text-[12px] text-smoke" aria-hidden="true">0{selected + 1} / 03</span>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-label="제보 처리 단계">
        {STEPS.map((item, index) => (
          <button key={item.title} type="button" aria-pressed={selected === index} aria-controls="workflow-detail"
            onClick={() => setSelected(index)} className="workflow-step rounded-[14px] border border-stone bg-eggshell px-2 py-3 text-center">
            <span className="mb-1 block font-mono text-[11px] text-smoke">0{index + 1}</span>
            <span className="text-[12px] font-semibold sm:text-[13px]">{item.title}</span>
          </button>
        ))}
      </div>
      <div className="my-5 h-0.5 overflow-hidden rounded-full bg-stone" aria-hidden="true">
        <div className="step-track h-full w-full bg-navy" style={{ transform: `scaleX(${(selected + 1) / 3})` }} />
      </div>
      <div id="workflow-detail" aria-live="polite" aria-atomic="true">
        <div key={selected} className="step-detail min-h-[210px]">
          <p className="text-[12px] font-semibold text-navy">{step.eyebrow}</p>
          <p className="mt-2 text-[20px] font-semibold tracking-tight">{step.detail}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-graphite">{step.description}</p>
          {step.href.startsWith("https:") ? (
            <a href={step.href} target="_blank" rel="noreferrer" className="ui-button mt-4 text-[13px] font-semibold underline underline-offset-4">{step.action}<span aria-hidden="true">↗</span></a>
          ) : (
            <Link href={step.href} className="ui-button mt-4 text-[13px] font-semibold underline underline-offset-4">{step.action}<span aria-hidden="true">→</span></Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function ReportFAQ() {
  const questions = [
    ["어떤 게시물을 제보하면 되나요?", "이재명 정부 정책에 대해 사실과 다르게 보이는 인스타그램 게시물을 알려 주세요. 게시물 주소와 주장이 보이는 스크린샷이 있으면 확인에 도움이 됩니다."],
    ["제보하면 댓글이 바로 달리나요?", "근거 자료와 대조한 내용을 운영자가 확인한 뒤 직접 댓글을 게시합니다. 제보가 접수됐다고 바로 판정되거나 게시되지는 않습니다."],
    ["근거 자료가 없으면 어떻게 되나요?", "근거가 없는 주장은 판정하지 않습니다. 잼통에 자료를 먼저 등록하고 다시 확인하며, 진행 상황은 내 기록에 남습니다."],
  ];
  return (
    <section className="mt-12" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="mb-4 text-[20px] font-light">제보 전에 궁금한 점</h2>
      <div className="divide-y divide-stone border-y border-stone">
        {questions.map(([question, answer]) => (
          <details key={question} className="faq-item py-4">
            <summary className="flex min-h-6 items-center justify-between gap-4 text-[14px] font-semibold">
              {question}<span className="faq-toggle text-[20px] font-light text-smoke" aria-hidden="true">+</span>
            </summary>
            <p className="faq-answer mt-3 max-w-[48em] text-[14px] leading-relaxed text-graphite">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
