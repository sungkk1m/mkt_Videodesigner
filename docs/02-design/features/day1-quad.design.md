# Day1 4분할(영상 4개) 템플릿 Design Document

> **Project**: mkt_videodesigner
> **Feature**: `day1-quad`
> **Plan**: [day1-quad.plan.md](../../01-plan/features/day1-quad.plan.md)
> **M0 근거**: [day1-quad.m0-perf-gate.md](../../03-analysis/day1-quad.m0-perf-gate.md)
> **Architecture**: **새 템플릿 arm + 공용 내부 추출** (Plan Q10, 사용자 선택 2026-08-24)
> **Author**: 김성권 / Claude
> **Date**: 2026-08-24
> **Status**: Draft — awaiting Do

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Day1의 2단계 대비("달라졌다")를 4단계("이 속도로 자란다")로 늘린다. 검증된 Day1 파이프라인을 그대로 쓰고 새로 만드는 것은 기하와 구간 수뿐이다. |
| **WHO** | 사내 UA Manager. 3장면·Day1·루핑 사용자와 동일하며 네 경로를 오간다. |
| **RISK** | 완료된 Day1 사이클을 회귀시키는 것. 공통 경로 변경 3건이 기존 단정 16곳을 건드리는 것. 셀이 1/4로 작아져 라벨·프레이밍 기본값이 안 맞는 것. |
| **SUCCESS** | 영상 4개로 3규격 각각 실제 MP4가 나오고, 기존 3템플릿의 렌더 출력이 불변이며, 스키마 버전이 2에 머문다. |
| **SCOPE** | M1 공통 경로 정리(4분할 코드 0줄) → 스키마 arm → 도메인 → 컴포지션 → UI → 렌더·프록시 → 검증. |

---

## 1. Overview

### 1.1 Design Goals

1. **Day1의 렌더 출력 픽셀을 바꾸지 않는다.** Plan Q10이 새 arm을 고른 이유다. Day1이 이번에 겪는 변화는 `Panel` 파일 이동(동작 무변경)과 엔드카드 길이 버그 수정(§4.1)뿐이다.
2. **마이그레이션 코드를 쓰지 않는다.** `sections`는 이미 가변(`[2,8]`)이고, arm 추가와 optional 필드 추가는 기존 문서에 하위 호환이다. `PROJECT_SCHEMA_VERSION`은 **2를 유지**한다.
3. **명령을 복제하지 않는다.** `Day1PanelKey`를 넓혀 기존 Day1 명령 15종이 두 템플릿을 함께 서비스하게 한다 (§5.3).
4. **공통 경로 변경을 4분할보다 먼저, 4분할 코드 0줄로 끝낸다.** 기존 스위트가 그 변경만의 회귀 게이트가 되게 한다 (§4).

### 1.2 Key Insight — 확장점이 이미 함수·데이터로 열려 있다

착수 전 가장 큰 미지수는 "인스펙터와 프록시를 4패널로 다시 만들어야 하나"였다. 코드를 읽어보니 대부분 아니다.

`Day1InspectorProps`는 이미 **패널을 키로 받는 함수와 레코드**로 되어 있다 ([Day1Inspector.tsx:109](../../../src/features/editor/Day1Inspector.tsx:109)):

```ts
panelDurationsMs: Record<Day1PanelKey, number>;
activeTransformOf: (panel: Day1PanelKey) => MediaTransform;
hasRatioOverride: (panel: Day1PanelKey) => boolean;
resolvePanelUrl: (panel: Day1PanelKey) => string | null;
onTrimIn: (panel: Day1PanelKey, ms: number) => void;
```

즉 **`Day1PanelKey`를 넓히고 패널 목록을 데이터로 받으면 인스펙터 본문은 그대로 4개를 그린다.** 하드코딩된 2는 컴포넌트 안의 `PANELS` 리스트 하나뿐이다.

`sourceProxy.ts`의 `planPanelProxy(box, source, transform)`도 박스와 transform만 받으므로 **셀이 4개로 늘어도 무변경**이다. 프록시에서 일반화할 것은 `PANEL_KEYS`와 "키 → 레이아웃 박스" 매핑 두 줄이다 ([panelProxies.ts:88,133](../../../src/features/editor/panelProxies.ts:88)).

`timeline.ts`는 key-visual-looping이 이미 N구간으로 일반화했다. 경계 4개는 **무변경**으로 동작한다.

### 1.3 Confirmed Decisions (Plan §1.3)

Plan에서 확정된 15건은 여기서 뒤집지 않는다. 설계에 직접 영향을 주는 것만 옮긴다.

| # | 결정 | 설계 귀결 |
|---|---|---|
| Q1 | 2×2 그리드 | §5.1 `quadLayout` |
| Q2 | 재생 1개 + 나머지 3개 흑백 정지 | §6.2 `Panel`의 `live` 불리언이 그대로 유효 (D-1) |
| Q3 | 읽기 순서 A→B→C→D | §5.1 셀 배열 순서 |
| Q4 | 기본 `contain` | §5.4 기본값. M0에서 2.13배 비용을 확인했고 **감수 결정** (Plan R11) |
| Q5 | 스타일 4패널 공통 1세트 | §5.2 `split`·`labelStyle`이 payload에 하나 |
| Q6 | 4개 전부 필수 | §5.3 프리플라이트 |
| Q7 | 엔드카드 Day1과 동일 | §5.2 `day1EndCardSchema` 공유 |
| Q8a | 프리셋 15·30초만 | §4.4 (D-4) |
| Q8b | 엔드카드 길이 제약 해제, Day1 포함 | §4.1 (D-3) |
| Q9 | 라벨 기본값 `Day1`~`Day7` | §5.4 |
| Q11 | 선택기 드롭다운 | §4.3 (D-2) |
| Q12 | 파일명 템플릿 세그먼트 | §4.2 |

