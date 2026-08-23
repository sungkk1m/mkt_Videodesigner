# Key Visual Motion Effects Planning Document

> **Summary**: 키비주얼 루핑의 모션을 Ken Burns 단일 효과에서 프리셋 + 영역 지정 방식으로 넓힌다
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-23
> **Status**: Draft — awaiting decisions in §1.3

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 루핑 템플릿의 모션은 KV별 `kenBurns: boolean` 하나다. 켜면 항상 같은 방향(중앙 기준 줌 인)이고, 폭도 스케일 1.0→1.08(강도 100% 기준)로 묶여 있다. 실사용 강도 50%에서는 2.5초에 1.000→1.040, 1080px 폭에서 총 43px이라 "효과가 걸렸는지 모르겠다"에 가깝다. 방향·대상 영역·세기를 고를 수 없으므로, 캐릭터 얼굴로 밀고 들어가거나 배경에서 빠지는 식의 의도된 카메라 워크가 불가능하다. |
| **Solution** | KV 슬롯의 모션을 불리언에서 **모션 스펙**으로 넓힌다. 프리셋(정지 / 줌 인 / 줌 아웃 / 팬)으로 대부분을 덮고, 그 위에 미리보기 프레임에서 **시작 사각형 → 끝 사각형을 드래그로 지정**하는 경로를 둔다. 고전적 Ken Burns가 정확히 "사각형 A에서 B로"이므로, 현재의 줌 인은 새 모델의 한 특수해가 된다. |
| **Function/UX Effect** | 사용자는 KV를 고르고 프리셋을 누르면 끝난다. 더 정확히 잡고 싶을 때만 미리보기 위에서 시작·끝 영역을 끌어 지정하고, 그 두 사각형이 그대로 카메라 워크가 된다. 강도 슬라이더는 프리셋의 폭을 조절하고, 드래그로 지정한 경우에는 사각형이 폭을 정하므로 비활성된다. |
| **Core Value** | 지금 외부 편집 도구에서 하던 "어디를 보여주며 어떻게 움직이는지"를 브라우저 안으로 가져온다. 언어별 배치 렌더의 이점을 유지하면서, 레퍼런스 영상의 카메라 워크를 근사가 아니라 그대로 재현할 수 있게 된다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 모션이 사실상 하나뿐이고 폭이 좁아서, 루핑 결과물이 레퍼런스의 카메라 워크를 재현하지 못한다. 소재를 교체해 반복 생산하는 이점은 이미 확보됐으므로, 다음 병목은 "무엇을 어떻게 보여주는가"다. |
| **WHO** | 사내 UA Manager와 마케터. 루핑 템플릿을 이미 쓰는 사용자와 동일하다. |
| **RISK** | ① 스케일 상한 1.08은 매 프레임 리샘플 비용을 이유로 의도적으로 정한 값이므로(looping design §162), 넓히려면 렌더 시간을 다시 재야 한다. ② 브라우저 렌더러가 CSS 전부를 지원하지 않는다 — 미리보기에서는 보이고 MP4에서는 빠지는 효과가 존재한다(§1.2.2). ③ 스키마 변경이 저장된 프로젝트를 깨뜨릴 위험. |
| **SUCCESS** | 3장 이상의 KV에 서로 다른 프리셋을 걸어 9:16 MP4를 뽑고, 프레임 단위 측정으로 각 KV가 지정한 방향·폭으로 움직이는 것이 확인되며, 드래그로 지정한 시작·끝 영역이 렌더 프레임의 해당 영역과 일치한다. 저장된 기존 루핑 프로젝트가 마이그레이션 없이 열리고 이전과 같은 결과를 낸다. 렌더 시간이 성능 게이트(§4.3) 안에 있다. |
| **SCOPE** | 렌더러 능력 확정 → 모션 스펙 스키마·도메인 → 컴포지션 적용 → 프리셋 UI → 드래그 영역 지정 UI → 렌더·성능 측정 순. 드래그 UI는 프리셋이 실제 렌더로 검증된 뒤에 착수한다. |

---

## 1. Overview

### 1.1 Purpose

키비주얼 한 장에 걸리는 모션을 선택 가능하게 만들고, 그 모션이 이미지의 **어느 영역**을 어떻게 지나가는지 지정할 수 있게 한다.

### 1.2 Background

#### 1.2.1 지금 무엇이 있는가

모션 전체가 두 값에 담겨 있다.

