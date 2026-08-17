# day1-endcard-video Planning Document

> **Summary**: Day1 엔드카드에 "영상 1개" 방식을 기존 "배너 PNG + 앱아이콘 PNG" 방식의 대안으로 추가하고, 둘 중 하나를 택일하게 한다.
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
| **Problem** | 엔드카드가 완성 배너 PNG로 고정되어 있어, 일러스트를 애니메이션한 영상을 마지막 3초에 쓰려면 방법이 없다. 배너디자이너 산출물 외의 표현을 시도할 수 없다. |
| **Solution** | `endCard.mode` 플래그(`'banner'` \| `'video'`)를 추가하고 영상 슬롯·트림을 붙인다. 기존 필드는 전부 보존하므로 두 안을 오가도 반대편 설정이 살아남고, zod `.default('banner')` 덕에 마이그레이션 코드가 필요 없다. |
| **Function/UX Effect** | 인스펙터 엔드카드 섹션에서 2안 택일. 영상 모드에서는 아이콘 관련 컨트롤이 사라지고 TrimStrip이 나타나 3초 창을 눈으로 고른다. 3초 미만 영상은 루프로 채워 렌더를 막지 않는다. |
| **Core Value** | 엔드카드가 "배너디자이너가 뽑아준 것"에서 "무엇이든 3초"로 바뀐다. 광고 소재의 마지막 3초를 실험 대상으로 되돌린다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 엔드카드 표현이 완성 배너 PNG 하나로 고정되어 있어 애니메이션 엔드카드를 만들 수 없다 |
| **WHO** | Day1 템플릿으로 UA 소재를 뽑는 퍼포먼스 마케터 (본인) |
| **RISK** | 3초 미만 영상의 루프 이음선(seam)이 눈에 띄는 것 / `@remotion/media` `<Video>` + `<Loop>` 조합이 이 프로젝트에서 미검증인 것 |
| **SUCCESS** | 두 안 택일이 저장·재열기 후에도 유지되고, 기존 v2 프로젝트가 마이그레이션 코드 없이 그대로 열리며, 영상 엔드카드가 미리보기와 렌더에서 동일하게 3초를 채운다 |
| **SCOPE** | M1 스키마·커맨드 / M2 업로드·트림 / M3 컴포지션 / M4 인스펙터 UI |

---

## 1. Overview

### 1.1 Purpose

엔드카드 구간(고정 3초)의 표현 방식을 두 가지 중 택일로 만든다.

- **1안 (기존)**: 완성 배너 PNG를 배경으로 깔고, 앱아이콘 PNG를 규격별 고정 좌표에 오버레이해 애니메이션한다.
- **2안 (신규)**: 일러스트를 애니메이션한 영상 1개를 엔드카드 구간에 재생한다.

동시 사용이 아니라 택일이다.

### 1.2 Background

현재 엔드카드는 `mkt_bannerdesigner` 산출물을 전제로 설계돼 있다. `APP_ICON_RECT`가 배너디자이너 CSS에서 그대로 옮겨온 상수이고, 아이콘 오버레이의 존재 이유 자체가 "배너에 이미 구워진 아이콘 위에 정확히 겹쳐 애니메이션을 얹기 위함"이다([endCard.ts](../../../../src/domain/day1/endCard.ts), [EndCardScene.tsx](../../../../src/compositions/day1/EndCardScene.tsx)).

이 구조는 배너디자이너를 거친 소재에는 잘 맞지만, 그 바깥을 시도할 수 없다. 영상 컴포넌트([SceneVideo.tsx](../../../../src/compositions/shared/SceneVideo.tsx))와 트림 UI([TrimStrip.tsx](../../../../src/features/editor/TrimStrip.tsx))는 직전 사이클에서 이미 만들어져 분할 구간이 쓰고 있으므로, 엔드카드에 영상을 붙이는 데 필요한 부품은 대부분 존재한다.

### 1.3 Related Documents

- 직전 사이클: `docs/archive/2026-08/day1-trim-ux/` (TrimStrip, `day1PanelsShorterThanSection`)
- 선행 사이클: **`day1-render-fps`** — `EDITOR_FPS`를 30으로 내리는 작업. 컴포지션 fps가 바뀌면 이 사이클의 엔드카드 영상 재생·모션 타이밍이 그 위에서 돌아가므로 **먼저 착수한다**.
- 기존 엔드카드 설계: `docs/archive/*/day1*/` §5.3 EndCardScene, §4.3 End Card Geometry

