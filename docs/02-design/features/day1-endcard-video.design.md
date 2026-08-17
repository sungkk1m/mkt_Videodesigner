# day1-endcard-video Design Document

> **Summary**: 엔드카드에 `mode: 'banner' | 'video'`를 추가해 기존 PNG 2장 방식과 영상 1개 방식을 택일하게 한다. 영상은 무음·`loop`로 3초를 채우고, TrimStrip으로 3초 창을 고른다.
>
> **Project**: mkt-videodesigner
> **Version**: 0.1.0
> **Author**: ksk@superplanet.net
> **Date**: 2026-08-17
> **Status**: Draft
> **Planning Doc**: [day1-endcard-video.plan.md](../../01-plan/features/day1-endcard-video.plan.md)

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Phase 1 | Schema Definition | 이 문서 §3 |
| Phase 2 | [Coding Conventions](../../01-plan/conventions.md) | ✅ |
| Phase 4 | API Spec | N/A — 브라우저 전용 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 엔드카드 표현이 완성 배너 PNG 하나로 고정되어 있어 애니메이션 엔드카드를 만들 수 없다 |
| **WHO** | Day1 템플릿으로 UA 소재를 뽑는 퍼포먼스 마케터 (본인) |
| **RISK** | ~~`<Video>`+`<Loop>` 조합 미검증~~ → **§1.3에서 해소.** 남은 리스크: 3초 미만 영상의 루프 이음선(R1, 비차단 안내로 대응) |
| **SUCCESS** | 두 안 택일이 저장·재열기 후에도 유지, 기존 v2 프로젝트가 마이그레이션 코드 없이 열림, 영상 엔드카드가 미리보기와 렌더에서 동일하게 3초를 채움 |
| **SCOPE** | M1 스키마·커맨드 / M2 컴포지션 / M3 업로드·인스펙터 / M4 e2e |

---

## 1. Overview

### 1.1 Design Goals

1. **택일이되 파괴하지 않는다.** `mode` 플래그가 단일 진실이고, 안을 오가도 반대편 설정(배너·아이콘·미세조정 / 영상·트림)은 그대로 남는다.
2. **패널과 같은 문법.** 영상 업로드→트림 리셋, 트림 창 이동, TrimStrip — 전부 분할 패널에 이미 있는 패턴의 대칭 복제다. 새 개념을 만들지 않는다.
3. **마이그레이션 0줄.** 신규 필드 전부에 zod `.default()`를 달아 기존 v2 문서가 그대로 파싱을 통과한다. `schemaVersion` bump 없음.

### 1.2 Design Principles

- 트림 reconcile은 도메인 커맨드에서 ([project.ts:889](../../../src/domain/editor/project.ts) `setDay1TrimInMs` 선례)
- 컴포지션은 계산하지 않는다 — 프레임 값은 prop 빌더가 만든다 (기존 §2.2 관행)
- 렌더를 막지 않는다 — 3초 미만은 루프로 채우고 안내만 한다 (Plan 결정)

### 1.3 R2 해소 — `loop`는 래퍼가 아니라 prop이다 (D-01)

Plan R2("`<Video>`+`<Loop>` 프레임 기준 어긋남 우려")는 **소멸했다.** `@remotion/media@4.0.499`의 `<Video>`가 자체 `loop: boolean` prop을 갖고 있고, 소스 확인 결과(`getTimeInSeconds`):

```js
loopDurationInFrames = calculateMediaDuration({trimBefore, trimAfter, ...})
timeInSeconds = loop ? (t × fps % loopDurationInFrames) / fps : t
return timeInSeconds + trimBefore / fps
```

