/*
 * 잼통 신고 센터 서비스 워커.
 *
 * 하는 일은 하나다: 네트워크가 끊겼을 때 페이지 이동에 빈 화면 대신 안내를 보인다.
 *
 * ★ 아무것도 캐시하지 않는다.
 *   작업 큐, 판정, 내 기록은 늘 지금 상태여야 한다. 캐시된 옛 화면에서 "게시 대기"를
 *   보고 수락을 누르면 이미 다른 운영자가 게시한 작업일 수 있다. 그래서 API와
 *   정적 파일은 손대지 않고 브라우저에 맡기며, 페이지 이동도 언제나 네트워크를 먼저 쓴다.
 */

const OFFLINE_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>연결 끊김 · 잼통 신고 센터</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#fdfcfc;color:#000;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}
  main{max-width:22em;padding:24px;text-align:center}
  h1{font-weight:300;font-size:28px;letter-spacing:-.02em;margin:0 0 12px}
  p{color:#44403b;line-height:1.6;font-size:15px;margin:0 0 20px}
  button{border:0;border-radius:9999px;background:#000;color:#fdfcfc;padding:10px 18px;font-size:13px;font-weight:600}
</style></head>
<body><main>
  <h1>인터넷 연결이 끊겼습니다</h1>
  <p>잼통 신고 센터는 최신 작업과 판정을 보여 주기 위해 연결이 필요합니다. 연결된 뒤 다시 시도해 주세요.</p>
  <button onclick="location.reload()">다시 시도</button>
</main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
