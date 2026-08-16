# Three-Scene Trim Parity Design Document

> **Summary**: 이미 템플릿 무관하게 만들어진 `TrimStrip`·`trimWindow`를 `SceneInspector`에 배선하고, Day1 짧은 소스 게이트와 대칭인 3장면 게이트를 두 렌더 경로에 건다
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-16
> **Status**: Draft — awaiting Do
> **Plan**: [three-scene-trim-parity.plan.md](../../01-plan/features/three-scene-trim-parity.plan.md)
> **Architecture**: Option C — 대칭 쌍 + 호출부 정규화

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 직전 사이클이 D-T03으로 남긴 의도적 비대칭을 닫는다. 자산이 이미 템플릿 무관하게 만들어져 있어 지금이 가장 싼 시점이다. |
| **WHO** | 3장면 템플릿으로 UA 소재를 만드는 사내 UA Manager·마케터. Day1과 3장면을 오가며 쓴다. |
| **RISK** | 게이트를 템플릿 인식형으로 바꾸며 **Day1 차단이 회귀**할 위험, 새 게이트가 **기존 E2E 3개를 실제로 깨뜨린다**는 사실(Plan §1.4 ⑤). |
| **SUCCESS** | 스트립으로 고른 지점이 MP4 출력 시작점과 일치하고, 짧은 소스가 단일 렌더·Batch 양쪽에서 막히며 구간을 줄이면 해소된다. Day1 경로와 유닛·E2E 전량이 회귀 없이 통과한다. |
| **SCOPE** | 도메인 판정 함수 → 두 차단 경로 → 스트립 배선 → Trim Out 읽기전용화 → 기존 E2E 3건 정정. |

---

## 1. Overview

### 1.1 Design Goals

1. **새 추상화를 만들지 않는다.** `TrimStrip`·`useTrimThumbnails`·`trimWindow.ts`·`frameSampler.ts`·`domain/ports`를 **한 줄도 고치지 않는 것**이 이번 설계의 성공 판정이다 (Plan §6.1). 고쳐야 한다면 직전 사이클 D-D03이 틀렸다는 뜻이므로 그 사실을 결정으로 기록한다.
2. **Day1 경로를 바이트 단위로 보존한다.** Day1의 차단 문구·`data-testid`·배지 텍스트는 `day1-trim-ux.spec.ts`가 정확 문자열로 고정하고 있다(§2.0 참조). 3장면을 붙이면서 Day1 문구를 건드리지 않는다.
3. **차단 지점을 한 곳에서 계산한다.** Plan §1.4 ②가 확인한 4사이트 중 단일 렌더 3사이트는 목록 하나를 공유한다. 사이트마다 분기를 넣으면 다음 템플릿에서 또 하나를 빠뜨린다.
4. **막다른 길을 만들지 않는다.** 차단은 항상 해소 경로가 있어야 한다. CTA 예외(D-P03)가 이 원칙의 적용이다.

### 1.2 Key Constraint — Day1 E2E가 문구를 정확 문자열로 고정한다

설계 공간을 실제로 좁히는 제약이라 먼저 적는다.

| 고정된 것 | 위치 |
|-----------|------|
| Batch preflight 문구 전문 `… 해당 패널: A · B` | [day1-trim-ux.spec.ts:352](../../../tests/e2e/day1-trim-ux.spec.ts:352) |
| 배지 `data-testid="day1-short-blocker"` + 텍스트 `2개` | [day1-trim-ux.spec.ts:331·345·365·373](../../../tests/e2e/day1-trim-ux.spec.ts:331) |

따라서 **두 템플릿의 메시지를 하나로 합치는 설계는 불가능하다**. 합치면 Day1 문구가 "해당 패널" → "해당 구간"으로 바뀌어 위 단언이 깨진다. 이것이 §2.0에서 Option B를 기각하는 결정적 근거다.

### 1.3 Key Insight — 3장면은 소스 하나를 세 장면이 나눠 쓴다

Day1은 패널마다 소스가 있다. 3장면은 [project.ts:505](../../../src/domain/editor/project.ts:505) `threeSceneOf(project)?.source` **하나**를 세 장면이 공유하고, 장면마다 `trim`만 다르다. 여기서 설계상 세 가지가 따라 나온다.

1. **판정식이 더 단순하다.** Day1은 패널별 `sourceMs`를 각각 읽지만, 3장면은 `sourceMs` 하나를 세 `sections[index]`와 비교한다.
2. **썸네일이 공짜로 재사용된다.** `useTrimThumbnails`의 캐시 키가 `sourceId` 하나이고 구간 길이는 의도적으로 키에서 빠져 있다([useTrimThumbnails.ts:19](../../../src/features/editor/useTrimThumbnails.ts:19)). 장면을 전환해도 `sourceId`가 같아 캐시 히트다. 이 설계는 직전 사이클이 Day1을 위해 만든 것인데 3장면에서 더 큰 이득을 낸다.
3. **CTA만 소스를 안 볼 수 있다.** §1.4.

### 1.4 Key Insight — CTA 장면은 공유 소스를 안 읽을 수 있다

[CtaScene.tsx:9-63](../../../src/compositions/scenes/CtaScene.tsx:9) `CtaBackground`의 분기와, 그것을 결정하는 [project.ts:1229](../../../src/domain/editor/project.ts:1229) `freezeSourceFrame` 계산을 함께 읽으면 이렇다.

| # | 조건 | 배경 | 검은 화면 |
|---|------|------|:---:|
| 1 | `cta.media` 있음 | CTA 전용 영상 | ✗ |
| 2 | `cta.media` 없음 + `useGeneratedBackground` | 마지막 gameplay 프레임 `Freeze` | ✗ |
| 3 | 둘 다 아님 | 공유 소스의 트림 창 | **✓** |
| 4 | `src` 없음 | `CANVAS_COLOR` 단색 | (별도 게이트) |

