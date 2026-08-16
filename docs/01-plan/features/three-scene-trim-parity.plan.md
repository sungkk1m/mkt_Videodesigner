# Three-Scene Trim Parity Planning Document

> **Summary**: Day1에만 적용했던 트림 스트립과 짧은 소스 렌더 차단을 3장면 템플릿에 이식해, 직전 사이클이 의도적으로 남긴 템플릿 간 비대칭을 닫는다
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-16
> **Status**: Draft — awaiting Design

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 직전 사이클(`day1-trim-ux`)은 회귀 위험을 이유로 적용 범위를 Day1로 한정했고, 그 결과 같은 편집기 안에서 템플릿에 따라 트리밍 경험이 다르다. 3장면은 여전히 숫자 입력 두 개뿐이고, 소스가 장면보다 짧으면 인스펙터 경고만 뜬 채 검은 화면이 담긴 MP4가 그대로 렌더된다. 차단되는 것은 Day1뿐이다. |
| **Solution** | `TrimStrip`은 원시값 props만 받도록, `trimWindow.ts`는 템플릿 무관 순수 함수로 이미 만들어져 있다. 새 추상화 없이 `EditorWorkspace → SceneInspector` 경로에 배선한다. 짧은 소스 판정은 `day1PanelsShorterThanSection`과 대칭인 3장면용 함수를 만들어 **단일 렌더와 Batch 두 경로 모두**에 건다. 소비자 없이 남아 있던 `scenesShorterThanSource`는 이 함수로 대체하며 삭제한다. |
| **Function/UX Effect** | 3장면 사용자도 장면을 고르면 원본 전체가 스트립으로 깔리고, 창을 끌어 구간을 정하고, 확대 프레임으로 구도를 확인한다. 짧은 소스는 렌더 앞에서 막히고 어느 장면인지와 해소 방법을 안내받는다. 템플릿을 바꿔도 같은 조작, 같은 안전장치가 따라온다. |
| **Core Value** | "어느 템플릿을 쓰느냐"가 편집 능력과 안전장치를 가르지 않는다. 검은 화면 소재가 광고로 나가는 마지막 경로가 닫힌다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 직전 사이클이 D-T03으로 남긴 의도적 비대칭을 닫는다. 자산(`TrimStrip`, `trimWindow.ts`, `FrameSampler`)은 이미 템플릿 무관하게 만들어져 있어 지금이 가장 싼 시점이다. |
| **WHO** | 3장면 템플릿으로 UA 소재를 만드는 사내 UA Manager·마케터. Day1과 3장면을 오가며 쓴다. |
| **RISK** | 3장면은 검증된 경로다. 게이트를 템플릿 인식형으로 바꾸며 **Day1 차단이 회귀**할 위험, 그리고 새 게이트가 **기존 E2E 3개를 실제로 깨뜨린다**는 사실(§1.4에서 코드로 확인). |
| **SUCCESS** | 3장면 인스펙터에서 스트립으로 고른 지점이 MP4 출력 시작점과 일치하고, 짧은 소스가 단일 렌더·Batch 양쪽에서 막히며 구간을 줄이면 해소된다. Day1 경로와 유닛·E2E 전량이 회귀 없이 통과한다. |
| **SCOPE** | 사전 조사(완료) → 스트립 배선 → Trim Out 읽기전용화 → 짧은 소스 판정 함수 → 두 차단 경로 → 기존 E2E 3건 정정 순으로 진행한다. |

---

## 1. Overview

### 1.1 Purpose

Day1에만 있던 두 가지 — 트림 스트립과 짧은 소스 렌더 차단 — 를 3장면 템플릿에 이식한다. 부수적으로, 이 작업을 막고 있던 소비자 없는 집계 함수 `scenesShorterThanSource`를 정리한다.

### 1.2 Background

직전 사이클 [day1-trim-ux](../../archive/2026-08/day1-trim-ux/day1-trim-ux.report.md)는 Plan D-T03에서 적용 범위를 Day1로 한정했다. 근거는 "3장면은 검증된 경로이고 건드리면 기존 E2E 회귀 위험이 생긴다"였고, 대신 **공용 컴포넌트로 만들어 두되 배선은 하지 않는다**는 방침을 지켰다. 그 방침 덕분에 이번 사이클의 스트립 작업은 새 설계가 아니라 배선이다.

남은 세 항목은 그 사이클의 완료 리포트 §6에 그대로 등재돼 있다.

### 1.3 사전 조사 — 재사용 자산

착수 비용을 낮추는 사실들이다. 전부 코드로 확인했다.

