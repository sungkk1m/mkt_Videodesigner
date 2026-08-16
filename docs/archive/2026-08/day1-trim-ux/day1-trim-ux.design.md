# Day1 Trim UX Design Document

> **Summary**: 프레임 샘플러를 포트로 추출해 Day1 패널 인스펙터에 썸네일 스트립 + 드래그 트림 창을 얹고, 짧은 소스를 경고와 렌더 게이트로 드러낸다
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-15
> **Status**: Draft — awaiting Do
> **Plan**: [day1-trim-ux.plan.md](day1-trim-ux.plan.md)
> **Architecture**: Option C — 실용적 균형 (사용자 선택, 2026-08-15)

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

### 1.1 Design Goals

1. **도메인을 그대로 비추는 UI** — `reconcileTrim`은 고정 길이 창을 슬라이드시킨다. UI도 고정 폭 창을 트랙 위에서 미는 형태여야 한다.
2. **추출하되 최소한만** — hook-analysis에서 진짜 공통인 것(`loadVideo`·`seekTo`·drawImage)만 꺼낸다. 스코어링·워커·오디오는 건드리지 않는다.
3. **계층 경계 준수** — `features`는 `infrastructure`를 import할 수 없다. 샘플러는 포트로 주입한다.
4. **조용한 실패 제거** — 짧은 소스는 인스펙터에서 보이고 렌더에서 막힌다.

### 1.2 Key Constraint — features는 infrastructure를 볼 수 없다

[architecture.test.ts:24](../../../../src/test/architecture.test.ts:24)가 강제한다.

```
features: ['compositions', 'domain', 'features', 'shared']
```

따라서 스트립 UI가 샘플러를 직접 import하는 경로는 없다. 기존 `HookAnalyzer`와 동일한 포트 경로를 탄다.

```
domain/ports (인터페이스)  ←  infrastructure/media (구현)
        ↑                              ↑
   features (소비)             app/App.tsx (주입)
```

이 제약이 §3의 포트 설계를 결정한다. 설계 선택이 아니라 테스트가 강제하는 사실이다.

### 1.3 Key Insight — 사용자가 조작하는 값은 In 하나다

[timeline.ts:109](../../../../src/domain/timeline/timeline.ts:109) `reconcileTrim`:

```ts
const windowMs = Math.min(sceneDurationMs, sourceDurationMs);
const inMs = clamp(Math.round(trim.inMs), 0, sourceDurationMs - windowMs);
return {inMs, outMs: inMs + windowMs};
```

`windowMs`는 구간과 원본에서 파생되고 `outMs`는 `inMs`에서 파생된다. 자유도는 `inMs` 하나뿐이다. 이 사실이 세 곳을 동시에 결정한다.

- 스트립 위 **창은 폭이 고정**이고 좌우로만 움직인다 (FR-T02)
- **Trim Out은 입력이 아니라 표시**다 (FR-T07)
- **원본 ≤ 구간이면 `windowMs = 원본`**이라 창이 트랙 전체를 덮고 움직일 여지가 없다 (FR-S05). 이것이 곧 짧은 소스 상태이므로 §5.5의 경고와 같은 조건에서 발생한다

### 1.4 Plan에서 정정하는 사항

Plan §1.3은 `hook__strip`을 "필름스트립 UI ... CSS가 이미 있다"고 적었다. 확인 결과 [editor.css:753](../../../../src/features/editor/editor.css:753)의 `hook__strip`은 `flex-direction: column`인 **세로 카드 목록**이다. 썸네일 이미지 + 클릭 선택이라는 상호작용 패턴은 참고가 되지만, 가로 트랙 레이아웃은 새로 작성한다. Plan의 재사용 자산 목록에서 이 항목만 "패턴 참고, CSS 신규"로 낮춰 읽는다.

나머지 재사용 자산(프레임 샘플러, 경고 문구, preflight 게이트, 감지 함수 위치, 경계 드래그 패턴)은 Plan 기재대로 유효함을 확인했다. 추가로 [useDay1Assets.ts:36](../../../../src/features/editor/useDay1Assets.ts:36)이 `panelUrl(panel) => string | null`을 이미 노출하고 있어 스트립에 필요한 URL 확보 경로가 이미 있다.

### 1.5 Confirmed Decisions

Plan D-T01~D-T06을 승계하고, Design 단계에서 확정한 항목을 잇는다.