`freezeSourceFrame`은 `media || !useGeneratedBackground ? null : …`이므로 **케이스 1·2의 조건은 정확히 `media !== null || useGeneratedBackground`**다. 도메인 판정식이 이 식을 그대로 쓰면 컴포지션과 갈라지지 않는다.

### 1.5 Confirmed Decisions

Plan §1.5의 D-P01~D-P06을 승계한다. Design에서 추가로 확정한 항목이다.

| # | 결정 | 근거 |
|---|------|------|
| **D-D01** | **Option C — 도메인은 템플릿 대칭 쌍, 호출부가 한 줄로 정규화** | §2.0. Option B는 §1.2의 정확 문자열 단언을 깨고, Option A는 사이트 3곳에 같은 분기를 복제한다 |
| **D-D02** | **판정을 단일 장면 술어 `isSceneShorterThanSection` + 집계 `scenesShorterThanSection` 두 개로 나눈다** | 인스펙터 경고와 렌더 게이트가 **반드시 같은 판정**을 써야 한다. CTA 예외가 생겨 Day1처럼 인스펙터에 인라인 복제하면 두 곳이 갈라진다. Day1과의 형태 비대칭은 이 이유로 의도적이다 |
| **D-D03** | **`isTrimShorterThanScene`을 제거한다** | `scenesShorterThanSource` 삭제(FR-C01)와 인스펙터 술어 교체(D-D02)로 생산 소비자가 0이 된다. **내 변경이 만든 고아**이므로 CLAUDE.md §3에 따라 제거 대상이다 |
| **D-D04** | **차단 배지는 요소 하나에 템플릿별 `testId`와 명사를 준다** (`day1-short-blocker` / `scene-short-blocker`, `패널` / `장면`) | Day1 마크업과 단언을 그대로 두면서 3장면을 추가하는 최소 형태. 배지를 둘로 복제하지 않는다 |
| **D-D05** | **`preflightIssues`의 3장면 분기를 `else if` 체인에서 `else { … }` 블록으로 바꿔 Day1 분기와 대칭으로 만든다** | 짧은 소스 검사는 `sourceResolved === true`인 정상 경로에서 돌아야 한다. `else if`를 하나 더 붙이면 **영원히 실행되지 않는다** (§5.2) |
| **D-D06** | **CTA 예외는 `cta.media`의 URL 해소 여부를 보지 않는다** | 도메인 함수는 세션 URL을 모른다. 알게 하려면 `resolveUrl`을 도메인에 주입해야 하고 그 비용이 이득을 넘는다. 남는 빈틈은 §6에 한정 사항으로 명시한다 |
| **D-D07** | **`scene-` 접두 `testId`를 쓰고 기존 `trim-in`·`trim-range`는 유지한다** | 기존 3장면 단언(`hook-analysis`·`editor-vertical-slice`·`persistence-recovery`)이 접두 없는 이름을 쓴다. 새 요소에만 접두를 붙여 스트립 관련 요소를 묶는다 |
| **D-D08** | **CTA 장면에도 스트립을 표시한다** | 케이스 3에서는 CTA도 공유 소스의 트림 창을 재생한다. 트림 필드가 이미 세 장면 모두에 있으므로 스트립만 빼면 오히려 일관성이 깨진다 |

> **Do 단계 기록 규칙**: Do 중 이 표에 없는 결정을 내리면 그 자리에서 이 표(또는 Plan §1.5)에 행을 추가한다. Check까지 미루지 않는다.

---

## 2. Architecture

### 2.0 Option Comparison

| | A — 사이트별 분기 | B — 도메인 통합 | **C — 대칭 쌍 + 호출부 정규화 (선택)** |
|---|---|---|---|
| 도메인 | 3장면 함수 추가 | 두 함수를 `shortSourceSections` 하나로 | 3장면 함수 추가 (Day1과 대칭) |
| 라벨·문구 | 호출부 | **도메인** | 호출부 (현행 유지) |
| `EditorWorkspace` | 사이트 3곳이 각각 `day1 ? … : …` | 목록 하나 | `shortSections` **한 줄** → 세 사이트 공유 |
| `preflightIssues` | 3장면 분기에 블록 | 분기 밖 한 블록 | 3장면 분기에 대칭 블록 |
| Day1 문구·`testId` | 불변 | **변경 → §1.2 단언 파손** | 불변 |
| 사이트 누락 위험 | 높음 (3곳 각각 수정) | 낮음 | 낮음 (한 곳) |
| CLAUDE.md §2 부합 | ✅ | ❌ 라벨 체계를 도메인으로 승격 | ✅ |

**선택 근거**: B는 §1.2의 정확 문자열 단언을 깨뜨려 Day1 E2E 수정이 강제되는데, 이번 사이클의 최대 위험이 바로 Day1 회귀다. A는 Plan §1.4 ②가 "사이트를 빠뜨리기 쉽다"고 지목한 바로 그 구조를 3배로 만든다. C만 두 문제를 모두 피한다.

### 2.1 Component Diagram

