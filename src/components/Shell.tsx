"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/firebase/auth";
import { atLeast, type Role } from "@/lib/tasks/transitions";

import { Button } from "./ui";

const NAV = [
  { href: "/", label: "작업" },
  { href: "/gaps", label: "자료 공백" },
  { href: "/report", label: "제보" },
];

/** 상단 바와 운영자 확인. 운영자 화면은 전부 이 안에 들어간다. */
export function Shell({ children, min = "observer" }: { children: React.ReactNode; min?: Role }) {
  const auth = useAuth();
  const path = usePathname();

  let body: React.ReactNode = children;
  if (!auth.configured) {
    body = <Notice>Firebase 설정(.env.local)이 없습니다.</Notice>;
  } else if (!auth.ready) {
    body = <Notice>불러오는 중…</Notice>;
  } else if (!auth.signedIn) {
    body = (
      <Notice>
        운영자 화면입니다. 구글 계정으로 로그인해 주세요.
        <div className="mt-5">
          <Button tone="primary" onClick={() => void auth.signInWithGoogle()}>
            구글로 로그인
          </Button>
        </div>
      </Notice>
    );
  } else if (!auth.member) {
    body = (
      <Notice>
        운영자 명단에 없는 계정입니다. 소유자에게 등록을 요청해 주세요.
        <div className="mt-5">
          <Button onClick={() => void auth.signOutUser()}>다른 계정으로 로그인</Button>
        </div>
      </Notice>
    );
  } else if (!atLeast(auth.member.role, min)) {
    body = <Notice>이 화면을 볼 권한이 없습니다.</Notice>;
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-stone bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="text-[15px] font-semibold tracking-[-0.01em]">
            잼통 근거 안내
          </Link>
          <nav className="flex gap-1" aria-label="주 메뉴">
            {NAV.map((item) => {
              const active = item.href === "/" ? path === "/" || path.startsWith("/tasks") : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${active ? "bg-ink text-eggshell" : "text-smoke hover:text-ink"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {auth.member ? (
            <button
              className="ml-auto text-[12px] text-smoke hover:text-ink"
              onClick={() => void auth.signOutUser()}
              title="로그아웃"
            >
              {auth.member.name} · {auth.member.role}
            </button>
          ) : null}
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
        {body}
      </main>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md py-16 text-center text-[15px] leading-relaxed text-graphite">{children}</div>;
}
