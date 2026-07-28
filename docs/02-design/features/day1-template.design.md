# Day1 Template Design Document

> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-07-28
> **Status**: Approved for Do
> **Plan**: [day1-template.plan.md](../../01-plan/features/day1-template.plan.md)
> **Architecture**: **Option C — 공통 구간 + 템플릿 페이로드** (사용자 선택)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 성과가 검증된 Before/After 분할 비교 포맷을 브라우저 안에서 반복 생산하고, 앞으로 UA 포맷을 늘릴 템플릿 기반을 만든다. |
| **WHO** | 사내 UA Manager와 마케터. 기존 3장면 템플릿 사용자와 동일하며, 두 경로를 오간다. |
| **RISK** | 스키마 v1→v2 마이그레이션이 기존 저장 프로젝트를 깨뜨릴 위험, 정지 프레임 디코딩까지 포함한 2영상 렌더 비용, 16:9 엔드카드가 다른 저장소 작업에 막혀 있다는 점. |
| **SUCCESS** | Day1로 영상 2개를 편집해 3규격 각각 실제 MP4를 뽑고, 흑백 전환·분할선 색·엔드카드 애니메이션이 렌더 결과물에서 확인되며, 기존 3장면 프로젝트가 회귀 없이 열리고 렌더된다. |
| **SCOPE** | 규격 16:9 엔드카드 선행 작업 → 템플릿 판별자 도입 → Day1 분할 컴포지션 → 인스펙터·스포이트 → 엔드카드 → 렌더·Batch 통합 순으로 진행한다. |

> **SCOPE 갱신**: 16:9 엔드카드(bannerdesigner 작업)와 MPEG-4 호환 확대는 사용자 결정에 따라 **별도 사이클로 분리**했다. 이번 설계는 나머지를 다룬다.

---

## 1. Overview

### 1.1 Design Goals

1. 기존 3장면 경로의 동작을 **한 줄도 바꾸지 않는다**. 회귀 방어선이다.
2. 템플릿 추가가 스키마 재설계를 요구하지 않는 구조를 만든다.
3. Day1의 시간 축을 기존 타임라인 위에 얹어 새 조작 개념을 만들지 않는다.

### 1.2 Key Insight — Day1은 이미 3구간이다

Day1의 시간 구조는 `[영상A 활성 · 영상B 활성 · 엔드카드]` 3구간이고, **A|B 경계가 곧 컬러 전환 시점**(Plan D2)이다. 기존 3장면과 구간 수가 같다.

타임라인 도메인([timeline.ts](../../../src/domain/timeline/timeline.ts))은 이미 `SceneDurationsMs`(순수 3튜플) 위에서만 동작한다. `EditorScenes` 형태에 묶인 함수는 `sceneDurationsOf` **하나뿐**이다. 따라서 경계 드래그·총길이 불변식·프레임 배분·프리셋은 **무수정 재사용**된다.

### 1.3 Confirmed Decisions

Plan §1.3의 D1~D8에 더해 Design 단계에서 확정한 것:

| # | 결정 | 근거 |
|---|------|------|
| D9 | **Option C** — `sections`(길이·순서) 공통 + `templateSettings` 판별 유니온 | 타임라인·Batch·파일명이 무수정 재사용되고 죽은 필드가 없다 |
| D10 | `sections`는 당분간 **3튜플 고정** | 두 템플릿 모두 3구간이다. N구간 일반화는 실제로 필요한 템플릿이 생길 때 (YAGNI) |
| D11 | 비활성 패널은 **자기 trim-in 프레임**에 정지 | Plan D1의 "첫 프레임" 문언 그대로. Do에서 육안 확인 후 이견 있으면 재논의 |
| D12 | 16:9 엔드카드는 아이콘 **수동 배치**로 축퇴 | bannerdesigner에 16:9 좌표가 없다. 상수가 생기면 자동 배치로 승격 |
| D13 | 스파이크 결과에 따라 **정지 프레임 사전 추출 설계는 폐기** | 실측 0.99×. [render-spike](../../03-analysis/day1-template.render-spike.md) |

---

## 2. Architecture

### 2.0 Option Comparison

| | A. 최소 변경 | B. 완전 분리 | **C. 공통 구간 + 페이로드** |
|---|---|---|---|
| 기존 경로 위험 | 최저 | 최고 | 중 |
| 죽은 필드 | 누적 | 없음 | 없음 |
| 타임라인·Batch | 재사용 | 분기 필요 | **무수정 재사용** |
| 템플릿 3번째 | 선택 필드 추가 | 소비자 전부 수정 | 2곳 |
| **선택** | | | **✅** |