| 자산 | 위치 | 관련성 |
|------|------|--------|
| 트림 스트립 컴포넌트 | [TrimStrip.tsx:33-44](../../../src/features/editor/TrimStrip.tsx:33) | props가 `url` · `sourceDurationMs` · `sectionDurationMs` · `inMs` · `sampler` · `sourceId` · `testIdPrefix` · `onCommit` 원시값뿐이다. Day1 개념이 들어 있지 않아 **새 추상화 없이 그대로 쓴다** |
| 창 기하 순수 함수 | [trimWindow.ts](../../../src/domain/timeline/trimWindow.ts) | `maxTrimInMs` · `windowBoundsRatio` · `trimInFromRatio` · `stripSampleTimesMs` · `nearestSampleIndex`. 템플릿 무관 |
| 썸네일 캐시 훅 | [useTrimThumbnails.ts:19](../../../src/features/editor/useTrimThumbnails.ts:19) | 캐시 키가 `sourceId` 하나이고 **구간 길이는 의도적으로 키에서 제외**돼 있다. 3장면은 세 장면이 소스 하나를 공유하므로 이 설계가 그대로 이득이 된다 (§1.4 ③) |
| `FrameSampler` 주입 | [EditorWorkspace.tsx:131](../../../src/features/editor/EditorWorkspace.tsx:131) | 이미 `EditorWorkspace`의 prop이다. App→Workspace 배선은 손댈 필요가 없고 **Workspace→SceneInspector 한 구간만** 이으면 된다 |
| 3장면 소스 URL·ID | [EditorWorkspace.tsx:232](../../../src/features/editor/EditorWorkspace.tsx:232) `projectSource`, [:324](../../../src/features/editor/EditorWorkspace.tsx:324) `source.sourceUrl` | `TrimStrip`이 요구하는 `sourceId`·`url`이 이미 같은 컴포넌트 안에 있다 |
| Day1 짧은 소스 판정 | [project.ts:1076](../../../src/domain/editor/project.ts:1076) `day1PanelsShorterThanSection` | 3장면용 대칭 함수가 따를 형태. 반환형·가드·주석 규약이 선례다 |
| Day1 차단 배선 | [EditorWorkspace.tsx:328](../../../src/features/editor/EditorWorkspace.tsx:328) `shortPanels`, [useRenderQueue.ts:107](../../../src/features/editor/useRenderQueue.ts:107) | 조건식이 이미 네 곳에 놓여 있다. 목록을 템플릿 인식형으로 바꾸는 것이 작업의 전부다 |
| Day1 인스펙터 트림 블록 | [Day1Inspector.tsx:167-215](../../../src/features/editor/Day1Inspector.tsx:167) | 스트립 + Trim In 필드 + Trim Out 읽독 + 힌트 + 경고의 배치 순서와 문구 체계 |

### 1.4 사전 조사에서 코드로 확인·정정한 사항

Plan 단계에서 확인해 달라고 지시받은 항목과, 그 과정에서 새로 드러난 항목이다. **직전 사이클 회고 교훈 3번**("차단·게이트 계열은 차단 지점이 몇 개인지 코드로 확인")을 Design이 아니라 Plan에서 실행했다.

#### ① 3장면도 Trim Out은 종속값이다 — 확인 완료

Day1과 **완전히 같은 구조**다.

- [project.ts:500](../../../src/domain/editor/project.ts:500) `setSceneTrimInMs`가 `reconcileTrim({inMs, outMs: inMs}, sourceMs, sectionMs)`를 호출한다. Day1의 `setDay1TrimInMs`([:874](../../../src/domain/editor/project.ts:874))와 동일하다.
- [project.ts:518](../../../src/domain/editor/project.ts:518) `setSceneTrimOutMs`는 `windowMs`를 구해 `setSceneTrimInMs(project, kind, outMs - windowMs)`로 위임한다. **Out 입력은 값을 정하는 것이 아니라 같은 길이의 창을 옮기는 것**이다.

같은 함수(`reconcileTrim`)를 쓰는지 확인해 달라는 지시에 대한 답: 쓴다. 따라서 Day1 D-T04와 같은 판단이 3장면에도 그대로 성립하며, D-P02로 확정했다.

#### ② 차단 지점은 2경로 4사이트다 — 확인 완료

| # | 위치 | 경로 | 성격 |
|---|------|------|:----:|
| 1 | [EditorWorkspace.tsx:417](../../../src/features/editor/EditorWorkspace.tsx:417) `startRender()` 가드 | 단일 MP4 | 게이트 |
| 2 | [EditorWorkspace.tsx:623](../../../src/features/editor/EditorWorkspace.tsx:623) 렌더 버튼 `disabled` | 단일 MP4 | 게이트 |
| 3 | [EditorWorkspace.tsx:581](../../../src/features/editor/EditorWorkspace.tsx:581) `day1-short-blocker` 배지 | 단일 MP4 | 표시 |
| 4 | [useRenderQueue.ts:107](../../../src/features/editor/useRenderQueue.ts:107) `preflightIssues` | Batch | 게이트 |

네 사이트 모두 `day1PanelsShorterThanSection` 결과에 의존하고, 그 함수는 3장면 프로젝트에서 항상 빈 배열을 돌려준다(`day1Of(project)`가 `null`). 즉 **조건식의 자리는 이미 다 있고, 목록을 템플릿 인식형으로 바꾸는 것**이 작업이다. 사이트 4는 `templateSettings.template === 'day1'` 분기 **안쪽**에 있으므로 `else` 가지에 대칭 블록을 새로 넣어야 한다.