| 위치 | 값 | 의미 |
|---|---|---|
| [schema.ts `kvSlotSchema`](../../../src/domain/editor/schema.ts) | `kenBurns: boolean` | KV별 on/off |
| [schema.ts `kvLoopSettingsSchema`](../../../src/domain/editor/schema.ts) | `kenBurnsIntensity: 0~1` | 루프 전체 공통 세기 |
| [constants.ts](../../../src/domain/editor/constants.ts) | `KV_LOOP_MAX_KEN_BURNS_SCALE = 1.08` | 강도 1.0에서의 스케일 상한 |

적용 지점은 [`KvScene.tsx`](../../../src/compositions/kvloop/KvScene.tsx) 한 곳이고, 홀드 구간에 걸쳐 `scale`을 1에서 상한까지 선형 보간한다. 방향·중심·이징은 선택할 수 없다.

2026-08-23 실제 렌더 파일(3장·15초·60fps·2회·강도 50%)을 프레임 단위로 측정한 결과, 움직이는 KV의 인접 프레임 차이는 rms 1.6~2.2(255 스케일)였다. 눈에 보이기는 하지만, "카메라가 움직인다"고 느낄 수준은 아니다.

부수적으로 확인된 것: `kenBurns`가 불리언이라 **꺼진 상태가 의도인지 실수인지 구분되지 않는다.** 같은 렌더에서 KV2만 정지 상태였고(인접 프레임 125쌍 중 109쌍이 바이트 단위 동일), 원인은 우측 패널이 항상 KV1을 편집하던 선택 버그(`fix/kv-loop-selection`에서 수정)와 얽혀 있었다. 프리셋에 "정지"를 명시적 선택지로 두면 이 모호함이 사라진다.

#### 1.2.2 렌더러가 무엇을 허용하는가 — 측정 결과

이 결정이 설계 범위를 정하므로 먼저 확정한다. `@remotion/web-renderer`는 두 경로로 DOM을 래스터화한다. Chrome의 네이티브 HTML-in-canvas(`drawElementImage`)가 있으면 그것을, 없으면 Remotion 자체 래스터라이저(`dist/drawing/`, 모듈 38개)를 쓴다. **후자가 지원 범위의 하한이므로 여기에 맞춰야 한다.**

| 기능 | 지원 | 근거 |
|---|---|---|
| `transform` (2D·3D, `transform-origin`) | ✅ | `style.transform` 읽기 12곳, `handle-3d-transform`·`parse-transform-origin` 모듈 |
| `filter` 전체 | ✅ | CSS 문자열을 `ctx.filter`에 그대로 대입 → Chrome의 `blur` `brightness` `contrast` `grayscale` `hue-rotate` `invert` `saturate` `sepia` `drop-shadow` 전부 |
| `opacity` | ✅ | `opacity` 모듈, 현재 크로스페이드가 이미 사용 |
| `clip-path` / `mask-image` | ✅ | `clip-path`·`mask-image`·`handle-mask` 모듈, `style.maskImage` 읽기 3곳 |
| `border-radius` / `box-shadow` / `outline` / `overflow` | ✅ | 전용 모듈 |
| `linear-gradient` 배경 | ✅ | `parse-linear-gradient` 모듈 |
| `object-fit` | ✅ | `calculate-object-fit` 모듈, 현재 `cover`/`contain`이 사용 |
| `<canvas>` · `<img>` · `<video>` 요소 | ✅ | `instanceof HTMLCanvasElement` / `HTMLImageElement` / `HTMLVideoElement` 분기 존재 → WebGL·2D 캔버스로 그린 레이어도 렌더에 들어간다 |
| **`mix-blend-mode`** | ❌ | 번들에 흔적 없음 |
| **`backdrop-filter`** | ❌ | 번들에 흔적 없음 |

**결론**: 카메라 워크(transform), 컬러 그레이딩·블러(filter), 도형 와이프(clip-path), 라이트 스윕(mask-image + gradient)까지 전부 가능하다. 미지원 두 개는 Player 미리보기에서는 보이고 MP4에서는 무시되는 최악의 불일치를 만들므로 **금지 목록으로 문서화한다.**

### 1.3 Decisions Needed Before Design

설계 착수 전에 사용자 확인이 필요한 항목이다. Plan을 여기서 멈추는 이유다.

