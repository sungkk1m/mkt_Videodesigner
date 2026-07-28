# Browser Video MVP Design Document

> **Summary**: Chrome에서 3장면 UA 영상을 편집하고 다국어·다비율 MP4를 서버 없이 생성하는 정적 웹 앱 설계
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Codex
> **Date**: 2026-07-27
> **Status**: Approved for Do
> **Planning Doc**: [browser-video-mvp.plan.md](../../01-plan/features/browser-video-mvp.plan.md)

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Plan | `docs/01-plan/features/browser-video-mvp.plan.md` | Complete |
| Schema Definition | `docs/01-plan/schema.md` | N/A - this document defines the browser data model |
| Coding Conventions | `docs/01-plan/conventions.md` | To be created in Do module 1 |
| UI Wireframe | `docs/02-design/wireframes/editor-layout-wireframes.html` | Option A selected |
| Backend API | N/A | Browser-only static application |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | UA 영상의 다국어·다규격 반복 제작을 디자이너 및 서버 의존 없이 브라우저에서 자동화한다. |
| **WHO** | 사내 UA Manager와 마케터. 사내 데스크톱 외부의 최신 Chrome 환경도 포함한다. |
| **RISK** | 1080p 60fps 브라우저 렌더링의 시간·메모리 부담과 Supertonic 유지보수 종료 공지가 가장 큰 위험이다. |
| **SUCCESS** | 3장면 영상 1개를 편집·미리보기·MP4 출력하고, 4언어×3비율 최대 12개를 중단 없이 순차 생성하며 TTS 실패 시 업로드 음성으로 완료할 수 있다. |
| **SCOPE** | 정적 편집기 기반 → 렌더 PoC → 3장면 템플릿 → 브라우저 TTS 베타 → Single/Batch 최적화 순으로 진행한다. |

---

## 1. Overview

### 1.1 Design Goals

1. `Hook → Gameplay → CTA` 고정 구조로 비전문 편집자가 반복 UA 제작을 빠르게 완료한다.
2. 미리보기와 최종 결과가 같은 Remotion Composition과 프로젝트 스키마를 사용한다.
3. Remotion, TTS, Hook 분석, 저장소를 교체 가능한 adapter로 격리한다.
4. 4언어와 3비율 데이터를 한 프로젝트에 보존하며 최대 12개 결과를 안정적으로 순차 생성한다.
5. 브라우저 성능 한계를 숨기지 않고 사전 진단, 예상 시간, 취소, fallback으로 작업 완료 경로를 유지한다.

### 1.2 Design Principles

- **Fixed workflow, flexible content**: 장면 수와 순서는 고정하되 소스, 길이, trim, crop, 문구, 음성은 조절한다.
- **Local-first**: 원본 미디어와 카피는 애플리케이션 서버로 보내지 않는다.
- **One source of truth**: 편집기, Player, Single render, Batch render가 동일한 검증된 `VideoProject`를 소비한다.
- **Optional intelligence**: Hook 객체 감지와 생성형 TTS는 Beta이며 실패해도 수동 편집과 업로드 음성은 유지한다.
- **Bounded memory**: Batch는 한 번에 한 작업만 렌더·저장하고 완료 Blob과 decoder 참조를 즉시 해제한다.
- **Actionable failure**: 오류는 문제 위치, 원인, 해결 행동, 재시도 가능 여부를 함께 제공한다.

### 1.3 Confirmed Product Decisions

| Area | Decision |
|------|----------|
| Editor | Option A video-editor layout: left inputs, center preview, right inspector, bottom timeline |
| Template | Three fixed scenes: Hook, Gameplay, CTA |
| Default timing | 15s=`2/10/3`, 30s=`3/24/3`, 60s=`3/54/3` |
| Source input | Per-scene image/video plus one-click gameplay video fill for all scenes |
| Hook | User copy + `Impact`, `Caption`, `Focus` motion presets + C-lite candidate analysis |
| Gameplay | Full-frame source only; proof copy and performance badge are excluded |
| CTA | Dedicated media when present; otherwise generate from the last gameplay frame |
| CTA fields | App icon, logo, CTA text, optional subcopy, store badge; legal disclaimer excluded |
| Transitions | `Cut`, `Fade`, `Zoom`; default `Cut` |
| Audio | Original media, BGM, narration with per-track volume and optional auto ducking |
| Ratio edit | Default `cover`, with scale/X/Y and per-ratio override |
| Output | `Fast`, `Standard`, `High`; Standard is 1080p60 |
| Batch save | Directory picker first, normal per-file download fallback |

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| Approach | One editor store and direct SDK calls | Full use-case/repository boundaries | Feature modules with domain and adapter boundaries |
| Estimated source files | 25-35 | 70-90 | 45-60 |
| Complexity | Low initially | High | Medium |
| Maintainability | Low-Medium | High | High |
| PoC speed | Fast | Slow | Fast-Medium |
| Provider replacement | Risky | Easy | Easy |
| UI iteration | Fast initially | More ceremony | Fast |
| Primary risk | Render/TTS state coupling | MVP over-engineering | Boundary discipline required |
| Best fit | Disposable prototype | Multi-team long-term platform | Browser MVP with known provider risk |

**Selected**: **Option C - Pragmatic Modules**

**Rationale**: Remotion, Supertonic, browser storage, file-system APIs have independent failure and replacement cycles. They require explicit ports, but a full use-case class for every UI action would slow an MVP. Pure domain functions, feature-level orchestration, and infrastructure adapters provide sufficient isolation.

### 2.1 Component Diagram

```text
GitHub Pages
└── Static React Application
    ├── App Shell
    │   ├── Capability Gate
    │   └── Editor Workspace
    ├── Domain
    │   ├── VideoProject schema
    │   ├── Timeline invariants
    │   ├── Render validation
    │   └── File naming
    ├── Features
    │   ├── Editor
    │   ├── Media
    │   ├── Hook Analysis
    │   ├── Audio/TTS
    │   └── Render Queue
    ├── Compositions
    │   ├── ThreeSceneComposition
    │   ├── HookScene
    │   ├── GameplayScene
    │   └── CtaScene
    └── Infrastructure
        ├── Remotion Web Renderer
        ├── Transformers.js + Supertonic (Beta)
        ├── MediaPipe/ONNX detector (optional Beta)
        ├── IndexedDB/Cache/OPFS
        └── File System Access / Browser Download
```

No application server, authentication service, cloud database, or render worker exists.

### 2.2 Data Flow

