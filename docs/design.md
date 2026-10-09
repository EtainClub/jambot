# 잼통 신고 센터 (insta-factbot) — MVP 설계

설계 기준일: 2026-10-08
기준 자료: `~/devel-src/jamtong` v0.33.0
이전 버전: `docs/initial_mvp.md`

인스타그램에 올라온 정부 정책 관련 주장을 잼통의 근거 자료와 대조하고, 여러 운영자가
나눠서 근거 안내 댓글을 직접 게시하는 협업 웹앱이다.

---

## 0. 원칙

1. **판정의 근거는 잼통뿐이다.** 잼통에 근거가 없는 주장은 판정하지 않는다.
   AI가 웹 검색이나 사전 지식으로 정부 정책의 사실 여부를 정하는 경로는 두지 않는다.
2. **부족한 자료는 잼통에 등록한다.** 판정할 수 없는 주장은 "자료 공백"으로 모아
   잼통의 편집 절차(draft → 검증 → published)를 거쳐 등록한다. 등록된 뒤 다시 판정한다.
   이 앱은 잼통 콘텐츠를 직접 고치지 않는다.
3. **모델은 근거를 만들지 않고 고른다.** 판정은 반드시 잼통 앵커를 인용하고,
   서버가 앵커의 실재를 검사한다. 앵커가 없는 판정은 저장되지 않는다
   (잼통 `src/lib/agent/grounding.ts`, `AGENTS.md` 앵커 규칙과 같은 방식).
4. **주장의 성격을 물려받는다.** 근거 claim의 `assertionType`이 `CLAIM`이면 댓글도
   "○○에 따르면"으로 쓰고, `INTERPRETATION`·`OPINION`을 사실처럼 단정하지 않는다.
5. **사람이 게시한다.** 댓글은 운영자가 직접 단다. Instagram API는 남의 게시물에
   댓글을 달 수 없으므로 이것은 MVP의 선택이 아니라 원래 제약이다.
6. **출처를 밝힌다.** 댓글은 "잼통 근거 안내"임을 드러내는 형식으로 쓴다.
   정부에 유리한 쪽으로 틀린 주장도 똑같이 바로잡는다.

---

## 1. 시스템 구성

```
┌──────────────── jamtong (기존, 공개 사이트) ────────────────┐
│ src/content/achievements · words · milestones · sources   │
│        │  pnpm build 시                                   │
│        ▼                                                  │
│ /factbase.json  (앵커 단위 근거 묶음 + 버전)                  │
│ /api/version    (기존)                                     │
└──────────────────────────┬────────────────────────────────┘
                           │ 읽기 전용 (HTTP)
┌──────────────────────────▼─────── insta-factbot (신규) ─────┐
│ Next.js 웹앱 (운영자 PWA)                                    │
│  ├ 제보 접수 / 작업 큐 / 판정 검토 / 댓글 편집 / 공백 목록        │
│ 백그라운드 작업 (Cloud Scheduler → Cloud Run Job)             │
│  ├ 수집: 계정 모니터링(B), 해시태그(A)                         │
│  ├ 판정: 1차 선별 → OCR → 근거 대조                           │
│  └ factbase 갱신 감지 → 공백 대기 작업 재판정                   │
│ Firebase (별도 프로젝트): Auth · Firestore · Storage · FCM   │
└─────────────────────────────────────────────────────────────┘
```

### 왜 분리하는가

- 잼통 `firestore.rules`는 "그 밖의 모든 것은 닫는다"가 기본이다. 운영 컬렉션 여러 개와
  미인증 제보, 역할 권한을 섞으면 공개 사이트의 규칙면이 커진다.
- 잼통의 App Hosting 설정(`minInstances: 0`, `maxInstances: 4`)과 `guard.ts`의
  메모리 기반 요청 제한은 공개 AI 안내에 맞춘 것이다. 스케줄 작업과 제보 창구에는 맞지 않는다.
- 배포 주기와 비밀값(Meta 토큰 등)을 분리한다.

