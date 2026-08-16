# Day1 Trim UX Planning Document

> **Summary**: Day1 패널의 트리밍을 숫자 입력에서 썸네일 스트립 + 드래그 창으로 바꾸고, 소스가 구간보다 짧을 때의 무음 실패를 경고와 렌더 차단으로 드러낸다
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-15
> **Status**: Draft — awaiting Design

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Day1 패널의 트리밍은 초 단위 숫자 입력 두 개가 전부다. 75초 촬영본에서 쓸 만한 6초를 고르려면 외부 플레이어로 먼저 보고 숫자를 받아 적어야 한다. 트리밍 로직 자체는 정상이고(`reconcileTrim` 렌더까지 실측 검증 완료) 막힌 곳은 **어디를 자를지 앱 안에서 볼 수 없다는 것 하나**다. 여기에 더해 소스가 구간보다 짧으면 경고도 렌더 차단도 없이 검은 화면이 담긴 MP4가 그대로 나간다. |
| **Solution** | 패널 인스펙터에 원본 전체를 가로지르는 썸네일 스트립을 깔고, 그 위에 구간 길이만큼의 트림 창을 겹쳐 드래그로 옮긴다. `reconcileTrim`이 이미 고정 길이 창을 슬라이드시키는 구조이므로 UI가 도메인을 그대로 비춘다. 짧은 소스는 3장면 경로에 이미 있는 경고를 Day1로 이식하고, `preflightIssues`에 렌더 게이트를 붙인다. |
| **Function/UX Effect** | 사용자는 패널을 펼치면 75초를 한눈에 훑고, 창을 끌어 구간을 맞추고, 확대된 시작 프레임으로 구도를 확인한 뒤 그대로 렌더한다. 외부 플레이어 왕복이 사라진다. 소스가 짧으면 렌더 버튼 앞에서 막히고, 구간을 줄이라는 안내를 받는다. |
| **Core Value** | 트리밍이 "감으로 숫자를 넣고 렌더해서 확인"에서 "보고 고르는" 작업이 된다. 동시에 검은 화면이 담긴 소재가 광고로 나가는 경로가 닫힌다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Day1 트리밍의 병목은 로직이 아니라 가시성이다. 앱 안에서 소스를 보고 자를 수 있게 만들고, 조용히 실패하던 짧은 소스 케이스를 드러낸다. |
| **WHO** | Day1 템플릿으로 비교 영상을 만드는 사내 UA Manager·마케터. 긴 촬영본에서 짧은 구간을 골라내는 것이 일상 작업이다. |
| **RISK** | 썸네일 샘플링 코드를 hook-analysis에서 분리하다 검증된 Hook 분석을 회귀시킬 위험, 스트립의 픽셀 해상도가 0.1초 정밀도에 못 미치는 점, canvas·video를 쓰는 UI라 jsdom 유닛 테스트가 불가능한 점. |
| **SUCCESS** | 75초 소스에서 스트립을 보고 창을 끌어 고른 지점이 실제 MP4 출력 시작점과 일치하고, 4초 소스를 6초 구간에 넣으면 경고와 함께 렌더가 막히며, 구간을 줄이면 해소된다. 기존 유닛·E2E 전량이 통과한다. |
| **SCOPE** | 썸네일 샘플링 분리 → 창↔시각 변환 도메인 함수 → 스트립·창 UI → 확대 프레임 → 짧은 소스 경고·렌더 게이트 순으로 진행한다. Day1 패널에만 적용하고 3장면은 다음 사이클로 둔다. |

---

## 1. Overview

### 1.1 Purpose

Day1 패널의 소재 트리밍을 숫자 입력에서 시각적 선택으로 바꾼다. 부수적으로, 소스가 구간보다 짧을 때의 무음 실패를 사용자가 볼 수 있는 실패로 바꾼다.

### 1.2 Background

**직전 세션 실측 결과**가 이 Plan의 출발점이다.

**트리밍 로직은 정상이다.** [timeline.ts:109](../../../../src/domain/timeline/timeline.ts:109) `reconcileTrim`은 `windowMs = min(구간 길이, 원본 길이)`인 고정 길이 창을 원본 위에 슬라이드시킨다. 75초 소스로 렌더까지 검증했다 — Trim In 40 → 출력 0.2s가 소스 40.1s, 출력 5.8s가 소스 45.8s.

