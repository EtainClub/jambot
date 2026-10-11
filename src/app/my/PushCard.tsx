"use client";

import { useEffect, useState } from "react";

import { Button, ErrorLine } from "@/components/ui";
import { useAuth } from "@/lib/firebase/auth";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/firebase/push";

const TEXT: Record<PushState, string> = {
  on: "이 기기에서 알림을 받고 있어요.",
  off: "알림을 켜면 제보 처리 결과와 운영자 답변을 바로 알려 드려요.",
  denied: "브라우저 설정에서 이 사이트의 알림이 차단돼 있어요. 설정에서 허용한 뒤 다시 눌러 주세요.",
  "ios-install": "아이폰은 사파리 공유 버튼 □↑ → 홈 화면에 추가한 뒤, 그 앱에서 알림을 켤 수 있어요.",
  unsupported: "이 브라우저는 알림을 지원하지 않아요.",
};

/** MY의 알림 켜기. 운영자는 새 게시 대기 작업 알림도 같이 받는다. */
export function PushCard() {
  const { api, member, refreshMe } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  if (!state) return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      setState(state === "on" ? await disablePush(api) : await enablePush(api));
      await refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림 설정을 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const canToggle = state === "on" || state === "off" || state === "denied";
  return (
    <section>
      <h2 className="mb-4 text-[20px] font-light tracking-[-0.01em]">알림</h2>
      <div className="rounded-[20px] border border-stone p-5">
        <p className="text-[14px] text-graphite">{TEXT[state]}</p>
        {member && state !== "unsupported" ? (
          <p className="mt-1 text-[12px] text-smoke">운영자는 새 게시 대기 작업이 생길 때도 알림을 받아요.</p>
        ) : null}
        {canToggle ? (
          <Button className="mt-4" tone={state === "on" ? undefined : "primary"} disabled={busy} onClick={() => void toggle()}>
            {state === "on" ? "알림 끄기" : "알림 켜기"}
          </Button>
        ) : null}
        <ErrorLine message={error} />
      </div>
    </section>
  );
}
