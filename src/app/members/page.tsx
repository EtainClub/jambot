"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Shell } from "@/components/Shell";
import { Button, Card, ErrorLine, formatTime, Heading } from "@/components/ui";
import { useAuth } from "@/lib/firebase/auth";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/tasks/transitions";

interface Person {
  uid: string;
  email: string | null;
  displayName: string;
  linkedAt: number;
  reportCount: number;
  role: Role;
}

interface Invite {
  email: string;
  role: Role;
  invitedByName: string;
  createdAt: number;
}

const ROLE_HELP: Record<Role, string> = {
  contributor: "제보, 내 기록",
  reviewer: "작업 수락, 댓글 편집·게시, 제보자 답변, 건너뛰기",
  moderator: "검토자 권한 + 남의 작업 반납, 대기열 복귀, 재판정, 자료 공백 요청",
  admin: "운영 관리자 권한 + 운영자 지정·해제",
};

export default function MembersPage() {
  return (
    <Shell access="admin">
      <Members />
    </Shell>
  );
}

function Members() {
  const { api, member } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"operators" | "all">("operators");
  const [query, setQuery] = useState("");

  const fetchPeople = useCallback(
    () => api("/api/admin/people").then(async (res) => ({ res, data: await res.json() })),
    [api],
  );
  const apply = useCallback(
    ({ res, data }: { res: Response; data: { people?: Person[]; invites?: Invite[]; error?: string } }) => {
      setError(res.ok ? null : (data.error ?? "불러오지 못했습니다."));
      setPeople(data.people ?? []);
      setInvites(data.invites ?? []);
    },
    [],
  );
  useEffect(() => {
    let alive = true;
    void fetchPeople().then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
  }, [fetchPeople, apply]);
  const reload = useCallback(async () => apply(await fetchPeople()), [fetchPeople, apply]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? [])
      .filter((p) => filter === "all" || p.role !== "contributor")
      .filter((p) => !q || p.displayName.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q));
  }, [people, filter, query]);

  async function change(uid: string, role: Role, name: string) {
    if (!confirm(`${name}의 역할을 '${ROLE_LABEL[role]}'(으)로 바꿀까요?`)) return;
    const res = await api(`/api/admin/people/${uid}`, { method: "POST", body: JSON.stringify({ role }) });
    if (!res.ok) setError((await res.json()).error ?? "바꾸지 못했습니다.");
    await reload();
  }

  return (
    <div className="space-y-10">
      <Heading lede="구글을 연결한 사람은 모두 제보자입니다. 그중 운영에 참여할 사람에게 역할을 줍니다. 자기 역할은 바꿀 수 없고, 바꾼 기록은 남습니다.">
        운영자 관리
      </Heading>

      <dl className="grid gap-px overflow-hidden rounded-[20px] border border-stone bg-stone sm:grid-cols-2">
        {ROLES.map((r) => (
          <div key={r} className="bg-eggshell p-4">
            <dt className="text-[13px] font-semibold">
              {ROLE_LABEL[r]} <span className="font-mono text-[11px] font-normal text-ash">{r}</span>
            </dt>
            <dd className="mt-1 text-[12px] leading-relaxed text-smoke">{ROLE_HELP[r]}</dd>
          </div>
        ))}
      </dl>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["operators", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${filter === f ? "bg-ink text-eggshell" : "border border-stone text-graphite hover:border-graphite"}`}
            >
              {f === "operators" ? "운영자" : "전체"}
            </button>
          ))}
          <input
            className="ml-auto w-full rounded-[4px] border border-stone bg-eggshell px-3 py-1.5 text-[14px] sm:w-56"
            placeholder="이름·이메일 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="이름이나 이메일로 검색"
          />
        </div>
        <ErrorLine message={error} />
        {people === null ? (
          <p className="text-[14px] text-smoke">불러오는 중…</p>
        ) : shown.length === 0 ? (
          <p className="text-[14px] text-smoke">해당하는 사람이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-stone border-y border-stone">
            {shown.map((p) => (
              <li key={p.uid} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {p.displayName}
                    {p.uid === member?.uid ? <span className="ml-1 text-[12px] font-normal text-smoke">(나)</span> : null}
                  </p>
                  <p className="truncate text-[12px] text-smoke">
                    {p.email} · 제보 {p.reportCount} · {formatTime(p.linkedAt)} 연결
                  </p>
                </div>
                <select
                  className="rounded-full border border-stone bg-eggshell px-3 py-1.5 text-[13px] disabled:opacity-50"
                  value={p.role}
                  disabled={p.uid === member?.uid}
                  onChange={(e) => void change(p.uid, e.target.value as Role, p.displayName)}
                  aria-label={`${p.displayName}의 역할`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InviteForm invites={invites} onChange={reload} />
    </div>
  );
}

function InviteForm({ invites, onChange }: { invites: Invite[]; onChange: () => Promise<void> }) {
  const { api } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("reviewer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(target: string, r: Role) {
    setBusy(true);
    setError(null);
    const res = await api("/api/admin/invites", { method: "POST", body: JSON.stringify({ email: target, role: r }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "저장하지 못했습니다.");
    setEmail("");
    await onChange();
  }

  return (
    <Card>
      <h2 className="text-[20px] font-light tracking-[-0.01em]">아직 가입하지 않은 사람 지정</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-smoke">
        이메일로 역할을 미리 적어 두면, 그 사람이 같은 구글 계정을 연결하는 순간 반영됩니다.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="flex-1 rounded-[4px] border border-stone bg-eggshell px-3 py-2 text-[14px]"
          type="email"
          placeholder="name@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="이메일"
        />
        <select
          className="rounded-full border border-stone bg-eggshell px-3 py-2 text-[13px]"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          aria-label="역할"
        >
          {ROLES.filter((r) => r !== "contributor").map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <Button tone="primary" disabled={busy || !email} onClick={() => void send(email, role)}>
          지정
        </Button>
      </div>
      <ErrorLine message={error} />
      {invites.length ? (
        <ul className="mt-5 divide-y divide-stone border-y border-stone text-[13px]">
          {invites.map((i) => (
            <li key={i.email} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-semibold">{i.email}</span>
              <span className="text-smoke">
                {ROLE_LABEL[i.role]} · {i.invitedByName} · {formatTime(i.createdAt)}
              </span>
              <button className="ml-auto text-[12px] text-smoke underline" disabled={busy} onClick={() => void send(i.email, "contributor")}>
                취소
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
