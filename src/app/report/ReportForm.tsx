"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, ErrorLine } from "@/components/ui";
import { useAuth } from "@/lib/firebase/auth";

const input = "w-full rounded-[4px] border border-stone bg-eggshell px-3 py-2.5 text-[15px] focus:border-graphite";

export function ReportForm({ initialUrl }: { initialUrl: string }) {
  const { api, refreshMe } = useAuth();
  const [url, setUrl] = useState(initialUrl);
  const [claim, setClaim] = useState("");
  const [memo, setMemo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    const form = new FormData();
    form.set("url", url);
    form.set("claim", claim);
    form.set("memo", memo);
    for (const f of files) form.append("images", f);
    try {
      const res = await api("/api/reports", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "접수하지 못했습니다.");
      setDone(data.merged ? "이미 접수된 게시물입니다. 제보를 합쳐 두었습니다." : "접수했습니다. 고맙습니다.");
      setUrl("");
      setClaim("");
      setMemo("");
      setFiles([]);
      void refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : "접수하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-6">
      <label className="block">
        <span className="mb-2 block text-[13px] font-semibold">인스타그램 게시물 주소 *</span>
        <input
          className={input}
          type="url"
          required
          inputMode="url"
          placeholder="https://www.instagram.com/p/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-semibold">스크린샷 (최대 4장)</span>
        <span className="mb-2 block text-[13px] text-smoke">
          이미지 속 글자로 주장을 읽습니다. 게시물 본문이 보이도록 찍어 주시면 정확해집니다.
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
          className="text-[14px]"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-semibold">어느 주장이 의심스러운가요? (선택)</span>
        <input className={input} maxLength={500} value={claim} onChange={(e) => setClaim(e.target.value)} />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-semibold">메모 (선택)</span>
        <textarea className={`${input} min-h-24`} maxLength={1000} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      <p className="text-[12px] leading-relaxed text-smoke">
        제보하면 주소·주장·메모·스크린샷과 내 계정이 함께 저장됩니다. 남용을 막기 위해 접속 지점은 되돌릴 수 없는 값(해시)으로만
        남깁니다. 내 기록에서 언제든 확인하고 탈퇴할 수 있습니다.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button tone="primary" type="submit" disabled={busy || !url}>
          {busy ? "보내는 중…" : "제보하기"}
        </Button>
        <Link href="/my" className="text-[13px] text-smoke underline">
          내 제보 보기
        </Link>
      </div>
      <ErrorLine message={error} />
      {done ? <p className="text-[14px] text-graphite">{done}</p> : null}
    </form>
  );
}