### 2.1 Component Diagram

```text
app/App.tsx
  └─ EditorWorkspace ── TemplateSelector (header)
       ├─ template === 'three-scene'  ─→ SceneInspector      ─→ ThreeSceneComposition
       └─ template === 'day1'         ─→ Day1Inspector       ─→ Day1Composition
                                             │                      ├─ SplitFrame (panel A/B)
                                             │                      └─ EndCardScene
       └─ Timeline  ← sections (템플릿 무관, 무수정)

domain/
  ├─ editor/schema.ts      sections + templateSettings 판별 유니온, v2
  ├─ editor/migrate.ts     v1 → v2 (신규)
  ├─ timeline/timeline.ts  sectionDurationsOf 추가 외 무변경
  └─ day1/                 layout.ts · playback.ts · endCard.ts (순수, 신규)

infrastructure/render/renderEditor.ts   template으로 컴포지션 분기
```

### 2.2 Data Flow — Day1 렌더

```text
Day1Settings + sections + selectedRatio
  → splitLayout(ratio)            패널 2개의 사각형과 방향
  → allocateSectionFrames()       기존 함수, 구간별 프레임
  → buildDay1Props()              해상된 URL을 담은 렌더 스냅샷
  → Day1Composition
      Sequence[0]  SplitFrame active='a'   A 재생 / B Freeze+grayscale
      Sequence[1]  SplitFrame active='b'   B 재생 / A Freeze+grayscale
      Sequence[2]  EndCardScene            배너 배경 + 아이콘 오버레이 애니메이션
```

### 2.3 Performance

스파이크 실측 완료. 15초 1080×1920 60fps 기준 **baseline 10.92s / day1 10.75s = 0.99×**. 게이트 1.5× 대비 여유가 크다. 근거와 한계는 [day1-template.render-spike.md](../../03-analysis/day1-template.render-spike.md).

**남은 확인**: 스파이크는 같은 파일을 두 번 참조했다. Do 단계에서 **서로 다른 소스 2개**로 재측정한다(디코더 인스턴스 2개, 메모리 증가 가능).

---

## 3. Data Model

### 3.1 Section — 템플릿 무관 시간 축

```ts
export const SECTION_COUNT = 3;

export const sectionSchema = z.object({
  /** 'hook'|'gameplay'|'cta' | 'panel-a'|'panel-b'|'endcard' */
  id: z.string().min(1),
  label: z.string().min(1),          // 타임라인 클립에 표시
  durationMs: z.number().min(MIN_SCENE_MS),
});

sections: z.tuple([sectionSchema, sectionSchema, sectionSchema])
```

### 3.2 Template Settings — 판별 유니온

```ts
// 기존 per-scene 데이터를 그대로 옮긴다. 필드는 하나도 바뀌지 않는다.
export const threeSceneSettingsSchema = z.object({
  template: z.literal('three-scene'),
  source: mediaReferenceSchema.nullable(),
  scenes: z.tuple([sceneSettingsSchema, sceneSettingsSchema, sceneSettingsSchema]),
  //        { kind, trim, transforms, subtitle, transitionOut, hook?, cta? }
});

export const day1PanelSchema = z.object({
  source: mediaReferenceSchema.nullable(),
  trim: mediaTrimSchema,
  transforms: ratioTransformsSchema,   // Cover + Scale/X/Y, 규격별 override (Plan D5)
});

export const day1SettingsSchema = z.object({
  template: z.literal('day1'),
  panelA: day1PanelSchema,
  panelB: day1PanelSchema,
  split: z.object({
    lineColor: hexColorSchema,                    // 기본 '#9ca3af'
    lineWidthPx: z.number().min(0).max(24),       // 기본 6
  }),
  labelStyle: z.object({                          // 문구 자체는 copy에 (3.3)
    fontSize: z.number().min(MIN_SUBTITLE_FONT_SIZE).max(MAX_SUBTITLE_FONT_SIZE),
    textColor: hexColorSchema,                    // 기본 '#ffffff'
    outlineColor: hexColorSchema,                 // 기본 '#000000'
    outlineWidthPx: z.number().min(0).max(16),    // 기본 8 — GIF 스타일
    position: z.enum(['top', 'center', 'bottom']),
  }),
  endCard: z.object({
    banner: mediaReferenceSchema.nullable(),      // bannerdesigner 완성본
    appIcon: mediaReferenceSchema.nullable(),     // 오버레이용 원본
    iconAdjust: z.object({                        // 자동 배치 위 미세조정 (FR-D13)
      dx: z.number().min(-0.5).max(0.5),          // 프레임 폭 비율
      dy: z.number().min(-0.5).max(0.5),
      scale: z.number().min(0.5).max(2),
    }),
    iconAnimation: z.enum(['pop', 'pulse', 'glow', 'none']),
    cardMotion: z.enum(['ken-burns', 'fade', 'none']),
  }),
});

templateSettings: z.discriminatedUnion('template',
  [threeSceneSettingsSchema, day1SettingsSchema])
```

