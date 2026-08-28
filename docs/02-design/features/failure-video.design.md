# 실패(FAIL) 영상 템플릿 Design Document

> **Project**: mkt_videodesigner
> **Feature**: `failure-video`
> **Plan**: [failure-video.plan.md](../../01-plan/features/failure-video.plan.md)
> **Architecture**: 새 템플릿 arm + 공용 내부 추출 (day1-quad와 동일 전략)
> **Author**: 김성권 / Claude
> **Date**: 2026-08-28
> **Status**: Draft — awaiting Do

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | "레벨 1 실패 → 레벨 20 → 레벨 99" 성장 서사 포맷을 소재 교체만으로 반복 생산한다. 레퍼런스 mp4를 프레임 단위로 실측했고(Plan §1), 만들 것은 순차 3구간 + FAIL 스탬프 + 줌 펀치 전환 + 캡션 바다. |
| **WHO** | 사내 UA Manager. 기존 4템플릿 사용자와 동일. |
| **RISK** | 방향별(세로/가로) 소스 축이 커맨드·에셋 훅·프리플라이트·프록시로 번지는 것. FAIL 스탬프의 재현 품질. 효과 프레임의 렌더 비용. |
| **SUCCESS** | 세로 3개(+가로 3개) 업로드로 9:16·16:9 실제 MP4가 나오고, 렌더된 픽셀에서 스탬프·탈색·전환·캡션이 실측으로 확인되며, 기존 4템플릿 출력이 불변이고 스키마 버전이 2에 머문다. |
| **SCOPE** | M1 공통 경로(failure 코드 0줄) → 스키마 → 도메인(효과 함수) → 컴포지션 → UI → 렌더·프록시 → 검증. |

---

## 1. Overview

### 1.1 Design Goals

1. **기존 4템플릿의 렌더 출력 픽셀을 바꾸지 않는다.** failure가 기존 코드에 요구하는 변화는 전부
   "순수 이동" 또는 "파라미터화"다: `Day1Inspector`의 패널·엔드카드 섹션 추출(§7.2), `useDay1Assets`의
   슬롯 파라미터화(§7.3), 엔드카드 커맨드 4종의 narrower 교체(§5.6). 각각 기존 스위트가 회귀 게이트다.
2. **마이그레이션 코드를 쓰지 않는다.** arm 추가는 기존 문서에 하위 호환이고, `sections` 축은 4구간을
   그대로 수용한다(`[2,8]`, [constants.ts:29](../../../src/domain/editor/constants.ts:29)).
   `PROJECT_SCHEMA_VERSION`은 **2 유지**.
3. **효과는 전부 `(frame, fps, …)`의 순수 도메인 함수다.** 스크럽·프리뷰·렌더·배치가 같은 픽셀을
   만들려면 컴포지션에는 수식이 없어야 한다 (kv 파티클 선례, [schema.ts:428-435](../../../src/domain/editor/schema.ts:428)).
4. **효과 밖 프레임의 스타일은 `undefined`다.** 상시 `filter`는 quad 실측에서 2.13× 렌더 비용이었다.
   `BlurBookend`의 규칙([KvLoopComposition.tsx:106-116](../../../src/compositions/KvLoopComposition.tsx:106))을
   FAIL·전환·셰이크 전부가 따른다.

### 1.2 Key Insight — 방향(orientation) 축만 새롭고, 나머지는 이미 열려 있다

failure가 기존과 다른 유일한 구조는 "한 구간이 세로/가로 소스 2벌을 가진다"(Plan Q2)이다. 그런데
편집 UI는 이미 **미리보기 비율(`project.selectedRatio`)에 묶여** 있다 — 인스펙터의 프레이밍이
`activeTransformOf(panel)`로 현재 비율의 transform을 읽듯이. 그러므로:

> **"지금 편집 중인 방향" = `failureOrientationFor(project.selectedRatio)`.**
> 비율 토글(9:16 ↔ 16:9)이 곧 방향 토글이다. 새 UI 컨셉이 필요 없다.

그리고 패널을 다루는 기존 표면은 전부 **키 기반 함수·레코드**라 방향이 늘어도 형태가 유지된다:

- `Day1AssetPanel`은 `panels` 목록 + `(panel) => …` 콜백만 받는다 ([Day1AssetPanel.tsx:27-49](../../../src/features/editor/Day1AssetPanel.tsx:27)).
- `Day1InspectorProps`의 패널 필드도 전부 `(panel: Day1PanelKey) => …`다 ([Day1Inspector.tsx:136-175](../../../src/features/editor/Day1Inspector.tsx:136)).
- `planPanelProxy(box, source, transform)`는 박스와 transform만 받는다 — 방향 무관 ([sourceProxy.ts:106](../../../src/domain/day1/sourceProxy.ts:106)).
- `Panel` 컴포넌트는 프레젠테이션 전용이라 failure의 단일 패널 렌더에 **무변경 재사용**된다 (§6.3).

### 1.3 Confirmed Decisions (Plan §2, 사용자 확정 2026-08-28)

| # | 결정 | 설계 귀결 |
|---|---|---|
| Q1 | 캡션은 구간 따라 변경, 문구 수정 가능 | §5.4 `copy.failureLabels` + §6.5 CaptionBar |
| Q2 | 가로형은 가로 소재 별도 업로드, 자동 폴백 없음 | §5.2 방향 그룹, §8 프리플라이트 |
| Q3 | FAIL 스탬프는 유사 재창작 후 내장 | §6.4 D-6 (PNG 에셋) |
| Q4 | 프리셋 30·60초만 | §4.3 (quad D-4와 동일 3점 세트) |
| 요청서 | 구간당 영상 1종 · 9:16/16:9만 · FAIL은 구간 1 끝 고정 · 엔드카드는 day1과 동일 | §5.1, §4.2, §5.3, §5.5 |

### 1.4 레퍼런스 실측이 설계에 주는 수치 (Plan §1)

| 항목 | 실측값 | 설계 반영 |
|---|---|---|
| FAIL 줌 | ~0.6s에 1→≈2.2, ease-out, 중심 고정 | `FAIL_LEAD_MS = 500`, `FAIL_ZOOM_SCALE = 2.2` (§5.3) |
| 스탬프 | 진입 ≈4×→1 안착, 회전 −8°, 불투명 0.6→1, 노출 ≈1.0s | `FAIL_STAMP_MS = 1000`, 진입 250ms (§6.4) |
| 셰이크 | 안착 직후 수 프레임, 캡션 바 포함 프레임 전체 ±10px | 프레임(섹션 래퍼) 레벨 적용 (§6.4) — 프록시 안전성의 근거이기도 하다 (§7.4) |
| 전환 | 아웃 ~0.2s 줌인+블러 / 인 ~0.3s 줌아웃, 캡션 포함 | `FAILURE_TRANSITION_OUT_MS = 250`, `IN_MS = 300` (§5.3) |
| 캡션 바 | 높이 = 프레임의 10%, 검정, 흰 볼드 중앙, 캡높이 ≈ 프레임의 3.7% | `FAILURE_CAPTION_RATIO = 0.10`, fontSize 기본 100@1920h (§6.5) |
| 구간 배분 | 19% / 9% / 72% (엔드카드 없음) | `failureSectionDurations`: 20/10/70 (§6.1) |

---

## 2. Architecture

### 2.1 Component Diagram

