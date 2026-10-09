"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/firebase/auth";
import { atLeast, ROLE_LABEL, type OperatorRole } from "@/lib/tasks/transitions";

import { BottomNav } from "./BottomNav";
import { navFor } from "./nav";
import { Button } from "./ui";
import logo from "../../public/brand/jamtong-report-logo.png";

/**
 * 상단 바와 접근 확인.
 *
 * access
 *   "public"  누구나. 익명 계정으로 둘러본다
 *   "google"  구글을 연결해야 한다. 아니면 연결 버튼을 보여 준다
 *   OperatorRole  운영자. 그 역할 이상이어야 한다
 */
export function Shell({
  children,
  access = "public",
}: {
  children: React.ReactNode;
  access?: "public" | "google" | OperatorRole;
}) {
  const auth = useAuth();
  const path = usePathname();
  const nav = navFor(Boolean(auth.member));

  let body: React.ReactNode = children;
  if (access !== "public") {
    if (!auth.configured) {
      body = <Notice>Firebase 설정(.env.local)이 없습니다.</Notice>;
    } else if (!auth.ready) {
      body = <Notice>불러오는 중…</Notice>;
    } else if (!auth.google) {
      body = (
        <Notice>
          {access === "google"
            ? "이 화면은 구글 계정을 연결해야 쓸 수 있습니다. 연결하면 제보와 처리 결과가 내 기록에 남습니다."
            : "운영자 화면입니다. 구글 계정을 연결해 주세요."}
          <div className="mt-5">
            <LinkButton />
          </div>
        </Notice>
      );
    } else if (access !== "google" && (!auth.member || !atLeast(auth.member.role, access))) {
      body = <Notice>이 화면을 볼 권한이 없습니다. 운영에 참여하려면 관리자에게 요청해 주세요.</Notice>;
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-stone bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-4">
            <Image
              src={logo}
              alt="잼통 신고 센터"
              className="h-auto w-[160px] sm:w-[180px]"
              sizes="(min-width: 640px) 180px, 160px"
              loading="eager"
            />
          </Link>
          {/* 넓은 화면에서만. 휴대폰에서는 하단 탭 바가 같은 일을 한다. */}
          <nav className="hidden gap-1 sm:flex" aria-label="상단 메뉴">
            {nav.map((item) => {
              const active = item.match(path);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`ui-button rounded-full px-3 py-1.5 text-[13px] font-semibold ${active ? "bg-ink text-eggshell" : "text-smoke hover:text-ink"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            {!auth.ready ? null : auth.google ? (
              <Link href="/my" className="text-[12px] text-smoke hover:text-ink">
                {auth.me?.profile?.displayName ?? "내 계정"}
                {auth.member ? ` · ${ROLE_LABEL[auth.member.role]}` : ""}
              </Link>
            ) : (
              <span className="text-[12px] text-ash">둘러보는 중</span>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
        <div key={path} className="page-enter">{body}</div>
      </main>
      <BottomNav />
    </>
  );
}

export function LinkButton({ label = "구글 계정 연결" }: { label?: string }) {
  const { linkGoogle } = useAuth();
  return (
    <Button tone="primary" onClick={() => void linkGoogle().catch((e) => alert(e instanceof Error ? e.message : String(e)))}>
      {label}
    </Button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md py-16 text-center text-[15px] leading-relaxed text-graphite">{children}</div>;
}
