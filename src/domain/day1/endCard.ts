// Day1 Design Ref: §4.3 End Card Geometry — where the app-icon overlay must sit
// so it lands exactly on the icon already baked into the bannerdesigner export.
import {RATIO_DIMENSIONS, type AspectRatio} from '../editor/types';

/**
 * A rectangle as a fraction of the output frame. `w` is a fraction of the frame
 * width and `h` a fraction of its height, so a square icon has w !== h on a
 * non-square frame. `radius` is a fraction of the **width** in both cases,
 * matching how CSS resolves a pixel border-radius.
 */
export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

export interface IconAdjust {
  /** Nudge as a fraction of frame width. */
  dx: number;
  /** Nudge as a fraction of frame height. */
  dy: number;
  scale: number;
}

export const DEFAULT_ICON_ADJUST: IconAdjust = {dx: 0, dy: 0, scale: 1};

/**
 * Verbatim from `mkt_bannerdesigner/repo/today-banner-designer.html`,
 * `.banner.tmpl-app-badge.size-* .ab-icon` (read 2026-07-28):
 *
 *   size-1x1   canvas 1080x1080   top 375  left 282  515x515  radius 96
 *   size-9x16  canvas 1080x1920   top 820  left 200  680x680  radius 120
 *
 * Kept as raw pixels rather than pre-divided decimals so the numbers can be
 * diffed straight against that stylesheet. The template offers no icon-size
 * control, so these are fixed — but if the app-badge layout ever changes, this
 * table has to change with it.
 *
 * `size-16x9` does not exist in bannerdesigner (it ships 1x1, 9x16, 1200x628
 * only), so 16:9 has no automatic placement. Day1 Design Ref: §1.3 D12 degrades
 * it to manual positioning.
 */
const APP_ICON_CSS = {
  '1:1': {frameW: 1080, frameH: 1080, left: 282, top: 375, size: 515, radius: 96},
  '9:16': {frameW: 1080, frameH: 1920, left: 200, top: 820, size: 680, radius: 120},
} as const satisfies Partial<
  Record<
    AspectRatio,
    {
      frameW: number;
      frameH: number;
      left: number;
      top: number;
      size: number;
      radius: number;
    }
  >
>;

const normalize = (css: (typeof APP_ICON_CSS)[keyof typeof APP_ICON_CSS]) => ({
  x: css.left / css.frameW,
  y: css.top / css.frameH,
  w: css.size / css.frameW,
  h: css.size / css.frameH,
  radius: css.radius / css.frameW,
});

export const APP_ICON_RECT: Partial<Record<AspectRatio, NormalizedRect>> = {
  '1:1': normalize(APP_ICON_CSS['1:1']),
  '9:16': normalize(APP_ICON_CSS['9:16']),
};

/**
 * The icon rectangle for a ratio with the user's fine-tuning applied, or null
 * when the ratio has no automatic placement (16:9) and the inspector has to ask
 * for manual coordinates instead.
 *
 * Scaling happens about the icon's own centre so raising `scale` grows the icon
 * outward instead of dragging it toward the frame origin. Day1 Design Ref: §5.3
 * — the banner already has the icon painted in, so shrinking below 1 exposes it.
 */
export const appIconRect = (
  ratio: AspectRatio,
  adjust: IconAdjust = DEFAULT_ICON_ADJUST,
): NormalizedRect | null => {
  const base = APP_ICON_RECT[ratio];

  if (!base) {
    return null;
  }

  const w = base.w * adjust.scale;
  const h = base.h * adjust.scale;

  return {
    x: base.x + (base.w - w) / 2 + adjust.dx,
    y: base.y + (base.h - h) / 2 + adjust.dy,
    w,
    h,
    radius: base.radius * adjust.scale,
  };
};

/**
 * A centred square, used where no bannerdesigner layout exists. The side is a
 * fraction of the frame's *shorter* edge, which is how both real layouts read
 * (515/1080 and 680/1080), and the radius is the ~18% of the icon side they
 * share.
 */
const FALLBACK_ICON_SIDE_FRACTION = 0.4;
const FALLBACK_ICON_RADIUS_FRACTION = 0.18;

/**
 * The rectangle the end card actually draws the icon in.
 *
 * Day1 Design Ref: §1.3 D12 / §4.3 — 16:9 has no app-badge layout to copy, so
 * it degrades to manual placement. The composition still has to put the icon
 * somewhere, so it starts centred and the inspector nudges from there with the
 * same `iconAdjust` the automatic ratios use.
 */
export const placedIconRect = (
  ratio: AspectRatio,
  adjust: IconAdjust = DEFAULT_ICON_ADJUST,
): NormalizedRect => {
  const automatic = appIconRect(ratio, adjust);

  if (automatic) {
    return automatic;
  }

  const {width, height} = RATIO_DIMENSIONS[ratio];
  const side =
    Math.min(width, height) * FALLBACK_ICON_SIDE_FRACTION * adjust.scale;
  const w = side / width;
  const h = side / height;

  return {
    x: (1 - w) / 2 + adjust.dx,
    y: (1 - h) / 2 + adjust.dy,
    w,
    h,
    radius: (side * FALLBACK_ICON_RADIUS_FRACTION) / width,
  };
};
