"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { LinkButton, Shell } from "@/components/Shell";
import { Button, Card, ErrorLine, formatTime, Heading, StatusTag, VerdictBadge } from "@/components/ui";
import type { Verdict } from "@/lib/check/types";
import { useAuth } from "@/lib/firebase/auth";
import type { Outcome } from "@/lib/outcome";
import { ROLE_LABEL } from "@/lib/tasks/transitions";

interface MyReport {
  id: string;
  shortcode: string;
  url: string;
  claim: string | null;
  memo: string | null;
  imageCount: number;
  createdAt: number;
  outcome: Outcome;
}

interface WorkRow {
  id: string;
  url: string;
  status: string;
  verdict: Verdict | null;
  finalComment: string | null;
  postedUrl: string | null;
  postedAt: number | null;
  expiresAt: number | null;
  skipReason: string | null;
  skippedAt: number | null;
}

interface Work {
  claimed: WorkRow[];
  posted: WorkRow[];
  skipped: WorkRow[];
}

export default function MyPage() {
  return (
    <Shell>
      <My />
    </Shell>
  );
}

function My() {
  const auth = useAuth();

  if (!auth.ready) return <p className="text-[14px] text-smoke">불러오는 중…</p>;

  if (!auth.google) {
    return (
      <>
        <Heading lede="지금은 익명으로 둘러보는 중입니다. 구글 계정을 연결하면 게시물을 제보할 수 있고, 내가 한 제보와 그 처리 결과가 여기에 쌓입니다.">
          내 기록
        </Heading>
        <LinkButton />
        <p className="mt-6 max-w-[34em] text-[13px] leading-relaxed text-smoke">
          연결하면 구글 계정의 이메일과 이름만 받습니다. 연락처나 다른 정보는 받지 않으며, 언제든 이 화면에서 탈퇴할 수 있습니다.
        </p>
        <Link href="/guide" className="ui-button mt-4 inline-block text-[13px] font-semibold underline underline-offset-4">
          처음이라면 사용법 보기 <span aria-hidden="true">→</span>
        </Link>
      </>
    );
  }

  return (
    <div className="space-y-12">
      <Heading lede="내 계정에 저장된 정보와 내가 한 일입니다.">내 기록</Heading>
      <Dashboard member={Boolean(auth.member)} />
      {auth.member?.role === "admin" ? (
        <Link
          href="/members"
          className="block rounded-[20px] border border-stone p-5 hover:border-graphite"
        >
          <span className="text-[15px] font-semibold">운영자 관리</span>
          <span className="mt-1 block text-[13px] text-smoke">구글을 연결한 사람에게 검토자·운영 관리자·관리자 역할을 줍니다.</span>
        </Link>
      ) : null}
      <Link href="/guide" className="block rounded-[20px] border border-stone p-5 hover:border-graphite">
        <span className="text-[15px] font-semibold">사용법</span>
        <span className="mt-1 block text-[13px] text-smoke">제보하는 법, 운영자가 댓글을 붙여넣고 게시 완료하는 법을 그림으로 봅니다.</span>
      </Link>
      <Account />
    </div>
  );
}

/** path가 null이면 부르지 않는다. 운영자가 아닐 때 작업 목록이 그렇다. */
function useLoad<T>(path: string | null) {
  const { api } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIt = useCallback(
    (p: string) => api(p).then(async (res) => ({ res, body: await res.json() })),
    [api],
  );
  const apply = useCallback(({ res, body }: { res: Response; body: T & { error?: string } }) => {
    setError(res.ok ? null : (body.error ?? "불러오지 못했습니다."));
    setData(res.ok ? body : null);
  }, []);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    void fetchIt(path).then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
  }, [path, fetchIt, apply]);

  return { data, error };
}

function Dashboard({ member }: { member: boolean }) {
  const work = useLoad<Work>(member ? "/api/my/work" : null);
  return (
    <>
      <Summary work={member ? work.data : undefined} />
      <Reports />
      {member ? <MyWork data={work.data} error={work.error} /> : null}
    </>
  );
}