- **루프가 트림 창 위에서 돈다** — `trimBefore`/`trimAfter`와 네이티브 합성. remotion `<Loop>` 래퍼 불필요.
- 미리보기와 렌더가 같은 함수를 쓰므로 둘이 어긋날 수 없다.
- **항상 `loop`를 켠다 (조건 분기 없음):** 소스 ≥ 3초면 트림 창 = 구간 길이라 루프가 발동하지 않고, 소스 < 3초면 `reconcileTrim`이 창을 소스 전체로 덮어 루프가 3초를 채운다. Plan R2의 "루프 경로에는 trim을 걸지 않는다" 직교화도 불필요해졌다.

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| 기준 | A: Minimal | B: Clean | C: Pragmatic |
|---|:-:|:-:|:-:|
| **Approach** | 범용 패치로 전부, reconcile을 UI에서 | 신규 도메인 모듈 + props 판별 유니온 + 컴포넌트 분리 | 패널 대칭 커맨드 2개, flat props 확장, `SceneVideo`에 `loop` |
| **New Files** | 0 | 3 | 0 |
| **Modified Files** | ~5 | ~9 | ~7 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Low (도메인 로직이 UI로 샘) | High | High |
| **Risk** | 패널과 비대칭, 업로드 시 트림 리셋 누락 위험 | 방금 100% 맞춘 기존 테스트를 다시 깨는 리팩터 | flat props의 비활성 필드 (Plan R3에서 수용) |

**Selected**: **Option C — Pragmatic** (Checkpoint 3 사용자 확정)

**Rationale**: 이 코드베이스는 "트림 reconcile은 도메인 커맨드"가 확립된 패턴이라 C는 설계라기보다 관행 적용이다. B의 판별 유니온은 Plan 스키마 결정(모드 플래그)과도 어긋나고 `day1Props.test`·`EndCardScene`을 갈아엎는다.

### 2.1 Component Diagram

```
domain/editor/schema.ts
  endCard += mode(.default 'banner') · video(.default null) · videoTrim(.default {0,0})
  refineDay1 += videoTrim ⊆ video.durationMs 불변식
        │
domain/editor/project.ts
  setDay1EndCardVideo(ref)        ← 영상 설정 + 트림 리셋 (setDay1PanelSource 대칭)
  setDay1EndCardTrimInMs(inMs)    ← 트림 창 이동 (setDay1TrimInMs 대칭, section=3000ms)
  buildDay1Props: endCard += mode · videoUrl · videoTrimBefore/AfterFrames
        │
compositions/day1/EndCardScene.tsx        compositions/shared/SceneVideo.tsx
  mode 분기: banner → 기존 Img 2장          loop?: boolean 추가 (기본 false)
             video  → SceneVideo(loop, muted)
        │
features/editor/useDay1Assets.ts          features/editor/EditorWorkspace.tsx
  slot 'video' 추가, probe 분기              slot 분기: video → setDay1EndCardVideo
        │
features/editor/Day1Inspector.tsx
  모드 세그먼트 + 조건부 컨트롤 + TrimStrip(section=3000) + 루프 안내
```

### 2.2 Data Flow