**막힌 곳은 UI다.** [Day1Inspector.tsx:155-177](../../../../src/features/editor/Day1Inspector.tsx:155)이 트리밍 UI의 전부다. `SecondsField` 두 개(`day1-a-trim-in` / `day1-a-trim-out`)와 힌트 `day1-a-trim-range`. 소스를 보여주는 요소가 하나도 없다.

여기서 **현재 UI가 도메인을 잘못 비추고 있다**는 점이 드러난다. `reconcileTrim`은 Out을 `inMs + windowMs`로 계산하므로 사용자가 실제로 조작하는 값은 In 하나다. 그런데 UI는 독립적인 입력 필드 두 개로 보여준다. Out에 입력해도 반영되지 않는다.

**짧은 소스는 조용히 실패한다.** 4초 소스를 6초 구간에 넣으면 4초 이후 패널이 검게 빈다 — 정지도 루프도 아니다. 픽셀 실측: 출력 1.0s는 `28,46,62` / 4.5s와 5.8s는 `9,11,15`. 인스펙터 힌트에는 "구간 6.00s · 원본 4.00s"로 숫자만 나온다.

### 1.3 사전 조사에서 확인한 재사용 자산

착수 비용을 크게 낮추는 사실들이다. Design 단계에서 이 자산들을 어떻게 쓸지 결정한다.

| 자산 | 위치 | 관련성 |
|------|------|--------|
| 프레임 샘플러 | [heuristicHookAnalyzer.ts:150-186](../../../../src/infrastructure/hook-analysis/heuristicHookAnalyzer.ts:150) | 숨은 `<video>` seek → canvas `drawImage` → `toDataURL('image/jpeg', 0.6)`. 썸네일 생성기가 이미 동작 중이다. 다만 스코어링·워커·오디오 분석과 한 함수에 묶여 있어 분리가 필요하다 |
| 필름스트립 UI | [HookCandidateDrawer.tsx:124-170](../../../../src/features/editor/HookCandidateDrawer.tsx:124) | `hook__strip` 클래스로 썸네일 `<img>` 목록 + 수동 range 슬라이더. 소스에서 시작점을 고르는 UI 패턴과 CSS가 이미 있다 |
| 짧은 소스 경고 문구 | [SceneInspector.tsx:167-172](../../../../src/features/editor/SceneInspector.tsx:167) | 3장면 경로는 `isTrimShorterThanScene`으로 "원본이 장면보다 짧아 남은 시간은 검은 화면으로 출력됩니다"를 이미 띄운다. Day1Inspector에만 이 블록이 없다 |
| 렌더 프리플라이트 게이트 | [useRenderQueue.ts:78-105](../../../../src/features/editor/useRenderQueue.ts:78) | `preflightIssues`가 프로젝트 내용 기반으로 렌더를 막는다. Day1은 이미 `day1MissingPanels`로 분기 중이라 붙일 자리가 명확하다 |
| Day1 도메인 감지 함수 | [project.ts:1056](../../../../src/domain/editor/project.ts:1056) `day1MissingPanels` | 새 감지 함수를 바로 옆에 같은 형태로 추가한다 |
| 경계 드래그 상호작용 | [Timeline.tsx:132-175](../../../../src/features/editor/Timeline.tsx:132) | 포인터 드래그 + 키보드 방향키 조작 패턴. 트림 창 드래그가 따를 선례이자 접근성 기준 |

### 1.4 사전 조사에서 정정한 사항

착수 배경에는 "`scenesShorterThanSource`가 UI 미연결"이라고 적혀 있었고 그 자체는 맞다. 다만 이것이 **사용자에게 보이는 결과**로 이어지지는 않는다는 점을 조사 중 확인했다.

- `scenesShorterThanSource`([project.ts:1095](../../../../src/domain/editor/project.ts:1095))는 프로젝트 단위 집계 함수이고, 테스트에서만 참조되는 것이 맞다.
- 그러나 3장면 인스펙터는 이 집계를 거치지 않고 `isTrimShorterThanScene`을 **직접** 호출해 경고를 띄운다([SceneInspector.tsx:114-115, 167-172](../../../../src/features/editor/SceneInspector.tsx:114)).
- 따라서 **경고 UI 자체는 3장면에 이미 존재하고, 누락된 것은 Day1 쪽 패리티**다. 새 문구·새 개념을 설계할 필요가 없어 문제 2의 비용이 당초 예상보다 낮다. 이 사실이 문제 2를 이번 범위에 포함하는 근거가 됐다(D-T02).

