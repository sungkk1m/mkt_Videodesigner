# Browser Video MVP - Module 3A Claude Code Handoff

> **Project**: `mkt_videodesigner`
> **Feature**: `browser-video-mvp`
> **PDCA phase**: Do
> **Scope**: `module-3a-editor-vertical-slice`
> **Implementation owner**: Claude Code
> **Prepared by**: Codex
> **Date**: 2026-07-27
> **Status**: Ready for implementation

---

## 1. Why This Handoff Exists

The current Codex conversation already carries the full Plan, Design, architecture
selection, wireframe decisions, and Module 2 render benchmark history. Module 3A
crosses media lifecycle, timeline invariants, Remotion preview/render integration,
editor UI, and browser E2E verification. To preserve implementation and verification
quality, the user requested that this work continue in Claude Code when the remaining
scope is substantial.

Claude Code 2.1.143 is installed at:

```text
/Users/sungkkim/.local/bin/claude
```

At handoff time, `claude auth status` returned:

```json
{
  "loggedIn": false,
  "authMethod": "none",
  "apiProvider": "firstParty"
}
```

The CLI implementation was therefore not started. Authenticate Claude Code or open
this project from an already authenticated Claude Code session, then use the prompt
in section 12.

The user authorized the handoff in the 2026-07-27 request:

> 구현 시작 전, 현재 사용량 기준으로 작업 가능한 수준인지 우선 검증하세요.
> 어려운 스펙이면 claude code 로 진행하고, 해당 히스토리 문서 생성 및 경로를 남겨주세요

---

## 2. Mandatory Reading Order

Read these files fully before editing:

1. `/Users/sungkkim/Desktop/mkt_videodesigner/CLAUDE.md`
2. `/Users/sungkkim/Desktop/mkt_videodesigner/docs/01-plan/features/browser-video-mvp.plan.md`
3. `/Users/sungkkim/Desktop/mkt_videodesigner/docs/02-design/features/browser-video-mvp.design.md`
4. `/Users/sungkkim/Desktop/mkt_videodesigner/docs/03-analysis/browser-video-mvp.module-2-benchmark.md`
5. `/Users/sungkkim/Desktop/mkt_videodesigner/.bkit/state/pdca-status.json`
6. `/Users/sungkkim/Desktop/mkt_videodesigner/docs/00-reference/README.md`
7. `/Users/sungkkim/Desktop/mkt_videodesigner/docs/02-design/wireframes/editor-layout-wireframes.html`
8. This handoff document

Do not treat the current page at `http://127.0.0.1:4173/` as the intended editor.
It is the Module 2 render feasibility and benchmark UI.

---

## 3. Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Automate repeated multilingual and multi-ratio UA video production in the browser without a designer or application server. |
| **WHO** | Internal UA Managers and marketers using recent desktop Chrome, including outside the office desktop environment. |
| **RISK** | Browser media lifecycle, 1080p60 performance, object URL cleanup, and keeping preview/render behavior identical. |
| **SUCCESS** | A user uploads real footage, adjusts a fixed three-scene timeline and scene framing, previews it, and downloads the edited MP4. |
| **SCOPE** | A narrow editor vertical slice before persistence, localization, Hook analysis, TTS, and Batch rendering. |

---

## 4. Decision Record

| Source | Decision | Reason |
|--------|----------|--------|
| Plan | Static React app on GitHub Pages, Chrome only | No application server or upload cost |
| Plan | Fixed Hook -> Gameplay -> CTA workflow | Optimize UA repetition instead of building a general NLE |
| Design | Option C pragmatic module boundaries | Keep Remotion, media, persistence, TTS, and analysis replaceable |
| Design | Option A editor layout | Left assets, center preview, right inspector, bottom timeline |
| Design | Exactly three scenes | No arbitrary clip count or multi-track timeline in MVP |
| Module 2 | Remotion 4.0.499 browser rendering is viable | 15s 1080p60 and 60s 1080p60 benchmark completed |
| Module 3A | Combine selected Module 3 and 4 work | Show a usable editor before implementing recovery and persistence |

All Remotion packages must remain pinned to exactly `4.0.499`.

---

## 5. Current Implementation State

Implemented:

- Vite + React + TypeScript app
- Chrome/WebCodecs/H.264/AAC/OPFS capability probe
- Remotion Player with a synthetic benchmark composition
- Browser MP4 render with progress, cancellation, and download
- ArrayBuffer and `web-fs` output target support
- Unit tests and one real-render Playwright test
- Module 2 benchmark evidence

Important current files:

```text
src/app/App.tsx
src/app/styles.css
src/compositions/RenderPocComposition.tsx
src/infrastructure/render/capabilities.ts
src/infrastructure/render/renderPoc.ts
src/infrastructure/render/types.ts
tests/e2e/render-poc.spec.ts
```