```
영상 업로드 → resolver.probe(file) (영상 프로브, durationMs 포함)
  → setDay1EndCardVideo(reference)
  → videoTrim = reconcileTrim({0,0}, sourceMs, 3000)   ← 소스<3s면 창=소스 전체
  → buildDay1Props: videoUrl + trimBefore/AfterFrames (project.fps로 변환)
  → EndCardScene: mode==='video' → cardMotion 래퍼 안에 SceneVideo(loop, muted)
  → 미리보기·단일 렌더·Batch가 같은 스냅샷 소비 (기존 §2.1 구조 그대로)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `setDay1EndCardVideo` | `reconcileTrim`, `DAY1_END_CARD_MS` | 업로드 시 트림 창 초기화 |
| `setDay1EndCardTrimInMs` | `reconcileTrim`, `DAY1_END_CARD_MS` | 창 이동 (패널과 동일 수식) |
| `EndCardScene` video 분기 | `SceneVideo` (+`loop`) | 재생·루프·무음 |
| TrimStrip 배선 | 기존 `TrimStrip` (원시값 props) | 신규 코드 없이 호출부만 |

---

## 3. Data Model

### 3.1 Schema 변경 (schema.ts)

```typescript
endCard: z.object({
  /**
   * Which of the two mutually exclusive end-card treatments renders.
   * `.default('banner')` is the entire migration story: a stored v2 document
   * has no `mode` key and parses as the banner behaviour it was saved with.
   */
  mode: z.enum(['banner', 'video']).default('banner'),
  // 기존 필드 무변경 —
  banner: mediaReferenceSchema.nullable(),
  appIcon: mediaReferenceSchema.nullable(),
  iconAdjust: z.object({... 기존 그대로 ...}),
  iconAnimation: z.enum(DAY1_ICON_ANIMATIONS),
  cardMotion: z.enum(DAY1_CARD_MOTIONS),
  // 신규 —
  /** One animated illustration that plays for the whole 3s end card. */
  video: mediaReferenceSchema.nullable().default(null),
  /** 3s window into `video`. Loop fills the remainder when the source is shorter. */
  videoTrim: mediaTrimSchema.default({inMs: 0, outMs: 0}),
}),
```

`DAY1_END_CARD_MODES = ['banner', 'video'] as const` 를 `constants.ts`에 추가 (기존 `DAY1_ICON_ANIMATIONS` 관행).

**불변식** (`refineDay1`): 기존 `refineTrimInSource(videoTrim, endCard.video, [...,'endCard','videoTrim'], ctx)` 재사용 — 트림 창이 소스 길이를 넘으면 `PROJECT_INVALID`.

**의도적으로 만들지 않는 불변식** (D-02): "video 모드면 banner가 null이어야 한다" 같은 배타 강제는 두지 않는다. 비활성 필드 보존이 모드 전환 UX의 목적이고(Plan §7.2), 렌더는 `mode`만 읽는다.

### 3.2 Render Props (types.ts) — flat 확장 (D-03)

```typescript
export type Day1EndCardMode = (typeof DAY1_END_CARD_MODES)[number];

export interface Day1EndCardRenderProps {
  mode: Day1EndCardMode;              // 신규 — 컴포지션 분기의 단일 진실
  bannerUrl: string | null;           // 기존
  iconUrl: string | null;             // 기존
  iconRect: NormalizedRect;           // 기존
  iconAnimation: Day1IconAnimation;   // 기존
  cardMotion: Day1CardMotion;         // 기존 — 두 모드가 공유
  videoUrl: string | null;            // 신규
  videoTrimBeforeFrames: number;      // 신규 — 빌더가 project.fps로 변환
  videoTrimAfterFrames: number;       // 신규 — max(before+1, out) 패널 관행
}
```

유니온이 아닌 flat: 기존 `day1Props.test`·`EndCardScene`의 배너 경로가 무수정으로 남는다.

### 3.3 Prop Builder (project.ts `buildDay1Props`)

```typescript
const videoTrimBeforeFrames = msToFrames(endCard.videoTrim.inMs, project.fps);

endCard: Object.freeze({
  mode: endCard.mode,
  ...기존 5필드...,
  videoUrl: resolveUrl(endCard.video),
  videoTrimBeforeFrames,
  videoTrimAfterFrames: Math.max(
    videoTrimBeforeFrames + 1,
    msToFrames(endCard.videoTrim.outMs, project.fps),
  ),
}),
```

fps 의존은 이 변환 지점 한 곳 (Plan R5 대응 — fps 사이클 완료로 30fps 기준).

### 3.4 Domain Commands (project.ts)

```typescript
/** Mirrors setDay1PanelSource: setting the video resets its trim window. */
export const setDay1EndCardVideo = (
  project: EditorProject,
  reference: MediaReference | null,
): EditorProject =>
  // endCard.video = reference,
  // endCard.videoTrim = reconcileTrim({inMs: 0, outMs: 0},
  //                        reference?.durationMs ?? 0, DAY1_END_CARD_MS)

