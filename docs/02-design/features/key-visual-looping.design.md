# Key Visual Looping Template Design Document

> **Project**: mkt_videodesigner
> **Feature**: key-visual-looping
> **Plan**: [key-visual-looping.plan.md](../../01-plan/features/key-visual-looping.plan.md)
> **Architecture**: **Option C — Pragmatic Balance** (사용자 선택, 2026-08-21)
> **Author**: 김성권 / Claude
> **Date**: 2026-08-21
> **Status**: Draft — awaiting Do

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 언어별로 전량 재작업하던 키비주얼 루핑 포맷을 편집기 안에서 이미지 교체만으로 반복 생산하고, 3구간 고정이던 시간축을 가변 길이로 풀어 이후 포맷 확장의 발목을 없앤다. |
| **WHO** | 사내 UA Manager와 마케터. 기존 3장면·Day1 사용자와 동일하며, 세 경로를 오간다. |
| **RISK** | `sections` 3튜플 확장이 기존 두 템플릿의 타임라인·렌더 경로를 회귀시킬 위험, 반복 사이클을 프레임으로 나눌 때 나누어떨어지지 않는 조합(15초·30fps·4회), 고해상도 PNG를 언어×장수만큼 들고 있을 때의 메모리·저장 용량. |
| **SUCCESS** | KV 4장·2회 반복으로 9:16 MP4를 실제로 뽑아 레퍼런스와 나란히 두고 홀드 타이밍·크로스페이드·타이틀 위치가 재현되며, 타이틀·고지문구를 하나도 올리지 않은 상태에서도 렌더·다운로드가 되고, 기존 3장면·Day1 프로젝트가 회귀 없이 열리고 렌더된다. |
| **SCOPE** | 시간축 가변화(기존 두 템플릿 회귀 방어) → `kv-loop` 스키마·도메인 → 루핑 컴포지션(Ken Burns·크로스페이드) → 오버레이(타이틀·고지문구) → 인스펙터·자산 패널 → 렌더·Batch 통합 순으로 진행한다. |

---

## 1. Overview

### 1.1 Design Goals

1. **기존 두 템플릿의 렌더 경로를 한 줄도 건드리지 않는다.** Plan §5가 최대 위험으로 지목한 항목이고, Option C를 고른 이유가 이것이다.
2. **펼치기(flatten) 로직을 도메인 순수 함수 하나로 모은다.** 컴포지션과 타임라인 UI가 같은 함수를 소비해 프레임 배분이 두 곳에서 갈라지지 않게 한다 (NFR-L03).
3. **마이그레이션 코드를 쓰지 않는다.** 튜플→배열 확장과 판별 유니온 arm 추가는 기존 문서에 하위 호환이므로 `PROJECT_SCHEMA_VERSION`은 2를 유지한다.
4. **타이틀·고지문구 부재가 어떤 경로에서도 렌더를 막지 않는다** (Plan L5 / FR-L13 / SC5).

### 1.2 Key Insight — Timeline.tsx는 이미 제네릭하다

설계 착수 시 가장 큰 미지수는 "타임라인 UI를 N개 클립으로 다시 만들어야 하나"였다. 코드를 읽어보니 아니다.

[Timeline.tsx:331](../../../src/features/editor/Timeline.tsx:331)은 `sections.map()`으로 클립을 그리고 flex 비율로 폭을 잡는다. [Timeline.tsx:363](../../../src/features/editor/Timeline.tsx:363)은 `boundaries.map()`으로 경계 핸들을 그린다. `totalDurationMs`·`totalFrames`는 **이미 prop으로 받고 있다**([Timeline.tsx:81](../../../src/features/editor/Timeline.tsx:81)).

제네릭하지 않은 것은 타입 두 개뿐이다.

| 대상 | 현재 | 변경 후 |
|------|------|---------|
| `BoundaryIndex` | `0 \| 1` | `number` |
| `boundaryPositionsMs()` | `[number, number]` | `number[]` |
| `SceneDurationsMs` | `[number, number, number]` | `readonly number[]` |

이 셋을 넓히면 타임라인은 N개 클립으로 **로직 변경 없이** 동작한다. `index as BoundaryIndex` 캐스트도 불필요해져 오히려 줄어든다. 이 발견이 module-1을 "회귀 전용 게이트"로 만들 수 있게 한 근거다.

두 번째 발견: `SECTION_COUNT = 3`은 [constants.ts:12](../../../src/domain/editor/constants.ts:12)에 선언만 되어 있고 참조가 0건이다. 그냥 지운다.

### 1.3 Confirmed Decisions

Plan L1~L9는 확정 사항이며 여기서 뒤집지 않는다. 아래는 Design 단계에서 추가로 확정한 항목이다.

