# Day1 Template — Module 2 Evidence: Pure Domain Logic

> **Feature**: day1-template
> **Module**: 2 — `domain/day1/` 순수 로직 3종 + 유닛
> **Date**: 2026-07-28
> **Design**: [day1-template.design.md](../02-design/features/day1-template.design.md) §4, §8.1
> **선행**: [module-1](day1-template.module-1-schema.md) ✅

---

## 1. What Shipped

Design §4 그대로 세 파일. React·Remotion·Zustand 임포트 없음
([architecture.test.ts](../../src/test/architecture.test.ts) 통과).

| 파일 | 내용 |
|------|------|
| [layout.ts](../../src/domain/day1/layout.ts) | `splitLayout(ratio, lineWidthPx)` — 패널 2개 + 분할선 사각형 |
| [playback.ts](../../src/domain/day1/playback.ts) | `activePanelForSection`, `day1SectionDurations` |
| [endCard.ts](../../src/domain/day1/endCard.ts) | `APP_ICON_RECT`, `appIconRect(ratio, adjust)` |

### 1.1 splitLayout — Design 표와 일치

| 출력 | 방향 | 패널 (선 6px) | 검증 |
|------|------|---------------|:----:|
| 1080×1080 (1:1) | 상하 | 1080×537 | ✅ |
| 1920×1080 (16:9) | 좌우 | 957×1080 | ✅ |
| 1080×1920 (9:16) | 상하 | 1080×957 | ✅ |

`orientation`은 **패널이 쌓이는 축** 기준으로 정의했다. `vertical` = A가 위,
`horizontal` = A가 왼쪽. 분할선은 반대 축을 가로지른다. Design에 이 정의가
없어서 코드 주석에 명시했다.

홀수 나머지는 패널 B가 받는다. `a + line + b`가 출력 크기와 정확히 일치해야
하는데, 1픽셀이라도 비면 렌더에 이음매로 보인다. 테스트가 3규격 × 선 두께
0~24px 전부(75조합)에 대해 이 항등식을 확인한다.

### 1.2 day1SectionDurations

| 프리셋 | 결과 | 합 |
|--------|------|-----|
| 15초 | `[6000, 6000, 3000]` | 15000 ✅ |
| 30초 | `[13500, 13500, 3000]` | 30000 ✅ |
| 60초 | `[28500, 28500, 3000]` | 60000 ✅ |

엔드카드 3초 고정, 나머지를 A·B가 균등 분할 (Plan D2 "기본 중간").

### 1.3 앱아이콘 좌표 — 원본 CSS와 대조 완료

Design §4.3의 정규화 상수를 **bannerdesigner 원본과 직접 대조해 검증했다.**
SC5(오차 ≤2px)가 이 숫자에 걸려 있어서 값을 그대로 믿지 않았다.

```
today-banner-designer.html  .banner.tmpl-app-badge.size-* .ab-icon
  size-1x1   캔버스 1080×1080   top 375  left 282  515×515  radius 96
  size-9x16  캔버스 1080×1920   top 820  left 200  680×680  radius 120
  size-16x9  없음 (1x1 / 9x16 / 1200x628 만 존재)
```

Design의 소수값과 전부 일치한다 (282/1080 = 0.26111 등).

**코드에는 소수 대신 원본 픽셀값을 상수로 두고 나누기를 코드가 하게 했다.**
그래야 저 스타일시트와 눈으로 diff할 수 있고, 소수 자릿수를 잘못 옮길 여지가
사라진다. 테스트는 정규화값에 프레임 크기를 다시 곱해 원본 픽셀로 되돌려 확인한다.

주의할 점 하나: 아이콘은 픽셀 기준 정사각형이지만 9:16에서는 `w ≠ h`다
(680/1080 = 0.6296 vs 680/1920 = 0.3542). `w`는 프레임 **너비**에, `h`는
**높이**에 곱해야 한다. `radius`는 두 규격 모두 **너비** 기준이다 — CSS가
픽셀 radius를 해석하는 방식과 같다. 타입 주석에 남겼다.

`iconAdjust.scale`은 **아이콘 자기 중심** 기준으로 적용된다. 좌상단 기준으로
하면 확대할 때 아이콘이 프레임 원점 쪽으로 끌려가 배너의 구워진 아이콘에서
어긋난다.

---

## 2. Verification

```
npx vitest run src/domain/day1    31 passed (3 files)
npm test                          214 passed (25 files)   — module-1 시점 183 + 31
npx tsc -b                        0 errors
npm run build                     built in 188ms
npx playwright test               18 passed
```

### Success Criteria

| # | 기준 | module-2 | 근거 |
|---|------|:--------:|------|
| SC1 | 3규격 MP4 산출 | — | module-6 |
| SC2 | 흑백 전환 렌더 반영 | — | module-3 |
| SC3 | 기존 3장면 회귀 없음 | ✅ 유지 | E2E 18개 통과 |
| SC4 | 분할선 색 렌더 | — | module-3 |
| SC5 | 엔드카드 아이콘 ≤2px | 🟡 기반 확보 | 좌표를 원본 CSS와 대조 검증. 실제 오차 측정은 module-4 |
| SC6 | 유닛·E2E·타입체크·빌드 | ✅ | 위 |

---

## 3. Design Deviations

없다. Design §4의 시그니처를 그대로 구현했다.

### 함께 닫은 module-1 미결 사항

module-1 증거 문서에 "Day1도 3장면 테이블을 쓴다 — module-2에서 분기 추가"로
남겨둔 항목을 닫았다. [project.ts](../../src/domain/editor/project.ts)의
`applyDurationPreset`이 이제 템플릿에 따라 `day1SectionDurations`와
`createSceneDurations`로 갈라진다.

### 의도적으로 넣지 않은 것

`Sections` 튜플(id·label 포함)을 만드는 빌더는 넣지 않았다. Design §4.2가
정의한 함수는 두 개뿐이고, 템플릿 전환 시점에 필요한 물건이라 module-5에서
`DAY1_SECTION_LABELS`(module-1에서 이미 추가)와 조합하는 편이 맞다.

---

## 4. Next — module-3 착수 전 필요한 것

**두 번째 영상 픽스처가 아직 없다.** 이번 세션에서 전달받은 Google Drive 파일
(`영_GGG_매직 디펜스 가로.mp4`)은 읽지 못했다:

```
파일 크기   92,915,156 bytes
실제 블록   0            ← 클라우드 전용, 로컬에 없음
Drive 데몬  실행 안 됨
```

Google Drive 앱이 꺼져 있어 바이트를 받아올 수 없었다. 샌드박스 밖에서도 동일.

**필요한 조치** — 둘 중 하나:
- Drive 앱 실행 → 해당 파일 "오프라인 액세스 사용" → 다운로드 완료
- 또는 파일을 로컬 경로(`~/Desktop` 등)로 복사

파일을 받으면 **앞 12초를 잘라** `tests/fixtures/gameplay-sample-b.mp4`로 둔다.
`.gitignore`가 `tests/fixtures/*.mp4`를 제외하므로 저장소에는 들어가지 않고
로컬 픽스처로만 쓴다 — 기존 `gameplay-sample.mp4`와 같은 취급이다. 그래도
89MB 원본을 그대로 쓰면 E2E 업로드·디코딩이 느려지므로 잘라서 쓴다
(기존 픽스처는 234KB / 12초 / 1920×1080).

```bash
/pdca do day1-template --scope module-3
```