```
features/editor/EditorWorkspace.tsx
  ├ TemplateSelector              ◆ 옵션 1개 + 프리셋·비율 안내 문구 (§4.2, §4.3)
  ├ Day1AssetPanel                ◆ 라벨·testid 파라미터화 후 재사용 (§7.3)
  ├ FailureInspector              ◆ 신규 — 추출된 PanelSection·EndCardSection 조립 (§7.2)
  ├ Day1Inspector                 ◆ 내부 섹션 2개를 파일로 추출(순수 이동), 마크업 무변경
  ├ useDay1Assets                 ◆ 슬롯 파라미터화(제네릭 키) 후 두 템플릿이 공유 (§7.3)
  └ usePanelProxies               ◆ failure arm: 방향별 키 + failureLayout 박스 (§7.4)

domain/editor/
  ├ constants.ts                  ◆ TEMPLATE_KINDS, FAILURE_SECTION_ORDER, FAILURE_RATIOS,
  │                                 FAILURE_DURATION_PRESETS, FAILURE_CAPTION_* 기본값
  ├ schema.ts                     ◆ failureSettingsSchema arm + copy.failureLabels + refineFailure
  ├ types.ts                      ◆ FailureProps, FailureSlot, 스냅샷 arm
  └ project.ts                    ◆ failureOf, failurePanelAt, failure 커맨드 8+2종,
  │                                 switchTemplate arm, buildFailureProps, 프리플라이트
domain/failure/                   ◆ 신규 모듈 — 순수 함수만
  ├ layout.ts                       failureLayout(ratio) → {video, caption} rect
  ├ orientation.ts                  failureOrientationFor(ratio)
  ├ playback.ts                     failureSectionDurations, activePanelForFailureSection
  └ effects.ts                      failWindow·failVideoStyleAt·failStampStyleAt·
                                    failShakeAt·zoomPunchAt (전부 (frame, fps, …) 순수)
compositions/
  ├ failure/FailureFrame.tsx      ◆ 신규 — Panel 재사용 + FAIL 레이어 + CaptionBar
  ├ failure/FailStamp.tsx         ◆ 신규 — 내장 PNG 스탬프 오버레이
  ├ failure/CaptionBar.tsx        ◆ 신규 — DisclaimerBar 선례
  ├ failure/assets/               ◆ fail-stamp.png (+ 근거 SVG), fail-thud.wav
  ├ FailureComposition.tsx        ◆ 신규
  ├ day1/Panel.tsx                무변경 (재사용)
  └ day1/EndCardScene.tsx         무변경 (재사용 — quad 때와 동일하게 신규 0줄)

infrastructure/render/renderEditor.ts  ◆ EditorRenderRequest arm (§7.5)
domain/render/fileName.ts              ◆ TEMPLATE_FILE_SEGMENT.failure = 'fail'
```

◆ = 이번 사이클에서 손대는 파일. **`Panel.tsx`·`EndCardScene.tsx`·`endCard.ts`·`sourceProxy.ts`·
`timeline.ts`·`layout.ts(day1)`는 한 줄도 바뀌지 않는다.**

### 2.2 Data Flow — failure 렌더

```
EditorProject
  templateSettings: {template:'failure', vertical:{panelA..C}, horizontal:{panelA..C},
                     caption, fail, endCard}
  sections: [panel-a, panel-b, panel-c, endcard]
  copy[locale].failureLabels: {a:'LEVEL 1', b:'LEVEL 20', c:'LEVEL 99'}
       │
       ├─ usePanelProxies.prepare(ratio, fps)
       │     orientation = failureOrientationFor(ratio)
       │     키 3개 순회, failureLayout(ratio).video → 박스
       │     planPanelProxy(박스, 소스크기, transform)      ← 무변경
       │
       └─ buildEditorSnapshot(project, resolveUrl)
             buildFailureProps → {template:'failure', props}
                  layout    = failureLayout(selectedRatio)
                  panels    = [3 × Day1PanelRenderProps]   ← 활성 방향의 소스·트림·프레이밍
                  captions  = [로케일 해석된 a·b·c]
                  fail      = 토글 + 초점(불변 스냅샷)
                  endCard   = buildEndCardProps(...)        ← 무변경
                       │
                       ├─ Player 미리보기
                       └─ renderEditor → FailureComposition
```

분기는 정확히 한 곳 — `buildEditorSnapshot` (conventions §3.1). 렌더 arm은
`createEditorRenderRequest`의 한 arm ([renderEditor.ts:28-32](../../../src/infrastructure/render/renderEditor.ts:28)).

### 2.3 왜 방향 그룹이 페이로드 안에 있는가 (D-0)

Plan D-2가 "한 프로젝트 안의 슬롯 2벌"을 확정했다. 남은 것은 형태였다:

| | 평평한 6키 (`panelA..panelCWide`) | **방향 그룹 (선택)** `vertical/horizontal × {panelA..C}` |
|---|---|---|
| `Day1PanelKey` | 6키로 오염 — day1 명령 15종의 no-op 계약이 흔들림 | day1 세계와 완전 분리, 그룹 안은 `day1PanelSchema` 그대로 |
| 접근 함수 | 키 파싱 필요 | `failurePanelAt(project, orientation, key)` 한 함수 |
| 저장 문서 | 방향이 이름에 숨음 | 방향이 구조로 드러남 — 읽는 사람이 오해할 수 없다 |
| 프리플라이트 | 키 필터링 | 선택된 비율 → 방향 → 그룹 순회 |

그룹 안의 패널은 `day1PanelSchema` **그대로**다(소스·트림·`ratioTransforms`). `ratioTransforms`의
`overrides`는 방향 그룹에서는 사실상 base만 쓰이지만, 스키마를 쪼개 새 타입을 만드는 것보다 기존
조각을 재사용하는 쪽이 `activeTransform`([project.ts:731](../../../src/domain/editor/project.ts:731))·
TrimStrip·프록시 계획이 전부 무변경으로 성립하는 길이다.

---

## 3. 구현 순서 — 왜 M1이 먼저인가

quad의 시퀀싱 교훈([day1-quad.design.md §3](day1-quad.design.md))을 그대로 따른다. M1의 세 항목(§4)은
**failure 코드 0줄로 성립하는 공용 정리**다: `Day1Inspector` 섹션 추출, `useDay1Assets` 파라미터화,
엔드카드 커맨드 narrower 교체. 먼저 하면 기존 유닛·E2E 스위트가 그 변경만의 회귀 게이트가 되고,
이후 failure 코드에서 깨지는 것은 원인이 하나로 확정된다.

이후는 의존 방향 순서다: 스키마·상수(M2) → 도메인 효과 함수(M3) → 에셋 제작 + 컴포지션(M4) →
UI(M5) → 렌더·프록시(M6) → 검증(M7).

---

## 4. M1 — 공통 경로 (failure 코드 0줄)

### 4.1 추출·파라미터화 3건 (D-8)

1. **`Day1Inspector` → `PanelSection.tsx` + `EndCardSection.tsx` 추출.** 순수 이동. quad의 `Panel`
   추출과 동일한 규율: 마크업·상수·testid 한 글자도 안 바뀐다. `Day1Inspector`는 import 두 줄이 늘고
   기존 E2E(트림·엔드카드 스펙)가 게이트다. FailureInspector가 M5에서 이 두 조각을 조립한다.
2. **`useDay1Assets` 파라미터화.** 훅이 내부에서 `panelKeysOf`/`day1PanelAt`을 직접 읽는 두 곳을
   주입으로 바꾼다: `slots: readonly TKey[]` + `panelOf: (key: TKey) => Day1Panel | null`
   (제네릭 `TKey extends string`; 기존 호출부는 `panelKeysOf(...)`·`day1PanelAt`을 그대로 넘겨
   동작 동일). 복원(restore)·retain 로직이 주입된 슬롯 전체를 돌므로, failure는 **양 방향 6슬롯**을
   넘겨 비활성 방향의 핸들 복원까지 얻는다 (§7.3).