| # | 결정 | 근거 |
|---|------|------|
| D-T01~06 | (Plan §1.5 승계) | — |
| **D-D01** | **Option C 채택** — `loadVideo`·`seekTo`·샘플링만 추출, 호출자가 샘플 시각을 정한다 | 두 소비자의 요구가 다르다(Hook은 500ms 격자·최대 240장, 스트립은 소스 길이 무관 고정 칸 수). 공통분모를 시각 배열 바깥에 두면 추출 면적이 최소가 되고 SC8 위험이 그만큼 줄어든다 |
| **D-D02** | **`FrameSampler` 포트는 프레임당 콜백으로 흘려보낸다** | Hook은 ImageData(워커 전송용)를, 스트립은 dataURL을 원한다. 반환 타입을 유니온으로 만드는 대신 `needsPixels` 플래그 하나로 갈랐다. 점진적 표시(FR-T03)도 콜백에서 그대로 나온다 |
| **D-D03** | **순수 함수는 `domain/timeline/trimWindow.ts`** | `reconcileTrim`이 이미 `domain/timeline`에 있고 창 개념은 템플릿 무관이다. `domain/day1`에 두면 다음 사이클에서 3장면용으로 옮겨야 한다. 지금 비용은 같고 나중 비용만 줄어든다 |
| **D-D04** | **확대 프레임은 별도 샘플 호출** (`timesMs: [inMs]`, 큰 `maxEdge`) | 스트립 칸(160px)과 확대 프레임(480px)은 필요 해상도가 다르다. 같은 포트를 인자만 바꿔 부르므로 새 API가 필요 없다 |
| **D-D05** | **썸네일 캐시는 모듈 레벨 Map, 키는 `sourceId`** | 패널을 접었다 펴도 재생성하지 않는다(FR-T04). 구간 길이가 바뀌어도 썸네일은 유효하다 — 바뀌는 건 창의 폭뿐이다 |
| **D-D06** | **`onTrimOut` 배선은 제거하되 도메인 `setDay1TrimOutMs`는 남긴다** | FR-T07로 Day1Inspector의 `onTrimOut` prop, EditorWorkspace 배선, `projectStore.setDay1TrimOut`이 고아가 된다 — 내 변경이 만든 고아이므로 제거한다. 도메인 함수는 자체 테스트([day1Commands.test.ts:168](../../../../src/domain/editor/day1Commands.test.ts:168))가 있고 3장면 형제 함수와 대칭이라 남긴다 (CLAUDE.md §3) |
| **D-D07** | **샘플러 실패는 `MEDIA_PROBE_FAILED`를 재사용한다** (module-1 Do 중 결정, 2026-08-15) | §3.2는 "새 에러 코드를 만들지 않는다"고만 적고 실제로 무엇을 쓸지는 비워뒀는데, `fail()`은 `AppErrorCode`를 요구한다. 샘플러 실패는 언제나 디코딩 실패이므로 의미가 맞고, 소비자가 감싸므로 사용자에게 이 코드가 노출되지 않는다 |
| **D-D08** | **`hookSampleTimesMs`는 반올림하지 않은 값을 반환하고, 반올림은 호출부에 남긴다** (module-1 Do 중 결정, 2026-08-15) | 기존 루프는 **반올림 안 한 값으로 seek**하고 워커 입력·썸네일 키에만 반올림을 썼다([구 heuristicHookAnalyzer.ts:166-176]). §3.3의 코드 스케치는 앞단에서 반올림해 seek 위치가 최대 0.5ms 밀렸을 것이다. 실질 영향은 거의 없겠지만 SC8이 이 모듈의 존재 이유이므로 "거의 없다"에 기대지 않고 동일하게 맞췄다 |
| **D-D09** | **FR-S05를 module-4에서 module-3으로 당긴다** (사용자 승인, 2026-08-15) | 창의 잠금은 `maxTrimInMs() === 0`이면 `disabled`로 그리는 TrimStrip 자체 로직이다. module-4로 미루면 짧은 소스에서 창이 무의미하게 움직이는, 알면서 남긴 구멍을 안고 가게 된다. module-4에는 경고 문구(FR-S02)와 렌더 게이트(FR-S03·S04)가 남는다 |
| **D-D10** | **`clamp`은 공유 모듈로 빼지 않고 `trimWindow.ts`에 로컬로 정의한다** (module-2 Do 중 결정, 2026-08-15) | 이 코드베이스는 도메인 모듈마다 3줄짜리 `clamp`을 각자 두는 관례다([timeline.ts:23](../../../../src/domain/timeline/timeline.ts:23), [layout.ts:34](../../../../src/domain/day1/layout.ts:34), [mix.ts:24](../../../../src/domain/audio/mix.ts:24), [project.ts:85](../../../../src/domain/editor/project.ts:85)). 공유 모듈 신설은 요청되지 않은 리팩터다 (CLAUDE.md §3) |
| **D-D11** | **렌더 차단은 `preflightIssues`와 렌더 버튼 조건식 두 곳에 넣는다** (module-4 Do 중 **설계 오류 정정**, 2026-08-15) | §5.5는 `preflightIssues`가 렌더를 막는다고 전제했으나, 실제로 그것은 **Batch 전용** 게이트다. 단일 MP4 렌더 버튼은 `isRendering / capabilities.ready / renderableSource / narrationTooLong`라는 자체 조건식으로 막힌다([EditorWorkspace.tsx:604](../../../../src/features/editor/EditorWorkspace.tsx:604)). `preflightIssues`만 고쳤다면 Batch만 막히고 단일 렌더로는 검은 화면 MP4가 그대로 나갔을 것이다. FR-S03을 만족하려면 두 경로 모두 필요하다 |
| **D-D12** | **E2E 픽셀 샘플링 헬퍼를 `tests/e2e/helpers/videoSampling.ts`로 추출한다** (module-4 Do 중 결정, 2026-08-15) | E2가 `day1-template.spec.ts` 안에만 있던 ffmpeg 샘플링 도구를 필요로 했다. 약 100줄을 복사하는 것은 module-1에서 거부한 바로 그 선택이므로, 추출해 두 스펙이 공유한다. 추출 후 `day1-template.spec.ts` 9개 전량 통과로 무해함을 확인했다 |

---

## 2. Architecture

### 2.0 Option Comparison

| | A — 최소 변경 | B — 완전 분리 | **C — 실용적 균형 (선택)** |
|---|---|---|---|
| 샘플러 | hook-analysis에서 40줄 복사 | 풍부한 포트 + 전면 리팩터 | `loadVideo`·`seekTo`·샘플링만 추출 |
| hook-analysis | 무수정 | 전면 재배치 | 샘플러 호출로만 수정 |
| SC8 위험 | 없음 | 높음 | 중간 (게이트 필요) |
| Plan §4.2 부합 | ❌ 위배 | ✅ | ✅ |
| CLAUDE.md §2 부합 | ✅ | ❌ 미리 지음 | ✅ |
| 다음 사이클 | 재일반화 필요 | 배선만 | 배선만 |

