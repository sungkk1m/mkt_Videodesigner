// kv-object-animation M0 harness — Design §4.3. First run (M0) proved the
// deterministic canvas layer reaches @remotion/web-renderer's encoded frames
// with the candidate math held spike-local; since M2 the harness imports the
// PRODUCTION path instead — domain math from src/domain/kvloop/effects and the
// drawing/component from src/compositions/kvloop/KvEffectsCanvas — so a re-run
// judges the code KvScene actually mounts, under the same five gates.
//
// The camera math was never a stand-in: `rectToTransform`/`lerpKvRect`/
// round-trip come from src/domain, so gate ④ measures the real transform the
// effects ride in `KvScene`.
//
// vp9/webm because this container's Chromium has no H.264; every gate here is
// codec-independent (same reasoning as the kv-m0 blur spike).
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {renderMediaOnWeb} from '@remotion/web-renderer';

import {
  drawKvEffects,
  KvEffectsCanvas,
} from '../../src/compositions/kvloop/KvEffectsCanvas';
import type {KvEffect} from '../../src/domain/editor/types';
import {
  lerpKvRect,
  rectToTransform,
  resolveKvMotion,
  withKvRoundTrip,
} from '../../src/domain/kvloop/motion';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const TOTAL_FRAMES = 90;

const TEX_URL = new URL('./out/tex.png', document.baseURI).href;

// ---------------------------------------------------------------------------
// Effect objects (production schema shapes, same values the M0 run measured).
// Placed bottom-centre like the reference campfire; the verify bands
// (top < 0.30, bottom > 0.85) are derived from the reach bounds these values
// imply — change them together.
// ---------------------------------------------------------------------------

const effectsFor = (seed: number): KvEffect[] => [
  {
    kind: 'particles',
    id: 'spike_particles',
    seed,
    region: {x: 0.3, y: 0.55, width: 0.4, height: 0.2},
    color: '#ffb14a',
    density: 0.5,
    speed: 0.5,
    sizePx: 6,
  },
  {
    kind: 'glow',
    id: 'spike_glow',
    center: {x: 0.5, y: 0.62},
    /** Fraction of frame width. */
    radius: 0.18,
    color: '#ff9a3c',
    intensity: 0.6,
    /** 45 frames at 30fps — deliberately not a divisor of the camera peak
     * (f44.5) so the glow is still bright at the zoom peak for gate ④'s
     * centroid. */
    periodMs: 1500,
  },
];

// ---------------------------------------------------------------------------
// The spike composition — an Img and the production KvEffectsCanvas sharing
// one transform string (Design §4.1), inside an overflow-hidden frame like
// KvScene's root.
// ---------------------------------------------------------------------------

interface SpikeProps {
  cameraOn: boolean;
  effectsOn: boolean;
  seed: number;
}

/** Intensity 1 zoom-in round trip — peak scale 1.2 at the hold's centre. */
const MOTION = withKvRoundTrip(
  resolveKvMotion({kind: 'preset', preset: 'zoomIn'}, 1),
  true,
);

const SpikeScene = ({cameraOn, effectsOn, seed}: SpikeProps) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  // The same triangle KvScene draws (kv-loop-reference-motion §3.2).
  const last = Math.max(1, durationInFrames - 1);
  const progress = cameraOn
    ? interpolate(frame, [0, last / 2, last], [0, 1, 0], {
        easing: Easing.inOut(Easing.cubic),
        extrapolateRight: 'clamp',
      })
    : 0;
  const {scale, xPercent, yPercent} = rectToTransform(
    lerpKvRect(MOTION.from, MOTION.to, progress),
  );
  const transform = `translate(${xPercent}%, ${yPercent}%) scale(${scale})`;

  return (
    <AbsoluteFill style={{backgroundColor: '#101014', overflow: 'hidden'}}>
      <AbsoluteFill>
        <Img
          src={TEX_URL}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform,
          }}
        />
      </AbsoluteFill>
      {effectsOn ? (
        <AbsoluteFill>
          <KvEffectsCanvas effects={effectsFor(seed)} transform={transform} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Harness entry points, driven by run.mjs.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __kvObjM0Render: (overrides?: {
      cameraOn?: boolean;
      effectsOn?: boolean;
      seed?: number;
    }) => Promise<{
      nativeHtmlInCanvas: boolean;
      totalMs: number;
      webmBase64: string;
    }>;
    __kvObjM0Frame: (frame: number, seed?: number) => Promise<string>;
  }
}

window.__kvObjM0Render = async (overrides = {}) => {
  const props: SpikeProps = {
    cameraOn: false,
    effectsOn: true,
    seed: 42,
    ...overrides,
  };
  const startedAt = performance.now();

  const result = await (renderMediaOnWeb as unknown as (
    request: unknown,
  ) => Promise<{getBlob: () => Promise<Blob>}>)({
    composition: {
      id: 'kv-obj-m0',
      component: SpikeScene,
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
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let index = 0; index < buffer.length; index += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(index, index + CHUNK));
  }

  const probe = document.createElement('canvas').getContext('2d') as unknown as {
    drawElementImage?: unknown;
  } | null;

  return {
    nativeHtmlInCanvas: typeof probe?.drawElementImage === 'function',
    totalMs: Math.round(performance.now() - startedAt),
    webmBase64: btoa(binary),
  };
};

/**
 * The scrub equivalent (gate ⑤): frame `n` drawn standalone from the pure
 * functions — background composited under a fresh effects layer exactly the way
 * the browser composites the two elements (camera off, so both at identity).
 */
window.__kvObjM0Frame = async (frame, seed = 42) => {
  const image = new Image();
  image.src = TEX_URL;
  await image.decode();

  const effectsCanvas = document.createElement('canvas');
  effectsCanvas.width = WIDTH;
  effectsCanvas.height = HEIGHT;
  drawKvEffects(effectsCanvas, effectsFor(seed), frame, FPS);

  const composite = document.createElement('canvas');
  composite.width = WIDTH;
  composite.height = HEIGHT;
  const ctx = composite.getContext('2d')!;
  ctx.fillStyle = '#101014';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
  ctx.drawImage(effectsCanvas, 0, 0);

  return composite.toDataURL('image/png');
};

document.getElementById('status')!.textContent = 'ready';
