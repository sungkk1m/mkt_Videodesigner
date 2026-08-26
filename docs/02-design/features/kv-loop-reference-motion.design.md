# Key Visual Loop Reference Motion Design Document

> **Summary**: 왕복 진행도(삼각파) · 컷 전환 · 화면 전체 가우시안 블러 북엔드의 설계
>
> **Project**: mkt_videodesigner
> **Feature**: kv-loop-reference-motion
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-26
> **Status**: Draft
> **Plan**: [kv-loop-reference-motion.plan.md](../../01-plan/features/kv-loop-reference-motion.plan.md)
> **Measurements**: [reference-measurement.md](../../03-analysis/kv-loop-reference-motion.reference-measurement.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 루핑 출력이 레퍼런스의 카메라 문법(왕복·컷·블러 북엔드)과 다르다. Plan §1.3의 실측으로 차이가 수치화됐고, D-01~D-11이 확정됐다 |
| **CONSTRAINT** | 저장된 프로젝트는 마이그레이션 없이 이전과 동일하게 렌더돼야 한다(FR-R12). `MIN_TRANSITION_MS`는 3장면과 공유되므로 전역으로 건드리지 않는다 |
| **RISK** | 컨테이너 `filter: blur()`가 web-renderer의 두 래스터화 경로에서 다르게 나올 수 있다(Plan §1.4) — M0 스파이크가 먼저다 |

## 1. Overview

### 1.1 Design Goals

1. 모션 모델을 바꾸지 않는다. `from`/`to` 두 사각형과 `resolveKvMotion`은 그대로 두고, **진행도의 모양**만 확장한다.
2. 컷은 새 코드가 아니라 **경계값 완화**다. `transitionInFrames = 0`이면 컴포지션이 이미 컷을 그린다.
3. 블러는 **한 레이어**다. 장면 스택 위가 아니라 장면 스택을 감싸는 컨테이너에 걸어, 키비주얼·타이틀·고지문구가 함께 흐려진다(D-05).
4. 기존 문서의 기본값은 전부 "꺼짐"으로 들어온다. 새 프로젝트만 새 문법으로 시작한다.

### 1.2 Key Insight — 왕복은 키프레임이 아니라 진행도다

`KvScene`의 카메라는 `lerpKvRect(from, to, progress)` 하나로 그려진다. 왕복은
`progress`가 0→1이 아니라 **0→1→0**이 되는 것뿐이므로, 키프레임을 늘리지 않고
`interpolate`의 입력 구간을 `[0, mid, last]` 세 지점으로 늘리면 된다. Remotion의
`interpolate`는 easing을 구간마다 적용하므로, `easeInOut` 하나로 "정점 속도 0"
(FR-R05)이 두 구간 모두에서 성립한다.

### 1.3 Confirmed Decisions

Plan §1.5.1의 표가 원본이다. 설계에 직접 닿는 것만 다시 적는다:
왕복은 루프 전체 토글(D-01·D-02), 왕복 시 easing은 `easeInOut` 강제(D-03),
컷은 `transitionMs = 0`(D-04), 블러는 화면 전체(D-05), 새 프로젝트의
`fadeOutMs` 기본 0(D-06), 블러 기본 333ms·30px(D-07·D-08, 실측 근거).

## 2. Data Model

### 2.1 스키마 변경 — `kvLoopSettingsSchema`

```ts
// R-1/R-2 — 홀드 안에서 from → to → from. 저장 문서 기본은 꺼짐(편도 유지).
roundTrip: z.boolean().default(false),

// R-3 — 0 = 컷. kv-loop에서만 하한을 0으로 내린다.
// 3장면이 공유하는 MIN_TRANSITION_MS(=100)는 그대로다.
transitionMs: z.number().min(0).max(MAX_TRANSITION_MS),

// R-4/R-5 — 시작·끝 가우시안 북엔드. 길이나 세기가 0이면 꺼짐.
// durationMs는 fps 독립(D-07), amountPx는 1080×1920 캔버스의 CSS px(D-08).
blur: z
  .object({
    durationMs: z.number().min(0).max(MAX_TRANSITION_MS),
    amountPx: z.number().min(0).max(MAX_KV_BLUR_PX),
  })
  .default({durationMs: 0, amountPx: 0}),
```

`.default()`가 마이그레이션을 대신한다(NFR-R03): 저장 문서는 세 필드가 없고,
파싱 결과는 `roundTrip: false` · `blur: 0/0` · `transitionMs`는 기존값(≥100) —
**변경 전과 완전히 같은 렌더 입력**이다(SC6).

### 2.2 상수 — `constants.ts`

```ts
export const MAX_KV_BLUR_PX = 100;          // blur(100px)는 이미 형태가 없다
export const DEFAULT_KV_BLUR_MS = 333;      // 실측: 레퍼런스 30fps의 ~10프레임
export const DEFAULT_KV_BLUR_PX = 30;       // 실측: 램프 시작값 ≈ 30px
```

`DEFAULT_KV_TRANSITION_MS`(400)는 이름과 값 모두 유지한다 — 저장 문서 해석과
무관하며, 아래 §2.3에서 새 프로젝트가 더 이상 쓰지 않게 될 뿐이다.

### 2.3 새 프로젝트 기본값 — `DEFAULT_KV_LOOP_SETTINGS`

| 필드 | 기존 | 신규 | 근거 |
|---|---|---|---|
| `roundTrip` | — | `true` | R-1 |
| `transitionMs` | 400 | **0 (컷)** | R-3 / FR-R07 |
| `fadeOutMs` | 400 | **0** | D-06 — 필드·UI는 유지 |
| `blur` | — | `{durationMs: 333, amountPx: 30}` | R-5 실측 |
| `motion` | zoomIn | zoomIn (유지) | |
| `kenBurnsIntensity` | 0.5 | 0.5 (유지 — D-10은 검수 후) | |

FR-L17(검정 페이드 기본 켜짐)은 이 표로 **의도적으로 대체**된다. 근거가 됐던
레퍼런스 자체가 검정 페이드가 아니라 블러 북엔드로 닫힘이 실측으로 확인됐다.

### 2.4 렌더 프롭 — `types.ts`

```ts
export interface KvMotionKeyframes {
  from: KvRect;
  to: KvRect;
  easing: KvEasing;
  /** R-1 — true면 홀드 중앙을 정점으로 from→to→from. */
  roundTrip: boolean;
}

export type KvLoopProps = {
  // …기존 필드…
  /** R-4 — 프레임 단위로 환산된 북엔드. 0이면 레이어를 그리지 않는다. */
  blurInFrames: number;
  blurAmountPx: number;
};
```

`roundTrip`을 루프 설정이 아니라 **키프레임에 싣는** 이유: `KvScene`이 읽는
것은 keyframes 하나여야 하고(§1.2), 왕복 시 easing 강제(D-03)도 같은 곳에서
한 번에 해석돼야 세 소비자(컴포지션·인스펙터 시드·헤더)가 어긋나지 않는다.

## 3. Domain

### 3.1 왕복의 해석 — `buildKvLoopProps`

```ts
const resolved = resolveKvMotion(slot.motion ?? settings.motion, settings.kenBurnsIntensity);
const motion = settings.roundTrip
  ? {...resolved, roundTrip: true, easing: 'easeInOut' as const}   // D-03
  : {...resolved, roundTrip: false};
```

- 프리셋·직접 지정 어느 쪽이든 동일하게 적용된다(FR-R04). `resolveKvMotion`은
  건드리지 않는다.
- 왕복이 아닐 때는 기존 easing이 그대로 남아 SC6(비트 동일)이 성립한다.

### 3.2 정점의 프레임 정의 — FR-R02

홀드가 `N`프레임(인덱스 `0…N-1`)일 때:

```
last = N - 1,  mid = last / 2          // 정수가 아니어도 된다
progress(frame) = interpolate(frame, [0, mid, last], [0, 1, 0],
                              {easing, extrapolateRight: 'clamp'})
```

- `mid`가 소수(짝수 N)면 정점 프레임이 존재하지 않고 정점을 **사이에 두고**
  지나간다 — 대칭은 정확히 성립하고, SC1의 "중앙 ±1프레임"을 자동 만족한다.
- 마지막 프레임의 진행도가 정확히 0이므로 다음 홀드의 첫 프레임(진행도 0)과
  같은 카메라다 — FR-R03이 구조적으로 성립하고, 컷이 튀지 않는다.
- 크로스페이드를 켠 채 왕복하면 겹침 구간(`extrapolateRight` 너머)은 진행도
  0에 고정된다 — 카메라가 출발점에 멈춘 채 페이드되므로 역시 이음매가 없다.

### 3.3 블러의 프레임 환산

`buildKvLoopProps`에서 `blurInFrames = msToFrames(blur.durationMs, fps)`,
`blurAmountPx = blur.amountPx`. 겹침 방지 클램프는 두지 않는다 — 상한
1000ms(60fps에서 60프레임)는 최단 프로젝트(15초)의 양끝이 겹칠 수 없는 값이다.

## 4. Compositions

### 4.1 `KvScene.tsx` — 진행도만 바뀐다

기존의 단일 `interpolate` 호출이 §3.2의 3지점 형태로 확장된다. `roundTrip`이
false면 기존 2지점 호출과 동일한 결과 — 회귀 없음이 단위 테스트로 고정된다.

### 4.2 `KvLoopComposition.tsx` — 블러 북엔드 레이어

장면 스택 + 타이틀 + 고지문구를 `BlurBookend` 컨테이너로 감싼다(D-05).
`FadeOut`(검정)과 `AudioLayer`는 밖에 남는다 — 소리는 흐려지지 않고, 검정
페이드를 켠 사용자의 의도는 블러 위에 그려져야 한다.

```
amount(frame) = amountPx × max(rampIn, rampOut)
  rampIn  = 1 − clamp(frame / blurInFrames)                  // 시작에서 1→0
  rampOut = 1 − clamp((totalFrames−1−frame) / blurInFrames)  // 끝에서 0→1
style = {
  filter: amount > 0 ? `blur(${amount}px)` : undefined,       // NFR-R01
  transform: amount > 0 ? `scale(${1 + (3·amount)/1080})` : undefined,
}
```

- **오버스캔**: 가우시안의 3σ가 화면 밖에서 흘러들어오는 캔버스색을 덮도록
  `1 + 3·amount/캔버스폭`으로 함께 움직인다. amount가 0에 닿는 순간 scale도
  정확히 1이 되므로 경계에서 팝이 없다(FR-R10).
- `amount = 0`인 본편 구간에서는 `filter`도 `transform`도 **없다**(NFR-R01) —
  래스터라이저가 본편 프레임에서 추가 비용을 지불하지 않는다.
- 블러 중 진행되는 미세한 확대는 육안으로 블러에 흡수된다. 레퍼런스도 열림
  구간에서 형태가 커지며 선명해진다.

### 4.3 M0 스파이크 — 두 래스터화 경로의 일치

Plan §1.4의 리스크를 코드 착수 전에 소거한다. 이 컨테이너는 VP9 인코드가
가능하므로(media-codec-compat 사이클 실측) **여기서 실행 가능하다**:

1. 컨테이너 블러가 걸린 3프레임짜리 kv-loop을 web-renderer로 VP9 렌더.
2. 같은 프레임의 Player DOM을 Playwright 스크린샷.
3. 프레임 추출 후 두 이미지의 Sobel 에너지·픽셀 차이 비교.

판정: 블러 반경 오차가 시각 등가(±20%) 안이면 컨테이너 블러 채택, 벗어나면
잎 노드(각 `KvScene`·오버레이에 개별 filter) 적용으로 선회한다. 선회해도
스키마·도메인·UI는 동일하고 §4.2의 적용 지점만 바뀐다.

## 5. UI — `KvLoopInspector.tsx`

"모션 · 전환" 섹션에 다음이 더해지고, 나머지는 그대로다.

| 컨트롤 | 형태 | 비고 |
|---|---|---|
| 왕복 | 체크박스 "왕복 (들어갔다 나오기)" | 루프 전체(D-02). 켜면 정점이 각 장 중앙이라는 힌트 표기 |
| 크로스페이드 | 기존 `PlainField`, `min=0` | 0일 때 힌트 "0 = 컷" |
| 시작·끝 블러 길이 | `PlainField` ms, 0~1000 | 힌트에 현재 fps 기준 프레임 수 병기 (D-07) |
| 시작·끝 블러 세기 | `PlainField` px, 0~100 | |
| 마지막 페이드아웃 | 변화 없음 | 기본값만 0 (D-06) |

`updateKvLoopSettings`의 `KvLoopPatch`가 `roundTrip`·`blurDurationMs`·
`blurAmountPx`를 얻고, `transitionMs`의 하한 클램프가 0이 된다(스키마와 동일
경계 — 두 곳이 함께 바뀌어야 한다, Plan §6.2).

## 6. Error Handling

새 에러 코드 없음. 모든 새 값은 클램프로 교정되는 연속량이고, 불가능한 조합이
존재하지 않는다(블러 상한은 겹침 불가 — §3.3).

## 7. Test Plan

### 7.1 Unit

| 파일 | 검증 |
|---|---|
| `motion.test.ts` | 왕복 해석: easing 강제, roundTrip=false 시 기존과 동일 객체 형태 |
| `project.test.ts`(kvLoopCommands) | 스키마 기본값 — 필드 없는 저장 문서가 꺼짐으로 파싱, 새 기본값 표(§2.3), transitionMs=0 허용, 클램프 경계 |
| `KvScene` 계열(기존 관례에 따라 컴포지션 단위 테스트가 있으면) | 3지점 진행도: N=150에서 f0=0, f74.5 정점 대칭, f149=0 |

### 7.2 E2E (코덱 불필요)

`kv-motion.spec.ts`의 `sceneTransform` 방식으로:
- 왕복 켠 뒤 정점 프레임과 마지막 프레임의 transform 문자열 비교 (같은 scale로 복귀)
- 크로스페이드 0에서 인접 세그먼트에 opacity 전환이 없음
- 시작 프레임에서 북엔드 컨테이너의 filter 문자열, 본편 프레임에서 부재 (NFR-R01)

### 7.3 실기기 게이트 (이 환경 판정 불가 — Plan §4.3)

SC1~SC6: H.264 MP4를 뽑아 Plan §1.3과 동일한 프레임 실측. 이 사이클의 종료
게이트다.

## 8. Architecture Compliance

- `domain`은 Remotion을 임포트하지 않는다 — 왕복은 boolean으로 전달되고 3지점
  interpolate는 컴포지션에서 구성한다 (kv-motion-effects와 같은 분리).
- 스키마가 상수를 constants에서 읽는다 (§2.2).
- 템플릿 커맨드는 외부 템플릿에서 no-op (기존 `mapKvLoop` 경유).

## 9. Implementation Order

| M | 내용 | 게이트 |
|---|---|---|
| M0 | 컨테이너 블러 스파이크 (§4.3) | 두 경로 시각 등가 → 적용 지점 확정 |
| M1 | 스키마·상수·기본값·커맨드 (§2, §5의 패치) | 단위 테스트 |
| M2 | KvScene 왕복 + KvLoopComposition 북엔드 (§3, §4) | 단위 + E2E |
| M3 | 인스펙터 UI (§5) | E2E controls |
| M4 | 실기기 렌더 실측 + 강도 검수(D-10) | SC1~SC7 |
| M5 | `benchmark:render` 전후 비교 | NFR-R02 (5% 이내) |

## 10. Requirement Traceability

| FR | 설계 위치 |
|---|---|
| FR-R01/R02/R05 | §3.1, §3.2 |
| FR-R03 | §3.2 (마지막 프레임 진행도 0) |
| FR-R04 | §3.1 (resolveKvMotion 이후 합성) |
| FR-R06/R07 | §2.1, §2.3 |
| FR-R08/R09/R11 | §2.1, §4.2, §5 |
| FR-R10 | §4.2 오버스캔 |
| FR-R12 | §2.1 `.default()` + SC6 |
| FR-R13 | §4.3 M0 + §7.3 |

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-26 | 김성권 / Claude | 최초 작성 — D-01~D-11 확정과 레퍼런스 실측 반영 |
