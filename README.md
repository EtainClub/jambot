# 잼통 신고 센터 (insta-factbot)

인스타그램의 정부 정책 주장을 [잼통](https://jamtong.kr) 근거와 대조하고, 여러 운영자가 근거 안내 댓글을
나눠 게시하는 웹앱입니다. 설계는 `docs/design.md`, 잼통에 먼저 채울 자료는 `docs/jamtong-content-gaps.md`에 있습니다.

## 원칙

- **판정 근거는 잼통뿐입니다.** 모델은 잼통 `factbase.json`에서 뽑은 후보 안에서만 앵커를 고르고, 서버가 그 앵커를 다시 확인합니다.
- **잼통에 없으면 판정하지 않습니다.** `out_of_scope`·`insufficient`는 자료 공백으로 쌓이고, 잼통에 등록·배포되면 자동으로 다시 판정합니다.
- **사람이 게시합니다.** 댓글 복사와 게시 완료를 구분하며, 게시 완료에는 실제 댓글 주소가 필요합니다.

## 사용자 단계

| 단계 | 할 수 있는 것 |
|---|---|
| 익명 (처음 들어오면 자동) | 공개 기록 둘러보기 |
| 제보자 `contributor` (구글 연결) | 제보, 내 기록(제보·처리 결과·운영자 답변), 내 정보 관리(열람·이름 변경·탈퇴) |
| 검토자 `reviewer` | 작업 수락, 댓글 편집·게시, 제보자 답변, 건너뛰기 |
| 운영 관리자 `moderator` | + 남의 작업 반납, 대기열 복귀, 재판정, 자료 공백 요청 |
| 관리자 `admin` | + 운영자 지정·해제 (`/members`) |

제보자에게는 사람이 확인하기 전의 판정을 보여 주지 않습니다. 단계(대조 중·확인 중·자료 대기·완료)만 알리고, 끝난 뒤에 판정과 게시한 댓글을 엽니다. 운영자 이름도 내보내지 않습니다.

## 구조

```
src/lib/factbase/   잼통 근거 받기(load), 후보 검색(search, bigram)
src/lib/check/      읽기·판정 모델 호출(model), 서버 검사(validate), 댓글 조립(comment), 전체 흐름(pipeline)
src/lib/tasks/      작업 상태 전이(transitions, 순수 함수), Firestore 트랜잭션(store)
src/lib/gaps/       공백 주제 키, 잼통 GitHub 이슈
src/app/api/        제보, 작업, 판정, 공백, 스케줄 작업
src/app/            작업 큐(/), 작업 상세(/tasks/[id]), 자료 공백(/gaps), 제보(/report)
```

브라우저는 Firestore를 직접 읽지 않습니다. 모든 데이터는 API(Admin SDK)를 거치고, `firestore.rules`는 전부 닫혀 있습니다.

## 잼통 쪽

잼통 저장소에 `src/lib/factbase/build.ts`와 `src/app/factbase.json/route.ts`가 추가되어 있습니다(커밋 전).
빌드 때 `/factbase.json`이 정적 파일로 생성되며, 공개 업적의 claim, 언행, 언행 대목, 성과 카드를 앵커 단위로 담습니다.

## 로컬 실행

```bash
pnpm install
gcloud auth application-default login      # Admin SDK 자격 증명 (ADC)

# 잼통을 띄워 factbase를 받는다 (다른 터미널)
cd ~/devel-src/jamtong && pnpm dev          # :3000

# .env.local에 추가
#   FACTBASE_URL=http://localhost:3000/factbase.json
#   CRON_SECRET=<아무 긴 문자열>
pnpm dev -p 3100
```

첫 관리자 지정 (이후로는 `/members` 화면에서):

```bash
pnpm grant-member you@example.com admin
```

구글을 아직 연결하지 않은 이메일이면 초대로 적어 두고, 그 사람이 연결할 때 반영합니다.

판정 경로만 시험하기 (Firebase 불필요, 모델 비용 발생):

```bash
FACTBASE_URL=http://localhost:3000/factbase.json pnpm smoke "게시물 글"
```

## Firebase 설정 체크리스트

1. Authentication → **익명** 로그인과 **Google** 로그인 사용, 승인된 도메인에 배포 도메인 추가
   - 방문자마다 익명 계정이 생깁니다. Authentication 설정의 익명 계정 자동 삭제(30일)를 켜 두기를 권합니다
2. Firestore 생성 → `firebase deploy --only firestore` (규칙 + 인덱스)
3. Storage 생성 → `firebase deploy --only storage`
4. App Hosting 백엔드 생성 → `apphosting.yaml`의 `<콘솔 값>` 채우기, Secret Manager에 `ANTHROPIC_API_KEY`, `FACTBOT_CRON_SECRET`
5. Cloud Scheduler (헤더 `Authorization: Bearer <CRON_SECRET>`, POST)
   - `/api/jobs/expire-claims` — 5분마다
   - `/api/jobs/factbase-sync` — 30분마다
6. (선택) `GITHUB_TOKEN` — 잼통 저장소 issues 쓰기 권한. 없으면 이슈 본문을 화면에 띄워 손으로 올립니다.

## 검사

```bash
pnpm check     # typecheck + lint + test
```
