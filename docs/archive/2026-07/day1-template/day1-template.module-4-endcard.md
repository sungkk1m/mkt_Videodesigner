# Day1 Template — Module 4 Evidence: End Card

> **Feature**: day1-template
> **Module**: 4 — `EndCardScene` + 아이콘 애니메이션 프리셋
> **Date**: 2026-07-28
> **Design**: [day1-template.design.md](day1-template.design.md) §4.3, §5.3
> **선행**: [module-1](day1-template.module-1-schema.md) ✅ · [module-2](day1-template.module-2-domain.md) ✅ · [module-3](day1-template.module-3-composition.md) ✅

---

## 1. What Shipped

| 파일 | 상태 | 내용 |
|------|:----:|------|
| [day1/EndCardScene.tsx](../../../../src/compositions/day1/EndCardScene.tsx) | 신규 | 배너 배경 + 아이콘 오버레이 2레이어, 프리셋 7종 |
| [domain/day1/endCard.ts](../../../../src/domain/day1/endCard.ts) | 수정 | `placedIconRect` — 16:9 중앙 축퇴 |
| [types.ts](../../../../src/domain/editor/types.ts) | 수정 | `Day1EndCardRenderProps`, `Day1IconAnimation`, `Day1CardMotion`, `Day1Props.endCard` |
| [project.ts](../../../../src/domain/editor/project.ts) | 수정 | `buildDay1Props`가 배너·아이콘 URL 해상 + 아이콘 사각형 확정 |
| [Day1Composition.tsx](../../../../src/compositions/Day1Composition.tsx) | 수정 | 3번째 Sequence의 빈 캔버스 → `EndCardScene` |
| [endCard.test.ts](../../../../src/domain/day1/endCard.test.ts) | 수정 | `placedIconRect` 유닛 4개 |
| [day1Props.test.ts](../../../../src/domain/editor/day1Props.test.ts) | 수정 | 엔드카드 스냅샷 유닛 5개 |

유닛 226 → **236** (+10).

---

## 2. Design 대비 결정과 편차

### 2.1 아이콘 사각형은 컴포지션이 아니라 prop 빌더가 확정한다

Design §4.3의 `appIconRect`는 그대로 두고, 그 위에 `placedIconRect`를 얹었다.
`buildDay1Props`가 `iconAdjust`까지 접어 넣은 최종 사각형을 스냅샷에 담고,
`EndCardScene`은 정규화 좌표에 프레임 크기만 곱한다.

근거: module-3의 `splitLayout`과 같은 패턴이다. **SC5(아이콘 오버레이 ≤ 2px)가
렌더 없이 유닛으로 판정된다**는 것이 핵심 이득이다.

### 2.2 16:9 축퇴 좌표를 domain에 뒀다 — Design §4.3 보강

Design §4.3은 "인스펙터가 ... 화면 중앙을 기본값으로 준다"고 썼다. 인스펙터는
module-5인데 module-4의 컴포지션이 이미 16:9를 그려야 해서, 중앙 사각형을
`placedIconRect`에 넣고 domain을 단일 출처로 삼았다. module-5 인스펙터는 같은
함수를 부르면 되고, "자동 배치 없음" 안내는 `appIconRect(ratio) === null`로
판별한다 — `appIconRect`의 null 계약을 남겨둔 이유다.

축퇴 사각형은 **짧은 변의 40% 정사각형, 라디우스는 변의 18%**다. 실제 두 레이아웃이
쓰는 값(515/1080 = 47.7%, 680/1080 = 63.0% / 라디우스 18.6%, 17.6%)에서 잡았다.
bannerdesigner에 16:9가 생기면 이 경로는 자동으로 안 타게 된다.

### 2.3 `pop`의 실측 정점은 1.12가 아니라 1.126이다

Design §5.3은 `spring()`으로 1.0 → 1.12 → 1.0이라고 썼다. 구현은 spring이 상승을
맡고 선형 감쇠가 복귀를 맡는 2단 구성인데, spring이 1을 살짝 넘겨 정점이 1.126으로
나온다. **제약(scale ≥ 1)은 위반하지 않으므로** 진폭 상수를 깎지 않았다.

### 2.4 `pulse`는 sin이 아니라 cos 기반이다

Design §5.3은 "`interpolate(sin)`"이라고 썼다. sin은 frame 0에서 기울기가 최대라
구간 시작에 아이콘이 튀어 오른다. `(1 − cos)/2`를 쓰면 0에서 값과 기울기가 모두 0이라
정지 상태에서 부드럽게 들어간다. `glow`도 같은 파형을 쓴다.

### 2.5 배너가 없으면 빈 캔버스다