```
features/editor/EditorWorkspace.tsx
  ├─ frameSampler (기존 prop, App.tsx가 주입 — 배선 변경 없음)
  ├─ projectSource / source.sourceUrl (기존 지역 변수)
  ├─ shortSections = day1 ? day1PanelsShorterThanSection : scenesShorterThanSection   ◄── D-D01
  │     ├─ startRender() 가드           (사이트 1)
  │     ├─ 렌더 버튼 disabled            (사이트 2)
  │     └─ 차단 배지 (testId 분기)        (사이트 3, D-D04)
  │
  └─ SceneInspector                                     [신규 prop 3개]
       └─ InspectorSection "Trim"
            ├─ TrimStrip ◄── 무수정 재사용 (Plan §6.1)
            ├─ SecondsField (Trim In, 유지)
            ├─ Trim Out 읽기전용 표시                    [변경]
            ├─ trim-range 힌트 (유지)
            └─ 짧은 소스 경고 ◄── isSceneShorterThanSection  [술어 교체]

features/editor/useRenderQueue.ts
  └─ preflightIssues
       ├─ if (day1)  { … 기존 … }                        무수정
       └─ else       { 소스 검사 + 짧은 장면 검사 }        (사이트 4, D-D05)

domain/editor/project.ts
  ├─ isSceneShorterThanSection   [신규] 단일 장면 술어 + CTA 예외
  ├─ scenesShorterThanSection    [신규] 집계
  ├─ scenesShorterThanSource     [삭제] FR-C01
  ├─ setSceneTrimOutMs           [삭제] FR-P06
  └─ setDay1TrimOutMs            [삭제] FR-C04

domain/timeline/timeline.ts
  └─ isTrimShorterThanScene      [삭제] D-D03
```

### 2.2 Data Flow — 창 드래그부터 렌더 차단까지

```
[스트립 조작]
  포인터 드래그 → TrimStrip.onCommit(ms)
    → SceneInspector.onTrimInMs
      → store().setTrimIn(selectedKind, ms)
        → setSceneTrimInMs → reconcileTrim (clamp, out = in + windowMs)
          → SceneInspector 재렌더: 창 위치·Trim Out 표시·trim-range 동시 갱신

[짧은 소스 판정]  ※ 트림과 무관하게 sourceMs vs sectionMs 로만 결정된다
  project.sections[i].durationMs, threeScene.source.durationMs, scene.cta
    → isSceneShorterThanSection(scene, sourceMs, sectionMs)
        ├─ SceneInspector 경고            (FR-S07)
        └─ scenesShorterThanSection(project)
             ├─ EditorWorkspace.shortSections → 사이트 1·2·3   (FR-S03·S06)
             └─ preflightIssues 3장면 블록 → 사이트 4          (FR-S04)
```

판정 입력이 `trim`이 아니라 `source`와 `section`이라는 점이 중요하다. 사용자가 창을 어디로 옮기든 짧은 소스는 짧다 — 트림으로는 해소되지 않으며, 해소 경로는 구간 축소 또는 더 긴 소스 두 가지뿐이다. 차단 문구가 그 둘을 명시하는 근거다.

### 2.3 배선의 최소성 검증

`TrimStrip`이 요구하는 8개 prop이 `EditorWorkspace`에 이미 있는지의 대조표다. **하나도 새로 만들지 않는다**는 것이 D-P01의 실질이다.

| `TrimStripProps` | 3장면 공급원 | 신규 여부 |
|---|---|---|
| `sampler` | `frameSampler` ([EditorWorkspace.tsx:131](../../../src/features/editor/EditorWorkspace.tsx:131) prop) | 기존 |
| `url` | `source.sourceUrl` ([:324](../../../src/features/editor/EditorWorkspace.tsx:324)) | 기존 |
| `sourceId` | `projectSource?.id ?? null` ([:232](../../../src/features/editor/EditorWorkspace.tsx:232)) | 기존 |
| `sourceDurationMs` | `projectSource?.durationMs ?? 0` — 이미 `sourceDurationMs` prop으로 전달 중 | 기존 |
| `sectionDurationMs` | `selectedSectionMs` — 이미 `sceneDurationMs` prop으로 전달 중 | 기존 |
| `inMs` | `scene.trim.inMs` | 기존 |
| `onCommit` | `onTrimInMs` — 이미 prop | 기존 |
| `disabled` | `controlsDisabled` (SceneInspector 지역 변수) | 기존 |
| `testIdPrefix` | 상수 `'scene'` | 리터럴 |

`SceneInspector`에 새로 추가되는 prop은 **`frameSampler` · `sourceUrl` · `sourceId` 세 개뿐**이다.

---

## 3. Domain (순수)

### 3.1 `isSceneShorterThanSection` — `domain/editor/project.ts`

`day1PanelsShorterThanSection`([project.ts:1076](../../../src/domain/editor/project.ts:1076)) 바로 뒤에 둔다.

```ts
/**
 * Three-Scene Trim Parity Design Ref: §1.4 — the CTA scene does not always read
 * the shared source. With its own `media`, or with a generated background, the
 * composition never plays the trim window, so nothing goes black there. The
 * condition mirrors `freezeSourceFrame` in `buildCompositionProps` exactly; if
 * one moves the other has to move with it.
 */
const ctaSkipsSharedSource = (scene: EditorScene) =>
  scene.kind === 'cta' &&
  scene.cta !== undefined &&
  (scene.cta.media !== null || scene.cta.useGeneratedBackground);

/**
 * FR-S01/FR-S02 — a scene whose section outlasts the source renders black once
 * the source runs out. The inspector warning and the render gate both go through
 * here so they can never disagree.
 */
export const isSceneShorterThanSection = (
  scene: EditorScene,
  sourceDurationMs: number,
  sectionDurationMs: number,
) =>
  sourceDurationMs > 0 &&
  sourceDurationMs < sectionDurationMs &&
  !ctaSkipsSharedSource(scene);
```

**`sourceDurationMs > 0` 가드**가 Day1 함수와 같은 역할을 한다 — 소스가 아예 없으면 `preflightIssues`의 `영상 소재가 없습니다`가 이미 말하므로 이중 보고하지 않는다.

**`trim`이 아니라 `source`를 읽는 이유**: `reconcileTrim`이 창을 `min(section, source)`로 맞추므로 두 식은 정합 상태에서 동치다. 그러나 `source`를 직접 읽는 쪽이 (a) Day1 함수와 형태가 같고, (b) 아직 reconcile되지 않은 임포트 문서에서도 옳다.

