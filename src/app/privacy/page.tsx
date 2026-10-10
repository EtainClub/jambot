import type { Metadata } from "next";

import { Shell } from "@/components/Shell";
import { Heading } from "@/components/ui";

export const metadata: Metadata = { title: "개인정보 처리방침" };

const CONTACT = "etainclub@gmail.com";

/**
 * 개인정보 처리방침. 누구나 연다.
 *
 * ★ 코드와 같이 고친다. 여기 적힌 항목은 src/lib/users.ts(fc_users·탈퇴),
 *   src/app/api/reports/route.ts(fc_reports), src/lib/ratelimit.ts(fc_counters),
 *   src/lib/check/model.ts(모델에 보내는 것)와 맞아야 한다.
 */
export default function PrivacyPage() {
  return (
    <Shell>
      <Heading lede="잼통 신고 센터가 어떤 정보를 왜 모으고, 언제 지우는지 적었습니다.">개인정보 처리방침</Heading>
      <div className="max-w-[40em] space-y-8 text-[15px] leading-relaxed text-graphite">
        <Section title="1. 모으는 정보">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b className="text-ink">둘러보기</b>: 브라우저마다 만들어지는 익명 계정 번호. 이름이나 연락처는 받지 않습니다.
            </li>
            <li>
              <b className="text-ink">구글 계정 연결</b>: 구글이 알려 주는 이메일 주소와 이름, 연결한 시각, 제보 수.
            </li>
            <li>
              <b className="text-ink">제보</b>: 게시물 주소, 적어 주신 주장과 메모, 올려 주신 스크린샷, 제보한 계정과 시각.
            </li>
            <li>
              <b className="text-ink">남용 방지</b>: 접속 지점(IP)은 원래 주소로 되돌릴 수 없는 값(해시)으로만 남겨 시간당 제보 수를 셉니다.
            </li>
            <li>
              <b className="text-ink">운영자</b>: 역할과, 어떤 작업을 수락·게시·건너뛰었는지의 처리 기록.
            </li>
          </ul>
        </Section>

        <Section title="2. 쓰는 곳">
          <p>
            제보를 받아 잼통의 공개 근거와 대조하고, 처리 결과를 내 기록에서 보여 드리고, 같은 사람이 짧은 시간에 제보를 몰아 보내는 것을
            막는 데만 씁니다. 광고나 마케팅에 쓰지 않습니다.
          </p>
        </Section>

        <Section title="3. 공개되는 것">
          <p>
            공개 화면에는 운영자가 인스타그램에 실제로 게시한 근거 안내 댓글과 그 게시물 주소만 나옵니다. 누가 제보했는지, 메모와 스크린샷,
            이메일은 공개하지 않습니다.
          </p>
        </Section>

        <Section title="4. 맡기는 곳 (처리 위탁·국외 이전)">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b className="text-ink">Google (Firebase)</b> — 로그인, 데이터와 스크린샷 저장. 저장 위치는 서울(asia-northeast3) 리전입니다.
            </li>
            <li>
              <b className="text-ink">Anthropic (미국)</b> — 게시물 글, 스크린샷, 적어 주신 주장을 판정 모델(Claude)에 보내 정책 주장을
              읽고 근거와 대조합니다. 제보 때마다 인터넷으로 전송되며, 이메일·이름·메모·계정 정보는 보내지 않습니다. Anthropic은 API로 받은
              내용을 모델 학습에 쓰지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="5. 보관과 삭제">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b className="text-ink">MY → 탈퇴</b>를 누르면 프로필과 로그인 계정을 바로 지우고, 내 제보에서 제보자 연결·접속 지점 값·메모를
              지웁니다.
            </li>
            <li>
              게시물 주소, 주장, 스크린샷은 다른 사람의 제보와 합쳐진 공개 게시물 기록이라 남깁니다. 누가 보냈는지는 더 이상 알 수 없습니다.
            </li>
            <li>운영자는 운영 기록을 남겨야 해서, 관리자가 운영자에서 해제한 뒤에 탈퇴할 수 있습니다.</li>
          </ul>
        </Section>

        <Section title="6. 내 정보 보기·고치기">
          <p>
            <b className="text-ink">MY</b> 탭의 내 정보에서 저장된 항목을 모두 볼 수 있고, 이름을 바꾸거나 로그아웃·탈퇴할 수 있습니다. 그
            밖의 요청은 아래로 보내 주세요.
          </p>
        </Section>

        <Section title="7. 문의 (개인정보 보호책임자)">
          <p>
            <a href={`mailto:${CONTACT}`} className="text-navy underline underline-offset-4">
              {CONTACT}
            </a>
          </p>
        </Section>

        <p className="border-t border-stone pt-4 text-[13px] text-smoke">시행일 2026년 10월 10일</p>
      </div>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[18px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {children}
    </section>
  );
}