### 3.3 Copy — 4언어 라벨 (Plan D6)

`localizedCopySchema`에 필드 하나를 더한다. 기존 4언어 구조를 그대로 쓴다.

```ts
day1Labels: z.object({ a: copyTextSchema, b: copyTextSchema }).optional()
```

`optional()`이라 v1 문서가 그대로 통과한다.

### 3.4 Project

```ts
editorProjectSchema = z.object({
  schemaVersion: z.literal(2),        // 1 → 2
  id, name, createdAt, updatedAt,
  durationPreset, fps,
  sections,                            // 3.1
  templateSettings,                    // 3.2
  copy, audio, render, selectedLocale, selectedRatio,   // 무변경
})
```

`source`와 `scenes`는 최상위에서 사라지고 `templateSettings` 아래로 내려간다. 이것이 이번 설계에서 기존 코드를 건드리는 **유일한** 구조 변경이다.

### 3.5 Invariants

기존 불변식은 `sections` 기준으로 옮기고, 템플릿별 불변식은 각 페이로드에서 검사한다.

| 불변식 | 적용 |
|--------|------|
| 구간 길이 합 = `durationPreset × 1000` | 공통 (기존과 동일) |
| 구간 최소 1초 | 공통 |
| `sections[i].id`가 템플릿의 기대 순서와 일치 | 템플릿별 |
| hook은 scene 0, cta는 scene 2 | three-scene만 |
| 전환 길이 ≤ 구간의 절반 | three-scene만 |
| **panelA·panelB 모두 소스가 있어야 렌더 가능** | day1만 (FR-D03) |
| trim이 소스 길이 안에 | 공통 (패널별) |

### 3.6 Migration v1 → v2

```ts
// domain/editor/migrate.ts
export const migrateProject = (input: unknown): Result<EditorProject> => {
  // schemaVersion 1이면 아래 변환 후 v2 스키마로 검증
  //   sections        ← scenes.map(s => ({id: s.kind, label: SCENE_LABELS[s.kind],
  //                                       durationMs: s.durationMs}))
  //   templateSettings ← {template: 'three-scene', source, scenes: scenes.map(strip durationMs)}
  // schemaVersion 2면 그대로 검증
  // 그 외면 SCHEMA_UNSUPPORTED 에러
};
```

적용 지점 2곳: `projectRepository.load()`, JSON 가져오기(`projectFile.ts`).

**실패 시 원본을 지우지 않는다.** 마이그레이션 실패는 사용자에게 알리고 저장된 레코드는 그대로 둔다 (Plan 리스크 1).

---

## 4. Day1 Domain (순수)

### 4.1 Split Layout — `domain/day1/layout.ts`

```ts
export interface PanelRect { x: number; y: number; width: number; height: number }
export interface SplitLayout {
  orientation: 'vertical' | 'horizontal';
  a: PanelRect;   // 항상 먼저 재생되는 쪽 = 위 또는 왼쪽
  b: PanelRect;
  line: PanelRect;
}
export const splitLayout = (ratio: AspectRatio, lineWidthPx: number): SplitLayout
```

| 출력 | 방향 | 패널(선 6px 기준) | 재생 순서 |
|------|------|-------------------|-----------|
| 1080×1080 (1:1) | 상하 | 1080×537 | 위 → 아래 |
| 1920×1080 (16:9) | 좌우 | 957×1080 | 왼쪽 → 오른쪽 |
| 1080×1920 (9:16) | 상하 | 1080×957 | 위 → 아래 |

각 패널은 Cover로 채우고 `transforms`로 재프레이밍한다 (Plan D5).

### 4.2 Playback — `domain/day1/playback.ts`