**선택 근거**: A는 Plan §4.2("코드를 복사하지 않는다")를 위배해 Plan 수정이 필요했고, B는 지금 필요 없는 3장면 계약을 미리 지어 CLAUDE.md §2에 어긋났다. C만 두 기준을 모두 만족한다.

### 2.1 Component Diagram

```
app/App.tsx
  └─ createFrameSampler() ──────────────────┐
  └─ createHeuristicHookAnalyzer(sampler) ──┤ 주입
                                            ▼
features/editor/EditorWorkspace.tsx  (frameSampler prop)
  └─ Day1Inspector
       └─ PanelSection
            ├─ TrimStrip ◄── useTrimThumbnails(sampler, url, sourceId)
            │    ├─ 트랙 (썸네일 N칸)
            │    ├─ 창 (고정 폭, 드래그·키보드)
            │    └─ 확대 프레임
            ├─ SecondsField (Trim In, 유지)
            ├─ Trim Out 읽기전용 표시
            └─ 짧은 소스 경고

domain/timeline/trimWindow.ts   (순수: 창 기하·샘플 시각)
domain/editor/project.ts        (day1PanelsShorterThanSection)
domain/ports/index.ts           (FrameSampler 인터페이스)
infrastructure/media/frameSampler.ts  (구현)
infrastructure/hook-analysis/heuristicHookAnalyzer.ts  (샘플러 소비로 변경)
```

### 2.2 Data Flow — 스트립 표시부터 렌더까지

```
1. 사용자가 패널 섹션을 펼침
2. useTrimThumbnails: 캐시 조회 (키 = sourceId)
   ├─ 히트  → 즉시 반환, 샘플링 없음
   └─ 미스  → stripSampleTimesMs(sourceMs, 16) 계산
              → sampler.sample({url, timesMs, maxEdge: 160, needsPixels: false})
              → onFrame마다 setState → 칸이 하나씩 채워짐 (FR-T03)
3. 창 위치 = windowBoundsRatio(inMs, sourceMs, sectionMs)   [순수]
4. 사용자가 창을 드래그
   ├─ 이동 중: trimInFromRatio(포인터 비율) → 로컬 state
   │           확대 프레임 = 캐시된 nearestSampleIndex 썸네일 (근사)
   └─ 놓을 때: onCommit(inMs) → store().setDay1TrimIn
               → setDay1TrimInMs → reconcileTrim (clamp)
               → 확대 프레임 = sampler.sample({timesMs:[inMs], maxEdge:480})  [정확]
5. 렌더: 기존 경로 그대로. trim.inMs가 소스 시작점을 결정
```

**4단계의 로컬 state가 핵심이다.** 드래그 중 매 포인터 이벤트마다 스토어를 갱신하면 프로젝트 전체가 리렌더되고 자동저장이 요동친다. 드래그 중에는 컴포넌트 로컬 상태로만 움직이고, 놓을 때 한 번 커밋한다. 기존 [Timeline.tsx:132-155](../../../../src/features/editor/Timeline.tsx:132)의 경계 드래그가 같은 구조다.

### 2.3 Performance

| 항목 | 설계값 | 근거 |
|------|--------|------|
| 스트립 칸 수 | 16 고정 | 소스 길이와 무관. 75초든 300초든 seek 16회. 메모리 상한이 결정적이 된다 (Plan §5 위험 대응) |
| 칸 해상도 | 장변 160px | 스트립 칸은 실제로 수십 px로 그려진다 |
| 확대 프레임 해상도 | 장변 480px | 구도 판단에 필요한 최소선 (D-T06) |
| 캐시 수명 | 세션, 모듈 레벨 Map | 소스 16장 × JPEG 0.6 ≈ 수백 KB. 소스 2개여도 1MB 미만 |
| 동시 실행 | 직렬화 없음 | 샘플 실행마다 자체 `<video>`를 만든다. Hook 분석과 공유 상태가 없어 경합하지 않는다 (Plan §5 위험 해소) |

---

## 3. Ports and Infrastructure

### 3.1 `FrameSampler` — `domain/ports/index.ts`

```ts
/** Design Ref: §3.1 — one decoded frame, shaped by what the caller asked for. */
export interface SampledFrame {
  timeMs: number;
  width: number;
  height: number;
  /** Small JPEG data URL, always produced. */
  thumbnail: string;
  /** Raw RGBA pixels, transferable. Null unless `needsPixels`. */
  pixels: ArrayBuffer | null;
}

export interface FrameSampleRequest {
  /** Session object URL of the source video. */
  url: string;
  /** Sample times in source time. The caller owns the grid (D-D01). */
  timesMs: readonly number[];
  /** Longest edge of the decoded frame, in px. */
  maxEdge: number;
  /** Set when the caller needs raw pixels as well as the thumbnail. */
  needsPixels: boolean;
  signal: AbortSignal;
  /** Called once per decoded frame, in `timesMs` order. */
  onFrame: (frame: SampledFrame) => void;
}

export interface FrameSampler {
  sample(request: FrameSampleRequest): Promise<Result<void>>;
}
```

**설계 노트**: 반환값이 `Result<void>`인 이유는 프레임이 콜백으로 이미 나갔기 때문이다. 반환값은 "끝까지 갔는가 / 어디서 실패했는가"만 전한다. 이 형태 덕분에 점진적 표시(FR-T03)와 배치 수집(Hook)이 같은 API를 쓴다.

