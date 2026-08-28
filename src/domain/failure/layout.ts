// failure-video Design §6.5 — where the footage and the caption bar sit for a
// given output ratio. Pure geometry: no React, no Remotion, like `day1/layout`.
import {
  FAILURE_CAPTION_RATIO,
  RATIO_DIMENSIONS,
  type AspectRatio,
} from '../editor/types';
import type {PanelRect} from '../day1/layout';

export interface FailureLayout {
  /** The upper band the level footage fills. */
  video: PanelRect;
  /** The black bar across the bottom, with the level caption centred in it. */
  caption: PanelRect;
}

/**
 * Plan §1.4 measured the reference's bar at exactly 10% of the frame height, and
 * the footage filling the 90% above it. The bar is a constant rather than a
 * stored field: nothing asked for it to move, and its height is the other half
 * of the video area's own geometry — one number, not two that can disagree.
 *
 * The video band takes `height - caption` rather than `height * 0.9`, so the two
 * always add up to the output exactly. A one-pixel gap would show as a seam.
 *
 * 9:16 → video 1080x1728 / caption 1080x192; 16:9 → 1920x972 / 1920x108.
 */
export const failureLayout = (ratio: AspectRatio): FailureLayout => {
  const {width, height} = RATIO_DIMENSIONS[ratio];
  const caption = Math.round(height * FAILURE_CAPTION_RATIO);

  return {
    video: {x: 0, y: 0, width, height: height - caption},
    caption: {x: 0, y: height - caption, width, height: caption},
  };
};