### 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 웹앱 | Next.js 16 / React 19 / TypeScript / Zod 4 / Tailwind 4 | 잼통과 같은 버전대 |
| 인증 | Firebase Auth (Google 로그인) | 별도 Firebase 프로젝트 |
| DB | Firestore | |
| 파일 | Cloud Storage | 스크린샷, 게시물 이미지 |
| 알림 | FCM Web Push | iOS는 홈 화면 설치 시에만 동작 |
| 배치 | Cloud Scheduler → Cloud Run Job | OIDC 인증, App Hosting에 의존하지 않음 |
| 모델 | 선별: `claude-haiku-5-5` / 판정: `claude-sonnet-5-5` | 환경변수 `TRIAGE_MODEL`, `CHECK_MODEL` |
| 요청 제한 | Firestore 카운터 | 인스턴스가 여럿이어도 한도가 맞도록 |

---

## 2. 잼통 쪽 변경 (최소)

잼통에는 **내보내기 하나만** 추가한다. 이 앱이 잼통에 요구하는 것은 이것뿐이다.

### 2.1 `scripts/export-factbase.ts` → `public/factbase.json`

빌드 때 생성한다. 공개 콘텐츠만 담으므로 공개 파일로 둬도 된다.

```ts
type Factbase = {
  version: string;          // package.json version (예: "0.33.0")
  builtAt: string;          // ISO
  entries: FactEntry[];
};

type FactEntry = {
  anchor: string;           // "judicial-reform#claim-distort" | "words:vote#p2" | "source:<id>" ...
  kind: "achievement" | "claim" | "words" | "words-point" | "milestone" | "source";
  title: string;
  text: string;             // claim 문장, 언행 원문 토막, 카드 요약
  assertionType?: "FACT" | "CLAIM" | "INTERPRETATION" | "OPINION";
  assertedBy?: string;
  status?: "done" | "ongoing" | "planned";   // milestone
  date?: string;            // 근거 시점 (source.publishedAt, 카드 date, 언행 날짜)
  sourceIds?: string[];
  sources?: { id: string; title: string; publisher: string; url?: string; publishedAt?: string; license: string }[];
  url: string;              // jamtong.kr 상의 표시 위치
  categories: string[];
  keywords: string[];       // 검색용
};
```

포함 범위:

| 대상 | 위치 | 비고 |
|---|---|---|
| 공개 업적과 그 claim | `getPublishedAchievements()` | draft 제외. 2026-10-08 기준 23건 |
| 언행 | `src/content/words` | 원문 그대로. "그런 말 했다/안 했다" 유형에 가장 강함 |
| 성과 카드 | `src/content/milestones` | `planned`를 완료로 쓰지 않도록 status 포함 |
| 1차 자료 | `src/content/sources.ts` | |

규칙:
- `pnpm check`에 export 검증을 추가한다. 앵커가 `wiki:lint`의 다섯 형식과 같은 규칙으로 실재하는지 검사한다.
- 개별 `claim`에는 날짜가 없다. `date`는 근거 source의 `publishedAt`에서 가져오고, 없으면 비운다.
  날짜가 없는 근거로는 `outdated`(과거에는 사실) 판정을 내리지 않는다.
- 공개 업적에는 `verified: false` claim이 없다(`validateAchievement`가 빌드를 막음).
  따라서 주의할 것은 검증 여부가 아니라 `assertionType`이다.

### 2.2 자료 공백 등록 경로

이 앱이 만든 공백 리포트를 잼통 저장소의 GitHub 이슈로 올린다(라벨 `factbot-gap`).
잼통 편집자(또는 잼통을 연 에이전트)가 기존 절차대로 업적, 언행, 성과 카드를 만든다.
이 앱은 잼통 파일을 쓰지 않는다.

### 2.3 현재 잼통의 범위

공개 업적 23건 중 약 13건은 성남시·경기도 시절이고, 정부 정책은 약 10건이다
(검찰·사법개혁, 철도 통합, 원유 공급, 자원외교, 핵잠수함, 북극항로, 증시, 청년미래적금, 멕시코 방문).
연금, 부동산, 각종 지원금은 근거가 거의 없다. 초기에는 공백 리포트가 많이 쌓이는 것이 정상이며,
그것이 잼통 콘텐츠의 우선순위 자료가 된다.

---

## 3. 수집 경로