### 3.2 `infrastructure/media/frameSampler.ts` — 구현

`heuristicHookAnalyzer.ts`에서 **이동**하는 것 (복사 아님):

| 옮기는 것 | 현재 위치 | 비고 |
|-----------|-----------|------|
| `seekTo(video, timeMs)` | [heuristicHookAnalyzer.ts:33-49](../../../../src/infrastructure/hook-analysis/heuristicHookAnalyzer.ts:33) | 그대로 |
| `loadVideo(url)` | [heuristicHookAnalyzer.ts:51-60](../../../../src/infrastructure/hook-analysis/heuristicHookAnalyzer.ts:51) | 그대로 |
| canvas 생성 + 스케일 계산 + 샘플 루프 | [heuristicHookAnalyzer.ts:145-186](../../../../src/infrastructure/hook-analysis/heuristicHookAnalyzer.ts:145) | `timesMs`를 인자로 받도록 변경. `sampleCount`/`step` 계산은 호출자로 이동 |

`heuristicHookAnalyzer.ts`에 **남는 것**: `analyseAudio`, `runWorker`, `buildHookCandidates` 호출, `MAX_SAMPLE_EDGE`/`SAMPLE_INTERVAL_MS`/`MAX_SAMPLES` 상수, `analysisFailed` 에러.

에러 코드는 새로 만들지 않고 `Result` 실패로 올린 뒤 각 소비자가 자기 에러로 감싼다 — Hook은 기존 `HOOK_ANALYSIS_FAILED`를 유지하고(사용자에게 보이는 문구가 바뀌지 않는다), 스트립은 조용히 축퇴한다(FR-T09).

### 3.3 `heuristicHookAnalyzer` 리팩터 — 동작 동일

```ts
export const createHeuristicHookAnalyzer = (
  sampler: FrameSampler,          // ← 주입으로 변경
): HookAnalyzer => ({
  analyze: async ({url, sourceDurationMs, candidateDurationMs, signal, onProgress}) => {
    // D-D08 — unrounded, matching the seek positions of the original loop.
    const timesMs = hookSampleTimesMs(sourceDurationMs);
    const sampleCount = timesMs.length;

    const frames: ArrayBuffer[] = [];
    const times: number[] = [];
    const thumbnails = new Map<number, string>();
    let width = 0;
    let height = 0;

    const result = await sampler.sample({
      url, timesMs, maxEdge: MAX_SAMPLE_EDGE, needsPixels: true, signal,
      onFrame: (frame) => {
        const roundedMs = Math.round(frame.timeMs);   // D-D08

        frames.push(frame.pixels as ArrayBuffer);
        times.push(roundedMs);
        thumbnails.set(roundedMs, frame.thumbnail);
        width = frame.width;
        height = frame.height;
        onProgress(times.length / sampleCount);
      },
    });

    if (!result.ok) { /* 기존 취소/실패 분기 그대로 */ }
    // 이하 runWorker / analyseAudio / buildHookCandidates 변경 없음
  },
});
```

**동작 동일성의 근거**: 샘플 시각 계산식(`Math.min(index * step, sourceDurationMs - 1)`)과 스케일 계산을 그대로 옮겼다. `timesMs`가 기존 루프와 같은 값을 만들면 워커 입력이 동일하고, 따라서 후보 산출도 동일하다. SC8이 이를 검증한다.

`App.tsx`는 두 줄이 바뀐다.

```ts
const frameSampler = createFrameSampler();
const hookAnalyzer = createHeuristicHookAnalyzer(frameSampler);
```

---

## 4. Domain (순수)

### 4.1 `domain/timeline/trimWindow.ts` — 신규

`reconcileTrim` 옆에 두고, 그 함수가 이미 계산하는 것을 UI가 되쓸 수 있는 형태로 노출한다. **중복 정의가 아니라 같은 규칙의 다른 표현이며, `windowMs` 계산식은 한 곳에서 온다.**

```ts
/** The fixed-length window reconcileTrim slides over the source. */
export const trimWindowMs = (sourceDurationMs: number, sectionDurationMs: number) =>
  Math.min(sectionDurationMs, Math.max(0, sourceDurationMs));

/** Highest legal Trim In. Zero when the source cannot fill the section. */
export const maxTrimInMs = (sourceDurationMs: number, sectionDurationMs: number) =>
  Math.max(0, sourceDurationMs - trimWindowMs(sourceDurationMs, sectionDurationMs));

/** Window geometry on a 0..1 track. `widthRatio` is 1 when the source is short. */
export const windowBoundsRatio = (
  inMs: number, sourceDurationMs: number, sectionDurationMs: number,
): {startRatio: number; widthRatio: number} => ...;

/** Track position 0..1 → Trim In, clamped to the legal range. */
export const trimInFromRatio = (
  ratio: number, sourceDurationMs: number, sectionDurationMs: number,
): number => ...;

/** Evenly spaced sample times, centred in each cell. */
export const stripSampleTimesMs = (
  sourceDurationMs: number, cellCount: number,
): number[] => ...;

/** Strip cell nearest a time — the drag-time approximation for FR-T05. */
export const nearestSampleIndex = (
  timeMs: number, sourceDurationMs: number, cellCount: number,
): number => ...;
```

전부 순수하고 canvas·video·React에 의존하지 않는다. Plan NFR "테스트 가능성"이 요구한 분리선이 정확히 여기다.

**경계 조건** (유닛 테스트로 고정):

