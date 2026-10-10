"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, ErrorLine } from "@/components/ui";
import { useAuth } from "@/lib/firebase/auth";
import { parseInstagramUrl } from "@/lib/instagram/url";

const input = "form-input w-full rounded-[10px] border border-stone bg-eggshell px-3 py-2.5 text-[15px]";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function FilePreview({ file, remove, disabled }: { file: File; remove: () => void; disabled: boolean }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const source = URL.createObjectURL(file);
    if (image.current) image.current.src = source;
    return () => URL.revokeObjectURL(source);
  }, [file]);
  return (
    <li className="feedback-enter overflow-hidden rounded-[14px] border border-stone">
      {/* Local blob previews cannot use the Next.js image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={image} alt={`${file.name} 미리보기`} className="aspect-square w-full bg-taupe object-contain" />
      <div className="p-2">
        <p className="truncate text-[11px] text-smoke" title={file.name}>{file.name}</p>
        <button type="button" disabled={disabled} onClick={remove} aria-label={`${file.name} 삭제`}
          className="ui-button mt-1 min-h-8 w-full rounded-full border border-stone text-[12px] disabled:opacity-40">삭제</button>
      </div>
    </li>
  );
}

export function ReportForm({ initialUrl }: { initialUrl: string }) {
  const { api, refreshMe } = useAuth();
  const [url, setUrl] = useState(initialUrl);
  const [claim, setClaim] = useState("");
  const [memo, setMemo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [urlTouched, setUrlTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const parsed = parseInstagramUrl(url);

  function addFiles(incoming: File[]) {
    setDragging(false);
    if (busy) return;
    setFileError(null);
    const valid = incoming.filter((file) => IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= 5 * 1024 * 1024);
    const unique = [...files];
    for (const file of valid) {
      if (!unique.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) unique.push(file);
    }
    if (valid.length !== incoming.length) setFileError("JPG·PNG·WEBP·GIF 형식의 5MB 이하 이미지만 첨부할 수 있습니다.");
    else if (unique.length > 4) setFileError("최대 4장까지 첨부할 수 있습니다. 필요 없는 이미지를 삭제한 뒤 추가해 주세요.");
    setFiles(unique.slice(0, 4));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !parsed) return;
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
      setFileError(null);
      setUrlTouched(false);
      void refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : "접수하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-6" aria-busy={busy}>
      <fieldset disabled={busy} className="space-y-6">
      <legend className="sr-only">제보 내용</legend>
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
          onBlur={() => { setUrlTouched(true); setUrl(url.trim()); }}
          maxLength={500}
          aria-describedby="url-feedback"
          aria-invalid={urlTouched && Boolean(url) && !parsed}
        />
        <span id="url-feedback" className={`mt-2 block min-h-5 text-[12px] ${parsed ? "text-navy" : urlTouched && url ? "text-burgundy" : "text-smoke"}`}>
          {parsed ? "✓ 게시물 주소를 확인했습니다" : urlTouched && url ? "인스타그램 게시물 또는 릴스 주소를 넣어 주세요." : "인스타그램 게시물의 공유 메뉴에서 링크를 복사해 주세요."}
        </span>
      </label>

      <div>
        <label htmlFor="report-images" className="mb-2 block text-[13px] font-semibold">스크린샷 <span className="font-normal text-smoke">{files.length} / 4장</span></label>
        <p id="image-help" className="mb-3 text-[13px] text-smoke">
          이미지 속 글자로 주장을 읽습니다. 게시물 본문이 보이도록 찍어 주시면 정확해집니다.
        </p>
        <div data-dragging={dragging} className="upload-zone rounded-[14px] border border-dashed border-stone bg-taupe/40 p-4 focus-within:border-navy"
          onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}>
        <p className="mb-3 text-[13px] text-graphite">{dragging ? "여기에 놓아 첨부하세요" : "이미지를 선택하거나 여기로 끌어 놓으세요"}</p>
        <input
          id="report-images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          aria-describedby="image-help image-limits"
          className="w-full text-[12px] text-smoke file:mr-3 file:rounded-full file:border file:border-stone file:bg-eggshell file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-graphite"
        />
        <p id="image-limits" className="mt-3 text-[11px] text-smoke">JPG·PNG·WEBP·GIF · 한 장당 최대 5MB</p>
        </div>
        <ErrorLine message={fileError} />
        {files.length > 0 ? <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="첨부한 스크린샷">
          {files.map((file, index) => <FilePreview key={`${file.name}-${file.size}-${file.lastModified}`} file={file} disabled={busy}
            remove={() => { setFiles((current) => current.filter((_, i) => i !== index)); setFileError(null); }} />)}
        </ul> : null}
      </div>

      <label className="block">
        <span className="mb-2 block text-[13px] font-semibold">어느 주장이 의심스러운가요? (선택)</span>
        <input className={input} maxLength={500} value={claim} onChange={(e) => setClaim(e.target.value)} />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-semibold">메모 (선택)</span>
        <textarea className={`${input} min-h-24`} maxLength={1000} value={memo} onChange={(e) => setMemo(e.target.value)} />
        <span className="mt-1 block text-right font-mono text-[11px] text-smoke">{memo.length} / 1000</span>
      </label>
      </fieldset>

      <p className="text-[12px] leading-relaxed text-smoke">
        제보하면 주소·주장·메모·스크린샷과 내 계정이 함께 저장됩니다. 게시물 글·스크린샷·주장은 판정을 위해 AI 모델(Anthropic, 미국)로
        보내집니다. 이메일과 메모는 보내지 않습니다. 남용을 막기 위해 접속 지점은 되돌릴 수 없는 값(해시)으로만 남깁니다. 내 기록에서
        언제든 확인하고 탈퇴할 수 있습니다.{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          개인정보 처리방침
        </Link>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button tone="primary" type="submit" disabled={busy || !parsed}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? "보내는 중…" : "제보하기"}
        </Button>
        <Link href="/my" className="text-[13px] text-smoke underline">
          내 제보 보기
        </Link>
      </div>
      <ErrorLine message={error} />
      {done ? <div role="status" className="feedback-enter rounded-[14px] border border-navy/20 bg-navy-tint p-4">
        <p className="text-[14px] font-semibold text-navy">✓ {done}</p>
        <Link href="/my" className="ui-button mt-2 text-[13px] text-navy underline underline-offset-4">내 기록에서 처리 결과 보기 →</Link>
      </div> : null}
    </form>
  );
}