세 경로 모두 같은 `fc_posts`로 모이고, 게시물 shortcode로 중복을 막는다.
구현 순서는 **C → B → A**다.

### C. 제보 (1순위)

- 입력: 인스타그램 URL(필수), 검증할 주장(선택), 스크린샷(선택, 최대 4장), 메모.
- 같은 shortcode로 들어온 제보는 기존 게시물에 병합하고 제보 수만 올린다.
- PWA `share_target`은 보조 수단이다. 기본 경로는 URL 붙여넣기다.
- 미인증 제보: App Check, IP·전체 일일 한도(Firestore 카운터), 길이 제한, URL 형식 검사.
- 본문 확보: Instagram oEmbed 또는 Graph API로 캡션을 받고, 실패하면 스크린샷 OCR로
  대신한다. 둘 다 실패하면 `no_content`로 둔다.

### B. 지정 계정 모니터링 (2순위)

- Business Discovery로 공개 비즈니스·크리에이터 계정의 최근 미디어를 조회한다.
- 기본 3시간 주기, 계정 10개 이내로 시작한다.
- 접근에 실패하면 `fc_sources`에 오류 상태를 기록하고 운영자에게 알린다.
- 팔로워 수는 우선순위 참고용으로만 쓴다. 계정의 정치 성향은 판정 입력에 넣지 않는다.

### A. 해시태그 탐색 (3순위)

- `recent_media`는 최근 24시간 게시물만 주고 작성자 정보가 없다. 수확이 적으므로 마지막에 만든다.
- 해시태그는 **잼통이 다루는 주제에서 시작한다.** 예: `#검찰개혁 #사법개혁 #청년미래적금 #KTX통합`.
  `#연금 #부동산정책 #지원금`처럼 근거가 없는 영역은 잼통에 자료가 등록된 뒤에 켠다.
- 7일 동안 서로 다른 해시태그 30개 한도를 관리한다(`fc_config.hashtagWindow`).
- 2시간 주기, 해시태그당 50건 처리는 앱 내부의 비용 상한이다.

> Meta API의 권한, 반환 필드, 한도는 실제 앱 등록 후 다시 확인해야 한다(미검증 가정).

---

## 4. 판정 파이프라인

```
fc_posts 등록
  │
  ├─ ① 본문 확보: 캡션 + 이미지 OCR(비전 모델). 릴스 음성은 MVP에서 제외
  │     └ 확보 실패 → no_content (판정하지 않음)
  │
  ├─ ② 1차 선별 (TRIAGE_MODEL): 정책 관련 사실 주장이 있는가 → 없으면 종료
  │     └ 주장 문장을 1~3개 추출
  │
  ├─ ③ 후보 검색: factbase에서 키워드·카테고리로 근거 후보 최대 30개
  │
  ├─ ④ 판정 (CHECK_MODEL): 후보 앵커 목록 안에서만 고른다
  │     출력 = { verdict, anchors[], reasoning, draftComment }
  │
  ├─ ⑤ 서버 검증
  │     · anchors가 전부 factbase에 있는가
  │     · accurate/false/missing_context/outdated 판정에 앵커가 1개 이상인가
  │     · CLAIM 근거를 단정문으로 썼는가 (assertedBy 표기 검사)
  │     · draftComment 안의 URL은 서버가 앵커에서 생성한 것뿐인가
  │     └ 실패 → 1회 재시도, 다시 실패하면 needs_review
  │
  └─ ⑥ 범위 밖 → fc_gaps 적재, 작업은 waiting_for_content
```

### 판정 종류

| 판정 | 조건 | 댓글 |
|---|---|---|
| `accurate` 사실 | 근거와 일치 | 없음 |
| `false` 사실과 다름 | 근거와 정면으로 어긋남 | 근거 링크와 함께 정정 |
| `missing_context` 맥락 누락 | 조건·대상·시점이 빠짐 | 빠진 조건 설명 |
| `outdated` 과거에는 사실 | 날짜 있는 근거로 변경이 확인됨 | 변경 시점 안내 |
| `opinion` 의견·해석 | 사실 주장이 아님 | 없음 |
| `insufficient` 근거 불충분 | 근거는 있으나 판정하기에 모자람 | 없음, 운영자 검토 |
| `out_of_scope` 잼통 범위 밖 | 관련 근거 없음 | 없음, **공백 등록** |