```ts
export type ActivePanel = 'a' | 'b';
/** 구간 인덱스로부터 활성 패널. 엔드카드 구간은 null. */
export const activePanelForSection = (index: 0 | 1 | 2): ActivePanel | null
export const day1SectionDurations = (preset: DurationPreset): SceneDurationsMs
//  15 → [6000, 6000, 3000] / 30 → [13500, 13500, 3000] / 60 → [28500, 28500, 3000]
//  A|B는 균등(Plan D2 "기본 중간"), 엔드카드는 3초 고정 시작값
```

### 4.3 End Card Geometry — `domain/day1/endCard.ts`

bannerdesigner `today-banner-designer.html`의 `.banner.tmpl-app-badge.size-* .ab-icon` CSS에서 추출한 상수다. 아이콘 크기를 바꾸는 사용자 컨트롤이 없어 결정적이다.

```ts
/** 출처: mkt_bannerdesigner today-banner-designer.html §.ab-icon (2026-07-28 기준).
 *  bannerdesigner의 app-badge 레이아웃이 바뀌면 여기도 갱신해야 한다. */
export const APP_ICON_RECT: Partial<Record<AspectRatio, NormalizedRect>> = {
  '1:1':  {x: 0.26111, y: 0.34722, w: 0.47685, h: 0.47685, radius: 0.08889},
  '9:16': {x: 0.18519, y: 0.42708, w: 0.62963, h: 0.35417, radius: 0.11111},
  // '16:9' 없음 — bannerdesigner app-badge에 1920×1080 레이아웃이 없다 (별도 사이클).
  //         D12에 따라 수동 배치로 축퇴한다.
};
export const appIconRect = (ratio, adjust): NormalizedRect | null
```

`16:9`는 `null`을 반환한다. 인스펙터가 "16:9는 자동 배치 좌표가 없습니다. 수동으로 맞추세요."를 띄우고 화면 중앙을 기본값으로 준다.

---

## 5. Compositions

### 5.1 `Day1Composition.tsx`

```tsx
<AbsoluteFill>
  <Sequence from={0}     durationInFrames={fA}> <SplitFrame active="a" .../> </Sequence>
  <Sequence from={fA}    durationInFrames={fB}> <SplitFrame active="b" .../> </Sequence>
  <Sequence from={fA+fB} durationInFrames={fC}> <EndCardScene .../>          </Sequence>
  <AudioLayer audio={audio} />   {/* 기존 컴포넌트 재사용 */}
</AbsoluteFill>
```

### 5.2 `SplitFrame`

패널 하나당:

- **활성**: `<Video>` 재생. `volume`은 기존 `duckedVolumeAt`으로 계산 (Plan D7).
- **비활성**: `<Freeze frame={0}>` + `<Video muted style={{filter:'grayscale(1)'}} trimBefore={trimInFrames}/>`
  CTA 배경이 이미 쓰는 패턴이며([CtaScene.tsx:41](../../../src/compositions/scenes/CtaScene.tsx:41)) 스파이크로 성능까지 확인했다.
- 분할선은 두 패널 사이의 `div`, 색은 `split.lineColor`.
- 라벨은 패널 위 오버레이. 외곽선은 `paint-order: stroke` + `-webkit-text-stroke`.

### 5.3 `EndCardScene`

```text
레이어 0  배너 PNG          objectFit: cover, cardMotion(ken-burns/fade) 적용
레이어 1  앱아이콘 PNG      appIconRect(ratio, adjust) 위치, iconAnimation 적용
```

**제약**: 배너 PNG에 아이콘이 이미 구워져 있으므로 **축소·이동은 밑을 드러낸다**. `iconAnimation` 프리셋은 전부 `scale ≥ 1`을 유지하도록 설계한다.

| 프리셋 | 구현 | 안전성 |
|--------|------|--------|
| `pop` | `spring()`으로 1.0 → 1.12 → 1.0 | scale ≥ 1 유지 |
| `pulse` | `interpolate(sin)`으로 1.0 ↔ 1.06 반복 | scale ≥ 1 유지 |
| `glow` | `box-shadow` 발광만, 변형 없음 | 완전 안전 |
| `none` | 오버레이 미표시 (배너 원본 그대로) | 완전 안전 |

---

## 6. UI

### 6.1 Template Selector

헤더 브랜드 우측에 세그먼트 컨트롤. `data-testid="template-selector"`, 옵션 `template-three-scene` / `template-day1`.

