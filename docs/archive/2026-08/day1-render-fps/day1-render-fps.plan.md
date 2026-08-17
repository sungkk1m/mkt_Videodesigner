# day1-render-fps Planning Document

> **Summary**: 기본 fps를 60에서 30으로 내리고, 헤더의 하드코딩된 "60fps" 칩을 실제 `project.fps`를 읽는 30/60 토글로 바꾸며, 단일 렌더가 프로파일을 무시하던 버그를 함께 고친다.
>
> **Project**: mkt-videodesigner
> **Version**: 0.1.0
> **Author**: ksk@superplanet.net
> **Date**: 2026-08-16
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 헤더 칩이 `project.fps`와 무관한 하드코딩 문자열이라 Batch에서 30을 골라도 계속 "60fps"라고 표시한다. fps는 Batch 다이얼로그를 열어야만 바꿀 수 있고, 단일 렌더는 `render.profile`을 아예 전달하지 않아 항상 Standard 비트레이트로 나간다. 그리고 UA 소재에는 과한 60fps가 기본값이다. |
| **Solution** | `EDITOR_FPS`를 30으로 내리고, 하드코딩 칩을 `project.fps`를 읽는 30/60 토글로 교체해 표시와 조작을 한 지점에 합친다. 단일 렌더 `config`에 `profile`을 넣는다. |
| **Function/UX Effect** | 헤더 칩이 항상 사실을 말한다. Batch를 열지 않고 fps를 바꾼다. Fast/High 프로파일이 단일 렌더에서도 실제로 적용된다. 신규 프로젝트는 30fps로 시작한다. |
| **Core Value** | 화면에 보이는 숫자와 출력 파일이 일치한다. 렌더 시간과 파일 크기가 UA 소재에 맞는 기본값에서 출발한다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 헤더가 실제 fps와 다른 값을 표시하고, fps·profile을 바꿀 경로가 Batch 다이얼로그 안에만 있거나 아예 끊겨 있다 |
| **WHO** | Day1/three-scene 템플릿으로 UA 소재를 뽑는 퍼포먼스 마케터 (본인) |
| **RISK** | `EDITOR_FPS` 변경이 프레임 배분 테스트의 하드코딩 기대값을 깨뜨리는 것 / 30fps 기본이 기존에 검증된 60fps 산출물 품질 기준을 바꾸는 것 |
| **SUCCESS** | 헤더 칩 값 = `project.fps` = 출력 파일명의 fps 세그먼트가 항상 일치하고, 단일 렌더가 선택된 프로파일의 비트레이트로 나가며, 신규 프로젝트가 30fps로 시작한다 |
| **SCOPE** | 단일 사이클, 4개 파일 수준. 후속 `day1-endcard-video`의 선행 작업 |

---

## 1. Overview

### 1.1 Purpose

fps 선택 경로와 표시를 정리하고 기본값을 30으로 내린다. 세 가지가 같은 원인에서 나왔다: **단일 렌더 경로가 `project.render` 설정을 제대로 읽지 않는다.**

### 1.2 Background

30/60 선택 자체는 이미 구현돼 있다 — [profile.ts](../../../../src/domain/render/profile.ts)의 `FRAME_RATES`, `setRenderFps`([project.ts:248](../../../../src/domain/editor/project.ts)), [BatchDialog.tsx](../../../../src/features/editor/BatchDialog.tsx)의 세그먼트 컨트롤(`batch-fps-30`/`batch-fps-60`). 없는 것은 기능이 아니라 **접근 경로와 정직한 표시**다.

코드를 읽고 확인한 사실 세 가지:

1. **헤더 칩은 하드코딩이다.** [EditorWorkspace.tsx:915](../../../../src/features/editor/EditorWorkspace.tsx)의 `<span className="stage__chip">60fps</span>`는 `project.fps`를 읽지 않는다. 바로 위 `output-size` 칩은 실제 값을 읽으므로, 이 칩만 거짓말을 한다.

