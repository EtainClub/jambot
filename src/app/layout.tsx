import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

import { ServiceWorker } from "@/components/ServiceWorker";
import { AuthProvider } from "@/lib/firebase/auth";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // 공유 링크와 아이콘의 기준 주소. 서비스 도메인은 bot.jamtong.kr이다.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bot.jamtong.kr"),
  title: { default: "잼통 신고 센터", template: "%s · 잼통 신고 센터" },
  description: "인스타그램의 정책 주장을 잼통 근거와 대조하고, 운영자가 근거 안내 댓글을 나눠 게시합니다.",
  // 운영 도구다. 검색에 드러날 이유가 없다.
  robots: { index: false, follow: false },
};

/*
 * viewportFit cover: 아이폰 홈 인디케이터 영역까지 화면을 쓴다. 하단 탭 바가
 * env(safe-area-inset-bottom)만큼 스스로 비켜 선다.
 */
export const viewport: Viewport = { themeColor: "#fdfcfc", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${plexMono.variable}`}>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-eggshell focus:font-semibold"
        >
          본문으로 건너뛰기
        </a>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