### 1.4 M0가 설계에 남긴 것

| 발견 | 설계 반영 |
|---|---|
| 패널 개수 2→4 = **1.15배** | 정지 패널 사전 추출 같은 축퇴 설계가 **불필요**하다. Q2 규칙을 그대로 구현한다 |
| 디코드가 여섯 구성 전부 6.0~7.5초 | `Freeze`가 4패널에서도 1프레임 디코드로 동작한다. §6.2가 `Freeze`를 그대로 쓴다 |
| `contain` 블러 배경 = 2.13배 | **이번 사이클 범위 밖** (Plan §2.12). 설계에 반영하지 않는다 |
| 웹 렌더러 4버킷이 벽시계를 설명하지 못함 | §9 성능 검증은 **벽시계** 기준으로 적는다 |

---

## 2. Architecture

### 2.1 Component Diagram

```
app/App.tsx                      어댑터 주입 (무변경)
  └ features/editor/EditorWorkspace.tsx
      ├ TemplateSelector          ◆ 드롭다운으로 전환 (§4.3)
      ├ Day1AssetPanel            ◆ 패널 목록을 템플릿에서 받음
      ├ Day1Inspector             ◆ 패널 목록 + endCardDurationMs
      ├ Timeline                  무변경 (N구간 일반화 완료)
      └ usePanelProxies           ◆ 패널 키 목록 일반화

domain/editor/
  ├ constants.ts                  ◆ TEMPLATE_KINDS, DAY1_QUAD_SECTION_ORDER,
  │                                 DAY1_PANEL_SLOTS, DURATION_PRESETS_BY_TEMPLATE
  ├ schema.ts                     ◆ 공용 조각 추출 + day1QuadSettingsSchema arm
  ├ types.ts                      ◆ Day1QuadProps, Day1PanelSlot, 스냅샷 arm
  └ project.ts                    ◆ Day1PanelKey 확장, buildDay1QuadProps,
                                    switchTemplate arm, 프리플라이트

domain/day1/
  ├ layout.ts                     ◆ quadLayout() 추가 (splitLayout 무변경)
  ├ playback.ts                   ◆ activePanelForQuadSection,
  │                                 day1QuadSectionDurations 추가
  ├ endCard.ts                    무변경 (규격 좌표는 템플릿 무관)
  └ sourceProxy.ts                무변경 (박스·transform만 받는다)

compositions/
  ├ day1/Panel.tsx                ◆ 신규 — SplitFrame에서 추출 (동작 무변경)
  ├ day1/SplitFrame.tsx           ◆ Panel을 import만 (마크업 무변경)
  ├ day1/QuadFrame.tsx            ◆ 신규
  ├ day1/EndCardScene.tsx         무변경
  └ Day1QuadComposition.tsx       ◆ 신규

domain/render/fileName.ts         ◆ 템플릿 세그먼트 (§4.2)
```

◆ = 이번 사이클에서 손대는 파일. **`domain/day1/endCard.ts`·`sourceProxy.ts`와 `EndCardScene.tsx`는 한 줄도 바뀌지 않는다.**

### 2.2 Data Flow — 4분할 렌더

```
EditorProject
  templateSettings: {template:'day1-quad', panelA..D, split, labelStyle, endCard}
  sections: [panel-a, panel-b, panel-c, panel-d, endcard]
       │
       ├─ usePanelProxies.prepare(ratio, fps)
       │     PANEL_KEYS_BY_TEMPLATE로 4키 순회
       │     quadLayout(ratio, lineWidthPx) → 셀 박스
       │     planPanelProxy(박스, 소스크기, transform)   ← 무변경
       │     → 프록시 URL을 아는 resolveUrl
       │
       └─ buildEditorSnapshot(project, resolveUrl)
             buildDay1QuadProps → {template:'day1-quad', props}
                  layout   = quadLayout(selectedRatio, lineWidthPx)
                  panels   = [4 × Day1PanelRenderProps]  (라벨은 로케일 해석)
                  sections = [5 × 활성 슬롯 + 프레임 배분]
                  endCard  = buildEndCardProps(...)       ← 무변경
                       │
                       ├─ Player 미리보기
                       └─ renderEditor → Day1QuadComposition
```

**분기는 정확히 한 곳**이다 — `buildEditorSnapshot`. conventions §3.1이 요구하는 형태다.

### 2.3 왜 배열이 아니라 이름 키인가 (D-0)

`panels: [P,P,P,P]` 배열로 두는 쪽이 자연스러워 보이지만 **이름 키(`panelA`~`panelD`)를 택한다.**

| | 배열 `panels[]` | 이름 키 `panelA..D` (선택) |
|---|---|---|
| Day1 명령 15종 | 인덱스 기반으로 다시 써야 함 | **키 유니언 확장만으로 재사용** |
| 패널 → 구간 인덱스 | 별도 매핑 | `{panelA:0, panelB:1, panelC:2, panelD:3}` 하나가 **두 템플릿 모두 성립** |
| 저장 문서 | Day1과 모양이 달라짐 | Day1과 같은 모양 — 읽는 사람이 하나만 알면 된다 |
| 4 고정 표현 | `.length === 4` 검증 필요 | 타입이 곧 개수 |

Day1의 `Day1PanelKey`가 이미 이 형태이고, 명령을 복제하지 않는 것(Goal 3)이 이 결정에 달려 있다.

---

## 3. 구현 순서 — 왜 M1이 먼저인가

Plan §6의 모듈 순서를 설계 관점에서 다시 정당화한다.

M1의 세 항목(§4.1~4.3)은 **4분할 코드를 한 줄도 쓰지 않고 성립한다.** 먼저 하면:

- 기존 유닛·E2E 스위트가 **그 변경만의** 게이트가 된다.
- 파일명 단정 6곳·선택기 조작 10곳이 깨지는데, 4분할 코드가 아직 없으므로 **원인이 하나로 확정**된다.
- 반대로 나중에 하면 "이 E2E가 깨진 건 드롭다운 때문인가 4분할 때문인가"를 매번 가려야 한다.

M1 이후 순서는 의존 방향을 따른다: 스키마(M2) → 도메인(M3) → 컴포지션(M4) → UI(M5) → 렌더·프록시(M6).

---

## 4. M1 — 공통 경로 (4분할 코드 0줄)

### 4.1 엔드카드 길이 제약 해제 (D-3)

**현재 상태와 문제는 Plan §2.9에 실측으로 정리돼 있다.** 요약: 타임라인 드래그와 렌더 경로는 이미 임의 길이를 지원하는데, 인스펙터 트림 UI와 clamp 두 군데가 상수 `DAY1_END_CARD_MS`(3000)를 슬롯 길이로 가정한다.

**설계 결정 D-3 — 프롭 드릴링, `panelDurationsMs`와 대칭으로.**

| | 셀렉터/스토어 구독 | 프롭 드릴링 (선택) |
|---|---|---|
| 새 메커니즘 | 필요 | **없음** — `panelDurationsMs`가 이미 같은 일을 한다 |
| 대칭성 | 구간 길이를 두 방식으로 읽게 됨 | 구간 길이는 전부 프롭으로 내려온다 |
| 아키텍처 | 인스펙터가 스토어를 알게 됨 | 컴포넌트는 포트를 받는다 (conventions §1) |

```ts
// Day1InspectorProps — panelDurationsMs 바로 아래
/** day1-quad §4.1 — 엔드카드 구간의 실제 길이. 상수 3초가 아니다. */
endCardDurationMs: number;
```

호출 지점(`EditorWorkspace.tsx:1333`)은 `panelDurationsMs`를 만드는 자리에서 같이 만든다.

**clamp 쪽은 배선이 필요 없다.** `setDay1EndCardTrimLengthMs(project, lengthMs)`는 이미 `project`를 받으므로 마지막 구간을 직접 읽는다:

```ts
// project.ts — DAY1_END_CARD_MS 대신
const endCardSectionMs = (project: EditorProject): number =>
  project.sections[project.sections.length - 1]?.durationMs ?? DAY1_END_CARD_MS;
```

**엔드카드는 두 템플릿 모두 마지막 구간**이므로 "마지막"이 규칙이 된다. 다른 템플릿에서는 명령 자체가 no-op이라 닿지 않는다.

`DAY1_END_CARD_MS`는 **초기값 계산에만 남는다** — `day1SectionDurations`와 `day1QuadSectionDurations`.

**검증**: Day1에서 엔드카드 경계를 6초로 드래그한 뒤 트림 슬롯 상한이 6초가 되는지 (SC7). 렌더 출력은 이미 구간 길이를 따르므로 불변이다.

### 4.2 파일명 템플릿 세그먼트

```
{project}_{template}_{locale}_{ratio}_{duration}s_{fps}fps.mp4
```

프로젝트 이름 바로 뒤 — 규격·언어보다 상위 분류이므로 앞쪽이다.

```ts
// domain/render/fileName.ts
export const TEMPLATE_FILE_SEGMENT: Record<TemplateKind, string> = {
  'three-scene': '3scene',
  day1: 'day1',
  'day1-quad': 'day1x4',
  'kv-loop': 'kvloop',
};
```

`EditorRenderConfig`에 `template: TemplateKind`를 추가한다. 두 렌더 경로(`useRenderQueue.drain`의 배치, 단건)가 모두 `config`를 만드므로 두 곳에서 채운다.

**대가 — 기존 단정 6곳을 새 기대값으로 갱신한다** (Plan §2.10에 파일 목록). 의도된 변경이므로 SC6의 예외로 명시한다.

### 4.3 템플릿 선택기 드롭다운 (D-2)

**설계 결정 D-2 — 제어 컴포넌트로 두면 취소 복원 코드가 필요 없다.**

`<select value={current}>`를 `current`에 묶고 `onChange`는 `pending`만 세운다. `current`가 안 바뀌므로 리렌더에서 select가 **자동으로 원래 값으로 돌아온다.** 취소 핸들러는 `setPending(null)` 하나면 되고, 로컬 상태로 값을 되돌리는 로직은 쓰지 않는다.

```tsx
<select
  data-testid="template-selector"
  disabled={disabled}
  onChange={(e) => {
    const next = e.target.value as TemplateKind;
    if (next !== current) setPending(next);   // 프로젝트는 아직 안 바꾼다
  }}
  value={current}                             // ← 취소 시 여기로 되돌아온다
>
  {TEMPLATE_KINDS.map((t) => (
    <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>
  ))}
</select>
```

`TEMPLATE_LABELS`에 `'day1-quad': 'Day1(4 video)'`, `TEMPLATE_LOSS`에 손실 문구를 추가한다. 확인 다이얼로그·`template-switch-confirm`·`template-switch-cancel`은 **구조를 그대로 유지**한다.

**E2E 헬퍼 추출.** `data-testid="template-{kind}"` 버튼을 `.click()` 하는 곳이 10개 파일에 있다. 드롭다운은 `selectOption`으로 조작해야 하므로 전부 대상이다. 같은 모듈에서 헬퍼를 만들어 호출 지점을 한 곳으로 모은다:

```ts
// tests/e2e/helpers/template.ts
export const switchTemplate = async (page: Page, kind: TemplateKind) => {
  await page.getByTestId('template-selector').selectOption(kind);
  await page.getByTestId('template-switch-confirm').click();
};
```