### 1.5 Confirmed Product Decisions

Plan 단계에서 사용자 확인을 거친 항목이다. Design 단계에서 뒤집지 않는다.

| # | 결정 | 근거 |
|---|------|------|
| D-T01 | **썸네일 스트립 + 드래그 가능한 트림 창** (스크러버 단독 아님) | 75초를 한눈에 훑을 수 있어야 "좋은 6초 고르기"가 성립한다. 스크러버만으로는 여전히 재생하며 훑어야 한다. 또한 고정 길이 창이 슬라이드한다는 `reconcileTrim`의 실제 구조가 UI에 그대로 드러난다 |
| D-T02 | **문제 2를 이번 범위에 포함하고, 경고 + 렌더 프리플라이트 차단까지 간다** | §1.4에서 경고 문구가 이미 있음을 확인해 이식 비용이 낮다. 검은 화면이 담긴 MP4가 광고로 나가는 것은 경고만으로 막기에 부족하다 |
| D-T03 | **Day1 패널에만 적용. 3장면(SceneInspector)은 다음 사이클** | 3장면도 같은 한계를 갖지만, 검증된 경로를 건드리면 기존 E2E 회귀 위험이 생기고 범위가 약 1.5배가 된다. 공용 컴포넌트로 만들어 두되 배선은 Day1에만 한다 |
| D-T04 | **Trim In 숫자 필드는 유지, Trim Out은 읽기전용 표시로 전환** | Out은 `inMs + windowMs` 종속값이라 입력을 받는 현재 UI가 사용자를 오해시킨다. In은 0.1초 정밀 지정과 키보드 접근을 위해 남긴다(스트립 픽셀 해상도 한계는 §5 참고) |
| D-T05 | **썸네일은 인스펙터 패널을 펼칠 때 지연 생성하고 점진적으로 채운다. 세션 동안 캐시** | 업로드 직후 자동 생성은 트리밍을 안 쓰는 사용자에게도 비용을 물린다. 명시적 버튼은 "보이게 하기"라는 목표를 기본값에서 밀어낸다 |
| D-T06 | **창의 시작 프레임을 스트립 위에 확대 표시한다** | 스트립 칸은 장변 320px 샘플을 수십 px로 줄여 그리므로 구도 판단이 어렵다. "이 6초가 쓸 만한가"를 앱 안에서 판단한다는 목표에 직결된다 |

> **Do 단계 기록 규칙** (직전 사이클 회고 교훈): Do 진행 중 이 표에 없는 결정을 내리면, 그 자리에서 이 표에 행을 추가하고 근거를 남긴다. Check 단계까지 미루지 않는다.

### 1.6 Related Documents

| 문서 | 관계 |
|------|------|
| `docs/archive/2026-07/day1-template/day1-template.plan.md` | Day1 원 사이클 Plan. §2.1의 규격별 분할 레이아웃과 구간 구조가 전제 |
| `docs/archive/2026-07/day1-template/day1-template.design.md` | Day1 설계. 인스펙터 구조와 `sections` 축 공유 방식 |
| `docs/archive/2026-07/day1-template/day1-template.report.md` | 회고 교훈의 출처 |
| `docs/01-plan/conventions.md` | 코딩 컨벤션 |

---

## 2. Scope

### 2.1 In Scope

**트림 스트립 (문제 1 — 주된 목표)**
- 원본 전체를 가로지르는 썸네일 스트립을 Day1 패널 인스펙터에 표시
- 스트립 위에 구간 길이(`windowMs`)만큼의 트림 창을 겹쳐 표시하고 드래그로 이동
- 창 시작 프레임의 확대 표시
- 썸네일 지연 생성 + 점진적 채우기 + 세션 캐시
- 숫자 필드 정리: Trim In 유지(양방향 동기화), Trim Out 읽기전용화
- 키보드 조작 (기존 타임라인 경계 패턴 준용)
- 썸네일 생성 실패 시 숫자 입력 단독으로 축퇴

**짧은 소스 (문제 2)**
- Day1용 짧은 소스 감지 함수 (domain)
- 패널 인스펙터 경고 (3장면 문구 체계 준용)
- `preflightIssues` 렌더 차단 + 해소 방법 안내
- 소스가 구간보다 짧을 때 창은 스트립 전체를 덮고 드래그 비활성

