import type { MetadataRoute } from "next";

/**
 * PWA 설정.
 *
 * 설치 조건(Chrome): name·short_name, start_url, display, 192px·512px PNG 아이콘,
 * 그리고 서비스 워커(public/sw.js). 아이콘이 없으면 "this app cannot be installed"가 뜬다.
 * 아이콘은 잼통 앱 아이콘 세트를 그대로 쓴다 — 같은 브랜드이고 홈 화면용으로
 * 다듬어진 이미지다. maskable은 안드로이드가 원·둥근 사각으로 잘라 쓰는 판이다.
 *
 * share_target은 편의 기능이다. 안드로이드에서 앱을 설치하면 인스타그램의
 * '공유'에서 이 앱을 고를 수 있고, 주소가 제보 화면으로 넘어온다. 인스타그램
 * 앱이 무엇을 넘기는지는 기기마다 달라서, 제보 화면은 url·text 어느 쪽에서든
 * 주소를 찾는다. 기본 경로는 여전히 주소 붙여넣기다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "잼통 신고 센터",
    short_name: "신고 센터",
    description: "인스타그램의 정부 정책 주장을 잼통 근거와 대조합니다. 의심스러운 게시물을 제보하세요.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfcfc",
    theme_color: "#fdfcfc",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/report",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
