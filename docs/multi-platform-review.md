# 다른 SNS(X·Threads 등) 제보 지원 검토

검토일: 2026-10-12
상태: 검토만 함. 구현하지 않음.

지금 제보는 인스타그램 게시물만 받는다. X나 Threads 게시물도 받는 일은 대체로
어렵지 않다. 다만 주소 파싱만 바꾸면 끝나지 않고, X에는 실제로 막히는 지점이 두 곳 있다.

---

## 1. 인스타그램에 묶여 있는 곳

| 위치 | 내용 | 난이도 |
|---|---|---|
| `src/lib/instagram/url.ts` | 주소에서 shortcode를 뽑음. 이 값이 `fc_posts`·`fc_tasks`의 문서 id | 중간 |
| `src/app/api/reports/route.ts` | `parseInstagramUrl`로 주소를 검사하고 거부 | 쉬움 |
| `src/lib/check/pipeline.ts` (`runCheck`) | `fetchCaption`(Meta oEmbed, 토큰 필요)으로 본문을 받음 | 플랫폼마다 다름 |
| `src/lib/tasks/transitions.ts` (`posted`) | 게시 완료 주소의 shortcode가 원 게시물과 같은지 검증 | **X에서 막힘** |
| `src/lib/check/validate.ts` (`COMMENT_MAX = 300`) | 댓글 본문 길이 제한 | **X에서 막힘** |
| `src/lib/check/model.ts` (`EXTRACT_SYSTEM`) | 추출 프롬프트가 "인스타그램 게시물"로 시작 | 쉬움 |
| `src/lib/gaps/github.ts` | 이슈 본문에 `instagram.com/p/${postId}` 주소를 직접 만들어 넣음 | 쉬움 |
| UI 문구 | ReportForm, report/page의 공유 주소 정규식, tasks/[id], my, 홈, Guide, brand, manifest | 분량은 많지만 단순함 |

## 2. X에서 막히는 두 곳

1. **댓글 길이.** X는 가중치를 매겨 280자까지 받는다. 한글은 한 글자를 2로 세므로
   한글로는 140자 정도이고, 링크는 하나에 23자로 계산된다. 지금 댓글은 머리말 + 본문
   300자 + 근거 링크 구조라 그대로는 들어가지 않는다. 플랫폼별 길이 제한을 두고
   X용으로는 더 짧은 댓글을 만들어야 한다. 모델 프롬프트와 `validate.ts`에서 플랫폼별로
   제한을 걸고, 넘치면 기존처럼 `needs_review`로 돌린다.
2. **게시 완료 주소 검증.** 인스타그램은 댓글 주소가 `/p/<게시물>/c/<댓글>`이라 원 게시물과
   같은지 비교할 수 있다. X 답글은 자기만의 status id를 가지며, 주소만으로는 원 트윗과
   연결되지 않는다. X에서는 "x.com의 status 주소인지"만 확인하도록 기준을 낮춰야 한다.

## 3. 문서 id 설계 (먼저 정할 부분)

- 기존 인스타그램 문서는 shortcode 그대로 두고, 다른 플랫폼에만 접두어를 붙인다.
  예: `x_1234567890`, `th_ABC123`. 기존 데이터를 옮길 필요가 없다.
- 파서는 `parsePostUrl(raw) → { platform, postId, url }` 하나로 합친다. 정규화 원칙은
  같다. 예: `twitter.com`, `x.com`, `mobile.twitter.com`, `?s=20` 같은 꼬리가 붙은
  주소를 모두 `x.com/i/status/<id>` 하나로 모은다.
- `fc_reports.shortcode` 필드명과 인덱스는 그대로 두고 `platform` 필드만 추가한다.
  쿼리와 인덱스를 바꾸지 않아도 된다.

## 4. 본문 확보는 플랫폼마다 다름

- **X**: `publish.twitter.com/oembed`는 토큰 없이 쓸 수 있고, 응답 html에 트윗 본문이
  들어 있다. 지금 인스타그램보다 낫다. 비공개 계정이나 삭제된 트윗은 실패하므로 지금처럼
  스크린샷으로 대신 판정한다. (실제 호출로는 아직 확인하지 않음.)
- **Threads**: Meta oEmbed라 인스타그램과 같은 토큰 문제가 있다. 주소는 `threads.net`
  또는 `threads.com`의 `/@user/post/<code>` 형태. 댓글 제한은 500자라 여유가 있다.
- **페이스북·유튜브**: 주소 형태가 다양하고 oEmbed로 받을 수 있는 정보가 적다.
  들어오는 수요를 보고 나중에 한다.

## 5. 권장 순서

1. 파서 일반화, 문서 id 접두어, `platform` 필드, 문구를 플랫폼에 따라 바꾸기.
   테스트에 X·Threads 주소 정규화 사례를 추가한다.
2. **Threads를 먼저** 추가한다. 댓글 길이와 게시 검증을 인스타그램 방식 그대로 쓸 수 있다.
3. **X**를 추가한다. oEmbed 본문 받기, X용 짧은 댓글 생성과 검증, 게시 완료 검증 완화.
4. 서비스 소개(`brand.ts`, 홈, 가이드)를 "SNS"로 바꿀지는 정책 판단이 필요하다.
   운영자가 X 계정을 따로 둘지도 함께 정한다.

예상 규모: 1~2단계 반나절, X 추가 하루.

## 6. 정할 것

- X 댓글: 별도로 짧게 생성할지, "근거: 링크" 하나만 남기는 축약형으로 갈지.
- 서비스 이름과 소개를 인스타그램 전용에서 SNS 전반으로 넓힐지.