### 2.2 Out of Scope

| 항목 | 사유 |
|------|------|
| 3장면(SceneInspector)에 스트립 적용 | D-T03. 공용 컴포넌트로 만들되 배선은 다음 사이클 |
| 3장면의 짧은 소스 렌더 차단 | 위와 같은 이유. **Day1만 차단되고 3장면은 경고만 남는 비대칭이 생긴다.** 의도된 것이며 다음 사이클에서 해소한다 |
| `scenesShorterThanSource` 집계 함수의 UI 배선 | 인스펙터가 개별 판정을 직접 하므로 집계는 불필요하다. 다음 사이클에서 3장면 렌더 차단을 붙일 때 재검토 |
| 소스 오디오 파형 표시 | 스트립의 시각 정보만으로 이번 목표는 달성된다. 필요해지면 후속 |
| 트림 구간 내 재생 프리뷰 | 스트립 + 확대 프레임으로 대체. Player 재생 경로와 얽혀 범위가 커진다 |
| 창 길이 자체의 조절 | 창 길이는 `reconcileTrim`이 구간 길이에서 파생시킨다. 구간 길이는 기존 타임라인 경계 드래그로 조절한다 |
| Hook 자동 분석을 Day1에 적용 | Day1 원 Plan §2.2에서 이미 범위 밖. 샘플러만 공유하고 스코어링은 가져오지 않는다 |

---

## 3. Requirements

> 직전 사이클 회고 교훈에 따라 §2.1의 모든 범위 항목을 FR로 등재한다. 산문에만 있는 범위 항목을 두지 않는다.

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 |
|----|----------|:--------:|
| FR-T01 | Day1 각 패널 인스펙터에 원본 전체 길이를 가로지르는 썸네일 스트립을 표시한다 | Must |
| FR-T02 | 스트립 위에 `windowMs` 길이의 트림 창을 겹쳐 표시하고, 드래그로 Trim In을 이동한다 | Must |
| FR-T03 | 썸네일은 인스펙터 패널을 펼칠 때 생성을 시작하고, 완성되는 대로 점진적으로 칸을 채운다 | Must |
| FR-T04 | 생성된 썸네일은 세션 동안 소스별로 캐시하고, 패널을 접었다 펴도 재생성하지 않는다 | Must |
| FR-T05 | 창의 시작 프레임을 스트립 위에 확대 표시한다. 드래그 중에는 인접 썸네일로 근사하고, 놓으면 정확한 프레임을 seek한다 | Must |
| FR-T06 | Trim In 숫자 필드를 유지하고 스트립과 양방향 동기화한다 | Must |
| FR-T07 | Trim Out은 입력 필드에서 읽기전용 표시로 바꾼다 | Must |
| FR-T08 | 트림 창을 키보드로 이동한다 (방향키 이동, Shift 조합 큰 폭) | Must |
| FR-T09 | 썸네일 생성이 실패하거나 canvas를 쓸 수 없으면 스트립을 숨기고 숫자 입력만으로 축퇴한다 | Should |
| FR-T10 | 스트립 생성 중에도 인스펙터의 다른 조작(숫자 입력, 프레이밍)이 막히지 않는다 | Must |
| FR-S01 | Day1 패널의 원본이 그 패널의 구간보다 짧은지 판정하는 함수를 domain에 추가한다 (`day1MissingPanels` 옆, 같은 형태) | Must |
| FR-S02 | 짧은 패널이 있으면 해당 패널 인스펙터에 경고를 표시한다. 문구 체계는 3장면 `SceneInspector`를 따른다 | Must |
| FR-S03 | 짧은 패널이 있으면 `preflightIssues`가 렌더를 차단한다 | Must |
| FR-S04 | 차단 문구는 해소 방법(구간 길이를 줄이거나 더 긴 소스를 쓸 것)을 포함하고, 어느 패널인지 지목한다 | Must |
| FR-S05 | 원본이 구간보다 짧으면 트림 창이 스트립 전체를 덮고 드래그가 비활성화된다 | Should |

### 3.2 Non-Functional Requirements