| # | 결정 | 근거 |
|---|------|------|
| D-01 | **`sections`는 한 사이클, 총 길이 불변식은 `sum(sections) × cycles === preset × 1000`** | Plan L1의 "타임라인에 한 사이클만" 을 스키마 수준에서 보장한다. `cyclesOf(settings)`는 `kv-loop`에서 `loopCount`, 나머지에서 1을 반환하므로 기존 두 템플릿의 불변식은 문자 그대로 동일하다 |
| D-02 | **KV 장수는 별도 필드가 아니라 `sections.length`** | `kvCount` 필드를 두면 `sections.length`와 드리프트할 수 있는 두 번째 진실이 생긴다. 구간 = KV라는 L1 결정을 스키마로 못박는다 |
| D-03 | **프레임 배분은 누적 반올림(cumulative rounding)** | `allocateSceneFrames`의 "마지막이 잔여를 흡수" 규칙은 3구간에서는 잔여가 최대 1~2프레임이라 괜찮지만, 8구간(4KV×2회)에서는 마지막이 최대 8프레임을 떠안아 사이클 동일성(SC3)이 깨진다. 누적 반올림은 총합을 정확히 맞추면서 구간별 오차를 ±1프레임으로 묶는다 |
| D-04 | **`slots`(프레이밍·모션)와 `images`(언어별 픽셀)를 분리한다** | 언어별 KV는 같은 일러스트에 타이틀만 다르게 박힌 것이라 프레이밍이 동일하다. 분리하면 언어 탭을 바꿔도 Scale·X·Y가 유지되고, 프레이밍을 4번 반복 입력하지 않는다 |
| D-05 | **언어 폴백은 셋 단위. 슬롯 단위로 섞지 않는다** | ko가 4장 중 2장만 채워졌을 때 나머지를 en에서 끌어오면 사용자가 결과를 예측할 수 없다. "자기 셋을 쓰거나, 통째로 en을 상속하거나" 둘 중 하나로 두고 어느 쪽인지 UI에 항상 표시한다 (FR-L04) |
| D-06 | **9:16 강제는 스키마 `superRefine`에서, UI는 그 이유를 표시** | `selectedRatios`의 `min(1).max(3)`을 좁히지 않고 `kv-loop` arm에서만 `['9:16']`을 요구한다. 기존 스키마 형태를 건드리지 않는 최소 개입이다 |
| D-07 | **성능 스파이크를 module-3 종료 게이트로 옮긴다** | Plan §4.3은 "Design 착수 전"이라고 썼지만, 이미지 루핑 컴포지션이 없는 상태에서 측정할 대상이 없다. Ken Burns·크로스페이드가 실제로 얹힌 module-3 종료 시점이 첫 유의미한 측정 지점이다. **Plan §4.3에서 의도적으로 벗어난 지점이므로 여기 명시한다** |

---

## 2. Architecture

### 2.0 Option Comparison

| | A — 최소 변경 | B — 투영 계층 | **C — 실용 균형 (선택)** |
|---|---|---|---|
| 펼치기 위치 | 컴포지션·Timeline 각각 인라인 | `domain/timeline/projection.ts`, 세 템플릿 전부 이관 | `domain/kvloop/cycle.ts`, 루핑만 사용 |
| 기존 2종 렌더 경로 | 무변경 | **재작성** | 무변경 |
| 프레임 잔여 규칙 | 2곳 중복 | 1곳 | 1곳(루핑) + 기존 1곳 |
| SC8 회귀 위험 | 낮음 | **높음** | 낮음 |
| NFR-L03 준수 | ✗ | ✓ | ✓ |
| 신규 파일 | 3 | 5 | 4 |

**선택 근거**: B가 개념적으로 가장 깨끗하고 이후 확장성도 최상이지만, 검증이 끝난 렌더 경로 2개를 재작성해 Plan §5의 1순위 위험을 그대로 실현한다. C는 단일 진실 원천(NFR-L03)을 확보하면서 그 위험을 회피한다. B는 세 번째 템플릿이 또 구간 수를 벗어날 때 별도 사이클로 다룬다 (§10).

### 2.1 Component Diagram

```text
┌─ app ──────────────────────────────────────────────────────────┐
│  App.tsx                    (어댑터 주입 — 변경 없음)            │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌─ features/editor ────────┴─────────────────────────────────────┐
│  EditorWorkspace.tsx      탭 분기 · 규격 게이팅 (수정)          │
│  TemplateSelector.tsx     3번째 항목 (수정)                     │
│  Timeline.tsx             repeat prop · BoundaryIndex (수정)     │
│  KvLoopAssetPanel.tsx     언어별 KV 목록 · 순서 · 반복 (신규)    │
│  KvLoopInspector.tsx      KV별 프레이밍·모션 · 오버레이 (신규)   │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌─ domain ─────────────────┴─────────────────────────────────────┐
│  editor/constants.ts      상한 상수 (수정)                      │
│  editor/schema.ts         sections 배열화 · kv-loop arm (수정)   │
│  editor/project.ts        buildKvLoopProps · 명령 arm (수정)     │
│  timeline/timeline.ts     가변 길이 일반화 (수정)                │
│  kvloop/cycle.ts          사이클 펼치기 · 프레임 배분 (신규)      │
│  kvloop/assets.ts         언어 폴백 · 프리플라이트 (신규)         │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌─ compositions ───────────┴─────────────────────────────────────┐
│  KvLoopComposition.tsx    (신규)                                │
│  kvloop/KvScene.tsx       Img + Ken Burns (신규)                │
│  kvloop/TitleOverlay.tsx  null-safe (신규)                      │
│  kvloop/DisclaimerBar.tsx (신규)                                │
│  shared/AudioLayer.tsx    재사용 — BGM만                        │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌─ infrastructure ─────────┴─────────────────────────────────────┐
│  render/renderEditor.ts   3번째 arm (수정)                      │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow — 루핑 렌더

```text
EditorProject
  sections: [kv-0 1875ms, kv-1 1875ms, kv-2 1875ms, kv-3 1875ms]   ← 한 사이클 7.5s
  durationPreset: 15,  fps: 30
  templateSettings: {template:'kv-loop', loopCount:2, slots:[…4], images:{ko:[…], en:[…]}}
        │
        ▼  buildKvLoopProps(project, resolveUrl)
        │
        ├─ kvLoopSegments(cycleMs=[1875×4], loopCount=2, totalFrames=450, fps=30)
        │     → [ {kv:0,cyc:0,from:0,  dur:56},  {kv:1,cyc:0,from:56, dur:57},
        │         {kv:2,cyc:0,from:113,dur:56},  {kv:3,cyc:0,from:169,dur:57},
        │         {kv:0,cyc:1,from:226,dur:56},  {kv:1,cyc:1,from:282,dur:56},
        │         {kv:2,cyc:1,from:338,dur:57},  {kv:3,cyc:1,from:395,dur:55} ]
        │       Σ = 450  (누적 반올림 — D-03)
        │
        ├─ resolveKvImages(images, selectedLocale, 4)
        │     → {references:[…4], inheritedFrom: 'en' | null}
        │
        └─ resolveKvTitle(title.images, selectedLocale)   → url | null
        │
        ▼  KvLoopProps  (deep-frozen)
        │
        ├──→ <Player>            미리보기
        └──→ renderMediaOnWeb()  실제 MP4
                 └─ KvLoopComposition
                      ├─ Sequence × 8   → KvScene (Img + Ken Burns)
                      ├─ TitleOverlay    (url === null → null 반환)
                      ├─ DisclaimerBar   (text === '' → null 반환)
                      ├─ FadeOut         (fadeOutMs > 0)
                      └─ AudioLayer      (BGM만)
