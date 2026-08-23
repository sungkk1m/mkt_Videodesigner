# Key Visual Motion Effects Design Document

> **Project**: mkt_videodesigner
> **Feature**: kv-motion-effects
> **Plan**: [kv-motion-effects.plan.md](../../01-plan/features/kv-motion-effects.plan.md)
> **Author**: 김성권 / Claude
> **Date**: 2026-08-23
> **Status**: Draft — awaiting Do

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 루핑의 모션이 "중앙 기준 줌 인" 하나뿐이고 폭이 4%(강도 50%)라 레퍼런스의 카메라 워크를 재현하지 못한다. 소재 교체로 반복 생산하는 이점은 확보됐으므로 다음 병목은 "무엇을 어떻게 보여주는가"다. |
| **WHO** | 사내 UA Manager와 마케터. 루핑 템플릿을 이미 쓰는 사용자. |
| **RISK** | 스케일을 넓히면 매 프레임 리샘플 비용이 오른다(측정으로 방어). 미리보기와 MP4의 불일치. `kenBurns` 불리언을 대체하면서 저장된 프로젝트가 다르게 열릴 위험. |
| **SUCCESS** | KV 3장에 서로 다른 프리셋을 걸어 렌더한 MP4에서 각 홀드가 지정한 방향·폭으로 움직이고, 드래그로 지정한 끝 영역이 홀드 마지막 프레임과 일치하며, 기존 저장 프로젝트가 같은 종류의 모션으로 열린다(§2.3 — 폭은 D-01만큼 커진다). |
| **SCOPE** | 스키마·도메인(순수 수식) → 컴포지션 → 인스펙터 프리셋 → 드래그 오버레이 → 성능 게이트. |

---

## 1. Overview

### 1.1 Design Goals

1. 모션을 "프리셋 하나 고르기"로 끝낼 수 있게 하되, 정확히 잡고 싶을 때 영역을 직접 지정할 수 있게 한다.
2. 저장된 프로젝트가 같은 종류의 모션으로 열린다 (§2.3 — 폭은 D-01만큼 커진다).
3. 미리보기와 렌더가 같은 수식을 쓴다.
4. 순수 수식은 도메인에 두고 브라우저 없이 검증한다.

### 1.2 Key Insight — 카메라 사각형은 이미 존재한다

새 렌더링 개념이 필요하지 않다. `KvScene`이 지금 그리는 방식은

```tsx
transform: `translate(${x}%, ${y}%) scale(${scale * kenBurnsScale})`
```

이고, 이 `(scale, x, y)` 세 값이 곧 **"이미지의 어느 영역을 보고 있는가"** 다. 즉 프레이밍 컨트롤은 이미 정적인 카메라 위치이고, Ken Burns는 그 `scale` 하나만 시간에 따라 늘리는 특수한 경우다.

그래서 이 사이클은 **두 개의 카메라 사각형 사이를 보간**하는 것으로 전부 표현된다. 고전적 Ken Burns의 정의가 정확히 그것이고, 현재의 줌 인은 "전체 화면 → 중앙 축소 사각형"이라는 한 사례가 된다. 프리셋도 드래그 지정도 같은 두 사각형으로 내려오므로, 컴포지션에는 분기가 하나도 늘지 않는다.

### 1.3 Confirmed Decisions

Plan §1.3의 6건, 2026-08-23 사용자 승인.

| # | 결정 | 값 |
|---|---|---|
| D-01 | 스케일 상한 | **넓힌다.** 강도 슬라이더 1.0 → 1.20 (기존 1.08). 성능 게이트로 방어 |
| D-02 | 프리셋 | **정지 · 줌 인 · 줌 아웃 · 팬 4방향**. 회전·기울기는 제외(레퍼런스 6본에 사용례 없음) |
| D-03 | 이징 | **프리셋마다 고정.** 사용자에게 조작 항목으로 노출하지 않는다 |
| D-04 | 스코프 | **루프 전체 기본값 + KV별 덮어쓰기** |
| D-05 | 드래그 | **시작·끝 사각형 둘 다** |
| D-06 | 범위 | **모션만.** 컬러 그레이딩·블러·와이프는 별도 사이클 |

#### D-01의 두 숫자 — Plan에서 의도적으로 벗어나는 지점

Plan은 상한을 하나의 숫자로 다뤘지만, 구현하면 두 개가 필요하다.

