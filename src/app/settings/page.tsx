"use client";

import { useCallback, useEffect, useState } from "react";

import { Shell } from "@/components/Shell";
import { Button, Card, ErrorLine, Heading } from "@/components/ui";
import { useAuth } from "@/lib/firebase/auth";

interface Config {
  electionFreeze: boolean;
  staleDays: number;
  dailyPostLimit: number;
}

export default function SettingsPage() {
  return (
    <Shell access="admin">
      <Settings />
    </Shell>
  );
}

/**
 * 운영 설정. 관리자만.
 *
 * 선거 기간 차단은 급할 때 바로 켤 수 있어야 해서 맨 위에 두고 누르면 곧바로 저장한다.
 * 숫자 값은 고친 뒤 저장을 눌러야 한다.
 */
function Settings() {
  const { api } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [staleDays, setStaleDays] = useState("");
  const [dailyPostLimit, setDailyPostLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((c: Config) => {
    setConfig(c);
    setStaleDays(String(c.staleDays));
    setDailyPostLimit(String(c.dailyPostLimit));
  }, []);

  useEffect(() => {
    void api("/api/admin/config").then(async (res) => {
      const body = await res.json();
      if (res.ok) apply(body);
      else setError(body.error ?? "설정을 불러오지 못했습니다.");
    });
  }, [api, apply]);

  async function save(patch: Partial<Config>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api("/api/admin/config", { method: "PATCH", body: JSON.stringify(patch) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "저장하지 못했습니다.");
      apply(body);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function toggleFreeze() {
    if (!config) return;
    const next = !config.electionFreeze;
    const ask = next
      ? "선거 기간 차단을 켤까요? 판정은 계속하지만 새 댓글 초안을 만들지 않습니다."
      : "선거 기간 차단을 끌까요? 다시 댓글 초안을 만듭니다.";
    if (window.confirm(ask)) void save({ electionFreeze: next });
  }

  const input = "w-28 rounded-[12px] border border-stone bg-eggshell px-3 py-2 font-mono text-[15px] tabular";

  return (
    <div className="space-y-8">
      <Heading lede="바꾸면 다음 판정과 수락부터 바로 적용됩니다.">운영 설정</Heading>
      {!config ? (
        error ? <ErrorLine message={error} /> : <p className="text-[14px] text-smoke">불러오는 중…</p>
      ) : (
        <>
          <Card className={config.electionFreeze ? "border-burgundy" : ""}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-semibold">선거 기간 차단</h2>
                <p className="mt-1 text-[14px] text-graphite">
                  켜면 판정은 계속하지만 새 댓글 초안을 만들지 않습니다. 선거 기간에 조직적 댓글로 읽힐 일을 앱이 먼저 멈춥니다.
                </p>
              </div>
              <Button tone={config.electionFreeze ? undefined : "primary"} disabled={busy} onClick={toggleFreeze}>
                {config.electionFreeze ? "차단 끄기" : "차단 켜기"}
              </Button>
            </div>
            <p className={`mt-3 text-[13px] font-semibold ${config.electionFreeze ? "text-burgundy" : "text-smoke"}`}>
              지금: {config.electionFreeze ? "차단 중" : "꺼짐"}
            </p>
          </Card>

          <Card>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save({ staleDays: Number(staleDays), dailyPostLimit: Number(dailyPostLimit) });
              }}
            >
              <label className="block">
                <span className="block text-[15px] font-semibold">오래된 게시물 기준 (일)</span>
                <span className="mb-2 block text-[13px] text-smoke">등록한 지 이보다 오래된 게시물은 재판정 때 댓글 초안을 만들지 않습니다. 1–365</span>
                <input className={input} type="number" min={1} max={365} required value={staleDays} onChange={(e) => setStaleDays(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-[15px] font-semibold">운영자 하루 게시 상한 (건)</span>
                <span className="mb-2 block text-[13px] text-smoke">한 운영자가 하루(한국 시간)에 수락·게시할 수 있는 수. 몰아 단 댓글은 스팸 신고를 부릅니다. 1–200</span>
                <input className={input} type="number" min={1} max={200} required value={dailyPostLimit} onChange={(e) => setDailyPostLimit(e.target.value)} />
              </label>
              <div className="flex items-center gap-3">
                <Button tone="primary" type="submit" disabled={busy}>
                  저장
                </Button>
                {saved ? <span className="text-[13px] text-navy">저장했습니다.</span> : null}
              </div>
            </form>
          </Card>
          <ErrorLine message={error} />
        </>
      )}
    </div>
  );
}
