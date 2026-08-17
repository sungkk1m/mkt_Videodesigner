# day1-render-fps Design Document

> **Summary**: `EDITOR_FPS`를 30으로 내리고, 헤더의 하드코딩 "60fps" 칩을 `project.fps`를 읽는 인라인 30/60 세그먼트로 교체하며, 단일 렌더 config에 누락된 `profile`을 채운다.
>
> **Project**: mkt-videodesigner
> **Version**: 0.1.0
> **Author**: ksk@superplanet.net
> **Date**: 2026-08-16
> **Status**: Draft
> **Planning Doc**: [day1-render-fps.plan.md](day1-render-fps.plan.md)

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema Definition | N/A — 스키마 변경 없음 (상수 값만 바뀐다) |
| Phase 2 | [Coding Conventions](../../../01-plan/conventions.md) | ✅ |
| Phase 3 | Mockup | N/A — 기존 `.segmented` 패턴 재사용 |
| Phase 4 | API Spec | N/A — 브라우저 전용, 서버 API 없음 |

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

### 1.1 Design Goals

1. **표시와 상태를 하나로 묶는다.** 헤더에서 fps를 보여주던 자리가 그대로 fps를 바꾸는 자리가 된다. 두 개의 진실이 생길 여지를 없앤다.
2. **`render` 설정을 단일 렌더가 온전히 읽게 한다.** fps는 이미 (우연히) 반영되고 있고 profile은 누락돼 있다. 둘 다 명시적으로 전달한다.
3. **기본값 변경의 파급을 테스트에 국한한다.** 프로덕션 코드 변경은 상수 1줄 + JSX 1블록 + config 1줄이고, 나머지는 전부 기대값 갱신이다.

### 1.2 Design Principles

- **기존 스타일에 맞춘다.** 헤더 툴바는 이미 길이 프리셋 `.segmented`를 인라인으로 렌더한다. fps도 같은 방식으로 쓴다 (Option A 선택 근거).
- **파생은 하되 복제하지 않는다.** 프로파일별 fps 허용 목록은 `PROFILE_SPECS[profile].allowedFps` 한 곳에서만 나온다. 헤더와 BatchDialog가 각자 그것을 읽는다.
- **저장된 값을 존중한다.** `EDITOR_FPS`는 신규 프로젝트 초기값 전용이다. 기존 문서는 자기 fps를 유지한다.
- **계측기는 자기가 재는 것을 명시한다.** 벤치마크가 앱 기본값을 물려받으면 기본값이 바뀔 때 조용히 측정 대상이 바뀐다 (§8.4 D-06).

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| 기준 | A: 인라인 교체 | B: 공용 `FpsSegmented` | C: 헤더 전용 `StageFpsControl` |
|---|:-:|:-:|:-:|
| **Approach** | 칩 자리에 `.segmented` JSX 직접 작성 | 헤더·BatchDialog가 같은 컴포넌트 사용 | 헤더용 컴포넌트만 추출, BatchDialog 무변경 |
| **New Files** | 0 | 1 | 1 |
| **Modified Files** | 2 (프로덕션) | 4 | 2 |
| **New CSS** | 0 | 0 | 0 |
| **Complexity** | Low | Medium | Low |
| **Maintainability** | Medium (JSX 15줄 중복) | High | Medium |
| **Effort** | Low | Medium | Low |
| **Risk** | Low | Medium (범위 밖 파일 수정) | Low |
| **기존 스타일 일치** | **완전 일치** | 불일치 | 불일치 |
| **Plan §2.2 범위** | 준수 | **위반** | 준수 |

**Selected**: **Option A — 인라인 교체**