| 상수 | 값 | 무엇인가 |
|---|---|---|
| `KV_MOTION_MAX_PRESET_SCALE` | 1.20 | 강도 슬라이더 1.0이 도달하는 배율. D-01이 정한 값 |
| `KV_MOTION_MAX_SCALE` | 3.0 | 사각형이 가질 수 있는 최대 배율(최소 크기 1/3). 프리셋·드래그 공통의 하드 바운드 |

하나로 두면 D-05가 죽는다. 상한이 1.20이면 드래그로 지정할 수 있는 가장 좁은 영역이 화면의 83%이고, "캐릭터 얼굴에서 시작해 전체로 빠지기"가 불가능하다. 반대로 강도 1.0을 3.0에 매핑하면 프리셋 기본값이 과격해진다.

이것은 Plan §1.3이 기각한 (c)("드래그 지정 시에만 상한 **해제**")가 아니다. 해제가 아니라 **모든 경로에 적용되는 하나의 하드 바운드**이고, 강도 슬라이더는 그 안의 편안한 구간에 매핑된다. 3.0은 성능 게이트(§8.3)의 측정 대상이며, 측정 결과에 따라 좁힌다.

---

## 2. Architecture

### 2.1 Component Diagram

```text
domain/kvloop/motion.ts            (신규, 순수)
  ├─ KvRect                        카메라 사각형 {x, y, size}
  ├─ resolveKvMotion()             모션 + 강도 → {from, to, easing}
  └─ rectToTransform()             사각형 → {scale, xPercent, yPercent}
        │
        ├──────────────────────────────────────────┐
        ▼                                          ▼
domain/editor/project.ts                    features/editor/
  buildKvLoopProps()                          KvLoopInspector   프리셋 · 강도
    slots[i].motion = 해석된 키프레임          KvMotionOverlay   드래그 사각형 (신규)
        │
        ▼
compositions/kvloop/KvScene.tsx
  두 키프레임 사이를 이징으로 보간 → 하나의 transform
```

`domain`은 Remotion을 import할 수 없다(conventions §1). 그래서 도메인은 이징을 **이름**으로 돌려주고, `KvScene`이 그 이름을 Remotion의 `Easing`에 매핑한다. 수식은 브라우저 없이 검증되고, 곡선 적용은 렌더러가 한다.

### 2.2 Data Flow

```text
프리셋 선택 ─┐
             ├─→ slots[i].motion (또는 null = 루프 기본값 상속)
드래그 지정 ─┘         │
                       ▼
        resolveKvMotion(motion, intensity)
                       │  {from: KvRect, to: KvRect, easing: 'linear' | ...}
                       ▼
             buildKvLoopProps → KvSlotRenderProps.motion
                       │
                       ▼          같은 스냅샷을 Player와 렌더가 소비
              KvScene: progress = easing(frame / (hold - 1))
                       rect = lerp(from, to, progress)
                       {scale, xPercent, yPercent} = rectToTransform(rect)
                       transform: translate(...) scale(base.scale * scale)
```

### 2.3 카메라 사각형의 수식

`KvRect = {x, y, size}`, 모두 프레임 좌표 0~1.

- `size` — 카메라가 덮는 프레임의 비율. 1이면 화면 전체
- `x`, `y` — 그 사각형의 좌상단. 범위 `[0, 1 - size]`
- 종횡비는 **구조적으로 고정**된다. `size`가 가로·세로에 같이 적용되므로 사각형은 항상 프레임과 같은 9:16이다 → FR-M04는 별도 검증 없이 성립한다

사각형 R을 화면에 꽉 채우려면:

```text
s   = 1 / R.size
cx  = R.x + R.size / 2          (사각형 중심)
tx% = -s * (cx - 0.5) * 100
ty% = -s * (cy - 0.5) * 100
```

`translate(%)`는 변환 전 박스 크기 기준이고 `<Img>`는 프레임을 100% 채우므로, 1 프레임 단위 = 100%다. 검산:

| R | s | tx% | 결과 |
|---|---|---|---|
| `{0, 0, 1}` | 1 | 0 | 그대로 (현재 동작) |
| `{0.25, 0.25, 0.5}` | 2 | 0 | 중앙 2배 줌 (현재 Ken Burns의 끝 상태) |
| `{0, 0, 0.5}` | 2 | +50 | 좌상단 사분면이 화면을 채움 |