### 3.2 `scenesShorterThanSection` — 집계

```ts
/** FR-S01 — the scenes the render gate blocks on. `SceneKind[]`, mirroring `day1PanelsShorterThanSection`. */
export const scenesShorterThanSection = (project: EditorProject): SceneKind[] => {
  const settings = threeSceneOf(project);
  const sourceMs = settings?.source?.durationMs ?? 0;

  return (settings?.scenes ?? [])
    .filter((scene, index) =>
      isSceneShorterThanSection(
        scene,
        sourceMs,
        project.sections[index]?.durationMs ?? 0,
      ),
    )
    .map((scene) => scene.kind);
};
```

**`scenesShorterThanSource`와의 차이** (Plan §1.4 ⑥이 지목한 셋을 모두 해소):

| | 구 `scenesShorterThanSource` | 신 `scenesShorterThanSection` |
|---|---|---|
| 반환형 | `EditorScene[]` | `SceneKind[]` — Day1과 대칭 |
| 소스 없음 | 3장면 전부 보고 (이중 보고) | `[]` |
| CTA | 무조건 포함 | 예외 (D-P03) |
| 이름 | 뜻이 뒤집혀 읽힘 | `day1PanelsShorterThanSection`과 쌍 |

### 3.3 삭제 대상과 그 근거

| 대상 | 위치 | 근거 | FR |
|------|------|------|-----|
| `scenesShorterThanSource` | [project.ts:1119](../../../src/domain/editor/project.ts:1119) | §3.2가 대체 | FR-C01 |
| `isTrimShorterThanScene` | [timeline.ts:124](../../../src/domain/timeline/timeline.ts:124) | 위 삭제 + §5.1 술어 교체로 생산 소비자 0 → **내 변경이 만든 고아** | D-D03 |
| `setSceneTrimOutMs` | [project.ts:518](../../../src/domain/editor/project.ts:518) | Trim Out 읽기전용화(D-P02)로 소비자 0 | FR-P06 |
| `projectStore.setTrimOut` | [projectStore.ts:181](../../../src/features/editor/projectStore.ts:181) | 위와 동일 | FR-P06 |
| `SceneInspectorProps.onTrimOutMs` | [SceneInspector.tsx:79](../../../src/features/editor/SceneInspector.tsx:79) | 위와 동일 | FR-P06 |
| `setDay1TrimOutMs` | [project.ts:898](../../../src/domain/editor/project.ts:898) | 직전 사이클이 남긴 고아. **범위를 좁히려면 이 행만 빼면 된다** | FR-C04 |

동반 삭제할 유닛 테스트: `project.test.ts`의 `setSceneTrimOutMs` 케이스([:119](../../../src/domain/editor/project.test.ts:119))와 `scenesShorterThanSource` 케이스([:127](../../../src/domain/editor/project.test.ts:127)), `timeline.test.ts`의 `isTrimShorterThanScene` 케이스([:116](../../../src/domain/timeline/timeline.test.ts:116)), `day1Commands.test.ts`의 `setDay1TrimOutMs` 케이스([:238·:401](../../../src/domain/editor/day1Commands.test.ts:238)).

`:127` 케이스는 삭제가 아니라 §3.2 기준으로 **다시 쓴다**(FR-C02).

---

## 4. UI — `SceneInspector`

### 4.1 Props 변경

```ts
export interface SceneInspectorProps {
  // … 기존 …
  sourceDurationMs: number | null;
  frameSampler: FrameSampler;   // 신규 (FR-P01)
  sourceUrl: string | null;     // 신규 — 세션 URL, 미해소면 null
  sourceId: string | null;      // 신규 — 썸네일 캐시 키
  onTrimInMs: (ms: number) => void;
  // onTrimOutMs 제거 (FR-P06)
}
```

### 4.2 Trim 섹션 최종 형태

Day1Inspector([:167-215](../../../src/features/editor/Day1Inspector.tsx:167))와 같은 순서 — 스트립 → Trim In → Trim Out 읽독 → 힌트 → 경고.

```tsx
const shortSource = isSceneShorterThanSection(
  scene,
  sourceDurationMs ?? 0,
  sceneDurationMs,
);

<InspectorSection badge={`장면 ${formatSeconds(sceneDurationMs)}s`} id="trim" defaultOpen title="Trim">
  {/* FR-P02 — the same strip Day1 uses, wired to the shared source. */}
  <TrimStrip
    disabled={controlsDisabled}
    inMs={scene.trim.inMs}
    onCommit={onTrimInMs}
    sampler={frameSampler}
    sectionDurationMs={sceneDurationMs}
    sourceDurationMs={sourceDurationMs ?? 0}
    sourceId={sourceId}
    testIdPrefix="scene"
    url={sourceUrl}
  />

  <SecondsField … testId="trim-in" onCommit={onTrimInMs} valueMs={scene.trim.inMs} />

  {/* FR-P05 — `reconcileTrim` derives the out point, so it is shown, not entered. */}
  <p className="field field--readout">
    <span>
      Trim Out (초)
      <strong data-testid="trim-out">{formatSeconds(scene.trim.outMs)}</strong>
    </span>
  </p>

  <p className="panel__hint" data-testid="trim-range">…기존 그대로…</p>

  {shortSource ? (
    <p className="notice notice--warning" data-testid="scene-trim-short">
      원본이 장면보다 짧아 남은 시간은 검은 화면으로 출력됩니다. 장면 길이를
      줄이거나 더 긴 영상을 사용하세요.
    </p>
  ) : null}
</InspectorSection>
```

