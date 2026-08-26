// kv-object-animation Design Ref: §3 — the effect layer, as arithmetic.
//
// The insight the cycle rests on (Design §1.2): "emission" needs no simulation.
// Seen as lifetime cycles, which life a particle is in and how far through it
// sits is one division, and everything that varies per life (birth point, size,
// sway phase) comes from an integer hash of (seed, particle, life). So any
// frame's state is a closed form of the stored schema values and the frame
// number alone — scrubbing, re-rendering, and batch renders agree by
// construction (D-03), and M0 proved two renders bit-identical.
//
// Everything here is math on plain values: no Remotion, no DOM (conventions §1,
// NFR-O04). The composition draws what these return.
import {MIN_KV_EFFECT_SPAN} from '../editor/constants';
import type {
  KvEffectRegion,
  KvGlowEffect,
  KvParticlesEffect,
} from '../editor/types';

/**
 * Deterministic [0,1) from (seed, lanes…) — an integer hash, not a sequential
 * PRNG, because frames are computed independently and the n-th draw must not
 * cost n steps (Design §3.1). int32 ops only, so every engine agrees.
 */
export const kvHash01 = (seed: number, ...lanes: number[]): number => {
  let h = (seed >>> 0) + 0x9e3779b9;
  for (const lane of lanes) {
    h = (h + (lane >>> 0)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
    h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
    h = (h ^ (h >>> 15)) >>> 0;
  }
  return h / 4294967296;
};

/**
 * The shape coefficients. Provisional values proven in the M0 spike; M4
 * replaces them with numbers measured off the reference (Plan S-08) — the
 * closed form is the design's fixed point, these are not.
 */
const PARTICLE_POOL = 64;
const LIFE_MIN_SEC = 1.5;
const LIFE_SPAN_SEC = 1.5;
const TRAVEL_BASE = 0.06;
const TRAVEL_SPAN = 0.14;
const SWAY_MIN = 0.008;
const SWAY_SPAN = 0.012;
const FLICKER_HZ = 3;

export interface KvParticleState {
  /** 0-1 frame coordinates, same space as the effect's region. */
  x: number;
  y: number;
  /** On the template's one canvas width (1080). */
  sizePx: number;
  opacity: number;
}

/** Design §3.2 — every live particle of one effect, at one frame. */
export const kvParticlesAt = (
  effect: KvParticlesEffect,
  frame: number,
  fps: number,
): KvParticleState[] => {
  // Real seconds, so 30fps and 60fps renders move at the same perceived speed
  // and differ only in temporal sampling.
  const tSec = frame / fps;
  const count = Math.ceil(effect.density * PARTICLE_POOL);
  const travel = TRAVEL_BASE + TRAVEL_SPAN * effect.speed;
  const seed = effect.seed;
  const states: KvParticleState[] = [];

  for (let i = 0; i < count; i += 1) {
    const life = LIFE_MIN_SEC + LIFE_SPAN_SEC * kvHash01(seed, i, 0);
    const t = tSec + kvHash01(seed, i, 1) * life;
    const k = Math.floor(t / life);
    const u = t / life - k;

    const birthX =
      effect.region.x + kvHash01(seed, i, k, 2) * effect.region.width;
    const birthY =
      effect.region.y + kvHash01(seed, i, k, 3) * effect.region.height;
    const swayAmp = SWAY_MIN + SWAY_SPAN * kvHash01(seed, i, k, 4);
    const swayTurns = 1 + 2 * kvHash01(seed, i, k, 5);
    const flicker =
      0.7 +
      0.3 * Math.sin(2 * Math.PI * (FLICKER_HZ * tSec + kvHash01(seed, i, 7)));

    states.push({
      x:
        birthX +
        swayAmp *
          Math.sin(2 * Math.PI * (swayTurns * u + kvHash01(seed, i, k, 6))),
      y: birthY - travel * u,
      sizePx: effect.sizePx * (0.5 + 0.5 * kvHash01(seed, i, k, 8)),
      // Born and dying at zero, flickering in between — an ember, not a bulb.
      opacity: Math.sin(Math.PI * u) * flicker,
    });
  }

  return states;
};

/**
 * The rectangle no particle of this effect can leave, as a closed form of the
 * schema values — what SC1 (no change outside the designation) is judged
 * against, in tests and in the render harness alike.
 */
export const kvParticlesReach = (effect: KvParticlesEffect): KvEffectRegion => {
  const sway = SWAY_MIN + SWAY_SPAN;
  const travel = TRAVEL_BASE + TRAVEL_SPAN * effect.speed;

  return {
    x: effect.region.x - sway,
    y: effect.region.y - travel,
    width: effect.region.width + 2 * sway,
    height: effect.region.height + travel,
  };
};

/**
 * Design §3.3 — the halo's brightness at one frame. Seedless on purpose: a
 * pulse is periodic, nothing in it is random (D-03). Base and depth are
 * provisional pending the M4 measurement, like the particle coefficients.
 */
export const kvGlowOpacityAt = (
  effect: KvGlowEffect,
  frame: number,
  fps: number,
): number => {
  const tMs = (frame / fps) * 1000;

  return (
    effect.intensity *
    (0.75 + 0.25 * Math.sin((2 * Math.PI * tMs) / effect.periodMs))
  );
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * Folds a region back inside the frame, the way `clampKvRect` folds a camera
 * (I-1): the overlay hands every drag through here, so an out-of-bounds edit is
 * corrected rather than refused.
 */
export const clampKvEffectRegion = (region: KvEffectRegion): KvEffectRegion => {
  const width = clamp(region.width, MIN_KV_EFFECT_SPAN, 1);
  const height = clamp(region.height, MIN_KV_EFFECT_SPAN, 1);

  return {
    width,
    height,
    x: clamp(region.x, 0, 1 - width),
    y: clamp(region.y, 0, 1 - height),
  };
};