첫 두 줄이 중요하다. 프리셋 `zoomIn`은 현재 코드와 **같은 식**을 계산한다 — 전체 화면에서 중앙 축소 사각형으로.

**다만 결과 픽셀은 같지 않고, 이 점을 여기 명시한다.** D-01이 상한을 1.08에서 1.20으로 넓혔으므로 실사용 강도 50%에서 기존 프로젝트의 줌은 1.04에서 1.10으로 커진다. 부작용이 아니라 D-01이 요청한 변화 자체다.

따라서 Plan §3.1 FR-M07과 §4.1 SC3의 "이전과 동일한 결과"는 **D-01 결정 이전에 쓰인 문구이고 그대로 성립할 수 없다.** 이 설계가 지키는 범위를 다음으로 좁히고, Plan의 해당 문구를 이 절이 대체한다.

| 지킨다 | 지키지 않는다 |
|---|---|
| 모션의 **종류** — `kenBurns: true`는 줌 인, `false`는 정지 | 이동 **폭**. 상한이 넓어진 만큼 커진다 |
| 슬롯별 선택이 슬롯별로 남는다 | |
| 3장면·Day1 프로젝트는 아무 영향 없음 | |

예전 폭이 필요하면 강도를 낮추면 된다(1.08 상당 ≈ 강도 0.4). 상한을 두 개 남겨 "예전 프로젝트는 예전 폭"으로 가는 대안은 같은 프로젝트가 언제 만들어졌는지에 따라 다르게 렌더되는 상태를 만들므로 택하지 않는다.

### 2.4 정적 프레이밍과의 합성

`slot.transform`(fit/scale/x/y)은 그대로 정적 프레이밍으로 남고, 모션은 그 위에 곱해진다.

```text
최종 scale     = transform.scale * motionScale
최종 translate = transform.x + motionTx , transform.y + motionTy
```

드래그는 미리보기 위에서 하고 미리보기는 이미 프레이밍이 적용된 화면이므로, 사용자가 그린 사각형은 "보고 있는 것에 대한 상대 위치"가 되어 직관과 일치한다. `motionScale = 1, motionTx = 0`인 정지 프리셋에서는 오늘과 완전히 동일한 식으로 축약된다.

---

## 3. Data Model

### 3.1 스키마 변경

```ts
export const kvRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().min(1 / KV_MOTION_MAX_SCALE).max(1),
});

export const KV_MOTION_PRESETS = [
  'still', 'zoomIn', 'zoomOut',
  'panLeftToRight', 'panRightToLeft', 'panTopToBottom', 'panBottomToTop',
] as const;

export const kvMotionSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('preset'), preset: z.enum(KV_MOTION_PRESETS)}),
  z.object({kind: z.literal('custom'), from: kvRectSchema, to: kvRectSchema}),
]);
```

슬롯과 루프 설정:

| 위치 | 필드 | 의미 |
|---|---|---|
| `kvSlotSchema` | `motion: KvMotion \| null` | `null`이면 루프 기본값을 상속 (D-04) |
| `kvLoopSettingsSchema` | `motion: KvMotion` | 루프 기본값. 신규 프로젝트는 `{kind:'preset', preset:'zoomIn'}` |
| `kvLoopSettingsSchema` | `kenBurnsIntensity` | **이름 유지.** 저장 필드명 변경은 마이그레이션을 부르고 얻는 것이 없다. UI 라벨만 "모션 강도" |

### 3.2 Migration — `kenBurns` 불리언 흡수

저장된 v2 문서의 슬롯은 `kenBurns: boolean`을 갖고 `motion`이 없다. `.default()`는 **형제 필드에 의존하는 기본값을 표현할 수 없으므로**(엔드카드 비디오가 쓴 방식이 여기서는 통하지 않는다) `kvSlotSchema`에 `z.preprocess`를 둔다.

```ts
kvSlotSchema = z.preprocess((input) => {
  if (!isRecord(input) || input.motion !== undefined) return input;
  // Pre-motion documents carry only the boolean.
  return {...input, motion: input.kenBurns === false ? STILL : ZOOM_IN};
}, z.object({transform: mediaTransformSchema, motion: kvMotionSchema.nullable()}));
```