2. **fps 값 자체는 이미 단일 렌더에 반영된다.** 단일 렌더는 `project.fps`([EditorWorkspace.tsx:431](../../../../src/features/editor/EditorWorkspace.tsx)), Batch는 `project.render.fps`([useRenderQueue.ts:190](../../../../src/features/editor/useRenderQueue.ts))를 쓴다. `setRenderFps`와 `setRenderProfile`이 **항상 두 필드를 같이 갱신**하므로 둘은 어긋나지 않는다. 즉 Batch에서 30을 고르면 단일 렌더도 실제로 30으로 나간다. 문제는 "값이 안 먹는 것"이 아니라 "Batch를 열어야만 바꿀 수 있고, 헤더는 계속 60이라고 말하는 것"이다.

3. **단일 렌더는 `profile`을 전달하지 않는다.** [EditorWorkspace.tsx:426-432](../../../../src/features/editor/EditorWorkspace.tsx)의 `EditorRenderConfig`에 `profile` 키가 없다. `EditorRenderConfig.profile`은 optional이고 기본 Standard이므로, 프로젝트가 `fast`나 `high`여도 단일 렌더는 언제나 Standard 비트레이트로 나간다. fps와 같은 줄, 같은 원인이라 같이 고친다.

### 1.3 Related Documents

- 후속 사이클: **`day1-endcard-video`** — 이 사이클 완료 후 착수. 엔드카드 영상의 재생·모션 타이밍이 여기서 바뀌는 컴포지션 fps 위에서 돈다.
- 뒤집는 기존 결정: `browser-video-mvp` 요구사항 `default-60fps` (`.bkit/state/pdca-status.json`). 의도적 번복이며 §5 R2에 근거를 적었다.

---

## 2. Scope

### 2.1 In Scope

- [ ] `EDITOR_FPS` 60 → 30
- [ ] 헤더의 하드코딩 `60fps` 칩을 `project.fps` 기반 30/60 토글로 교체
- [ ] 단일 렌더 `EditorRenderConfig`에 `profile` 전달
- [ ] 영향받는 테스트의 하드코딩 프레임 기대값 갱신

### 2.2 Out of Scope

- `FRAME_RATES`에 24/50 등 추가 — `[30, 60]` 유지
- 프로파일별 fps 허용 목록 변경 — `fast: [30]`, `standard/high: [60, 30]` 유지
- `DEFAULT_PROFILE` 변경 — `standard` 유지
- BatchDialog의 기존 fps/profile 컨트롤 재배치 — 그대로 둔다
- 저장된 기존 프로젝트의 fps를 30으로 바꾸는 일괄 마이그레이션 — 저장된 값을 존중한다
- 엔드카드 영상 관련 작업 일체 — `day1-endcard-video` 사이클

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `EDITOR_FPS`를 30으로 바꾼다. 신규 프로젝트의 `project.fps`와 `project.render.fps`가 모두 30에서 시작한다 | High | Pending |
| FR-02 | 헤더의 하드코딩 `60fps` 칩을 제거하고, `project.fps`를 읽어 표시하면서 클릭으로 30/60을 전환하는 컨트롤로 바꾼다 | High | Pending |
| FR-03 | 헤더 토글은 현재 프로파일이 허용하지 않는 fps를 `disabled` 처리한다 (BatchDialog가 `allowedFps.includes(entry)`로 하는 것과 동일). `fast` 프로파일에서 60은 누를 수 없어야 한다 | High | Pending |
| FR-04 | 렌더 중(`isRendering`)에는 헤더 토글을 `disabled` 처리한다 | High | Pending |
| FR-05 | 단일 렌더의 `EditorRenderConfig`에 `profile: project.render.profile`을 전달한다 | High | Pending |
| FR-06 | 헤더 토글과 BatchDialog 컨트롤이 같은 `setRenderFps` 액션을 쓴다. 한쪽에서 바꾼 값이 다른 쪽에 즉시 반영된다 | High | Pending |
| FR-07 | `timeline.test.ts`의 하드코딩 프레임 기대값(`[120, 600, 180]`, `[180, 3240, 180]`)을 30fps 기준으로 갱신한다 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 하위 호환 | 저장된 60fps 프로젝트가 60fps 그대로 열리고 렌더된다 | 60fps 픽스처 → `parseProject` → 헤더 칩 60 표시 확인 |
| 스키마 불변식 | `render.fps`가 프로파일 허용 목록 안에 있다 | [schema.ts:455](../../../../src/domain/editor/schema.ts) `fpsForProfile` 검사. 기본 `standard`가 `[60, 30]`을 허용하므로 30 기본값은 그대로 통과 |
| 표시 정합성 | 헤더 칩 = `project.fps` = 출력 파일명 fps 세그먼트 | `buildOutputFileName`이 이미 `{fps}fps`를 파일명에 넣으므로 산출물로 교차 검증 가능 |
| 접근성 | 토글이 `aria-pressed`와 `role="group"`을 갖는다 | 기존 `.segmented` 패턴 준수 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] SC1 — 새 프로젝트를 만들면 헤더 칩이 "30fps"로 뜨고, `project.fps`와 `project.render.fps`가 모두 30이다
- [ ] SC2 — 헤더 칩에서 60을 누르면 칩이 60으로 바뀌고 BatchDialog의 `batch-fps-60`도 동시에 선택 상태가 된다 (역방향도 성립)
- [ ] SC3 — 프로파일을 `fast`로 바꾸면 헤더의 60 버튼이 `disabled`가 되고 칩은 30을 표시한다
- [ ] SC4 — 프로파일 `high`로 단일 렌더를 돌리면 출력이 Standard가 아닌 highest 비트레이트로 나간다
- [ ] SC5 — 저장해둔 60fps 프로젝트를 열면 헤더가 60을 표시하고 60fps로 렌더된다 (자동으로 30이 되지 않는다)
- [ ] SC6 — 단일 렌더 출력 파일명의 fps 세그먼트가 헤더 칩과 일치한다