#### Edit and Preview

```text
Local files + copy inputs
  -> media probe and metadata
  -> project commands
  -> Zod validation
  -> projectStore
  -> composition props selector
  -> Remotion Player
  -> debounced IndexedDB metadata save
```

#### Hook C-lite Analysis

```text
Selected gameplay video
  -> downscale to max 320 px / sample near 2 fps
  -> Worker: motion, scene, luminance/color scoring
  -> Web Audio: energy/peak scoring
  -> top 20-30 candidate frames
  -> optional Beta person/face/object detection
  -> normalized weighted score + temporal merge
  -> 3-5 candidate intervals
  -> user selects or manually trims
```

Weights are `scene/motion 35%`, `audio 25%`, `luminance/color 20%`, and optional object/person signal `20%`. If Beta detection is unavailable, available weights are normalized to 100%. Adjacent or overlapping intervals are merged before the top candidates are selected. This score is a visual salience heuristic, not an ad-performance prediction.

#### TTS

```text
Scene subtitle
  -> optional narration override
  -> TtsRequest cache key
  -> provider capability check
  -> Supertonic Beta OR uploaded audio
  -> decoded duration validation
  -> narration asset cache
  -> preview and render props
```

#### Single and Batch Render

```text
Project snapshot
  -> preflight validation
  -> locale x ratio job expansion (max 12)
  -> sequential RenderQueue
  -> Remotion Web Renderer
  -> OPFS web-fs output preferred
  -> directory writer OR browser download fallback
  -> release output/decoder references
  -> next job
```

### 2.3 Dependencies

| Component | Dependency | Purpose | Boundary |
|-----------|------------|---------|----------|
| UI | React, Zustand | View and split transient/project state | `features/*` |
| Validation | Zod | Runtime import and render-props validation | `domain/schema` |
| Preview | Remotion Player | Composition preview | `features/editor` |
| Render | `@remotion/web-renderer` | Browser MP4 render | `infrastructure/render` |
| TTS | Transformers.js, pinned Supertonic assets | Browser inference for ko/en/ja | `infrastructure/tts` |
| Object detection | MediaPipe Tasks Vision or equivalent pinned ONNX | Optional candidate enrichment | `infrastructure/hook-analysis` |
| Persistence | `idb` or thin IndexedDB wrapper | Project and small audio cache | `infrastructure/persistence` |
| Testing | Vitest, Testing Library, Playwright, axe-core | Domain, UI, browser workflow | `tests` |

All Remotion packages must use the exact same pinned version. Model URL and revision must be pinned in a public configuration module. Dependency installation occurs only after the render and license gates are accepted.

### 2.4 Performance and License Gates

Implementation cannot move beyond the PoC module until:

1. A 15-second 9:16 1080p60 composition renders to valid H.264/AAC.
2. 30fps and 60fps render time and peak-memory measurements are recorded.
3. A 60-second 9:16 1080p60 render completes on the reference device or a documented warning/fallback threshold is defined.
4. `web-fs` and ArrayBuffer output paths are verified.
5. Remotion commercial-use terms and Supertonic code/model terms receive internal approval.

Parallel Batch rendering remains disabled unless two-worker measurements show both meaningful speed improvement and acceptable memory headroom. The MVP default is always sequential.

---

## 3. Data Model

### 3.1 Core Types

```typescript
type Locale = 'ko' | 'en' | 'ja' | 'zh-TW';
type AspectRatio = '9:16' | '1:1' | '16:9';
type DurationPreset = 15 | 30 | 60;
type FrameRate = 30 | 60;
type SceneKind = 'hook' | 'gameplay' | 'cta';
type TransitionKind = 'cut' | 'fade' | 'zoom';
type HookMotionPreset = 'impact' | 'caption' | 'focus';
type RenderProfile = 'fast' | 'standard' | 'high';

interface VideoProject {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  durationPreset: DurationPreset;
  scenes: [Scene, Scene, Scene];
  copy: Record<Locale, LocalizedCopy>;
  audio: AudioMix;
  render: RenderSettings;
  selectedLocale: Locale;
  selectedRatio: AspectRatio;
}

interface Scene {
  id: string;
  kind: SceneKind;
  durationFrames: number;
  media: MediaReference | null;
  trim: MediaTrim;
  transforms: RatioTransforms;
  subtitle: SubtitleStyle;
  transitionOut: SceneTransition;
  hook?: HookSceneSettings;
  cta?: CtaSceneSettings;
}

interface MediaReference {
  id: string;
  kind: 'video' | 'image' | 'audio';
  name: string;
  mimeType: string;
  size: number;
  lastModified: number;
  durationMs?: number;
  width?: number;
  height?: number;
  fingerprint: string;
  persistedHandleId?: string;
  status: 'available' | 'permission-required' | 'missing' | 'unsupported';
}

interface MediaTrim {
  inMs: number;
  outMs: number | null;
}

interface MediaTransform {
  fit: 'cover';
  scale: number;
  x: number;
  y: number;
}

interface RatioTransforms {
  base: MediaTransform;
  overrides: Partial<Record<AspectRatio, MediaTransform>>;
}
```

`durationFrames` is authoritative inside a loaded project. Changing frame rate recalculates frame counts from scene seconds so total wall-clock duration remains unchanged. Timeline boundary dragging changes adjacent scene lengths together; the total is invariant.

### 3.2 Copy, CTA, and Subtitle

```typescript
interface LocalizedCopy {
  hook: string;
  hookSubcopy: string;
  sceneSubtitles: Record<SceneKind, string>;
  narrationOverrides: Partial<Record<SceneKind, string>>;
  ctaText: string;
  ctaSubcopy: string;
}

interface SubtitleStyle {
  position: 'top' | 'center' | 'bottom';
  align: 'left' | 'center' | 'right';
  fontSize: number;
  textColor: string;
  emphasisColor: string;
  showBackground: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
}

interface HookSceneSettings {
  motionPreset: HookMotionPreset;
  emphasizedText: string;
  dimBackground: boolean;
  soundEffect: MediaReference | null;
  analysis: HookAnalysisState;
}

interface CtaSceneSettings {
  appIcon: MediaReference | null;
  logo: MediaReference | null;
  storeBadge: MediaReference | null;
  useGeneratedBackground: boolean;
  backgroundBlur: number;
  backgroundDim: number;
}
```

Subtitles are scene-level for the MVP. Word-level timestamps, karaoke highlighting, proof badges, performance claims, and legal-disclaimer fields are excluded.