| 항목 | 기준 |
|------|------|
| 응답성 | 썸네일 생성이 메인 스레드를 블록해 인스펙터 조작을 막지 않는다 (FR-T10). 첫 칸은 패널을 펼친 후 1초 안에 나타난다 |
| 회귀 | 기존 유닛 스위트(`src` 하위 테스트 파일 29개)와 E2E 스펙 11개가 전부 통과한다. 특히 `hook-analysis.spec.ts`는 샘플러 분리의 회귀 지표다 |
| 아키텍처 | `src/test/architecture.test.ts` 경계 유지. 프레임 샘플링은 `infrastructure`, 창 위치↔시각 변환은 `domain` 순수 함수, 스트립 UI는 `features` |
| 테스트 가능성 | canvas·video에 의존하지 않는 계산(샘플 시각 배열, 픽셀↔ms 변환, 창 클램프)은 순수 함수로 분리해 유닛 테스트한다. 나머지는 E2E |
| 브라우저 | Chrome 95+ 유지. 기존 Day1 지원 범위를 좁히지 않는다 |
| 접근성 | 창은 키보드로 조작 가능하고 `aria-label`로 현재 위치를 읽을 수 있다 (FR-T08) |

---

## 4. Success Criteria

### 4.1 Definition of Done

| # | 기준 | 검증 방법 |
|---|------|-----------|
| SC1 | 75초 소스에서 스트립이 표시되고 창 드래그로 Trim In이 바뀐다 | E2E — 스트립 렌더 확인 후 창을 드래그하고 `day1-a-trim-in` 값 변화 확인 |
| SC2 | 스트립에서 고른 지점이 실제 MP4 출력 시작점과 일치한다 | 직전 세션 실측 방법 재사용 — 창을 40초 지점에 놓고 렌더한 뒤 출력 0.2s 프레임이 소스 40.1s와 일치하는지 대조 |
| SC3 | 확대 프레임이 창 시작 지점을 반영한다 | E2E — 창 이동 후 확대 프레임의 `src`가 갱신되는지 확인 |
| SC4 | 4초 소스를 6초 구간에 넣으면 인스펙터 경고가 뜨고 렌더가 차단된다 | E2E — 경고 노출 확인 + 렌더 버튼 차단/프리플라이트 문구 확인 |
| SC5 | 구간을 4초 이하로 줄이면 경고와 차단이 모두 해소된다 | E2E — 타임라인 경계를 드래그해 구간을 줄인 뒤 렌더 가능 상태 확인. **막다른 길이 아님을 보장하는 기준** |
| SC6 | 썸네일 생성 중에도 숫자 입력과 프레이밍 조작이 동작한다 | E2E — 생성 진행 중 `day1-a-trim-in`에 입력하고 반영 확인 |
| SC7 | 유닛·E2E 전량 통과, 타입체크·빌드 통과 | `npm test && npm run build && npm run test:e2e` |
| SC8 | Hook 분석이 회귀하지 않는다 | `hook-analysis.spec.ts` 통과 + Hook 후보 썸네일이 그대로 나오는지 확인 |

### 4.2 Quality Criteria

- 창 위치↔시각 변환, 샘플 시각 배열 계산, 짧은 소스 판정은 순수 함수로 분리하고 유닛 테스트를 붙인다.
- 프레임 샘플러를 hook-analysis에서 분리할 때, 기존 `heuristicHookAnalyzer`가 분리된 샘플러를 호출하도록 바꾸고 동작 동일성을 테스트로 고정한다. 코드를 복사하지 않는다.
- 기존 `data-testid`(`day1-a-trim-in` 등)는 유지한다. `day1-a-trim-out`은 입력에서 표시로 바뀌므로 해당 E2E 단언을 함께 수정한다.
- 스트립·창·확대 프레임에 새 `data-testid`를 부여한다.

---

## 5. Risks and Mitigation