| 입력 | 기대 |
|------|------|
| `sourceMs = 0` | `windowMs = 0`, `maxTrimIn = 0`, `widthRatio = 0` |
| `sourceMs ≤ sectionMs` | `widthRatio = 1`, `maxTrimIn = 0`, `startRatio = 0` — 창이 트랙을 덮고 못 움직인다 (FR-S05) |
| `sourceMs = 75s, sectionMs = 6s` | `widthRatio = 0.08`, `maxTrimIn = 69s` |
| `ratio < 0` 또는 `> 1` | 합법 범위로 clamp |
| `cellCount = 0` | 빈 배열 |

### 4.2 `day1PanelsShorterThanSection` — `domain/editor/project.ts`

[project.ts:1056](../../../../src/domain/editor/project.ts:1056) `day1MissingPanels` 바로 옆에 같은 형태로 둔다.

```ts
/**
 * Panels whose source cannot fill their section, which renders black after the
 * source ends. A panel with no source at all is `day1MissingPanels`' concern,
 * so the zero guard keeps the two from double-reporting.
 */
export const day1PanelsShorterThanSection = (
  project: EditorProject,
): Day1PanelKey[] =>
  DAY1_PANEL_KEYS.filter((key, index) => {
    const sourceMs = day1Of(project)?.[key].source?.durationMs ?? 0;

    return (
      sourceMs > 0 && sourceMs < (project.sections[index]?.durationMs ?? 0)
    );
  });
```

**`scenesShorterThanSource`와의 관계**: 이름과 형태를 맞추되 통합하지 않는다. 3장면은 `scenes[index]`를, Day1은 `panelA/panelB`를 읽어 자료구조가 다르고, `scenesShorterThanSource`는 현재 소비자가 없다(Plan §1.4). 둘을 하나로 묶는 일은 3장면에 렌더 차단을 붙이는 다음 사이클에서 판단한다.

---

## 5. UI

### 5.1 `features/editor/TrimStrip.tsx` — 신규

원시값만 받는다. 3장면을 위한 추상화 계층이 아니라, 원시값을 받으니 결과적으로 다음 사이클에 재사용 가능한 형태다 (CLAUDE.md §2).

```ts
type TrimStripProps = {
  disabled: boolean;
  inMs: number;
  sampler: FrameSampler;
  sectionDurationMs: number;
  sourceDurationMs: number;
  /** Cache key. Thumbnails survive collapse and remount (D-D05). */
  sourceId: string | null;
  testIdPrefix: string;
  url: string | null;
  onCommit: (inMs: number) => void;
};
```

**구조**

```
<div data-testid={`${p}-trim-strip`}>
  <img data-testid={`${p}-trim-preview`} />        ← 확대 프레임 (FR-T05)
  <div className="trim__track">                     ← 가로 트랙 (CSS 신규, §1.4)
    {cells.map(cell => <img />)}                    ← 썸네일 16칸 (FR-T01)
    <button role="slider"                           ← 창 (FR-T02, T08)
      data-testid={`${p}-trim-window`}
      aria-valuemin={0} aria-valuemax={maxTrimIn} aria-valuenow={inMs} />
  </div>
</div>
```

**상호작용**

| 동작 | 처리 |
|------|------|
| 포인터 드래그 | 로컬 state로만 이동(§2.2). 확대 프레임은 `nearestSampleIndex` 썸네일로 근사 |
| 포인터 놓기 | `onCommit(inMs)` 1회. 이어서 정확한 프레임을 `maxEdge: 480`으로 샘플 (D-D04) |
| ArrowLeft/Right | ±100ms 이동 후 즉시 커밋 |
| Shift + Arrow | ±1000ms |
| `maxTrimIn === 0` | 창을 트랙 전체 폭으로 그리고 `disabled` (FR-S05) |

키보드 스텝과 `role="slider"` 패턴은 [Timeline.tsx:159-175](../../../../src/features/editor/Timeline.tsx:159)의 경계 핸들을 따른다.

### 5.2 `features/editor/useTrimThumbnails.ts` — 신규

```ts
const CACHE = new Map<string, string[]>();   // sourceId → 썸네일 dataURL 16장

export const useTrimThumbnails = (
  sampler: FrameSampler,
  url: string | null,
  sourceId: string | null,
  sourceDurationMs: number,
): {thumbnails: (string | null)[]; failed: boolean} => ...
```

- 캐시 히트면 샘플링 없이 즉시 반환 (FR-T04)
- **캐시는 실행이 끝까지 갔을 때만 쓴다.** 샘플링 도중 패널을 접으면 abort되고 부분 결과는 버려져, 다시 펼치면 처음부터 샘플링한다. 16칸 기준 수 초짜리 작업이라 부분 결과를 보관할 만한 이득이 없다 (module-3 Do 중 확인)
- 미스면 `stripSampleTimesMs`로 시각을 만들고 `sampler.sample`, `onFrame`마다 배열의 해당 칸을 채워 setState (FR-T03)
- 언마운트/소스 변경 시 `AbortController.abort()`
- 실패하면 `failed: true` → `TrimStrip`이 스스로 렌더를 접는다 (FR-T09)
- 샘플링은 비동기이고 메인 스레드를 점유하지 않으므로 다른 인스펙터 조작이 막히지 않는다 (FR-T10)

### 5.3 `Day1Inspector.tsx` 변경

`PanelSection`([Day1Inspector.tsx:110-200](../../../../src/features/editor/Day1Inspector.tsx:110)) 안에서:

| 변경 | 내용 | FR |
|------|------|-----|
| 추가 | `<TrimStrip>` — Trim In 필드 위 | T01·T02·T05 |
| 유지 | `SecondsField` Trim In (`day1-{key}-trim-in`) | T06 |
| 교체 | Trim Out `SecondsField` → 읽기전용 표시. **testid `day1-{key}-trim-out`은 유지** | T07 |
| 유지 | `day1-{key}-trim-range` 힌트 | — |
| 추가 | 짧은 소스 경고 (§5.5) | S02 |
| 제거 | `onTrimOut` prop | D-D06 |

새 props: `frameSampler`, `resolvePanelUrl(panel)`. 소스 id는 `settings[panel].source.id`로 이미 인스펙터 안에 있어 별도 prop이 필요 없다.

> **Trim Out testid 유지의 함의**: 요소가 `<input>`에서 `<p>`로 바뀌므로 값을 **읽는** E2E는 `textContent`로, **입력하는** E2E는 바꿔야 한다.
>
> **해소됨 (2026-08-15, module-3)**: 착수 시 전수 grep 결과 `day1-a-trim-out` / `day1-b-trim-out`을 참조하는 테스트가 **하나도 없었다** — Day1Inspector 자신뿐이었다. 따라서 수정할 단언이 없었다. (`trim-out`을 쓰는 [editor-vertical-slice.spec.ts:185](../../../../tests/e2e/editor-vertical-slice.spec.ts:185)는 3장면 `SceneInspector` 쪽으로 범위 밖.) `setDay1TrimOut`도 참조가 3곳뿐이라 그대로 제거했다.

> **`SecondsField`의 한 렌더 지연** (module-3 Do 중 확인): `SecondsField`는 prop을 로컬 `draft` 상태로 복사하고 passive effect에서 갱신하므로([inspectorFields.tsx:31-35](../../../../src/features/editor/inspectorFields.tsx:31)), 창의 `aria-valuenow`가 갱신된 커밋보다 한 렌더 늦게 숫자가 따라온다. 사용자에게는 수 밀리초라 무해하지만, E2E는 값이 안정된 뒤를 단언해야 한다(`expect.poll`). 기존 컴포넌트의 동작이며 이번 변경이 만든 것이 아니다.

### 5.4 `EditorWorkspace.tsx` / `App.tsx` 변경

```
App.tsx            createFrameSampler() 생성, hookAnalyzer에 주입, EditorWorkspace에 전달
EditorWorkspace    frameSampler prop 추가 → Day1Inspector로 전달
                   day1Assets.panelUrl / 소스 id를 Day1Inspector로 전달
                   onTrimOut 배선 제거 (D-D06)
projectStore       setDay1TrimOut 액션 제거 (D-D06, 참조 없음 확인 완료)
```

### 5.5 짧은 소스 — 경고와 렌더 게이트

**인스펙터 경고 (FR-S02)** — 3장면 [SceneInspector.tsx:167-172](../../../../src/features/editor/SceneInspector.tsx:167)의 문구 체계를 따른다.

```tsx
{isShort ? (
  <p className="notice notice--warning" data-testid={`day1-${key}-trim-short`}>
    원본이 구간보다 짧아 남은 시간은 검은 화면으로 출력됩니다. 구간 길이를
    줄이거나 더 긴 영상을 사용하세요.
  </p>
) : null}
```

3장면 문구("장면 길이를 줄이세요")와 달리 **해소 경로 두 가지를 모두 적는다**. Day1은 구간 길이가 타임라인 경계 드래그로 조절되고, 이것이 SC5가 검증하는 탈출구다.

**렌더 게이트 (FR-S03·S04) — 경로가 두 개다 (D-D11)**

| 경로 | 게이트 | 사용자에게 보이는 것 |
|------|--------|----------------------|
| Batch | `preflightIssues` | `batch-preflight` 목록에 차단 사유 |
| 단일 MP4 렌더 | `EditorWorkspace`의 렌더 버튼 `disabled` 조건식 + `startRender` 조기 반환 | `day1-short-blocker` 배지 + 버튼 비활성 |

**둘 중 하나만 고치면 나머지 경로로 검은 화면 MP4가 그대로 나간다.** 이것이 Design 초안의 오류였고 module-4에서 정정했다.

`preflightIssues`(Batch)는 [useRenderQueue.ts:78](../../../../src/features/editor/useRenderQueue.ts:78) Day1 분기에 추가한다.

```ts
if (project.templateSettings.template === 'day1') {
  const missingPanels = day1MissingPanels(project);

  if (missingPanels.length > 0) { /* 기존 */ }
  else if (!sourceResolved) { /* 기존 */ }

  // FR-S03/S04 — a short source renders black, so block before the encode.
  const shortPanels = day1PanelsShorterThanSection(project);

  if (shortPanels.length > 0) {
    issues.push(
      `원본이 구간보다 짧아 검은 화면이 출력됩니다. 구간 길이를 줄이거나 더 긴 영상을 사용하세요. 해당 패널: ${shortPanels
        .map((panel) => DAY1_PANEL_LABEL[panel])
        .join(' · ')}`,
    );
  }
}
```

`day1PanelsShorterThanSection`의 `sourceMs > 0` 가드가 있어 소스 없는 패널과 이중 보고되지 않는다(§4.2). 그래서 `else if` 체인이 아니라 독립 `if`로 둔다 — 소스가 하나만 있고 그게 짧은 경우 두 메시지가 모두 유효하다.

단일 렌더 경로는 `narrationTooLong`과 같은 형태로 붙인다 — `shortPanels.length > 0`을 버튼 `disabled`와 `startRender` 조기 반환에 넣고, `editor__blocker` 배지(`day1-short-blocker`)를 띄운다. 기존 차단 배지와 같은 관례를 따르므로 새 개념이 없다.

---

## 6. Error Handling and Degradation