**템플릿 전환은 파괴적이다** — 3장면의 per-scene 설정과 Day1의 패널 설정은 서로 옮길 수 없다. 전환 시 확인 다이얼로그를 띄우고, 확인하면 해당 템플릿의 기본 프로젝트로 교체한다. 공통 필드(이름·copy·audio·render 설정)는 유지한다.

### 6.2 Day1 좌측 패널 (`tab-assets`)

패널 A / 패널 B 각각 Dropzone(기존 컴포넌트 재사용) + 메타데이터. 둘 다 채워지지 않으면 렌더 버튼이 막히고 사유를 표시한다.

### 6.3 Day1 인스펙터

기존 `InspectorSection` 아코디언을 재사용한다.

| 섹션 | 내용 | 기본 |
|------|------|:----:|
| 패널 A / 패널 B | Trim, Scale·X·Y, 규격별 override | 펼침 |
| 분할선 | 두께 슬라이더, 색 (컬러 피커 + **스포이트**) | 펼침 |
| 라벨 | 4언어 문구 A·B, 크기·색·외곽선·위치 | 접힘 |
| 엔드카드 | 배너 Dropzone, 아이콘 Dropzone, 미세조정, 애니메이션 프리셋 | 접힘 |

### 6.4 Eyedropper (FR-D08 / FR-D15)

```ts
// EyeDropper는 Chrome 95+ 전용. 없으면 버튼을 숨기고 컬러 피커만 남긴다.
if ('EyeDropper' in window) {
  const {sRGBHex} = await new window.EyeDropper().open();
  onChange(sRGBHex);
}
```

화면 어디든 집을 수 있는 것이 Chrome 기본 동작이다. 힌트 문구로 안내한다.

---

## 7. Error Handling

| 코드 | 조건 | 메시지 |
|------|------|--------|
| `SCHEMA_UNSUPPORTED` | 마이그레이션 불가한 `schemaVersion` | 지원하지 않는 프로젝트 형식입니다. 원본은 그대로 두었습니다. |
| `RENDER_PREFLIGHT_FAILED` | Day1인데 패널 소스가 비었음 | 영상 2개를 모두 올려야 렌더할 수 있습니다. |
| 기존 코드 | 그대로 | — |

---

## 8. Test Plan

### 8.1 Unit

| 대상 | 검증 |
|------|------|
| `splitLayout` | 3규격 각각 패널 사각형·방향·선 위치, 합이 출력 크기와 정확히 일치 |
| `day1SectionDurations` | 15/30/60 프리셋의 합이 프리셋과 일치, A·B 균등 |
| `activePanelForSection` | 0→a, 1→b, 2→null |
| `appIconRect` | 1:1·9:16 상수, 16:9는 null, `iconAdjust` 반영 |
| `migrateProject` | **v1 픽스처 → v2 왕복**, 필드 손실 없음, 손상 문서 거부 |
| 불변식 | Day1 구간 합·최소 길이, 패널 소스 누락 시 렌더 차단 |

### 8.2 E2E

| # | 시나리오 |
|---|----------|
| 1 | Day1 선택 → 영상 2개 업로드 → 1:1 렌더 → `ffprobe`로 1080×1080·길이·코덱 확인 |
| 2 | 9:16 렌더 후 동일 확인 |
| 3 | **흑백 검증(SC2)** — 구간 A 중간 프레임을 추출해 패널 B 영역을 크롭하고 평균 채도를 계산, 0에 근접하는지 확인. 구간 B에서 반대로 확인 |
| 4 | **분할선 색(SC4)** — 분할선 좌표의 픽셀이 지정한 hex와 일치 |
| 5 | **엔드카드 정합(SC5)** — 아이콘 오버레이 위치가 배너의 아이콘 영역과 ≤ 2px |
| 6 | **회귀(SC3)** — 기존 E2E 17개 전량 + v1 JSON 가져오기 |

채도 계산은 프레임을 PNG로 뽑아 `max(R,G,B) − min(R,G,B)`의 평균으로 판정한다.

---

## 9. Architecture Compliance

- `domain/day1/**`는 순수 함수만. React·Remotion·Zustand 임포트 금지 ([architecture.test.ts](../../../src/test/architecture.test.ts))
- `compositions/`는 `domain`과 `shared`만 참조
- 기존 `data-testid` 70개 유지, Day1용은 추가만

---

## 10. Out of Scope (별도 사이클)