### 3.3 Audio

```typescript
interface AudioMix {
  originalVolume: number;
  bgm: AudioTrack | null;
  narration: Partial<Record<Locale, Partial<Record<SceneKind, NarrationTrack>>>>;
  ducking: {
    enabled: boolean;
    targetGain: number;
    attackMs: number;
    releaseMs: number;
  };
}

interface AudioTrack {
  source: MediaReference;
  volume: number;
  startMs: number;
  loop: boolean;
}

interface NarrationTrack {
  mode: 'generated' | 'uploaded';
  providerId: string;
  source: CachedAudioReference | MediaReference;
  durationMs: number;
  volume: number;
  voiceId?: string;
  speed?: number;
  requestHash?: string;
}

interface CachedAudioReference {
  cacheKey: string;
  mimeType: string;
  durationMs: number;
  byteLength: number;
}
```

Default ducking lowers original and BGM gain while narration is active, with configurable amount and an envelope around narration boundaries. Automatic time-stretch and truncation are prohibited.

### 3.4 Hook Analysis and Render Queue

```typescript
interface HookCandidate {
  id: string;
  startMs: number;
  endMs: number;
  score: number;
  thumbnailKey: string;
  reasons: Array<'scene' | 'motion' | 'audio' | 'visual-change' | 'person' | 'face' | 'object'>;
  source: 'heuristic' | 'heuristic+beta';
}

interface HookAnalysisState {
  status: 'idle' | 'analyzing' | 'ready' | 'failed';
  progress: number;
  candidates: HookCandidate[];
  selectedCandidateId: string | null;
  betaDetectionEnabled: boolean;
  errorCode?: string;
}

interface RenderSettings {
  profile: RenderProfile;
  fps: FrameRate;
  selectedLocales: Locale[];
  selectedRatios: AspectRatio[];
  filePrefix: string;
}

interface RenderJob {
  id: string;
  locale: Locale;
  ratio: AspectRatio;
  profile: RenderProfile;
  status: 'queued' | 'preparing' | 'rendering' | 'saving' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  outputName: string;
  error?: AppError;
}
```

### 3.5 Invariants and Defaults

| Rule | Definition |
|------|------------|
| Scene order | Exactly `hook`, `gameplay`, `cta` |
| Default duration | 15s: `2/10/3`; 30s: `3/24/3`; 60s: `3/54/3` |
| Total duration | Sum of scene frames must equal preset seconds × fps |
| Minimum scene length | 1 second |
| Hook candidate duration | 2 seconds for 15s; 3 seconds for 30s and 60s |
| Batch size | 1-12 unique locale/ratio jobs |
| Required media | Gameplay source required; Hook can reuse it; CTA can derive its last frame |
| Narration length | Must not exceed assigned scene duration |
| Transition | Default Cut; Fade/Zoom duration 0.1-1.0s and at most half of the shorter adjacent scene |
| Locales | ko, en, ja, zh-TW |
| Ratios | 9:16, 1:1, 16:9 |

### 3.6 Persistence

| Store | Content | Lifetime |
|-------|---------|----------|
| IndexedDB `projects` | Validated project metadata | Until user deletes browser data/project |
| IndexedDB `file-handles` | File/directory handles and metadata | Permission may require re-approval |
| IndexedDB `tts-cache` | Generated audio Blob and metadata | LRU/explicit cache clear |
| Browser model cache | Transformers/Supertonic assets | Browser-managed plus explicit status |
| OPFS | Render temporary/output data | Remove after save or cancellation |
| Project JSON | Metadata and fingerprints only | User-controlled portable file |

Source video, image, uploaded narration, and BGM binaries are not embedded in project JSON. Import and restore show a missing-asset list and support assisted relinking by fingerprint. Generated TTS is reused when its cache key exists; otherwise it is regenerated.

---

## 4. Browser Service Contracts

There is no HTTP application API. This section defines the internal ports that isolate browser and third-party SDK behavior.

### 4.1 Port List

| Port | Main Operation | Implementations |
|------|----------------|-----------------|
| `ProjectRepository` | save/load/list/delete metadata | IndexedDB |
| `MediaResolver` | probe, resolve URL, relink, release | File API/File System Access |
| `TtsProvider` | capability, voices, synthesize | Uploaded audio, Supertonic Beta |
| `HookAnalyzer` | analyze candidate intervals | Heuristic, optional Beta detector |
| `VideoRenderer` | capability, render, cancel | Remotion Web Renderer |
| `OutputWriter` | choose directory, write, fallback download | File System Access, anchor download |

### 4.2 TTS Contract

```typescript
interface TtsProvider {
  readonly id: string;
  getCapabilities(): Promise<TtsCapabilities>;
  listVoices(locale: Locale): Promise<TtsVoice[]>;
  synthesize(
    request: TtsRequest,
    context: { signal: AbortSignal; onProgress: (progress: number) => void },
  ): Promise<TtsResult>;
  dispose(): Promise<void>;
}

interface TtsRequest {
  locale: Locale;
  text: string;
  voiceId: string;
  speed: number;
}

interface TtsResult {
  blob: Blob;
  durationMs: number;
  sampleRate: number;
  providerId: string;
  modelRevision?: string;
}
```

`UploadedAudioProvider` is the stable path for all locales. `TransformersJsSupertonicProvider` is Beta for ko/en/ja only. `zh-TW` returns an unsupported capability with the uploaded-audio action. Text, locale, voice, speed, provider, and model revision form the cache key.

### 4.3 Render Contract

```typescript
interface VideoRenderer {
  probe(): Promise<RenderCapabilities>;
  render(
    input: RenderInput,
    context: { signal: AbortSignal; onProgress: (event: RenderProgress) => void },
  ): Promise<RenderedOutput>;
  disposeOutput(output: RenderedOutput): Promise<void>;
}
```

`RenderInput` is created only from a deep-frozen, schema-valid project snapshot. UI changes during rendering do not mutate an active job. An output must be persisted before the queue starts the next job.

### 4.4 Hook Analysis Contract

```typescript
interface HookAnalyzer {
  analyze(
    source: ResolvedVideo,
    options: HookAnalysisOptions,
    context: { signal: AbortSignal; onProgress: (progress: number) => void },
  ): Promise<HookCandidate[]>;
  dispose(): Promise<void>;
}
```

The heuristic analyzer always runs. The Beta detector receives only the heuristic top 20-30 frames. Detector initialization or inference failure is converted to a warning and heuristic-only candidates remain usable. The detector must be disposed before TTS model load or final render.