| 상황 | 처리 | FR |
|------|------|-----|
| canvas 컨텍스트 없음 / 디코딩 실패 | 스트립을 접고 `SecondsField`만 남긴다. 에러 토스트 없음 | T09 |
| 샘플 중 일부 프레임만 실패 | 실패한 칸은 빈 칸으로 두고 나머지를 표시. 전량 실패일 때만 축퇴 | T09 |
| 언마운트 중 진행 | `AbortController.abort()`. 콜백은 abort 후 무시 | — |
| 확대 프레임 seek 실패 | 근사 썸네일을 유지 | T05 |
| Hook 분석 실패 | 기존 `HOOK_ANALYSIS_FAILED` 문구 그대로. 샘플러 실패를 감싼다 | SC8 |
| 소스 URL이 null (미연결) | 스트립을 그리지 않는다. 기존 "영상을 올리면..." 안내 유지 | — |

---

## 7. Test Plan

### 7.1 Unit (vitest)

| 대상 | 케이스 |
|------|--------|
| `trimWindow.ts` | §4.1 경계 조건 표 전체 — `sourceMs=0`, `source ≤ section`, 75s/6s, ratio clamp, `cellCount=0` |
| `trimWindow.ts` | `stripSampleTimesMs` 결과가 오름차순이고 `[0, sourceMs)` 안에 있으며 길이가 `cellCount` |
| `trimWindow.ts` | `nearestSampleIndex`가 항상 `[0, cellCount)` |
| `day1PanelsShorterThanSection` | 소스 없음 → `[]` (이중 보고 방지), 짧은 패널만 반환, 정확히 같은 길이는 미포함 |
| `preflightIssues` | Day1 짧은 패널 → 차단 문구 포함, 패널 이름 지목, 3장면 프로젝트는 영향 없음 |
| `heuristicHookAnalyzer` | 가짜 `FrameSampler`를 주입해 `timesMs`가 기존 계산식과 동일한지 고정 (SC8 정적 방어선) |

`TrimStrip`·`useTrimThumbnails`는 canvas·video 의존이라 유닛 테스트하지 않는다 (Plan NFR).

### 7.2 E2E (Playwright)

| # | 시나리오 | SC |
|---|----------|-----|
| E1 | 75초 소스 업로드 → 패널 펼침 → 스트립 칸이 나타남 → 창 드래그 → `day1-a-trim-in` 값 변화 | SC1 |
| E2 | 창을 40초 지점에 놓고 렌더 → 출력 0.2s 프레임이 소스 40.1s와 일치 | SC2 |
| E3 | 창 이동 후 `day1-a-trim-preview`의 `src`가 갱신됨 | SC3 |
| E4 | 4초 소스 + 6초 구간 → `day1-a-trim-short` 경고 노출 + 렌더 차단 문구 | SC4 |
| E5 | 이어서 타임라인 경계를 끌어 구간을 4초 이하로 → 경고와 차단이 모두 사라짐 | SC5 |
| E6 | 스트립 생성 진행 중 `day1-a-trim-in`에 입력 → 정상 반영 | SC6 |
| E7 | 키보드 — 창에 포커스 후 ArrowRight → `aria-valuenow`와 Trim In 증가 | FR-T08 |
| R1 | 기존 `hook-analysis.spec.ts` 전량 통과 + Hook 후보 썸네일 정상 | SC8 |

E2는 직전 세션의 실측 방법(프레임 추출 후 소스 대조)을 그대로 쓴다.

### 7.3 Regression Gate

모듈 종료마다 `npm test && npm run build`. **module-1 종료 시 `hook-analysis.spec.ts`를 반드시 포함한다** — 샘플러 추출의 유일한 회귀 접점이다. 전체 종료 시 `npm run test:e2e` 전량.

---

## 8. Architecture Compliance

| 규칙 | 준수 |
|------|------|
| `features` → `infrastructure` 금지 | `FrameSampler` 포트로 주입 (§1.2). 스트립은 `domain/ports` 타입만 import |
| `domain`에 react/remotion 금지 | `trimWindow.ts`는 순수 함수만 |
| `infrastructure` → `domain` 허용 | `frameSampler.ts`가 `domain/ports` 타입 참조 |
| 계산은 domain, 부수효과는 infrastructure | 창 기하·샘플 시각은 `domain/timeline`, 디코딩은 `infrastructure/media` |

`src/test/architecture.test.ts`가 자동 검증한다.

---

## 9. Out of Scope

Plan §2.2를 승계한다. Design에서 추가로 확정한 제외 항목:

| 항목 | 사유 |
|------|------|
| `scenesShorterThanSource`와 `day1PanelsShorterThanSection` 통합 | 자료구조가 다르고 전자는 소비자가 없다. 3장면 렌더 차단을 붙일 때 판단 (§4.2) |
| 도메인 `setDay1TrimOutMs` 제거 | 자체 테스트가 있고 3장면 형제와 대칭. 내 변경이 만든 고아가 아니다 (D-D06) |
| 스트립 칸 수를 사용자 설정으로 노출 | 요청되지 않은 설정 가능성 (CLAUDE.md §2). 16 고정 |

---

## 10. Implementation Guide

### 10.1 File Structure