**문구 변경 (FR-S07)**: 현재 "장면 길이를 줄이세요"에 "또는 더 긴 영상을 사용하세요"를 더한다. Day1 문구와 달리 **"구간"이 아니라 "장면"**을 유지한다 — 3장면 UI의 다른 문구가 모두 "장면"을 쓰고, [editor-vertical-slice.spec.ts:209](../../../tests/e2e/editor-vertical-slice.spec.ts:209)가 앞 문장을 정확 문자열로 단언하므로 그 문장은 그대로 둔다.

**새 `testId` (D-D07)**: `scene-trim-short`, 그리고 `TrimStrip`이 만드는 `scene-trim-strip` · `scene-trim-window` · `scene-trim-preview`.

### 4.3 `EditorWorkspace` 변경

```tsx
<SceneInspector
  …
  frameSampler={frameSampler}
  sourceId={projectSource?.id ?? null}
  sourceUrl={source.sourceUrl}
  onTrimInMs={(ms) => store().setTrimIn(selectedKind, ms)}
  // onTrimOutMs 행 제거
/>
```

`frameSampler`는 이미 이 컴포넌트의 prop이다. **`App.tsx`는 수정하지 않는다.**

---

## 5. 렌더 차단 — 4사이트

### 5.1 단일 MP4 경로 (사이트 1·2·3)

[EditorWorkspace.tsx:328](../../../src/features/editor/EditorWorkspace.tsx:328)의 `shortPanels`를 템플릿 인식 목록으로 바꾼다.

```ts
// Three-Scene Trim Parity Design Ref: §2.0 Option C — one list, so the three
// sites below never drift apart when a template is added.
const shortSections = day1
  ? day1PanelsShorterThanSection(project)
  : scenesShorterThanSection(project);
```

사이트 1·2는 `shortPanels.length > 0` → `shortSections.length > 0` 로 이름만 바뀐다. 사이트 3(배지)만 명사와 `testId`가 템플릿을 탄다 (D-D04).

```tsx
{shortSections.length > 0 ? (
  <span
    className="editor__blocker"
    data-testid={day1 ? 'day1-short-blocker' : 'scene-short-blocker'}
  >
    원본이 구간보다 짧은 {day1 ? '패널' : '장면'} {shortSections.length}개
  </span>
) : null}
```

Day1일 때의 렌더 결과는 현재와 **완전히 동일한 DOM**이다 — `day1-trim-ux.spec.ts`의 `toContainText('2개')`가 그대로 통과한다.

### 5.2 Batch 경로 (사이트 4) — `else if` 체인을 블록으로

**여기가 이번 설계에서 유일하게 틀리기 쉬운 지점이다.** 현재 구조:

```ts
if (project.templateSettings.template === 'day1') {
  … missing / !sourceResolved / shortPanels …
} else if (!threeSceneOf(project)?.source) {
  issues.push('영상 소재가 없습니다.');
} else if (!sourceResolved) {
  issues.push('원본 영상이 연결되지 않았습니다. 파일을 다시 연결하세요.');
}
```

짧은 장면 검사를 **`else if`로 하나 더 붙이면 영원히 실행되지 않는다** — 소스가 있고 해소된 정상 경로에서는 앞의 두 조건이 모두 거짓이라 체인이 거기서 끝나기 때문이다. 이것이 Plan §7이 Design에 넘긴 항목이고, Day1 분기와 대칭인 블록으로 바꿔 해결한다.

```ts
if (project.templateSettings.template === 'day1') {
  … 기존 그대로, 한 줄도 바꾸지 않는다 …
} else {
  if (!threeSceneOf(project)?.source) {
    issues.push('영상 소재가 없습니다.');
  } else if (!sourceResolved) {
    issues.push('원본 영상이 연결되지 않았습니다. 파일을 다시 연결하세요.');
  }

  // Three-Scene Trim Parity FR-S04/FR-S05 — the Day1 block above says the same
  // thing about panels. A separate `if`, not another `else if`: the source can be
  // present and resolved and still too short, which is the whole point.
  const shortScenes = scenesShorterThanSection(project);

  if (shortScenes.length > 0) {
    issues.push(
      `원본이 장면보다 짧아 검은 화면이 출력됩니다. 장면 길이를 줄이거나 더 긴 영상을 사용하세요. 해당 장면: ${shortScenes
        .map((kind) => SCENE_LABELS[kind])
        .join(' · ')}`,
    );
  }
}
```

`SCENE_LABELS`([types.ts:62](../../../src/domain/editor/types.ts:62))는 `Hook` · `Gameplay` · `CTA`. `DAY1_PANEL_LABEL`과 같은 역할이므로 새 라벨 맵을 만들지 않는다.

### 5.3 4사이트 최종 대조표

| # | 위치 | Day1 | 3장면 | 변경 |
|---|------|:---:|:---:|------|
| 1 | `startRender()` 가드 | ✅ 현행 | ✅ 신규 | 변수명만 |
| 2 | 버튼 `disabled` | ✅ 현행 | ✅ 신규 | 변수명만 |
| 3 | 차단 배지 | ✅ 현행 | ✅ 신규 | `testId`·명사 분기 |
| 4 | `preflightIssues` | ✅ 현행 | ✅ 신규 | `else` 블록화 |

---

## 6. Error Handling and Degradation