---

## 2. Scope

### 2.1 In Scope

- [ ] `endCard.mode` 플래그와 영상 슬롯·트림을 스키마에 추가 (기존 필드 전부 보존)
- [ ] 엔드카드 영상 업로드 경로 (`probeImage` → 슬롯별로 `probe`/`probeImage` 분기)
- [ ] `EndCardScene`이 영상 모드를 렌더 (무음, 3초 미만이면 루프)
- [ ] 3초 이상 영상에 TrimStrip 배선 (`sectionDurationMs=3000`)
- [ ] 인스펙터 엔드카드 섹션의 모드 토글과 조건부 컨트롤 노출
- [ ] 기존 v2 저장 프로젝트가 그대로 열리는지 검증

### 2.2 Out of Scope

- 엔드카드 길이(3초)를 사용자가 조절하는 기능 — `DAY1_END_CARD_MS`는 상수로 유지
- 영상 위에 앱아이콘을 겹치는 하이브리드 — 택일이 요구사항
- 엔드카드 영상의 리프레이밍(scale/x/y) — cover 고정
- 엔드카드 영상의 오디오 사용 — 무음 고정 (§3.1 FR-06 참조)
- three-scene 템플릿의 CTA 장면 — 이 사이클은 Day1만 건드린다
- fps 30/60 관련 작업 일체 — **`day1-render-fps` 사이클로 분리**

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `endCard.mode: 'banner' \| 'video'`를 추가한다. zod `.default('banner')`로 선언해 기존 v2 문서가 마이그레이션 코드 없이 파싱을 통과해야 한다 | High | Pending |
| FR-02 | `endCard.video: MediaReference \| null` 슬롯과 `endCard.videoTrim: MediaTrim`을 추가한다. 기존 `banner`/`appIcon`/`iconAdjust`/`iconAnimation`/`cardMotion`은 그대로 둔다 | High | Pending |
| FR-03 | 업로드 경로가 슬롯 종류에 따라 갈린다. `banner`/`appIcon`은 `resolver.probeImage`, `video`는 `resolver.probe`를 호출한다 | High | Pending |
| FR-04 | `mode === 'video'`일 때 `EndCardScene`이 배너·아이콘 대신 영상을 cover로 재생한다 | High | Pending |
| FR-05 | 엔드카드 영상은 무음으로 렌더한다. 옵션을 노출하지 않는다 (Day1 패널 영상이 이미 `muted`인 것과 동일) | High | Pending |
| FR-06 | 원본이 3초보다 짧으면 3초를 채울 때까지 루프한다. 렌더를 차단하지 않는다 | High | Pending |
| FR-07 | 원본이 3초 이상이면 TrimStrip으로 3초 창을 고른다. 창 길이는 3000ms 고정이고 위치만 움직인다 | High | Pending |
| FR-08 | `cardMotion`은 두 안 모두에서 전체 프리셋(`none`/`fade`/`ken-burns`)을 유지한다 | Medium | Pending |
| FR-09 | 영상 모드에서는 배너·아이콘 업로드 필드, 아이콘 애니메이션, 아이콘 X/Y/scale 미세조정을 숨긴다. 배너 모드에서는 영상 필드와 TrimStrip을 숨긴다 | Medium | Pending |
| FR-10 | 영상 모드인데 영상이 없으면 "마지막 구간이 빈 화면으로 렌더됩니다" 경고를 띄운다. 렌더는 차단하지 않는다 (기존 `day1-banner-missing`과 동일한 수위) | Medium | Pending |
| FR-11 | 3초 미만 영상을 올리면 "루프로 채워집니다" 비차단 안내를 인스펙터에 띄운다 | Low | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 하위 호환 | 기존 v2 저장 프로젝트가 코드 변경 없이 열린다 | `migrate.test.ts`에 `mode` 없는 v2 픽스처 추가 → `parseProject` 통과 확인 |
| 왕복 무손실 | 저장 → 재열기 후 `mode`/`video`/`videoTrim`이 보존된다 | `projectFile.test.ts` 라운드트립 단언 |
| 미리보기-렌더 일치 | Player와 MP4 출력의 엔드카드가 동일하다 | 하나의 스냅샷(`buildEditorSnapshot`)만 소비하는 기존 구조 유지 |
| 스키마 불변식 | 잘못된 조합이 `parseProject`에서 걸린다 | `schema.test.ts` |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] SC1 — 인스펙터에서 배너↔영상 모드를 오갈 수 있고, 오간 뒤에도 반대편 설정(배너 파일, 아이콘 미세조정)이 보존된다
- [ ] SC2 — `mode` 필드가 없는 기존 v2 프로젝트 문서가 그대로 열리고 `mode === 'banner'`로 해석된다 (마이그레이션 함수 추가 없이)
- [ ] SC3 — 5초 영상을 엔드카드에 올리면 TrimStrip이 나타나고, 창을 옮긴 위치의 3초가 미리보기와 MP4에 동일하게 나온다
- [ ] SC4 — 2초 영상을 올리면 렌더가 차단되지 않고 3초 구간이 루프로 채워진다 (검은 프레임 0)
- [ ] SC5 — 영상 모드 엔드카드에서 소스 오디오가 출력에 섞이지 않는다
- [ ] SC6 — 배너 모드의 기존 동작(아이콘 좌표 자동 배치, 아이콘 애니메이션, 카드 모션)에 회귀가 없다