#### ③ 3장면은 세 장면이 소스 하나를 공유한다 — Day1과 다른 점

Day1은 패널마다 소스가 따로다. 3장면은 [project.ts:505](../../../src/domain/editor/project.ts:505) `threeSceneOf(project)?.source` 하나를 세 장면이 공유하고, 장면마다 `trim`만 다르다. 결과:

- 장면을 바꿔도 `sourceId`가 같으므로 썸네일이 **캐시 히트**한다. 재샘플링 없음.
- 장면마다 `sectionDurationMs`가 다르므로 **창의 폭만 달라진다**. `TrimStrip`은 이미 `sectionDurationMs`를 prop으로 받으므로 추가 작업이 없다.

#### ④ CTA 장면에는 검은 화면이 안 나오는 경우가 있다 — 새로 드러난 항목

[CtaScene.tsx:9-63](../../../src/compositions/scenes/CtaScene.tsx:9)의 배경 선택 순서:

1. `cta.mediaUrl`이 있으면 **CTA 전용 영상**을 쓴다 (공유 소스 창 미사용)
2. 없고 `useGeneratedBackground`면 마지막 gameplay 프레임을 `Freeze`로 고정한다 (한 프레임을 장면 내내 유지 — 검은 화면 없음)
3. 둘 다 아닐 때만 `scene.trimBeforeFrames`~`trimAfterFrames`로 공유 소스를 재생한다

따라서 **CTA 장면을 무조건 차단하면 해소 방법이 없는 오차단**이 생긴다. CTA 전용 영상이 있는데도 막히면 사용자가 할 수 있는 일은 CTA 구간을 줄이는 것뿐인데, 그래도 화면은 애초에 멀쩡했다. 직전 사이클 SC5가 지킨 "막다른 길이 아닐 것" 기준에 걸린다. → D-P03으로 예외를 확정했다.

#### ⑤ 새 게이트가 기존 E2E 3개를 깨뜨린다 — 새로 드러난 항목

**이번 조사에서 가장 값이 큰 발견이다.** 착수 배경에는 없던 항목이고, Do 단계에서 만났다면 범위 재조정이 필요했을 규모다.

| 스펙 | 지점 | 원인 | 차단이 정당한가 |
|------|------|------|:---:|
| [media-codec-compat.spec.ts:45-58](../../../tests/e2e/media-codec-compat.spec.ts:45) | HEVC · AV1 · VP8 렌더 3건 | 코덱 픽스처가 [generate-editor-fixture.mjs:178](../../../scripts/generate-editor-fixture.mjs:178)에서 `duration=3`으로 생성된다. 기본 15s 프리셋의 gameplay 구간은 10초 | ✅ 실제로 7초가 검은 화면이었다 |
| [persistence-recovery.spec.ts:62](../../../tests/e2e/persistence-recovery.spec.ts:62) | `MP4 렌더` `toBeEnabled()` | 12초 소스 + **30초 프리셋**(gameplay 24초) 상태에서 활성화를 단언 | ✅ 실제로 12초가 검은 화면이었다 |
| [editor-vertical-slice.spec.ts:185](../../../tests/e2e/editor-vertical-slice.spec.ts:185) | `fillField('trim-out', '9')` | Out을 읽기전용으로 바꾸면 입력할 수 없다 | — D-P02의 직접 귀결 |

세 건 모두 **테스트가 낡은 것이지 새 동작이 틀린 것이 아니다**. 다만 수정이 범위에 들어가므로 §3.1에 FR로 등재했다(회고 교훈 1번).

안전한 것도 확인했다 — `editor-full`(12초 소스 / 15s 프리셋 `[2,10,3]`), `batch-render`, `audio-tts`, `hook-analysis`는 전부 소스가 모든 구간을 채운다. `editor-vertical-slice`가 30초 프리셋으로 경고를 확인하는 구간([:206-210](../../../tests/e2e/editor-vertical-slice.spec.ts:206))은 렌더 전에 15초로 되돌리므로 영향이 없다.

#### ⑥ `scenesShorterThanSource`의 실제 상태

[project.ts:1119](../../../src/domain/editor/project.ts:1119). 소비자는 [project.test.ts:127](../../../src/domain/editor/project.test.ts:127) 하나뿐 — "여전히 소비자가 없다"는 배경 설명이 맞다. 그대로 배선할 수 없는 이유가 셋이다.

| 차이 | `scenesShorterThanSource` | `day1PanelsShorterThanSection` |
|------|---------------------------|-------------------------------|
| 반환형 | `EditorScene[]` (객체 전체) | `Day1PanelKey[]` (키) |
| 소스 없음 가드 | 없음 → 소스 미업로드 시 3장면 전부를 짧다고 보고 | `sourceMs > 0` |
| 이름 | "소스보다 짧은 장면"으로 읽히지만 뜻은 정반대 | 뜻과 이름이 일치 |

