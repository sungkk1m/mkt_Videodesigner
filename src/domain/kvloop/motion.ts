// kv-motion-effects Design Ref: §2.3 and §4 — the camera, as arithmetic.
//
// The insight the whole cycle rests on: `KvScene` already draws with
// `translate(x%, y%) scale(s)`, and that triple *is* "which part of the image am
// I looking at". So a motion is two of those positions and a curve between them,
// and the Ken Burns that shipped is the one case "whole frame → centred crop".
// Presets and drag-selected rectangles both come down to the same two values, so
// the composition gains no branch.
//
// Easing is returned by name rather than as a function: `domain` may not import
// Remotion (conventions §1), and the curve belongs to whoever renders frames.
import {
  KV_MOTION_MAX_PRESET_SCALE,
  KV_MOTION_MAX_SCALE,
} from '../editor/constants';
import type {
  KvLoopSettings,
  KvMotion,
  KvMotionKeyframes,
  KvRect,
} from '../editor/types';

/** The smallest region a camera may cover, from the one hard bound. */
export const MIN_KV_RECT_SIZE = 1 / KV_MOTION_MAX_SCALE;

/** The whole frame — the camera position that changes nothing. */
export const FULL_KV_RECT: KvRect = {x: 0, y: 0, size: 1};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * Folds a rectangle back inside the frame (I-1). The drag overlay hands every
 * edit through here, so an out-of-bounds drag is corrected rather than refused —
 * a camera that stops at the edge is what the operator expects, and a rejected
 * drag would just feel broken (Design §7).
 */
export const clampKvRect = (rect: KvRect): KvRect => {
  const size = clamp(rect.size, MIN_KV_RECT_SIZE, 1);

  return {
    size,
    x: clamp(rect.x, 0, 1 - size),
    y: clamp(rect.y, 0, 1 - size),
  };
};

/**
 * The rectangle, as the three numbers the composition multiplies into its own
 * transform. Derivation and the check cases are in Design §2.3.
 *
 * `translate(%)` resolves against the untransformed box and the image fills the
 * frame, so one frame unit is 100%.
 */
export const rectToTransform = (
  rect: KvRect,
): {scale: number; xPercent: number; yPercent: number} => {
  const scale = 1 / rect.size;

  // Written as "how far the region's centre has to come back to the frame's",
  // which is the same value the other way round and avoids handing the
  // composition a `-0%` translate for a centred camera.
  return {
    scale,
    xPercent: (0.5 - (rect.x + rect.size / 2)) * scale * 100,
    yPercent: (0.5 - (rect.y + rect.size / 2)) * scale * 100,
  };
};

/** Straight interpolation. The caller has already curved `progress`. */
export const lerpKvRect = (
  from: KvRect,
  to: KvRect,
  progress: number,
): KvRect => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
  size: from.size + (to.size - from.size) * progress,
});

const centred = (size: number): KvRect => ({
  x: (1 - size) / 2,
  y: (1 - size) / 2,
  size,
});

/**
 * The size a preset works at, for a given intensity. Intensity 0 gives the whole
 * frame, which is why every preset degenerates to a still there — including the
 * pans, which have no room to travel at full frame (Design §4.1).
 */
const presetSize = (intensity: number) =>
  1 / (1 + clamp(intensity, 0, 1) * (KV_MOTION_MAX_PRESET_SCALE - 1));

/**
 * A motion as the two camera positions and the curve between them.
 *
 * Intensity reaches presets only (I-4): a drag-selected pair already says how
 * far the camera travels, and having a slider silently rescale a rectangle the
 * operator drew would make the preview disagree with the drawing.
 */
export const resolveKvMotion = (
  motion: KvMotion,
  intensity: number,
): Omit<KvMotionKeyframes, 'roundTrip'> => {
  if (motion.kind === 'custom') {
    return {
      from: clampKvRect(motion.from),
      to: clampKvRect(motion.to),
      easing: 'easeInOut',
    };
  }

  const size = presetSize(intensity);
  const far = 1 - size;
  const middle = far / 2;

  switch (motion.preset) {
    case 'zoomIn':
      // The case the looping cycle shipped, and the regression baseline: at
      // intensity 1 this ends exactly at KV_MOTION_MAX_PRESET_SCALE.
      return {from: FULL_KV_RECT, to: centred(size), easing: 'easeOut'};
    case 'zoomOut':
      return {from: centred(size), to: FULL_KV_RECT, easing: 'easeOut'};
    // Pans hold their zoom and travel one axis. Linear on purpose: easing a pan
    // reads as the camera stopping, which is not what a pan is for.
    case 'panLeftToRight':
      return {
        from: {x: 0, y: middle, size},
        to: {x: far, y: middle, size},
        easing: 'linear',
      };
    case 'panRightToLeft':
      return {
        from: {x: far, y: middle, size},
        to: {x: 0, y: middle, size},
        easing: 'linear',
      };
    case 'panTopToBottom':
      return {
        from: {x: middle, y: 0, size},
        to: {x: middle, y: far, size},
        easing: 'linear',
      };
    case 'panBottomToTop':
      return {
        from: {x: middle, y: far, size},
        to: {x: middle, y: 0, size},
        easing: 'linear',
      };
    case 'still':
    default:
      return {from: FULL_KV_RECT, to: FULL_KV_RECT, easing: 'linear'};
  }
};

/**
 * kv-loop-reference-motion R-1 / D-03 — the loop-wide round trip, folded into
 * one slot's keyframes. The easing is forced to `easeInOut` because a round
 * trip needs zero velocity at the peak: `easeOut` arrives gently but leaves at
 * full speed, which reads as the camera bouncing off a wall. Off keeps the
 * resolved easing untouched, so a stored one-way project renders bit-identical
 * (FR-R12).
 */
export const withKvRoundTrip = (
  keyframes: Omit<KvMotionKeyframes, 'roundTrip'>,
  roundTrip: boolean,
): KvMotionKeyframes =>
  roundTrip
    ? {...keyframes, easing: 'easeInOut', roundTrip: true}
    : {...keyframes, roundTrip: false};

/**
 * D-04 — the motion a slot actually uses: its own, or the loop-wide default it
 * inherits. Three callers read this (the prop builder, the inspector, and the
 * diagnostic header), and they must not disagree.
 */
export const effectiveKvMotion = (
  settings: KvLoopSettings,
  index: number,
): KvMotion => settings.slots[index]?.motion ?? settings.motion;

/**
 * Whether a motion moves at all. A still is a chosen preset now, not an
 * unchecked box — which is the distinction the old boolean could not make.
 */
export const isKvMotionStill = (motion: KvMotion): boolean =>
  motion.kind === 'preset' && motion.preset === 'still';