The directory is not currently a Git repository. Do not initialize Git unless the
user explicitly requests it.

---

## 6. Module 3A Approved Scope

### 6.1 In Scope

1. Upload one local video and probe:
   - name
   - MIME type
   - duration
   - dimensions
   - decode/playback failure
2. One-click apply that footage to Hook, Gameplay, and CTA.
3. Fixed three-scene order:
   - Hook
   - Gameplay
   - CTA
4. Duration presets:
   - 15s: 2 / 10 / 3
   - 30s: 3 / 24 / 3
   - 60s: 3 / 54 / 3
5. Two draggable scene boundaries:
   - Adjacent scenes change together.
   - Total duration remains invariant.
   - Each scene remains at least one second.
6. Per-scene trim in/out:
   - Clamp to source duration.
   - Prevent an empty or reversed interval.
   - Clearly show the selected source interval.
7. Per-scene transform:
   - Fit fixed to Cover
   - Scale
   - X
   - Y
   - Reset
8. 9:16 Remotion preview:
   - Play/pause
   - Seek
   - Current time and total duration
   - Selected-scene indication
9. Single MP4 render of the current edit:
   - 1080x1920
   - H.264/AAC
   - 60fps default
   - Existing capability, progress, cancel, and download behavior retained
10. Dense desktop editor UI:
    - Header
    - Left asset panel
    - Center preview
    - Right scene inspector
    - Bottom timeline
11. Unit tests, Playwright critical path, and production build verification.

### 6.2 Out of Scope

- IndexedDB, autosave, reload recovery, JSON import/export, file relinking
- 1:1 and 16:9
- Four-locale copy
- Hook text motion and CTA copy/assets
- Hook C-lite analysis
- TTS, BGM, narration, audio mixing
- Batch rendering
- Arbitrary clip add/remove/split
- Multi-track timeline, overlays, keyframes, masks, color grading
- Deployment or license configuration changes

Do not add excluded features as placeholders.

---

## 7. UX Contract

