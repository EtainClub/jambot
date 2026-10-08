/**
 * 메뉴 구성. 상단 바(데스크톱)와 하단 탭 바(모바일)가 같은 목록을 쓴다.
 *
 * 순서는 엄지가 자주 가는 순이다.
 *   누구나   홈 · 제보 · MY
 *   운영자   홈 · 작업 · 제보 · 공백 · MY  — 운영자가 가장 자주 여는 것은 작업이라 둘째에 둔다
 *
 * 다섯을 넘기지 않는다. 모바일 하단 탭은 다섯이 엄지로 가를 수 있는 한계다.
 */

export interface NavItem {
  href: string;
  label: string;
  /** 하단 탭에 쓰는 짧은 이름. */
  short: string;
  icon: React.ReactNode;
  memberOnly: boolean;
  match: (path: string) => boolean;
}

export const NAV: NavItem[] = [
  { href: "/", label: "공개 기록", short: "홈", icon: <HomeIcon />, memberOnly: false, match: (p) => p === "/" },
  {
    href: "/queue",
    label: "작업",
    short: "작업",
    icon: <QueueIcon />,
    memberOnly: true,
    match: (p) => p.startsWith("/queue") || p.startsWith("/tasks"),
  },
  { href: "/report", label: "제보", short: "제보", icon: <ReportIcon />, memberOnly: false, match: (p) => p.startsWith("/report") },
  { href: "/gaps", label: "자료 공백", short: "공백", icon: <GapIcon />, memberOnly: true, match: (p) => p.startsWith("/gaps") },
  { href: "/my", label: "내 기록", short: "MY", icon: <MyIcon />, memberOnly: false, match: (p) => p.startsWith("/my") },
];

export function navFor(member: boolean): NavItem[] {
  return NAV.filter((item) => member || !item.memberOnly);
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

/** 쌓인 카드. 처리할 일이 줄을 서 있다는 뜻이다. */
function QueueIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M6.5 5h11M9 2.5h6" />
    </svg>
  );
}

/** 말풍선에 더하기. 내가 하나를 보탠다는 뜻이다. */
function ReportIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M12 7v6M9 10h6" />
    </svg>
  );
}

/** 빈칸이 있는 책. 잼통에 아직 없는 자료다. */
function GapIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2z" />
      <path d="M12 6.5v13" strokeDasharray="2 2.5" />
    </svg>
  );
}

function MyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  );
}