### 4.5 Output Naming

The confirmed pattern is:

```text
{project}_{locale}_{ratio}_{duration}s_{fps}fps.mp4
```

Unsafe characters are replaced with `-`, repeated separators collapse, and empty project names become `ua-video`. Ratio uses `9x16`, `1x1`, or `16x9` in filenames. A timestamp suffix is added only when a collision is detected. This Design ordering supersedes the provisional ordering in Plan FR-22.

---

## 5. UI/UX Design

### 5.1 Screen Layout

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Project / Save state       Locale  Ratio  Single|Batch      Render       │
├───────────────┬─────────────────────────────────────┬────────────────────┤
│ Assets        │                                     │ Scene Inspector    │
│ Copy          │          Remotion Preview           │ Transform          │
│ Audio / TTS   │                                     │ Text / Transition  │
│               │                                     │                    │
├───────────────┴─────────────────────────────────────┴────────────────────┤
│ Hook candidate drawer (when Hook analysis is open)                       │
├──────────────────────────────────────────────────────────────────────────┤
│ [Hook clip] [transition] [Gameplay clip] [transition] [CTA clip]         │
└──────────────────────────────────────────────────────────────────────────┘
```

The app is a desktop work surface, not a landing page. Minimum supported viewport is 1280×720. Smaller viewports show an unsupported-width notice without destroying saved work.

### 5.2 Primary User Flow

```text
Capability check
  -> Create or restore project
  -> Add gameplay source / optionally fill all scenes
  -> Analyze or manually select Hook
  -> Enter four-language copy
  -> Configure CTA assets and audio/TTS
  -> Review ratio-specific framing
  -> Single preview/render
  -> Select Batch combinations
  -> Preflight
  -> Sequential save
  -> Retry failures if any
