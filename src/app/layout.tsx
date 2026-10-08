import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/lib/firebase/auth";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "잼통 근거 안내", template: "%s · 잼통 근거 안내" },
  description: "인스타그램의 정책 주장을 잼통 근거와 대조하고, 운영자가 근거 안내 댓글을 나눠 게시합니다.",
  // 운영 도구다. 검색에 드러날 이유가 없다.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fdfcfc" };

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
      </body>
    </html>
  );
}