```

`buildEditorSnapshot()`은 Day1 → 루핑 → 3장면 순으로 좁힌다. 판별자를 읽는 지점은 여전히 한 곳이다.

### 2.3 Performance

이미지 디코딩은 비디오보다 싸므로 NFR-L01은 "3장면 기준선 **이하**"라는 역방향 게이트다. 초과하면 구현 문제 신호로 본다.

주의할 두 지점:

1. **Ken Burns의 `transform: scale()`** — 매 프레임 리샘플을 유발할 수 있다. `will-change`를 붙이지 않고, 스케일 범위를 1.0~1.08로 제한한다(강도 1.0 기준).
2. **크로스페이드 구간의 2장 동시 합성** — 전환 지속시간만큼 이미지 2장이 겹친다. 기본값을 400ms로 두고, 전환 프레임이 인접 구간 중 짧은 쪽의 절반을 넘지 못하게 클램프한다 (기존 3장면 규칙과 동일).

측정은 D-07에 따라 module-3 종료 시 `npm run benchmark:render`로 수행하고, KV 8장 × 4언어 = 32장 업로드 상태의 메모리(NFR-L02)를 함께 기록한다.

---

## 3. Data Model

### 3.1 Sections — 튜플에서 배열로

```ts
// constants.ts
- export const SECTION_COUNT = 3;            // 참조 0건 — 삭제
+ export const MIN_SECTION_COUNT = 2;
+ export const MAX_SECTION_COUNT = 8;        // KV 상한 (Plan L8)
+ export const KV_LOOP_MIN_LOOPS = 1;
+ export const KV_LOOP_MAX_LOOPS = 4;        // Plan L8
+ export const KV_LOOP_MAX_KEN_BURNS_SCALE = 1.08;   // §2.3
+ export const DEFAULT_KV_COUNT = 4;         // 레퍼런스 기준
+ export const DEFAULT_KV_LOOPS = 2;
+ export const DEFAULT_KV_TRANSITION_MS = 400;
```

```ts
// schema.ts
- export const sectionsSchema = z.tuple([sectionSchema, sectionSchema, sectionSchema]);
+ export const sectionsSchema = z
+   .array(sectionSchema)
+   .min(MIN_SECTION_COUNT)
+   .max(MAX_SECTION_COUNT);
```

`Sections`는 `Section[]`이 된다. **기존 v2 문서는 정확히 3항목 배열이므로 그대로 파싱된다** — 마이그레이션 코드 없음, `PROJECT_SCHEMA_VERSION`은 2 유지. 이는 day1-endcard-video가 `.default()`로 스키마를 늘렸던 것과 같은 계열의 결정이다.

`SECTION_IDS_BY_TEMPLATE` 상수 맵은 함수가 된다. 루핑은 id가 장수에 따라 달라지기 때문이다.

```ts
export const expectedSectionIds = (
  settings: TemplateSettings,
  sectionCount: number,
): readonly string[] =>
  settings.template === 'three-scene' ? SCENE_ORDER
  : settings.template === 'day1'      ? DAY1_SECTION_ORDER
  : Array.from({length: sectionCount}, (_, i) => `kv-${i}`);
```

`superRefine`은 **길이를 먼저** 검사한 뒤 id를 검사한다. 기존 두 템플릿은 이로써 항목 수 3에 고정되어 입력 공간이 넓어지지 않는다 (Plan §5 대응).

### 3.2 Template Settings — 세 번째 arm

```ts
/** Per-KV framing and motion. Locale-independent — Design D-04. */
const kvSlotSchema = z.object({
  /**
   * 9:16 전용이라 ratio override가 없다 (Plan L3).
   *
   * `fit`은 `mediaTransformSchema`에서 상속된다. main의 day1-video 작업이
   * `z.literal('cover')`를 `z.enum(MEDIA_FITS)` = `['cover','contain']`으로
   * 넓혀 뒀으므로, 비세로 KV를 `contain` + 블러 배경으로 처리하는 길이
   * 공짜로 열려 있다 — FR-L19가 경고에서 실제 선택지로 승격된다.
   */
  transform: mediaTransformSchema,
  kenBurns: z.boolean(),
});

export const kvLoopSettingsSchema = z.object({
  template: z.literal('kv-loop'),
  /** 길이 === sections.length. Design D-02 — KV 장수의 유일한 출처는 sections. */
  slots: z.array(kvSlotSchema).min(MIN_SECTION_COUNT).max(MAX_SECTION_COUNT),
  /**
   * 언어별 KV 픽셀. 희소 허용 — 해석은 `images[locale]?.[i] ?? null`.
   * 전부 비어 있어도 스키마 오류가 아니다 (업로드 중간 저장 허용, Day1과 동일 정책).
   */
  images: z.partialRecord(
    localeSchema,
    z.array(mediaReferenceSchema.nullable()).max(MAX_SECTION_COUNT),
  ),
  loopCount: z.number().int().min(KV_LOOP_MIN_LOOPS).max(KV_LOOP_MAX_LOOPS),
  /** 0~1. 1이 KV_LOOP_MAX_KEN_BURNS_SCALE에 대응한다. */
  kenBurnsIntensity: z.number().min(0).max(1),
  transitionMs: z.number().min(MIN_TRANSITION_MS).max(MAX_TRANSITION_MS),
  /** Plan L5 — 전부 null이어도 렌더가 막히지 않는다. FR-L13 / SC5. */
  title: z.object({
    images: z.partialRecord(localeSchema, mediaReferenceSchema),
    transform: mediaTransformSchema,
  }),
  /** 문구는 copy.kvLoopDisclaimer, 스타일만 여기. Day1 labelStyle과 같은 분리. */
  disclaimer: z.object({
    fontSize: z.number().min(MIN_SUBTITLE_FONT_SIZE).max(MAX_SUBTITLE_FONT_SIZE),
    textColor: hexColorSchema,
  }),
  /** FR-L17. 0이 끄기. */
  fadeOutMs: z.number().min(0).max(MAX_TRANSITION_MS),
});