- `kenBurns: true` → `zoomIn` — 같은 식이지만 폭은 새 상한을 따른다 (§2.3)
- `kenBurns: false` → `still`
- `kenBurns`는 출력 타입에서 사라진다. 단일 진실 원천을 둘로 쪼개지 않기 위한 선택이고, 두 필드가 어긋나는 상태를 애초에 만들지 않는다
- `schemaVersion`은 **2 유지**. 3장면·Day1 문서의 저장 형태는 바뀌지 않으므로 버전을 올리면 그 두 템플릿에 아무 일도 하지 않는 마이그레이션만 남는다

`z.preprocess`는 이 리포지토리에서 처음 쓰는 zod 기능이다. 도입 이유를 여기 명시한다: 조건부 기본값을 표현하는 유일한 수단이고, 대안(버전 올리기)은 무관한 두 템플릿에 의식만 추가한다.

### 3.3 Invariants

| # | 불변식 | 지키는 곳 |
|---|---|---|
| I-1 | `0 ≤ rect.x ≤ 1 - rect.size` | 스키마는 범위만, 합산 제약은 `clampKvRect()` |
| I-2 | `1/KV_MOTION_MAX_SCALE ≤ rect.size ≤ 1` | 스키마 |
| I-3 | 사각형은 항상 프레임 종횡비 | 구조적 (§2.3) |
| I-4 | 강도는 프리셋에만 영향, 커스텀에는 무영향 | `resolveKvMotion()` |

---

## 4. Domain — `domain/kvloop/motion.ts` (순수)

```ts
export type KvEasing = 'linear' | 'easeOut' | 'easeInOut';

export interface KvMotionKeyframes {
  from: KvRect;
  to: KvRect;
  easing: KvEasing;
}

/** 프리셋 + 강도 → 두 사각형. 커스텀은 강도를 무시한다 (I-4). */
export const resolveKvMotion = (
  motion: KvMotion,
  intensity: number,
): KvMotionKeyframes;

/** 사각형 → 컴포지션이 그대로 쓰는 transform 삼요소. */
export const rectToTransform = (
  rect: KvRect,
): {scale: number; xPercent: number; yPercent: number};

/** 두 사각형 사이 선형 보간. 이징은 호출자가 progress에 이미 적용한다. */
export const lerpKvRect = (from: KvRect, to: KvRect, progress: number): KvRect;

/** I-1을 만족하도록 x·y를 접는다. 드래그 입력이 지나는 문. */
export const clampKvRect = (rect: KvRect): KvRect;
```

### 4.1 프리셋 정의

`scale = 1 + intensity * (KV_MOTION_MAX_PRESET_SCALE - 1)`, `size = 1 / scale`, `FULL = {x:0, y:0, size:1}`, `CENTER(size) = {x:(1-size)/2, y:(1-size)/2, size}`.

| 프리셋 | from | to | 이징 | 근거 |
|---|---|---|---|---|
| `still` | FULL | FULL | linear | 정지가 명시적 선택지가 된다 — 불리언이 꺼진 것과 의도된 정지를 구분할 수 없던 문제(Plan §1.2.1) |
| `zoomIn` | FULL | CENTER(size) | easeOut | 현재 동작. 카메라가 도착해 안착하는 느낌 |
| `zoomOut` | CENTER(size) | FULL | easeOut | 클로즈업에서 전경으로 빠지기 |
| `panLeftToRight` | `{0, (1-size)/2, size}` | `{1-size, (1-size)/2, size}` | linear | 팬은 등속이 자연스럽다. 감속하면 멈춰 보인다 |
| `panRightToLeft` | 위의 역 | | linear | |
| `panTopToBottom` | `{(1-size)/2, 0, size}` | `{(1-size)/2, 1-size, size}` | linear | |
| `panBottomToTop` | 위의 역 | | linear | |
| 커스텀 | 저장된 `from` | 저장된 `to` | easeInOut | 의도적으로 지정한 이동. 양쪽이 부드럽게 |

**강도 0에서 팬은 정지가 된다.** `size = 1`이면 움직일 여백이 없다. 숨기지 않고 인스펙터가 그 사실을 말한다(§6.1).

---

## 5. Compositions — `KvScene.tsx`

`kenBurns: boolean` + 자체 `interpolate` 대신 키프레임을 받는다.