| 위험 | 영향 | 대응 |
|------|------|------|
| 샘플러를 hook-analysis에서 분리하다 검증된 Hook 분석이 회귀 | 높음 | 복사가 아니라 추출 후 호출로 바꾼다. SC8을 게이트로 두고 모듈 종료 시마다 `hook-analysis.spec.ts` 실행 |
| 스트립 픽셀 해상도가 0.1초 정밀도에 못 미침 (75초를 600px에 그리면 1px ≈ 0.125s) | 중간 | D-T04로 Trim In 숫자 필드를 유지해 정밀 지정 경로를 남긴다. 키보드 방향키(FR-T08)도 프레임 단위 이동 경로가 된다 |
| canvas·video 의존으로 jsdom 유닛 테스트 불가 | 중간 | NFR의 테스트 가능성 항목대로 계산을 순수 함수로 분리. UI 동작은 E2E로만 검증하고 Design에서 분리 경계를 명시 |
| 썸네일 생성이 Hook 분석과 동시에 돌아 디코딩 자원을 경합 | 중간 | 지연 생성(D-T05)이라 동시 실행 가능성 자체가 낮다. Design에서 동시 실행 시 직렬화 여부를 결정한다 |
| 세션 캐시가 메모리를 계속 점유 (dataURL 다수 보관) | 낮음 | 스트립은 고정 장수(75초든 300초든 같은 칸 수)로 만든다. 장수 상한을 Design에서 상수로 고정 |
| 짧은 소스 렌더 차단이 3장면에는 없어 템플릿 간 동작이 비대칭 | 낮음 | §2.2에 의도적 비대칭으로 명시. 다음 사이클 과제로 등재 |
| `day1-a-trim-out`을 입력에서 표시로 바꾸면서 기존 E2E가 깨짐 | 낮음 | §4.2대로 해당 단언을 같은 커밋에서 수정한다. 사전에 참조 지점을 grep으로 전수 확인 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| 영역 | 변경 |
|------|------|
| `src/infrastructure/media/` (또는 신규 모듈) | hook-analysis에서 추출한 프레임 샘플러 |
| `src/infrastructure/hook-analysis/heuristicHookAnalyzer.ts` | 추출된 샘플러를 호출하도록 수정 (동작 동일) |
| `src/domain/timeline/` 또는 `src/domain/day1/` | 창 위치↔시각 변환, 샘플 시각 계산 순수 함수 |
| `src/domain/editor/project.ts` | Day1 짧은 소스 감지 함수 (FR-S01, `day1MissingPanels` 옆) |
| `src/features/editor/` (신규 컴포넌트) | 트림 스트립 + 창 + 확대 프레임. D-T03에 따라 공용 형태로 만들되 배선은 Day1만 |
| `src/features/editor/Day1Inspector.tsx` | 스트립 배선, Trim Out 읽기전용화, 짧은 소스 경고 |
| `src/features/editor/useRenderQueue.ts` | `preflightIssues`에 짧은 소스 게이트 (FR-S03/S04) |
| `src/features/editor/editor.css` | 스트립·창·확대 프레임 스타일 (`hook__strip` 참고) |
| `tests/e2e/day1-template.spec.ts` 등 | 신규 시나리오 추가 + `day1-a-trim-out` 단언 수정 |

### 6.2 Current Consumers

Day1Inspector를 쓰는 Day1 편집 경로가 직접 소비자다. **간접 소비자는 hook-analysis**로, 샘플러 추출이 유일한 회귀 접점이다(SC8).

3장면 경로는 이번에 건드리지 않는다. 공용 컴포넌트를 만들되 `SceneInspector`에는 배선하지 않는 것이 이번 작업의 회귀 방어선이다.

### 6.3 Verification

모듈 종료 시 `npm test && npm run build`. 샘플러 추출 모듈 종료 시 `hook-analysis.spec.ts`를 반드시 포함. 전체 종료 시 `npm run test:e2e` 전량.

---

## 7. Next Steps

1. `/pdca design day1-trim-ux` — 3가지 아키텍처안 비교 후 선택. 특히 결정할 항목:
   - 샘플러 추출 경계 (hook-analysis가 무엇을 남기고 무엇을 넘길지)
   - 순수 함수를 `domain/timeline`에 둘지 `domain/day1`에 둘지
   - 스트립 칸 수 상한과 확대 프레임의 seek 전략
2. Design의 Session Guide에 따라 `/pdca do day1-trim-ux --scope module-N` 으로 분할 구현
3. 다음 사이클 과제로 등재: 3장면 스트립 적용 + 3장면 짧은 소스 렌더 차단 (§2.2 비대칭 해소)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-08-15 | 최초 Plan. 사용자 확인 6개 결정(D-T01~D-T06) 반영. 썸네일 스트립 + 드래그 창 방식 확정, 문제 2를 경고 + 렌더 차단까지 범위에 포함, 적용 범위를 Day1로 한정. §1.4에 사전 조사 정정(3장면 경고 UI는 이미 존재) 기록. | 김성권 / Claude |
