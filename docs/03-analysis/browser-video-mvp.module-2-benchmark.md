# Browser Video MVP Module 2 Render PoC

> **Feature**: browser-video-mvp
> **Scope**: module-2
> **Date**: 2026-07-27
> **Status**: PoC Passed with deployment and real-media follow-up gates

## Context Anchor

| Key | Value |
|-----|-------|
| WHY | UA 영상의 다국어·다규격 반복 제작을 서버 없이 브라우저에서 자동화한다. |
| WHO | 사내 UA Manager와 마케터, 최신 데스크톱 Chrome 사용자 |
| RISK | 1080p60 브라우저 렌더의 시간·메모리 부담 |
| SUCCESS | H.264/AAC Single MP4, 30/60fps 비교, web-fs/ArrayBuffer 검증, 60초 렌더 evidence |
| SCOPE | Capability probe와 합성 Composition 기반 로컬 Render PoC만 포함 |

## Decision Record Chain

| Source | Decision | Module 2 Application |
|--------|----------|----------------------|
| Plan | Chrome + GitHub Pages + Remotion Web Renderer | Chrome 150과 Vite 정적 build 사용 |
| Plan | MP4/H.264/AAC, 기본 60fps | 모든 기준 출력에 H.264/AAC를 명시하고 60fps 검증 |
| Design | Option C pragmatic adapter boundary | capability, render request, Composition을 분리 |
| Design | OPFS web-fs 우선 + ArrayBuffer fallback | 두 output target을 동일 Composition으로 비교 |
| Design | 실제 렌더 PoC 후 다음 모듈 진행 | 15초/60초 결과와 ffprobe evidence 생성 |

## Implementation Scope

- Minimal Vite + React + TypeScript scaffold
- Remotion packages pinned to `4.0.499`
- Browser capability probe:
  - Chrome and secure context
  - WebCodecs
  - H.264 and AAC encoders
  - OPFS and File System Access API
  - `canRenderMediaOnWeb()` preflight
- Shared Remotion Composition for Player and browser rendering
- H.264/AAC MP4 render with progress, ETA, cancellation, and output download
- ArrayBuffer and web-fs output targets
- Vitest contract tests and Playwright real-render E2E
- Automated benchmark runner and ffprobe inspection

Editor, project schema/store, gameplay media decode, TTS, Hook analysis, and Batch queue are not part of this scope.

## Reference Environment

| Item | Value |
|------|-------|
| Device | MacBook Air, Apple M5 |
| CPU | 10 cores: 4 performance + 6 efficiency |
| Memory | 16 GB |
| OS | macOS 26.5.1 |
| Browser | Chrome 150.0.7871.182, headless benchmark |
| Node / npm | Node 25.8.2 / npm 11.11.1 |
| Remotion | `remotion`, `@remotion/media`, `@remotion/player`, `@remotion/web-renderer` all `4.0.499` |

Serial number, hardware UUID, and other device identifiers are intentionally excluded.

## Capability Result

| Capability | Result |
|------------|--------|
| Chrome secure context | Pass |
| WebCodecs | Pass |
| H.264 encoder | Pass |
| AAC encoder | Pass |
| OPFS / web-fs | Pass |
| File System Access | Pass |
| Preferred output target | web-fs |

The browser also reported H.265, VP8, VP9, AV1, Opus, MP3, PCM-S16, and FLAC, but the MVP contract remains MP4/H.264/AAC.

## Benchmark Results

The Composition contains deterministic React text/shape motion plus a generated 48kHz mono WAV. It does not decode gameplay video.

| Case | Render | Blob Read | Output | Peak JS Heap | Video Evidence | Audio |
|------|-------:|----------:|-------:|-------------:|----------------|-------|
| 15s 1080×1920 30fps ArrayBuffer | 5.18s | 1.80ms | 366,872 B | 38,797,661 B | H.264, 30/1, 450 frames | AAC |
| 15s 1080×1920 60fps ArrayBuffer | 7.77s | 0.30ms | 580,652 B | 43,277,579 B | H.264, 60/1, 900 frames | AAC |
| 15s 1080×1920 60fps web-fs | 9.32s | 0.80ms | 593,073 B | 42,739,427 B | H.264, 60/1, 900 frames | AAC |
| 60s 1080×1920 60fps web-fs | 31.03s | 0.70ms | 1,893,739 B | 56,647,886 B | H.264, 60/1, 3,600 frames | AAC |