### 4.2 Quality Criteria

- [ ] `pnpm lint` 무경고, `tsc -b` 통과
- [ ] `timeline.test.ts`, `project.test.ts`, `schema.test.ts`, `projectStore.test.ts` 전부 통과
- [ ] `EDITOR_FPS`를 심볼로 참조하는 테스트는 수정 없이 통과한다 (하드코딩 기대값만 손댄다)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| R1 — `EDITOR_FPS` 변경이 프레임 배분 테스트의 하드코딩 기대값을 깨뜨린다 | Low | High | 이미 특정했다. `timeline.test.ts`의 `allocateSceneFrames` 두 줄(`[120, 600, 180]`, `[180, 3240, 180]`)만 30fps 기준으로 갱신하면 된다. 나머지는 `EDITOR_FPS`를 심볼로 쓰므로 자동 통과 |
| R2 — 30fps 기본이 `browser-video-mvp`에서 확정했던 `default-60fps` 요구사항을 뒤집는다 | Low | High | 의도된 번복. 근거: UA 소재는 대부분 실사·게임플레이 캡처를 재인코딩한 것이고 60fps는 렌더 시간과 파일 크기만 두 배로 만든다. 60은 한 번 클릭으로 여전히 선택 가능하며, 저장된 60fps 프로젝트는 그대로 유지된다 |
| R3 — 헤더 칩을 버튼으로 바꾸면 기존 `.stage__chip` 스타일과 어긋난다 | Low | Medium | `output-size` 칩과 시각적으로 나란히 서야 하므로, `.segmented` 패턴을 그대로 쓰되 칩 크기에 맞춘다. 순수 CSS 범위 |
| R4 — 프로파일과 fps의 상호 제약이 두 UI(헤더·Batch)로 늘면서 한쪽만 갱신되는 상태가 생긴다 | Medium | Low | 두 UI가 같은 `setRenderFps`/`setRenderProfile` 스토어 액션만 호출하고, 허용 여부는 양쪽 모두 `PROFILE_SPECS[profile].allowedFps`에서 파생한다. 별도 상태를 만들지 않는다 (FR-06) |
| R5 — 30fps에서 엔드카드/장면 모션 프리셋이 60fps 때보다 거칠어 보인다 | Medium | Medium | 모든 모션이 `useVideoConfig().fps`를 읽어 초 단위로 계산하므로 타이밍은 보존된다. 부드러움 차이는 30fps 선택의 본질적 결과이며, Check 단계에서 미리보기로 육안 확인만 한다 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `EDITOR_FPS` | Constant | `60` → `30` |
| 헤더 fps 칩 | Component | 하드코딩 `<span>` → `project.fps` 기반 30/60 토글 |
| 단일 렌더 `EditorRenderConfig` | Config | `profile: project.render.profile` 추가 |
| `timeline.test.ts` 기대값 | Test | 하드코딩 프레임 수 30fps 기준 갱신 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `EDITOR_FPS` | READ | [project.ts:213](../../../../src/domain/editor/project.ts) `createProject` → `fps` | **Breaking (의도)** — 신규 프로젝트 컴포지션 fps가 30이 된다 |
| `EDITOR_FPS` | READ | [project.ts:224](../../../../src/domain/editor/project.ts) `createProject` → `render.fps` | **Breaking (의도)** — 신규 프로젝트 렌더 fps가 30이 된다 |
| `EDITOR_FPS` | READ | [project.test.ts:37](../../../../src/domain/editor/project.test.ts) | **None** — 심볼 비교(`toBe(EDITOR_FPS)`)라 통과. 테스트 *이름*의 "60fps" 문구만 실제와 어긋난다 |
| `EDITOR_FPS` | READ | [timeline.test.ts:68,71](../../../../src/domain/timeline/timeline.test.ts) | **Breaking** — 하드코딩 기대값 `[120,600,180]`/`[180,3240,180]`이 30fps에서 틀려진다 (FR-07) |
| `EDITOR_FPS` | READ | [timeline.test.ts:77-86](../../../../src/domain/timeline/timeline.test.ts) | **None** — `15 * EDITOR_FPS`, `>= EDITOR_FPS` 형태의 심볼 단언 |
| `project.fps` | READ | [EditorWorkspace.tsx:224,371,431,931,943,1065](../../../../src/features/editor/EditorWorkspace.tsx) — 재생 위치·시크·단일 렌더·Player 2곳 | **검증 필요** — 30fps에서 시크/재생 위치 계산이 정확한지 |
| `project.render.fps` | READ | [useRenderQueue.ts:190,196](../../../../src/features/editor/useRenderQueue.ts) Batch 스냅샷·config | **None** — `setRenderFps`가 두 필드를 함께 갱신하므로 정합 유지 |
| `project.render.fps` | VALIDATE | [schema.ts:455](../../../../src/domain/editor/schema.ts) `fpsForProfile` 불변식 | **검증 필요** — 기본 `standard`가 `[60,30]`을 허용하므로 통과해야 함 |
| `setRenderFps` | CALL | [projectStore.ts:272](../../../../src/features/editor/projectStore.ts) → [EditorWorkspace.tsx:1032](../../../../src/features/editor/EditorWorkspace.tsx) `onFps` | **None** — 헤더 토글이 같은 액션을 호출한다 |
| `setRenderProfile` | CALL | BatchDialog `onProfile` | **None** — `fpsForProfile`로 fps를 이미 클램프한다 |
| `EditorRenderConfig.profile` | READ | [renderEditor.ts](../../../../src/infrastructure/render/renderEditor.ts) → 비트레이트 결정 | **Breaking (의도)** — 단일 렌더가 이제 실제 프로파일을 받는다 |
| `buildOutputFileName` | READ | `config.fps` → 파일명 `{fps}fps` 세그먼트 | **None** — 값만 30으로 바뀐다 |
| `PROFILE_SPECS` / `fpsForProfile` | READ | BatchDialog, `setRenderFps`, 스키마 | **None** — 로직 무변경 |