| 상황 | 처리 | 근거 |
|------|------|------|
| 소스 미업로드 | 스트립 미표시(`TrimStrip`이 `sourceDurationMs <= 0`에 `null` 반환), 경고 없음(`sourceMs > 0` 가드), 렌더는 `영상 소재가 없습니다`로 차단 | §3.1 |
| 소스 미해소 (리로드 후) | `url === null` → 스트립 미표시. 짧은 소스 판정은 `durationMs` 메타데이터로 계속 동작 | §3.1 |
| 썸네일 전량 실패 | `TrimStrip`이 스스로 접고 `SecondsField`만 남는다 (FR-P10, 기존 동작) | `TrimStrip.tsx:182` |
| 소스가 모든 장면보다 짧음 | 세 장면 모두 창이 트랙 전체를 덮고 드래그 비활성 (FR-S08). 배지 `3개` | `TrimStrip` `locked` |
| **`cta.media`가 설정됐지만 URL 미해소** | **판정에서 제외되지만 실제로는 공유 소스가 재생돼 검은 화면이 될 수 있다** | **D-D06 — 알려진 한정 사항.** 도메인이 세션 URL을 모른다. 이 상태는 리로드 직후에만 생기고 `source-repair` 흐름이 이미 노출한다. 해소하려면 `resolveUrl`을 도메인에 주입해야 해 비용이 이득을 넘는다 |
| 임포트 문서의 미정합 trim | 판정이 `source`/`section`을 읽으므로 영향 없음 | §3.1 |

---

## 7. Test Plan

### 7.1 Unit (vitest)

| 대상 | 케이스 |
|------|--------|
| `isSceneShorterThanSection` | `sourceMs=0` → false / `source < section` → true / 정확히 같음 → false / `source > section` → false |
| `isSceneShorterThanSection` | CTA + `media` 있음 → false / CTA + `useGeneratedBackground` → false / CTA + 둘 다 없음 → true / hook·gameplay는 `cta` 필드와 무관 |
| `scenesShorterThanSection` | 소스 없음 → `[]` / 12s 소스 + 30초 프리셋 → `['gameplay']` / 3s 소스 + 15초 프리셋 → `['gameplay']` / CTA만 짧고 전용 영상 있음 → `[]` |
| `preflightIssues` | 3장면 짧은 장면 → 차단 문구 + 장면 이름 지목 / 소스 없음 → 짧은 소스 문구 **미포함**(이중 보고 방지) / **Day1 프로젝트의 기존 문구가 문자 그대로 유지** |
| `projectStore` | `setTrimOut` 제거 후 타입·기존 액션 정상 |

마지막 `preflightIssues` 행이 §1.2 제약의 유닛 레벨 방어선이다 — E2E까지 가기 전에 Day1 문구 변경을 잡는다.

### 7.2 E2E (Playwright) — `tests/e2e/three-scene-trim-parity.spec.ts`

12초 `gameplay-sample.mp4`와 프리셋만으로 전 시나리오가 성립한다. **새 픽스처가 필요 없다.**

| # | 시나리오 | SC |
|---|----------|-----|
| T1 | 소스 업로드 → gameplay 선택 → `scene-trim-strip` 16칸 → 창 드래그 → `trim-in` 값 변화 | SC1 |
| T2 | hook 장면(2s 구간, 최대 Trim In 10s)에서 창을 6초 지점에 놓고 렌더 → 출력 0.2s가 소스 6s (팔레트 index 6) | SC2 |
| T3 | hook(2s) → gameplay(10s) 전환 → 창 폭이 바뀌고 썸네일이 **즉시** 표시(재샘플링 없음) | SC3 |
| T4 | 30초 프리셋 → `scene-trim-short` 경고 + `scene-short-blocker` `1개` + 버튼 비활성 + Batch preflight 문구 | SC4 |
| T5 | 이어서 15초로 복귀 → 경고·배지·차단 모두 해소, 창 다시 드래그 가능 | SC5 |
| T6 | `trim-out`이 입력이 아닌 표시이고, `trim-in` 입력 시 함께 갱신 | SC8 |
| T7 | 창에 포커스 후 ArrowRight → `aria-valuenow`와 `trim-in` 증가 | FR-P07 |
| R1 | `hook-analysis.spec.ts` — Hook 후보 적용 후 `trim-range`와 창 위치가 함께 이동 | SC7 |
| R2 | `day1-trim-ux.spec.ts` · `day1-template.spec.ts` 전량 | SC9 |

T2는 직전 사이클 E2와 같은 방법 — `tests/e2e/helpers/videoSampling.ts`의 `sampleRegion` · `meanRgb` · `nearestPaletteIndex` + `gameplay-sample.colors.json` 팔레트.

T4의 배지가 `1개`인 이유: 30초 프리셋 `[3, 24, 3]`에 12초 소스면 gameplay만 짧다(hook·cta는 3초 구간). CTA 예외를 타지 않고도 `1개`가 나오는 조합이라 예외 로직과 독립적으로 검증된다.

### 7.3 기존 E2E 정정 (FR-E01~E03)

**FR-E01 — 코덱 픽스처**: [generate-editor-fixture.mjs:178·182](../../../scripts/generate-editor-fixture.mjs:178)의 `duration=3` → `duration=12`. [:211](../../../scripts/generate-editor-fixture.mjs:211)의 ALAC 오디오 픽스처는 렌더 경로를 타지 않으므로 **3초 유지**. `media-codec-compat.spec.ts` 본문 무수정.

**FR-E02 — `persistence-recovery.spec.ts`**: [:62](../../../tests/e2e/persistence-recovery.spec.ts:62)의 단언을 지우지 않고, 차단 사유가 바뀌었음을 드러내는 형태로 바꾼다.

```ts
await expect(page.getByTestId('relink-verdict')).toBeHidden();

// The relink must not reset the edit that was restored.
await expect(page.getByTestId('timeline-duration-gameplay')).toHaveText('24.0초');

// Three-Scene Trim Parity FR-S03 — the relink gate has cleared, and what holds
// the button now is the 12s source against a 24s gameplay section. Shortening
// the project proves the relink did restore renderability.
await expect(page.getByTestId('scene-short-blocker')).toBeVisible();
await page.getByRole('button', {name: '15초'}).click();
await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeEnabled();
```