| 항목 | 사유 |
|------|------|
| bannerdesigner app-badge 16:9 레이아웃 | 다른 저장소. 사용자 결정으로 분리. 상수가 생기면 `APP_ICON_RECT`에 한 줄 추가하면 붙는다 |
| MPEG-4 / HEVC 업로드 호환 확대 | 모든 템플릿 공통 영향. 사용자 결정으로 분리. §11.3 참고 |
| 영상 3개 이상, 가변 분할, 클립 드래그 | Plan §2.2 |

---

## 11. Implementation Guide

### 11.1 File Structure

```text
src/domain/day1/                     layout.ts · playback.ts · endCard.ts  (+ .test.ts)
src/domain/editor/migrate.ts         v1 → v2                              (+ .test.ts)
src/domain/editor/schema.ts          sections · templateSettings · v2
src/domain/timeline/timeline.ts      sectionDurationsOf 추가
src/compositions/Day1Composition.tsx
src/compositions/day1/SplitFrame.tsx
src/compositions/day1/EndCardScene.tsx
src/features/editor/TemplateSelector.tsx
src/features/editor/Day1Inspector.tsx
src/features/editor/ColorField.tsx   컬러 피커 + 스포이트
src/infrastructure/render/renderEditor.ts   템플릿 분기
tests/fixtures/project-v1.json       마이그레이션 픽스처
tests/fixtures/gameplay-sample-b.mp4 두 번째 소스 (서로 다른 영상)
```

### 11.2 Implementation Order

스키마 → 도메인 → 컴포지션 → UI → 통합. 각 단계 끝에서 `npm test && npm run build`.

### 11.3 Session Guide

| Module | Scope Key | 내용 | 선행 |
|--------|-----------|------|:----:|
| 1 | `module-1` | 스키마 v2 (`sections` + `templateSettings`), v1→v2 마이그레이션, 저장·가져오기 적용. **기존 E2E 17개 통과가 완료 조건** | — |
| 2 | `module-2` | `domain/day1/` 순수 로직 3종 + 유닛 | 1 |
| 3 | `module-3` | `Day1Composition` + `SplitFrame` (흑백·분할선·라벨). 서로 다른 소스 2개로 렌더 재측정 | 2 |
| 4 | `module-4` | `EndCardScene` + 아이콘 애니메이션 프리셋 | 2 |
| 5 | `module-5` | 템플릿 선택기, Day1 좌측 패널, Day1 인스펙터, 스포이트 | 3,4 |
| 6 | `module-6` | 렌더·Batch 통합, E2E 6종, 문서 갱신 | 5 |

권장 세션 분할: `1` → `2,3` → `4,5` → `6`

```bash
/pdca do day1-template --scope module-1
```

### 11.4 Do Entry Checklist

- [ ] `module-1` 착수 전 v1 픽스처(`tests/fixtures/project-v1.json`)를 **먼저** 만든다
- [ ] 두 번째 소스 픽스처를 준비한다 (첫 번째와 눈에 띄게 다른 영상)
- [ ] 매 모듈 종료 시 기존 E2E 전량 실행
- [ ] `data-testid`는 추가만, 기존 이름 변경 금지

---

## 12. Requirement Traceability

| Plan FR | Design |
|---------|--------|
| FR-D01 | §3.2 판별 유니온, §6.1 선택기 |
| FR-D02 | §3.6 마이그레이션 |
| FR-D03 | §3.5 불변식, §7 preflight |
| FR-D04 | §4.1 `splitLayout` |
| FR-D05 | §5.2 `SplitFrame` |
| FR-D06 | §1.2 구간 매핑, §4.2 `day1SectionDurations` |
| FR-D07 | §3.2 `day1PanelSchema.transforms` |
| FR-D08 | §3.2 `split`, §6.4 스포이트 |
| FR-D09 | §3.3 copy, §3.2 `labelStyle` |
| FR-D10 | §5.2 volume, Plan D7 |
| FR-D11 | §4.3 `APP_ICON_RECT`, §5.3 |
| FR-D12 | §5.3 프리셋 표 |
| FR-D13 | §3.2 `iconAdjust` |
| FR-D14 | §2.1 렌더 분기 |
| FR-D15 | §6.4 feature detection |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-07-28 | 최초 Design. Option C 채택. 렌더 스파이크 0.99× 반영해 정지 프레임 사전 추출 폐기. 16:9 엔드카드·MPEG-4 호환은 별도 사이클로 분리. | 김성권 / Claude |
