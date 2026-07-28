# Module 6 Evidence — Audio and TTS

> **Feature**: `browser-video-mvp`
> **Scope key**: `module-6`
> **PDCA phase**: Do
> **Date**: 2026-07-28
> **Status**: Implemented and verified, except generated narration (see §4)

---

## 1. Scope Delivered

| Design Ref | Item | Result |
|-----------|------|--------|
| §3.3 | `AudioMix` in the project schema: original volume, BGM track, per-locale/per-scene narration, ducking | Done |
| §3.3 | Auto ducking with attack/release envelope over original audio and BGM | Done |
| §3.3 | Uploaded narration and BGM through the existing probe/fingerprint/persistence path | Done |
| §4.2 | `TtsProvider` port, `TtsRequest`, `TtsCapabilities`, `TtsResult` in the domain | Done |
| §4.2, §8.2 #9 | Cache keyed by provider, revision, locale, voice, speed and text; provider called once per key | Done |
| §4.2 | `zh-TW` reports unsupported with the upload action | Done |
| §3.5, §6.2 | `NARRATION_TOO_LONG` blocks the render instead of stretching or truncating | Done |
| §3.6 | IndexedDB `tts-cache` store (DB version 2) | Done |
| §10.4 | Model URL and revision pinned in `src/shared/config/models.ts` | Done |
| §7 | Nothing is fetched until the user asks for generated narration; the notice states this | Done |

## 2. Design Decisions Worth Recording

1. **Generated narration reuses `MediaReference`** with the cache key as its id and
   the request hash as its fingerprint, instead of the separate
   `CachedAudioReference` shape in Design §3.3. One reference type means one URL
   resolver, one relink path, and one persistence rule for every audio asset.
2. **`UploadedAudioProvider` is realised as the upload path, not a synthesising
   provider.** Design §4.2 lists it as a `TtsProvider`, but a provider whose
   `synthesize` can never succeed is a misleading contract. Upload is a first-class
   button on every scene for every locale, which is the behaviour §4.2 actually
   requires ("the stable path for all locales").
3. **Cache-first synthesis lives in `src/domain/tts/synthesize.ts`**, not in the
   React hook, so scenario §8.2 #9 is verifiable without a DOM.
4. **Ducking is a pure per-frame gain function** (`duckingGainAt`) shared by the
   Player and the render, so preview and output cannot drift.

## 3. Verification

```bash
npm test                                       # 151 passed (20 files)
npm run build                                  # clean
npx playwright test tests/e2e/audio-tts.spec.ts    # 3 passed
```

### New L1 suites

| File | Covers |
|------|--------|
| `src/domain/audio/mix.test.ts` | gain clamping, per-locale/per-scene narration, removal, BGM patch no-op, `NARRATION_TOO_LONG` detection and locale scoping, ducking hold/ramp/overlap, audio render props including frame conversion, selected-locale filtering, scene-length capping, unresolved-URL drop |
| `src/domain/tts/types.test.ts` | cache key stability, whitespace normalisation, separation of every request dimension |
| `src/domain/tts/synthesize.test.ts` | provider called once, second identical request served from cache, new call per changed dimension, nothing cached on failure |

### New L3 scenarios (`tests/e2e/audio-tts.spec.ts`)

1. Original volume, BGM upload with volume/loop, ducking toggle and amount, a 1.5s
   narration accepted in the 2s Hook scene, and the mix autosaved.
2. A 4s narration in the 2s Hook scene shows the per-scene error and the header
   render blocker, disables the render button, and clears when the track is removed.
3. `zh-TW` shows the unsupported notice, disables generation, keeps upload enabled,
   and narration stays scoped to its locale.

New fixtures: `tests/fixtures/narration-short.wav` (1.5s), `narration-long.wav` (4s).

## 4. Known Limitation — Generated Narration Is Unverified

The Supertonic Beta provider (`src/infrastructure/tts/supertonicProvider.ts`) is
fully wired: capability gate, pinned runtime URL and model revision, lazy load on
first use, WAV encoding, cache integration, and typed failures
(`TTS_UNSUPPORTED_LOCALE`, `TTS_MODEL_LOAD_FAILED`, `TTS_GENERATION_FAILED`).

**Actual speech generation has not been executed end-to-end.** It requires
downloading the pinned model at runtime, which this verification environment does
not do, and Design §1.3 already flags Supertonic's maintenance-end notice as the
project's largest risk. The uploaded-audio path is therefore the verified route for
every locale, and the Beta button is disabled whenever the capability probe reports
unavailable.

Before relying on generated narration in production, run one real generation in
Chrome and record the result here. If the pinned model proves unusable, only
`src/shared/config/models.ts` and the provider file change — no schema, cache, or UI
work is needed.

## 5. Other Known Limitations

1. Per-scene narration text uses the scene subtitle. The `narrationOverrides` field
   from Design §3.2 is not implemented; the subtitle is the single source of spoken
   copy today.
2. Voice selection is a single default voice. `listVoices` exists on the port and
   returns one entry; a real voice list arrives with a verified model.
3. TTS cache clearing is implemented in `createTtsCache().clear()` but is not yet
   exposed in the project menu.