"relink가 렌더 가능 상태를 되돌린다"는 의도가 보존될 뿐 아니라, **relink 게이트와 짧은 소스 게이트가 서로 독립임을 함께 단언**하게 되어 커버리지가 늘어난다.

**FR-E03 — `editor-vertical-slice.spec.ts`**: [:185-186](../../../tests/e2e/editor-vertical-slice.spec.ts:185)의 `fillField('trim-out', '9')`를 읽기전용 단언으로 교체한다.

```ts
// Trim out is derived from trim in, so it is shown rather than entered.
await expect(page.getByTestId('trim-out')).toHaveText('12.00');
```

직전 `trim-in '99'` 단언이 남긴 상태가 `2.00s – 12.00s`이므로 Out은 `12.00`이다. 이 스펙의 [:206-210](../../../tests/e2e/editor-vertical-slice.spec.ts:206) 경고 확인 블록은 문구 앞 문장이 유지되므로 무수정이다.

**하류 영향 없음을 확인했다** — 삭제되는 `trim-out '9'`는 gameplay 트림을 `0.00s – 10.00s`로 바꾸지만, 렌더 직전 [:219-220](../../../tests/e2e/editor-vertical-slice.spec.ts:219)에서 `trim-in '99'`로 다시 `2.00s – 12.00s`가 되므로 렌더 단언이 보는 상태는 같다.

`SCENE_LABELS`는 `useRenderQueue`가 이미 import하는 [`domain/editor/types`](../../../src/domain/editor/types.ts:62)에 있어 새 import 경로가 생기지 않는다 (현재는 `type` import뿐이므로 값 import 한 줄을 더한다).

### 7.4 Regression Gate

모듈 종료마다 `npm test && npm run build`. **module-2 종료 시 `day1-trim-ux.spec.ts`를 반드시 포함한다** — 게이트를 건드리는 유일한 회귀 접점이다(SC9). 전체 종료 시 `npx playwright test` 전량 + 코덱 픽스처 재생성 후 `media-codec-compat` 실측.

---

## 8. Architecture Compliance

| 규칙 | 준수 |
|------|------|
| `features` → `infrastructure` 금지 | `FrameSampler`는 `domain/ports` 타입으로만 참조. 구현은 `App.tsx`가 주입 (변경 없음) |
| `domain`에 react/remotion 금지 | §3의 두 함수는 순수 |
| `domain`이 컴포지션을 알지 않을 것 | CTA 예외는 `CtaSceneSettings`(도메인 스키마) 필드만 읽는다. `CtaScene`은 import하지 않고 조건식만 주석으로 연결 |
| 컴포넌트가 포트를 직접 만들지 않을 것 | `SceneInspector`는 prop으로 받는다 |

`src/test/architecture.test.ts`가 자동 검증한다.

---

## 9. Out of Scope

Plan §2.2를 승계한다. Design에서 추가로 확정한 제외 항목:

| 항목 | 사유 |
|------|------|
| `cta.media`의 URL 해소 여부를 판정에 반영 | D-D06 · §6. `resolveUrl`을 도메인에 주입하는 비용이 이득을 넘는다 |
| `day1PanelsShorterThanSection`을 `isSceneShorterThanSection` 형태로 리팩터 | Day1은 CTA 예외가 없어 술어 분리의 이유가 없다. 안 깨진 것을 고치지 않는다 (CLAUDE.md §3) |
| Day1Inspector의 인라인 술어를 공유 함수로 교체 | 위와 같음. 3장면만 술어를 공유하는 비대칭은 D-D02에 근거가 있다 |
| 3장면 배지 문구를 Day1과 통일 | §1.2 — Day1 문구가 E2E에 정확 문자열로 고정돼 있다 |

---

## 10. Implementation Guide

### 10.1 File Structure

```
src/
├── domain/
│   ├── editor/project.ts              [수정] isSceneShorterThanSection·scenesShorterThanSection 추가,
│   │                                          scenesShorterThanSource·setSceneTrimOutMs·setDay1TrimOutMs 삭제
│   ├── editor/project.test.ts         [수정] FR-C02·C03, 삭제분 정리
│   ├── editor/day1Commands.test.ts    [수정] setDay1TrimOutMs 케이스 정리 (FR-C04)
│   ├── timeline/timeline.ts           [수정] isTrimShorterThanScene 삭제 (D-D03)
│   └── timeline/timeline.test.ts      [수정] 위 케이스 정리
├── features/editor/
│   ├── SceneInspector.tsx             [수정] prop 3개·스트립·Out 읽독·경고 술어 (§4)
│   ├── EditorWorkspace.tsx            [수정] prop 전달·shortSections·사이트 1·2·3 (§4.3, §5.1)
│   ├── useRenderQueue.ts              [수정] 사이트 4 (§5.2)
│   ├── useRenderQueue.test.ts         [수정] 3장면 preflight + Day1 문구 고정
│   ├── projectStore.ts                [수정] setTrimOut 삭제
│   └── editor.css                     [수정 가능] 필요 시에만. `.trim__*` 재사용
├── scripts/generate-editor-fixture.mjs [수정] 코덱 픽스처 12초 (FR-E01)
└── tests/e2e/
    ├── three-scene-trim-parity.spec.ts [신규] T1~T7
    ├── persistence-recovery.spec.ts    [수정] FR-E02
    └── editor-vertical-slice.spec.ts   [수정] FR-E03
```

신규 1, 수정 13. **`TrimStrip.tsx` · `useTrimThumbnails.ts` · `trimWindow.ts` · `frameSampler.ts` · `domain/ports` · `App.tsx`는 이 목록에 없다** — D-P01의 판정 기준이다.

### 10.2 Implementation Order

