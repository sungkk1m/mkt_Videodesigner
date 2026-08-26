// kv-object-animation M0 SPIKE — Design §4.3. Proves the deterministic canvas
// effect layer reaches @remotion/web-renderer's encoded frames before any
// production code is written.
//
// The effect math here is the CANDIDATE implementation of Design §3 (closed-form
// particles, periodic glow) held spike-local; the camera math is NOT a stand-in —
// `rectToTransform`/`lerpKvRect`/round-trip come from src/domain, so gate ④
// measures the real transform the effects will ride in `KvScene`.
//
// vp9/webm because this container's Chromium has no H.264; every gate here is
// codec-independent (same reasoning as the kv-m0 blur spike).
import {useLayoutEffect, useRef} from 'react';
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
// Candidate effect objects (Design §2.1 shapes). Placed bottom-centre like the
// reference campfire; the verify bands (top < 0.30, bottom > 0.85) are derived
// from the reach bounds these values imply — change them together.
// ---------------------------------------------------------------------------

const PARTICLES = {
  kind: 'particles' as const,
  region: {x: 0.3, y: 0.55, width: 0.4, height: 0.2},
  color: '#ffb14a',
  density: 0.5,
  speed: 0.5,
  sizePx: 6,
};

const GLOW = {
  kind: 'glow' as const,
  center: {x: 0.5, y: 0.62},
  /** Fraction of frame width. */
  radius: 0.18,
  color: '#ff9a3c',
  intensity: 0.6,
  /** 45 frames at 30fps — deliberately not a divisor of the camera peak (f44.5)
   * so the glow is still bright at the zoom peak for gate ④'s centroid. */
  periodMs: 1500,
};

// ---------------------------------------------------------------------------
// Candidate domain math (Design §3). Pure functions of (schema values, frame).
// ---------------------------------------------------------------------------

/** Integer-hash based [0,1) — random access, no sequential PRNG state (§3.1). */
const kvHash01 = (seed: number, ...lanes: number[]): number => {
  let h = (seed >>> 0) + 0x9e3779b9;
  for (const lane of lanes) {
    h = (h + (lane >>> 0)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
    h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
    h = (h ^ (h >>> 15)) >>> 0;
  }
  return h / 4294967296;
};

const PARTICLE_POOL = 64;
const LIFE_MIN_SEC = 1.5;
const LIFE_SPAN_SEC = 1.5;
const TRAVEL_BASE = 0.06;
const TRAVEL_SPAN = 0.14;
const SWAY_MIN = 0.008;
const SWAY_SPAN = 0.012;
const FLICKER_HZ = 3;

interface ParticleState {
  x: number;
  y: number;
  sizePx: number;
  opacity: number;
}

/** Design §3.2 — emission as a closed form: lifetime cycles indexed by k. */
const particlesAt = (
  effect: typeof PARTICLES,
  seed: number,
  frame: number,
  fps: number,
): ParticleState[] => {
  const tSec = frame / fps;
  const count = Math.ceil(effect.density * PARTICLE_POOL);
  const travel = TRAVEL_BASE + TRAVEL_SPAN * effect.speed;
  const states: ParticleState[] = [];

  for (let i = 0; i < count; i += 1) {
    const life = LIFE_MIN_SEC + LIFE_SPAN_SEC * kvHash01(seed, i, 0);
    const t = tSec + kvHash01(seed, i, 1) * life;
    const k = Math.floor(t / life);
    const u = t / life - k;

    const birthX = effect.region.x + kvHash01(seed, i, k, 2) * effect.region.width;
    const birthY = effect.region.y + kvHash01(seed, i, k, 3) * effect.region.height;
    const swayAmp = SWAY_MIN + SWAY_SPAN * kvHash01(seed, i, k, 4);
    const swayTurns = 1 + 2 * kvHash01(seed, i, k, 5);
    const flicker =
      0.7 + 0.3 * Math.sin(2 * Math.PI * (FLICKER_HZ * tSec + kvHash01(seed, i, 7)));

    states.push({
      x:
        birthX +
        swayAmp * Math.sin(2 * Math.PI * (swayTurns * u + kvHash01(seed, i, k, 6))),
      y: birthY - travel * u,
      sizePx: effect.sizePx * (0.5 + 0.5 * kvHash01(seed, i, k, 8)),
      opacity: Math.sin(Math.PI * u) * flicker,
    });
  }

  return states;
};

/** Design §3.3 — a seedless periodic function. */
const glowOpacityAt = (effect: typeof GLOW, frame: number, fps: number): number => {
  const tMs = (frame / fps) * 1000;
  return effect.intensity * (0.75 + 0.25 * Math.sin((2 * Math.PI * tMs) / effect.periodMs));
};

// ---------------------------------------------------------------------------
// Candidate drawing (Design §4.2). Additive — embers and halos are light.
// ---------------------------------------------------------------------------

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const drawEffectsLayer = (
  canvas: HTMLCanvasElement,
  seed: number,
  frame: number,
  fps: number,
): void => {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';

  const glowOpacity = glowOpacityAt(GLOW, frame, fps);
  const [gr, gg, gb] = hexToRgb(GLOW.color);
  const cx = GLOW.center.x * w;
  const cy = GLOW.center.y * h;
  const radiusPx = GLOW.radius * w;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
  gradient.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${glowOpacity})`);
  gradient.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = PARTICLES.color;
  for (const particle of particlesAt(PARTICLES, seed, frame, fps)) {
    ctx.globalAlpha = particle.opacity;
    ctx.beginPath();
    ctx.arc(particle.x * w, particle.y * h, particle.sizePx / 2, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};

// ---------------------------------------------------------------------------
// The spike composition — an Img and the effects canvas sharing one transform
// string (Design §4.1), inside an overflow-hidden frame like KvScene's root.
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

const EffectsCanvas = ({seed, transform}: {seed: number; transform: string}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  // Design §4.2 — commit-synchronous redraw; gate ⑤ decides whether the
  // renderer's snapshot captures it.
  useLayoutEffect(() => {
    if (ref.current) {
      drawEffectsLayer(ref.current, seed, frame, fps);
    }
  }, [seed, frame, fps]);

  return (
    <canvas
      height={height}
      ref={ref}
      style={{width: '100%', height: '100%', transform}}
      width={width}
    />
  );
};

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
          <EffectsCanvas seed={seed} transform={transform} />
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
  drawEffectsLayer(effectsCanvas, seed, frame, FPS);

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
