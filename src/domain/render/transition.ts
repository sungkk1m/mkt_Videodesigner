// Design Ref: §1.3 Transitions — Cut, Fade, Zoom with Cut as the default.
//
// Implementation note: transitions run inside each scene's own frame range
// (fade out, then fade in) instead of overlapping two scenes. That keeps the
// §3.5 invariant "sum of scene frames equals preset x fps" exactly true, which
// an overlapping crossfade would break.
import type {TransitionRenderProps} from '../editor/types';

export interface TransitionStyle {
  opacity: number;
  scale: number;
}

const ZOOM_AMOUNT = 0.12;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export const transitionStyleAt = (
  frame: number,
  durationInFrames: number,
  transitionIn: TransitionRenderProps,
  transitionOut: TransitionRenderProps,
): TransitionStyle => {
  let opacity = 1;
  let scale = 1;

  if (transitionIn.kind !== 'cut' && frame < transitionIn.durationInFrames) {
    const progress = clamp01((frame + 1) / transitionIn.durationInFrames);

    opacity = progress;

    if (transitionIn.kind === 'zoom') {
      scale = 1 + ZOOM_AMOUNT * (1 - progress);
    }
  }

  const outStart = durationInFrames - transitionOut.durationInFrames;

  if (transitionOut.kind !== 'cut' && frame >= outStart) {
    const progress = clamp01((durationInFrames - frame) / transitionOut.durationInFrames);

    opacity = Math.min(opacity, progress);

    if (transitionOut.kind === 'zoom') {
      scale = 1 + ZOOM_AMOUNT * (1 - progress);
    }
  }

  return {opacity, scale};
};
