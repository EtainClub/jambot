# 잼통 신고 센터 — A안

생성 방식: built-in image_gen. 승인된 파란 잼통+민트 체크 시안에서 로고와 아이콘을 각각 분리해 생성했다.

## 파일

- `jamtong-report-logo-master.png`: 투명 배경 가로 로고 원본
- `jamtong-report-icon-master.png`: 파란 배경 앱 아이콘 원본
- `../../public/brand/jamtong-report-logo.png`: 여백을 정리한 웹 헤더 로고
- `../../public/icons/icon-{192,512}.png`: 설치 아이콘
- `../../public/icons/icon-maskable-512.png`: 중앙 안전 영역에 심볼이 있는 마스크용 아이콘
- `../../src/app/icon.png`: 48px 브라우저 탭 아이콘
- `../../src/app/apple-icon.png`: 180px iOS 홈 화면 아이콘
- `../../src/app/favicon.ico`: 16/32/48px 브라우저 파비콘
- `jamtong-report-share-master.png`: 링크 공유 이미지 원본
- `../../public/brand/jamtong-report-share.png`: 1200×630px Open Graph / X 공유 카드

크기별 파일 재생성:

```sh
node scripts/build-brand-assets.mjs assets/brand/jamtong-report-logo-master.png assets/brand/jamtong-report-icon-master.png assets/brand/jamtong-report-share-master.png
```

## 최종 생성 프롬프트

### 로고

Use case: precise-object-edit. Extract and faithfully reproduce ONLY the upper horizontal logo lockup from this approved A concept, preserving the cobalt blue jam jar with mint checkmark and exact Korean wordmark "잼통 신고 센터", first two syllables blue and rest dark navy. One final horizontal logo on genuinely transparent background. Keep proportions, character spelling and letter shapes, jar silhouette and colors unchanged. Crop close with modest clearspace around the full lockup. No lower app icons, no presentation sheet, no extra objects, no new design, no shadows. Wide landscape canvas suited to a website header.

### 앱 아이콘

Use case: precise-object-edit. Extract the large lower app icon of this approved A concept into one final square app-icon asset. Preserve exactly its white jam-jar silhouette, two white horizontal lid bars and mint checkmark geometry. Expand the cobalt blue background to fill the ENTIRE square canvas edge to edge with sharp square outer corners: operating systems apply their own icon masks. Center the complete white jar and mint check within the middle 64 percent of canvas so the complete mark is inside the central safe circle for maskable icons. Flat uniform cobalt blue background, crisp edges, no gradients, no shadows, no white exterior margin, no text, no wordmark, no smaller duplicate, no presentation layout. One square image.

### 공유 이미지

Use case: logo-brand. Create a final social link sharing preview image for the Korean app "잼통 신고 센터", based on the supplied approved logo. Landscape aspect ratio approximately 1200:630. Preserve the exact supplied logo symbol, typography, name spelling and colors. Render that complete horizontal lockup large and legible, centered on a clean warm-white background with ample margins; lockup occupies about 80 percent canvas width. Add only a very subtle pale-blue background accent near the edges if needed. Keep the name exactly "잼통 신고 센터". No additional text, no slogans, no icons besides the approved mark, no mockups, no watermarks, no political symbols or portraits. Professional restrained brand card. Opaque background.