### 4.2 Quality Criteria

- [ ] 신규 도메인 로직(모드 전환 커맨드, 루프 프레임 계산, 트림 창)에 단위 테스트
- [ ] `pnpm lint` 무경고, `tsc -b` 통과
- [ ] 기존 테스트 전부 통과 (`day1Commands.test.ts`, `day1Props.test.ts`, `endCard.test.ts`, `migrate.test.ts`, `projectFile.test.ts`)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| R1 — 3초 미만 영상의 루프 이음선이 눈에 띈다. 일러스트 애니메이션은 보통 루프용으로 만들어지지 않는다 | Medium | High | 사용자가 선택한 동작이므로 막지 않는다. FR-11의 비차단 안내로 "루프됨"을 미리 알리고, 이음선 판단은 미리보기에 맡긴다 |
| R2 — `@remotion/media`의 `<Video>`와 remotion `<Loop>` 조합이 이 프로젝트에서 미검증. `trimBefore`가 걸린 `<Video>`를 `<Loop>`로 감쌀 때 프레임 기준이 어긋날 수 있다 | High | Medium | Design 단계에서 이 조합을 먼저 확정한다. 루프는 3초 미만일 때만 필요하고 그때는 트림이 무의미하므로 (창이 소스 전체를 덮음) **"루프 경로에는 trim을 걸지 않는다"**로 두 기능을 직교시키는 방향을 우선 검토 |
| R3 — `mode` 플래그 방식은 "video 모드인데 banner도 채워진" 상태를 타입으로 막지 못한다 | Low | High | 의도된 트레이드오프. 무효 상태가 아니라 비활성 상태이며, 안을 오갈 때 설정을 보존하는 것이 이 선택의 목적이다. 렌더 prop 빌더가 `mode`를 단일 진실로 삼아 분기하므로 실제 출력은 모호해지지 않는다 |
| R4 — 엔드카드가 영상이 되면 마지막 3초의 디코딩 부하가 늘어 브라우저 렌더 시간이 증가한다 | Low | Medium | 3초·단일 소스라 분할 구간(2개 동시 디코딩)보다 가볍다. Check 단계에서 렌더 시간만 기록하고 기준 미달 시 별도 처리 |
| R5 — 선행 `day1-render-fps` 사이클이 `EDITOR_FPS`를 바꾸면 이 사이클의 프레임 계산 전제가 바뀐다 | Medium | High | 순서를 고정한다. fps 사이클 완료 후 이 사이클의 Do를 시작하고, 모든 길이 계산을 ms로 표현해 fps 의존을 프레임 변환 지점 한 곳으로 몰아둔다 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `day1SettingsSchema.endCard` | Zod Schema | `mode`(default `'banner'`), `video`, `videoTrim` 필드 추가. 기존 필드 무변경 |
| `Day1EndCardRenderProps` | Type | 렌더 prop에 영상 분기 추가 (`mode`, `videoUrl`, 트림/루프 프레임) |
| `EndCardScene` | Component | `mode`에 따라 `<Img>` 2장 경로와 영상 경로로 분기 |
| `Day1EndCardSlot` | Type | `'banner' \| 'appIcon'` → `'video'` 추가 |
| `setEndCardAsset` | Hook | 슬롯별 probe 분기 (`probe` vs `probeImage`) |
| `endCard` 관련 커맨드 | Domain | 모드 전환 커맨드, 영상 트림 커맨드 추가 |
| `Day1Inspector` "엔드카드" 섹션 | Component | 모드 토글 + 조건부 렌더 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `endCard` 스키마 | READ (parse) | [migrate.ts](../../../../src/domain/editor/migrate.ts) → `parseProject` | **검증 필요** — `mode` 없는 v2 문서. zod `.default()`로 통과해야 함 (SC2) |
| `endCard` 스키마 | READ/WRITE | [projectFile.ts](../../../../src/domain/editor/projectFile.ts) | **검증 필요** — 저장·불러오기 왕복에서 신규 필드 보존 |
| `endCard` 스키마 | READ | [schema.ts:455 불변식](../../../../src/domain/editor/schema.ts) `refineDay1` | **검증 필요** — 영상 모드에 맞는 불변식 필요 여부 판단 |
| `Day1EndCardRenderProps` | BUILD | [project.ts](../../../../src/domain/editor/project.ts) prop 빌더 (`iconRect` 계산 지점) | **Breaking** — 분기 추가 |
| `Day1EndCardRenderProps` | READ | [EndCardScene.tsx](../../../../src/compositions/day1/EndCardScene.tsx) | **Breaking** — 영상 경로 추가 |
| `Day1EndCardRenderProps` | TEST | [day1Props.test.ts](../../../../src/domain/editor/day1Props.test.ts) | **검증 필요** — 기존 단언 유지 + 영상 케이스 추가 |
| `appIconRect` / `APP_ICON_RECT` | READ | prop 빌더, [endCard.test.ts](../../../../src/domain/day1/endCard.test.ts) | **None** — 배너 모드 전용, 손대지 않음 |
| `setEndCardAsset` | CALL | [Day1Inspector.tsx](../../../../src/features/editor/Day1Inspector.tsx) `onEndCardAsset` | **Breaking** — 슬롯 유니온 확장 |
| `TrimStrip` | RENDER | [Day1Inspector.tsx](../../../../src/features/editor/Day1Inspector.tsx) 패널 트림 | **None** — 원시값 props라 새 호출부만 추가 |
| `SceneVideo` | RENDER | [SplitFrame.tsx](../../../../src/compositions/day1/SplitFrame.tsx) | **검증 필요** — 재사용 시 엔드카드가 요구하는 `<Loop>` 조합이 기존 사용처에 영향 없어야 함 |
| `day1PanelsShorterThanSection` | CALL | [useRenderQueue.ts](../../../../src/features/editor/useRenderQueue.ts), [EditorWorkspace.tsx](../../../../src/features/editor/EditorWorkspace.tsx) | **None** — 엔드카드는 루프로 채우므로 이 게이트를 확장하지 않는다 |
| `DAY1_END_CARD_MS` | READ | [playback.ts](../../../../src/domain/day1/playback.ts) `day1SectionDurations` | **None** — 3초 고정 유지 |