kv-loop 스펙만 예외다 — 확인 전에 `template-switch-ratio-note`를 단정하므로 헬퍼를 쓰지 않거나 옵션을 받는다.

### 4.4 프리셋 제약 (D-4)

**설계 결정 D-4 — 도메인 상수 + 스키마 refine. UI는 그것을 읽는다.**

"이 템플릿이 허용하는 프리셋"을 아는 곳이 **둘**이다: 프리셋 UI 목록과 `switchTemplate`의 강제 변환. 소비자가 둘이므로 도메인에 둔다 (conventions §3).

```ts
// constants.ts
export const DURATION_PRESETS_BY_TEMPLATE: Record<TemplateKind, readonly DurationPreset[]> = {
  'three-scene': DURATION_PRESETS,
  day1: DURATION_PRESETS,
  // Plan Q8a — 4분할은 패널당 길이가 1/4이라 60초를 제공하지 않는다.
  'day1-quad': [15, 30],
  'kv-loop': DURATION_PRESETS,
};
```

**스키마에서도 막는가 — 막는다.** kv-loop이 `selectedRatios`를 9:16으로 refine한 것과 같은 자리·같은 형태다 ([schema.ts:596](../../../src/domain/editor/schema.ts:596)). 그래야 가져온 JSON이 조용히 60초로 렌더되지 않는다.

```ts
// refineDay1Quad
if (!DURATION_PRESETS_BY_TEMPLATE['day1-quad'].includes(project.durationPreset)) {
  context.addIssue({
    code: 'custom',
    path: ['durationPreset'],
    message: 'A day1-quad project runs 15s or 30s only.',
  });
}
```

`switchTemplate(project, 'day1-quad')`가 60 → 30으로 강제 변환하므로 편집기 안에서는 이 오류에 닿지 않는다. 전환 다이얼로그가 그것을 먼저 알린다 (kv-loop의 `template-switch-ratio-note`와 같은 방식, testid `template-switch-preset-note`).

---

## 5. Data Model

### 5.1 기하 — `domain/day1/layout.ts`

`splitLayout`은 **무변경**. `quadLayout`을 같은 모듈에 추가한다.

```ts
export interface QuadLayout {
  /** Plan Q3 읽기 순서: [좌상, 우상, 좌하, 우하]. */
  cells: readonly [PanelRect, PanelRect, PanelRect, PanelRect];
  /** [세로 분할선, 가로 분할선]. */
  lines: readonly [PanelRect, PanelRect];
}

export const quadLayout = (ratio: AspectRatio, lineWidthPx: number): QuadLayout;
```

`splitLayout`과 같은 규칙을 지킨다 — 분할선을 먼저 떼고, 나머지 픽셀은 뒤쪽 셀에 주어 `col0 + line + col1 === width`가 **정확히** 성립하게 한다. 1px 이음선은 렌더 결과에 보인다.

| 규격 | 출력 | col0 / col1 | row0 / row1 | 셀 종횡비 | 출력 종횡비 |
|---|---|---|---|---|---|
| 9:16 | 1080×1920 | 537 / 537 | 957 / 957 | 0.5611 | 0.5625 |
| 1:1 | 1080×1080 | 537 / 537 | 537 / 537 | 1.0000 | 1.0000 |
| 16:9 | 1920×1080 | 957 / 957 | 537 / 537 | 1.7821 | 1.7778 |

(분할선 6px 기준. Plan §2.1에 근거.)

`splitLayout`의 `SPLIT_ORIENTATION`은 규격에 따라 상하/좌우를 갈랐지만 **`quadLayout`은 규격 분기가 없다** — 2×2는 어느 규격에서도 2×2다. 그 결과로 셀 종횡비가 출력 종횡비와 일치한다.

### 5.2 스키마 — 공용 조각 추출 후 arm 추가

**추출은 동작 무변경, 위치만 이동한다.** `day1SettingsSchema` 안에 인라인으로 있는 두 덩어리를 위로 끌어올려 두 arm이 참조한다.

```ts
// 이미 최상위: day1PanelSchema — 그대로

/** day1-quad §5.2 — day1SettingsSchema에서 추출. 값 변경 없음. */
export const day1LabelStyleSchema = z.object({ /* 기존 그대로 */ });
export const day1SplitSchema = z.object({ /* 기존 그대로 */ });
export const day1EndCardSchema = z.object({ /* 기존 그대로, .default() 포함 */ });

export const day1SettingsSchema = z.object({
  template: z.literal('day1'),
  panelA: day1PanelSchema,
  panelB: day1PanelSchema,
  split: day1SplitSchema,
  labelStyle: day1LabelStyleSchema,
  endCard: day1EndCardSchema,
});

export const day1QuadSettingsSchema = z.object({
  template: z.literal('day1-quad'),
  panelA: day1PanelSchema,
  panelB: day1PanelSchema,
  panelC: day1PanelSchema,
  panelD: day1PanelSchema,
  split: day1SplitSchema,
  labelStyle: day1LabelStyleSchema,
  endCard: day1EndCardSchema,
});
```

> **추출의 위험은 `.default()`다.** `day1EndCardSchema`의 `mode`·`video`·`videoTrim`·`videoAudioEnabled`·`videoAudioVolume`은 `.default()`가 **곧 마이그레이션 전략**이다 (Endcard-Video §3.1). 추출하면서 하나라도 떨어지면 저장된 Day1 문서가 파싱에 실패한다. `schema.test.ts`의 왕복 테스트가 게이트다.

`templateSettingsSchema` 유니온에 arm을 넣고, 구간 ID 함수에 arm을 넣는다.