```

### 5.3 Visual System

| Token | Value |
|-------|-------|
| Workspace background | Neutral light gray |
| Panels | White / near-white with 1px neutral border |
| Navigation/timeline | Charcoal |
| Primary action | Blue |
| Warning | Amber |
| Error | Red |
| Success | Green |
| Radius | 4px controls, maximum 8px dialogs/items |
| Spacing | 4px base grid |
| UI type | System sans; project content uses locale-specific font |
| Tone | Dense, quiet, utilitarian UA production tool |

Icon buttons use Lucide icons and tooltips. Stable toolbar, timeline, preview, and inspector dimensions prevent layout shifts.

### 5.4 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `CapabilityGate` | `src/app` | Chrome/API/codec diagnostics |
| `EditorHeader` | `src/features/editor` | Project, mode, locale, ratio, render action |
| `AssetPanel` | `src/features/media` | Upload, quick-fill, missing-asset repair |
| `CopyPanel` | `src/features/editor` | Four-locale Hook, subtitle, CTA copy |
| `AudioPanel` | `src/features/audio` | Original/BGM/narration mix and TTS |
| `PreviewStage` | `src/features/editor` | Remotion Player and safe-area overlay |
| `SceneInspector` | `src/features/editor` | Trim, transform, subtitle, transition settings |
| `Timeline` | `src/features/editor` | Fixed three clips and draggable boundaries |
| `HookCandidateDrawer` | `src/features/hook-analysis` | Candidate filmstrip and manual range |
| `BatchDialog` | `src/features/render` | Combination selection and preflight |
| `RenderQueuePanel` | `src/features/render` | Progress, ETA, cancel, retry |
| `MissingAssetsDialog` | `src/features/media` | Relink unresolved files |
| `ProjectMenu` | `src/features/editor` | New, import, export, cache management |

### 5.5 Page UI Checklist

#### Capability Gate

- [ ] Status: Chrome version and secure-context result
- [ ] Status: WebCodecs encode/decode support
- [ ] Status: H.264 and AAC capability
- [ ] Status: OPFS and File System Access support
- [ ] Status: WebGPU and WASM TTS availability
- [ ] Status: optional Beta object detector availability
- [ ] Action: Continue with supported features
- [ ] Action: Re-run diagnostics
- [ ] Notice: unsupported browser or viewport with exact fallback

#### Editor Header

- [ ] Input: project name
- [ ] Status: saved, saving, save failed
- [ ] Select: duration preset 15, 30, 60 seconds
- [ ] Select: active locale ko, en, ja, zh-TW
- [ ] Select: active ratio 9:16, 1:1, 16:9
- [ ] Segmented control: Single, Batch
- [ ] Button: undo and redo
- [ ] Button: open project menu
- [ ] Button: render current output or open Batch dialog

#### Left Input Panel

- [ ] Tabs: Assets, Copy, Audio/TTS
- [ ] Upload: per-scene video or image
- [ ] Button: use one gameplay video for all scenes
- [ ] Status: file type, duration, dimensions, codec support
- [ ] Input set: Hook and optional Hook subcopy for all four locales
- [ ] Input set: scene subtitle and optional narration override for all four locales
- [ ] Input set: CTA and optional CTA subcopy for all four locales
- [ ] Upload: app icon, logo, store badge, dedicated CTA media
- [ ] Upload: BGM and per-scene uploaded narration
- [ ] Slider: original, BGM, narration volume
- [ ] Toggle and amount control: auto ducking
- [ ] Select: TTS voice and speed for supported locales
- [ ] Buttons: generate current, generate all, preview, regenerate, remove
- [ ] Status: model download/inference progress and Beta label
- [ ] `zh-TW` notice: upload narration required when narration is used

#### Preview Stage

- [ ] Remotion Player: play, pause, seek, current time, duration
- [ ] Control: preview scale/fit
- [ ] Overlay: aspect-safe area toggle
- [ ] Status: active locale, ratio, fps
- [ ] Warning overlay: missing asset or invalid narration duration
- [ ] Preview: exact Hook motion, Gameplay framing, CTA fallback

#### Scene Inspector

- [ ] Scene title and source status
- [ ] Inputs: trim in and out
- [ ] Control: fit fixed to Cover
- [ ] Controls: scale, X, Y, reset
- [ ] Toggle: use ratio-specific transform override
- [ ] Subtitle controls: position, alignment, size, text color, emphasis color
- [ ] Subtitle controls: background toggle, color, opacity
- [ ] Hook controls: Impact, Caption, Focus; emphasized text; dim; SFX
- [ ] CTA controls: generated background, blur, dim
- [ ] Transition controls: Cut, Fade, Zoom and duration

#### Timeline and Hook Candidate Drawer

- [ ] Three stable clips: Hook, Gameplay, CTA
- [ ] Draggable boundaries preserving total duration
- [ ] Transition markers between clips
- [ ] Playhead and click-to-seek
- [ ] Button: analyze Hook candidates
- [ ] Toggle: Beta object/person detection
- [ ] Status: analysis progress, cancellation, heuristic fallback warning
- [ ] Filmstrip: 3-5 candidates with thumbnail, score, reasons, interval
- [ ] Actions: preview candidate, select candidate
- [ ] Manual range handles for Hook start adjustment

#### Batch Dialog and Queue

- [ ] Checkboxes: four locales
- [ ] Checkboxes: three ratios
- [ ] Select: Fast, Standard, High
- [ ] Select: 30 or 60fps, constrained by profile
- [ ] Summary: job count, estimated time, output destination
- [ ] Preflight list: media, copy, audio length, codec, storage permission
- [ ] Button: choose output directory
- [ ] Button: start Batch
- [ ] Queue row: locale, ratio, state, progress, elapsed, ETA, filename
- [ ] Actions: cancel current/all, retry failed item, reveal completion state
- [ ] Notice: fallback to normal browser downloads after directory denial

#### Project and Recovery Dialogs

- [ ] Actions: new project, export JSON, import JSON
- [ ] List: autosaved local projects with update time
- [ ] List: missing assets with expected metadata
- [ ] Action: relink one asset or select a folder for assisted matching
- [ ] Cache display: TTS/model/temp output usage
- [ ] Actions: clear generated TTS cache and render temp files separately
- [ ] Confirmation: destructive local-project or cache deletion

---

## 6. Error Handling

### 6.1 Error Shape

```typescript
interface AppError {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
  action?: {
    label: string;
    target: 'settings' | 'scene' | 'audio' | 'relink' | 'retry' | 'diagnostics';
  };
  retryable: boolean;
  cause?: unknown;
}
```

Raw SDK errors are logged to an in-memory diagnostic log but are not shown directly as the primary user message.

### 6.2 Error Codes

| Code | Cause | User Handling | Retry |
|------|-------|---------------|:-----:|
| `UNSUPPORTED_BROWSER` | Non-Chrome or missing secure context | Open supported Chrome/HTTPS | No |
| `CODEC_UNSUPPORTED` | Input decode or H.264/AAC encode unavailable | Replace/transcode source or change environment | No |
| `MEDIA_PERMISSION_REQUIRED` | Persisted handle lacks permission | Re-authorize file/folder | Yes |
| `MEDIA_MISSING` | Referenced source cannot resolve | Open relink dialog | Yes |
| `MEDIA_PROBE_FAILED` | Metadata or frame decode failed | Replace source | Yes |
| `PROJECT_INVALID` | Imported or stored schema fails | Show field-level issues; preserve current project | No |
| `TIMELINE_INVALID` | Scene sum/minimum invariant fails | Focus timeline boundary | No |
| `HOOK_ANALYSIS_FAILED` | Heuristic decode/analysis failed | Manual Hook selection | Yes |
| `BETA_DETECTOR_FAILED` | Model load/inference failed | Continue heuristic-only | Yes |
| `TTS_UNSUPPORTED_LOCALE` | Provider does not support locale | Upload audio | No |
| `TTS_MODEL_LOAD_FAILED` | Model network/cache/runtime failure | Retry, use WASM, or upload audio | Yes |
| `TTS_GENERATION_FAILED` | Inference failed | Retry or upload audio | Yes |
| `NARRATION_TOO_LONG` | Audio exceeds scene | Edit copy/audio or scene duration | No |
| `RENDER_PREFLIGHT_FAILED` | One or more blocking validations | Navigate to issue list | No |
| `RENDER_OUT_OF_MEMORY` | Browser memory exhaustion | Retry Fast/30fps after cleanup | Yes |
| `RENDER_FAILED` | Web renderer/encoder failure | Retry failed job | Yes |
| `RENDER_CANCELLED` | User cancellation | Keep completed outputs | Yes |
| `OUTPUT_PERMISSION_DENIED` | Directory write denied | Switch to browser download | Yes |
| `OUTPUT_WRITE_FAILED` | File write or storage failure | Re-select directory/retry | Yes |
| `AUTOSAVE_FAILED` | IndexedDB quota or write failure | Export JSON and clear cache | Yes |

### 6.3 Queue Failure Policy

- One failed Batch item is marked failed and the queue continues.
- Completed files are never recreated on "retry failed."
- Cancellation aborts the active provider, removes incomplete OPFS output, marks unstarted jobs cancelled, and preserves completed outputs.
- Before every render retry, object detector and unused TTS model references are disposed and stale object URLs are revoked.

---

## 7. Security and Privacy

- [ ] GitHub Pages HTTPS and no mixed-content dependencies
- [ ] No application server, credentials, API keys, analytics SDK, or user tracking in MVP
- [ ] Local media never uploaded by application code
- [ ] Network allowlist limited to static app assets, approved fonts, and pinned model assets
- [ ] User copy rendered as React text, never injected through `dangerouslySetInnerHTML`
- [ ] JSON import validated with size limit, schema version, enum bounds, and unknown-key policy
- [ ] Media MIME, extension, decoded metadata, duration, and size validated before use
- [ ] Object URLs revoked when source/project changes
- [ ] Workers terminated and model resources disposed on cancellation
- [ ] File-system permissions requested only after an explicit user action
- [ ] Cache clear and project deletion require confirmation and never delete source files
- [ ] Dependency lockfile, exact Remotion versions, and CI audit retained
- [ ] Remotion and Supertonic code/model license approval recorded before internal deployment

Model downloads mean the first TTS or Beta detection use is not fully offline. UI copy must state this without implying that user media is uploaded.

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: Domain/Port Contract | schemas, timeline, naming, scoring, queue, adapter contracts | Vitest | Do |
| L2: UI Action | all §5.5 controls and states | Testing Library + Playwright | Do |
| L3: E2E Scenario | real Chrome edit/render/recovery workflows | Playwright + ffprobe | Do/Check |
| Performance/Soak | 60fps and 12-job queue | Chrome Performance tools + scripted fixtures | Do/Check |

### 8.2 L1 Scenarios

| # | Target | Test | Expected |
|---|--------|------|----------|
| 1 | Project schema | Valid v1 project round-trip | No data loss |
| 2 | Project schema | Unknown locale, negative duration, malformed color | Typed validation failure |
| 3 | Timeline | Initialize 15/30/60 presets | Exact `2/10/3`, `3/24/3`, `3/54/3` |
| 4 | Timeline | Drag one boundary | Adjacent durations change; total invariant holds |
| 5 | Timeline | Move below 1-second minimum | Change rejected/clamped |
| 6 | Ratio transform | Update 9:16 override | Base and other ratios unchanged |
| 7 | Hook scoring | Heuristic-only fixture | Deterministic normalized ranking |
| 8 | Hook scoring | Beta detector failure | Heuristic candidates preserved |
| 9 | TTS cache | Same request/model revision | Provider called once |
| 10 | TTS duration | Result longer than scene | `NARRATION_TOO_LONG` blocker |
| 11 | Batch expansion | 4 locales × 3 ratios | 12 unique sequential jobs |
| 12 | Batch queue | Middle job fails | Later jobs run; failed item retryable |
| 13 | File naming | Unicode/unsafe/collision inputs | Sanitized deterministic filename |
| 14 | Persistence | Metadata export | No media/audio binary embedded |
| 15 | Restore | Missing source fingerprint | Missing-asset recovery state |
| 16 | Cancellation | Abort render/analyzer/TTS | Provider abort and resource cleanup |

Port contract suites run against fake providers first and each real adapter where browser automation permits.

### 8.3 L2 UI Action Scenarios

| # | Area | Action | Expected Result |
|---|------|--------|-----------------|
| 1 | Capability | Load with WebGPU disabled | Editor available; TTS Beta marked unavailable |
| 2 | Assets | Quick-fill gameplay | All three scenes receive source; CTA remains overrideable |
| 3 | Copy | Switch locale after editing | Independent locale value preserved |
| 4 | Preview | Switch ratio | Correct transform override and safe area displayed |
| 5 | Timeline | Drag Hook boundary | Preview duration and frame count update |
| 6 | Hook drawer | Select candidate | Hook trim start and preview update |
| 7 | Hook drawer | Beta fails | Warning shown; heuristic candidates selectable |
| 8 | Audio | Enable ducking and play narration | Mix controls persist and preview gain changes |
| 9 | TTS | Select zh-TW | Generate disabled; upload action visible |
| 10 | TTS | Generated audio too long | Scene error and render blocker visible |
| 11 | Single | Start then cancel render | Progress closes cleanly; editor remains usable |
| 12 | Batch | Select 12 combinations | Count and sequential queue rows equal 12 |
| 13 | Batch | Directory permission denied | Browser download fallback offered |
| 14 | Restore | Import project with missing media | Relink dialog lists exact files |
| 15 | Autosave | Change project then reload | Metadata restored or actionable permission request shown |

### 8.4 L3 E2E Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-----------------|
| 1 | First Single render | Diagnostics → upload fixture → enter copy → preview → Standard render | Valid 1080p60 H.264/AAC MP4 |
| 2 | Hook-assisted render | Analyze → select candidate → apply Impact → render | Output starts at selected source interval |
| 3 | CTA fallback | No CTA media → render | Last gameplay frame background plus icon/logo/text visible |
| 4 | Four-locale project | Enter all locale fields → switch repeatedly → save/reload | No locale value loss; correct fonts |
| 5 | Ratio framing | Set three overrides → render each ratio | Resolution and crop match settings |
| 6 | Uploaded narration fallback | Disable WebGPU → upload audio → render | Narration included without TTS provider |
| 7 | Batch recovery | Run 12 jobs with one injected failure → retry failed | 11 initial completions plus one retry; no duplicate completed outputs |
| 8 | Project portability | Export JSON → new browser context → import → relink | Project restored; no binary expected in JSON |
| 9 | GitHub Pages | Load from repository subpath and refresh | App, workers, fonts, model URLs resolve |

### 8.5 Fixtures and Output Verification

| Fixture | Minimum |
|---------|---------|
| Video | 10s H.264/AAC gameplay, 65s H.264/AAC gameplay, unsupported-codec sample |
| Image | Landscape and portrait PNG/JPEG |
| Audio | WAV/MP3 shorter than scene and longer than scene |
| Copy | ko/en/ja/zh-TW normal, empty optional, long overflow strings |
| Projects | Valid v1, missing assets, invalid schema, all 12 Batch combinations |

`ffprobe` verifies codec, audio codec, fps, duration tolerance, and resolution. Screenshot comparisons verify each ratio, Hook preset, subtitle safe area, and CTA fallback. No source file is modified during tests.

### 8.6 Performance Acceptance

- Editing input response p95 ≤ 100ms outside active model loading.
- Cancel action is acknowledged within 1 second.
- Same-language TTS provider calls are zero for ratio-only rerenders after first generation.
- Model initialization occurs at most once per compatible operation group.
- Batch retains only the active rendered output plus minimal queue metadata.
- 60-second 1080p60 and 12-job results are recorded by reference device; failure triggers profile warning/fallback design, not silent degradation.

---

## 9. Pragmatic Clean Architecture

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| App | Bootstrap, router-free shell, global error boundary | `src/app/` |
| Domain | Pure entities, schemas, invariants, selectors | `src/domain/` |
| Features | UI and workflow orchestration | `src/features/` |
| Compositions | Remotion visual output components | `src/compositions/` |
| Infrastructure | Browser and third-party SDK adapters | `src/infrastructure/` |
| Shared | Design-system primitives and dependency-free utilities | `src/shared/` |

### 9.2 Dependency Direction

```text
app -> features -> domain
app -> infrastructure adapters
features -> domain + public port interfaces
infrastructure -> domain + public port interfaces
compositions -> domain + shared
domain -> no UI, browser, Remotion, Zustand, or provider dependency
```

App composition injects adapters into feature services. Components do not instantiate Remotion renderer, IndexedDB, model runtimes, or file handles directly.

### 9.3 State Ownership

| Store | Persistent | Content |
|-------|:----------:|---------|
| `projectStore` | Yes | Valid `VideoProject`, undo/redo command history |
| `renderStore` | No | Queue, progress, ETA, cancellation, active snapshot |
| `uiStore` | No | Selected panel/scene, dialogs, drawer, preview playhead |

Provider instances and heavyweight model objects live outside Zustand in adapter-owned lifecycle managers. Stores hold serializable IDs and statuses only.

### 9.4 Import Rules

| From | May Import | Must Not Import |
|------|------------|-----------------|
| `domain` | domain modules, pure validation library | React, browser APIs, SDK adapters |
| `compositions` | domain, shared, Remotion visual APIs | stores, IndexedDB, TTS models |
| `features` | domain, shared, own public feature API | another feature's internal files |
| `infrastructure` | domain ports/types | feature components or stores |
| `app` | public feature and infrastructure entry points | feature internals |

Each feature exposes a small `index.ts`. ESLint import restrictions enforce boundaries.

---

## 10. Coding Convention Reference

### 10.1 Naming and Files

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `HookCandidateDrawer.tsx` |
| Hooks | `use` + camelCase | `useRenderQueue.ts` |
| Pure functions | camelCase | `rebalanceSceneDurations()` |
| Constants | UPPER_SNAKE_CASE | `MAX_BATCH_JOBS` |
| Types | PascalCase | `RenderJob` |
| Feature folders | kebab-case | `hook-analysis/` |
| Tests | co-located `.test.ts(x)`; E2E `.spec.ts` | `timeline.test.ts` |
| IDs | lowercase prefix + UUID | `scene_<uuid>` |

### 10.2 TypeScript and Error Rules

- TypeScript strict mode with `noUncheckedIndexedAccess`.
- Domain changes occur through pure command functions; direct nested mutation is prohibited.
- Zod schemas are the runtime source of truth; inferred types are preferred where practical.
- `unknown` is narrowed; `any` requires a documented adapter-boundary exception.
- Expected failures return typed results or `AppError`; error swallowing is prohibited.
- `AbortSignal` is required for analysis, model generation, rendering, and output writing.
- Time in domain data uses frames or milliseconds with the unit included in the name.
- User-facing Korean UI copy is centralized; code identifiers and comments remain English.

### 10.3 Import Order

1. External libraries
2. Internal absolute imports via `@/`
3. Relative imports
4. Type-only imports
5. Styles

### 10.4 Dependency and Configuration Rules

- Exact versions for all Remotion packages; no version ranges between Remotion packages.
- Lockfile committed.
- Public model revision and asset URLs centralized in `src/shared/config/models.ts`.
- No `.env`, secret, or runtime backend configuration.
- GitHub Pages base path comes from Vite build configuration.
- PoC measurements and license approvals are recorded in `docs/03-analysis/` or a dedicated decision record before deployment.

---

## 11. Implementation Guide

### 11.1 File Structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── AppProviders.tsx
│   └── CapabilityGate.tsx
├── domain/
│   ├── project/
│   ├── timeline/
│   ├── hook/
│   ├── audio/
│   └── render/
├── features/
│   ├── editor/
│   ├── media/
│   ├── hook-analysis/
│   ├── audio/
│   └── render/
├── compositions/
│   ├── ThreeSceneComposition.tsx
│   ├── scenes/
│   └── shared/
├── infrastructure/
│   ├── media/
│   ├── hook-analysis/
│   ├── tts/
│   ├── render/
│   ├── persistence/
│   └── output/
├── shared/
│   ├── components/
│   ├── config/
│   ├── errors/
│   └── utils/
└── test/
    ├── fixtures/
    └── setup/

tests/
├── e2e/
└── render/
```

