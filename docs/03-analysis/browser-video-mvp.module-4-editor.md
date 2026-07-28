# Module 4 Evidence — Editor and Composition

> **Feature**: `browser-video-mvp`
> **Scope key**: `module-4`
> **PDCA phase**: Do
> **Date**: 2026-07-28
> **Status**: Implemented and verified

---

## 1. Scope Delivered

| Design Ref | Item | Result |
|-----------|------|--------|
| §3.2 | `LocalizedCopy` for ko / en / ja / zh-TW: Hook, Hook subcopy, per-scene subtitle, CTA text, CTA subcopy | Done |
| §3.1 | `RatioTransforms` — one shared base framing plus optional per-ratio overrides | Done |
| §1.3, §3.5 | Three ratios with real output sizes: 9:16 1080×1920, 1:1 1080×1080, 16:9 1920×1080 | Done |
| §3.2 | `SubtitleStyle` per scene: position, alignment, size, text/emphasis colour, background toggle/colour/opacity | Done |
| §1.3, §3.5 | Transitions Cut / Fade / Zoom, default Cut, clamped to 0.1-1.0s and half the scene | Done |
| §3.2 | Hook motion presets Impact / Caption / Focus, emphasised phrase, background dim | Done |
| §3.2, §1.3 | CTA app icon, logo, store badge, dedicated CTA media, generated background, blur, dim | Done |
| §4.5 | Full output naming `{project}_{locale}_{ratio}_{duration}s_{fps}fps.mp4` | Done |
| §5.5 | Left panel tabs (소재 / 카피), locale selector, ratio selector, extended Scene Inspector | Done |

Hook candidate analysis, audio, TTS, and Batch remain owned by modules 5-7.

## 2. Design Decisions Worth Recording

1. **Transitions run inside each scene, not across two.** A crossfade needs two
   overlapping sequences, which shortens the timeline and would break the §3.5
   invariant "sum of scene frames equals preset × fps". The implementation fades
   or zooms the outgoing scene over its own last frames and the incoming scene
   over its own first frames. Fade therefore reads as a dip to black, which is the
   conventional UA cut, and the total duration stays exact. `transitionStyleAt`
   in `src/domain/render/transition.ts` is pure and unit-tested.
2. **The CTA out transition is ignored** because no scene follows it.
3. **CTA generated background uses Remotion `Freeze`** pinned to the last gameplay
   frame (`freezeSourceFrame`), so the still comes from the same decode path as the
   rest of the render. No canvas frame copying was needed.
4. **`durationMs` on `MediaReference` became optional** so CTA still images share
   the same reference type. The project schema now requires the video source to
   carry a duration.
5. **`applyDurationPreset` resets trims to zero** and preserves framing, copy,
   subtitles, transitions, and Hook/CTA settings.

## 3. Verification

```bash
npm test                            # 114 passed (16 files)
npm run build                       # tsc -b + vite build, clean
npx playwright test tests/e2e/      # 7 passed
```

### New L1 suites

| File | Covers |
|------|--------|
| `src/domain/render/transition.test.ts` | cut is a no-op, fade in/out ramps, zoom scale, opacity stays in 0..1 |
| `src/domain/editor/sceneSettings.test.ts` | ratio dimensions, base vs override framing, override removal, selected-ratio rendering, transition linking and clamping, locale independence, selected-locale rendering, Hook emphasis scoping, subtitle clamping, CTA freeze frame, dedicated CTA media, asset URL resolution |

### Updated expectations

- `fileName.test.ts` now asserts the locale segment.
- `editor-vertical-slice.spec.ts` CTA samples now assert the frozen last gameplay
  frame instead of the CTA's own trim, which is the module-4 behaviour.

### New L3 scenario (`tests/e2e/editor-full.spec.ts`)

Upload → enter ko copy → switch to en/ja and back with no value loss → set Hook
emphasis and the Focus preset → set a Fade transition → verify the base framing
carries to 1:1, enable a 1:1 override, confirm 9:16 is unaffected → render 1:1 →
`ffprobe` confirms h264 1080×1080 and a ~15s duration, and the download is named
`ua-video_ko_1x1_15s_60fps.mp4`.

Artifact: `artifacts/module-4/editor-full-1x1.mp4`.

## 4. Known Limitations

1. Fade is a dip to black rather than a crossfade, by the deliberate choice above.
2. CTA assets are session-only after a reload in the same way the main source is:
   they carry fingerprints and are relinked through the same mechanism, but only
   the main source currently has a repair panel. Asset-level relink UI is deferred.
3. The safe-area overlay toggle from §5.5 is not implemented; the ratio selector
   plus live preview covers the framing need for now.