```tsx
const progress = interpolate(frame, [0, Math.max(1, holdInFrames - 1)], [0, 1], {
  easing: EASING[slot.motion.easing],
  extrapolateRight: 'clamp',
});
const {scale, xPercent, yPercent} = rectToTransform(
  lerpKvRect(slot.motion.from, slot.motion.to, progress),
);
```

- `extrapolateRight: 'clamp'`는 유지된다. 세그먼트는 크로스페이드만큼 더 열려 있고, 그 여분에서는 마지막 상태로 고정되는 것이 옳다
- 블러 배경(`fit: contain`)도 같은 배율을 따라간다. 배경만 정지하면 테두리가 어긋난다
- `KV_LOOP_MAX_KEN_BURNS_SCALE`은 삭제된다. 남기면 두 개의 상한이 공존한다

---

## 6. UI

### 6.1 `KvLoopInspector.tsx` — 모션 섹션

```text
┌ 모션 ────────────────────────────────┐
│ 루프 기본값  [정지][줌인][줌아웃][팬▾] │   ← D-04, 전체에 한 번
│                                       │
│ KV 2         (•) 기본값 따름           │
│              ( ) 프리셋   [줌아웃]     │
│              ( ) 직접 지정  [영역 그리기]│
│                                       │
│ 모션 강도    ────●────  50%            │
│   직접 지정에서는 비활성 + 이유 표시    │
└───────────────────────────────────────┘
```

- 강도가 0이고 팬이 선택된 슬롯이 있으면 "강도가 0이면 팬은 정지입니다" 힌트(§4.1)
- 프리셋 라벨은 방향을 문자로 쓴다: `좌→우`, `우→좌`, `상→하`, `하→상`

### 6.2 `KvMotionOverlay.tsx` (신규) — 드래그 영역 지정

미리보기 `stage__frame` 위에 절대 배치되는 오버레이. "직접 지정" 모드에서만 마운트된다.

| 요소 | 동작 |
|---|---|
| 사각형 2개 | `시작`·`끝` 라벨. 색으로 구분 |
| 본체 드래그 | 이동. `clampKvRect`로 경계에서 접힘 |
| 우하단 핸들 | 크기 조절. 종횡비는 구조적으로 고정(§2.3)이므로 한 축만 읽는다 |
| 커밋 시점 | `pointerup`. 드래그 중 프로젝트를 갱신하면 오토세이브가 프레임마다 돈다 |

좌표 변환은 오버레이의 `getBoundingClientRect()` 기준 0~1 정규화 하나뿐이다. 출력 해상도를 몰라도 되고, 그래서 비율이 바뀌어도 사각형은 유효하다.

### 6.3 `EditorWorkspace.tsx`

모션 커맨드 3개를 스토어에 배선하고 오버레이를 미리보기 위에 얹는다. 선택된 KV는 `selectedKvIndex`(직전 사이클에서 수정됨)를 그대로 쓴다.

---

## 7. Error Handling

| 상황 | 처리 |
|---|---|
| 드래그가 경계를 넘음 | `clampKvRect`로 접는다. 거부하지 않는다 |
| 사각형이 최소 크기보다 작아짐 | 핸들이 최소에서 멈춘다 |
| 저장 문서에 `motion`이 없음 | `kenBurns`에서 유도 (§3.2) |
| 저장 문서의 사각형이 범위를 벗어남 | 스키마가 거부 → 기존 `SCHEMA_INVALID` 경로 |

---

## 8. Test Plan

### 8.1 Unit — `domain/kvloop/motion.test.ts`

| # | 검증 |
|---|---|
| U-1 | `rectToTransform(FULL)` = `{scale:1, x:0, y:0}` — 오늘의 무모션과 동일 |
| U-2 | `rectToTransform(CENTER(0.5))` = `{scale:2, x:0, y:0}` |
| U-3 | `rectToTransform({0,0,0.5})` = `{scale:2, x:+50, y:+50}` |
| U-4 | `zoomIn` + 강도 1.0의 끝 배율 = `KV_MOTION_MAX_PRESET_SCALE` |
| U-5 | `zoomOut`은 `zoomIn`의 from/to 역순 |
| U-6 | 팬 4방향이 각각 의도한 축으로만 이동 |
| U-7 | 강도 0에서 모든 프리셋이 FULL→FULL |
| U-8 | 커스텀은 강도를 무시한다 (I-4) |
| U-9 | `clampKvRect`가 I-1을 만족시킨다 |
| U-10 | `lerpKvRect(from, to, 0\|1)`이 각 끝점과 같다 |