### 댓글 형식

- 첫 줄에 "잼통 근거 안내"임을 밝힌다.
- 사람이 아니라 주장에 대해 쓴다. 게시자의 의도나 성향을 언급하지 않는다.
- 근거 링크는 1~2개만 붙인다(`jamtong.kr/achievement/<slug>` 등, 서버가 생성).
- 300자 이내.

---

## 5. 자료 공백 → 잼통 등록 흐름

```
out_of_scope 판정
  → fc_gaps 에 주제별로 묶어 적재 (같은 주제는 count 증가, 예시 게시물 누적)
  → 운영자가 공백 목록에서 "잼통에 요청" (count 상위부터)
  → GitHub 이슈 생성: jamtong repo, 라벨 factbot-gap
       본문: 주장 원문 예시, 등장 빈도, 관련 공식 자료 후보 URL(운영자가 붙인 것), 게시물 링크
  → 잼통 편집 절차로 업적·언행·카드 작성, 검증, 공개
  → 잼통 배포 → /api/version 변경
  → factbot 이 버전 변경을 감지(30분 주기) → factbase 다시 받기
  → waiting_for_content 작업 재판정 → 근거가 생기면 일반 큐로
```

- 공식 자료 URL 후보는 사람이 붙인다. 모델이 웹에서 찾아 판정에 쓰는 경로는 없다.
- 이슈가 닫혔는데도 재판정 결과가 `out_of_scope`이면 공백을 다시 연다.
- 재판정 시점에 원 게시물이 오래됐으면(기본 7일) 댓글 초안을 만들지 않고 기록만 남긴다.

---

## 6. 운영자 협업

### 역할

| 역할 | 권한 |
|---|---|
| owner | 전체 설정, 멤버 초대·해제, Meta 연결 |
| admin | 수집 설정, 작업 배정, 공백 → 잼통 요청 |
| reviewer | 판정 검토, 댓글 편집·복사, 게시 완료 처리 |
| observer | 조회만 |

`fc_members/{uid}` = `{ role, active, displayName, invitedBy, createdAt }`.
역할은 Firestore 규칙과 서버 양쪽에서 검사한다.

### 작업 상태

```
queued ──claim──▶ claimed ──▶ drafted ──▶ posted
   ▲                │  ▲          │
   │   release/만료  │  └─ edit ───┘
   └────────────────┘
queued ──▶ skipped        (사유 필수)
waiting_for_content ──재판정──▶ queued
needs_review ──admin──▶ queued | skipped
```

- 수락(claim)은 Firestore Transaction으로 처리한다. 같은 작업을 두 명이 동시에 수락할 수 없다.
- 수락 후 30분이 지나면 자동 반납한다. 담당자는 연장할 수 있다.
- **복사와 게시 완료를 구분한다.** `posted`로 바꿀 때는 실제 댓글 URL을 입력해야 한다.

### 게시 계정 정책

- 원칙은 공개된 **단일 공식 계정**에서 게시하는 것이다.
- 개인 계정을 쓰면 소속을 밝혀야 한다. 같은 게시물에 운영자 여러 명이 댓글을 달지 않는다.
- 계정별 일일 게시 상한을 둔다(`fc_config.dailyPostLimit`, 기본 20).
- 선거 기간 차단 스위치(`fc_config.electionFreeze`)를 둔다. 켜면 새 댓글 초안 생성이 멈춘다.

---

## 7. Firestore 데이터

```
fc_members/{uid}           역할, 활성 상태
fc_sources/{id}            kind: hashtag | account, 설정, 마지막 실행·오류
fc_posts/{shortcode}       원문 URL, 캡션, OCR 텍스트, 수집 경로[], 제보 수
fc_reports/{id}            제보 원본 (제보자 uid/익명, 메모, 첨부 경로)
fc_checks/{id}             postId, verdict, anchors[], reasoning, draftComment,
                           factbaseVersion, model, createdAt
fc_tasks/{postId}          status, assignee, claimedAt, expiresAt,
                           finalComment, postedUrl, history[]
fc_gaps/{topicKey}         주제, count, 예시 postIds[], 상태, githubIssueUrl
fc_config/main             주기, 한도, 해시태그 창, 선거 차단, 게시 상한
fc_counters/{key}          요청 제한 카운터
```