3. **엔드카드 커맨드 4종의 narrower 교체 (D-2).** `updateDay1EndCard`·`setDay1EndCardVideo`·
   `setDay1EndCardTrimInMs`·`setDay1EndCardTrimLengthMs`가 읽는 `day1PanelsOf`
   ([project.ts:1397](../../../src/domain/editor/project.ts:1397) 등 4곳)를
   `endCardSettingsOf = (p) => day1PanelsOf(p) ?? failureOf(p)`로 바꾼다. 본문은 `endCard` 필드만
   만지므로 문자 그대로 재사용된다 — quad가 "공유 필드는 payload 유니온으로" 넓힌 것과 같은 수
   ([project.ts:1305-1312](../../../src/domain/editor/project.ts:1305)). `withDay1`의 타입만 유니온에
   `FailureSettings`를 더한다. M1 시점엔 `failureOf`가 아직 없으므로 이 항목만 M2와 함께 넣어도
   되지만, 시그니처 교체 자체는 M1에서 끝내 둔다(`?? null` 자리 표시).
   `updateDay1Split`·`updateDay1LabelStyle`·패널 명령 15종은 **그대로 `day1PanelsOf`** —
   failure에는 그 필드가 없으므로 no-op 계약이 자동으로 성립한다.

### 4.2 파일명·선택기·라벨

- `TEMPLATE_FILE_SEGMENT`에 `failure: 'fail'` ([fileName.ts:15-20](../../../src/domain/render/fileName.ts:15)).
  `Record<TemplateKind, string>`이므로 kind 추가 즉시 컴파일이 강제한다.
- `TEMPLATE_LABELS`에 `failure: '실패(FAIL)'`, `TEMPLATE_LOSS`에
  `'구간별 세로·가로 영상과 캡션·FAIL 효과·엔드카드 설정'`
  ([TemplateSelector.tsx:16-29](../../../src/features/editor/TemplateSelector.tsx:16)).
- 전환 다이얼로그 안내 2건: 프리셋(15초 → 30초로 강제, testid `template-switch-preset-note` 재사용 —
  조건을 "quad 또는 failure"로 일반화) + 비율(1:1 해제, 신규 testid `template-switch-failure-ratio-note`).

### 4.3 프리셋·비율 제약 (quad D-4의 3점 세트 × 2)

```ts
// constants.ts
export const FAILURE_DURATION_PRESETS = [30, 60] as const;   // Plan Q4
/** Plan 요청서 — 세로·가로만. 1:1은 제공하지 않는다. */
export const FAILURE_RATIOS = ['9:16', '16:9'] as const;
```

- `durationPresetsForTemplate`([constants.ts:18-21](../../../src/domain/editor/constants.ts:18))에 arm 추가.
- `refineFailure`가 durationPreset ∉ {30,60}, `selectedRatio` ∉ FAILURE_RATIOS,
  `render.selectedRatios ⊄ FAILURE_RATIOS`를 각각 거부한다 — kv-loop의 refine
  ([schema.ts:807-827](../../../src/domain/editor/schema.ts:807))과 같은 자리·같은 형태, 단일 고정이
  아니라 부분집합 검사라는 것만 다르다.
- `switchTemplate` arm이 강제 변환한다: 프리셋 15 → 30, `selectedRatios`에서 1:1 제거(비면 `['9:16']`),
  `selectedRatio`가 1:1이면 `'9:16'`.

---

## 5. Data Model

### 5.1 상수 — 구간·방향

```ts
// constants.ts
export const FAILURE_SECTION_ORDER =
  ['panel-a', 'panel-b', 'panel-c', 'endcard'] as const;     // 4 ≤ MAX_SECTION_COUNT(8)
export const FAILURE_PANEL_KEYS = ['panelA', 'panelB', 'panelC'] as const;
export const FAILURE_ORIENTATIONS = ['vertical', 'horizontal'] as const;
```

구간 id를 quad와 같은 `panel-*` 계열로 두는 이유(Plan D-1): 표시명은 섹션 label(`레벨 1`·`레벨 20`·
`레벨 99`·`엔드카드`)이 담당하고, 구간 인덱스 매핑(0..2 = 패널, 3 = 엔드카드)이 day1 계열과 같은
규칙이 된다. 엔드카드가 마지막 구간이라는 `endCardSectionMs`의 규칙
([project.ts:1462](../../../src/domain/editor/project.ts:1462))도 그대로 성립한다.

### 5.2 스키마 arm

```ts
/** failure-video Design §5.2 — 한 방향의 패널 3개. day1PanelSchema 그대로 (D-0). */
const failurePanelsSchema = z.object({
  panelA: day1PanelSchema,
  panelB: day1PanelSchema,
  panelC: day1PanelSchema,
});

export const failureSettingsSchema = z.object({
  template: z.literal('failure'),
  /** Plan Q2 — 9:16 렌더는 vertical, 16:9 렌더는 horizontal 슬롯을 쓴다. 자동 폴백 없음. */
  vertical: failurePanelsSchema,
  horizontal: failurePanelsSchema,
  /** 문구는 copy.failureLabels; 여기는 스타일만 (disclaimer 선례, schema.ts:550). */
  caption: z.object({
    /** 1920 높이 캔버스 기준 px. 컴포지션이 frameHeight/1920로 비례 적용한다 (D-3). */
    fontSize: z.number().min(MIN_SUBTITLE_FONT_SIZE).max(MAX_CAPTION_FONT_SIZE),
    textColor: hexColorSchema,
    barColor: hexColorSchema,
  }),
  /** Plan D-5 — 소스가 이미 갖고 있을 수 있는 연출은 전부 끌 수 있다. */
  fail: z.object({
    stampEnabled: z.boolean(),
    zoomEnabled: z.boolean(),
    desaturateEnabled: z.boolean(),
    shakeEnabled: z.boolean(),
    sfxEnabled: z.boolean(),
    /** FR-12 — 펀치 줌 초점. 프레임 크기 대비 %, 기본 중앙(0,0). */
    focusX: z.number().min(-MAX_OFFSET_PERCENT).max(MAX_OFFSET_PERCENT),
    focusY: z.number().min(-MAX_OFFSET_PERCENT).max(MAX_OFFSET_PERCENT),
  }),
  endCard: day1EndCardSchema,          // quad와 동일하게 통째 공유 (Plan FR-07)
});
```

- 새 arm이므로 저장 문서가 없다 → `.default()` 마이그레이션 스토리가 필요 없고, 필드는 전부 명시적이다.
  기본값은 `DEFAULT_FAILURE_SETTINGS`가 공급한다 (§5.5).
- `templateSettingsSchema` 유니온([schema.ts:571](../../../src/domain/editor/schema.ts:571))과
  `expectedSectionIds`([schema.ts:593](../../../src/domain/editor/schema.ts:593))에 arm 하나씩.
- `refineFailure`: 6개 패널 전부에 `refineTrimInSource` + "duration 있는 비디오" 검사(day1 refine과
  동일 규칙, [schema.ts:694-726](../../../src/domain/editor/schema.ts:694)), 엔드카드 videoTrim 검사,
  §4.3의 프리셋·비율 검사. **소스 유무는 스키마 오류가 아니다** — 업로드 중 저장이 가능해야 한다는
  day1의 규칙 그대로, 렌더 프리플라이트가 막는다.