Target desktop viewport is at least 1280x720.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Project title   15|30|60s   9:16   60fps             Render MP4     │
├────────────────┬─────────────────────────────┬───────────────────────┤
│ Assets         │                             │ Scene Inspector       │
│                │      Remotion Preview       │ Trim In / Out         │
│ Upload footage │                             │ Scale / X / Y         │
│ File metadata  │                             │ Reset                 │
│ Apply to all   │                             │                       │
├────────────────┴─────────────────────────────┴───────────────────────┤
│ Hook          | Gameplay                                    | CTA   │
│         draggable boundary             draggable boundary            │
└──────────────────────────────────────────────────────────────────────┘
```

Interaction requirements:

- Upload must immediately update metadata and preview.
- Clicking a timeline scene selects it and updates the inspector.
- Boundary changes must update the preview duration without layout shifts.
- Inspector adjustments must be visible in preview before rendering.
- Rendering uses a frozen snapshot so later UI changes do not mutate an active job.
- Replacing the source must revoke the previous object URL after it is no longer used.
- Leaving the page must revoke remaining object URLs and abort active work.
- Errors must identify the problem and the user action required.

Visual requirements:

- Quiet, dense, utilitarian editor surface
- Neutral gray workspace, white panels, charcoal timeline, blue primary action
- Radius 4px controls, maximum 8px repeated items/dialogs
- No landing page, hero, decorative gradients, nested cards, or oversized headings
- Stable preview, toolbar, timeline, and inspector dimensions
- Korean visible UI copy; English code, identifiers, and comments

---

## 8. Suggested Depth-First Implementation

Keep each batch to 3-5 implementation files plus tests.

### Batch A - Domain and Media

Suggested files:

```text
src/domain/editor/types.ts
src/domain/timeline/timeline.ts
src/domain/timeline/timeline.test.ts
src/infrastructure/media/probeMedia.ts
src/infrastructure/media/probeMedia.test.ts
```

Verify:

- Presets initialize exactly.
- Boundary movement preserves total duration and minimums.
- Trim validation rejects invalid intervals.
- Media metadata probing reports actionable failures.

### Batch B - Composition and Render

Suggested files:

```text
src/compositions/ThreeSceneComposition.tsx
src/infrastructure/render/renderEditor.ts
src/infrastructure/render/renderEditor.test.ts
src/infrastructure/render/types.ts
```

Verify:

- Composition uses real uploaded video.
- Scene source offsets and durations match trim/timeline data.
- Cover, scale, X, and Y are identical in Player and rendered output.
- Existing Module 2 capability and cancellation behavior remains available.

Use structured Remotion media APIs. Do not implement video playback with canvas frame
copying unless a documented Web Renderer limitation makes it necessary.

### Batch C - Editor UI

Suggested files:

```text
src/features/editor/EditorWorkspace.tsx
src/features/editor/Timeline.tsx
src/features/editor/SceneInspector.tsx
src/app/App.tsx
src/app/styles.css
```

Verify:

- Real upload and apply-to-all behavior
- Scene selection
- Timeline boundary drag
- Trim and transform controls
- Preview update
- Render progress/cancel/download

Splitting the UI further is allowed only when it removes real complexity. Avoid a
large set of thin wrapper components.

### Batch D - Browser Verification

Suggested files:

```text
tests/e2e/editor-vertical-slice.spec.ts
docs/03-analysis/browser-video-mvp.module-3a-evidence.md
.bkit/state/pdca-status.json
```

Verify:

```bash
npm test
npm run build
npm run test:e2e -- tests/e2e/editor-vertical-slice.spec.ts
```

Use a real H.264/AAC fixture for the browser test. Verify downloaded MP4 metadata
with `ffprobe` when available.

---

## 9. Acceptance Criteria

- [ ] Real local footage can be uploaded without any application-server request.
- [ ] The same footage can populate all three scenes.
- [ ] 15, 30, and 60 second defaults match the approved scene durations.
- [ ] Dragging either boundary preserves the total and one-second minimum.
- [ ] Each scene has valid trim in/out controls bounded by source duration.
- [ ] Scale, X, and Y changes are visible in the 9:16 Player.
- [ ] The fixed timeline can seek and select scenes.
- [ ] A real edited MP4 can be rendered, cancelled, and downloaded.
- [ ] Capability errors remain actionable.
- [ ] Object URLs and active render resources are released.
- [ ] Existing unit tests remain green.
- [ ] New domain and UI behavior has focused tests.
- [ ] Production build succeeds.
- [ ] Module 3A evidence and PDCA state are updated after verification.

---

## 10. Known Risks and Guardrails

1. The current render types are PoC-specific. Generalize only the minimum needed
   for the editor render; keep benchmark behavior tested.
2. Source duration may be shorter than a selected scene. The UI must block or clamp
   invalid trim ranges before render.
3. Browser object URLs are session-only. This is intentional for Module 3A and must
   not be described as persistence.
4. The same uploaded source may be decoded repeatedly across scenes. Correctness is
   the Module 3A priority; cache optimization belongs to later modules unless a
   severe blocker appears.
5. Keep 9:16 as the only ratio in this scope. Do not create dormant ratio controls.
6. Keep 60fps as the default. Do not silently downgrade.
7. Do not deploy. Remotion license approval remains a gate before deployment.
8. Do not modify or remove unrelated user or Codex changes.

---

## 11. PDCA State Update After Implementation

On successful verification, update:

```json
{
  "metadata": {
    "currentScope": "module-3a-editor-vertical-slice",
    "completedModules": ["module-2", "module-3a-editor-vertical-slice"]
  }
}
```

Preserve all existing fields and history. Add a state-history record rather than
rewriting prior records.

Also amend Design section `11.3 Session Guide` with:

| Module | Scope Key | Description |
|--------|-----------|-------------|
| Editor Vertical Slice | `module-3a` | Session-only footage upload, fixed timeline, trim/transform, 9:16 preview and Single render |

State clearly that this scope was inserted before full Module 3 persistence and
Module 4 editor completion.

---

## 12. Recommended Claude Code Start Prompt

```text
Read CLAUDE.md first, then fully read the Plan, Design, Module 2 benchmark, PDCA
state, and docs/00-history/2026-07-27-browser-video-mvp-module-3a-claude-handoff.md.

Run PDCA Do for browser-video-mvp scope module-3a. Implement the approved Editor
Vertical Slice depth-first. Preserve the Module 2 renderer tests and exact Remotion
4.0.499 versions. Do not implement persistence, additional ratios, localization,
Hook analysis, TTS, audio mixing, Batch, deployment, or a general NLE.

Before edits, inspect the current source and running app. Then implement, run unit
tests, production build, and the real-browser editor E2E. Write Module 3A evidence
and update PDCA state only after verification.
```

---

## 13. History

| Time | Event |
|------|-------|
| 2026-07-27 | Plan approved for a static Chrome-only UA video editor |
| 2026-07-27 | Design approved: Option C architecture, Option A editor layout |
| 2026-07-27 | Module 2 browser render PoC completed and benchmarked |
| 2026-07-27 | User identified that the PoC did not yet expose footage editing |
| 2026-07-27 | Verified that upload, timeline, trim, and transforms were planned for later modules |
| 2026-07-27 | Module 3A vertical slice proposed to surface editor value earlier |
| 2026-07-27 | Scope redirected to Claude Code after Codex context/complexity assessment |
| 2026-07-27 | Claude Code 2.1.143 found, but CLI execution blocked because no account is authenticated |
