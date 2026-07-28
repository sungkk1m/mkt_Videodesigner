# Module 7 Evidence — Render and Release

> **Feature**: `browser-video-mvp`
> **Scope key**: `module-7`
> **PDCA phase**: Do
> **Date**: 2026-07-28
> **Status**: Implemented and verified. Deployment intentionally not executed (license gate).

---

## 1. Scope Delivered

| Design Ref | Item | Result |
|-----------|------|--------|
| §1.3, §3.4 | Render profiles Fast / Standard / High with per-profile bitrate tiers | Done |
| §5.5 | 30 / 60fps selection constrained by profile; Fast is 30fps only | Done |
| §2.2, §3.5 | Locale × ratio expansion into 1-12 unique sequential jobs | Done |
| §2.2 | Strictly sequential queue; each output is written before the next job starts | Done |
| §5.5 | Queue rows with locale, ratio, state, progress, elapsed, ETA, filename | Done |
| §6.3 | A failed job never stops the queue; retry re-runs only failed/cancelled jobs | Done |
| §6.3 | Cancel aborts the active job, marks unstarted jobs cancelled, keeps completed outputs | Done |
| §5.5 | Preflight list blocks the batch and names every issue | Done |
| §1.3, §4.1 | `OutputWriter`: directory picker first, browser download fallback | Done |
| §4.5 | Full naming with a timestamp suffix only on a real collision | Done |
| §10.4 | `base: './'` keeps Pages subpath assets relative; CI workflow added | Done |
| §2.4, §7 | Pages deploy workflow is manual-only behind the Remotion license gate | Done |

## 2. Design Decisions Worth Recording

1. **Batch UI lives in `src/features/editor/`, not `src/features/render/`.** Design
   §5.4 places `BatchDialog` and `RenderQueuePanel` in a render feature, but the
   architecture rule in §9.4 forbids one feature from importing another's internals,
   and the batch operates directly on the editor's project store. Splitting it would
   have meant either breaking that rule or duplicating the store. Option C is
   explicitly the pragmatic architecture, so the dialog sits with the editor and the
   *queue logic* stays pure in `src/domain/render/queue.ts`.
2. **A write failure falls back to a download rather than losing the render.** §6.3
   requires a failed write to be actionable; discarding a finished 60s render would
   not be. The job is still reported through `OUTPUT_WRITE_FAILED`.
3. **Preflight is a pure function** (`preflightIssues`) so the same checks can later
   back a Single-render gate without duplication.
4. **`project.fps` and `project.render.fps` are kept in sync** by the profile
   commands, so the timeline's frame allocation and the render always agree.

## 3. Verification

```bash
npm test                              # 164 passed (21 files)
npm run build                         # tsc -b + vite build, clean
npx playwright test                   # 15 passed (all specs)
```

### New L1 suite (`src/domain/render/queue.test.ts`)

Profile/fps constraint including the Fast downgrade and Standard's 1080p60 default;
2×2 and full 4×3 expansion with twelve unique ids and twelve unique filenames;
filename prefix sanitisation; stable locale/ratio ordering; first-queued selection;
continuation past a failure; retry that never recreates a completed output;
cancellation that preserves completed jobs; queue summary.

### New L3 scenarios (`tests/e2e/batch-render.spec.ts`)

1. Standard defaults to 60fps; switching to Fast disables 60fps and moves the
   selection to 30fps; selecting all four locales and all three ratios reports
   exactly the twelve-job maximum.
2. A 4s narration in the 2s Hook scene makes the preflight list block the batch and
   no queue is created.
3. A real two-job batch (ko 9:16 + ko 1:1, Fast/30fps) renders sequentially to
   completion, both rows report 완료, and both downloads carry the confirmed names
   `배치-테스트_ko_9x16_15s_30fps.mp4` and `배치-테스트_ko_1x1_15s_30fps.mp4`.

### Layout regression fixed during this module

Adding the Hook drawer row made the editor taller than the viewport, which pushed
the timeline out of reach of pointer coordinates. The grid is back to a fixed
`height: 100vh` with the drawer capped at 208px and scrolling internally, which also
restores the §5.3 "no layout shifts" requirement.

## 4. Release Status

- `.github/workflows/ci.yml` runs typecheck, build, unit tests, and a non-blocking
  `npm audit` on every push and pull request. Browser E2E is not in CI because the
  H.264 fixtures are deliberately not committed.
- `.github/workflows/deploy-pages.yml` builds and publishes to GitHub Pages but is
  **`workflow_dispatch` only**. Design §2.4 and §7 require Remotion commercial-use
  approval first, and `browser-video-mvp.remotion-license-review.md` records that the
  project is still under the evaluation clause. No deployment has been run.

## 5. Known Limitations

1. §8.4 scenario 9 (loading from a real Pages subpath) is unverified because nothing
   has been deployed. `base: './'` is the mechanism; the check belongs to the first
   approved deployment.
2. Parallel batch rendering stays disabled, matching §2.4.
3. The queue does not yet persist across a reload; an interrupted batch restarts from
   the dialog.
4. Cache-usage display and separate TTS/temp cache clearing from §5.5 are not exposed
   in the UI.
