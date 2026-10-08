import type { MetadataRoute } from "next";

/**
 * PWA 설정.
 *
 * share_target은 편의 기능이다. 안드로이드에서 앱을 설치하면 인스타그램의
 * '공유'에서 이 앱을 고를 수 있고, 주소가 제보 화면으로 넘어온다. 인스타그램
 * 앱이 무엇을 넘기는지는 기기마다 달라서, 제보 화면은 url·text 어느 쪽에서든
 * 주소를 찾는다. 기본 경로는 여전히 주소 붙여넣기다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "잼통 신고 센터",
    short_name: "신고 센터",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfcfc",
    theme_color: "#fdfcfc",
    lang: "ko",
    share_target: {
      action: "/report",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