```
src/
├── domain/
│   ├── ports/index.ts                      [수정] FrameSampler, SampledFrame, FrameSampleRequest
│   ├── timeline/trimWindow.ts              [신규] 창 기하·샘플 시각 (순수)
│   ├── timeline/trimWindow.test.ts         [신규]
│   └── editor/project.ts                   [수정] day1PanelsShorterThanSection
├── infrastructure/
│   ├── media/frameSampler.ts               [신규] FrameSampler 구현
│   └── hook-analysis/heuristicHookAnalyzer.ts  [수정] 샘플러 주입·소비
├── features/editor/
│   ├── TrimStrip.tsx                       [신규]
│   ├── useTrimThumbnails.ts                [신규]
│   ├── Day1Inspector.tsx                   [수정] 스트립 배선·Out 읽기전용·경고
│   ├── EditorWorkspace.tsx                 [수정] sampler·panelUrl 전달, onTrimOut 제거
│   ├── projectStore.ts                     [수정] setDay1TrimOut 제거
│   ├── useRenderQueue.ts                   [수정] 짧은 소스 게이트
│   └── editor.css                          [수정] 가로 트랙·창·확대 프레임 (§1.4)
├── app/App.tsx                             [수정] createFrameSampler 주입
└── tests/e2e/day1-trim-ux.spec.ts          [신규] E1~E7
```

신규 8, 수정 10.

### 10.2 Implementation Order

1. 포트 정의 → 샘플러 구현 → hook-analysis 리팩터 → **SC8 게이트**
2. 순수 함수 + 유닛 테스트 (UI 없이 전부 검증 가능)
3. 스트립 UI + 배선
4. 짧은 소스 경고 + 렌더 게이트 + E2E

순서의 근거: 1이 가장 위험하므로 먼저 격리해 검증한다. 2는 1과 독립이지만 3의 전제다. 4는 1~3과 독립이라 마지막에 붙여도 되고, 문제가 생기면 단독으로 잘라낼 수 있다.

### 10.3 Session Guide

| 모듈 | 범위 | FR | 종료 조건 |
|------|------|-----|-----------|
| **module-1** | `FrameSampler` 포트 + `frameSampler.ts` + `heuristicHookAnalyzer` 리팩터 + `App.tsx` 주입 | — (기반) | `npm test` + **`hook-analysis.spec.ts` 통과** + Hook 후보 썸네일 육안 확인 (SC8) |
| **module-2** | `trimWindow.ts` + 유닛 테스트 + `day1PanelsShorterThanSection` + 유닛 테스트 | T02·S01 | §4.1 경계 조건 표 전량 통과 |
| **module-3** | `TrimStrip` + `useTrimThumbnails` + `Day1Inspector` 배선 + CSS + Out 읽기전용 + 고아 제거 + 창 잠금 | T01·T03~T10·**S05** | E1·E3·E6·E7 통과, `day1-.*-trim-out` grep 처리 완료 |
| **module-4** | 짧은 소스 경고 + `preflightIssues` 게이트 + E2E 전량 | S02~S04 | E2·E4·E5 통과, `npm run test:e2e` 전량 |

권장 분할: **module-1 단독 세션** (위험 격리), **module-2+3 한 세션** (순수 함수 → 소비가 자연스럽게 이어짐), **module-4 단독 세션** (E2E 실행 시간).

### 10.4 Do Entry Checklist

- [ ] `day1-.*-trim-out` 참조 전수 grep (E2E·유닛 모두)
- [ ] `setDay1TrimOut` 참조 재확인 후 제거
- [ ] module-1 착수 전 `hook-analysis.spec.ts` 기준선 통과 확인
- [ ] 코드 주석 규약: `// Design Ref: §{절}` / `// Plan SC: {기준}`
- [ ] Do 중 새 결정이 나오면 그 자리에서 Plan §1.5 또는 Design §1.5 표에 추가 (회고 교훈)

---

## 11. Requirement Traceability

| FR | 설계 위치 | 검증 |
|----|-----------|------|
| FR-T01 | §5.1 트랙 + §5.2 훅 | E1 |
| FR-T02 | §4.1 `windowBoundsRatio`·`trimInFromRatio`, §5.1 창 | E1, 유닛 |
| FR-T03 | §3.1 `onFrame` 콜백, §5.2 점진적 setState | E1 |
| FR-T04 | §5.2 모듈 레벨 캐시 (D-D05) | E1 (접었다 펴기) |
| FR-T05 | §5.1 확대 프레임, D-D04 별도 샘플 | E3 |
| FR-T06 | §5.3 `SecondsField` 유지 + 양방향 | E6 |
| FR-T07 | §5.3 읽기전용 교체 (D-D06) | E2E 단언 수정 |
| FR-T08 | §5.1 `role="slider"` + 키보드 | E7 |
| FR-T09 | §6 축퇴 표 | 수동 (canvas 차단) |
| FR-T10 | §5.2 비동기 샘플링 | E6 |
| FR-S01 | §4.2 `day1PanelsShorterThanSection` | 유닛 |
| FR-S02 | §5.5 인스펙터 경고 | E4 |
| FR-S03 | §5.5 `preflightIssues` | E4 |
| FR-S04 | §5.5 해소 경로 + 패널 지목 | E4 |
| FR-S05 | §1.3 + §4.1 `widthRatio = 1`, §5.1 disabled | 유닛 |

**SC 커버리지**: SC1→E1, SC2→E2, SC3→E3, SC4→E4, SC5→E5, SC6→E6, SC7→§7.3, SC8→R1 + §7.1 마지막 행. 전 8개 기준에 검증 경로가 있다.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-08-15 | 최초 Design. Option C 채택(사용자 선택). 계층 제약(features ✗→ infrastructure)에 따른 FrameSampler 포트 설계, `domain/timeline/trimWindow.ts` 배치, 6개 Design 결정(D-D01~D-D06) 확정. §1.4에 Plan 재사용 자산 정정(`hook__strip`은 세로 카드 목록) 기록. | 김성권 / Claude |