- 문서 id를 shortcode로 써서 **저장소 수준에서** 중복을 막는다(잼통 `cheerVideos`와 같은 방식).
- `fc_checks`는 고치지 않고 쌓는다. 재판정하면 새 문서를 만든다.
- 모든 판정에 `factbaseVersion`을 남긴다. 어느 버전의 잼통 근거로 판정했는지 추적할 수 있다.
- 기본 규칙은 전부 닫고, 필요한 경로만 이름을 적어 연다. 운영 데이터는 활성 멤버만 읽는다.

---

## 8. API

| 메서드 | 경로 | 권한 | 내용 |
|---|---|---|---|
| POST | `/api/reports` | 누구나(App Check) | 제보 접수 |
| GET | `/api/tasks` | observer+ | 큐 조회 (상태 필터) |
| POST | `/api/tasks/:id/claim` | reviewer+ | 수락 (Transaction) |
| POST | `/api/tasks/:id/release` | 담당자·admin | 반납 |
| POST | `/api/tasks/:id/extend` | 담당자 | 연장 |
| PATCH | `/api/tasks/:id/comment` | 담당자 | 댓글 수정 |
| POST | `/api/tasks/:id/posted` | 담당자 | 게시 완료 (댓글 URL 필수) |
| POST | `/api/tasks/:id/skip` | reviewer+ | 건너뜀 (사유 필수) |
| POST | `/api/checks/:postId/rerun` | admin+ | 재판정 |
| GET | `/api/gaps` | observer+ | 공백 목록 |
| POST | `/api/gaps/:key/request` | admin+ | 잼통 GitHub 이슈 생성 |
| POST | `/jobs/collect` | Scheduler(OIDC) | 수집 B·A |
| POST | `/jobs/factbase-sync` | Scheduler(OIDC) | 잼통 버전 확인, 재판정 |
| POST | `/jobs/expire-claims` | Scheduler(OIDC) | 만료된 수락 반납 |

---

## 9. 디렉터리 구조

```
insta-factbot/
  docs/design.md
  src/
    app/                  화면 (queue, task/[id], report, gaps, settings)
    app/api/              위 API
    jobs/                 collect.ts, factbase-sync.ts, expire-claims.ts
    lib/factbase/         불러오기, 캐시, 앵커 검증, 후보 검색
    lib/check/            triage.ts, ocr.ts, judge.ts, validate.ts, comment.ts
    lib/instagram/        oembed.ts, business-discovery.ts, hashtag.ts
    lib/firebase/         admin, client
    lib/github/           gap → issue
    schema/               Zod 스키마 (Firestore 문서, 모델 출력)
  firestore.rules
  scripts/check-rules.ts  규칙 테스트
```

---

## 10. 구현 순서

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 0 | 잼통 `export-factbase.ts` + `pnpm check` 연동 | `factbase.json` 생성, 앵커 검증 통과 |
| 1 | 앱 골격, Auth, `fc_members`, 규칙 | 비멤버는 아무것도 못 읽음 |
| 2 | 제보 C + 본문 확보(oEmbed / 스크린샷 OCR) | 같은 URL 제보가 병합됨 |
| 3 | 판정 파이프라인 + 서버 검증 | 앵커 없는 판정 저장 거부 |
| 4 | 작업 큐, 수락 Transaction, 게시 완료 | 동시 수락 테스트 통과 |
| 5 | 공백 목록 + GitHub 이슈 + factbase 동기화 재판정 | 잼통 배포 후 대기 작업 자동 재판정 |
| 6 | FCM 알림 | |
| 7 | 계정 모니터링 B | Meta 심사 이후 |
| 8 | 해시태그 A | Meta 심사 이후 |

---

## 11. 완료 조건