가드가 없다는 점이 실질적이다. 소스가 없으면 `preflightIssues`가 이미 "영상 소재가 없습니다"를 내는데([useRenderQueue.ts:117](../../../src/features/editor/useRenderQueue.ts:117)) 여기에 짧은 소스 메시지까지 겹친다. → D-P04로 삭제·교체를 확정했다.

#### ⑦ 부수 확인 — `setDay1TrimOutMs`도 이미 고아다

[project.ts:898](../../../src/domain/editor/project.ts:898) `setDay1TrimOutMs`는 직전 사이클이 Day1 Trim Out을 읽기전용으로 바꾸면서 생산 소비자를 잃었고, 지금은 [day1Commands.test.ts](../../../src/domain/editor/day1Commands.test.ts:238)에서만 참조된다. **이번 변경이 만든 고아가 아니라 직전 사이클이 남긴 것**이므로 CLAUDE.md §3에 따라 삭제하지 않고 여기 적는다. 다만 이번에 `setSceneTrimOutMs`를 지우면 둘 사이에 또 비대칭이 생기므로, FR-C04(Should)로 함께 처리하기를 제안한다. 범위를 늘리고 싶지 않다면 이 FR만 빼면 된다.

### 1.5 Confirmed Product Decisions

Plan 단계에서 사용자 확인을 거친 항목이다. Design 단계에서 뒤집지 않는다.

| # | 결정 | 근거 |
|---|------|------|
| D-P01 | **`TrimStrip`을 `SceneInspector`에 그대로 배선한다. 3장면용 추상화를 새로 만들지 않는다** | §1.3 — props가 원시값뿐이고 Day1 개념이 없다. 직전 사이클 D-D03이 이 순간을 위해 배치를 `domain/timeline`으로 잡았다 |
| D-P02 | **3장면 Trim Out도 읽기전용 표시로 전환한다** | §1.4 ① — `setSceneTrimOutMs`가 종속값 계산일 뿐이라 입력 UI가 사용자를 오해시킨다. Day1 D-T04와 같은 판단. `editor-vertical-slice.spec.ts:185` 단언을 같은 커밋에서 고친다 |
| D-P03 | **CTA 장면은 전용 영상(`cta.media`)이 있거나 `useGeneratedBackground`가 켜져 있으면 차단 판정에서 제외한다** | §1.4 ④ — 그 경우 공유 소스 창을 쓰지 않아 검은 화면이 나오지 않는다. 무조건 차단하면 해소 방법 없는 오차단이 된다 |
| D-P04 | **`scenesShorterThanSource`를 삭제하고 `day1PanelsShorterThanSection`과 대칭인 함수로 교체한다** | §1.4 ⑥ — 반환형·가드·이름 셋 다 달라 재사용보다 대칭 쌍으로 다시 쓰는 편이 읽힌다. 두 함수를 하나로 통합하는 안은 라벨 체계(패널 A·B vs 장면 이름)와 CTA 예외를 도메인 안으로 끌어들여 기각 |
| D-P05 | **코덱 픽스처를 3초에서 12초로 재생성한다** | §1.4 ⑤ — 렌더 시간은 출력 길이(15s)가 정하므로 E2E가 느려지지 않는다. 스펙 본문 무수정. 대안(스펙마다 경계를 드래그해 구간 축소)은 코덱 검증이라는 테스트 의도에 무관한 코드를 3곳에 넣는다 |
| D-P06 | **차단은 단일 렌더와 Batch 두 경로 모두에 건다** | §1.4 ② — 직전 사이클 D-D11이 Do 중에 잡은 설계 오류를 이번엔 Plan에서 확인했다. 한쪽만 막으면 FR이 절반만 충족된 채 완료로 보인다 |

> **Do 단계 기록 규칙** (직전 사이클에서 효과가 확인된 교훈 2번): Do 진행 중 이 표에 없는 결정을 내리면, 그 자리에서 이 표에 행을 추가하고 근거를 남긴다. Check 단계까지 미루지 않는다. 직전 사이클은 6건을 즉시 기록해 Check 신규 Gap이 0건이었다.

### 1.6 Related Documents

| 문서 | 관계 |
|------|------|
| [`docs/archive/2026-08/day1-trim-ux/day1-trim-ux.report.md`](../../archive/2026-08/day1-trim-ux/day1-trim-ux.report.md) | 직전 사이클 완료 리포트. §6 Next Cycle Candidates가 이번 범위의 출처 |
| [`docs/archive/2026-08/day1-trim-ux/day1-trim-ux.plan.md`](../../archive/2026-08/day1-trim-ux/day1-trim-ux.plan.md) | D-T03(Day1 한정)과 §2.2(의도된 비대칭)의 원문 |
| [`docs/archive/2026-08/day1-trim-ux/day1-trim-ux.design.md`](../../archive/2026-08/day1-trim-ux/day1-trim-ux.design.md) | `TrimStrip` · `trimWindow` · `FrameSampler` 설계. 이번 사이클은 여기 정의된 계약을 소비만 한다 |
| [`docs/01-plan/conventions.md`](../conventions.md) | 레이어 경계와 코딩 컨벤션 |