- `MAX_CAPTION_FONT_SIZE = 160` 신설: 기존 `MAX_SUBTITLE_FONT_SIZE`(120)는 1080 폭 자막용 상한이라
  1920 높이 기준 캡션의 실측 기본값(100)에 여유가 없다.

### 5.3 효과 상수 — 전부 실측에서 (Plan §1.2·§1.3)

```ts
// domain/failure/effects.ts
export const FAIL_LEAD_MS = 500;        // 펀치 줌 + 탈색 램프
export const FAIL_STAMP_MS = 1000;      // 사용자 요구 "마지막 1초" — 스탬프 노출
export const FAIL_WINDOW_MS = FAIL_LEAD_MS + FAIL_STAMP_MS;
export const FAIL_ZOOM_SCALE = 2.2;
export const FAIL_STAMP_ENTER_MS = 250; // 4×→1 슬램
export const FAIL_STAMP_ROTATE_DEG = -8;
export const FAIL_SHAKE_MS = 300;       // 안착 직후, 감쇠
export const FAIL_SHAKE_AMPLITUDE = 0.01; // 프레임 크기 대비 — 1080폭에서 ≈10px

export const FAILURE_TRANSITION_OUT_MS = 250;  // 아웃고잉 줌인
export const FAILURE_TRANSITION_IN_MS = 300;   // 인커밍 안착
export const FAILURE_TRANSITION_SCALE = 2.0;
export const FAILURE_TRANSITION_BLUR_RATIO = 0.02; // 프레임 폭 대비 최대 블러
```

전환은 **저장하지 않는다** — 레퍼런스 충실 재현이 요구이고 조절 요청이 없다(CLAUDE.md §2).
셰이크는 저장 시드가 없다: 무작위가 아니라 고정 감쇠 진동(사인 조합)이라 매 렌더 동일하다.
kv 파티클이 시드를 저장한 것은 무작위였기 때문이고, 여기엔 무작위가 없다.

### 5.4 카피 — `failureLabels`

```ts
// localizedCopySchema — day1Labels(schema.ts:203-214)와 같은 자리·같은 이유
failureLabels: z
  .object({a: copyTextSchema, b: copyTextSchema, c: copyTextSchema})
  .optional(),
```

기본값은 `switchTemplate`이 4로케일 전부에 채운다(quad Q9 선례,
[project.ts:1152-1160](../../../src/domain/editor/project.ts:1152)):

```ts
const FAILURE_DEFAULT_LABELS = {a: 'LEVEL 1', b: 'LEVEL 20', c: 'LEVEL 99'} as const;
```

`LEVEL 1` 등은 번역할 카피가 아니라 표기라 전 로케일 동일 영문으로 시작한다. 로케일 탭에서 언제든
바꿀 수 있고, 배치 렌더가 로케일별 문구를 자동으로 쓴다 (Plan Q1).

### 5.5 기본값

```ts
export const DEFAULT_FAILURE_SETTINGS: FailureSettings = {
  template: 'failure',
  vertical: {panelA: EMPTY_PANEL, panelB: EMPTY_PANEL, panelC: EMPTY_PANEL},
  horizontal: {panelA: EMPTY_PANEL, panelB: EMPTY_PANEL, panelC: EMPTY_PANEL},
  caption: {fontSize: 100, textColor: '#ffffff', barColor: '#000000'},
  fail: {
    stampEnabled: true, zoomEnabled: true, desaturateEnabled: true,
    shakeEnabled: true, sfxEnabled: true, focusX: 0, focusY: 0,
  },
  endCard: structuredClone(DEFAULT_DAY1_SETTINGS.endCard),
};
```

`EMPTY_PANEL`은 day1 기본 패널({source: null, trim 0, `DEFAULT_DAY1_PANEL_TRANSFORM`})과 동일한
리터럴이다. **패널 기본 `fit`은 day1과 같은 `contain`(무손실 시작)** — 레퍼런스의 "폭 채움 크롭"
룩은 `cover` 한 번의 선택이고, 업로드가 조용히 크롭하지 않는다는 day1-video 부록 3의 원칙이
우선한다. 캡션 fontSize 100은 실측(캡높이 3.7% ≈ 72px ÷ 0.72)에서 온다 (§1.4).

### 5.6 커맨드 — failure 전용 10종 + 공유 4종

새로 만드는 것 (전부 `mapFailurePanel(project, orientation, key, update)` 위):

| 커맨드 | 미러 대상 |
|---|---|
| `setFailurePanelSource(project, o, key, ref)` | `setDay1PanelSource` — 트림·프레이밍 리셋 포함 ([project.ts:1199](../../../src/domain/editor/project.ts:1199)) |
| `relinkFailurePanelSource` / `setFailurePanelSourceStatus` | relink/status 쌍 |
| `setFailureTrimInMs` / `setFailureTrimOutMs` | 트림 쌍 — `failureSectionMs(project, key)`(구간 인덱스 0..2) 사용 |
| `updateFailureTransform` / `resetFailureTransform` / `setFailureRatioOverride` | 프레이밍 3종 |
| `updateFailureCaption(project, patch)` | `updateDay1LabelStyle`류의 clamp 패턴 |
| `updateFailureFail(project, patch)` | 토글 + focus clamp(±`MAX_OFFSET_PERCENT`) |
| `setFailureLabelText(project, locale, slot, value)` | `setDay1LabelText` ([project.ts:1542](../../../src/domain/editor/project.ts:1542)) |

- `reconcile()` 체인([project.ts:558](../../../src/domain/editor/project.ts:558))에
  `reconcileFailureTrims` 추가: **양 방향 6패널 전부**를 각자의 소스 길이 × 구간 길이로 재클램프.
  다른 템플릿에서는 no-op.
- 공유하는 것: 엔드카드 커맨드 4종 (§4.1-3). `endCardSectionMs`(마지막 구간)와
  `endCardWindowMs`는 이미 템플릿 무관이다.
- `applyDurationPreset`([project.ts:571](../../../src/domain/editor/project.ts:571))에
  `failureSectionDurations` arm — quad 주석이 경고한 "arm 없으면 NaN Sequence" 그 자리다.
- `switchTemplate` arm: §4.3의 강제 변환 + 섹션 재구축 + 기본 라벨 주입.

### 5.7 렌더 프롭 타입

```ts
export type FailureSlot = 'a' | 'b' | 'c';

export interface FailureRenderProps { /* = FailureProps */
  layout: FailureLayout;                        // {video: PanelRect, caption: PanelRect}
  panels: readonly [Day1PanelRenderProps, Day1PanelRenderProps, Day1PanelRenderProps];
  captions: readonly [string, string, string];  // 로케일 해석 완료
  captionStyle: {fontSize: number; textColor: string; barColor: string};
  fail: {
    stampEnabled: boolean; zoomEnabled: boolean; desaturateEnabled: boolean;
    shakeEnabled: boolean; sfxEnabled: boolean; focusX: number; focusY: number;
  };
  endCard: Day1EndCardRenderProps;
  sections: Day1SectionRenderProps<FailureSlot>[];   // 제네릭 기본 인자 덕에 기존 선언 불변
  audio: AudioRenderProps;
}

export type EditorSnapshot = /* 기존 4 arm */ | {template: 'failure'; props: FailureProps};
```