### 11.2 Implementation Order

1. Scaffold Vite/React/TypeScript, conventions, CI, domain schema, and fake adapters.
2. Run capability and Remotion browser-render PoC; record 30/60fps and output-target results.
3. Implement media probe, file resolution, project persistence, import/export, and recovery.
4. Build the A-layout editor, timeline, 3-scene Composition, transitions, ratio transforms, and CTA fallback.
5. Implement Hook heuristic Worker, candidate drawer, manual trim, then optional Beta detector.
6. Implement audio mixer, uploaded-audio path, TTS provider contract, Supertonic Beta, and cache.
7. Implement Single/Batch queue, output writer, retry/cancel, profiles, E2E, Pages deployment, and license gate.

Each module is complete only when its associated L1/L2 tests pass. Real 1080p60 rendering must not be mocked in the PoC and final E2E gates.

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| Foundation | `module-1` | Scaffold, conventions, domain schema, stores, ports, architecture tests | 30-40 |
| Render PoC | `module-2` | Capability probe, basic Composition, Web Renderer, OPFS/ArrayBuffer benchmark | 35-45 |
| Editor Vertical Slice | `module-3a` | Session-only footage upload, fixed timeline, trim/transform, 9:16 preview and Single render | 30-40 |
| Media and Persistence | `module-3` | Probe, file handles, IndexedDB, autosave, JSON, relink | 35-45 |
| Editor and Composition | `module-4` | A-layout UI, timeline, 3 scenes, transforms, copy, transitions, CTA | 50-65 |
| Hook C-lite | `module-5` | Heuristic Worker, audio peaks, candidate drawer, optional Beta detector | 45-60 |
| Audio and TTS | `module-6` | Mix, ducking, upload provider, Supertonic provider, cache, duration validation | 50-65 |
| Render and Release | `module-7` | Profiles, Single/Batch queue, directory/download, E2E, Pages and gates | 50-65 |

