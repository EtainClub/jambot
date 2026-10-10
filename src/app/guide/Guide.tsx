"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * 사용법 본문.
 *
 * ★ 글보다 그림이 먼저다.
 *   단계마다 휴대폰 화면 그림 한 장과 한두 줄 설명만 둔다. 그림은 실제 화면을
 *   단순화한 것이라 문구는 실제 버튼 이름(제보하기, 작업 수락, 댓글 복사, 게시 완료)과
 *   맞춰 둔다. 화면 문구를 바꾸면 여기도 같이 바꾼다.
 */

type Track = "report" | "comment";

export function Guide() {
  const [track, setTrack] = useState<Track>("report");

  // 해시는 서버에서 보이지 않으므로 그린 뒤에 읽는다.
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#comment") setTrack("comment");
      if (window.location.hash === "#report") setTrack("report");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const pick = (next: Track) => {
    setTrack(next);
    history.replaceState(null, "", `#${next}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[12px] font-semibold tracking-wide text-smoke">사용법</p>
      <h1 className="mt-2 text-[36px] font-light leading-[1.15] tracking-[-0.03em] sm:text-[44px]">
        잼통 신고 센터
        <br />
        <span className="font-semibold">이렇게 씁니다</span>
      </h1>
      <p className="mt-4 max-w-[34em] text-[15px] leading-relaxed text-graphite">
        인스타그램에서 이상한 정책 주장을 보면 알려 주세요. 운영자가 잼통 근거로 댓글을 답니다.
      </p>

      <div role="tablist" aria-label="누구의 사용법인가요" className="mt-8 grid grid-cols-2 gap-3">
        <TrackTab id="report" active={track} onPick={pick} icon="📮" title="제보하기" note="누구나 · 구글 계정만 있으면" />
        <TrackTab id="comment" active={track} onPick={pick} icon="💬" title="댓글 달기" note="운영자 · 검토자 이상" />
      </div>

      <div key={track} className="step-detail" role="tabpanel" id={`guide-${track}`} aria-labelledby={`tab-${track}`}>
        {track === "report" ? <ReportSteps /> : <CommentSteps />}
      </div>

      <Legend />
      <Install />
    </div>
  );
}

function TrackTab({
  id,
  active,
  onPick,
  icon,
  title,
  note,
}: {
  id: Track;
  active: Track;
  onPick: (t: Track) => void;
  icon: string;
  title: string;
  note: string;
}) {
  const on = active === id;
  return (
    <button
      id={`tab-${id}`}
      type="button"
      role="tab"
      aria-selected={on}
      aria-controls={`guide-${id}`}
      onClick={() => onPick(id)}
      className={`grid content-start gap-1 rounded-[20px] border-2 p-4 text-left transition-[border-color,background-color,transform] active:scale-[0.98] sm:p-5 ${
        on ? "border-ink bg-eggshell" : "border-transparent bg-taupe hover:border-stone"
      }`}
    >
      <span className="text-[30px] leading-none" aria-hidden="true">
        {icon}
      </span>
      <span className="mt-1 text-[17px] font-semibold">{title}</span>
      <span className="text-[12px] text-smoke">{note}</span>
    </button>
  );
}

/* ───────────── 단계 ───────────── */

function Steps({ title, sub, children }: { title: string; sub: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[24px] font-light tracking-[-0.02em]">{title}</h2>
      <p className="mt-1 text-[14px] text-smoke">{sub}</p>
      <ol className="mt-8 grid gap-14">{children}</ol>
    </section>
  );
}

function Step({ n, title, children, tip, warn, phone }: { n: number; title: React.ReactNode; children: React.ReactNode; tip?: React.ReactNode; warn?: boolean; phone: React.ReactNode }) {
  return (
    <li className="grid items-center justify-items-center gap-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:justify-items-stretch sm:gap-8">
      {phone}
      <div className="min-w-0 justify-self-stretch">
        <span className="inline-grid h-8 w-8 place-items-center rounded-full bg-ink text-[14px] font-semibold text-eggshell tabular">{n}</span>
        <h3 className="mt-3 text-[22px] font-semibold leading-snug tracking-[-0.02em] [text-wrap:balance]">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-graphite">{children}</p>
        {tip ? <p className={`mt-2 text-[13px] leading-relaxed ${warn ? "font-semibold text-burgundy" : "text-smoke"}`}>{tip}</p> : null}
      </div>
    </li>
  );
}

function ReportSteps() {
  return (
    <Steps title="제보는 다섯 단계" sub="1분이면 끝납니다.">
      <Step
        n={1}
        title="게시물 링크를 복사해요"
        tip="안드로이드에서 앱을 설치했다면 공유 목록에서 바로 '잼통 신고 센터'를 고를 수 있어요."
        phone={
          <Phone bar={<><span>instagram</span><span>···</span></>}>
            <Body>
              <IgHead />
              <Photo>정책 주장이 담긴 게시물</Photo>
            </Body>
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute inset-x-0 bottom-0 grid gap-1 rounded-t-2xl bg-eggshell px-3 pb-4 pt-2.5 shadow-[0_-8px_24px_-10px_rgba(0,0,0,.35)]">
              <div className="mx-auto mb-1.5 h-1 w-9 rounded bg-stone" />
              <SheetRow icon="↗">공유</SheetRow>
              <SheetRow icon="🔗" hi tap>링크 복사</SheetRow>
              <SheetRow icon="★">저장</SheetRow>
            </div>
          </Phone>
        }
      >
        인스타그램 게시물의 <b>공유</b>(또는 <b>···</b>) → <b>링크 복사</b>.
      </Step>

      <Step
        n={2}
        title={<>아래 <b>제보</b> 탭을 눌러요</>}
        tip="연결해 두면 내 제보와 처리 결과가 계속 남아요."
        phone={
          <Phone bar={<span>잼통 신고 센터</span>} tabs={["홈", "제보", "MY"]} on={1}>
            <Body className="items-center justify-center gap-3 text-center">
              <span className="text-[30px]">🔒</span>
              <span className="text-[12px] font-semibold">제보하려면<br />구글 계정을 연결하세요</span>
              <MiniButton tap className="flex w-full items-center justify-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[conic-gradient(#4285f4_0_25%,#34a853_0_50%,#fbbc05_0_75%,#ea4335_0)]" />
                구글 계정 연결
              </MiniButton>
            </Body>
          </Phone>
        }
      >
        처음 한 번만 구글 계정을 연결합니다. 둘러보기는 연결 없이도 돼요.
      </Step>

      <Step
        n={3}
        title="주소를 붙여넣고, 화면을 찍어 올려요"
        tip="스크린샷은 꼭 올려 주세요. 게시물 글을 사진에서 읽어요. 글자가 잘 보이게, 최대 4장."
        phone={
          <Phone bar={<span>정책 주장 제보</span>} tabs={["홈", "제보", "MY"]} on={1}>
            <Body>
              <Label>인스타그램 게시물 주소 *</Label>
              <Field filled tap>https://www.instagram.com/p/DeOdr8…</Field>
              <span className="text-[9.5px] font-semibold text-navy">✓ 게시물 주소를 확인했습니다</span>
              <Label>스크린샷 2 / 4장</Label>
              <div className="grid grid-cols-4 gap-1">
                {[true, true, false, false].map((f, i) => (
                  <div key={i} className={`aspect-square rounded ${f ? "bg-stone" : "border border-dashed border-ash"}`} />
                ))}
              </div>
              <Label>어느 주장이 의심스러운가요? (선택)</Label>
              <Field filled>계란을 3만 9천원에 사 왔다</Field>
            </Body>
          </Phone>
        }
      >
        주소 칸에 붙여넣으면 <b className="text-navy">✓</b> 표시가 떠요.
      </Step>

      <Step
        n={4}
        title={<><b>제보하기</b>를 누르면 끝</>}
        tip="누가 먼저 제보한 게시물이면 하나로 합쳐져요. 그래도 괜찮아요."
        phone={
          <Phone bar={<span>정책 주장 제보</span>} tabs={["홈", "제보", "MY"]} on={1}>
            <Body className="justify-end">
              <Lines />
              <MiniButton primary tap>제보하기</MiniButton>
              <Toast>접수했습니다. 고맙습니다.</Toast>
            </Body>
          </Phone>
        }
      >
        잼통 근거와 자동으로 맞춰 본 뒤, 사람이 한 번 더 확인해요.
      </Step>

      <Step
        n={5}
        title={<><b>MY</b> 탭에서 결과를 봐요</>}
        tip="이름 바꾸기, 로그아웃, 탈퇴도 여기서 해요."
        phone={
          <Phone bar={<span>내 기록</span>} tabs={["홈", "제보", "MY"]} on={2} tapTab>
            <Body>
              <Label>내가 한 제보</Label>
              <MiniCard>
                <div className="flex flex-wrap gap-1">
                  <Chip tone="navy">게시함</Chip>
                  <Chip tone="burgundy">맥락 누락</Chip>
                </div>
                <Lines short />
                <Comment>
                  <b className="text-ink">운영자 답변</b>
                  <br />
                  근거 안내 댓글을 달았어요. 고맙습니다!
                </Comment>
              </MiniCard>
              <MiniCard>
                <Chip tone="pending">검토 필요</Chip>
                <Lines short />
              </MiniCard>
            </Body>
          </Phone>
        }
      >
        판정, 운영자 답변, 달린 댓글이 여기 모여요.
      </Step>
    </Steps>
  );
}

function CommentSteps() {
  return (
    <>
      <Steps
        title="댓글 달기는 다섯 단계"
        sub={
          <>
            운영자(검토자·운영 관리자·관리자)에게만 <b>작업</b> 탭이 보여요.
          </>
        }
      >
        <Step
          n={1}
          title={<><b>작업</b> 탭 → <b>게시 대기</b>에서 하나 골라요</>}
          phone={
            <Phone bar={<span>작업</span>} tabs={["홈", "작업", "제보", "공백", "MY"]} on={1}>
              <Body>
                <div className="flex gap-1">
                  <Chip tone="ink" tap>게시 대기 3</Chip>
                  <Chip tone="gray">검토 필요</Chip>
                </div>
                {["사실과 다름", "맥락 누락", "과거에는 사실"].map((v) => (
                  <MiniCard key={v}>
                    <Chip tone="burgundy">{v}</Chip>
                    <Lines short />
                  </MiniCard>
                ))}
              </Body>
            </Phone>
          }
        >
          댓글 초안이 이미 만들어진 게시물들이에요.
        </Step>

        <Step
          n={2}
          title={<>판정과 근거를 읽고 <b>작업 수락</b></>}
          tip="시간이 모자라면 '30분 연장', 못 하겠으면 '반납'."
          phone={
            <Phone bar={<><span>게시물 DeOdr8…</span><Chip tone="burgundy">맥락 누락</Chip></>}>
              <Body>
                <Label>판정</Label>
                <MiniCard>
                  <Chip tone="navy">사실</Chip>
                  <Lines short />
                  <Chip tone="burgundy">맥락 누락</Chip>
                  <Lines short />
                  <span className="text-[9px] text-navy">근거 펼치기 ▾</span>
                </MiniCard>
                <MiniButton primary tap className="mt-auto">
                  작업 수락
                </MiniButton>
              </Body>
            </Phone>
          }
        >
          수락하면 <b>30분</b> 동안 내 담당이에요. 다른 사람과 겹치지 않아요.
        </Step>

        <Step
          n={3}
          title={<>필요하면 다듬고, <b>댓글 복사</b></>}
          tip={'출처("○○에 따르면")와 근거 링크는 지우지 마세요.'}
          phone={
            <Phone bar={<><span>댓글</span><span className="font-normal text-smoke">248자</span></>}>
              <Body>
                <Comment>
                  <b className="text-ink">[잼통 근거 안내]</b>
                  <br />
                  김용태 국민의힘 의원실에 따르면 브라질산 계란의 수입 원가는 한 판 약 3만 9,000원입니다. 다만 …
                  <br />
                  <br />
                  근거: https://jamtong.kr/wiki/…
                </Comment>
                <div className="flex gap-1.5">
                  <MiniButton className="flex-1">저장</MiniButton>
                  <MiniButton primary tap className="flex-1">
                    댓글 복사
                  </MiniButton>
                </div>
                <Toast>복사했습니다</Toast>
              </Body>
            </Phone>
          }
        >
          고쳤다면 먼저 <b>저장</b>을 눌러요.
        </Step>

        <Step
          n={4}
          title="인스타그램에서 붙여넣고 게시"
          tip="본인 인스타그램 계정으로 직접 달아요. 앱이 대신 달지 않아요."
          phone={
            <Phone bar={<><span>instagram</span><span>···</span></>}>
              <Body>
                <IgHead />
                <Photo />
                <span className="text-[13px]">♡ 💬 ↗</span>
              </Body>
              <div className="flex items-center gap-1.5 border-t border-stone px-3 pb-2.5 pt-2 text-[10px]">
                <span className="min-w-0 flex-1 truncate rounded-full border border-stone px-2.5 py-1.5">[잼통 근거 안내] 김용태 국민…</span>
                <span className="relative font-semibold text-[#c13584]">
                  게시
                  <Tap />
                </span>
              </div>
            </Phone>
          }
        >
          작업 화면 맨 위 <b>게시물 제목</b>을 누르면 그 게시물이 열려요. 댓글 칸을 길게 눌러 <b>붙여넣기</b> → <b>게시</b>.
        </Step>

        <Step
          n={5}
          title={<>주소를 넣고 <b>게시 완료</b></>}
          tip="복사만 하고 끝내면 기록되지 않아요. 꼭 눌러 주세요."
          warn
          phone={
            <Phone bar={<><span>게시물 DeOdr8…</span><Chip tone="navy">게시함</Chip></>}>
              <Body>
                <span className="text-[9.5px] leading-snug text-graphite">
                  인스타그램에 실제로 댓글을 단 뒤, 그 댓글(또는 게시물) 주소를 넣고 게시 완료를 누르세요.
                </span>
                <Field filled>https://www.instagram.com/p/DeOdr8…</Field>
                <MiniButton primary tap>게시 완료</MiniButton>
                <Toast>홈 화면 기록에 올라가요</Toast>
              </Body>
            </Phone>
          }
        >
          방금 단 댓글의 링크(없으면 게시물 링크)를 붙여넣어요.
        </Step>
      </Steps>

      <div className="mt-12 grid gap-2.5">
        <Rule icon="✉️" title="제보자에게 답변">
          작업 화면 아래 칸에 쓰면 제보한 사람의 MY에 보여요. 운영자 이름은 안 보여요.
        </Rule>
        <Rule icon="⏭️" title="건너뛰기">
          이미 정정됐거나 중복이면 이유를 적고 건너뛰어요.
        </Rule>
        <Rule icon="🕳️" title="공백 탭">
          잼통에 근거가 없는 주제가 모여요. 잼통에 자료가 채워지면 자동으로 다시 판정해요.
        </Rule>
      </div>
      <Link href="/queue" className="ui-button mt-6 inline-block text-[13px] font-semibold underline underline-offset-4">
        작업 큐 열기 <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}

/* ───────────── 판정 색 · 설치 ───────────── */

function Legend() {
  const rows: { chips: string[]; tone: ChipTone; text: string }[] = [
    { chips: ["사실과 다름", "맥락 누락", "과거에는 사실"], tone: "burgundy", text: "댓글로 바로잡을 게시물이에요." },
    { chips: ["사실"], tone: "navy", text: "게시물 말이 근거와 맞아요. 댓글이 필요 없어요." },
    { chips: ["근거 불충분", "검토 필요"], tone: "pending", text: "사람이 한 번 더 봐야 해요." },
    { chips: ["의견·해석", "잼통 범위 밖"], tone: "gray", text: "사실 확인 대상이 아니거나, 잼통 자료를 기다려요." },
  ];
  return (
    <section className="mt-16 border-t border-stone pt-8" aria-labelledby="legend-heading">
      <h2 id="legend-heading" className="text-[24px] font-light tracking-[-0.02em]">
        색깔 보는 법
      </h2>
      <p className="mt-1 text-[14px] text-smoke">판정 표시는 색으로 구분해요.</p>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.text} className="grid content-start gap-2 rounded-[14px] bg-taupe p-4">
            <div className="flex flex-wrap gap-1">
              {r.chips.map((c) => (
                <Chip key={c} tone={r.tone} big>
                  {c}
                </Chip>
              ))}
            </div>
            <p className="text-[14px] text-graphite">{r.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Install() {
  return (
    <section className="mt-16 border-t border-stone pt-8" aria-labelledby="install-heading">
      <h2 id="install-heading" className="text-[24px] font-light tracking-[-0.02em]">
        앱처럼 설치하기
      </h2>
      <p className="mt-1 text-[14px] text-smoke">한 번 해 두면 홈 화면에서 바로 열려요.</p>
      <div className="mt-5 grid gap-2.5">
        <Rule icon="🤖" title="안드로이드 (크롬)">
          오른쪽 위 ⋮ → <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>.
        </Rule>
        <Rule icon="🍎" title="아이폰 (사파리)">
          아래 공유 버튼 □↑ → <b>홈 화면에 추가</b>.
        </Rule>
      </div>
      <p className="mt-10 text-[12px] text-smoke">
        <Link href="/privacy" className="underline underline-offset-2">
          개인정보 처리방침
        </Link>
      </p>
    </section>
  );
}

function Rule({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3 rounded-[14px] bg-taupe p-4">
      <span className="text-center text-[26px] leading-tight" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong className="block text-[15px]">{title}</strong>
        <span className="text-[14px] text-graphite">{children}</span>
      </div>
    </div>
  );
}

/* ───────────── 휴대폰 그림 조각 ───────────── */

function Phone({ bar, tabs, on, tapTab, children }: { bar: React.ReactNode; tabs?: string[]; on?: number; tapTab?: boolean; children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="aspect-[9/17] w-[220px] max-w-full shrink-0 rounded-[30px] bg-[#1b1a19] p-[9px] shadow-[0_18px_40px_-18px_rgba(0,0,0,.35)]">
      <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] bg-white text-[11px] text-ink">
        <div className="flex items-center justify-between gap-1.5 border-b border-stone px-3 pb-2 pt-2.5 text-[12px] font-semibold">{bar}</div>
        {children}
        {tabs ? (
          <div className="grid border-t border-stone px-1 pb-2 pt-1.5 text-center text-[9px] text-smoke" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((t, i) => (
              <span key={t} className={`relative grid justify-items-center gap-0.5 ${i === on ? "font-semibold text-ink" : ""}`}>
                <i className={`block h-4 w-4 rounded-[5px] border-[1.5px] border-current ${i === on ? "bg-ink" : ""}`} />
                {t}
                {tapTab && i === on ? <Tap /> : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Body({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`flex min-h-0 flex-1 flex-col gap-2 px-3 py-2.5 ${className}`}>{children}</div>;
}

function IgHead() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold">
      <span className="h-5 w-5 rounded-full bg-[linear-gradient(45deg,#f58529,#c13584,#515bd4)]" />
      어느_계정
    </div>
  );
}

function Photo({ children }: { children?: React.ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center rounded-md bg-[linear-gradient(135deg,var(--taupe),var(--stone))] p-2 text-center text-[10px] text-smoke">
      <div>
        <b className="mb-0.5 block text-[15px] text-graphite">
          &quot;계란 한 판
          <br />
          3만 9천원!&quot;
        </b>
        {children}
      </div>
    </div>
  );
}

function SheetRow({ icon, hi, tap, children }: { icon: string; hi?: boolean; tap?: boolean; children: React.ReactNode }) {
  return (
    <div className={`relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${hi ? "bg-navy-tint font-semibold text-navy" : ""}`}>
      <span className={`grid h-[18px] w-[18px] place-items-center rounded-md text-[10px] ${hi ? "bg-navy text-eggshell" : "bg-taupe"}`}>{icon}</span>
      {children}
      {tap ? <Tap /> : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="-mb-1 text-[9.5px] font-semibold text-graphite">{children}</span>;
}

function Field({ filled, tap, children }: { filled?: boolean; tap?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className={`truncate rounded-md border border-stone bg-eggshell px-2 py-1.5 text-[10px] ${filled ? "text-ink" : "text-smoke"}`}>{children}</div>
      {tap ? <Tap /> : null}
    </div>
  );
}

function MiniButton({ primary, tap, className = "", children }: { primary?: boolean; tap?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative rounded-full border px-2.5 py-2 text-center text-[11px] font-semibold ${primary ? "border-ink bg-ink text-eggshell" : "border-stone bg-eggshell"} ${className}`}>
      {children}
      {tap ? <Tap /> : null}
    </div>
  );
}