`Day1PanelRenderProps`([types.ts:260](../../../src/domain/editor/types.ts:260))를 그대로 쓴다 —
`label`은 `''`(failure의 텍스트는 캡션 바가 담당). `buildFailureProps`는 `buildDay1Props`와 같은
골격으로 `failureOrientationFor(project.selectedRatio)` 그룹을 해석해 panels를 만든다.

---

## 6. Domain 함수와 Compositions

### 6.1 구간 배분 — `domain/failure/playback.ts`

```ts
/** 엔드카드 3s 선취, 잔여를 실측 비율 20/10/70으로. 우수리는 마지막 패널(레벨 99). */
export const failureSectionDurations = (preset: DurationPreset): SceneDurationsMs => {
  const rest = preset * 1000 - DAY1_END_CARD_MS;
  const a = Math.round(rest * 0.2);
  const b = Math.round(rest * 0.1);
  return [a, b, rest - a - b, DAY1_END_CARD_MS];
};

export const activePanelForFailureSection = (index: number): FailureSlot | null =>
  index >= 0 && index < 3 ? (['a', 'b', 'c'][index] as FailureSlot) : null;
```

| 프리셋 | 레벨 1 | 레벨 20 | 레벨 99 | 엔드카드 | `MIN_SCENE_MS` |
|---|---:|---:|---:|---:|---|
| 30초 | 5,400 | 2,700 | 18,900 | 3,000 | 통과 |
| 60초 | 11,400 | 5,700 | 39,900 | 3,000 | 통과 |

### 6.2 FAIL 효과 — `domain/failure/effects.ts` (전부 순수)

효과 창은 **구간 1의 끝에 앵커**된다 (Plan D-3). 구간이 짧아지면 창이 구간 길이로 **압축**된다:

```ts
/** 구간 길이가 창보다 짧으면 리드부터 줄인다 — 스탬프 1초가 마지막까지 남는 몫. */
export const failWindow = (sectionDurationInFrames: number, fps: number) => {
  const stamp = Math.min(msToFrames(FAIL_STAMP_MS, fps), sectionDurationInFrames);
  const lead = Math.min(
    msToFrames(FAIL_LEAD_MS, fps),
    sectionDurationInFrames - stamp,
  );
  return {
    startFrame: sectionDurationInFrames - stamp - lead,
    stampFrame: sectionDurationInFrames - stamp,   // SFX 트리거 프레임이기도 하다
    leadFrames: lead,
    stampFrames: stamp,
  };
};
```

> **Plan R-6의 "구간 1 최소 길이 refine"은 채택하지 않는다 (D-11).** `moveTimelineBoundary`는
> 템플릿 무관하게 `MIN_SCENE_MS`로만 클램프하므로([project.ts:671](../../../src/domain/editor/project.ts:671)),
> 스키마에만 더 높은 하한을 넣으면 **합법적 드래그가 파싱 불가능한 문서를 만들고 자동저장 복원이
> 실패**한다. 대신 창이 우아하게 압축되고, 인스펙터가 권장 길이 미달 힌트를 보여준다 (§7.2).

나머지 함수 — 반환이 `null`/항등이면 컴포지션은 `style undefined`를 준다 (Goal 4):

- `failVideoStyleAt(frame, window, fail)` → `{scale, grayscale} | null` — 리드 구간에서 scale
  1→2.2 ease-out(초점 `focusX/Y`로 transform-origin 계산), grayscale 0→1; 스탬프 구간 동안 유지;
  토글이 꺼진 축은 항등.
- `failStampStyleAt(frame, window, fps)` → `{scale, opacity, rotateDeg, blurPx} | null` —
  진입 250ms: scale 4→1 ease-in, opacity 0.6→1, blur는 스케일 속도에 비례(진입 중에만 > 0);
  이후 안착 유지. 창 밖 `null`.
- `failShakeAt(frame, window, fps)` → `{dx, dy} | null` — 안착 프레임부터 `FAIL_SHAKE_MS` 동안
  고정 계수 감쇠 진동(`sin(2πf·t)·e^(−λt)` 조합). 프레임 크기 대비 비율로 반환.
- `zoomPunchAt(frameInSection, durationInFrames, fps, edges)` → `{scale, blurRatio} | null` —
  `edges: {in: boolean; out: boolean}`. 아웃: 마지막 250ms에 scale 1→2 ease-in + blur 램프.
  인: 처음 300ms에 scale 2→1 ease-out + blur 감쇠. `transitionStyleAt`처럼 **각 섹션 자기 프레임
  범위 안**에서 동작해 Σframes 불변을 지킨다 ([transition.ts:2-6](../../../src/domain/render/transition.ts:2)).
  섹션별 edges: panel-a `{in:false, out:true}`, panel-b `{in:true, out:true}`,
  panel-c `{in:true, out:false}` — **엔드카드 경계는 컷** (day1과 동일, 레퍼런스에 근거 없음).

### 6.3 `FailureComposition.tsx` / `FailureFrame.tsx`

```tsx
// FailureComposition — Day1QuadComposition과 같은 골격 (Day1QuadComposition.tsx:45-82)
<AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
  {sections.map((section, index) => (
    <Sequence from={section.fromFrame} durationInFrames={section.durationInFrames}
              premountFor={fps} key={section.id} name={section.id}>
      {section.activePanel ? (
        <FailureFrame index={index} … />
      ) : (
        <EndCardScene durationInFrames={…} endCard={endCard} />   // 무변경 재사용
      )}
    </Sequence>
  ))}
  <FailSfx …/>            {/* §6.6 — Sequence 하나 */}
  <AudioLayer audio={audio} />
</AbsoluteFill>
```

`FailureFrame` (섹션 하나의 프레임):

```
<AbsoluteFill  style={펀치 전환 + 셰이크 → transform | undefined}>   ← 캡션 포함 전체가 움직인다
  <div style={FAIL 줌·탈색 → transform·filter | undefined,           ← 영상 영역만
              overflow:'hidden', ...layout.video}>
    <Panel live liveVolume={duckedVolumeAt(...)} panel={panels[index]}
           rect={{x:0, y:0, ...layout.video 크기}} labelStyle={FAILURE_NO_LABEL} />
  </div>
  {index === 0 ? <FailStamp …/> : null}                              ← 탈색 래퍼 밖 (스탬프는 원색)
  <CaptionBar text={captions[index]} style={captionStyle} rect={layout.caption} />
</AbsoluteFill>
```

- **`Panel` 재사용 (D-1의 열매)**: live 단일 패널 + `label:''`이라 라벨 코드는 잠들고, `contain`의
  블러 백드롭·트림·프레이밍·오디오 덕킹이 전부 공짜다. FAIL의 줌·탈색은 Panel을 감싼 래퍼에서
  적용한다 — Panel 무변경.
- 레이어 순서가 실측과 일치한다: 줌·탈색은 영상에만(리드 중 캡션은 정지), 셰이크·전환은 캡션 포함
  프레임 전체에 (Plan §1.2-4, §1.3).
- `premountFor={fps}`: 경계마다 Sequence가 통째로 바뀌는 것은 quad와 같은 조건이다
  ([Day1QuadComposition.tsx:53-59](../../../src/compositions/Day1QuadComposition.tsx:53)).
- 소스 검증: 활성 방향의 패널 중 url이 null이면 Placeholder
  (`"세로(또는 가로)용 영상 3개를 모두 업로드하세요"`) — quad와 동일 위치·동일 계약.

### 6.4 `FailStamp.tsx` + 에셋 (D-6)