export const templateSettingsSchema = z.discriminatedUnion('template', [
  threeSceneSettingsSchema,
  day1SettingsSchema,
  kvLoopSettingsSchema,     // ← arm 하나 추가
]);
```

### 3.3 Copy — 고지문구

```ts
export const localizedCopySchema = z.object({
  …기존 필드…
  /** 루핑 하단 고지문구. `day1Labels`와 같은 이유로 optional. */
  kvLoopDisclaimer: copyTextSchema.optional(),
});
```

optional이므로 기존 copy 블록이 그대로 파싱된다. 3장면·Day1 프로젝트는 이 필드를 갖지 않는다.

### 3.4 Invariants

`superRefine`의 공통 구간이 반복을 인지하게 된다.

```ts
export const cyclesOf = (settings: TemplateSettings): number =>
  settings.template === 'kv-loop' ? settings.loopCount : 1;

// 공통 검사 (기존)
- if (totalMs !== project.durationPreset * 1000) → error
+ const cycles = cyclesOf(settings);
+ if (totalMs * cycles !== project.durationPreset * 1000) → error
+   메시지: `사이클 ${totalMs/1000}초 × ${cycles}회 = ${totalMs*cycles/1000}초로,
+            프리셋 ${preset}초와 맞지 않습니다.`
```

`cycles === 1`이므로 기존 두 템플릿의 검사는 문자 그대로 동일하다.

`refineKvLoop`가 추가로 검사하는 것:

| 검사 | 근거 |
|------|------|
| `slots.length === sections.length` | D-02. 두 배열이 갈라지면 렌더가 조용히 틀어진다 |
| `render.selectedRatios`가 정확히 `['9:16']` | FR-L14 / D-06 |
| `selectedRatio === '9:16'` | 미리보기와 출력이 갈라지지 않게 |

**FR-L07(장수·반복 조합)은 스키마에 넣지 않는다.** 구간 최소 1초(`sectionSchema`)와 총 길이 불변식이 이미 불가능한 조합을 거부하지만, 그때 나오는 메시지는 "구간이 937ms로 최소 1000ms 미만"이라 사용자가 무엇을 바꿔야 할지 알 수 없다. 대안을 제시하는 안내는 도메인 가드(§4.3)가 담당하고 UI가 사전에 차단한다.

### 3.5 Migration — 없음

| 변경 | 기존 문서 영향 |
|------|----------------|
| `sections` 튜플 → 배열(2~8) | 3항목 배열이므로 그대로 통과 |
| `templateSettings`에 arm 추가 | 판별자가 `three-scene`/`day1`이므로 무관 |
| `copy.kvLoopDisclaimer` optional 추가 | 없어도 통과 |
| `SECTION_IDS_BY_TEMPLATE` → 함수 | 내부 구현. 검사 결과 동일 |

`schemaVersion: 2`를 유지하고 `migrate.ts`는 손대지 않는다. v1 승격 경로도 그대로다 (v1 → 3항목 v2 → 배열 스키마 통과).

---

## 4. KvLoop Domain (순수)

### 4.1 사이클 펼치기 — `domain/kvloop/cycle.ts`

```ts
export interface KvSegment {
  /** 사이클 내 KV 인덱스. `slots`·`images` 조회 키. */
  kvIndex: number;
  /** 0-based 사이클 번호. SC3 검증이 이 값으로 대응 구간을 짝짓는다. */
  cycle: number;
  fromFrame: number;
  durationInFrames: number;
}

export const cycleTotalMs = (cycleDurationsMs: readonly number[]): number;

/** 균등 분할 초기값. 나머지는 앞쪽 구간부터 1ms씩 분배해 합을 정확히 맞춘다. */
export const kvLoopCycleDurations = (
  preset: DurationPreset,
  loopCount: number,
  kvCount: number,
): number[];

/**
 * 누적 반올림 (Design D-03). 구간별 오차 ±1프레임, 총합은 정확히 totalFrames.
 *
 *   boundary(i) = round(cumulativeMs(i) / totalCycleMs / loopCount * totalFrames)
 *   duration(i) = boundary(i+1) - boundary(i)
 *
 * "마지막이 잔여를 전부 흡수"하는 `allocateSceneFrames` 방식은 8구간에서
 * 마지막이 최대 8프레임을 떠안아 사이클 동일성(SC3)을 깨뜨린다.
 */
export const kvLoopSegments = (
  cycleDurationsMs: readonly number[],
  loopCount: number,
  totalFrames: number,
): KvSegment[];
```

`fps`를 받지 않는다. `totalFrames`(= `preset × fps`)만 있으면 되고, 인자를 줄이면 "프레임 총합이 프리셋과 어긋날 수 있는" 경로가 애초에 생기지 않는다.

### 4.2 언어 해석 — `domain/kvloop/assets.ts`

```ts
/** Plan L4 — ko가 아니라 en이 상속 원본이다. */
export const KV_FALLBACK_LOCALE: Locale = 'en';

export interface ResolvedKvSet {
  references: (MediaReference | null)[];   // 길이 === count
  /** null이면 자기 셋을 쓰는 중. Locale이면 그 언어에서 상속 중 (FR-L04 표시용). */
  inheritedFrom: Locale | null;
}

/**
 * Design D-05 — 셋 단위 폴백. 자기 셋에 1장이라도 있으면 자기 셋을 쓰고,
 * 없으면 통째로 en을 상속한다. 슬롯 단위로 섞지 않는다.
 */