**Rationale**: bkit 템플릿의 기본 권장은 C지만 여기서는 A가 맞다. 헤더 툴바는 이미 길이 프리셋 세그먼트를 인라인으로 렌더하므로([EditorWorkspace.tsx:895-909](../../../../src/features/editor/EditorWorkspace.tsx)), fps만 컴포넌트로 빼면 바로 옆 형제와 구조가 어긋난다. 중복이라 부를 것도 JSX 15줄뿐이고, 실제 규칙인 `allowedFps`는 `PROFILE_SPECS` 단일 출처에서 파생되므로 복제되지 않는다. 프로젝트 CLAUDE.md §2("단일 용도 코드에 추상화 금지")·§3("주변 코드 스타일에 맞출 것)과도 일치한다.

B가 없애는 중복은 15줄인데, 그 대가로 `batch-fps-*` testid 유지를 위한 prefix prop이 붙고 Plan §2.2가 범위 밖으로 선언한 BatchDialog와 그 e2e 스펙까지 열어야 한다. 값어치가 맞지 않는다.

### 2.1 Component Diagram

```
                      domain/editor/constants.ts
                      EDITOR_FPS = 30
                              │
                              ▼
                      domain/editor/project.ts
                      createProject() → { fps, render: { fps, profile } }
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
  features/editor/projectStore.ts            domain/render/profile.ts
  setRenderFps / setRenderProfile            PROFILE_SPECS[profile].allowedFps
        │  (두 필드를 항상 함께 갱신)                  │  (허용 목록의 단일 출처)
        │                                           │
        ├───────────────┬───────────────────────────┤
        ▼               ▼                           ▼
  헤더 fps 세그먼트   BatchDialog fps 세그먼트    schema.ts refine
  (신규, 인라인)      (기존, 무변경)              render.fps ∈ allowedFps
        │
        ▼
  단일 렌더 EditorRenderConfig
  { fps: project.fps, profile: project.render.profile }   ← profile 신규
```

### 2.2 Data Flow

```
사용자가 헤더 30/60 클릭
  → store().setRenderFps(fps)
  → fpsForProfile(project.render.profile, fps)로 클램프
  → project.fps 와 project.render.fps 를 동시에 갱신
  → 헤더 세그먼트 재렌더 (project.fps 읽음)
  → BatchDialog 세그먼트도 같은 값 (project.render.fps 읽음)
  → Player durationInFrames/fps 재계산
  → 단일 렌더 config.fps / Batch snapshot.fps 에 반영
  → buildOutputFileName 의 {fps}fps 세그먼트에 반영
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| 헤더 fps 세그먼트 | `FRAME_RATES`, `PROFILE_SPECS` | 렌더할 항목과 프로파일별 허용 여부 |
| 헤더 fps 세그먼트 | `store().setRenderFps` | 상태 변경 (BatchDialog의 `onFps`와 동일 경로) |
| 단일 렌더 config | `project.render.profile` | 비트레이트 티어 |
| `createProject` | `EDITOR_FPS` | 신규 프로젝트 초기 fps |

---

## 3. Data Model

스키마 변경 없음. `editorProjectSchema`의 `fps`·`render.fps` 필드 정의와 [schema.ts:455](../../../../src/domain/editor/schema.ts)의 불변식은 그대로다. 바뀌는 것은 **초기값**뿐이다.

```typescript
// domain/editor/constants.ts — 유일한 값 변경
export const EDITOR_FPS = 30;   // was 60

// domain/editor/project.ts — 코드 무변경, 결과만 30이 된다
createProject() → {
  fps: EDITOR_FPS,                        // 30
  render: { fps: EDITOR_FPS, ... },       // 30
  render: { profile: DEFAULT_PROFILE },   // 'standard' — [60, 30] 허용
}
```

### 3.1 불변식: `project.fps === project.render.fps`

이 설계 전체가 기대는 성질이다. 두 필드를 쓰는 진입점은 둘뿐이고 둘 다 함께 갱신한다:

| Writer | `project.fps` | `project.render.fps` | 위치 |
|--------|:-------------:|:--------------------:|------|
| `createProject` | `EDITOR_FPS` | `EDITOR_FPS` | [project.ts:213, 224](../../../../src/domain/editor/project.ts) |
| `setRenderFps` | `fpsForProfile(...)` | `fpsForProfile(...)` | [project.ts:248-259](../../../../src/domain/editor/project.ts) |
| `setRenderProfile` | `fpsForProfile(...)` | `fpsForProfile(...)` | [project.ts:240-246](../../../../src/domain/editor/project.ts) |

**설계 결정 D-03**: 헤더는 **표시에 `project.fps`를, 쓰기에 `setRenderFps`를** 쓴다. 표시가 `project.fps`인 이유는 바로 아래 `<Player fps={project.fps}>`가 있어 헤더 칩이 그 Player를 설명하는 라벨로 읽히기 때문이다. 이 비대칭이 안전한 근거가 위 불변식이므로, 이를 **명시적 단위 테스트로 고정한다** (§8.2 U-03).

---

## 4. API Specification

N/A — 브라우저 전용 정적 앱이다. 서버 엔드포인트가 없다.

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
현재 (stage__toolbar):
┌──────────────────────────────────────────────────────────────┐
│ [15초│30초│60초]  │  (1080×1920)  (60fps)                     │
│  .segmented (인라인)  ↑divider  ↑chip      ↑chip 하드코딩 문자열 │
└──────────────────────────────────────────────────────────────┘

변경 후:
┌──────────────────────────────────────────────────────────────┐
│ [15초│30초│60초]  │  (1080×1920)  [30fps│60fps]               │
│  .segmented         │divider  ↑chip 유지  ↑.segmented (신규)   │
└──────────────────────────────────────────────────────────────┘
```

**D-01 — 제자리 교체.** 칩과 세그먼트의 순서를 바꾸지 않는다. `output-size` 칩(읽기 전용 결과)을 divider 왼쪽으로 옮겨 "왼쪽=조작 / 오른쪽=결과"로 재편하는 안도 있었으나, 이 사이클의 요구와 무관한 레이아웃 변경이라 채택하지 않았다. `1080×1920` 다음에 `[30fps│60fps]`가 오는 순서는 "결과 → 그 결과를 바꾸는 컨트롤"로 자연스럽게 읽힌다.

**D-02 — 신규 CSS 0줄.** `.segmented` / `.segmented__item` / `.segmented__item--on` / `:disabled`가 [styles.css:120-157](../../../../src/app/styles.css)에 이미 있고, `.stage__toolbar`가 이미 `.segmented` 자식(길이 프리셋)을 담고 있다. Plan §5 R3(칩 스타일과 어긋남)은 **실현되지 않는다** — 이 설계 단계에서 해소된 위험으로 기록한다.

### 5.2 User Flow

```
편집 중 → 헤더 [30fps│60fps] 클릭 → 즉시 Player 재계산 → 렌더 시 반영
                    │
                    └─ 프로파일이 fast 이면 60 버튼 disabled (누를 수 없음)
                    └─ 렌더 중이면 두 버튼 모두 disabled

Batch 다이얼로그를 열면 → batch-fps-* 가 같은 값을 이미 보여줌 (동기화 불필요)
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| 헤더 fps 세그먼트 (인라인 JSX) | `src/features/editor/EditorWorkspace.tsx` `.stage__toolbar` 내부 | `project.fps` 표시 + `setRenderFps` 호출 |
| `BatchDialog` fps 세그먼트 | `src/features/editor/BatchDialog.tsx` | **무변경** |

### 5.4 Page UI Checklist

#### Editor 헤더 (`.stage__toolbar`)

- [ ] Segmented: fps 선택 (2개 항목 — `30fps`, `60fps`), `role="group"`, `aria-label="프레임 레이트"`
- [ ] Button: `data-testid="stage-fps-30"`, 라벨 `30fps`, `aria-pressed`가 `project.fps === 30`을 반영
- [ ] Button: `data-testid="stage-fps-60"`, 라벨 `60fps`, `aria-pressed`가 `project.fps === 60`을 반영
- [ ] Disabled: 프로파일이 `fast`일 때 `stage-fps-60`이 `disabled`
- [ ] Disabled: `isRendering`일 때 두 버튼 모두 `disabled`
- [ ] Chip: `data-testid="output-size"` — 기존 그대로 유지, 위치 변경 없음
- [ ] 제거: 하드코딩된 `<span className="stage__chip">60fps</span>`가 더 이상 존재하지 않을 것

#### Batch 다이얼로그

- [ ] 회귀 없음: `batch-fps-30` / `batch-fps-60`의 동작과 `aria-pressed`가 그대로일 것 (기본 선택만 30으로 이동)

---

## 6. Error Handling

이 기능에는 실패 경로가 사실상 없다. 잘못된 입력은 타입과 클램프로 흡수된다.

| 상황 | 처리 | 근거 |
|------|------|------|
| 프로파일이 허용하지 않는 fps 클릭 | 버튼이 `disabled`라 클릭 자체가 불가 | FR-03 |
| 그럼에도 `setRenderFps`가 불허 값으로 호출됨 (프로그램적 경로) | `fpsForProfile`이 프로파일의 첫 허용값으로 클램프 | [project.ts:252](../../../../src/domain/editor/project.ts) — 기존 동작 |
| 저장 문서의 `render.fps`가 프로파일 허용 목록 밖 | `parseProject` 실패 → `PROJECT_INVALID` | [schema.ts:455](../../../../src/domain/editor/schema.ts) — 기존 동작 |
| 렌더 중 fps 변경 시도 | 버튼 `disabled` | FR-04. 진행 중인 job은 이미 스냅샷을 얼려둔 상태라 값이 바뀌어도 오염되지 않지만, UI가 거짓말하지 않도록 잠근다 |

**새 에러 코드를 추가하지 않는다.**

---

## 7. Security Considerations

N/A — 사용자 입력이 두 개의 미리 정의된 정수(`30`, `60`) 중 택일이고, 네트워크·저장소·인증 표면을 건드리지 않는다. 브라우저 로컬 전용이다.

---

## 8. Test Plan

이 기능은 서버가 없으므로 템플릿의 L1(API)은 적용되지 않는다. **U(단위) / L2(UI 액션) / L3(E2E) 3층**으로 대체한다.

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| U: 단위 | fps 불변식, 프레임 배분 | Vitest | Do |
| L2: UI 액션 | 헤더 세그먼트 동작·비활성 조건 | Playwright | Do |
| L3: E2E | fps 변경이 출력 파일명까지 도달 | Playwright | Do |

### 8.2 U: 단위 테스트 시나리오

| # | ID | 대상 | 시나리오 | 기대 |
|---|---|------|---------|------|
| 1 | U-01 | `createProject` | 신규 프로젝트의 fps | `project.fps === 30 && project.render.fps === 30` |
| 2 | U-02 | `allocateSceneFrames` | 30fps에서 프리셋 총 프레임 일치 | 15초 → `[60, 300, 90]` (합 450), 60초 → `[90, 1620, 90]` (합 1800) |
| 3 | U-03 | `setRenderFps` / `setRenderProfile` | **불변식 §3.1** | 어떤 호출 순서로도 `project.fps === project.render.fps` |
| 4 | U-04 | `setRenderFps` | `fast` 프로파일에서 60 요청 | 30으로 클램프됨 (기존 동작 회귀 확인) |
| 5 | U-05 | `parseProject` | 기본 프로젝트가 스키마 불변식 통과 | `standard` + 30fps 조합이 유효 |
| 6 | U-06 | `parseProject` | 저장된 60fps 문서 | 60이 30으로 바뀌지 않고 그대로 파싱 |

**U-02 계산 근거**: `allocateSceneFrames([2000,10000,3000], 15, 30)` → `msToFrames`로 각 `[60, 300, 90]`, 합 450 = `15 × 30`. `allocateSceneFrames([3000,54000,3000], 60, 30)` → `[90, 1620, 90]`, 합 1800 = `60 × 30`. 구현 시 실제 실행값으로 재확인한다.

### 8.3 L2: UI 액션 테스트 시나리오

| # | Page | Action | Expected Result |
|---|------|--------|----------------|
| 1 | Editor | 로드 | `stage-fps-30`이 `aria-pressed="true"`, `stage-fps-60`은 `"false"` |
| 2 | Editor | `stage-fps-60` 클릭 | `stage-fps-60`이 `aria-pressed="true"`로 전환 |
| 3 | Editor | 60 선택 후 Batch 열기 | `batch-fps-60`도 `aria-pressed="true"` (FR-06 동기화) |
| 4 | Batch | `batch-fps-30` 클릭 후 다이얼로그 닫기 | 헤더 `stage-fps-30`이 `aria-pressed="true"` (역방향 동기화) |
| 5 | Batch | `batch-profile-fast` 선택 후 닫기 | 헤더 `stage-fps-60`이 `disabled` |
| 6 | Editor | 렌더 진행 중 | `stage-fps-30`·`stage-fps-60` 모두 `disabled` |
| 7 | Editor | 전체 툴바 | 텍스트가 "60fps"인 `.stage__chip`이 존재하지 않음 (하드코딩 제거 검증) |

### 8.4 L3: E2E 시나리오

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-----------------|
| 1 | 기본 30fps 산출물 | 소재 업로드 → MP4 렌더 → 다운로드 | 파일명이 `..._15s_30fps.mp4` |
| 2 | 헤더에서 60 선택 후 렌더 | 60 클릭 → 렌더 → 다운로드 | 파일명이 `..._15s_60fps.mp4` |
| 3 | 프로파일이 단일 렌더에 도달 (FR-05) | Batch에서 `high` 선택 → 닫기 → 단일 렌더 | 렌더 요청의 `videoBitrate`가 `highest` |

**기존 e2e 기대값 갱신 (Plan §6.2 누락분)** — 아래 6곳은 60fps 기본값을 전제로 쓰였으므로 반드시 함께 고친다:

| # | 파일 | 위치 | 현재 | 변경 |
|---|------|------|------|------|
| 1 | [pages-subpath.spec.ts](../../../../tests/e2e/pages-subpath.spec.ts) | :111 | `ua-video_ko_9x16_15s_60fps.mp4` | `_30fps.mp4` |
| 2 | [editor-vertical-slice.spec.ts](../../../../tests/e2e/editor-vertical-slice.spec.ts) | :245 | `ua-video_ko_9x16_15s_60fps.mp4` | `_30fps.mp4` |
| 3 | [editor-full.spec.ts](../../../../tests/e2e/editor-full.spec.ts) | :127 | `ua-video_ko_1x1_15s_60fps.mp4` | `_30fps.mp4` |
| 4 | [day1-template.spec.ts](../../../../tests/e2e/day1-template.spec.ts) | :260 | `ua-video_ko_${spec.file}_15s_60fps.mp4` | `_30fps.mp4` |
| 5 | [day1-template.spec.ts](../../../../tests/e2e/day1-template.spec.ts) | :610 | `v1-regression_ko_9x16_15s_60fps.mp4` | `_30fps.mp4` |
| 6 | [batch-render.spec.ts](../../../../tests/e2e/batch-render.spec.ts) | :35 | `batch-fps-60`이 기본 `aria-pressed="true"` | `batch-fps-30`이 기본 `"true"` (주석 "Standard defaults to 1080p60"도 함께 수정) |

**D-06 — `day1-longform.spec.ts`는 60fps를 명시적으로 고정한다.**
이 스펙은 fps를 지정하지 않고 앱 기본값을 물려받는 opt-in 벤치마크다. 60초 프리셋 × 60fps = 3600프레임에서 디코더 누수를 보려고 만들어졌는데, 기본값이 30이 되면 코드 변경 없이 1800프레임을 재게 되어 **측정 대상이 조용히 절반으로 가벼워진다**. 렌더 직전에 `stage-fps-60`을 클릭해 60을 명시하고, 파일 상단 주석에 "기본값이 아니라 이 스펙이 60을 고정한다"를 남긴다. 60fps는 여전히 선택 가능하므로 3600프레임은 실제 도달 가능한 최악 조건이다.

### 8.5 Seed Data Requirements

N/A — 기존 `tests/fixtures/`의 영상 픽스처를 그대로 쓴다. 신규 픽스처 없음.

---

## 9. Clean Architecture

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | 헤더 세그먼트 JSX, BatchDialog | `src/features/editor/*.tsx` |
| **Application** | 스토어 액션 | `src/features/editor/projectStore.ts` |
| **Domain** | `EDITOR_FPS`, `createProject`, `setRenderFps`, `PROFILE_SPECS`, 스키마 | `src/domain/editor/`, `src/domain/render/` |
| **Infrastructure** | 렌더 어댑터 | `src/infrastructure/render/` |

### 9.2 Dependency Rules

의존 방향에 변화 없음. 헤더 세그먼트는 Presentation → Domain(`PROFILE_SPECS`, `FRAME_RATES`) + Application(`store()`)만 참조한다. 이는 BatchDialog가 이미 하고 있는 것과 동일하다.

### 9.4 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| 헤더 fps 세그먼트 | Presentation | `src/features/editor/EditorWorkspace.tsx` |
| 단일 렌더 config 조립 | Presentation | `src/features/editor/EditorWorkspace.tsx` `startRender` |
| `EDITOR_FPS` | Domain | `src/domain/editor/constants.ts` |

---

## 10. Coding Convention Reference

### 10.4 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| testid 명명 | `stage-fps-30` / `stage-fps-60` — 기존 `batch-fps-*`와 대칭, 소속 영역을 접두어로 |
| 세그먼트 마크업 | `.segmented` + `role="group"` + `aria-label` + 항목별 `aria-pressed` (BatchDialog와 동일) |
| 상수 | `UPPER_SNAKE_CASE` — `EDITOR_FPS` 유지 |
| 주석 | 기존 `// Design Ref: §N — ...` 관행 유지. 신규 코드는 이 문서의 D-번호와 FR-번호를 참조 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
src/
├── domain/editor/constants.ts              EDITOR_FPS 60 → 30                    [1줄]
├── features/editor/EditorWorkspace.tsx     헤더 칩 → 세그먼트                     [~18줄]
│                                           startRender config 에 profile 추가     [1줄]
├── domain/timeline/timeline.test.ts        하드코딩 프레임 기대값                  [2줄]
├── domain/editor/project.test.ts           U-01, U-03 추가 + 테스트 이름           [~15줄]
└── tests/e2e/
    ├── pages-subpath.spec.ts               파일명 기대값                          [1줄]
    ├── editor-vertical-slice.spec.ts       파일명 기대값                          [1줄]
    ├── editor-full.spec.ts                 파일명 기대값                          [1줄]
    ├── day1-template.spec.ts               파일명 기대값 2곳                       [2줄]
    ├── batch-render.spec.ts                기본 선택 30으로                        [~4줄]
    ├── day1-longform.spec.ts               60fps 명시 고정 (D-06)                  [~4줄]
    └── editor-full.spec.ts                 L2/L3 신규 케이스                       [~40줄]
```

**신규 파일 0개. 신규 CSS 0줄.** 프로덕션 코드 변경은 3곳 20줄이고 나머지는 테스트다.

### 11.2 Implementation Order

1. [ ] `EDITOR_FPS = 30` → verify: `pnpm vitest run` 으로 **깨지는 테스트 목록을 먼저 확인** (예상: `timeline.test.ts` 2건)
2. [ ] `timeline.test.ts` 기대값 갱신 → verify: 유닛 전체 통과
3. [ ] U-01 / U-03 / U-06 추가 → verify: 신규 테스트 통과
4. [ ] 헤더 칩 → 세그먼트 교체 → verify: `tsc -b`, `pnpm lint`, 육안으로 헤더 확인
5. [ ] `startRender` config 에 `profile` 추가 → verify: `tsc -b`
6. [ ] e2e 기대값 6곳 갱신 (§8.4 표) → verify: `npx playwright test`
7. [ ] L2/L3 신규 케이스 추가 → verify: 신규 e2e 통과
8. [ ] `day1-longform.spec.ts` 60fps 고정 (D-06) → verify: `DAY1_LONGFORM=1`로 1회 실행 (시간이 걸리므로 선택적)

**1번을 먼저 하는 이유**: 상수를 바꾸고 테스트를 돌리면 영향 범위가 추측이 아니라 실측으로 나온다. Plan이 e2e 6곳을 놓쳤던 것과 같은 누락을 여기서 잡는다.

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| M1 | `module-1` | `EDITOR_FPS` 변경 + 유닛 테스트 갱신·추가 (구현 순서 1-3) | 1 |
| M2 | `module-2` | 헤더 세그먼트 + 단일 렌더 profile (구현 순서 4-5) | 1 |
| M3 | `module-3` | e2e 기대값 갱신 + 신규 케이스 + longform 고정 (구현 순서 6-8) | 1 |

#### Recommended Session Plan

규모가 작아 **한 세션에 전부 끝내는 것을 권장한다**. `/pdca do day1-render-fps` (스코프 없이) 로 실행하고, 중간에 끊길 경우에만 `--scope module-N`으로 재개한다.

M1 → M2 → M3 순서는 지켜야 한다. M1이 실측으로 영향 범위를 확정하고, M3의 e2e는 M2의 신규 testid에 의존한다.

---

## 12. Design Decisions

| ID | Decision | Alternatives | Rationale |
|----|----------|--------------|-----------|
| D-01 | 헤더에서 칩을 **제자리 교체**한다 | 컨트롤을 divider 왼쪽으로 모으는 재배치 | 요구와 무관한 레이아웃 변경. "결과 → 그것을 바꾸는 컨트롤" 순서도 자연스럽게 읽힌다 |
| D-02 | 신규 CSS 0줄, 기존 `.segmented` 재사용 | `.stage__chip` 크기에 맞춘 전용 스타일 | 툴바가 이미 `.segmented`(길이 프리셋)를 담고 있어 시각적으로 형제가 된다. **Plan R3는 실현되지 않는 위험으로 판정** |
| D-03 | 표시는 `project.fps`, 쓰기는 `setRenderFps` | 양쪽 다 `render.fps` 사용 | 헤더 칩은 바로 아래 `<Player fps={project.fps}>`의 라벨로 읽힌다. 비대칭의 안전성은 §3.1 불변식이 보장하며 U-03으로 고정한다 |
| D-04 | 인라인 JSX (Option A) | 공용/전용 컴포넌트 추출 | 옆 형제인 길이 프리셋이 인라인이다. 중복 15줄 < 스타일 불일치 + 범위 확장 |
| D-05 | 단일 렌더 `profile` 누락을 같이 고친다 | 별도 사이클 | 같은 config 리터럴, 같은 원인. 변경량 1줄 |
| D-06 | `day1-longform.spec.ts`가 60fps를 명시 고정 | 기본값 상속(30fps)으로 방치 | 벤치마크는 최악 조건(3600프레임)을 재야 하고, 물려받으면 다음 기본값 변경 때 또 조용히 흔들린다 |
| D-07 | 저장된 60fps 프로젝트를 30으로 강제하지 않는다 | 일괄 마이그레이션 | `EDITOR_FPS`는 초기값 전용이다. 사용자가 명시적으로 정한 값을 앱이 뒤엎지 않는다 (U-06) |

---

## 13. Open Questions

없음. Plan에서 열려 있던 항목(fps 컨트롤 위치, profile 포함 여부, longform 처리)은 전부 확정됐다.

**Do 단계로 넘기는 실측 항목**: §8.2 U-02의 프레임 기대값 `[60,300,90]` / `[90,1620,90]`은 계산으로 도출했다. 구현 시 실제 실행 결과로 재확인한다 (구현 순서 1번이 이 목적을 겸한다).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-16 | 최초 작성. Option A 선택. Plan이 놓친 e2e 6곳과 longform 벤치마크 영향 추가 | ksk@superplanet.net |