- **에셋**: `compositions/failure/assets/fail-stamp.png` — 빨간 그런지 고무도장 `FAIL`,
  투명 배경, ≈1600×700(1080폭 캔버스에서 폭 120%로 놓아 좌우가 삐져나가는 실측 룩).
  근거 SVG(`fail-stamp.svg`)를 같이 커밋해 재생성 가능하게 한다. **레퍼런스에서 추출하지 않고
  재창작한다** (Plan Q3/R-2) — OFL/CC0 폰트 + 자체 노이즈 텍스처. Vite 정적 import로 번들되므로
  서브패스 배포(`serve-dist-subpath`)에서 경로가 깨지지 않는다 — `public/`이 아닌 이유.
- 렌더: `<Img>`(또는 `<img>`)에 `failStampStyleAt`의 scale·opacity·rotate·blur를 인라인로.
  중심 위치는 프레임 높이 35%(실측 15~55% 밴드의 중앙). 진입 중에만 `filter: blur`가 붙고
  그 외 프레임은 `undefined`.
- 품질 게이트(R-2): M4에서 레퍼런스 4.1s 프레임과 나란히 스크린샷 비교를 산출물로 남긴다.

### 6.5 `CaptionBar.tsx`

`DisclaimerBar` 선례([DisclaimerBar.tsx:12-42](../../../src/compositions/kvloop/DisclaimerBar.tsx:12))의
확장 — 바가 있는 버전:

```tsx
<div style={{...rect절대배치, backgroundColor: style.barColor,
             display:'flex', alignItems:'center', justifyContent:'center'}}>
  <span style={{color: style.textColor, fontWeight: 800, letterSpacing: '0.04em',
                fontFamily: 'system-ui, sans-serif',
                fontSize: style.fontSize * (frameHeight / 1920),   // D-3 비례 규칙
                whiteSpace: 'nowrap'}}>
    {text}
  </span>
</div>
```

- `rect = failureLayout(ratio).caption` — 바 높이는 상수 `FAILURE_CAPTION_RATIO = 0.10`
  (실측 §1.4). 저장 필드가 아니다: 조절 요청이 없고, 영상 영역 기하와 맞물려 있다.
- 빈 문자열이면 텍스트만 생략, 바는 유지(구간 간 시각 연속성). 엔드카드 구간에는 CaptionBar 자체가
  마운트되지 않는다 (§6.3 구조상).

`domain/failure/layout.ts`:

```ts
export interface FailureLayout {video: PanelRect; caption: PanelRect}
export const failureLayout = (ratio: AspectRatio): FailureLayout => {
  const {width, height} = RATIO_DIMENSIONS[ratio];
  const caption = Math.round(height * FAILURE_CAPTION_RATIO);
  return {
    video: {x: 0, y: 0, width, height: height - caption},
    caption: {x: 0, y: height - caption, width, height: caption},
  };
};
// 9:16 → video 1080×1728 / caption 1080×192, 16:9 → 1920×972 / 1920×108
```

### 6.6 SFX — `fail-thud.wav` (D-7, FR-11 Should)

- `scripts/generate-poc-audio.mjs`와 같은 방식의 생성 스크립트(`generate-fail-sfx.mjs`)로 저주파
  임팩트(사인 버스트 + 노이즈 테일, ≈300ms)를 합성해 `compositions/failure/assets/fail-thud.wav`로
  커밋한다. 실측 근거: 스탬프 슬램에 +8dB 스파이크 (Plan §1.2).
- `FailSfx`: `fail.sfxEnabled && fail.stampEnabled`일 때, 구간 1의 `stampFrame` 절대 프레임에서
  `<Sequence>` + 오디오 엘리먼트 하나. `AudioLayer`와 같은 패키지의 컴포넌트를 쓴다(M4에서 확인해
  동일 소스 사용 — BGM과 다른 패키지를 섞지 않는다).
- 음량은 고정 1.0 — 조절 필드는 요청되면 그때 (CLAUDE.md §2).

---

## 7. UI · 렌더 경로

### 7.1 `EditorWorkspace` 분기

[EditorWorkspace.tsx:303-312](../../../src/features/editor/EditorWorkspace.tsx:303)의 narrower 블록에
`const failure = failureOf(project)` 추가. 이하:

- **프롭 메모**: `buildFailureProps` memo 한 개 (기존 4개와 나란히, :445-463).
- **Player 스위치**(:1342-1390): `FailureComposition` arm.
- **인스펙터 스위치**(:1429-1561): `kvLoop → failure → panelled → scene` 순.
- **에셋 패널 스위치**(:1026-1081): failure면 `Day1AssetPanel`을 방향 라벨·failure 콜백으로 렌더 (§7.3).
- **retain 목록**(:404-437): failure의 **양 방향 6소스** + 엔드카드 3참조를 추가 — quad가 C·D 누락으로
  겪은 URL 회수 사고의 재발 방지가 주석에 이미 적혀 있다.
- **렌더 게이트**(:470-504): `missingPanels`류를 failure 함수로 확장 (§7.5).
- 비율 토글 UI는 기존 것 그대로 — failure에서는 1:1 버튼만 비활성(kv-loop이 고정 비율에서 쓰는
  방식과 동일한 disabled 처리).

### 7.2 `FailureInspector` — 추출 조각의 조립

M1이 추출한 `PanelSection`(트림+프레이밍) 3개(활성 방향 바인딩) + 신규 캡션 섹션(fontSize·색 2종 +
로케일별 문구 3칸 — `setFailureLabelText`) + 신규 FAIL 섹션(토글 5개 + 초점 XY 슬라이더) +
M1이 추출한 `EndCardSection`. 접기는 기존 `InspectorSection` 재사용.

- 방향 표시: 인스펙터 상단에 `현재 편집: 세로(9:16)` 배지 — 편집 대상이 비율 토글에 묶여 있음(D-1)을
  조작자에게 말해 준다.
- 힌트(D-11): 구간 1 길이 < `FAIL_WINDOW_MS + 1000ms`이면 `panel__hint`로
  `"레벨 1 구간이 짧아 FAIL 연출이 압축됩니다"`.

### 7.3 에셋 — 파라미터화된 훅 + 패널

`useDay1Assets`(M1 파라미터화, §4.1-2)를 failure는 이렇게 바인딩한다:

```ts
type FailureSlotKey = `${FailureOrientation}:${'panelA'|'panelB'|'panelC'}`;  // 6키
useDay1Assets<FailureSlotKey>({
  slots: 6키 전부,                       // 복원·retain은 양 방향
  panelOf: (k) => failurePanelAt(project, ...decode(k)),
  commands: {setPanelSource: (k, ref) => setFailurePanelSource(..., ...decode(k), ref), …},
});
```

`Day1AssetPanel`에는 **활성 방향 3키만** `panels`로 내려보낸다. 라벨·testid는 M1에서 prop으로 열어
둔다(`panelLabels`, `testIdPrefix` — 기본값이 현재 하드코딩 값이라 day1 계열 무변경): failure는
`레벨 1 (세로)` 식 라벨과 `failure-panel-a` 식 testid를 쓴다. 패널 위 안내문 한 줄:
`"가로형(16:9) 영상은 우상단 비율을 16:9로 바꿔 따로 업로드하세요"` (Q2의 UI 표면).

### 7.4 프록시 — `panelProxies.ts` arm

[panelProxies.ts:125-137](../../../src/features/editor/panelProxies.ts:125)의 키 목록·박스 매핑에 arm:

```ts
keys  = failure ? FAILURE_PANEL_KEYS : panelKeysOf(settings);
boxOf = failure ? failureLayout(ratio).video : (기존 quad/split 경로);
panel = failure ? failurePanelAt(project, failureOrientationFor(ratio), key) : day1PanelAt(...);
```

