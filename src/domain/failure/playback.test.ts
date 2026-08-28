// failure-video Design §8.1 — the section split, over both presets.
import {describe, expect, it} from 'vitest';

import {
  activePanelForFailureSection,
  failureSectionDurations,
} from './playback';
import {DAY1_END_CARD_MS} from '../day1/playback';
import {FAILURE_DURATION_PRESETS, MIN_SCENE_MS} from '../editor/constants';

describe('failureSectionDurations', () => {
  it('splits each preset into the reference proportions', () => {
    expect(failureSectionDurations(30)).toEqual([5400, 2700, 18_900, 3000]);
    expect(failureSectionDurations(60)).toEqual([11_400, 5700, 39_900, 3000]);
  });

  it('totals the preset exactly and clears the section minimum', () => {
    for (const preset of FAILURE_DURATION_PRESETS) {
      const durations = failureSectionDurations(preset);

      expect(durations).toHaveLength(4);
      expect(durations.reduce((sum, ms) => sum + ms, 0)).toBe(preset * 1000);
      expect(Math.min(...durations)).toBeGreaterThanOrEqual(MIN_SCENE_MS);
      expect(durations[3]).toBe(DAY1_END_CARD_MS);
    }
  });

  // Plan §1.1 measured 19/9/72; Design D-4 rounds to 20/10/70 and keeps the
  // long payoff last, which is where the rounding remainder lands.
  it('gives the last level segment the largest share', () => {
    for (const preset of FAILURE_DURATION_PRESETS) {
      const [a, b, c] = failureSectionDurations(preset) as [
        number,
        number,
        number,
        number,
      ];

      expect(c).toBeGreaterThan(a);
      expect(a).toBeGreaterThan(b);
    }
  });
});

describe('activePanelForFailureSection', () => {
  it('maps the three level sections to their slots and the end card to null', () => {
    expect(activePanelForFailureSection(0)).toBe('a');
    expect(activePanelForFailureSection(1)).toBe('b');
    expect(activePanelForFailureSection(2)).toBe('c');
    expect(activePanelForFailureSection(3)).toBeNull();
    expect(activePanelForFailureSection(-1)).toBeNull();
  });
});