/** Mirrors setDay1TrimInMs with the fixed 3s section. */
export const setDay1EndCardTrimInMs = (
  project: EditorProject,
  inMs: number,
): EditorProject =>
  // endCard.videoTrim = reconcileTrim({inMs, outMs: inMs},
  //                        video.durationMs ?? 0, DAY1_END_CARD_MS)
```

`mode` 전환은 기존 범용 패치로 충분: `updateDay1EndCard({mode: 'video'})` — `Day1EndCardPatch`가 `Partial<Omit<endCard,'iconAdjust'>>`라 자동 포함된다. 단, **`videoTrim`은 패치 타입에서 제외**해 reconcile을 우회하는 경로를 막는다 (D-04): `Omit<..., 'iconAdjust' | 'videoTrim'>`.

Store 액션 (projectStore.ts): `setDay1EndCardVideo`, `setDay1EndCardTrimIn` 두 개 추가 — 기존 1줄 위임 패턴.

---

## 4. API Specification

N/A — 브라우저 전용.

---

## 5. UI/UX Design

### 5.1 인스펙터 "엔드카드" 섹션 레이아웃

```
┌ 엔드카드 ──────────────────────────────┐
│ [배너+아이콘 │ 영상]   ← 모드 세그먼트    │
│                                        │
│ mode==='banner' (기존 그대로):           │
│   (경고: 배너 없음 — 기존)               │
│   배너 AssetField / 앱아이콘 AssetField  │
│   아이콘 애니메이션 세그먼트              │
│   카드 모션 세그먼트          ─┐ 공유     │
│   좌표 힌트 + X/Y/scale 미세조정          │
│                                        │
│ mode==='video':                        │
│   (경고: 영상 없음 — 신규, 비차단)        │
│   엔드카드 영상 AssetField (kind video)  │
│   TrimStrip (section=3000ms)           │
│   (안내: 3초 미만 → 루프로 채움 — 신규)   │
│   카드 모션 세그먼트          ─┘          │
└────────────────────────────────────────┘
```

카드 모션은 두 모드 모두 노출 (Plan 확정 — 전체 프리셋 유지). 아이콘 애니메이션·미세조정·배너 필드는 video 모드에서 숨김 (FR-09).

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| 모드 세그먼트 (인라인) | `Day1Inspector.tsx` | `endCard.mode` 표시·전환 |
| 영상 `AssetField` | `Day1Inspector.tsx` | 기존 컴포넌트, `kind="video"` |
| `TrimStrip` 호출부 | `Day1Inspector.tsx` | `sectionDurationMs={DAY1_END_CARD_MS}`, `testIdPrefix="day1-endcard"` |
| `EndCardScene` video 분기 | `compositions/day1/EndCardScene.tsx` | cardMotion 래퍼 안에 `SceneVideo` |
| `SceneVideo` `loop` prop | `compositions/shared/SceneVideo.tsx` | optional, 기본 false — 기존 사용처 무영향 |

### 5.4 Page UI Checklist

#### 인스펙터 — 엔드카드 섹션 (banner 모드)

- [ ] Segmented: 모드 (2항목), `day1-endcard-mode-banner` / `day1-endcard-mode-video`, `aria-pressed` 반영
- [ ] 기존 요소 전부 유지: `day1-banner-missing` 경고 · `day1-endcard-banner`/`day1-endcard-appIcon` 필드 · `day1-icon-animation-*` · `day1-card-motion-*` · `day1-icon-dx/dy/scale`
- [ ] 부재: 영상 필드·TrimStrip이 보이지 않을 것

#### 인스펙터 — 엔드카드 섹션 (video 모드)

- [ ] Warning: `day1-endcard-video-missing` — 영상 없을 때, 렌더 비차단 문구 (기존 배너 경고와 동일 수위)
- [ ] AssetField: `day1-endcard-video` (video accept)
- [ ] TrimStrip: `day1-endcard-trim-*` (testIdPrefix `day1-endcard`), 창 길이 3000ms 고정
- [ ] Notice: `day1-endcard-loop-note` — `video.durationMs < 3000`일 때만, "3초를 채울 때까지 반복 재생됩니다"
- [ ] 유지: `day1-card-motion-*`
- [ ] 부재: 배너·아이콘 필드, 아이콘 애니메이션, 미세조정, `day1-banner-missing`이 보이지 않을 것

#### 미리보기/렌더

- [ ] video 모드: 엔드카드 구간에서 영상이 cover로 재생, 무음, cardMotion 적용
- [ ] banner 모드: 기존 동작 무변경 (회귀 0)

### 5.5 자산 카운트 배지

인스펙터 섹션 요약의 `endCardAssetCount`([Day1Inspector.tsx:294](../../../src/features/editor/Day1Inspector.tsx))는 모드별로 센다: banner 모드 = banner+appIcon 중 채운 수(기존), video 모드 = video 유무 (0/1).

---

## 6. Error Handling

| 상황 | 처리 | 근거 |
|------|------|------|
| 영상 프로브 실패 (미지원 코덱 등) | `uploadError` 표시, 설정 무변경 | `useDay1Assets`의 기존 `probeImage` 실패 경로와 동일 — `resolver.probe`가 같은 `Result` 계약 |
| video 모드 + 영상 없음 | 경고만, 렌더 진행 (빈 화면) | FR-10 — 기존 `day1-banner-missing`과 동일 수위 |
| 영상 < 3초 | 루프로 채움 + 안내 | FR-06/11 — 차단하지 않음 (Plan 확정) |
| 트림 창이 소스 초과 (저장 문서 손상) | `parseProject` 실패 `PROJECT_INVALID` | §3.1 불변식 — 기존 `refineTrimInSource` 재사용 |
| 모드 전환 | 아무 것도 지우지 않음 | D-02 — 반대편 설정 보존이 목적 |

**새 에러 코드 없음. 새 렌더 차단자 없음** — `day1PanelsShorterThanSection` 게이트는 확장하지 않는다 (Plan §6.2 확정).

---

## 7. Security Considerations

N/A — 로컬 파일 프로브·재생뿐. 기존 `MediaReference` 경로(바이트 미보존, 메타데이터만 저장)를 그대로 쓴다.

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| U: 단위 | 스키마 기본값·불변식, 커맨드 reconcile, prop 빌더 | Vitest | Do |
| L2: UI | 모드 전환·조건부 노출·업로드 분기 | Playwright | Do |
| L3: E2E | video 엔드카드 실 렌더 (일반·루프) | Playwright | Do |

### 8.2 U: 단위 시나리오

| # | ID | 대상 | 시나리오 | 기대 |
|---|----|------|---------|------|
| 1 | U-01 | schema | `mode`/`video`/`videoTrim` 없는 기존 v2 endCard 파싱 | 통과, `mode==='banner'`, `video===null`, `videoTrim==={0,0}` (**SC2 — 마이그레이션 0줄 증명**) |
| 2 | U-02 | projectFile | 저장→불러오기 왕복 | `mode`/`video`/`videoTrim` 보존 |
| 3 | U-03 | `setDay1EndCardVideo` | 5초 영상 설정 | `videoTrim === {inMs:0, outMs:3000}` |
| 4 | U-04 | `setDay1EndCardVideo` | 2초 영상 설정 | `videoTrim === {inMs:0, outMs:2000}` (창=소스 전체) |
| 5 | U-05 | `setDay1EndCardTrimInMs` | 5초 영상에서 `inMs=1000` | `{1000, 4000}` / `inMs=4000` → `{2000, 5000}` 클램프 (패널과 동일 수식) |
| 6 | U-06 | `buildDay1Props` | video 모드 5초 영상 trim {1000,4000} @30fps | `videoTrimBeforeFrames===30`, `videoTrimAfterFrames===120`, `videoUrl` resolve |
| 7 | U-07 | `updateDay1EndCard` | `{mode:'video'}` 전환 후 재전환 | banner·iconAdjust 등 반대편 필드 보존 (**SC1**) |
| 8 | U-08 | schema 불변식 | `videoTrim.outMs > video.durationMs` 문서 | `PROJECT_INVALID` |

### 8.3 L2: UI 시나리오

| # | Action | Expected |
|---|--------|----------|
| 1 | 엔드카드 섹션 로드 | `day1-endcard-mode-banner`가 `aria-pressed=true`, 기존 필드 보임 |
| 2 | `day1-endcard-mode-video` 클릭 | 배너·아이콘 컨트롤 사라지고 영상 필드·경고 나타남, 카드 모션은 유지 |
| 3 | 영상 업로드 (≥3초 픽스처) | TrimStrip 표시, 루프 안내 없음 |
| 4 | 영상 업로드 (<3초 픽스처) | `day1-endcard-loop-note` 표시 |
| 5 | banner로 재전환 | 기존 배너 설정 그대로 (파일명 유지) |

### 8.4 L3: E2E 시나리오

| # | Scenario | Success Criteria |
|---|----------|-----------------|
| 1 | 패널 2 + 엔드카드 영상(≥3초) → MP4 렌더 | 다운로드 성공, `format.duration` 14.5~15.6s, 마지막 구간 샘플이 검정 아님 (**SC3**) |
| 2 | 엔드카드 영상 <3초 → MP4 렌더 | 렌더 차단 없음, duration 정상 — 루프가 채움 (**SC4**) |

**픽스처**: ≥3초는 기존 `day1-panel-b.mp4` 재사용. **<3초 픽스처는 없으므로 Do에서 ffmpeg으로 2초짜리 생성** (`tests/fixtures/endcard-2s.mp4`, 기존 픽스처에서 `-t 2` 추출).

### 8.5 기존 테스트 영향 (fps 사이클 학습 반영 — 실측 우선)

- `day1Props.test.ts` — flat 확장이라 기존 단언 유지, 신규 필드 단언 추가만
- `schema.test.ts` / `migrate.test.ts` / `projectFile.test.ts` — U-01/02/08 추가
- `day1-template.spec.ts` e2e — 엔드카드는 배너 없이도 렌더되므로 기존 시나리오 무영향 예상. **Do 첫 단계에서 스키마만 바꾸고 전체 스위트를 돌려 실측한다** (fps 사이클 Learning #1)

---

## 9. Clean Architecture

| Component | Layer | Location |
|-----------|-------|----------|
| 스키마·커맨드·prop 빌더 | Domain | `src/domain/editor/` |
| `EndCardScene`·`SceneVideo` | Presentation (composition) | `src/compositions/` |
| `useDay1Assets` probe 분기 | Application | `src/features/editor/` |
| 인스펙터 UI | Presentation | `src/features/editor/` |

의존 방향 무변경. 컴포지션은 여전히 domain 타입만 소비한다.

---

## 10. Coding Convention Reference

| Item | Convention Applied |
|------|-------------------|
| testid | `day1-endcard-mode-*` / `day1-endcard-video` / `day1-endcard-trim-*` / `day1-endcard-loop-note` (기존 `day1-endcard-*` 계열) |
| 커맨드 명명 | `setDay1EndCardVideo` / `setDay1EndCardTrimInMs` (`setDay1PanelSource`/`setDay1TrimInMs` 대칭) |
| 주석 | 이 문서 D-번호·Plan FR-번호 참조 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
src/domain/editor/constants.ts        DAY1_END_CARD_MODES                    [~2줄]
src/domain/editor/schema.ts           endCard 3필드 + 불변식                  [~15줄]
src/domain/editor/types.ts            Day1EndCardMode + RenderProps 3필드    [~10줄]
src/domain/editor/project.ts          커맨드 2개 + 빌더 확장 + 패치 Omit       [~50줄]
src/features/editor/projectStore.ts   액션 2개                               [~8줄]
src/compositions/shared/SceneVideo.tsx  loop?: boolean                       [~4줄]
src/compositions/day1/EndCardScene.tsx  mode 분기                            [~25줄]
src/features/editor/useDay1Assets.ts  slot 'video' + probe 분기              [~10줄]
src/features/editor/EditorWorkspace.tsx slot 분기 배선                        [~5줄]
src/features/editor/Day1Inspector.tsx 모드 세그먼트 + 조건부 + TrimStrip       [~70줄]
tests/fixtures/endcard-2s.mp4         신규 (ffmpeg 생성)
tests/e2e/day1-endcard-video.spec.ts  신규 L2+L3
+ 기존 유닛 4파일에 U-01~08
```

