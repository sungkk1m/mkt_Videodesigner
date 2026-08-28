// failure-video Design §1.2 / D-1 — the orientation a ratio edits and renders.
//
// The key insight of the whole cycle: the editor is already bound to
// `project.selectedRatio` everywhere framing is concerned, so the preview ratio
// toggle *is* the orientation toggle. Nothing needs a second control, and no
// screen has to explain a concept the operator cannot already see.
import type {AspectRatio, FailureOrientation} from '../editor/types';

/**
 * 1:1 never reaches here: the schema rejects it (§4.3) and `switchTemplate`
 * coerces it away. The vertical answer is what a caller that bypassed both would
 * get, not a supported third case.
 */
export const failureOrientationFor = (ratio: AspectRatio): FailureOrientation =>
  ratio === '16:9' ? 'horizontal' : 'vertical';

/** The distinct orientations a set of render ratios needs sources for. */
export const failureOrientationsFor = (
  ratios: readonly AspectRatio[],
): readonly FailureOrientation[] => [
  ...new Set(ratios.map(failureOrientationFor)),
];