1. 도메인 판정 함수 + 유닛 테스트 (UI 없이 CTA 예외까지 전부 검증 가능)
2. 차단 4사이트 + `preflightIssues` 유닛 + **Day1 회귀 게이트**
3. 스트립 배선 + Trim Out 읽기전용 + 고아 제거
4. E2E 신규 + 기존 3건 정정 + 픽스처 재생성

근거: **차단(2)을 배선(3)보다 먼저** 한다. 직전 사이클과 반대 순서인데, 이번 최대 위험이 Day1 게이트 회귀라 가장 위험한 것을 먼저 격리해 검증하기 위해서다. 3은 2와 독립이고, 4는 1~3이 다 끝나야 의미가 있다.

### 10.3 Session Guide

| 모듈 | 범위 | FR | 종료 조건 |
|------|------|-----|-----------|
| **module-1** | §3 판정 함수 2개 + 유닛 테스트 + `scenesShorterThanSource` 삭제·교체 | S01·S02·C01·C02·C03 | §7.1의 앞 세 행 전량 통과 |
| **module-2** | §5 차단 4사이트 + `preflightIssues` 유닛 | S03~S06 | `npm test` + **`day1-trim-ux.spec.ts` 통과 (SC9)** |
| **module-3** | §4 스트립 배선 + Trim Out 읽독 + §3.3 고아 제거 | P01~P10·S07·S08·C04·**E03** | T1·T3·T6·T7 통과, `trim-out` 참조 grep 처리 완료 |
| **module-4** | E2E 신규 T2·T4·T5 + FR-E01·E02 + 전량 실행 | E01·E02 | `npx playwright test` 42+ passed |

권장 분할: **module-1+2 한 세션**(도메인 → 소비가 자연스럽게 이어지고, 회귀 게이트를 한 번에 통과시킬 수 있다), **module-3 단독**, **module-4 단독**(픽스처 재생성 + E2E 실행 시간).

`FR-E03`을 module-3에 넣은 이유: Trim Out을 읽기전용으로 바꾸는 커밋과 그 단언을 고치는 커밋이 갈라지면 그 사이 커밋에서 E2E가 깨진 상태로 남는다.

### 10.4 Do Entry Checklist

- [ ] `trim-out` · `setTrimOut` · `setSceneTrimOutMs` · `setDay1TrimOutMs` · `isTrimShorterThanScene` · `scenesShorterThanSource` 참조 전수 grep
- [ ] module-2 착수 전 `day1-trim-ux.spec.ts` 기준선 통과 확인
- [ ] `preflightIssues` 수정 시 **Day1 분기를 한 줄도 건드리지 않았는지** diff로 확인 (§1.2)
- [ ] 코덱 픽스처 재생성 후 `ffprobe`로 12초 확인, ALAC은 3초 유지 확인
- [ ] 코드 주석 규약: `// Three-Scene Trim Parity Design Ref: §{절}` / `// Plan SC: {기준}`
- [ ] Do 중 새 결정은 그 자리에서 §1.5 또는 Plan §1.5에 추가 (회고 교훈 2번)

---

## 11. Requirement Traceability

| FR | 설계 위치 | 검증 |
|----|-----------|------|
| FR-P01 | §4.1 prop 3개, §4.3 | T1 |
| FR-P02 | §4.2 `TrimStrip`, §2.3 대조표 | T1 |
| FR-P03 | §2.2 데이터 흐름 | T1 |
| FR-P04 | §4.2 `onTrimInMs` 공유 | T6 |
| FR-P05 | §4.2 읽독 교체 | T6, FR-E03 |
| FR-P06 | §3.3 삭제 표 | 유닛, `tsc -b` |
| FR-P07 | §4.2 `scene-` 접두 (D-D07) | T1·T4·T7 |
| FR-P08 | §1.3 캐시 키 | T3 |
| FR-P09 | `TrimStrip` 기존 비동기 샘플링 | T1 |
| FR-P10 | §6 축퇴 표 | 수동 |
| FR-S01 | §3.1·§3.2 | 유닛 |
| FR-S02 | §3.1 `ctaSkipsSharedSource` | 유닛 |
| FR-S03 | §5.1 사이트 1·2 | T4 |
| FR-S04 | §5.2 사이트 4 | T4 |
| FR-S05 | §5.2 문구 | T4, 유닛 |
| FR-S06 | §5.1 사이트 3 (D-D04) | T4 |
| FR-S07 | §4.2 경고 문구 | T4 |
| FR-S08 | `TrimStrip` `locked` (무수정) | T4·T5 |
| FR-C01 | §3.3 | `tsc -b` |
| FR-C02 | §3.2 대조표 | 유닛 |
| FR-C03 | §7.1 | 유닛 |
| FR-C04 | §3.3 (Should) | 유닛 |
| FR-E01 | §7.3 | `media-codec-compat` |
| FR-E02 | §7.3 | `persistence-recovery` |
| FR-E03 | §7.3 | `editor-vertical-slice` |

**SC 커버리지**: SC1→T1, SC2→T2, SC3→T3, SC4→T4, SC5→T5, SC6→§7.1 CTA 행, SC7→R1, SC8→T6, SC9→R2, SC10→§7.4. 전 10개 기준에 검증 경로가 있다.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-08-16 | 최초 Design. Option C(대칭 쌍 + 호출부 정규화) 선택. Plan §7이 넘긴 5개 항목 확정 — 판정 함수 형태(D-D02), 목록 계산 위치(§5.1), `preflightIssues` 블록화(D-D05, `else if`로 붙이면 실행되지 않음을 확인), 스트립 배치·CTA 노출(D-D08), FR-E02 구체 형태(§7.3). Day1 E2E가 문구를 정확 문자열로 고정한다는 제약(§1.2)을 발견해 Option B 기각의 근거로 삼음. `isTrimShorterThanScene`이 이번 변경으로 고아가 됨을 확인(D-D03). | 김성권 / Claude |