Container durations reported by ffprobe were 15.082667 seconds and 60.074667 seconds. Video stream durations were 14.966667/14.983333 seconds and 59.983333 seconds. Nominal frame rate and exact frame counts match the requested 30/60fps configuration.

### Observations

1. 15-second 60fps ArrayBuffer rendering took about 1.50× the 30fps case.
2. web-fs was about 1.20× slower than ArrayBuffer for this small synthetic 15-second output.
3. Peak JS heap was similar between 15-second ArrayBuffer and web-fs runs.
4. The 60-second 1080p60 web-fs output completed in about 0.52× its playback duration on this reference device.
5. All benchmark files contained both H.264 video and AAC audio.

## Gate Decision

| Gate | Result | Decision |
|------|:------:|----------|
| 15s 9:16 1080p60 H.264/AAC | Pass | Browser rendering is technically viable on the reference device |
| 30fps vs 60fps measurement | Pass | Keep 60fps default and 30fps fallback |
| web-fs and ArrayBuffer execution | Pass | Keep adaptive output target |
| 60s 9:16 1080p60 | Pass | Keep 60-second preset |
| web-fs memory advantage | Not proven | Repeat with real gameplay and larger bitrate output |
| Company production license | Blocked | Do not deploy until Remotion license is internally approved |

Remotion emitted a company-license warning in local E2E. No `free-license` assertion, paid key, purchase, or production deployment was performed. The current official pricing page must be reviewed against company size and the intended internal automation use before deployment.

## Limitations

- The synthetic Composition does not include gameplay video decode, trim, crop, multi-track mixing, TTS, or subtitles.
- Output files are small because the scene is visually simple; OPFS benefits usually appear with larger outputs.
- `performance.memory.usedJSHeapSize` excludes GPU, encoder, decoder, native, and OPFS memory. It is not total browser peak memory.
- Headless Chrome results are reference evidence, not a guarantee for every employee device.
- The 15-second WAV ends before the 60-second video. AAC presence is verified, but full-length audio mixing belongs to module 6.
- The build currently warns about large Remotion/Mediabunny chunks. Production loading optimization is deferred until the editor shell and render entry point are integrated.

## Verification Evidence

| Check | Result |
|-------|--------|
| Vitest | 2 files, 6 tests passed |
| Playwright E2E | Real 1-second browser render passed |
| TypeScript + Vite build | Passed |
| npm audit | 0 vulnerabilities at installation |
| ffprobe | H.264/AAC, requested resolution, nominal fps, and frame count verified |
| Visual inspection | 1440×900 Chrome screenshot, no overlap or clipping observed |

Generated evidence:

- `artifacts/render-poc/benchmark-required.json`
- `artifacts/render-poc/15s-30fps-arraybuffer.mp4`
- `artifacts/render-poc/15s-60fps-arraybuffer.mp4`
- `artifacts/render-poc/15s-60fps-web-fs.mp4`
- `artifacts/render-poc/60s-60fps-web-fs.mp4`

MP4 and JSON evidence are local generated artifacts and are excluded from Git by default.

## Reproduction

```bash
npm install
npm run generate:poc-audio
npm test
npm run build
npm run test:e2e
npm run dev -- --host 127.0.0.1 --port 4173
npm run benchmark:render
```

## Claude Code Handoff

1. Read repository-root `CLAUDE.md` before modifying files.
2. Read the Plan, Design, and this benchmark document.
3. Treat `src/infrastructure/render/`, `src/compositions/RenderPocComposition.tsx`, and `scripts/run-render-benchmark.mjs` as completed module-2 ownership.
4. Module 1 was not fully implemented; only the minimum scaffold needed by module 2 exists.
5. Preserve exact Remotion version alignment and the unresolved deployment license gate.

