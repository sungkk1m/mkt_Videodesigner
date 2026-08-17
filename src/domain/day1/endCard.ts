// Day1 Design Ref: §4.3 End Card Geometry — where the app-icon overlay must sit
// so it lands exactly on the icon already baked into the bannerdesigner export.
import type {AspectRatio} from '../editor/types';

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
 *   size-16x9  canvas 1920x1080   top 238  left 1096 640x640  radius 125
 *
 * Kept as raw pixels rather than pre-divided decimals so the numbers can be
 * diffed straight against that stylesheet. The template offers no icon-size
 * control, so these are fixed — but if the app-badge layout ever changes, this
 * table has to change with it.
 *
 * The 16:9 row landed with bannerdesigner v1.18, which added the app-badge
 * 1920x1080 layout this cycle. Its exported PNG was measured at 0px error against
 * these numbers, so 16:9 no longer degrades to manual placement (Design D12).
 */
const APP_ICON_CSS = {
  '1:1': {frameW: 1080, frameH: 1080, left: 282, top: 375, size: 515, radius: 96},
  '9:16': {frameW: 1080, frameH: 1920, left: 200, top: 820, size: 680, radius: 120},
  '16:9': {frameW: 1920, frameH: 1080, left: 1096, top: 238, size: 640, radius: 125},
  // Every output ratio is covered, and the `satisfies` below is what keeps it
  // that way: adding a ratio without its app-badge coordinates fails to compile
  // instead of silently centring the icon somewhere plausible.
} as const satisfies Record<
  AspectRatio,
  {
    frameW: number;
    frameH: number;
    left: number;
    top: number;
    size: number;
    radius: number;
  }
>;

const normalize = (css: (typeof APP_ICON_CSS)[keyof typeof APP_ICON_CSS]) => ({
  x: css.left / css.frameW,
  y: css.top / css.frameH,
  w: css.size / css.frameW,
  h: css.size / css.frameH,
  radius: css.radius / css.frameW,
});

export const APP_ICON_RECT: Record<AspectRatio, NormalizedRect> = {
  '1:1': normalize(APP_ICON_CSS['1:1']),
  '9:16': normalize(APP_ICON_CSS['9:16']),
  '16:9': normalize(APP_ICON_CSS['16:9']),
};

/**
 * The icon rectangle for a ratio with the user's fine-tuning applied — where the
 * end card draws the overlay.
 *
 * Scaling happens about the icon's own centre so raising `scale` grows the icon
 * outward instead of dragging it toward the frame origin. Day1 Design Ref: §5.3
 * — the banner already has the icon painted in, so shrinking below 1 exposes it.
 */
export const appIconRect = (
  ratio: AspectRatio,
  adjust: IconAdjust = DEFAULT_ICON_ADJUST,
): NormalizedRect => {
  const base = APP_ICON_RECT[ratio];
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


/** day1-endcard-audio FR-03 — how long the closing fade lasts. */
export const END_CARD_AUDIO_FADE_S = 0.25;

/**
 * day1-endcard-audio FR-03 — per-frame gain for the end-card video's own
 * audio: the chosen volume through the body, a linear fade to zero across the
 * final quarter second so a loop cut at 15s never pops. Pure so the Player and
 * the renderer compute the identical curve (same rule as `duckedVolumeAt`).
 */
export const endCardAudioVolumeAt = (
  frame: number,
  fps: number,
  durationInFrames: number,
  volume: number,
): number => {
  const fadeFrames = END_CARD_AUDIO_FADE_S * fps;
  const fadeStart = durationInFrames - fadeFrames;

  // Inverted so a NaN probe frame falls through to the body volume —
  // @remotion/media evaluates the callback before the media is ready and
  // rejects the whole render if it ever gets NaN back.
  if (frame > fadeStart) {
    const remaining = Math.max(0, durationInFrames - frame);

    return volume * Math.min(1, remaining / fadeFrames);
  }

  return volume;
};