### 8.2 Unit — 마이그레이션

| # | 검증 |
|---|---|
| U-11 | `kenBurns: true`인 저장 문서가 `zoomIn`으로 파싱된다 |
| U-12 | `kenBurns: false`가 `still`로 파싱된다 |
| U-13 | `motion`이 이미 있으면 `kenBurns`를 무시한다 |
| U-14 | 3장면·Day1 문서는 영향 없음 |

### 8.3 E2E

| # | 검증 | 코덱 |
|---|---|---|
| E-1 | 프리셋 선택이 슬롯에 반영되고 새로고침을 넘긴다 | 불필요 |
| E-2 | 드래그로 사각형을 옮기면 미리보기가 따라간다 | 불필요 |
| E-3 | 강도 0 + 팬에서 힌트가 뜬다 | 불필요 |
| E-4 | 서로 다른 프리셋 3개로 렌더해 프레임 단위로 방향·폭 확인 (SC1) | **필요** |
| E-5 | 드래그한 끝 영역이 홀드 마지막 프레임과 일치 (SC2) | **필요** |
| E-6 | 기존 저장 프로젝트가 같은 **종류**의 모션으로 렌더된다 (§2.3의 좁힌 정의) | **필요** |

### 8.4 성능 게이트 — 이 환경에서 실행 불가

`npm run benchmark:render`로 변경 전후를 측정하고 NFR-M01(20% 이내)을 넘으면 `KV_MOTION_MAX_SCALE`을 좁힌다. **이 컨테이너는 H.264 인코더가 없어 측정 자체가 불가능하다**(module-5 evidence §1.2). E-4~E-6과 함께 시스템 Chrome이 있는 기기의 실행에 달려 있고, 그때까지 3.0은 **잠정값**이다.

---

## 9. Architecture Compliance

| 규칙 | 준수 |
|---|---|
| `domain`은 React·Remotion·Zustand를 import하지 않는다 | 이징을 이름으로 반환, 곡선은 `KvScene`이 적용 |
| `compositions`는 스토어를 import하지 않는다 | 키프레임은 props로 내려온다 |
| 컴포넌트는 렌더러·IndexedDB를 직접 만들지 않는다 | 변화 없음 |
| 기능은 다른 기능의 내부를 import하지 않는다 | 오버레이는 `features/editor` 안 |

---

## 10. Out of Scope (별도 사이클)

- 컬러 그레이딩·블러·비네트·라이트 스윕·도형 와이프 (D-06). 렌더러 지원 여부는 Plan §1.2.2에 측정 완료
- 3개 이상의 키프레임
- 3장면·Day1 템플릿의 모션
- KV별 크로스페이드 길이

---

## 11. Implementation Order

| # | 단계 | 종료 조건 |
|---|---|---|
| 1 | `motion.ts` + 단위 테스트 | U-1~U-10 통과 |
| 2 | 스키마 + 마이그레이션 | U-11~U-14 통과, 기존 500건 유지 |
| 3 | `buildKvLoopProps` + `KvScene` | 빌드 통과, 미리보기에서 줌 인이 이전과 같이 보인다 |
| 4 | 인스펙터 프리셋 · 강도 | E-1, E-3 |
| 5 | 드래그 오버레이 | E-2 |
| 6 | 성능 게이트 · 렌더 검증 | **시스템 Chrome 필요 — 미결로 남긴다** |

---

## 12. Requirement Traceability

| FR | 어디서 |
|---|---|
| FR-M01 프리셋 선택 | §4.1, §6.1 |
| FR-M02 전체 기본 + 개별 | §3.1 (`motion: null` = 상속), §6.1 |
| FR-M03 드래그 지정 | §6.2 |
| FR-M04 종횡비 고정 | §2.3 (구조적) |
| FR-M05 경계 클램프 | §4 `clampKvRect`, §7 |
| FR-M06 강도 비활성 | §6.1, I-4 |
| FR-M07 저장 문서 무회귀 | §3.2, U-11~U-14, E-6 — **§2.3에서 "종류 보존"으로 좁혔다** |
| FR-M08 미리보기·렌더 일치 | §2.2 (한 스냅샷), §5 |

---

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-23 | 김성권 / Claude | 최초 작성. D-01의 두 상수 분리를 Plan 이탈로 명시 |