function MiniCard({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-1.5 rounded-[10px] border border-stone bg-eggshell p-2">{children}</div>;
}

function Lines({ short }: { short?: boolean }) {
  return (
    <div className="grid gap-1">
      <i className="block h-[5px] rounded bg-stone" />
      <i className="block h-[5px] w-[85%] rounded bg-stone" />
      {short ? null : <i className="block h-[5px] w-[60%] rounded bg-stone" />}
    </div>
  );
}

function Comment({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-stone bg-eggshell p-2 text-[9.5px] leading-[1.45] text-graphite">{children}</div>;
}

function Toast({ children }: { children: React.ReactNode }) {
  return <span className="self-center rounded-full bg-ink px-3 py-1 text-center text-[10px] font-semibold text-eggshell">{children}</span>;
}

type ChipTone = "burgundy" | "navy" | "pending" | "gray" | "ink";
const CHIP: Record<ChipTone, string> = {
  burgundy: "bg-burgundy-tint text-burgundy",
  navy: "bg-navy-tint text-navy",
  pending: "bg-pending-tint text-pending",
  gray: "bg-taupe text-graphite",
  ink: "bg-ink text-eggshell",
};

function Chip({ tone, big, tap, children }: { tone: ChipTone; big?: boolean; tap?: boolean; children: React.ReactNode }) {
  return (
    <span className={`relative inline-block w-fit whitespace-nowrap rounded-full font-semibold ${big ? "px-2.5 py-0.5 text-[13px]" : "px-1.5 py-px text-[9px]"} ${CHIP[tone]}`}>
      {children}
      {tap ? <Tap /> : null}
    </span>
  );
}

/** 누를 자리. 감싼 요소(relative)의 한가운데에 겹친다. 깜빡임은 globals.css의 guide-tap이 맡고, 움직임 줄이기 설정이면 멈춘다. */
function Tap() {
  return <span className="guide-tap pointer-events-none absolute left-1/2 top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#c13584]" />;
}