| # | 질문 | 선택지 | 기본 제안 |
|---|---|---|---|
| D-01 | 스케일 상한 1.08을 넓히는가 | (a) 유지 (b) 1.15~1.20으로 넓히고 렌더 시간 재측정 (c) 드래그 지정 시에만 상한 해제 | **(b)** — 43px은 의도가 전달되지 않는다. 성능 게이트로 방어한다 |
| D-02 | 프리셋 범위 | (a) 정지·줌 인·줌 아웃 (b) + 팬 4방향 (c) + 회전·기울기 | **(b)** — 레퍼런스 6본에 회전은 없다 |
| D-03 | 이징 | (a) 선형 고정 (b) 프리셋별 고정값 (c) 사용자 선택 | **(b)** — 선택지를 늘려도 결과 차이를 예측하기 어렵다 |
| D-04 | 모션 스코프 | (a) KV별만 (b) 루프 전체 기본값 + KV별 오버라이드 | **(b)** — 4~8장에 같은 프리셋을 하나씩 지정하는 것은 작업이다 |
| D-05 | 드래그 영역 지정 범위 | (a) 시작·끝 사각형 둘 다 (b) 끝 사각형만(시작은 전체 화면) | **(a)** — 절반만 지정하면 "얼굴에서 전경으로" 같은 워크가 안 된다 |
| D-06 | 컬러·블러 효과를 이번에 포함하는가 | (a) 모션만 (b) 모션 + 컬러 그레이딩 (c) 전부 | **(a)** — 모션이 요청의 핵심이고, filter 계열은 독립적으로 얹을 수 있다 |

### 1.4 Related Documents

| Document | Relevance |
|---|---|
| [key-visual-looping.plan.md](key-visual-looping.plan.md) | 루핑 템플릿의 원 계획. FR-L09가 Ken Burns |
| [key-visual-looping.design.md](../../02-design/features/key-visual-looping.design.md) | §5.2 `KvScene`, §6.3 인스펙터, §162 스케일 상한 근거 |
| [key-visual-looping.module-5-e2e.md](../../03-analysis/key-visual-looping.module-5-e2e.md) | §1.2 이 컨테이너에서 MP4 렌더가 불가능한 이유(코덱) |

---

## 2. Scope

### 2.1 In Scope

| # | 항목 | 비고 |
|---|---|---|
| S-01 | `kvSlotSchema`에 모션 스펙 추가 | `.default()`로 기존 문서 파싱 유지 |
| S-02 | `kenBurns: boolean` → 모션 프리셋 이관 | 기존 `true`는 "줌 인", `false`는 "정지"로 읽는다 |
| S-03 | `KvScene`의 모션 적용부 재작성 | 시작·끝 사각형을 transform으로 환산 |
| S-04 | 인스펙터 프리셋 UI | KV별 + 루프 기본값(D-04) |
| S-05 | 미리보기 위 드래그 영역 지정 | 시작·끝 사각형, 정규화 좌표 |
| S-06 | 렌더 성능 재측정 | `npm run benchmark:render` |
| S-07 | 금지 CSS 목록 문서화 | `mix-blend-mode`·`backdrop-filter` |

### 2.2 Out of Scope

- 3장면·Day1 템플릿의 모션. 이 계획은 `kv-loop`만 건드린다.
- 컬러 그레이딩·블러·와이프 전환 (D-06에서 (a)를 택하는 경우). 렌더러가 지원한다는 것만 §1.2.2에 기록해 둔다.
- KV별 다른 크로스페이드 길이. 전환은 루프 공통으로 남는다.
- 키프레임 편집(3개 이상의 지점). 시작·끝 두 사각형까지다.

### 2.3 Prerequisite

- `fix/kv-loop-selection` 머지. 우측 패널이 선택된 KV를 실제로 편집하지 않으면 KV별 모션 지정은 검증할 수 없다.
- 시스템 Chrome이 있는 기기. 이 컨테이너는 H.264 인코드가 없어 MP4 렌더 검증이 불가능하다.

---

## 3. Requirements (초안)

### 3.1 Functional

| ID | 요구사항 |
|---|---|
| FR-M01 | KV별로 모션 프리셋을 고를 수 있다. 최소 정지·줌 인·줌 아웃 |
| FR-M02 | 루프 전체 기본 프리셋을 두고, KV별로 덮어쓸 수 있다 (D-04) |
| FR-M03 | 미리보기 프레임 위에서 시작·끝 사각형을 드래그로 지정할 수 있다 |
| FR-M04 | 지정한 사각형은 출력 비율(9:16)로 종횡비가 고정된다 — 그렇지 않으면 렌더에서 왜곡된다 |
| FR-M05 | 사각형이 이미지 밖으로 나가면 거부하거나 클램프한다. 빈 화면이 보이면 안 된다 |
| FR-M06 | 강도 슬라이더는 프리셋의 폭을 조절하고, 사각형 지정 시에는 비활성 + 이유 표시 |
| FR-M07 | 저장된 기존 루핑 프로젝트는 마이그레이션 없이 열리고 이전과 동일한 결과를 낸다 |
| FR-M08 | Player 미리보기와 MP4 렌더가 같은 모션을 낸다 |