```ts
// constants.ts
export const DAY1_QUAD_SECTION_ORDER =
  ['panel-a', 'panel-b', 'panel-c', 'panel-d', 'endcard'] as const;   // 5 ≤ MAX_SECTION_COUNT(8)

// schema.ts expectedSectionIds — arm 하나
: settings.template === 'day1-quad' ? DAY1_QUAD_SECTION_ORDER
```

### 5.3 카피 — 라벨 c/d

```ts
day1Labels: z.object({
  a: copyTextSchema,
  b: copyTextSchema,
  /** day1-quad — optional이므로 저장된 Day1 문서가 손대지 않아도 파싱된다. */
  c: copyTextSchema.optional(),
  d: copyTextSchema.optional(),
}).optional(),
```

`setDay1LabelText`의 슬롯 타입을 `ActivePanel`(`'a'|'b'`)에서 넓힌다:

```ts
// constants.ts
export const DAY1_PANEL_SLOTS = ['a', 'b', 'c', 'd'] as const;
export type Day1PanelSlot = (typeof DAY1_PANEL_SLOTS)[number];
```

`ActivePanel`(`'a'|'b'`)은 **그대로 둔다** — `SplitFrame`이 `'c'`를 받으면 안 된다. `Day1PanelSlot`은 quad 쪽과 카피 명령이 쓴다.

### 5.4 기본값

```ts
export const DEFAULT_DAY1_QUAD_SETTINGS: Day1QuadSettings = {
  template: 'day1-quad',
  panelA: /* DEFAULT_DAY1_PANEL_TRANSFORM 기반, Day1과 동일 */,
  panelB: ..., panelC: ..., panelD: ...,
  split: {lineColor: '#9ca3af', lineWidthPx: 6},       // Day1과 동일
  labelStyle: {
    // Plan §2.4 — 셀 폭이 1080 → 537로 반이 되므로 72px는 셀을 넘는다.
    fontSize: 44,
    textColor: '#ffffff', outlineColor: '#000000',
    outlineWidthPx: 8, position: 'top',
  },
  endCard: /* DEFAULT_DAY1_SETTINGS.endCard와 동일 */,
};
```

**패널 `fit`은 `contain` 유지** (Q4). `DEFAULT_DAY1_PANEL_TRANSFORM`을 그대로 재사용하므로 새 상수가 없다.

**라벨 기본값 (Q9)** 은 payload가 아니라 카피에 들어간다. `switchTemplate`이 `day1-quad`로 들어갈 때 4언어 전부에 같은 영문을 채운다:

```ts
const DAY1_QUAD_DEFAULT_LABELS = {a: 'Day1', b: 'Day2', c: 'Day3', d: 'Day7'} as const;
```

Day1(2분할)의 라벨 기본값은 **빈 문자열 그대로** 둔다 — Q10의 무변경 원칙.

### 5.5 명령 — 키 유니언 확장

```ts
export type Day1PanelKey = 'panelA' | 'panelB' | 'panelC' | 'panelD';

/** 패널 → 구간 인덱스. 두 템플릿 모두 이 매핑 하나로 성립한다. */
const DAY1_PANEL_SECTION: Record<Day1PanelKey, number> =
  {panelA: 0, panelB: 1, panelC: 2, panelD: 3};

/** day1 또는 day1-quad payload. 그 외에는 null. */
const day1PanelsOf = (project: EditorProject): Day1Settings | Day1QuadSettings | null;

/**
 * 템플릿이 가진 패널 키 목록. UI·프록시·프리플라이트가 공유한다.
 *
 * 함수인 이유: 호출자는 `TemplateKind` 전체를 들고 있으므로, `'day1'|'day1-quad'`만
 * 키로 갖는 레코드로 두면 호출 지점마다 좁히기가 필요해진다. 남의 템플릿에는 빈
 * 배열을 주어 "패널이 없다"가 자연스럽게 표현되게 한다.
 */
const DAY1_PANEL_KEYS = ['panelA', 'panelB'] as const;
const DAY1_QUAD_PANEL_KEYS = ['panelA', 'panelB', 'panelC', 'panelD'] as const;

export const panelKeysOf = (
  settings: TemplateSettings,
): readonly Day1PanelKey[] =>
  settings.template === 'day1'
    ? DAY1_PANEL_KEYS
    : settings.template === 'day1-quad'
      ? DAY1_QUAD_PANEL_KEYS
      : [];

/** 패널 키 → 셀 인덱스. `DAY1_PANEL_SECTION`과 같은 값이지만 용도가 다르다. */
const PANEL_INDEX: Record<Day1PanelKey, 0 | 1 | 2 | 3> =
  {panelA: 0, panelB: 1, panelC: 2, panelD: 3};
```

`mapDay1Panel`은 요청된 키가 payload에 없으면 **no-op**한다 — `day1`에 `panelC`를 쓰는 호출은 프로젝트를 그대로 돌려준다. "다른 템플릿의 명령은 no-op" 규약(conventions §3.1)의 자연스러운 확장이다.

이 확장으로 **재사용되는 명령 15종**: `setDay1PanelSource` · `relinkDay1PanelSource` · `setDay1PanelSourceStatus` · `setDay1TrimInMs` · `setDay1TrimOutMs` · `updateDay1Transform` · `resetDay1Transform` · `setDay1RatioOverride` · `updateDay1Split` · `updateDay1LabelStyle` · `setDay1LabelText` · `updateDay1EndCard` · `setDay1EndCardVideo` · `setDay1EndCardTrimInMs` · `setDay1EndCardTrimLengthMs`.