### 11.2 Implementation Order

1. [ ] 스키마+상수+타입 → verify: **전체 vitest 실행으로 파급 실측** (기본값 덕에 그린 예상)
2. [ ] 커맨드 2개 + 빌더 + U-01~08 → verify: 유닛 그린
3. [ ] `SceneVideo` loop + `EndCardScene` 분기 → verify: tsc + 미리보기 육안
4. [ ] `useDay1Assets`/Workspace/Inspector → verify: L2 e2e
5. [ ] 픽스처 생성 + L3 e2e → verify: 실 렌더 2건
6. [ ] 전체 스위트 최종 1회

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| M1 | `module-1` | 스키마·타입·커맨드·prop 빌더 + 유닛 (순서 1-2) | 1-2 |
| M2 | `module-2` | 컴포지션 (SceneVideo loop + EndCardScene 분기) (순서 3) | 1 |
| M3 | `module-3` | 업로드 경로 + 인스펙터 UI (순서 4) | 1-2 |
| M4 | `module-4` | 픽스처 + e2e + 전체 스위트 (순서 5-6) | 1 |

M1→M2→M3→M4 순서 고정 (각 단계가 이전 단계의 심볼에 의존). 한 세션 완주 가능 규모이나, 끊길 경우 `--scope module-N`으로 재개.