---

## 2. Scope

### 2.1 In Scope

**A. 스트립 배선 (닫아야 할 것 1)**
- `EditorWorkspace → SceneInspector`에 `FrameSampler` · 소스 URL · 소스 ID 전달
- `SceneInspector` Trim 섹션에 `TrimStrip` 배치 (Day1Inspector와 같은 순서)
- Trim In 숫자 필드 유지 + 스트립과 동일한 커밋 경로 공유
- Trim Out 입력 필드 → 읽기전용 표시 전환 (D-P02)
- Trim Out 전환으로 고아가 되는 명령 함수·스토어 액션·prop 제거
- 스트립·창·확대 프레임 `data-testid` 부여

**B. 짧은 소스 렌더 차단 (닫아야 할 것 2)**
- 3장면용 짧은 소스 판정 함수 (domain, CTA 예외 포함)
- 단일 MP4 경로 차단 — `startRender()` 가드 + 버튼 `disabled` + 차단 배지
- Batch 경로 차단 — `preflightIssues`의 3장면 분기
- 차단 문구에 어느 장면인지와 해소 방법 명시
- 인스펙터 경고 문구를 해소 방법까지 포함하도록 정렬

**C. 집계 함수 정리 (닫아야 할 것 3)**
- `scenesShorterThanSource` 삭제 및 유닛 테스트 교체 (D-P04)

**D. 기존 E2E 정정 (§1.4 ⑤에서 드러난 필수 작업)**
- 코덱 픽스처 12초 재생성
- `persistence-recovery` 렌더 활성화 단언 수정
- `editor-vertical-slice` Trim Out 입력 단언 수정

### 2.2 Out of Scope

| 항목 | 사유 |
|------|------|
| `TrimStrip` · `trimWindow` · `useTrimThumbnails` 자체의 수정 | 배선만으로 충족된다. 배선 중 수정이 필요해지면 그 사실 자체가 직전 사이클 D-D03의 반증이므로 Design/Do에 결정으로 기록한다 |
| 소스 오디오 파형 표시 | 직전 사이클 §2.2에서 제외. 이번에도 유지 |
| 트림 구간 내 재생 프리뷰 | 위와 같음 |
| CTA 전용 영상(`cta.media`)에 대한 스트립 | 트림은 공유 소스에만 걸린다. CTA 전용 영상은 트림 대상이 아니므로 스트립도 없다 |
| Hook 자동 분석 경로 변경 | `setTrimIn('hook', …)`([EditorWorkspace.tsx:715](../../../src/features/editor/EditorWorkspace.tsx:715))는 그대로 두고, 스트립이 그 결과를 반영하는지만 확인한다 (SC7) |
| 구간(장면) 길이 자체의 조절 UI | 기존 타임라인 경계 드래그가 담당한다 |
| Day1 쪽 동작 변경 | 이번 사이클은 3장면을 Day1에 맞추는 방향이다. 반대 방향 변경은 없다 |

---

## 3. Requirements