export const resolveKvSet = (
  images: Partial<Record<Locale, (MediaReference | null)[]>>,
  locale: Locale,
  count: number,
): ResolvedKvSet;

export const resolveKvTitle = (
  images: Partial<Record<Locale, MediaReference>>,
  locale: Locale,
): {reference: MediaReference | null; inheritedFrom: Locale | null};
```

`resolveKvTitle`은 부재를 정상 상태로 반환한다. 여기가 Plan L5의 구현 지점이다.

### 4.3 유효성 가드

```ts
/**
 * FR-L07. 스키마가 아니라 여기서 막는 이유는 §3.4에 있다 — 대안을 제시해야 한다.
 * 15초·8장·2회 → "장당 0.94초로 최소 1초 미만입니다. 30초로 올리거나 반복을 1회로 줄여주세요."
 */
export const kvLoopCombination = (
  preset: DurationPreset,
  loopCount: number,
  kvCount: number,
): Result<void>;

/** 렌더 프리플라이트. FR-L13 — 해석된 KV가 2장 미만일 때만 막는다. */
export const kvLoopMissingImages = (project: EditorProject): number;
```

`kvLoopMissingImages`는 `day1MissingPanels`와 같은 자리·같은 형태로 붙는다. 오버레이 부재는 계산에 들어가지 않는다 — **이것이 SC5의 코드 상 위치다.**

### 4.4 timeline.ts 일반화

```ts
- export type SceneDurationsMs = [number, number, number];
+ export type SceneDurationsMs = readonly number[];
- export type BoundaryIndex = 0 | 1;
+ export type BoundaryIndex = number;

  sectionDurationsOf   → sections.map(s => s.durationMs)
  sumDurationsMs       → reduce
  sceneStartsMs        → 누적 합
  boundaryPositionsMs  → 누적 합에서 첫 항목과 마지막 항목 제외 (길이 n-1)
  moveBoundary         → 인접 두 구간만 조정, 총합 불변, 각 구간 MIN_SCENE_MS 보장
  allocateSceneFrames  → 가변 길이. 기존 "마지막이 잔여 흡수" 규칙 유지 (기존 2종 동작 보존)
```

`allocateSceneFrames`는 **의도적으로 기존 규칙을 유지한다.** 누적 반올림(D-03)은 루핑 전용 `kvLoopSegments`에만 적용한다. 기존 두 템플릿의 프레임 배분을 바꾸면 렌더 산출물이 1프레임 달라져 SC8 회귀 판정이 흐려진다.

`moveBoundary`는 3구간에서 기존과 **비트 단위로 동일한 결과**를 내야 한다. module-1의 종료 조건이 이것이다.

---

## 5. Compositions

### 5.1 `KvLoopComposition.tsx`

```tsx
<AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
  {segments.map((seg, i) => (
    <Sequence
      from={seg.fromFrame}
      durationInFrames={seg.durationInFrames + (i < segments.length - 1 ? xfadeFrames : 0)}
      key={`${seg.cycle}-${seg.kvIndex}`}
    >
      <KvScene
        url={urls[seg.kvIndex]}
        slot={slots[seg.kvIndex]}
        intensity={kenBurnsIntensity}
        holdInFrames={seg.durationInFrames}
        fadeInFrames={i === 0 ? 0 : xfadeFrames}
      />
    </Sequence>
  ))}

  <TitleOverlay url={title.url} transform={title.transform} />
  <DisclaimerBar text={disclaimer.text} style={disclaimer.style} />
  {fadeOutFrames > 0 ? <FadeOut frames={fadeOutFrames} totalFrames={totalFrames} /> : null}
  <AudioLayer audio={audio} />
</AbsoluteFill>
```

크로스페이드는 **뒤 구간이 앞 구간 위로 페이드 인**하는 표준 방식이다. 각 시퀀스를 `xfadeFrames`만큼 늘려 겹치게 하고, 첫 구간만 페이드 인을 생략한다. `xfadeFrames`는 인접 구간 중 짧은 쪽의 절반으로 클램프한다 (기존 3장면 전환 규칙과 동일한 상한).

`key`가 `cycle-kvIndex`인 이유: 같은 `kvIndex`가 사이클마다 다시 등장하므로 인덱스만으로는 충돌한다.

### 5.2 `kvloop/KvScene.tsx`

```tsx
const scale = kenBurns
  ? interpolate(frame, [0, holdInFrames], [1, 1 + intensity * (KV_LOOP_MAX_KEN_BURNS_SCALE - 1)],
      {extrapolateRight: 'clamp'})
  : 1;
const opacity = fadeInFrames > 0
  ? interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateRight: 'clamp'})
  : 1;

<AbsoluteFill style={{opacity}}>
  <Img src={url} style={{
    height: '100%', width: '100%', objectFit: 'cover',
    transform: `translate(${slot.transform.x}%, ${slot.transform.y}%) scale(${slot.transform.scale * scale})`,
  }} />
</AbsoluteFill>
```

`SceneVideo`와 동일한 `objectFit: cover` + `translate`/`scale` 조합이라 프레이밍 조작감이 템플릿 간에 일치한다. `url === null`이면 `CANVAS_COLOR` 배경만 남는다 (빈 슬롯이 렌더를 깨지 않는다).

### 5.3 `kvloop/TitleOverlay.tsx` · `DisclaimerBar.tsx`

```tsx
export const TitleOverlay = ({url, transform}) => {
  if (!url) return null;            // ← Plan L5 / FR-L13 / SC5
  return <AbsoluteFill>…<Img …/></AbsoluteFill>;
};