/** work가 undefined면 운영자가 아니다. null이면 아직 불러오는 중이다. */
function Summary({ work }: { work: Work | null | undefined }) {
  const { me } = useAuth();
  const stats = [
    { label: "제보", value: me?.profile?.reportCount ?? 0 },
    ...(work !== undefined
      ? [
          { label: "게시한 안내", value: work?.posted.length ?? "–" },
          { label: "처리 중", value: work?.claimed.length ?? "–" },
        ]
      : []),
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-stone bg-stone sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-eggshell p-5">
          <dt className="text-[12px] text-smoke">{s.label}</dt>
          <dd className="mt-1 font-mono text-[28px] font-light tabular">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Reports() {
  const { data, error } = useLoad<{ reports: MyReport[] }>("/api/my/reports");
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[20px] font-light tracking-[-0.01em]">내가 한 제보</h2>
        <Link href="/report" className="text-[13px] text-smoke underline">
          새 제보
        </Link>
      </div>
      <ErrorLine message={error} />
      {!data ? (
        error ? null : <p className="text-[14px] text-smoke">불러오는 중…</p>
      ) : data.reports.length === 0 ? (
        <p className="text-[14px] text-smoke">아직 제보한 게시물이 없습니다.</p>
      ) : (
        <ul className="space-y-4">
          {data.reports.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${r.outcome.stage === "done" ? "bg-ink text-eggshell" : "bg-taupe text-graphite"}`}
                  >
                    {r.outcome.label}
                  </span>
                  <VerdictBadge verdict={r.outcome.verdict} />
                  <a href={r.url} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-smoke underline">
                    {r.shortcode}
                  </a>
                  <span className="ml-auto text-[12px] text-ash tabular">{formatTime(r.createdAt)}</span>
                </div>
                {r.claim ? <p className="mt-3 text-[14px]">“{r.claim}”</p> : null}
                {r.memo ? <p className="mt-1 text-[13px] text-smoke">메모: {r.memo}</p> : null}
                {r.imageCount ? <p className="mt-1 text-[12px] text-ash">스크린샷 {r.imageCount}장</p> : null}

                {r.outcome.comment ? (
                  <div className="mt-4 border-t border-stone pt-4">
                    <h3 className="text-[12px] font-semibold text-smoke">게시한 근거 안내</h3>
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-graphite">{r.outcome.comment}</p>
                    {r.outcome.postedUrl ? (
                      <a href={r.outcome.postedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-smoke underline">
                        인스타그램에서 보기
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {r.outcome.reply ? (
                  <div className="mt-4 border-t border-stone pt-4">
                    <h3 className="text-[12px] font-semibold text-smoke">
                      운영자 답변 <span className="font-normal text-ash tabular">{formatTime(r.outcome.replyAt)}</span>
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-graphite">{r.outcome.reply}</p>
                  </div>
                ) : null}
                {r.outcome.stage === "waiting" ? (
                  <p className="mt-4 text-[13px] text-smoke">
                    잼통에 아직 근거가 없는 주제입니다. 자료가 등록되면 다시 확인합니다.
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MyWork({ data, error }: { data: Work | null; error: string | null }) {
  const groups: { title: string; rows: WorkRow[]; empty: string }[] = data
    ? [
        { title: "지금 맡은 작업", rows: data.claimed, empty: "맡은 작업이 없습니다." },
        { title: "게시한 근거 안내", rows: data.posted, empty: "아직 게시한 안내가 없습니다." },
        { title: "건너뛴 작업", rows: data.skipped, empty: "건너뛴 작업이 없습니다." },
      ]
    : [];
  return (
    <section>
      <h2 className="mb-4 text-[20px] font-light tracking-[-0.01em]">내가 한 운영 작업</h2>
      <ErrorLine message={error} />
      {!data && !error ? <p className="text-[14px] text-smoke">불러오는 중…</p> : null}
      <div className="space-y-8">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="mb-2 text-[13px] font-semibold text-smoke">
              {g.title} <span className="font-mono font-normal tabular">{g.rows.length}</span>
            </h3>
            {g.rows.length === 0 ? (
              <p className="text-[13px] text-ash">{g.empty}</p>
            ) : (
              <ul className="divide-y divide-stone border-y border-stone">
                {g.rows.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tasks/${t.id}`} className="block py-3 hover:bg-taupe/60 sm:px-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusTag status={t.status} />
                        <VerdictBadge verdict={t.verdict} />
                        <span className="font-mono text-[12px] text-smoke">{t.id}</span>
                        <span className="ml-auto text-[12px] text-ash tabular">
                          {formatTime(t.postedAt ?? t.skippedAt ?? t.expiresAt)}
                          {t.status === "claimed" && t.expiresAt ? "까지" : ""}
                        </span>
                      </div>
                      {t.finalComment ? <p className="mt-1 line-clamp-2 text-[13px] text-graphite">{t.finalComment}</p> : null}
                      {t.skipReason ? <p className="mt-1 text-[13px] text-smoke">사유: {t.skipReason}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Account() {
  const { me, member, api, refreshMe, signOutUser } = useAuth();
  const profile = me?.profile;
  const [name, setName] = useState(profile?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!profile) return null;

  async function rename() {
    setBusy(true);
    setError(null);
    const res = await api("/api/my", { method: "PATCH", body: JSON.stringify({ displayName: name }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "저장하지 못했습니다.");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await refreshMe();
  }

  async function remove() {
    const ok = confirm(
      "탈퇴하면 계정과 프로필이 지워지고, 내 제보에서 계정·메모·접속 지점 기록이 끊어집니다. 제보한 게시물 자체의 처리 기록은 남습니다. 되돌릴 수 없습니다. 탈퇴할까요?",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await api("/api/my", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "탈퇴하지 못했습니다.");
    await signOutUser();
  }

  const rows: [string, string][] = [
    ["이름", profile.displayName],
    ["이메일 (구글)", profile.email ?? "–"],
    ["계정 번호", profile.uid],
    ["구글 연결", formatTime(profile.linkedAt)],
    ["마지막 변경", formatTime(profile.updatedAt)],
    ["제보 수", String(profile.reportCount)],
    ["역할", ROLE_LABEL[me?.role ?? "contributor"]],
  ];

  return (
    <section>
      <h2 className="mb-4 text-[20px] font-light tracking-[-0.01em]">내 정보</h2>
      <Card>
        <p className="text-[13px] leading-relaxed text-smoke">
          아래가 이 서비스가 내 계정에 대해 저장하는 정보 전부입니다. 제보 내용(주소·주장·메모·스크린샷)은 위 제보 목록에 있는
          그대로입니다.
        </p>
        <dl className="mt-5 grid grid-cols-[8em_1fr] gap-y-2 text-[14px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-smoke">{k}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 border-t border-stone pt-5">
          <label className="block text-[13px] font-semibold" htmlFor="display-name">
            이름 바꾸기
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="display-name"
              className="flex-1 rounded-[4px] border border-stone bg-eggshell px-3 py-2 text-[14px]"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button disabled={busy || !name.trim() || name === profile.displayName} onClick={() => void rename()}>
              {saved ? "저장했습니다" : "저장"}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-stone pt-5">
          <Button onClick={() => void signOutUser()}>로그아웃</Button>
          <Button disabled={busy} onClick={() => void remove()} className="hover:border-burgundy hover:text-burgundy">
            탈퇴
          </Button>
        </div>
        {member ? (
          <p className="mt-3 text-[12px] text-smoke">운영자 계정은 운영 기록 보존을 위해 관리자가 운영자 해제를 먼저 해야 탈퇴할 수 있습니다.</p>
        ) : null}
        <ErrorLine message={error} />
      </Card>
    </section>
  );
}