> 회고 교훈 1번에 따라 §2.1의 모든 범위 항목을 FR로 등재한다. 산문에만 있는 범위 항목을 두지 않는다. §1.4 ⑤에서 드러난 E2E 정정도 FR-E로 등재한다.

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 |
|----|----------|:--------:|
| FR-P01 | `SceneInspector`가 `FrameSampler` · 소스 URL · 소스 ID를 prop으로 받고, `EditorWorkspace`가 기존 `frameSampler` prop과 `projectSource` · `source.sourceUrl`로 이를 채운다 | Must |
| FR-P02 | 선택된 장면의 Trim 섹션에 `TrimStrip`을 표시한다. `sectionDurationMs`는 그 장면의 구간 길이를 넘긴다 | Must |
| FR-P03 | 창을 드래그하면 해당 장면의 Trim In이 바뀐다 (`onCommit` → `setTrimIn(selectedKind, …)`) | Must |
| FR-P04 | Trim In 숫자 필드를 유지하고 스트립과 같은 커밋 경로를 공유해 양방향으로 동기화한다 | Must |
| FR-P05 | Trim Out을 입력 필드에서 읽기전용 표시로 바꾼다 (D-P02). `trim-out` testId는 표시 요소로 유지한다 | Must |
| FR-P06 | Trim Out 전환으로 소비자를 잃는 `setSceneTrimOutMs` · `projectStore.setTrimOut` · `SceneInspectorProps.onTrimOutMs`를 제거하고 해당 유닛 테스트를 정리한다 | Must |
| FR-P07 | 스트립·창·확대 프레임에 `scene-` 접두 `data-testid`를 부여한다. 기존 `trim-in` · `trim-range` testId는 유지한다 | Must |
| FR-P08 | 장면을 전환해도 썸네일을 재샘플링하지 않는다 (소스 공유 + `sourceId` 캐시 키) | Should |
| FR-P09 | 썸네일 생성 중에도 Trim In 입력과 Transform 조작이 막히지 않는다 | Must |
| FR-P10 | 썸네일 생성이 실패하면 스트립을 숨기고 숫자 입력만으로 축퇴한다 | Should |
| FR-S01 | 3장면의 짧은 소스 판정 함수를 domain에 추가한다. `day1PanelsShorterThanSection` 옆, 같은 형태(장면 키 배열 반환 + 소스 없음 가드) | Must |
| FR-S02 | FR-S01의 판정은 CTA 장면에서 `cta.media`가 있거나 `useGeneratedBackground`가 켜져 있으면 그 장면을 제외한다 (D-P03) | Must |
| FR-S03 | 짧은 장면이 있으면 단일 MP4 렌더가 차단된다 — `startRender()` 가드와 버튼 `disabled` 양쪽 (§1.4 ② 사이트 1·2) | Must |
| FR-S04 | 짧은 장면이 있으면 `preflightIssues`가 Batch를 차단한다 (§1.4 ② 사이트 4, `day1` 분기의 `else` 가지) | Must |
| FR-S05 | 차단 문구는 어느 장면인지 지목하고 해소 방법(구간을 줄이거나 더 긴 소스를 쓸 것)을 포함한다 | Must |
| FR-S06 | 헤더에 차단 배지를 표시한다 (§1.4 ② 사이트 3). Day1 배지와 문구 체계를 맞춘다 | Must |
| FR-S07 | `SceneInspector`의 기존 경고 문구를 해소 방법 두 가지를 모두 담도록 정렬한다. 현재는 "장면 길이를 줄이세요"만 안내한다 | Should |
| FR-S08 | 소스가 구간보다 짧으면 창이 스트립 전체를 덮고 드래그가 비활성화된다 (`TrimStrip`이 이미 보장, E2E로 확인) | Should |
| FR-C01 | `scenesShorterThanSource`를 삭제한다 (D-P04) | Must |
| FR-C02 | `project.test.ts`의 `scenesShorterThanSource` 테스트를 FR-S01 함수 기준으로 다시 쓴다 | Must |
| FR-C03 | FR-S01 함수에 소스 없음·CTA 예외·경계값 유닛 테스트를 붙인다 | Must |
| FR-C04 | 직전 사이클이 남긴 고아 `setDay1TrimOutMs`를 FR-P06과 함께 제거한다 (§1.4 ⑦). **범위를 좁히려면 이 FR만 빼면 된다** | Should |
| FR-E01 | 코덱 픽스처를 3초에서 12초로 재생성한다 — [generate-editor-fixture.mjs:178](../../../scripts/generate-editor-fixture.mjs:178)의 `testsrc2` 와 [:182](../../../scripts/generate-editor-fixture.mjs:182)의 `sine` 두 곳. **오디오 전용 ALAC 픽스처([:211](../../../scripts/generate-editor-fixture.mjs:211))는 렌더 경로를 타지 않으므로 3초로 둔다.** `media-codec-compat.spec.ts` 본문은 수정하지 않는다 | Must |
| FR-E02 | `persistence-recovery.spec.ts`의 렌더 활성화 단언을 새 게이트에 맞게 고치되, **"relink가 렌더 가능 상태를 되돌린다"는 테스트 의도를 보존한다**. 단언을 삭제하지 않는다 | Must |
| FR-E03 | `editor-vertical-slice.spec.ts`의 Trim Out 입력 단언을 읽기전용 표시 단언으로 바꾼다 | Must |

### 3.2 Non-Functional Requirements

| 항목 | 기준 |
|------|------|
| 회귀 (Day1) | `day1-trim-ux.spec.ts` · `day1-template.spec.ts`가 전량 통과한다. 게이트를 템플릿 인식형으로 바꾸는 작업의 회귀 지표다 |
| 회귀 (3장면) | `editor-full` · `editor-vertical-slice` · `persistence-recovery`가 통과한다. FR-E02·E03이 고친 뒤 기준 |
| 회귀 (전체) | 유닛 31파일 349테스트 이상, E2E 42 passed (`day1-longform` 1건은 기존 조건부 skip), `tsc -b`, `vite build` |
| 아키텍처 | `src/test/architecture.test.ts` 경계 유지. FR-S01 판정은 `domain`, 배선과 게이트는 `features` |
| 테스트 가능성 | 짧은 소스 판정과 CTA 예외는 순수 함수로 유닛 테스트한다. 스트립 상호작용은 E2E |
| 접근성 | `TrimStrip`이 제공하는 `role="slider"` · 방향키 조작이 3장면에서도 동작한다 |
| 성능 | 장면 전환 시 썸네일 재샘플링이 발생하지 않는다 (FR-P08) |

---

## 4. Success Criteria

### 4.1 Definition of Done