### 6.3 Verification

- [ ] `mode` 없는 v2 픽스처가 `parseProject`를 통과하고 `'banner'`로 해석된다
- [ ] 저장 → 불러오기 왕복에서 `mode`/`video`/`videoTrim`이 보존된다
- [ ] 배너 모드 기존 테스트(`day1Props`, `endCard`, `day1Commands`)가 수정 없이 통과한다
- [ ] `SceneVideo`의 기존 사용처(분할 구간)에 회귀가 없다

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Selected |
|-------|:--------:|
| Starter | ☐ |
| Dynamic | ☐ |
| **Enterprise** (기존 구조: `domain/` · `features/` · `infrastructure/` · `compositions/`) | ☑ |

기존 프로젝트의 레이어 분리를 그대로 따른다. 신규 레벨 선택 없음.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 엔드카드 스키마 | 판별 유니온(`kind`) / 모드 플래그 + 슬롯 | **모드 플래그 + 슬롯** | 두 안이 `cardMotion`을 공유하고, 안을 오갈 때 반대편 설정 보존이 UX상 필요하다. zod `.default('banner')`로 마이그레이션 코드가 0줄이 된다. 대가인 "표현 가능한 비활성 상태"는 prop 빌더가 `mode`를 단일 진실로 삼아 흡수한다 |
| 3초 미만 영상 처리 | 차단 / 마지막 프레임 정지 / **루프** | **루프** | 엔드카드 3초는 상수라 사용자에게 구간을 줄일 레버가 없다. 차단은 곧 "영상을 다시 뽑아오세요"가 되므로, 렌더를 막지 않는 쪽을 택했다. 이음선 위험(R1)은 비차단 안내로 알린다 |
| 트림 UI | 신규 / **TrimStrip 재사용** | **TrimStrip 재사용** | 원시값 props라 `sectionDurationMs=3000`으로 배선만 하면 된다. 소스가 구간보다 짧을 때 창이 트랙 전체를 덮고 멈추는 동작(FR-S05)이 루프 케이스와도 맞물린다 |
| 엔드카드 영상 오디오 | 사용 / **무음** | **무음** | Day1 패널 영상이 이미 `muted`이고, 프로젝트 오디오 트랙이 전체 타임라인에 깔린다. 마지막 3초만 소스 오디오가 섞이면 믹스가 튄다. 옵션 자체를 만들지 않는다 |
| 카드 모션 | 전체 유지 / 일부 제외 / 숨김 | **전체 유지** | `fade`는 분할 구간→엔드카드 전환에 여전히 유용하다. `ken-burns`가 영상 위에서 이중 모션이 되는 것은 미리보기에서 즉시 보이므로, 제외 로직으로 불변식을 늘리지 않는다 |
| 상태 관리 | (기존) Zustand `projectStore` | 기존 유지 | 변경 없음 |
| 테스트 | (기존) Vitest | 기존 유지 | 변경 없음 |

