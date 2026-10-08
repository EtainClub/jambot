"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/firebase/auth";

import { navFor } from "./nav";

/**
 * 하단 탭 바 (모바일).
 *
 * 이 앱은 주로 휴대폰에서 쓴다. 인스타그램을 보다가 공유로 넘어오고, 운영자는
 * 댓글을 복사해 인스타그램 앱으로 돌아간다. 그래서 주 이동은 엄지가 닿는 하단에 둔다.
 * 넓은 화면(sm 이상)에서는 감추고 상단 메뉴를 쓴다.
 *
 * 잼통 BottomNav와 같은 모양이다 — sticky, 헤어라인 위 테두리, 홈 인디케이터 여백,
 * 활성 탭만 navy.
 */
export function BottomNav() {
  const path = usePathname();
  const { member } = useAuth();
  const items = navFor(Boolean(member));

  return (
    <nav
      aria-label="주 메뉴"
      className="sticky bottom-0 z-40 border-t border-stone bg-canvas/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-[560px] items-stretch">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  active ? "text-navy" : "text-ash hover:text-smoke"
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
