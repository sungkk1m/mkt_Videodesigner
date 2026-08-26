# Key Visual Object Animation Design Document

> **Summary**: 슬롯별 이펙트 오브젝트(파티클·글로우)의 스키마, 결정론 순수 함수, 카메라 추종 캔버스 레이어의 설계
>
> **Project**: mkt_videodesigner
> **Feature**: kv-object-animation
> **Version**: 0.2.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-26
> **Status**: Confirmed — M0 스파이크 5/5 PASS(§4.3), 드로잉 시점 확정. M1 착수 가능
> **Plan**: [kv-object-animation.plan.md](../../01-plan/features/kv-object-animation.plan.md)
> **Measurements**: [reference-measurement §3](../../03-analysis/kv-loop-reference-motion.reference-measurement.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 레퍼런스의 마지막 층 — 정적 원화 위의 불티 파티클·글로우 펄스 — 를 브라우저 렌더 안에서 재현한다. D-01~D-06 확정(Plan §1.5.1) |
| **CONSTRAINT** | 이펙트 프레임은 (스키마, 프레임)의 순수 함수(D-03). `domain`은 Remotion·DOM을 임포트하지 않는다(NFR-O04). 이펙트 없는 프로젝트는 비트 동일(FR-O08) |
| **RISK** | 캔버스 드로잉이 래스터화 스냅샷에 늦게 닿을 수 있다 — M0이 코드 착수 전에 소거한다(§4.3) |

## 1. Overview

### 1.1 Design Goals

1. **결정론은 상태가 아니라 함수다.** 파티클 시뮬레이션(프레임 간 상태 누적)을
   두지 않는다. 임의 프레임 `f`의 이펙트 상태는 `(스키마 값, f)`에서 닫힌 식으로
   계산된다 — 스크럽·역방향 탐색·재렌더가 전부 같은 그림을 내는 유일한 구조다.
2. **이펙트는 원화에 붙는다.** 캔버스가 KV 이미지와 **동일한 transform 문자열**을
   받으면 카메라 추종(D-04)이 검증이 아니라 구조로 성립한다.
3. 스키마는 discriminated union — 이번 사이클은 `particles`·`glow` 두 유형,
   다음 사이클의 마스크·라이트 스윕이 유형 추가로 얹힌다(D-02).
4. 이펙트가 없는 슬롯은 캔버스 요소 자체를 만들지 않는다(NFR-O01).

### 1.2 Key Insight — 방출도 닫힌 식이 된다

"방출"은 보통 누적 상태(태어난 파티클 목록)로 구현되지만, 파티클 `i`의 수명을
주기로 보면 시각 `t`에 파티클 `i`가 몇 번째 생애(`k`)의 어느 지점(`u ∈ [0,1)`)에
있는지는 나눗셈 한 번이다. 생애마다 달라지는 값(출생 위치·크기·흔들림 위상)은
`hash(seed, i, k)`로 뽑는다 — 과거를 기억할 필요가 없고, 모든 프레임이 서로
독립적으로 계산 가능하다.

### 1.3 Confirmed Decisions

Plan §1.5.1이 원본이다. 설계에 직접 닿는 것: 파티클은 영역 rect·글로우는
점+반경(D-02), 오브젝트별 시드 저장·프레임이 유일한 시간 입력(D-03), 캔버스는
`KvScene` transform 안쪽(D-04), UI는 인스펙터+오버레이(D-06).

## 2. Data Model

### 2.1 스키마 — `kvSlotSchema`에 `effects`

```ts
/**
 * 0-1 프레임 좌표의 자유 종횡비 사각형. kvRectSchema(카메라)와 달리
 * ① 정사각 제약이 없고(모닥불은 가로로 넓다) ② 최소 크기 하한이 다르다
 * (카메라의 1/KV_MOTION_MAX_SCALE는 줌 상한에서 온 값 — 이펙트와 무관).
 */
const kvEffectRegionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(MIN_KV_EFFECT_SPAN).max(1),
  height: z.number().min(MIN_KV_EFFECT_SPAN).max(1),
});

export const kvEffectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('particles'),
    id: z.string().min(1),
    /** D-03 — 추가 시점에 한 번 생성돼 저장. 이후 모든 프레임의 유일한 난수원. */
    seed: z.number().int().min(0),
    region: kvEffectRegionSchema,
    color: hexColorSchema,
    density: z.number().min(0).max(1),
    speed: z.number().min(0).max(1),
    sizePx: z.number().min(1).max(MAX_KV_PARTICLE_SIZE_PX),
  }),
  z.object({
    kind: z.literal('glow'),
    id: z.string().min(1),
    center: z.object({x: z.number().min(0).max(1), y: z.number().min(0).max(1)}),
    /** 프레임 폭의 비율 — 캔버스가 항상 1080×1920이므로 px 환산이 안정적. */
    radius: z.number().min(MIN_KV_EFFECT_SPAN).max(1),
    color: hexColorSchema,
    intensity: z.number().min(0).max(1),
    periodMs: z.number().min(MIN_KV_GLOW_PERIOD_MS).max(MAX_KV_GLOW_PERIOD_MS),
  }),
]);

// kvSlotSchema(z.preprocess 안쪽 object)에:
effects: z.array(kvEffectSchema).max(MAX_KV_EFFECTS_PER_SLOT).default([]),
```

- `.default([])`가 마이그레이션을 대신한다(NFR-O03): 저장 문서는 필드가 없고,
  파싱 결과는 빈 배열 — 캔버스 레이어가 만들어지지 않아 **변경 전과 완전히 같은
  렌더 트리**다(SC6). `kenBurns` preprocess 바깥이 아니라 안쪽 object에 들어가야
  preprocess가 건드리지 않는다(Plan §6.2).
- 글로우에 시드가 없는 이유: 주기 함수에 무작위성이 없다(D-03 비고).

### 2.2 상수 — `constants.ts`

```ts
export const MAX_KV_EFFECTS_PER_SLOT = 8;     // 레퍼런스는 슬롯당 2개 층
export const MIN_KV_EFFECT_SPAN = 0.02;       // 오버레이 핸들이 잡히는 최소 크기
export const MAX_KV_PARTICLE_SIZE_PX = 16;    // 1080 폭에서 이미 "점"이 아니다
export const MIN_KV_GLOW_PERIOD_MS = 500;
export const MAX_KV_GLOW_PERIOD_MS = 8000;
```

새 오브젝트의 기본값(색·밀도·속도·주기)은 **잠정**으로 넣고 M4에서 레퍼런스
실측값으로 교체한다 — 이전 사이클의 D-07/D-08(블러 333ms·30px)과 같은 절차.

### 2.3 렌더 프롭 — `types.ts`

```ts
export interface KvSlotRenderProps {
  // …기존 필드…
  /** 스키마 값 그대로 — 해석할 것이 없어 buildKvLoopProps는 통과만 시킨다. */
  effects: readonly KvEffect[];
}
```

이펙트는 URL도 프레임 환산도 필요 없는 자기완결 값이라, 카메라(`motion`)처럼
빌더에서 해석하지 않고 동결해 통과시킨다. 소비자는 `KvScene` 하나다.

## 3. Domain — `src/domain/kvloop/effects.ts` (신규)

### 3.1 결정론 난수 — 해시가 PRNG를 대신한다

순차 PRNG(mulberry32 등)는 "n번째 값"을 얻는 데 n번 호출이 필요해 프레임 독립
계산과 어울리지 않는다. 대신 정수 해시(splitmix32 계열)를 `[0,1)`로 접는다:

```ts
/** (seed, lane…)의 순수 함수 — 같은 입력은 언제나 같은 값. */
export const kvHash01 = (seed: number, ...lanes: number[]): number
```

### 3.2 파티클의 닫힌 식

```ts
export interface KvParticleState {
  x: number;        // 0-1 프레임 좌표
  y: number;
  sizePx: number;   // 1080 캔버스 기준
  opacity: number;  // 0-1
}
export const kvParticlesAt = (
  effect: KvParticlesEffect,
  frame: number,
  fps: number,
): KvParticleState[]
```

- `tSec = frame / fps` — fps가 달라도 체감 속도가 같다(시간 값은 실초, 이전
  사이클의 ms 규약과 같은 이유).
- 풀 크기 `N = ceil(density × 풀 상한)`. 파티클 `i`의 수명 `L_i`와 위상은
  `kvHash01(seed, i, …)`에서. 생애 인덱스 `k = ⌊(tSec + phase_i) / L_i⌋`,
  진행도 `u = frac`.
- 생애 `k`의 출생점은 `region` 안에서 `kvHash01(seed, i, k, …)`로. 위치는
  출생점에서 위로 `u × travel`(speed가 스케일), 좌우로 사인 흔들림.
  불투명도는 `sin(π·u)`(출생·소멸 페이드) × 고주파 플리커.
- **경계 보장**: 이동은 위쪽뿐이고 travel 상한이 스키마 값에서 계산 가능하므로,
  "파티클이 도달할 수 있는 최대 사각형"이 닫힌 식으로 나온다 — SC1(영역 밖
  무변화) 판정과 단위 테스트가 이 식을 그대로 쓴다.

정확한 계수(수명 범위, travel 배율, 플리커 주파수)는 코드 상수로 두고 M4
실측에서 확정한다. 형태만이 설계의 고정점이다.

### 3.3 글로우의 주기 함수

```ts
export const kvGlowOpacityAt = (
  effect: KvGlowEffect,
  frame: number,
  fps: number,
): number
// intensity × (base + depth·sin(2π · tMs / periodMs)) — base/depth는 M4 실측
```

무작위성 없음 — 같은 프레임은 항상 같은 밝기다.

### 3.4 시간의 기준 — 세그먼트 로컬 프레임

`KvScene`은 `<Sequence>` 안에 있어 `useCurrentFrame`이 세그먼트 로컬이다.
이펙트도 그 프레임을 그대로 쓴다. 결과: 같은 KV가 사이클마다 **동일한 이펙트
프레임**을 보인다 — 레퍼런스의 "4장×2회 반복" 구조와 같은 읽힘이고, 컷 경계는
원화가 통째로 바뀌므로 이펙트 연속성이 애초에 성립하지 않는 지점이다.

## 4. Compositions

### 4.1 `KvScene` — 캔버스는 이미지와 같은 transform을 받는다

```tsx
{/* 이미지의 transform 문자열을 변수로 올려 둘이 공유한다. */}
const sceneTransform =
  `translate(${slot.x + xPercent}%, ${slot.y + yPercent}%) ` +
  `scale(${slot.scale * motionScale})`;

<AbsoluteFill>
  <Img … style={{…, transform: sceneTransform}} />
</AbsoluteFill>
{slot.effects.length > 0 ? (
  <AbsoluteFill>
    <KvEffectsCanvas effects={slot.effects} transform={sceneTransform} />
  </AbsoluteFill>
) : null}
```

- 캔버스 요소와 이미지 요소는 같은 레이아웃 박스(전체 프레임)를 가지므로, 같은
  transform이면 두 좌표계가 픽셀 단위로 일치한다 — 카메라 추종(FR-O05)과 사용자
  프레이밍(`slot.x/y/scale`) 추종이 함께 성립한다.
- `KvScene` 루트가 이미 `overflow: hidden` — 줌 아웃 시 이펙트도 이미지와 같은
  클리핑을 받는다(Plan §5 리스크 완화).
- 이펙트 좌표는 **프레임 박스 기준**(0-1)이다. `KvRect`와 같은 공간이고,
  `objectFit`이 상 안에서 콘텐츠를 어떻게 놓는지와는 독립이다 — 이미지 픽셀
  좌표계가 필요해지는 것은 AI 마스크 사이클부터다.

### 4.2 `KvEffectsCanvas` — 프레임마다 다시 그리는 순수 뷰

```tsx
const KvEffectsCanvas = ({effects, transform}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    drawKvEffects(ref.current, effects, frame, fps);   // §3의 순수 함수를 호출
  }, [effects, frame, fps]);

  return <canvas ref={ref} width={width} height={height}
                 style={{width: '100%', height: '100%', transform}} />;
};
```

- 내부 해상도는 컴포지션 크기(1080×1920) 고정 — 미리보기 축소는 CSS가 하고,
  렌더는 원본 픽셀을 래스터화한다.
- 드로잉: `clearRect` 후 `globalCompositeOperation = 'lighter'`(가산 — 불티와
  halo는 빛이다), 파티클은 원, 글로우는 `createRadialGradient`(중심 →
  반경에서 알파 0, 반경 밖 기여 없음 — SC1의 경계).
- `useLayoutEffect`는 커밋 직후·페인트 전에 동기 실행된다. **web-renderer의
  스냅샷이 이 드로잉 이후를 캡처하는가가 이 설계의 유일한 전제**이고, M0의
  게이트 ⑤가 그것을 수치로 판정한다(§4.3). 어긋나면 드로잉 시점을
  `delayRender`/`continueRender` 짝으로 옮긴다 — 컴포넌트 경계는 그대로다.

### 4.3 M0 스파이크 — 결정론 캔버스 레이어의 렌더 실증

Plan §7 M0. 하네스는 `artifacts/kv-obj-m0/`(이전 사이클 `artifacts/kv-m0/`
관례 — spike.html + spike.tsx + run.mjs + verify.mjs). 스파이크는 §3·§4.2의
후보 구현을 스파이크 로컬로 갖고, 도메인 순수 함수(`rectToTransform`·
`lerpKvRect`·`withKvRoundTrip`)는 src에서 임포트해 실제 카메라 수식을 쓴다.

1080×1920 텍스처 픽스처 위에 파티클 영역 + 글로우 점을 놓고 30fps·90프레임을
VP9로 렌더한다 (이 컨테이너의 Chromium은 H.264 인코더가 없다 — 판정은 코덱
독립, 이전 사이클과 동일한 논리).

| 게이트 | 방법 | 판정 |
|---|---|---|
| ① 결정론 | 같은 시드로 2회 렌더, 디코드 후 프레임별 평균 절대차 | 전 프레임 ≈ 0 (SC2) |
| ② 비용 | 이펙트 on/off 렌더 시간 비교 | 수치 기록 — 게이트는 실기기(D-05) |
| ③ 격리 | on/off 프레임을 이펙트 도달 범위(§3.2의 닫힌 식) 밖 띠에서 비교 | 차이가 코덱 노이즈 이하 (SC1) |
| ④ 카메라 추종 | 왕복 줌 켠 렌더에서 정점 프레임의 글로우 중심 위치 | transform 수식의 예측 위치와 일치 (SC4) |
| ⑤ 드로잉 = 인코딩 | 임의 프레임을 순수 함수로 단독 드로잉(스크럽의 등가물) → 순차 렌더의 같은 프레임과 비교 | 평균 차 < 코덱 양자화 여유 (SC3) |

⑤가 FAIL이면 `useLayoutEffect`가 스냅샷보다 늦는 것 — `delayRender`로 선회.
①이 FAIL이면 드로잉 경로 어딘가에 비결정 입력이 있는 것 — 설계 전제가 무너지므로
원인 규명 전에 M1로 가지 않는다.

**결과 (2026-08-26)**: 자체 래스터라이저 경로에서 **5/5 PASS** — 2회 렌더가
sha256 비트 동일(①), 격리 띠 차 0.080(③), 단독 드로잉 vs 인코딩 0.48/255(⑤),
글로우 중심 0.620→0.643 vs 예측 0.644(④). 비용은 카메라 정지에서 ≈0ms/프레임,
transform 하에서 ≈19ms/프레임 상한 참고치(②). `useLayoutEffect` 채택 확정,
선회 불필요. 수치와 재현 절차는
[m0-canvas-spike](../../03-analysis/kv-object-animation.m0-canvas-spike.md).

## 5. UI

### 5.1 인스펙터 — `KvLoopInspector.tsx`

선택된 KV의 모션 섹션 아래에 "이펙트" 섹션:

| 컨트롤 | 형태 |
|---|---|
| 오브젝트 목록 | 행: 유형 아이콘 + 색 견본 + 선택/삭제. `MAX_KV_EFFECTS_PER_SLOT`에서 추가 버튼 비활성 |
| 추가 | "파티클 추가" / "글로우 추가" — 잠정 기본값으로 생성, 시드는 이때 한 번 생성돼 저장(D-03) |
| 파티클 속성 | 색(`ColorField`), 밀도·속도 슬라이더(0-1), 크기(px) |
| 글로우 속성 | 색, 세기(0-1), 반경, 주기(ms) |

커맨드는 `project.ts`에 `addKvEffect` / `removeKvEffect` / `updateKvEffect` —
`updateKvLoopSettings`와 같은 클램프-패치 형태, `mapKvLoop` 경유라 외부
템플릿에서 no-op.

### 5.2 오버레이 — `KvEffectOverlay.tsx` (신규)

`KvMotionOverlay`의 구조(포인터 캡처, 로컬 draft, 놓을 때 커밋)를 따르되:

- **선택된 이펙트 하나**만 그린다 — 카메라 오버레이의 from/to 쌍과 달리 목록이
  길 수 있어, 편집 중인 것만 보이는 쪽이 읽기 쉽다.
- 파티클: 자유 종횡비 rect — 이동 + 우하단 핸들이 양축 리사이즈(카메라 rect의
  단축 리사이즈와 다른 점).
- 글로우: 중심점 드래그 + 반경 핸들(중심에서 수평 거리).
- 마운트는 `EditorWorkspace`에서 "이펙트가 선택돼 있을 때"만 —
  `KvMotionOverlay`의 `kind === 'custom'`일 때와 같은 "편집 중일 때만" 규칙.
- 오버레이는 카메라 transform을 적용받지 않는 프레임 좌표 UI다 —
  `KvMotionOverlay`가 재생 중 줌을 무시하고 그리는 것과 동일한 관례.

## 6. Error Handling

새 에러 코드 없음. 모든 값은 클램프로 교정되는 연속량이고, 빈 목록이 기본
상태다. 이펙트 상한 도달은 에러가 아니라 추가 버튼 비활성이다.

## 7. Test Plan

### 7.1 Unit — `domain/kvloop/effects.test.ts` (신규)

| 검증 | 대상 |
|---|---|
| 같은 (effect, frame, fps) → 깊은 동등 상태, 다른 시드 → 다른 상태 | FR-O04 |
| 모든 파티클이 도달 범위 사각형(§3.2) 안 | FR-O02 / SC1 |
| `density: 0` → 빈 배열, `intensity: 0` → 불투명도 0 | 끔의 의미 |
| 글로우 주기: `t`와 `t + periodMs`의 불투명도 동일 | FR-O03 |
| fps 30/60에서 같은 실시간 시각의 상태 근사 동일 | §3.2 시간 규약 |

스키마·커맨드는 `project.test.ts` 관례: `.default([])` 파싱, 추가/삭제/패치
클램프, 외부 템플릿 no-op.

### 7.2 E2E (코덱 불필요)

- 이펙트 추가 시 캔버스 요소 존재 + `transform`이 이미지와 동일 문자열,
  제거 시 요소 부재 (NFR-O01)
- 오버레이 드래그로 영역 변경이 인스펙터 값에 반영

캔버스 픽셀은 DOM 문자열로 판정 불가 — M0 하네스 재실행과 실기기 게이트가 맡는다.

### 7.3 실기기 게이트 (M5)

H.264 렌더로 SC1~SC7 재판정 + 이펙트 on/off 렌더 시간 재측정 → 성능 게이트
확정(D-05). 이전 사이클의 M4 런북 절차를 따른다.

## 8. Architecture Compliance

- `domain/kvloop/effects.ts`는 수학만 — Remotion·DOM 임포트 없음(NFR-O04).
  캔버스 컨텍스트를 받는 `drawKvEffects`는 컴포지션 쪽(`compositions/kvloop/`)에
  둔다 — `domain`은 상태 배열을 내고, 뷰가 그린다.
- 스키마 상수는 `constants.ts`에서 읽는다.
- 커맨드는 `mapKvLoop` 경유로 외부 템플릿 no-op.

## 9. Implementation Order

| M | 내용 | 게이트 |
|---|---|---|
| M0 | 스파이크 (§4.3) | 게이트 ①③④⑤ PASS, ② 수치 기록 |
| M1 | 스키마·상수·커맨드·`effects.ts` | 단위 테스트 (§7.1) |
| M2 | `KvEffectsCanvas` + `KvScene` 통합 | E2E + M0 하네스 재실행 |
| M3 | 인스펙터 + 오버레이 (§5) | E2E controls |
| M4 | 기본값 실측(레퍼런스 파티클 밀도·속도·크기·글로우 주기) + 검수 | 실측 문서 |
| M5 | 실기기 렌더 게이트 | SC1~SC7 + 성능 게이트 확정 |

## 10. Requirement Traceability

| FR | 설계 위치 |
|---|---|
| FR-O01/O07 | §2.1, §5.1 |
| FR-O02 | §3.2 (경계 보장), §4.2 (반경 밖 기여 없음) |
| FR-O03 | §3.3 |
| FR-O04 | §1.1, §3.1, M0 ① |
| FR-O05 | §4.1 (transform 공유), M0 ④ |
| FR-O06 | §5.2 |
| FR-O08 | §2.1 `.default([])` + SC6 |
| FR-O09 | §4.2, M0 ⑤ |
| NFR-O01 | §4.1 (조건부 마운트) |
| NFR-O04 | §8 |

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-26 | 김성권 / Claude | 최초 작성 — D-01~D-06 반영, M0 게이트 정의 |
| 0.2.0 | 2026-08-26 | 김성권 / Claude | M0 판정 기록(§4.3) — 5/5 PASS, 드로잉 시점 확정 |