### 6.3 Verification

- [ ] 저장된 60fps 프로젝트가 열릴 때 30으로 강제되지 않는다
- [ ] `standard`(기본) 프로파일에서 30fps가 스키마 불변식을 통과한다
- [ ] 헤더 토글 ↔ BatchDialog 컨트롤이 같은 값을 보여준다
- [ ] 단일 렌더 출력의 비트레이트가 선택한 프로파일을 따른다

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Selected |
|-------|:--------:|
| Starter | ☐ |
| Dynamic | ☐ |
| **Enterprise** (기존 구조 유지) | ☑ |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| fps 컨트롤 위치 | 헤더 칩을 토글로 / 헤더에 별도 세그먼트 / 인스펙터 | **헤더 칩을 토글로** | 버그(거짓 표시)와 신규 기능(단일 경로 컨트롤)이 한 지점으로 합쳐진다. 상태를 보여주던 자리가 그대로 상태를 바꾸는 자리가 되므로 헤더에 요소가 늘지 않고, `output-size` 칩 옆이라 위치도 자연스럽다 |
| `project.fps` vs `render.fps` 정리 | 한 필드로 통합 / **두 필드 유지** | **두 필드 유지** | 필드가 둘인 것은 냄새지만, `setRenderFps`/`setRenderProfile`이 항상 함께 갱신해 실제로 어긋나지 않는다. 통합은 스키마 변경과 마이그레이션을 부르며 이 사이클의 목적(표시 정합성 + 접근 경로)과 무관하다. 별도 항목으로 기록만 남긴다 |
| profile 누락 수정 범위 | 별도 사이클 / **이 사이클에 포함** | **포함** | 같은 줄([EditorWorkspace.tsx:426-432](../../../../src/features/editor/EditorWorkspace.tsx))의 같은 원인이다. fps만 고치면 profile은 계속 틀린 채로 남는다. 변경량 1줄 |
| 기본값 변경 방식 | `EDITOR_FPS` 상수 변경 / 신규 프로젝트에서만 분기 | **상수 변경** | `EDITOR_FPS`는 이미 신규 프로젝트 초기값 전용이다. 저장된 문서는 자기 값을 갖고 있으므로 상수 변경만으로 "신규는 30, 기존은 유지"가 성립한다 |