export const DisclaimerBar = ({text, style}) => {
  if (!text) return null;
  return <div style={{position:'absolute', bottom:0, whiteSpace:'nowrap', …}}>{text}</div>;
};
```

두 컴포넌트 모두 **부재 시 `null`을 반환하는 것이 정상 경로**다. 예외도, 경고도, 플레이스홀더도 없다.

---

## 6. UI

### 6.1 Template Selector

```ts
TEMPLATE_LABELS  = {…, 'kv-loop': '키비주얼 루핑'}
TEMPLATE_LOSS    = {…, 'kv-loop': '키비주얼 이미지와 반복·모션·오버레이 설정'}
```

루핑으로 전환할 때 전환 다이얼로그에 **출력 규격이 9:16으로 고정된다는 사실을 추가로 명시**한다 (Plan §5 대응). `switchTemplate`이 `selectedRatios`·`selectedRatio`를 강제 보정한다.

### 6.2 `KvLoopAssetPanel.tsx` (좌측 `tab-assets`)

| 요소 | 동작 |
|------|------|
| KV 목록 | 언어 탭의 현재 언어 셋을 순서대로 표시. 드래그로 순서 변경, 슬롯별 교체·삭제 |
| 상속 배지 | `inheritedFrom !== null`일 때 "en 셋 상속 중 — 이 언어 전용 이미지를 올리면 대체됩니다" (FR-L04) |
| 장수 조절 | KV 추가/삭제. `sections`와 `slots`가 함께 늘고 줄며 홀드 시간을 재분배 |
| 반복 횟수 | 1~4 선택. `kvLoopCombination` 위반 조합은 비활성 + 이유 표시 (FR-L07) |
| 비세로 처리 | `width > height`인 KV에 "세로 소재가 아닙니다" 경고 + `fit`을 `contain`(전체 보존 + 블러 배경)으로 바꾸는 토글. Day1 패널 lossless 모드와 같은 수단 (FR-L19) |

### 6.3 `KvLoopInspector.tsx` (우측)

선택된 KV 클립: Scale·X·Y, Ken Burns 토글. 전역: Ken Burns 강도, 전환 지속시간, 페이드아웃.
오버레이 섹션: 타이틀 PNG 업로드(언어별) + 위치·크기, 고지문구 크기·색.

### 6.4 Timeline — 반복 표시

```ts
export interface TimelineProps {
  …기존…
  /** 루핑에서만 전달. 없으면 지금과 완전히 동일하게 동작한다. */
  repeat?: {count: number; cycleMs: number};
}
```

`repeat`가 있으면 클립 그룹을 `count`번 그린다. 클립 폭은 `(durationMs / cycleMs) × (100 / count)%`. **경계 핸들은 첫 그룹에만** 붙고 이후 그룹은 `aria-hidden`·`pointer-events: none` 고스트다. 이로써 눈금·플레이헤드는 실제 출력 길이를 정직하게 표시하면서, 편집은 한 사이클에서만 일어난다 (Plan L1).

`repeat`가 없을 때의 경로를 바꾸지 않는 것이 module-1·module-4의 회귀 방어선이다.

### 6.5 `EditorWorkspace.tsx` 분기

| 대상 | 루핑에서 |
|------|----------|
| Hook 탭 | 숨김 (Plan L9) |
| 카피 탭 | 고지문구 입력만 남김 (FR-L15) |
| 나레이션·더킹 UI | 숨김 (Plan L9) |
| 오디오 BGM | 표시 (업로드·루프·볼륨·시작지점, FR-L12) |
| 규격 체크박스 | 9:16 고정·비활성 + "루핑 템플릿은 세로 전용입니다" (FR-L14) |
| `sections[0]`/`[1]` Day1 경계 읽기 | 인덱스 안전 접근으로 정리 ([EditorWorkspace.tsx:1092](../../../src/features/editor/EditorWorkspace.tsx:1092)) |

---

## 7. Error Handling

**새 `AppErrorCode`를 만들지 않는다.** conventions §5의 "생산자가 있을 때만 멤버를 추가한다" 규칙에 따라, 이번 요구는 모두 기존 수단으로 표현된다.

| 상황 | 처리 |
|------|------|
| 해석된 KV < 2장 | `kvLoopMissingImages`가 개수를 반환, `day1MissingPanels`와 동일한 자리에서 렌더 버튼 차단 + 안내 |
| 장수·반복 조합 불가 | `kvLoopCombination`이 `Result<void>` 실패를 반환. UI가 사전 차단하므로 렌더까지 도달하지 않음 |
| 타이틀·고지문구 부재 | **오류가 아니다.** 컴포넌트가 `null` 반환 |
| 빈 KV 슬롯 1개 | 오류가 아니다. 그 구간은 배경색으로 렌더 |
| 비세로 KV | 경고만. Cover로 채움 |
| 이미지 프로브 실패 | 기존 `MEDIA_PROBE_FAILED` 경로 그대로 |
| 소재 재연결 | 기존 relink 경로 그대로 (`images`의 각 참조가 `MediaReference`이므로 무료로 따라온다) |

---

## 8. Test Plan

### 8.1 Unit

| 대상 | 검사 |
|------|------|
| `timeline.ts` **회귀** | 3구간에서 `moveBoundary`·`allocateSceneFrames`·`boundaryPositionsMs`가 변경 전과 **동일한 값**을 낸다 (module-1 종료 조건) |
| `timeline.ts` 확장 | 길이 2·4·8에서 총합 불변, 각 구간 ≥ MIN_SCENE_MS, 경계 개수 = n-1 |
| `cycle.ts` | 프레임 총합 === `preset × fps` (15/30/60 × 30/60fps × 반복 1~4 × 장수 2~8 전수) |
| `cycle.ts` SC3 | 대응 구간(같은 `kvIndex`, 다른 `cycle`)의 `durationInFrames` 차이 ≤ 1 |
| `cycle.ts` D-03 | 15초·30fps·4회(사이클 112.5프레임) 같은 비정수 조합에서 잔여가 한 구간에 몰리지 않는다 |
| `assets.ts` | 폴백 행렬 — 자기 셋 있음 / 없고 en 있음 / 둘 다 없음 / en만 부분 채움 |
| `assets.ts` D-05 | ko가 부분 채움일 때 en에서 **끌어오지 않는다** |
| `kvLoopCombination` | 15초·8장·2회 차단 + 메시지에 대안 포함. 15초·4장·2회 통과 |
| `kvLoopMissingImages` | 오버레이 전부 부재 + KV 4장 → 0 (차단 안 함). KV 1장 → 차단 |
| `schema.ts` | 기존 3항목 v2 문서 왕복 무손실. v1 승격 후 배열 스키마 통과 |
| `schema.ts` | `slots.length !== sections.length` 거부. `selectedRatios: ['9:16','1:1']` 거부 |
| `schema.ts` | `cyclesOf` 적용 후에도 기존 두 템플릿 불변식 메시지 동일 |
| `project.ts` | `switchTemplate` 3방향 왕복. 루핑 진입 시 규격 강제 보정 |
| `project.ts` | `buildEditorSnapshot`이 루핑에서 `template: 'kv-loop'` 태그를 낸다 |
| `architecture.test.ts` | `domain/kvloop`가 React·Remotion·Zustand를 임포트하지 않는다 |

### 8.2 E2E

| # | 시나리오 | 대응 SC |
|---|----------|:-------:|
| 1 | KV 4장 업로드 → 반복 2회 → 렌더 → `ffprobe`로 1080×1920·길이·코덱 확인 | SC1 |
| 2 | 경계 드래그로 홀드를 1.9/2.4/2.3/3.1초에 맞춘 뒤 씬 컷 검출로 ±1프레임 확인 | SC2 |
| 3 | 사이클 1·2의 대응 프레임 픽셀 비교 | SC3 |
| 4 | 전환 중간 프레임이 양쪽 KV와 모두 다르다 | SC4 |
| 5 | **KV만 올리고 타이틀·고지문구 0개로 렌더·다운로드 완료** | SC5 |
| 6 | en·ko만 채우고 4언어 배치 → ja·zh-TW 산출물이 en과 동일 | SC6 |
| 7 | 기존 E2E 54개 전량 통과 + v1/v2 JSON 가져오기 | SC8 |

---

## 9. Architecture Compliance

| 규칙 | 준수 |
|------|------|
| `domain`은 React·Remotion·Zustand 미임포트 | `kvloop/`는 순수 TS. `architecture.test.ts`가 검사 |
| `compositions`는 스토어 미임포트 | `KvLoopProps`를 prop으로만 받는다 |
| feature는 다른 feature 내부 미참조 | 루핑 UI는 `features/editor/` 안 |
| 컴포넌트가 렌더러·IndexedDB 직접 생성 금지 | 기존 포트 그대로 |
| Zod 스키마가 런타임 진실 | 타입은 전부 `z.infer` |
| 시간 단위를 식별자에 표기 | `durationMs`·`fromFrame`·`transitionMs`·`fadeOutMs` |
| Remotion 버전 고정 | 신규 의존성 없음 |
| 사용자 메시지 한국어, 코드 영어 | §7 전부 한국어 메시지 |

**신규 의존성 0건.** `<Img>`·`<Sequence>`·`interpolate`는 이미 설치된 `remotion`에 있다.

---

## 10. Out of Scope (별도 사이클)

- **Option B 투영 계층** — 네 번째 템플릿이 또 구간 수를 벗어날 때. 그때는 세 템플릿을 한꺼번에 이관한다.
- **1:1 · 16:9 루핑 출력** (Plan L3)
- **블러 디졸브 전환** — `TRANSITION_KINDS`에 arm 추가로 후속 처리
- **루핑 나레이션·TTS** — `narration`의 `sceneKind` 키 일반화가 선행 필요 (Plan L9)
- **KV별 자막**
- **레퍼런스 총 길이 정확 일치 (16초·19초)** (Plan L2)

---

## 11. Implementation Guide

### 11.1 File Structure

```text
src/
├─ domain/
│  ├─ kvloop/                        ★ 신규
│  │  ├─ cycle.ts                    사이클 펼치기 · 누적 반올림
│  │  ├─ cycle.test.ts
│  │  ├─ assets.ts                   언어 폴백 · 프리플라이트
│  │  └─ assets.test.ts
│  ├─ editor/
│  │  ├─ constants.ts                ▲ 상한 상수, SECTION_COUNT 삭제
│  │  ├─ schema.ts                   ▲ sections 배열화, kv-loop arm, cyclesOf
│  │  ├─ types.ts                    ▲ KvLoopProps, EditorSnapshot arm
│  │  └─ project.ts                  ▲ buildKvLoopProps, 명령 arm
│  ├─ timeline/timeline.ts           ▲ 가변 길이 일반화
│  └─ day1/playback.ts               ▲ SceneDurationsMs 타입 추종
├─ compositions/
│  ├─ KvLoopComposition.tsx          ★ 신규
│  └─ kvloop/                        ★ 신규
│     ├─ KvScene.tsx
│     ├─ TitleOverlay.tsx
│     └─ DisclaimerBar.tsx
├─ features/editor/
│  ├─ KvLoopAssetPanel.tsx           ★ 신규
│  ├─ KvLoopInspector.tsx            ★ 신규
│  ├─ TemplateSelector.tsx           ▲ 3번째 항목
│  ├─ Timeline.tsx                   ▲ repeat prop, BoundaryIndex
│  ├─ CopyPanel.tsx                  ▲ 고지문구 필드
│  ├─ projectStore.ts                ▲ 루핑 명령 바인딩
│  └─ EditorWorkspace.tsx            ▲ 탭·규격 게이팅
└─ infrastructure/render/
   └─ renderEditor.ts                ▲ 3번째 arm