### 7.3 Clean Architecture Approach

```
domain/editor/schema.ts        endCard.mode / video / videoTrim
domain/editor/types.ts         Day1EndCardRenderProps 분기
domain/editor/project.ts       모드 전환·트림 커맨드, prop 빌더 분기
        ↓
compositions/day1/EndCardScene.tsx    mode 분기 렌더 (Img 2장 | Video)
compositions/shared/SceneVideo.tsx    (재사용 검토)
        ↓
features/editor/useDay1Assets.ts      슬롯별 probe 분기
features/editor/Day1Inspector.tsx     모드 토글 + 조건부 컨트롤 + TrimStrip
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md` 코딩 가이드라인 존재 (프로젝트 루트)
- [x] ESLint / Prettier / TypeScript 설정 존재
- [x] Design Ref 주석 관행 존재 (`// Day1 Design Ref: §5.3 — ...`)
- [x] `data-testid` 명명 관행 존재 (`day1-endcard-*`, `day1-icon-*`)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| testid 명명 | 존재 | 신규: `day1-endcard-mode-banner` / `day1-endcard-mode-video` / `day1-endcard-video` / `day1-endcard-trim-*` | Medium |
| Design Ref 주석 | 존재 | 신규 코드에 이 Plan의 FR/D 번호를 참조 | Medium |

### 8.3 Environment Variables Needed

없음. 이 사이클은 외부 서비스나 신규 의존성을 도입하지 않는다.

---

## 9. Next Steps

1. [ ] **선행**: `/bkit:pdca plan day1-render-fps` — fps 기본값 30 + 헤더 칩 + 단일 렌더 컨트롤 + profile 누락 버그
2. [ ] `day1-render-fps` 사이클 완주 (Plan → Report)
3. [ ] `/bkit:pdca design day1-endcard-video` — 3가지 설계안 비교, R2(`<Video>` + `<Loop>` 조합) 먼저 확정
4. [ ] `/bkit:pdca do day1-endcard-video --scope module-1`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-16 | 최초 작성. 사이클 분리(fps 선행) 및 5개 설계 질문 확정 반영 | ksk@superplanet.net |
