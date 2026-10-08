"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록. PWA 설치 조건을 맞추고, 연결이 끊겼을 때 안내 화면을 띄운다.
 *
 * 개발 서버에서는 등록하지 않는다. 핫 리로드와 엉켜 옛 화면이 남는 일을 피한다.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.error("[sw] 등록 실패", error);
    });
  }, []);
  return null;
}