`planPanelProxy` 무변경. **런타임 효과와의 정합성**: FAIL 줌·전환 줌은 전부 scale ≥ 1(확대)이라
가시 영역의 부분집합만 보여 프록시 크롭이 안전하고, 셰이크는 프레임(섹션 래퍼) 레벨이라 프레임
가장자리에 드러나는 것은 캔버스색이지 프록시 경계가 아니다 — 레퍼런스도 셰이크 중 가장자리 갭이
보인다 (Plan §1.2-4). 이 근거를 arm 주석으로 남긴다.

### 7.5 렌더 요청·프리플라이트

- `EditorRenderRequest` 유니온 + `createEditorRenderRequest` arm(`id: 'failure-editor'`) —
  [renderEditor.ts:33-37, 75-112](../../../src/infrastructure/render/renderEditor.ts:33). 인코딩 블록은
  템플릿 무관이라 그대로.
- 프리플라이트([useRenderQueue.ts:85-146](../../../src/features/editor/useRenderQueue.ts:85))에 failure
  분기: `render.selectedRatios`의 **각 비율**에 대해 해당 방향 그룹을 검사한다.

```ts
export const failureMissingPanels = (project) =>
  // [{orientation, key}] — 선택된 렌더 비율이 요구하는 방향만
export const failurePanelsShorterThanSection = (project) => // 동일 순회
```

  메시지는 방향을 명시한다: `"가로(16:9)용 영상 3개를 모두 올려야 렌더할 수 있습니다. 남은 슬롯: 레벨 1 · 레벨 20"`.
  `sourceResolved`는 워크스페이스가 6슬롯 훅의 URL로 계산한다(선택된 비율의 방향만).
- 배치(`useRenderQueue.drain`)는 비율별 스냅샷을 이미 다시 만들므로(`selectedRatio` 교체 →
  `buildEditorSnapshot`), 방향 해석이 자동으로 따라온다 — **failure 전용 배치 코드 없음**.

### 7.6 Error Handling

새 `AppErrorCode` 없음 (quad §8과 동일 방침).

| 상황 | 처리 |
|---|---|
| 활성 방향 소스 일부 없음 | Placeholder(§6.3) + 프리플라이트 차단(§7.5) |
| 비활성 방향(선택된 렌더 비율에 포함) 소스 없음 | 프리플라이트가 방향 명시 문구로 차단 — Q2 "자동 폴백 없음" |
| 소스가 구간보다 짧음 | `failurePanelsShorterThanSection` → 기존 경고 문구 재사용 |
| 가져온 JSON이 15초/1:1 failure | 스키마 오류 (§4.3 refine) |
| 구간 1이 짧음 | 오류 아님 — 창 압축(D-11) + 인스펙터 힌트 |

---

## 8. Test Plan

### 8.1 Unit (신규 co-located `.test.ts`)

| 대상 | 검사 |
|---|---|
| `failureLayout` | 2비율 전수: video+caption 높이 합 === 출력 높이, 폭 일치, 캡션 = round(10%) |
| `failureSectionDurations` | 2프리셋: 합 === preset×1000, 각 ≥ `MIN_SCENE_MS`, 엔드카드 3000 |
| `failWindow` | 정상/압축(구간 < 1.5s)/극단(구간 == stamp) — stamp가 마지막까지 남는지 |
| `failVideoStyleAt`·`failStampStyleAt`·`failShakeAt`·`zoomPunchAt` | 창 밖 `null`/항등, 경계 프레임 값, 토글 off 축 항등, 스케일 ≥ 1 불변(프록시 안전, §7.4) |
| 스키마 arm | 파싱, 4구간 id 순서, 15초 거부, 1:1(selectedRatio·selectedRatios 각각) 거부, 6패널 trim refine |
| 저장 문서 왕복 | day1·quad·kv 기존 픽스처가 무변경으로 파싱(D-2의 narrower 교체 회귀) |
| `switchTemplate('failure')` | 프리셋 60 유지/15→30, 1:1 제거, 라벨 4로케일 주입, 섹션 4개 |
| failure 커맨드 | 방향별 쓰기 격리(세로 수정이 가로 불변), 타 템플릿 no-op, day1에 failure 커맨드 no-op |
| `reconcileFailureTrims` | 경계 이동 후 6패널 재클램프 |
| 프리플라이트 | 선택 비율별 방향 검사 — 9:16만 선택 시 가로 누락이 통과, 16:9 추가 시 차단 |
| `buildFailureProps` | 스냅샷: 방향 해석(selectedRatio 토글로 panels url 교체), 프레임 배분 합, 캡션 로케일 해석 |
| `buildOutputFileName` | `fail` 세그먼트 |
| `endCardSettingsOf` | 3템플릿 + null |

### 8.2 E2E — `tests/e2e/failure.spec.ts`

| 시나리오 | 단언 |
|---|---|
| `switchTemplate` 헬퍼로 전환(60초 프로젝트) | 프리셋·비율 안내 노출, 섹션 4개, 라벨 기본값 |
| 세로 3개 업로드 → 프리뷰 → **실제 MP4 1개** (30초·9:16) | SC 대응: ① 구간 1 마지막 1초 프레임에서 스탬프 적색(`sampleRegion` + `hexToRgb`) ② 같은 프레임 `meanSaturation` ≈ 0 (탈색) ③ 경계 ±0.2s에서 캡션 바 상단 에지 이탈 → 복귀 (전환) ④ 세 구간 각각 하단 10% 바 색 + 문구 상이 ⑤ 마지막 3초 엔드카드 |
| 16:9를 배치에 추가(가로 미업로드) | 방향 명시 프리플라이트 차단 문구 — Q2 검증, 렌더 없이 저렴 |
| 16:9로 비율 토글 | 에셋 패널이 가로 슬롯(빈 상태)으로 바뀜 — D-1 검증 |

렌더 픽셀 단언은 `tests/e2e/helpers/videoSampling.ts`의 기존 헬퍼만 쓴다. 컨테이너에 H.264 코덱이
없으면 렌더 스펙은 환경 실패로 남는다(quad report §e2e 선례) — 실기기 검증이 M7 게이트.

### 8.3 성능 (SC7)

`run-render-benchmark.mjs`로 동일 소스 day1 단일 패널 대비 벽시계 비교. 효과 프레임 비중(30초 기준
FAIL 45프레임 + 전환 ~33프레임 ≈ 총 900프레임의 9%)이 낮아 +15% 이내를 기대치로 두되, **측정으로
확정**한다 — quad M0의 교훈: 웹 렌더러 버킷이 아니라 벽시계로.

---

## 9. Architecture Compliance

| 규칙 | 준수 |
|---|---|
| `domain`이 React·Remotion·Zustand 무임포트 | `domain/failure/*` 전부 순수 함수·상수 |
| `compositions`가 스토어 무임포트 | `FailureComposition`은 프롭만 |
| 템플릿 추가 = arm 둘 | `templateSettings` + `buildEditorSnapshot` (conventions §3.1) |
| 커맨드는 타 템플릿 no-op | `failureOf` null 가드, day1 커맨드는 failure에서 자동 no-op (§4.1-3) |
| 스키마가 런타임 진실 | 프리셋·비율 제약이 refine에 (§4.3) |
| 렌더는 프록시 준비 경유 | §7.4 arm — `architecture.test.ts:160-179`가 강제 |

