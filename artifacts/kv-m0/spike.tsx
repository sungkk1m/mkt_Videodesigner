// kv-loop-reference-motion M0 SPIKE — Design §4.3. Kept for re-running on a
// machine with real Chrome; the container run's evidence is in
// docs/03-analysis/kv-loop-reference-motion.m0-blur-spike.md.
//
// Renders the REAL KvLoopComposition — bookend blur, hard cuts, round trip —
// through @remotion/web-renderer, so what is measured is the actual render
// path, not a lookalike. vp9/webm because this container's Chromium has no
// H.264; the question here (does a container `filter: blur()` reach the
// encoded frames, on whichever rasterizer path this Chromium takes?) is
// codec-independent.
import {renderMediaOnWeb} from '@remotion/web-renderer';

import {KvLoopComposition} from '../../src/compositions/KvLoopComposition';
import type {KvLoopProps} from '../../src/domain/editor/types';
import {kvLoopSegments} from '../../src/domain/kvloop/cycle';
import {resolveKvMotion, withKvRoundTrip} from '../../src/domain/kvloop/motion';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
/** Three one-second holds, one cycle: cuts at frames 30 and 60. */
const HOLDS_MS = [1000, 1000, 1000];
const TOTAL_FRAMES = 90;

// Textured fixtures (testsrc2 variants) — the flat-colour editor fixtures
// cannot show a centred zoom or a blur amount at all.
const KV_URLS = ['tex-1.png', 'tex-2.png', 'tex-3.png'].map(
  (name) => new URL(`./out/${name}`, document.baseURI).href,
);

/** Intensity 1 so the round trip peaks at the full 1.2 preset scale —
 * comfortably measurable on the textured fixtures. */
const buildProps = (): KvLoopProps => ({
  segments: kvLoopSegments(HOLDS_MS, 1, TOTAL_FRAMES),
  slots: KV_URLS.map((url) => ({
    url,
    fit: 'cover' as const,
    scale: 1,
    x: 0,
    y: 0,
    motion: withKvRoundTrip(
      resolveKvMotion({kind: 'preset', preset: 'zoomIn'}, 1),
      true,
    ),
  })),
  kenBurnsIntensity: 1,
  transitionInFrames: 0,
  fadeOutFrames: 0,
  blurInFrames: 10,
  blurAmountPx: 30,
  totalFrames: TOTAL_FRAMES,
  title: {url: null, fit: 'contain' as const, scale: 1, x: 0, y: 0},
  // Text under the container blur, so D-05 (overlays blur too) is in frame.
  disclaimer: {text: 'M0 고지문구 표본', fontSize: 32, textColor: '#ffffff'},
  audio: {
    originalVolume: 0,
    bgm: null,
    narration: [],
    ducking: {enabled: false, targetGain: 1, attackInFrames: 0, releaseInFrames: 0},
  },
});

declare global {
  interface Window {
    __kvM0Render: (overrides?: {
      blurAmountPx?: number;
      keepBlob?: boolean;
    }) => Promise<{
      nativeHtmlInCanvas: boolean;
      totalMs: number;
      webmBase64: string;
    }>;
  }
}

window.__kvM0Render = async (overrides = {}) => {
  const props = {...buildProps(), ...overrides};
  const startedAt = performance.now();

  const result = await (renderMediaOnWeb as unknown as (
    request: unknown,
  ) => Promise<{getBlob: () => Promise<Blob>}>)({
    composition: {
      id: 'kv-m0-blur',
      component: KvLoopComposition,
      durationInFrames: TOTAL_FRAMES,
      fps: FPS,
      width: WIDTH,
      height: HEIGHT,
      defaultProps: props,
    },
    inputProps: props,
    container: 'webm',
    videoCodec: 'vp9',
    audioCodec: null,
    videoBitrate: 'high',
    muted: true,
    outputTarget: 'arraybuffer',
    hardwareAcceleration: 'no-preference',
    pageResponsiveness: 'medium',
    logLevel: 'info',
  });

  const blob = await result.getBlob();
  const buffer =
    overrides.keepBlob === false
      ? new Uint8Array(0)
      : new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let index = 0; index < buffer.length; index += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(index, index + CHUNK));
  }

  // Which rasterizer path this browser takes — the same probe the renderer
  // itself runs (html-in-canvas.ts).
  const probe = document.createElement('canvas').getContext('2d') as unknown as {
    drawElementImage?: unknown;
  } | null;

  return {
    nativeHtmlInCanvas: typeof probe?.drawElementImage === 'function',
    totalMs: Math.round(performance.now() - startedAt),
    webmBase64: btoa(binary),
  };
};

document.getElementById('status')!.textContent = 'ready';