#### Recommended Session Plan

| Session | Phase | Scope | Goal |
|---------|-------|-------|------|
| 1 | Do | `module-1` | Establish tested project/domain foundation |
| 2 | Do | `module-2` | Decide whether browser 1080p60 is viable before broad build |
| 2.5 | Do | `module-3a` | Surface a usable editor before persistence work |
| 3 | Do | `module-3` | Make local projects and assets recoverable |
| 4 | Do | `module-4` | Deliver usable non-TTS Single editor |
| 5 | Do | `module-5` | Add Hook recommendation without blocking manual work |
| 6 | Do | `module-6` | Add upload narration first, then Beta generation |
| 7 | Do | `module-7` | Complete Batch, output, deployment, and full verification |
| 8 | Check | Full | Gap analysis, smoke matrix, performance and license evidence |

`module-3a` was inserted before full `module-3` persistence and `module-4` editor
completion so users could upload real footage, adjust the fixed three-scene
timeline, and download an MP4 earlier. It intentionally excludes IndexedDB,
autosave, JSON import/export, relink, additional ratios, four-locale copy, Hook
motion and analysis, CTA assets, TTS, audio mixing, and Batch. Those remain owned
by `module-3` through `module-7`. Evidence:
`docs/03-analysis/browser-video-mvp.module-3a-evidence.md`.