tests/e2e/kv-loop.spec.ts            ★ 신규
```

### 11.2 Implementation Order

1. 시간축 가변화 (신규 기능 0, 회귀 전용)
2. 스키마 + 도메인
3. 컴포지션 + 렌더 분기 + 성능 실측 (D-07)
4. UI
5. E2E + 통합 검증

### 11.3 Session Guide

| Scope | 제목 | 대상 파일 | 종료 조건 |
|-------|------|-----------|-----------|
| **module-1** | 시간축 가변화 | `constants.ts`, `schema.ts`(sections·expectedSectionIds만), `timeline/timeline.ts`, `day1/playback.ts`, `Timeline.tsx`(타입만), `project.ts`(타입 추종) | **기존 유닛 415 + E2E 54 전량 통과.** 3구간 결과가 변경 전과 동일함을 회귀 테스트로 고정. `npm test && npm run build` |
| **module-2** | kv-loop 스키마 + 도메인 | `schema.ts`(arm·copy·refineKvLoop·cyclesOf), `constants.ts`, `kvloop/cycle.ts`, `kvloop/assets.ts`, `types.ts`, `project.ts`(createProject·switchTemplate·applyDurationPreset·buildKvLoopProps·buildEditorSnapshot) | 신규 유닛 전부 통과 + 기존 전량 유지. `npm test && npm run build` |
| **module-3** | 컴포지션 + 성능 게이트 | `KvLoopComposition.tsx`, `kvloop/*.tsx`, `renderEditor.ts` | 루핑 MP4가 실제로 나옴(수동 1회). **`npm run benchmark:render`로 NFR-L01·L02 실측 및 기록 (D-07)** |
| **module-4** | UI | `KvLoopAssetPanel.tsx`, `KvLoopInspector.tsx`, `TemplateSelector.tsx`, `Timeline.tsx`(repeat), `CopyPanel.tsx`, `projectStore.ts`, `EditorWorkspace.tsx` | 편집기에서 전 과정 수동 통과. `npm test && npm run build` |
| **module-5** | E2E + 통합 | `tests/e2e/kv-loop.spec.ts` | SC1~SC9 전부. `npm run test:e2e` 전량 |

권장 세션 분할: module-1 단독 → module-2 단독 → module-3+4 → module-5.
module-1을 반드시 단독으로 끝내는 이유는 Plan §5의 1순위 위험(기존 두 템플릿 회귀)을 다른 변경과 섞지 않기 위해서다. 이 모듈에는 새 기능이 없으므로 **회귀 없음이 곧 완료**다.

### 11.4 Do Entry Checklist

- [ ] `npm test` 기준선 확인 (유닛 415 통과, 실패 0)
- [ ] `npm run build` 기준선 확인
- [ ] `git status` 청결 — module-1을 별도 커밋으로 남길 수 있는 상태
- [ ] `npm run generate:editor-fixture` 완료 (E2E 픽스처)

---

## 12. Requirement Traceability

| FR | 설계 위치 | Module |
|----|-----------|:------:|
| FR-L01 | §6.1 Template Selector | 4 |
| FR-L02 | §3.5 Migration 없음 · §8.1 왕복 테스트 | 1·2 |
| FR-L03 | §3.2 `slots`·`images` · §6.2 KV 목록 | 2·4 |
| FR-L04 | §4.2 `resolveKvSet` · §6.2 상속 배지 | 2·4 |
| FR-L05 | §4.4 `moveBoundary` 일반화 · §6.4 첫 그룹만 핸들 | 1·4 |
| FR-L06 | §3.2 `loopCount` · §6.4 `repeat` prop | 2·4 |
| FR-L07 | §4.3 `kvLoopCombination` · §6.2 비활성 | 2·4 |
| FR-L08 | §5.1 크로스페이드 | 3 |
| FR-L09 | §5.2 `KvScene` Ken Burns | 3 |
| FR-L10 | §5.3 `TitleOverlay` null 반환 | 3 |
| FR-L11 | §3.3 copy · §5.3 `DisclaimerBar` | 2·3 |
| FR-L12 | §5.1 `AudioLayer` 재사용 | 3 |
| FR-L13 | §4.3 `kvLoopMissingImages` · §7 | 2·4 |
| FR-L14 | §3.4 refineKvLoop · §6.5 규격 게이팅 | 2·4 |
| FR-L15 | §6.5 탭 분기 | 4 |
| FR-L16 | §2.2 기존 경로 그대로 | 5 |
| FR-L17 | §3.2 `fadeOutMs` · §5.1 `FadeOut` | 2·3 |
| FR-L18 | module-3 성능 실측 후 판단 (Should) | 3 |
| FR-L19 | §6.2 비세로 경고 | 4 |

| SC | 검증 위치 | Module |
|----|-----------|:------:|
| SC1 | §8.2 E2E 1 | 5 |
| SC2 | §8.2 E2E 2 | 5 |
| SC3 | §8.1 `cycle.ts` SC3 · §8.2 E2E 3 | 2·5 |
| SC4 | §8.2 E2E 4 | 5 |
| SC5 | §4.3 · §5.3 · §8.2 E2E 5 | 2·3·5 |
| SC6 | §4.2 · §8.2 E2E 6 | 2·5 |
| SC7 | §8.1 `kvLoopCombination` | 2 |
| SC8 | §8.1 회귀 · §8.2 E2E 7 | **1** |
| SC9 | 각 모듈 종료 조건 | 전부 |

| NFR | 설계 위치 |
|-----|-----------|
| NFR-L01 | §2.3 · module-3 게이트 (D-07) |
| NFR-L02 | §2.3 · FR-L18 |
| NFR-L03 | §4 도메인 순수 · §9 |
| NFR-L04 | §6 신규 `data-testid`만 추가 |
| NFR-L05 | §7 메시지 전부 한국어 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-08-21 | 최초 Design. Option C(실용 균형) 선택. Design 결정 7개(D-01~D-07) 추가 — 사이클 인지 불변식, KV 장수 = `sections.length`, 누적 반올림 프레임 배분, `slots`/`images` 분리, 셋 단위 언어 폴백, 9:16 강제 위치, 성능 게이트를 module-3으로 이동. `Timeline.tsx`가 이미 제네릭하다는 발견으로 module-1을 회귀 전용 게이트로 정의. | 김성권 / Claude |