**프리플라이트** (Q6): `day1MissingPanels`·`day1PanelsShorterThanSection`의 하드코딩된 `['panelA','panelB']`를 `panelKeysOf(project.templateSettings)`로 바꾼다. 4개 전부 필수라는 규칙은 목록이 4개가 되면서 자동으로 성립하고, 남의 템플릿은 빈 배열이라 기존처럼 `[]`를 돌려준다.

### 5.6 렌더 프롭 타입

`Day1SectionRenderProps`를 슬롯에 대해 제네릭하게 만든다 — 소비자가 **오늘 둘**이다.

```ts
export interface Day1SectionRenderProps<TPanel = ActivePanel> {
  id: string;
  fromFrame: number;
  durationInFrames: number;
  /** null on the end card. */
  activePanel: TPanel | null;
}

export type Day1QuadProps = {
  layout: QuadLayout;
  lineColor: string;
  panels: readonly [
    Day1PanelRenderProps, Day1PanelRenderProps,
    Day1PanelRenderProps, Day1PanelRenderProps,
  ];
  labelStyle: Day1LabelStyle;
  endCard: Day1EndCardRenderProps;
  sections: Day1SectionRenderProps<Day1PanelSlot>[];
  audio: AudioRenderProps;
};

export type EditorSnapshot =
  | {template: 'three-scene'; props: ThreeSceneProps}
  | {template: 'day1'; props: Day1Props}
  | {template: 'day1-quad'; props: Day1QuadProps}      // ◆
  | {template: 'kv-loop'; props: KvLoopProps};
```

기본 타입 인자 덕에 `Day1Props`는 **선언이 안 바뀐다.**

---

## 6. Compositions

### 6.1 재생·구간 — `domain/day1/playback.ts`

```ts
/** 0..3 → 슬롯, 4(엔드카드) → null. */
export const activePanelForQuadSection = (index: number): Day1PanelSlot | null =>
  index >= 0 && index < 4 ? (DAY1_PANEL_SLOTS[index] as Day1PanelSlot) : null;

/** 엔드카드가 초기값 3초를 먼저 떼고 남은 시간을 4등분. 나머지는 마지막 패널. */
export const day1QuadSectionDurations = (preset: DurationPreset): SceneDurationsMs;
```

| 프리셋 | 패널당 | 엔드카드 | `MIN_SCENE_MS`(1000) |
|---|---:|---:|---|
| 15초 | 3,000ms | 3,000ms | 통과 |
| 30초 | 6,750ms | 3,000ms | 통과 |

### 6.2 `Panel` 추출 (D-1)

**설계 결정 D-1 — `live: boolean`을 그대로 유지한다.**

Q2가 상태를 둘로 확정했다(재생 / 흑백 정지). `state: 'live' | 'idle'` 유니온은 오늘 표현력을 더하지 않고, Q2가 기각한 "누적 점등"이 나중에 오면 그때 세 번째 상태와 함께 바꾼다. conventions §2 — 요청되지 않은 유연성은 넣지 않는다.

**추출은 순수 이동이다.** `SplitFrame.tsx`에서 `compositions/day1/Panel.tsx`로 옮기는 것:

- `Panel` 컴포넌트
- `PanelLabel` 컴포넌트
- `JUSTIFY` 맵
- `BACKDROP_BLUR_RATIO` = 0.05, `BACKDROP_OVERSCAN` = 1.2

이들은 `Panel`만 쓰므로 함께 이동한다. `SplitFrame`은 `import {Panel} from './Panel'` 한 줄이 늘고 마크업은 한 글자도 바뀌지 않는다.

> M0 스파이크가 이 추출의 예행연습이었다. 복사본을 원본과 대조하는 스크립트(`artifacts/m0/verify-panel-copy.mjs`)가 `Panel` 1,409자·`PanelLabel` 529자 일치를 확인했으므로, 옮길 범위는 이미 확정돼 있다.

**추출의 회귀 게이트**는 Day1의 기존 E2E다 — 흑백(SC2)과 분할선 픽셀 색(SC4)을 렌더 결과에서 검사하는 스펙이 이미 있다.

### 6.3 `QuadFrame.tsx`

```tsx
export const QuadFrame = ({active, audio, labelStyle, layout, lineColor, panels, sectionFromFrame}) => {
  // 나레이션 프레임은 절대값, 패널 볼륨 콜백은 구간 기준 — SplitFrame과 같은 보정.
  const liveVolume = /* duckedVolumeAt(...) — SplitFrame과 동일 */;

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {panels.map((panel, index) => (
        <Panel
          key={index}
          labelStyle={labelStyle}
          live={active === DAY1_PANEL_SLOTS[index]}
          liveVolume={liveVolume}
          panel={panel}
          rect={layout.cells[index]}
        />
      ))}
      {/* 십자 분할선 2개. Plan SC4는 지정한 hex가 그대로 렌더되는지 픽셀로 본다. */}
      {layout.lines.map((line, index) => (
        <div data-testid={`day1-quad-split-line-${index}`} key={index} style={{ /* 단색 채움 */ }} />
      ))}
    </AbsoluteFill>
  );
};
```

`SplitFrame`의 `data-testid="day1-split-line"`은 **그대로 둔다**(기존 E2E가 쓴다). 4분할은 인덱스가 붙은 새 testid를 쓴다.

### 6.4 `Day1QuadComposition.tsx`

`Day1Composition`과 같은 골격 — 구간을 `Sequence`로 감싸고 활성 슬롯이 있으면 `QuadFrame`, 없으면 `EndCardScene`.

```tsx
if (panels.some((p) => p.url === null)) {
  return <Placeholder message="영상 4개를 모두 업로드하세요" />;   // FR-Q02
}
```

`EndCardScene`은 `durationInFrames`를 받아 영상을 루프로 채우므로 **무변경으로 5번째 구간을 처리한다** (§4.1이 확인한 사실).