### 7.3 Clean Architecture Approach

```
domain/editor/constants.ts            EDITOR_FPS 60 → 30
domain/editor/project.ts              (무변경 — createProject가 상수를 읽음)
domain/render/profile.ts              (무변경 — FRAME_RATES/PROFILE_SPECS 그대로)
        ↓
features/editor/EditorWorkspace.tsx   헤더 칩 → 토글, 단일 렌더 config에 profile 추가
features/editor/editor.css            토글 스타일 (칩 크기에 맞춘 .segmented)
        ↓
domain/timeline/timeline.test.ts      하드코딩 프레임 기대값 갱신
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `.segmented` / `.segmented__item--on` + `aria-pressed` + `role="group"` 패턴 존재 (BatchDialog, Day1Inspector)
- [x] `.stage__chip` 패턴 존재 (`output-size`)
- [x] `data-testid` 명명 관행 존재 (`batch-fps-30`, `output-size`)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| testid 명명 | 존재 | 신규: `stage-fps-30` / `stage-fps-60` (`batch-fps-*`와 대칭) | Medium |
| 칩/토글 스타일 | `.stage__chip`과 `.segmented`가 별개 | 헤더에서 두 패턴이 나란히 설 때의 크기 규칙 | Low |

### 8.3 Environment Variables Needed

없음.

---

## 9. Notes for a later cycle (이 사이클 밖)

구현 중 마주치되 **손대지 않을** 것들. 기록만 남긴다.

- [EditorWorkspace.tsx:2](../../../../src/features/editor/EditorWorkspace.tsx) 파일 상단 주석 "Module 3A is 9:16 and 60fps only." — 비율이 선택 가능해진 시점에 이미 낡았고, 이 사이클로 더 낡는다. 별도로 정리
- [project.test.ts:34](../../../../src/domain/editor/project.test.ts) 테스트 이름 "starts as a 15-second 60fps project" — 단언은 심볼이라 통과하지만 이름이 사실과 어긋난다
- `project.fps`와 `project.render.fps` 이중 필드 (§7.2)
- `.bkit/state/pdca-status.json`의 `browser-video-mvp.requirements`에 남아 있는 `default-60fps` / `metadata.defaultFps: 60`

---

## 10. Next Steps

1. [ ] `/bkit:pdca design day1-render-fps`
2. [ ] `/bkit:pdca do day1-render-fps`
3. [ ] `/bkit:pdca analyze day1-render-fps` → `report` → `archive`
4. [ ] 완료 후 `/bkit:pdca design day1-endcard-video` 착수

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-16 | 최초 작성. day1-endcard-video에서 분리된 선행 사이클. 단일 렌더 profile 누락 버그 포함 | ksk@superplanet.net |