- A·B·C 어느 경로로 들어와도 같은 게시물은 문서 하나다.
- Meta 권한이 없어도 제보, 판정, 큐, 공백 흐름이 동작한다.
- 본문을 확보하지 못한 게시물은 판정하지 않는다.
- `accurate`·`false`·`missing_context`·`outdated` 판정에는 실재하는 잼통 앵커가 붙는다.
- 잼통에 근거가 없는 주장은 `out_of_scope`가 되고, 공백으로 쌓이며, 댓글 초안이 생기지 않는다.
- CLAIM 근거를 쓴 댓글에는 주장의 주체가 표기된다.
- 두 운영자가 같은 작업을 동시에 수락할 수 없다.
- 작업마다 판정, 근거 앵커, factbase 버전, 댓글 수정 내역, 담당자, 게시 URL이 남는다.
- 멤버가 아닌 사용자는 큐, 판정, 공백 목록에 접근할 수 없다.

---

## 12. 열린 항목

- Meta 앱 심사: Instagram Public Content Access, Business Discovery 권한과 실제 반환 필드 확인.
- oEmbed로 캡션을 얻을 수 있는지 실제 확인(안 되면 제보는 스크린샷 OCR이 기본 경로가 된다).
- 릴스 음성 전사 도입 여부(비용 대비 효과).
- 잼통 claim 단위 날짜 필드 추가 여부. 지금은 source 날짜로 대신하므로 `outdated` 판정이 제한된다.
- 공식 게시 계정 개설과 프로필 고지 문구.
- 다음 선거(2028년 4월 총선) 전 공직선거법 검토와 차단 기간 확정.

---

## 13. 구현 메모 (2026-10-08, MVP 1차)

설계와 달라진 점과 그 이유.

| 항목 | 설계 | 구현 | 이유 |
|---|---|---|---|
| 브라우저의 Firestore 접근 | 역할별 규칙 | **전부 닫음**, API(Admin SDK)만 | 권한 검사를 서버 한 곳에 둔다. 실시간 구독 대신 30초 폴링 |
| 작업 상태 | `drafted` 포함 | `drafted` 없음. `processing`·`no_action`·`no_content` 추가 | 수락 중 편집은 `claimed` 안에서 저장으로 충분. 판정 결과별 종착 상태가 필요 |
| 공백 적재 | `out_of_scope`만 | `insufficient`도 `gapTopic`이 있으면 적재 | 관련 근거는 있지만 모자란 것도 잼통에 채워야 풀린다 |
| 성과 카드 앵커 | — | `milestone:<id>` 신설 | 위키 앵커 다섯 형식에 카드가 없다 |
| 모델 | 선별 Haiku + 판정 Sonnet | `CHECK_MODEL` 하나(기본 `claude-opus-5-5`), 읽기는 effort low, 판정은 medium | 단계별 모델 분리는 실제 비용을 본 뒤 결정 |
| 본문 확보 | oEmbed 우선 | oEmbed는 `INSTAGRAM_OEMBED_TOKEN`이 있을 때만, 실제 응답 필드는 미검증. 기본은 스크린샷 | Meta 앱 미등록 |
| 제보만 있고 캡션·스크린샷 없음 | — | `no_content` | 제보자가 적은 주장이 게시물에 정말 있는지 모른다 |
| App Check | 미인증 제보에 적용 | **미구현**. IP·일일 한도(Firestore 카운터)만 | 다음 단계 |
| 계정별 일일 게시 상한 | `dailyPostLimit` | **미구현** | 다음 단계 |
| FCM 알림 | 6단계 | **미구현** | 다음 단계 |
| 수집 B·A | 7·8단계 | **미구현** | Meta 심사 이후 |

## 14. 사용자 계정과 내 기록 (2026-10-08, 2차)

운영자만 쓰는 도구에서, 누구나 둘러보고 구글을 연결한 사람이 제보하는 구조로 바꿨다.

- **익명으로 시작**: 처음 들어오면 익명 계정을 만든다. 공개 화면(`/`)은 게시 완료된 근거 안내 댓글만 보여 준다(`/api/public/posted`). 게시 전의 판정·초안, 운영자·제보자 정보는 내보내지 않는다.
- **제보는 구글 연결 뒤에만**: 익명 계정에 구글을 연결(`linkWithPopup`)하므로 uid가 그대로다. 그 구글 계정이 이미 있으면 연결 실패의 자격 증명으로 그 계정에 들어간다. 서버는 토큰의 `firebase.identities["google.com"]`으로 연결 여부를 본다.
- **한도**: 접속 지점(해시)과 계정 둘 다 시간당 한도를 센다.
- **내 기록(`/my`)**
  - 요약 숫자, 내가 한 제보와 처리 결과, 게시된 댓글, 운영자 답변
  - 운영자면 지금 맡은 작업·게시한 안내·건너뛴 작업
  - 내 정보: 저장된 필드 전부를 그대로 보여 주고, 이름 변경·로그아웃·탈퇴