Design §5.3의 레이어는 배너·아이콘 둘뿐이다. 업로드 전 안내 문구는 module-5
인스펙터 몫이라 컴포지션에는 넣지 않았다. FR-D03 렌더 차단은 **패널 2개**에만
걸리고 엔드카드 배너에는 걸리지 않는다 — Plan·Design 어디에도 배너를 필수로
둔 문언이 없다. module-5에서 사용자 판단을 받을 항목이다.

---

## 3. 검증

### 3.1 아이콘 정합 (SC5) — 프리뷰 레벨

bannerdesigner의 9:16 좌표(left 200 / top 820 / 680×680 / radius 120)에 **빨간
아이콘을 구워 넣은** 합성 배너를 만들고, 그 위에 같은 크기의 **청록 아이콘**을
오버레이했다. 어긋나면 빨간 테두리가 드러난다.

frame 0(정지 상태) 스크린샷에서 **빨간 픽셀이 한 줄도 보이지 않는다.** 좌표
파이프라인(CSS 상수 → `normalize` → `placedIconRect` → `rect × 프레임 크기`)이
왕복 손실 없이 붙는다.

> 렌더 결과물 픽셀의 ≤ 2px 측정은 module-6 E2E 담당이다. 여기서 확인한 것은
> 프리뷰 DOM 레벨까지다.

### 3.2 프리셋 7종 — Player 실측

`useCurrentFrame` 기반이라 재생 중 computed style을 샘플링해 판정했다.

| 프리셋 | 실측 | Design 기대 | |
|---|---|---|:--:|
| `pop` | 1.0 → **1.126** → 1.0 | 1.0 → 1.12 → 1.0 | ✅ |
| `pulse` | 1.0 ↔ **1.059** 반복 | 1.0 ↔ 1.06 | ✅ |
| `glow` | transform 없음, alpha **0.157 → 0.55 →** 감쇠 | 발광만, 변형 없음 | ✅ |
| `none` | 오버레이 DOM 자체가 없음 | 배너 원본 그대로 | ✅ |
| `ken-burns` | 배너 scale **1.003 → 1.039** 단조 증가 (180프레임 종점 1.06) | 슬로우 줌 | ✅ |
| `fade` | 배너 opacity **0.083 → 1** (~0.4초) | 페이드 인 | ✅ |
| `none` (카드) | transform 없음, opacity 1 | 모션 없음 | ✅ |

**전 구간에서 아이콘 scale이 1 미만으로 내려간 샘플이 없다.** 배너에 구워진
아이콘이 드러나지 않는다는 Design §5.3 제약이 실제로 지켜진다.

검증에 쓴 Player 하네스는 `EditorWorkspace`를 임시로 고쳐 만든 것이고
**측정 후 원본으로 되돌렸다** (`git diff` 없음 확인). Day1 경로가 앱에 붙는 것은
module-5·6이다.

### 3.3 회귀 (SC3)

```
npx tsc -b            passed
npm test              26 files / 236 tests   passed
npm run build         tsc -b + vite build    passed
npm run test:e2e      18 tests               passed
```

아키텍처 경계 유지: `domain/day1/endCard.ts`는 `RATIO_DIMENSIONS`(값)만 새로
가져오고 — `layout.ts`가 이미 쓰던 경로다 — React·Remotion은 여전히 임포트하지
않는다. `types.ts` → `domain/day1/endCard`는 `import type`이라 런타임 순환이 없다.

### 3.4 유닛 10개

| 검증 | |
|------|:--:|
| `placedIconRect`가 1:1·9:16에서 `appIconRect`와 동일 | ✅ |
| 16:9 축퇴가 정사각형이고 프레임 중앙 | ✅ |
| 축퇴에도 dx·dy·scale이 적용됨 | ✅ |
| 축퇴가 정지 상태에서 프레임 안에 들어옴 | ✅ |
| 배너·아이콘 URL 해상, 프리셋 전달 | ✅ |
| 미업로드 레이어는 `url: null` | ✅ |
| 선택 규격의 bannerdesigner 좌표 적용 (1:1·9:16) | ✅ |
| 16:9는 중앙 축퇴 사각형 | ✅ |
| `iconAdjust`가 사각형에 접혀 들어감 | ✅ |
| `endCard` 스냅샷 deep-freeze | ✅ |

---

## 4. Next — module-5

module-4에서 열어둔 것:

- **배너 미업로드 시 안내 없음** → module-5 인스펙터. 렌더 차단 여부는 사용자 판단
- **16:9 "자동 배치 좌표 없음" 안내** → module-5. `appIconRect(ratio) === null`로 판별
- **배너·아이콘 Dropzone, 미세조정 슬라이더, 프리셋 선택 UI** → module-5 (Design §6.3)
- **렌더 결과물의 ≤ 2px 정합 측정(SC5)** → module-6 E2E
- **`renderEditor.ts` 템플릿 분기 없음** → module-6. Day1은 아직 렌더 큐에 못 들어간다

```bash
/pdca do day1-template --scope module-5
```
