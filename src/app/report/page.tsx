import type { Metadata } from "next";

import { Shell } from "@/components/Shell";

import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "제보" };

/**
 * 제보 화면. 구글 계정을 연결해야 쓸 수 있다.
 *
 * share_target으로 들어오면 url·text·title 중 어디에 주소가 들었는지 기기마다
 * 다르다. 셋을 모두 뒤져 처음 나온 인스타그램 주소를 채운다.
 */
export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const params = await searchParams;
  const pool = ["url", "text", "title"].map((k) => params[k]).flat().filter((v): v is string => typeof v === "string");
  const shared = pool.join(" ").match(/https?:\/\/(?:www\.)?instagram\.com\/\S+/)?.[0] ?? "";

  return (
    <Shell access="google">
      <div className="mx-auto max-w-xl">
        <h1 className="text-[32px] font-light leading-tight tracking-[-0.02em]">정책 주장 제보</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-graphite">
          정부 정책에 대해 사실과 다르게 보이는 인스타그램 게시물을 알려 주세요. 잼통의 근거 자료와 대조한 뒤 운영자가
          확인합니다. 처리 결과는 내 기록에서 볼 수 있습니다.
        </p>
        <ReportForm initialUrl={shared} />
      </div>
    </Shell>
  );
}