---

## 7. UI

### 7.1 `EditorWorkspace` 분기

```ts
const day1 = day1Of(project);            // 기존
const day1Quad = day1QuadOf(project);    // ◆ 신규
const panels = day1 ?? day1Quad;         // 인스펙터·애셋 패널이 공유
```

인스펙터 분기는 `kvLoop ? … : panels ? <Day1Inspector … /> : <SceneInspector … />`가 된다. **`Day1Inspector`를 4분할용으로 복제하지 않는다** — §1.2가 확인한 대로 props가 이미 패널 키 기반이다.

새로 내려보내는 것은 둘:

```tsx
panelKeys={panelKeysOf(project.templateSettings)}
endCardDurationMs={project.sections[project.sections.length - 1]?.durationMs ?? 0}
```

`Day1Inspector`·`Day1AssetPanel` 안의 하드코딩된 `PANELS` 리스트를 `panelKeys` prop으로 바꾼다. 라벨 문구(`패널 A · 먼저 재생` 등)는 4개로 늘린다.

### 7.2 라벨·프리셋

- 카피 탭의 패널 라벨 입력은 `panelKeys`를 따라 2 또는 4개. 4언어 × 4패널 = 16칸.
- 길이 프리셋 목록은 `DURATION_PRESETS_BY_TEMPLATE[template]`을 읽는다 (§4.4).
- 전환 다이얼로그에 60초 → 30초 강제 변환 안내 (`template-switch-preset-note`).

### 7.3 인스펙터 세로 길이

패널 섹션이 4개가 되어 스크롤이 길어진다. 기존 `InspectorSection`의 접기를 재사용하고, **새 UI를 만들지 않는다.** day1-video 사이클이 인스펙터 폭을 `clamp(320px, 100vw - 950px, 440px)`로 넓혀 뒀으므로 폭은 문제가 아니다.

### 7.4 프록시

```ts
// panelProxies.ts — 바뀌는 것은 키 목록과 "키 → 박스" 두 군데다.
const keys = panelKeysOf(project.templateSettings);      // 하드코딩 2개 → 템플릿에서

const boxOf = (key: Day1PanelKey): PanelRect => {
  if (project.templateSettings.template === 'day1-quad') {
    return quadLayout(ratio, lineWidthPx).cells[PANEL_INDEX[key]];
  }
  const split = splitLayout(ratio, lineWidthPx);         // 기존 경로 그대로
  return key === 'panelA' ? split.a : split.b;
};
```

`planPanelProxy`는 **무변경**. 슬롯 상한이 4패널 × 3규격 = 12, 측정된 4.3MB/슬롯 기준 약 52MB — Q14에 따라 유지하고 M0 이후 재검토한다.

---

## 8. Error Handling

새 `AppErrorCode`를 만들지 않는다. 4분할이 내는 사용자 메시지는 기존 경로를 그대로 쓴다.

| 상황 | 처리 |
|---|---|
| 영상 4개 중 일부 없음 | `day1MissingPanels` → 기존 프리플라이트 차단 문구, 패널 이름만 4개로 |
| 소스가 구간보다 짧음 | `day1PanelsShorterThanSection` → 기존 경고 |
| 가져온 JSON이 60초 day1-quad | 스키마 오류 `A day1-quad project runs 15s or 30s only.` (§4.4) |
| 스포이트 미지원 | Day1과 동일하게 컬러 피커로 축퇴 (기존 동작) |

---

## 9. Test Plan

### 9.1 Unit

| 대상 | 검사 |
|---|---|
| `quadLayout` | 3규격 × 분할선 0~24px 전수: `col0+line+col1===width`, `row0+line+row1===height` (SC2). 셀 종횡비가 출력 종횡비와 오차 ≤0.3% |
| `day1QuadSectionDurations` | 프리셋 2종 합이 `preset*1000`, 각 구간 ≥ `MIN_SCENE_MS` |
| `activePanelForQuadSection` | 0..3 → 슬롯, 4 → null |
| 스키마 arm | `day1-quad` 파싱, 5구간 ID·순서, 60초 거부 |
| **공용 조각 추출 회귀** | 저장된 Day1 문서 왕복 — `.default()`가 하나도 빠지지 않았는지 (§5.2의 위험) |
| `Day1PanelKey` 확장 | `day1`에 `panelC` 명령 → no-op |
| `switchTemplate` | 60초 프로젝트 → 30초 강제 변환, 라벨 4언어 기본값 주입 |
| 프리플라이트 | 4패널 중 일부 누락 감지 |
| `buildDay1QuadProps` | 프롭 스냅샷, 프레임 배분 합 |
| `buildOutputFileName` | 템플릿 세그먼트 4종 |
| `endCardSectionMs` | 마지막 구간을 읽는지, 다른 템플릿에서 no-op인지 |

### 9.2 E2E

| 스펙 | 검사 |
|---|---|
| `day1-quad.spec.ts` (신규) | 전환 → 영상 4개 업로드 → 라벨 → 프리뷰 → **실제 MP4 1개**(SC1). 십자 분할선 픽셀 색(SC4), 비활성 셀 채도 ≈ 0(SC3) |
| `day1-quad.spec.ts` | 60초 프로젝트에서 전환 시 안내 노출 + 30초로 바뀜 |
| 기존 Day1 3종 | `Panel` 추출 회귀 게이트 — 흑백·분할선·엔드카드 |
| `day1-endcard-*` | 엔드카드를 6초로 드래그 후 트림 슬롯 상한 6초 (SC7) |
| 파일명 단정 6곳 | 새 기대값으로 갱신 |
| 선택기 조작 10개 파일 | `switchTemplate` 헬퍼로 교체 |