---

## 12. Design Decisions

| ID | Decision | Alternatives | Rationale |
|----|----------|--------------|-----------|
| D-01 | `<Video loop>` prop 사용, `<Loop>` 래퍼 불사용, **항상 loop** | `<Loop>` 래퍼 / 소스 짧을 때만 loop | §1.3 — 트림과 네이티브 합성 확인. 항상 켜면 조건 분기 없이 두 케이스 모두 정답 |
| D-02 | 모드 배타 불변식 없음, 비활성 필드 보존 | video 모드 시 banner null 강제 | 전환 UX가 목적. 렌더는 `mode`만 읽어 모호성 없음 (Plan R3 수용) |
| D-03 | RenderProps flat 확장 (유니온 아님) | 판별 유니온 | 기존 배너 경로 테스트·컴포지션 무수정. 방금 안정화한 스위트를 보존 |
| D-04 | `videoTrim`을 범용 패치에서 제외 | 패치 허용 | reconcile 우회 경로 차단 — 트림은 반드시 전용 커맨드로 |
| D-05 | `SceneVideo`에 optional `loop` 추가 | EndCardScene에서 `<Video>` 직접 | 분할 구간과 같은 배경색·cover 관행 공유. optional이라 기존 사용처 무영향 |
| D-06 | 2초 픽스처를 ffmpeg으로 생성 | 기존 픽스처 재활용 | <3초 픽스처가 없음. 루프 경로(SC4)는 실 렌더 증거 필요 |

---

## 13. Open Questions

없음. Plan의 5개 열린 질문은 사용자 확정, R2는 §1.3에서 코드로 해소.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-17 | 최초 작성. Option C 확정, R2 해소(네이티브 loop), 커맨드·스키마·테스트 계획 확정 | ksk@superplanet.net |
