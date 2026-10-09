import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

import { ServiceWorker } from "@/components/ServiceWorker";
import { AuthProvider } from "@/lib/firebase/auth";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/brand";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // 공유 링크와 아이콘의 기준 주소. 서비스 도메인은 bot.jamtong.kr이다.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bot.jamtong.kr"),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  // favicon.ico / icon.png / apple-icon.png는 Next.js 파일 규칙으로도 지정된다.
  icons: {
    icon: [
      { url: "/icon.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{
      url: "/brand/jamtong-report-share.png",
      width: 1200,
      height: 630,
      type: "image/png",
      alt: "잼통 신고 센터 — 파란 잼통과 민트색 체크 로고",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{ url: "/brand/jamtong-report-share.png", alt: APP_NAME }],
  },
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