| # | 기준 | 검증 방법 |
|---|------|-----------|
| SC1 | 3장면 인스펙터에 스트립이 표시되고, 창을 끌면 `trim-in`이 바뀐다 | E2E — 16칸 확인 후 드래그, `trim-in` 값 변화 단언 |
| SC2 | 스트립에서 고른 지점이 실제 MP4 출력 시작점과 일치한다 | 렌더 대조 — `videoSampling.ts`와 `gameplay-sample.colors.json` 팔레트 재사용. 직전 사이클 SC2와 같은 방법 |
| SC3 | 장면을 전환하면 창 폭이 그 장면의 구간 길이를 따르고, 썸네일은 재생성되지 않는다 | E2E — hook(2s) → gameplay(10s) 전환 시 창 폭 변화 + 썸네일 즉시 표시 |
| SC4 | 소스가 장면보다 짧으면 인스펙터 경고 + **단일 렌더·Batch 양쪽** 차단이 걸린다 | E2E — 30초 프리셋에서 경고·배지·버튼 비활성·Batch preflight를 각각 단언 |
| SC5 | 구간을 줄이면 경고와 차단이 모두 해소된다 | E2E — 프리셋을 15초로 되돌린 뒤 렌더 가능 확인. **막다른 길이 아님을 보장하는 기준** |
| SC6 | CTA 전용 영상이 있으면 CTA 장면은 차단하지 않는다 | 유닛 — FR-S01 함수에 CTA 예외 케이스. E2E는 선택 |
| SC7 | Hook 후보 적용이 스트립에 반영된다 | E2E(`hook-analysis.spec.ts`) — 후보 적용 후 `trim-range`와 창 위치가 함께 움직이는지 |
| SC8 | Trim Out이 읽기전용 표시이고 Trim In은 계속 동작한다 | E2E — `trim-out`이 입력이 아님을 확인, `trim-in` 입력은 여전히 반영 |
| SC9 | Day1 경로가 회귀하지 않는다 | `day1-trim-ux.spec.ts` · `day1-template.spec.ts` 전량 통과 |
| SC10 | 유닛·E2E·타입체크·빌드 전량 통과 | `npm test && npm run build && npx playwright test` |

### 4.2 Quality Criteria

- FR-S01 판정 함수는 `day1PanelsShorterThanSection`과 **읽었을 때 쌍으로 보이는** 이름·반환형·주석 규약을 갖는다.
- 차단 조건식을 네 사이트에 흩뿌리지 않는다. `EditorWorkspace`가 목록을 한 번 계산해 세 사이트가 공유하는 현재 구조(`shortPanels`)를 따른다.
- 기존 `data-testid`(`trim-in` · `trim-range` · `trim-out`)를 유지한다. `trim-out`은 입력에서 표시로 바뀌므로 참조 지점을 grep으로 전수 확인한 뒤 같은 커밋에서 고친다.
- 픽스처 재생성(FR-E01)은 스크립트만 고치고 스펙 본문은 건드리지 않는다. 재생성 후 `media-codec-compat` 3건을 실제로 돌려 확인한다.

---

## 5. Risks and Mitigation

| 위험 | 영향 | 대응 |
|------|------|------|
| 게이트를 템플릿 인식형으로 바꾸다 Day1 차단이 회귀 | **높음** | SC9를 모듈 종료 게이트로 둔다. `day1PanelsShorterThanSection` 호출을 지우지 않고 **옆에 3장면 분기를 더하는** 방향으로만 바꾼다 |
| §1.4 ⑤의 E2E 3건 수정이 예상보다 커짐 | 중간 | FR-E01~E03으로 등재해 범위에 넣었다. 특히 FR-E02는 단언을 지우는 것이 아니라 의도를 보존해 고치는 것임을 FR 본문에 못박았다 |
| 코덱 픽스처 재생성이 CI 시간·용량을 늘림 | 중간 | 렌더 시간은 출력 길이가 정하므로 E2E는 느려지지 않는다. 늘어나는 것은 픽스처 인코딩(libsvtav1 12초)뿐. 재생성 후 실측해 Design에 기록한다 |
| CTA 예외 조건이 도메인에 컴포지션 지식을 들여옴 | 낮음 | `cta.media` · `useGeneratedBackground`는 이미 `domain/editor/types`의 필드다. 경계 위반은 아니나, 예외 근거를 `CtaScene`의 분기와 함께 주석으로 남겨 두 곳이 갈라지지 않게 한다 |
| Trim Out 제거가 저장된 프로젝트에 영향 | 낮음 | 제거 대상은 명령 함수·스토어 액션·prop뿐이고 `MediaTrim.outMs` 스키마는 그대로다. `persistence-recovery`가 지표 |
| CTA 장면에도 스트립이 뜨는 것이 오해를 부름 | 낮음 | 트림 자체가 세 장면 모두에 이미 있고 CTA도 조건에 따라 공유 소스를 쓴다. 현행 UI와 일관되므로 유지한다. Design에서 재검토 |
| 세 장면이 소스를 공유해 한 장면의 창 이동이 다른 장면에 영향을 준다고 오해 | 낮음 | 트림은 장면별로 독립이다. SC3이 이를 E2E로 고정한다 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| 영역 | 변경 |
|------|------|
| [`src/domain/editor/project.ts`](../../../src/domain/editor/project.ts) | FR-S01 판정 함수 추가, `scenesShorterThanSource` 삭제(FR-C01), `setSceneTrimOutMs` 삭제(FR-P06), `setDay1TrimOutMs` 삭제(FR-C04) |
| [`src/domain/editor/project.test.ts`](../../../src/domain/editor/project.test.ts) | FR-C02 · FR-C03 |
| [`src/domain/editor/day1Commands.test.ts`](../../../src/domain/editor/day1Commands.test.ts) | FR-C04에 따른 정리 |
| [`src/features/editor/SceneInspector.tsx`](../../../src/features/editor/SceneInspector.tsx) | 스트립 배선, Trim Out 읽독화, 경고 문구 정렬 (FR-P01~P07, FR-S07) |
| [`src/features/editor/EditorWorkspace.tsx`](../../../src/features/editor/EditorWorkspace.tsx) | 인스펙터 prop 전달, 짧은 장면 목록 계산, 사이트 1·2·3 차단 (FR-P01, FR-S03, FR-S06) |
| [`src/features/editor/useRenderQueue.ts`](../../../src/features/editor/useRenderQueue.ts) | `preflightIssues` 3장면 분기 (FR-S04, FR-S05) |
| [`src/features/editor/useRenderQueue.test.ts`](../../../src/features/editor/useRenderQueue.test.ts) | 3장면 preflight 케이스 |
| [`src/features/editor/projectStore.ts`](../../../src/features/editor/projectStore.ts) | `setTrimOut` 제거 (FR-P06) |
| [`src/features/editor/editor.css`](../../../src/features/editor/editor.css) | 필요 시 스트립 배치 조정. `trim__*` 클래스는 재사용 |
| [`scripts/generate-editor-fixture.mjs`](../../../scripts/generate-editor-fixture.mjs) | 코덱 픽스처 12초화 (FR-E01) |
| [`tests/e2e/`](../../../tests/e2e) | 신규 3장면 트림 시나리오 + `persistence-recovery`·`editor-vertical-slice` 정정 (FR-E02, FR-E03) |

