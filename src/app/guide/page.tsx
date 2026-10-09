import type { Metadata } from "next";

import { Shell } from "@/components/Shell";

import { Guide } from "./Guide";

export const metadata: Metadata = { title: "사용법" };

/**
 * 사용법. 제보하는 사람과 댓글을 다는 운영자, 두 갈래를 그림 위주로 보여 준다.
 * 둘러보기처럼 누구나 연다. `/guide#comment`로 들어오면 운영자 갈래가 먼저 열린다.
 */
export default function GuidePage() {
  return (
    <Shell>
      <Guide />
    </Shell>
  );
}