### 3.2 Non-Functional

| ID | 요구사항 |
|---|---|
| NFR-M01 | 15초·60fps·KV 4장 렌더 시간이 현행 대비 20% 이내 증가 |
| NFR-M02 | 드래그 조작이 60fps 미리보기를 끊지 않는다 |

---

## 4. Success Criteria

### 4.1 Definition of Done

| SC | 판정 방법 |
|---|---|
| SC1 | KV 3장에 서로 다른 프리셋(줌 인 / 정지 / 줌 아웃)을 걸어 렌더한 MP4에서, 각 홀드의 프레임 단위 누적 변화가 지정한 방향·폭과 일치한다 |
| SC2 | 드래그로 지정한 끝 사각형의 내용이 해당 홀드 마지막 프레임의 화면과 일치한다 |
| SC3 | 저장된 기존 루핑 프로젝트를 열어 렌더한 결과가 변경 전과 프레임 단위로 동일하다 |
| SC4 | 미리보기에서 스크럽한 프레임과 렌더된 같은 프레임이 일치한다 (FR-M08) |
| SC5 | 기존 500건 단위 테스트와 루핑 controls E2E가 회귀 없이 통과한다 |

### 4.2 Performance Gate

`npm run benchmark:render`로 변경 전후를 측정한다. NFR-M01을 넘으면 스케일 상한(D-01)을 되돌린다. 측정 없이 상한을 넓히지 않는다 — 1.08은 근거가 있는 값이다.

---

## 5. Risks and Mitigation

| 위험 | 영향 | 완화 |
|---|---|---|
| 스케일을 넓혀 렌더가 느려진다 | 배치 렌더 시간 증가 | §4.2 게이트. 넓히기 전후를 반드시 측정 |
| 미리보기와 렌더의 모션 불일치 | 사용자가 결과를 신뢰할 수 없다 | 금지 CSS 목록 준수 + SC4 |
| 스키마 변경이 저장 문서를 깨뜨린다 | 기존 프로젝트 유실 | `.default()` 방식(엔드카드 비디오 필드 선례) + SC3 |
| 드래그 사각형의 종횡비 실수 | 렌더에서 이미지 왜곡 | FR-M04로 종횡비 고정 |
| 이 환경에서 MP4 검증 불가 | SC1·SC2·SC3를 여기서 판정할 수 없다 | 시스템 Chrome 기기에서의 실행을 종료 게이트로 명시 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| 파일 | 변경 |
|---|---|
| `src/domain/editor/schema.ts` | `kvSlotSchema`에 모션 스펙 추가 |
| `src/domain/editor/project.ts` | 모션 커맨드, 기본값, `buildKvLoopProps` |
| `src/domain/editor/types.ts` | `KvSlotRenderProps`에 모션 필드 |
| `src/compositions/kvloop/KvScene.tsx` | 모션 적용부 재작성 |
| `src/features/editor/KvLoopInspector.tsx` | 프리셋 UI |
| `src/features/editor/EditorWorkspace.tsx` | 미리보기 위 드래그 오버레이 배선 |
| 신규 | 드래그 사각형 컴포넌트 |

### 6.2 Current Consumers

`kenBurns`를 읽는 곳은 `KvScene`·`buildKvLoopProps`·`KvLoopInspector`·`setKvKenBurns` 네 곳뿐이다. `kvLoopMissingImages`·`kvLoopRestoreTargets`·타임라인은 모션을 모른다.

### 6.3 Verification

단위 테스트는 모션 스펙 → transform 환산 함수에 집중한다(순수 함수, 기존 `domain/kvloop/` 테스트 관례). 드래그 UI는 E2E, 렌더 일치는 프레임 샘플링. 드래그 UI의 E2E는 마우스 조작이므로 코덱 없이 실행 가능하다.

---

## 7. Next Steps

1. §1.3의 D-01~D-06 결정
2. 결정에 따라 Design 문서 작성 — 모션 스펙 형태와 사각형 → transform 환산식
3. 모듈 분해 및 착수

---

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-23 | 김성권 / Claude | 최초 작성. 렌더러 지원 범위 실측 결과 포함 |
