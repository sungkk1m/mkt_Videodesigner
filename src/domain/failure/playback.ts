// failure-video Design §6.1 — how a duration preset is split across the three
// level segments and the end card, and which segment is live in a section.
//
// Pure: no React, no Remotion. The same rule the Day1 playback module follows.
import type {SceneDurationsMs} from '../timeline/timeline';
import {DAY1_END_CARD_MS} from '../day1/playback';
import {FAILURE_PANEL_SLOTS} from '../editor/constants';
import type {DurationPreset, FailureSlot} from '../editor/types';

/**
 * The reference's own proportions (Plan §1.1 measured 19% / 9% / 72%, rounded to
 * 20/10/70): a short failure, a shorter mid-game beat, then the long payoff.
 *
 * The end card takes its opening slice first, and the last segment absorbs the
 * rounding remainder so the four always total the preset exactly — the schema
 * rejects anything else. 30s gives [5400, 2700, 18900, 3000] and 60s
 * [11400, 5700, 39900, 3000], every one of them clear of `MIN_SCENE_MS`.
 */
export const failureSectionDurations = (
  preset: DurationPreset,
): SceneDurationsMs => {
  const restMs = preset * 1000 - DAY1_END_CARD_MS;
  const a = Math.round(restMs * 0.2);
  const b = Math.round(restMs * 0.1);

  return [a, b, restMs - a - b, DAY1_END_CARD_MS];
};

/**
 * The live segment for a section index. Sections 0-2 are the three levels in
 * order; the last one is the end card, which has no segment — the same shape as
 * `activePanelForQuadSection`.
 */
export const activePanelForFailureSection = (
  index: number,
): FailureSlot | null =>
  index >= 0 && index < FAILURE_PANEL_SLOTS.length
    ? (FAILURE_PANEL_SLOTS[index] as FailureSlot)
    : null;