`architecture.test.ts`의 규칙 표는 바뀌지 않는다 — 새 레이어 없음(`domain/failure`는 기존
`domain/day1`과 같은 급).

---

## 10. Out of Scope (별도 사이클)

| 항목 | 근거 |
|---|---|
| 하단 Level 99 영상 고정 재생(분할형) | Plan Q1에서 텍스트형 확정 |
| 스탬프 PNG 교체 슬롯·문구 변경 | Plan Q3에서 내장 단일 확정. 미디어 참조 1필드로 확장 가능성만 기록 |
| 전환·셰이크 파라미터 UI | 레퍼런스 충실 상수 (§5.3). 조절 요청이 오면 그때 스키마에 |
| 캡션 바 높이·표시 토글 | 실측 10% 고정. 같은 이유 |
| 구간 수 가변(레벨 4개+) | 섹션 축은 이미 [2,8] — 스키마 여지만 있고 요구 없음 |
| SFX 음량 조절 | §6.6 — 토글만 |
| 1:1 비율 | 요청서에서 명시 제외 |

---

## 11. Implementation Order

| # | 모듈 | 산출물 | 게이트 |
|---|---|---|---|
| M1 | 공통 경로 (§4) | PanelSection·EndCardSection 추출, useDay1Assets 파라미터화, endCard narrower 교체, 파일명·라벨·선택기 문구 | **기존 스위트 전량 그린** — failure 코드 0줄 |
| M2 | 스키마·상수 (§4.3, §5.1-5.5) | arm, FAILURE_* 상수, 기본값, failureLabels, refine, `switchTemplate`·`applyDurationPreset`·`failureSectionDurations` arm | 유닛 + 저장 문서 왕복. **quad M2의 발견 재적용**: `TEMPLATE_KINDS` 추가 즉시 선택기에 노출되므로 `SELECTABLE_TEMPLATES` 가드를 두고 M5가 지운다 |
| M3 | 도메인 (§6.1, §6.2, §5.6) | layout·orientation·playback·effects + 커맨드 10종 + reconcile + 프리플라이트 함수 | 유닛 — 효과 함수 경계·압축·불변 전수 |
| M4 | 에셋 + 컴포지션 (§6.3-6.6) | fail-stamp.png(+SVG)·fail-thud.wav(+스크립트), FailStamp·CaptionBar·FailureFrame·FailureComposition, `buildFailureProps` + 스냅샷 arm | 유닛(프롭 빌더) + **레퍼런스 대조 스크린샷** (R-2 체크포인트, 사용자 리뷰) |
| M5 | UI (§7.1-7.3) | FailureInspector, 에셋 패널 바인딩, 비율 disabled, retain, 가드 해제 | 수동 플로우: 전환 → 업로드 → 문구 → 비율 토글 → 프리뷰 |
| M6 | 렌더·프록시 (§7.4-7.5) | 렌더 arm, panelProxies arm, 프리플라이트 연결 | E2E 실제 MP4 (§8.2) |
| M7 | 검증·리포트 | SC 전량 + 성능(§8.3) + `docs/03-analysis/failure-video.analysis.md` | 전체. 코덱 없는 환경이면 실기기에서 렌더 스펙 |

### 11.1 Do Entry Checklist

- [ ] M1이 failure 코드 0줄인가 (§3)
- [ ] `PanelSection`·`EndCardSection` 추출이 순수 이동인가 — Day1Inspector 마크업 diff 0
- [ ] `useDay1Assets` 파라미터화 후 day1·quad 호출부 동작 동일한가 (기존 E2E)
- [ ] `Panel.tsx`·`EndCardScene.tsx`·`endCard.ts`·`sourceProxy.ts`·`timeline.ts` 무변경인가
- [ ] `PROJECT_SCHEMA_VERSION`이 2인가
- [ ] 효과 함수가 전부 `(frame, …)` 순수이고 효과 밖 반환이 `null`인가 (Goal 3·4)
- [ ] 스탬프·SFX 에셋이 재창작물이고 근거(SVG·생성 스크립트)가 커밋됐는가 (Q3)

---

## 12. Requirement Traceability

| Plan FR | 설계 위치 |
|---|---|
| FR-01 kind `failure`·4섹션·버전 2 | §5.1, §5.2 |
| FR-02 구간당 1영상, 상단 90% | §6.3 FailureFrame, §6.5 failureLayout |
| FR-03 방향별 소스, 폴백 없음 | §5.2 D-0, §7.3, §7.5 |
| FR-04 FAIL 마지막 고정 + 토글 | §6.2 failWindow(D-11 압축 규칙), §6.3-6.4 |
| FR-05 줌 펀치 전환, Σ불변 | §6.2 zoomPunchAt, §5.3 상수 |
| FR-06 캡션 바 + failureLabels | §5.4, §6.5 |
| FR-07 엔드카드 재사용 신규 0줄 | §4.1-3, §6.3 (EndCardScene 무변경) |
| FR-08 9:16·16:9 전용 | §4.3, §7.1 |
| FR-09 프리셋 30/60 + 기본 배분 20/10/70 | §4.3, §6.1 |
| FR-10 렌더 arm + 프록시 경유 + 파일명 | §7.4, §7.5, §4.2 |
| FR-11 SFX (Should) | §6.6 D-7 |
| FR-12 줌 초점 (Should) | §5.2 `fail.focusX/Y`, §6.2 |
| NFR-01 효과 밖 비용 0 | Goal 4, §6.2 null 계약, §8.3 |
| NFR-02 결정성 | Goal 3, §5.3 (셰이크 무시드 근거) |
| NFR-03 규약 | §9 |

---

## 13. 설계 결정 요약

| # | 결정 | 근거 절 |
|---|---|---|
| D-0 | 방향 그룹 `vertical/horizontal × day1PanelSchema` | §2.3 |
| D-1 | 편집 방향 = 미리보기 비율 (`failureOrientationFor`) | §1.2 |
| D-2 | 엔드카드 커맨드 4종만 narrower 공유, 나머지는 신규/no-op | §4.1 |
| D-3 | 캡션 fontSize는 1920h 기준 px + 비례 렌더, 바 높이는 상수 10% | §5.2, §6.5 |
| D-4 | 프리셋·비율 제약은 상수+refine+강제변환+다이얼로그의 3점 세트 | §4.3 |
| D-5 | 효과 상수는 실측값, 전환·셰이크는 비저장 | §5.3 |
| D-6 | 스탬프는 재창작 PNG 내장(Vite import), 근거 SVG 커밋 | §6.4 |
| D-7 | SFX는 합성 wav 내장 + 토글, 음량 고정 | §6.6 |
| D-8 | 추출(PanelSection·EndCardSection)·파라미터화(useDay1Assets·Day1AssetPanel)로 UI 재사용 | §4.1, §7.2-7.3 |
| D-9 | 스탬프는 탈색 래퍼 밖(원색 유지), 셰이크·전환은 프레임 전체, 줌·탈색은 영상만 | §6.3 |
| D-10 | 프록시 안전성: 효과는 전부 scale ≥ 1 + 셰이크는 프레임 레벨 | §7.4 |
| D-11 | 구간 1 하한 refine 대신 창 압축 + 힌트 — **Plan R-6 접근을 의도적으로 대체** (드래그가 만든 합법 상태가 파싱 불가가 되는 것을 막는다) | §6.2 |

---

## Version History

| 날짜 | 변경 |
|---|---|
| 2026-08-28 | 초안. Plan 결정(Q1-Q4·D-1~5)과 레퍼런스 실측을 반영. 설계 결정 D-0~D-11 확정 |