- **처리 결과 공개 범위**(`src/lib/outcome.ts`): 단계만 알리다가, 완료되거나 자료 대기가 되면 판정을 연다. 댓글 내용과 주소는 게시 완료일 때만.
- **운영자 답변**: 작업에 `reporterReply`를 단다(검토자 이상). 그 게시물을 제보한 모든 사람의 내 기록에 보인다.
- **탈퇴**: 프로필과 로그인 계정을 지우고, 내 제보에서 `reporterUid`·`ipHash`·`memo`를 지운다. 제보 자체(게시물 주소·주장)는 다른 제보와 합쳐진 작업 기록이라 남긴다. 운영자는 해제 후에만 탈퇴할 수 있다.
- **새 컬렉션** `fc_users/{uid}`: `email`, `displayName`, `linkedAt`, `updatedAt`, `reportCount`. 이것이 사용자에 대해 저장하는 전부다.

## 15. 역할 개편 (2026-10-09)

| 역할 | 권한 | 비고 |
|---|---|---|
| `contributor` 제보자 | 제보, 내 기록 | 구글 연결 시 자동. `fc_members` 문서 없음 |
| `reviewer` 검토자 | 작업 수락, 댓글 편집·게시, 제보자 답변, 건너뛰기 | |
| `moderator` 운영 관리자 | + 남의 작업 반납, 대기열 복귀, 재판정, 자료 공백 요청 | 신설 |
| `admin` 관리자 | + 운영자 지정·해제 | 기존 owner |

- `observer`(열람자)는 없앴다. 공개 기록과 내 기록으로 충분하고, 쓰지 않는 역할은 권한 검사만 늘린다.
- `moderator`를 둔 이유: 큐를 정리하는 손은 여럿이어도 되지만 사람을 운영자로 올리는 손은 적어야 한다.
- 운영자 지정(`/members`, 관리자만): 구글을 연결한 사람 목록에서 역할을 고른다. 자기 역할은 못 바꾼다(관리자가 늘 한 명 이상 남는다). 해제는 문서를 지우지 않고 `active: false`로 둔다. 바꿀 때마다 `fc_member_log`에 남긴다.
- 이메일 초대(`fc_invites/{email}`): 아직 구글을 연결하지 않은 사람에게 역할을 미리 적어 두면, 구글이 확인한 같은 이메일로 연결할 때 반영된다.

## 16. 잼통 정부 정책 팩트 층 (2026-10-09)

잼통이 업적·언행과 별도로 **정부 정책 팩트**(`src/content/policies`, 위키 `/wiki/policy/<slug>`)를 두었다.
SNS에 도는 정책 주장과 소문을 정책 단위로 claim·출처·소문(rumors)·자료 공백(gaps)으로 정리한다.

- factbase에는 `kind: "claim"`, 앵커 `policy:<slug>#<claimId>`로 들어온다. 팩트봇 스키마는 바꾸지 않았다.
- 댓글 근거 링크는 `https://jamtong.kr/wiki/policy/<slug>`가 된다.
- 정책은 미검증 claim을 허용하므로, 잼통 factbase는 정책 claim 중 `verified: true`만 내보낸다.
  팩트봇은 받은 것을 그대로 근거로 쓰기 때문이다.
- `docs/jamtong-content-gaps.md`의 P1 다섯 주제가 모두 이 층에 있다
  (`mideast-rumors`, `oil-relief-fund`, `housing-measures`, `prosecution-launch`, `foreigner-health-vote`).
- 이후 공백 등록(`factbot-gap` 이슈)은 업적보다 정책 팩트로 받는 것이 자연스럽다. 이슈 본문은 그대로 쓸 수 있다.