`module-1` was completed after `module-3a`, at a pragmatic scope: schemas,
stores, and ports were built only where a consumer exists today or in
`module-3`. Fake port implementations, `renderStore`, `uiStore`, and schemas for
unimplemented modules are deferred to the modules that need them. Conventions
live in `docs/01-plan/conventions.md` and are enforced by
`src/test/architecture.test.ts`. Evidence:
`docs/03-analysis/browser-video-mvp.module-1-foundation.md`.

#### Module Completion Log

All Do modules are implemented. Each entry links the evidence document that records
its scope, decisions, verification commands, and known limitations.

| Module | Scope Key | Evidence | Status |
|--------|-----------|----------|--------|
| Foundation | `module-1` | `browser-video-mvp.module-1-foundation.md` | Complete (pragmatic scope) |
| Render PoC | `module-2` | `browser-video-mvp.module-2-benchmark.md` | Complete |
| Editor Vertical Slice | `module-3a` | `browser-video-mvp.module-3a-evidence.md` | Complete |
| Media and Persistence | `module-3` | `browser-video-mvp.module-3-persistence.md` | Complete |
| Editor and Composition | `module-4` | `browser-video-mvp.module-4-editor.md` | Complete |
| Hook C-lite | `module-5` | `browser-video-mvp.module-5-hook.md` | Complete, heuristic only |
| Audio and TTS | `module-6` | `browser-video-mvp.module-6-audio-tts.md` | Complete, generated narration unverified |
| Render and Release | `module-7` | `browser-video-mvp.module-7-render-release.md` | Complete, deployment gated |

#### Deliberate Deviations from This Design

These are implemented differently from the text above, each for a recorded reason.
No functional requirement was dropped.

| Design Ref | Design says | Implemented as | Why |
|-----------|-------------|----------------|-----|
| §1.3 Transitions | Fade/Zoom between clips | Applied inside each scene's own frames (fade out, then fade in) | An overlapping crossfade shortens the timeline and breaks the §3.5 "sum of scene frames equals preset × fps" invariant |
| §3.3 Audio | `CachedAudioReference` for generated TTS | Generated audio uses `MediaReference` with the cache key as its id | One reference type means one URL resolver, one relink path, one persistence rule |
| §3.2 Hook | `HookAnalysisState` persisted on the scene | Candidates are transient component state; only the resulting Hook trim persists | Candidates carry JPEG thumbnails, and §3.6 requires project JSON to be metadata only |
| §4.2 TTS | `UploadedAudioProvider` implements `TtsProvider` | Upload is a first-class per-scene action for every locale, not a synthesising provider | A provider whose `synthesize` can never succeed is a misleading contract |
| §5.4 | `BatchDialog` / `RenderQueuePanel` in `features/render` | Both live in `features/editor`; queue logic is pure in `domain/render/queue.ts` | §9.4 forbids cross-feature imports and the batch operates on the editor's store |
| §3.1 | `MediaReference.durationMs` required | Optional, with the video source required to carry one | CTA still images share the same reference type |

#### Not Implemented

| Item | Design Ref | Reason |
|------|-----------|--------|
| Beta object/person detector | §2.2, §4.4 | Marked optional; weights renormalise so heuristic-only scores stay correct |
| Verified Supertonic generation | §4.2 | Provider is wired and capability-gated, but no real model download was executed. Uploaded audio is the verified path for every locale |
| `narrationOverrides` | §3.2 | Scene subtitle is the single source of spoken copy today |
| Safe-area overlay toggle | §5.5 | Ratio selector plus live preview covers the framing need |
| Cache usage display and cache clearing UI | §5.5 | `createTtsCache().clear()` exists but is not surfaced |
| Queue persistence across reload | §5.5 | An interrupted batch restarts from the dialog |
| GitHub Pages subpath verification | §8.4 #9 | Nothing has been deployed; blocked by the license gate |

### 11.4 Do Entry Checklist

- [ ] User approves starting implementation.
- [ ] Target repository ownership and Git initialization are confirmed.
- [ ] Remotion package license path is approved for the intended internal use.
- [ ] Module 2 reference device and benchmark recording method are identified.
- [ ] Initial dependencies are pinned and their licenses recorded.
- [ ] No production deployment or environment configuration is changed without explicit approval.

---

## 12. Requirement Traceability

| Plan Requirement | Design Coverage |
|------------------|-----------------|
| FR-01 | §2.4, §5.5 Capability Gate, §6 |
| FR-02 | §1.3 default timing, §3.5 invariants, §5.5 timeline |
| FR-03 | §3.1 media/transform types, §5.5 Scene Inspector |
| FR-04 | §1.3 and §3.5; confirmed scene name is Gameplay without Proof overlay |
| FR-05 | §3.2 localized copy, §5.5 Left Input Panel |
| FR-06 | §5.3 visual system, §8.4 four-locale project |
| FR-07 | §3.2 localized narration override, §4.2 |
| FR-08 | §4.2 TTS contract |
| FR-09 | §4.2 UploadedAudioProvider, §5.5 Audio/TTS |
| FR-10 | §4.2 Supertonic Beta, §5.5 model/voice controls |
| FR-11 | §4.2 zh-TW capability, §5.5 zh-TW notice |
| FR-12 | §3.5 narration invariant, §6 `NARRATION_TOO_LONG` |
| FR-13 | §2.2 Single render flow, §5.5 Preview and Header |
| FR-14 | §3.4 RenderJob, §3.5 maximum 12 |
| FR-15 | §2.2 sequential queue, §6.3 |
| FR-16 | §5.5 Batch queue, §6.3 |
| FR-17 | §3.3 cache key, §3.6 cache, §8.2 |
| FR-18 | §1.3 output, §5.5 Batch settings, §8.6 |
| FR-19 | §2.2 output flow, §2.4 PoC gate |
| FR-20 | §3.6 persistence, §5.5 Project dialogs |
| FR-21 | §3.6 restore policy, §5.5 Recovery dialogs |
| FR-22 | §4.5; confirmed Design ordering supersedes provisional Plan ordering |
| FR-23 | §5.5 Queue, §6.3 |
| FR-24 | §8.4 scenario 9, §10.4, module 7 |
| Hook B + C-lite | §1.3, §2.2, §3.4, §4.4, §5.5 |
| CTA hybrid | §1.3, §3.2, §8.4 scenario 3 |
| Audio ducking | §3.3, §5.5, §8.3 |
| Ratio-specific framing | §3.1, §5.5, §8 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-07-27 | Initial Design. Option C architecture, A-layout editor, Hook B+C-lite, hybrid CTA, audio ducking, and sequential Batch confirmed. | 김성권 / Codex |
