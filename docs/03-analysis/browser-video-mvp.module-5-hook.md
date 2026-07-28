# Module 5 Evidence — Hook C-lite

> **Feature**: `browser-video-mvp`
> **Scope key**: `module-5`
> **PDCA phase**: Do
> **Date**: 2026-07-28
> **Status**: Implemented and verified (heuristic only; Beta detector deferred)

---

## 1. Scope Delivered

| Design Ref | Item | Result |
|-----------|------|--------|
| §2.2 | Downscale to max 320px, sample near 2fps (500ms step, 240 sample cap) | Done |
| §2.2 | Worker computes motion, scene-cut, luminance and colour change | Done |
| §2.2 | Web Audio RMS energy per sample window via `OfflineAudioContext` | Done |
| §2.2 | Weighted normalised score with renormalisation when the Beta signal is absent | Done |
| §2.2 | Top 24 frames, temporal merge, 3-5 candidate intervals | Done |
| §3.5 | Candidate length 2s for the 15s preset, 3s for 30s and 60s | Done |
| §5.5 | Candidate drawer: analyse, progress, cancel, filmstrip with thumbnail/score/reasons, manual range | Done |
| §4.4 | Analyser failure degrades to a warning with the manual path intact | Done |
| §6.2 | `HOOK_ANALYSIS_FAILED` error code | Done |

**Not implemented:** the optional Beta object/person detector (`BETA_DETECTOR_FAILED`).
Design §2.2 marks it optional, and §4.4 requires that heuristic-only candidates stay
usable without it. `normalizedWeights(false)` redistributes its 20% across the three
available signals so scores are not silently deflated. Adding the detector later means
supplying an object signal and flipping `hasObjectSignal` — the scoring API already
takes it.

## 2. Design Decisions Worth Recording

1. **Decode stays on the main thread, scoring goes to the Worker.** Only the main
   thread owns an `HTMLVideoElement`, so frames are seeked and drawn to a
   downscaled canvas there; the RGBA buffers are transferred to
   `hookSignals.worker.ts`, which does the per-pixel comparison. That matches the
   §2.2 intent (heavy work off the UI thread) without a WebCodecs rewrite.
2. **Analysis state is not persisted.** Design §3.2 puts `HookAnalysisState` on the
   scene, but candidates carry JPEG thumbnails and §3.6 requires project JSON to hold
   "metadata and fingerprints only". Candidates therefore live in component state and
   only the *result* — the Hook trim in-point — is persisted. Re-running the analysis
   is cheap and deterministic.
3. **Merging is non-maximum suppression.** The best-scoring frame claims its window
   and any overlapping lower-scoring window is dropped, which is the practical reading
   of "adjacent or overlapping intervals are merged".
4. **Missing or undecodable audio is not a failure.** `analyseAudio` returns an empty
   set and the visual signals carry the score.

## 3. Verification

```bash
npm test                                          # 127 passed (17 files)
npm run build                                     # clean
npx playwright test tests/e2e/hook-analysis.spec.ts   # 2 passed
```

### New L1 suite (`src/domain/hook/scoring.test.ts`)

Weight normalisation with and without the Beta signal, ranking, determinism on a
fixed fixture, reason listing, empty input, flat-signal input, audio-free scoring,
non-overlapping candidate windows, clamping at the end of the source, timeline
ordering, and the per-preset candidate length.

### New L3 scenarios (`tests/e2e/hook-analysis.spec.ts`)

1. Analyse is disabled before upload → enabled after → real analysis produces 1-5
   candidates, each with a thumbnail, interval and score, and the "not a performance
   prediction" notice is visible → selecting a candidate selects the Hook scene and
   moves its trim to the candidate start.
2. The manual range works without running any analysis.

## 4. Known Limitations

1. No Beta object/person detector, as described above.
2. Sampling seeks the video element serially; a 60s clip costs roughly 120 seeks.
   Progress and cancellation are exposed, and the cap is 240 samples.
3. Thumbnails are JPEG data URLs held in memory for the session only.