`TrimStrip.tsx` · `useTrimThumbnails.ts` · `trimWindow.ts` · `frameSampler.ts` · `domain/ports`는 **변경 대상이 아니다**. 이 목록이 지켜지는지가 D-P01이 옳았는지의 판정이다.

### 6.2 Current Consumers

직접 소비자는 3장면 편집 경로다. **간접 소비자는 Day1**으로, 차단 게이트 네 사이트와 `TrimStrip`을 공유한다 — 이번 사이클의 유일한 회귀 접점이며 SC9가 그 방어선이다.

렌더 파이프라인(`buildCompositionProps` · `ThreeSceneComposition` · `CtaScene`)은 읽기만 한다. 변경 없음.

### 6.3 Verification

모듈 종료 시 `npm test && npm run build`. 차단 모듈 종료 시 `day1-trim-ux.spec.ts`를 반드시 포함(SC9). 전체 종료 시 `npx playwright test` 전량 + 코덱 픽스처 재생성 후 `media-codec-compat` 실측.

**착수 시점 기준선 (실측 완료, 2026-08-16)**: 유닛 31파일 349테스트 통과. E2E 42 passed / 1 skipped(`day1-longform` 기존 조건부 skip).

---

## 7. Next Steps

1. `/pdca design three-scene-trim-parity` — 이번에 Design이 결정할 항목:
   - FR-S01 함수의 최종 이름·시그니처와 CTA 예외의 표현 방식
   - `EditorWorkspace`가 짧은 장면 목록을 계산하는 위치 (`shortPanels`와 하나로 합칠지, 나란히 둘지)
   - `preflightIssues`의 3장면 분기 위치 — 현재 `else if` 체인 안쪽인지 바깥의 별도 `if`인지 (Day1은 별도 `if`로 소스 없음과 짧은 소스를 함께 보고한다)
   - `SceneInspector`의 스트립 배치 순서와 CTA 장면에서의 노출 여부
   - FR-E02의 구체적 수정 형태 (30초 프리셋에서 차단 단언 추가 후 15초로 되돌려 활성화 확인 등)
2. Design의 Session Guide에 따라 `/pdca do three-scene-trim-parity --scope module-N` 으로 분할 구현
3. Do 중 결정은 §1.5 표에 즉시 기록 (회고 교훈 2번)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-08-16 | 최초 Plan. 사용자 확인 6개 결정(D-P01~D-P06) 반영. 회고 교훈 3번에 따라 차단 지점 수를 Plan에서 코드로 확인(§1.4 ②, 2경로 4사이트). 3장면 Trim Out이 종속값임을 확인(§1.4 ①). 조사 중 새로 드러난 항목 2건 등재 — CTA 장면의 검은 화면 예외(§1.4 ④)와 기존 E2E 3건 파손(§1.4 ⑤). 직전 사이클이 남긴 고아 `setDay1TrimOutMs`를 삭제하지 않고 기록(§1.4 ⑦). | 김성권 / Claude |
