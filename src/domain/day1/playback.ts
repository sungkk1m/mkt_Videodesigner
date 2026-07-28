// Day1 Design Ref: §4.2 Playback — which panel is live in each section, and how
// a duration preset is split across the three sections.
import type {SceneDurationsMs} from '../timeline/timeline';
import type {DurationPreset} from '../editor/types';

export type ActivePanel = 'a' | 'b';

/**
 * The live panel for a section index. The end card has no video panel, so it
 * returns null. Day1 Design Ref: §1.2 — the A|B boundary *is* the colour
 * transition point, which is why this maps one-to-one onto the section axis.
 */
export const activePanelForSection = (index: 0 | 1 | 2): ActivePanel | null =>
  index === 0 ? 'a' : index === 1 ? 'b' : null;

/** Day1 Design Ref: §4.2 — the end card opens at a fixed three seconds. */
export const DAY1_END_CARD_MS = 3000;

/**
 * Starting section lengths for a preset: the end card takes its fixed slice and
 * the two panels split the rest evenly, which is Plan D2's "default halfway".
 * The user then drags the boundary, so this is only the initial state.
 *
 * An odd remainder goes to panel B so the three always total the preset exactly
 * — the schema rejects anything else.
 */
export const day1SectionDurations = (
  preset: DurationPreset,
): SceneDurationsMs => {
  const splitMs = preset * 1000 - DAY1_END_CARD_MS;
  const panelA = Math.floor(splitMs / 2);

  return [panelA, splitMs - panelA, DAY1_END_CARD_MS];
};
