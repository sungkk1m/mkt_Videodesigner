// Day1 render speed — which part of a panel source is worth decoding.
//
// Measured on 2026-08-18 (four renders, 15s/60fps/9:16, one source swap each):
// video decode is 68% of a Day1 render, and per-frame decode cost fits
// `5.35ms + 2.83ms per source megapixel` with residuals under 1.4%. Bitrate and
// bitstream complexity moved the number by 0.9%, so pixels are the only lever.
//
// `objectFit: cover` discards everything outside the panel box before a single
// output pixel is written: a 1242x2208 source in a 9:16 panel shows 49.8% of its
// own height. Decoding the other half is pure waste, and this module says
// exactly which rectangle is not waste.
//
// Pure geometry, like `layout.ts` — it decides *what* to crop, never how to
// transcode it.
import type {MediaTransform, PanelRect} from '../editor/types';

export interface SourceSize {
  width: number;
  height: number;
}

/** A crop rectangle in source pixels. Shaped like mediabunny's `CropRectangle`. */
export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PanelProxyPlan {
  crop: CropRect;
  /**
   * Framing that reproduces the original composition on the cropped source.
   * Always near identity by construction — it only absorbs the rounding of the
   * crop rectangle onto even pixel boundaries.
   */
  transform: MediaTransform;
  /** Fraction of the decoded pixels the crop removes, 0-1. */
  savings: number;
}

/**
 * Below this the transcode does not pay for itself: building the proxy costs
 * roughly one decode pass over the trimmed span, which is what a single render
 * of that span costs too.
 */
export const MIN_PROXY_SAVINGS = 0.2;

// A crop rectangle lands on the source's pixel grid, so the ideal rectangle is
// only ever met to within a rounding error. Compared against float arithmetic,
// not against a visible amount.
const EPSILON = 1e-6;

const floorEven = (value: number) => Math.floor(value / 2) * 2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * The source rectangle the viewer actually sees, inverted out of how the panel
 * draws it (`SplitFrame.tsx`): `objectFit: cover` centres the source in the box
 * at `cover = max(W/sw, H/sh)`, then the element's own
 * `translate(x%, y%) scale(s)` moves it, with the percentages resolving against
 * the box.
 *
 * Box coordinate X of source pixel u is therefore
 *
 *   X = W/2 + (u - sw/2) * k + (x/100) * W,   k = cover * scale
 *
 * and X within [0, W] inverts to a rectangle of width `W/k` centred on
 * `sw/2 - (x/100) * W/k`. The visible rectangle always carries the box's aspect
 * ratio, which is what lets a crop of it be drawn back with `cover` unchanged.
 *
 * The result is in float source pixels and may reach outside the source, which
 * is exactly the case `planPanelProxy` refuses.
 */
export const panelVisibleRect = (
  box: PanelRect,
  source: SourceSize,
  transform: MediaTransform,
): CropRect => {
  const cover = Math.max(box.width / source.width, box.height / source.height);
  const k = cover * transform.scale;
  const width = box.width / k;
  const height = box.height / k;

  return {
    left: source.width / 2 - ((transform.x / 100) * box.width) / k - width / 2,
    top: source.height / 2 - ((transform.y / 100) * box.height) / k - height / 2,
    width,
    height,
  };
};

/**
 * The crop to hand a transcoder, plus the framing to render it with, or null
 * when cropping cannot reproduce the current composition or would not pay off.
 *
 * Deliberately crop-only: no resize. Scaling the crop down to the panel size
 * would decode ~5% fewer pixels, but the downscale then happens in the
 * transcoder instead of in the compositor — a second scaler whose output cannot
 * be compared against the current one without rendering. Cropping alone leaves
 * the compositor doing the exact same downscale it does today, so the proxy's
 * only difference from the original is its own encode.
 */
export const planPanelProxy = (
  box: PanelRect,
  source: SourceSize,
  transform: MediaTransform,
): PanelProxyPlan | null => {
  // day1-video — every rectangle below is inverted out of `cover`. Under
  // `contain` the panel shows the whole source anyway, so there is nothing to
  // crop away and no reason to reason about it: keep the original source.
  if (transform.fit !== 'cover') {
    return null;
  }

  const visible = panelVisibleRect(box, source, transform);

  // A framing that reaches past the source edge shows the panel's background
  // colour in the gap. `cover` on a clamped crop fills that gap with video
  // instead, so those framings keep the original source.
  if (
    visible.left < -EPSILON ||
    visible.top < -EPSILON ||
    visible.left + visible.width > source.width + EPSILON ||
    visible.top + visible.height > source.height + EPSILON
  ) {
    return null;
  }

  // H.264 wants even dimensions. Rounding down keeps the crop inside the source;
  // centring it on the ideal rectangle keeps the error symmetric.
  const width = floorEven(visible.width + EPSILON);
  const height = floorEven(visible.height + EPSILON);
  const left = clamp(
    Math.round(visible.left + (visible.width - width) / 2),
    0,
    source.width - width,
  );
  const top = clamp(
    Math.round(visible.top + (visible.height - height) / 2),
    0,
    source.height - height,
  );
  const savings = 1 - (width * height) / (source.width * source.height);

  if (savings < MIN_PROXY_SAVINGS) {
    return null;
  }

  // Solving `X_proxy(u) = X_source(u)` for the framing to draw the crop with.
  // `k` is unchanged, so the residual scale is only the ratio of the two cover
  // factors, and the residual offset is the crop centre's drift from the source
  // centre.
  const cover = Math.max(box.width / source.width, box.height / source.height);
  const k = cover * transform.scale;

  return {
    crop: {left, top, width, height},
    transform: {
      fit: 'cover',
      scale: k / Math.max(box.width / width, box.height / height),
      x: transform.x + ((100 / box.width) * k * (left + width / 2 - source.width / 2)),
      y: transform.y + ((100 / box.height) * k * (top + height / 2 - source.height / 2)),
    },
    savings,
  };
};