**성능 검증은 벽시계 기준으로 적는다** — M0 §2가 확인한 대로 웹 렌더러 4버킷은 비용 귀속에 쓸 수 없다.

---

## 10. Architecture Compliance

| 규칙 | 준수 |
|---|---|
| `domain`이 React·Remotion·Zustand를 임포트하지 않음 | `quadLayout`·`playback`·`buildDay1QuadProps` 전부 순수 |
| `compositions`가 스토어를 임포트하지 않음 | `QuadFrame`은 프롭만 받음 |
| feature가 다른 feature 내부를 참조하지 않음 | 변경 없음 |
| 템플릿 추가 = arm 둘 | `templateSettings` + `buildEditorSnapshot` |
| 포트를 주입받음 | `frameSampler`는 기존처럼 프롭 |
| 스키마가 런타임 진실 | 프리셋 제약도 스키마에 (§4.4) |

`src/test/architecture.test.ts`의 규칙 표는 **바뀌지 않는다** — 새 레이어도, 의도적 예외도 없다.

---

## 11. Out of Scope (별도 사이클)

| 항목 | 근거 |
|---|---|
| **블러 배경 굽기** | Plan §2.12 · M0 §5. 렌더 시간 0.48배 회수. 픽셀 동일성 검증이 따로 필요해 `day1-render-speed`처럼 독립 사이클 |
| RTL 로케일용 그리드 좌우 반전 | 현재 4언어에 RTL이 없다 (Q3) |
| 엔드카드 길이 숫자 입력 | Q8b는 상수 제약 해제까지 |
| 3·5·6분할, 가변 분할 개수 | 2×2 고정 포맷 |
| 패널별 분할선·라벨 스타일 | Q5 — 공통 1세트 |

---

## 12. Implementation Order

| # | 모듈 | 산출물 | 게이트 |
|---|---|---|---|
| M1 | 공통 경로 (§4) | 엔드카드 길이 · 파일명 세그먼트 · 드롭다운 + E2E 헬퍼 | **기존 스위트 전량.** 단정 6곳·조작 10곳 갱신. SC7 |
| M2 | 스키마·상수 (§5.2~5.4) | 공용 조각 추출, arm, 구간 ID, 라벨 c/d, 기본값, 프리셋 상수 | 유닛. **저장 문서 왕복이 최우선** |
| M3 | 도메인 (§5.1, §5.5, §6.1) | `quadLayout`, 재생·구간, 키 확장, `switchTemplate`, 프리플라이트 | 유닛. 기하 전수 |
| M4 | 컴포지션 (§6.2~6.4) | `Panel` 추출 → `QuadFrame` → `Day1QuadComposition` → 프롭 빌더 + 스냅샷 arm | 유닛 + **기존 Day1 E2E가 추출 게이트** |
| M5 | UI (§7.1~7.3) | 애셋 4슬롯, 인스펙터 `panelKeys`, 라벨 16칸, 프리셋 목록 | E2E 신규 |
| M6 | 렌더·프록시 (§7.4) | 프록시 일반화, 프리플라이트 연결, Batch | E2E 실제 MP4 |
| M7 | 검증·리포트 | SC1~SC8, 분석·리포트 | 전체 |

### 12.1 Do Entry Checklist

- [ ] M1을 4분할 코드 0줄로 유지했는가 (§3)
- [ ] `.default()`가 추출에서 하나도 빠지지 않았는가 (§5.2)
- [ ] `SplitFrame`의 마크업이 한 글자도 안 바뀌었는가 (§6.2)
- [ ] `data-testid="day1-split-line"`이 살아 있는가
- [ ] `PROJECT_SCHEMA_VERSION`이 2인가
- [ ] `sourceProxy.ts`·`endCard.ts`·`EndCardScene.tsx`가 무변경인가

---

## 13. Requirement Traceability

| Plan FR | 설계 위치 |
|---|---|
| FR-Q01 전환 시 5구간·4패널 기본값 | §5.4, §5.5 `switchTemplate` |
| FR-Q02 4개 필수, 없으면 차단 | §5.5 프리플라이트, §6.4 Placeholder |
| FR-Q03 3규격 2×2, 합이 출력과 일치 | §5.1, SC2 |
| FR-Q04 재생 1개, 나머지 정지 | §6.1, §6.2 |
| FR-Q05 흑백이 MP4에 반영 | §6.2 (`Panel`의 CSS 필터), SC3 |
| FR-Q06 경계 4개 드래그, 총 길이 불변 | `timeline.ts` 무변경 |
| FR-Q07 십자 분할선 색·두께·스포이트 | §6.3, Day1 컨트롤 재사용 |
| FR-Q08 라벨 4개 × 4언어 | §5.3, §7.2 |
| FR-Q09 패널별 Scale/X/Y + 규격 override | §5.5 재사용 명령 |
| FR-Q10 엔드카드 Day1과 동일 | §5.2 공유 스키마, §6.4 |
| FR-Q11 렌더·Batch·저장·JSON 재사용 | §2.2 |
| FR-Q12 crop 프록시 4패널 | §7.4 |
| FR-Q13 기존 문서 마이그레이션 없이 열림 | §5.2, §5.3 optional |
| FR-Q14 프리셋 15·30, 전환 안내 | §4.4, §7.2 |
| FR-Q15 엔드카드 실제 길이 슬롯 | §4.1 |
| FR-Q16 파일명 템플릿 구분 | §4.2 |
| FR-Q17 드롭다운 선택기 | §4.3 |
| FR-Q18 라벨 기본값 | §5.4 |

---

## Version History

| 날짜 | 변경 |
|---|---|
| 2026-08-24 | 초안. Plan 결정 15건과 M0 실측을 반영. 설계 결정 D-0~D-4 확정 |
