// Day1 Design Ref: §8.1 — section-to-panel mapping and the preset split.
import {describe, expect, it} from 'vitest';

import {DURATION_PRESETS} from '../editor/types';
import {
  DAY1_END_CARD_MS,
  activePanelForSection,
  day1QuadSectionDurations,
  day1SectionDurations,
} from './playback';
import {DAY1_QUAD_DURATION_PRESETS, MIN_SCENE_MS} from '../editor/constants';

describe('activePanelForSection', () => {
  it('maps 0 to A, 1 to B, and the end card to no panel', () => {
    expect(activePanelForSection(0)).toBe('a');
    expect(activePanelForSection(1)).toBe('b');
    expect(activePanelForSection(2)).toBeNull();
  });
});

describe('day1SectionDurations', () => {
  it.each([
    [15 as const, [6000, 6000, 3000]],
    [30 as const, [13500, 13500, 3000]],
    [60 as const, [28500, 28500, 3000]],
  ])('splits the %ss preset as designed', (preset, expected) => {
    expect(day1SectionDurations(preset)).toEqual(expected);
  });

  it('totals the preset exactly for every preset', () => {
    for (const preset of DURATION_PRESETS) {
      const durations = day1SectionDurations(preset);
      const total = durations.reduce((sum, durationMs) => sum + durationMs, 0);

      expect({preset, total}).toEqual({preset, total: preset * 1000});
    }
  });

  it('splits the panels evenly — Plan D2 defaults the transition to halfway', () => {
    for (const preset of DURATION_PRESETS) {
      const [panelA, panelB] = day1SectionDurations(preset);

      expect(Math.abs((panelA as number) - (panelB as number))).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it('always reserves the fixed end card', () => {
    for (const preset of DURATION_PRESETS) {
      expect(day1SectionDurations(preset)[2]).toBe(DAY1_END_CARD_MS);
    }
  });

  it('keeps every section above the one-second schema minimum', () => {
    for (const preset of DURATION_PRESETS) {
      for (const durationMs of day1SectionDurations(preset)) {
        expect(durationMs).toBeGreaterThanOrEqual(1000);
      }
    }
  });
});

// day1-quad Design §6.1 — five sections: four panels then the end card.
describe('day1QuadSectionDurations', () => {
  it.each(DAY1_QUAD_DURATION_PRESETS)(
    'splits the %ss preset into four panels and the end card',
    (preset) => {
      const durations = day1QuadSectionDurations(preset);

      expect(durations).toHaveLength(5);
      // The schema rejects anything that does not total the preset exactly.
      expect(durations.reduce((sum, ms) => sum + ms, 0)).toBe(preset * 1000);
      expect(durations[4]).toBe(DAY1_END_CARD_MS);
      durations.forEach((ms) => expect(ms).toBeGreaterThanOrEqual(MIN_SCENE_MS));
    },
  );

  it('gives the four panels an even split, remainder to the last', () => {
    // 15s: 12s over four panels is exactly 3s each.
    expect(day1QuadSectionDurations(15)).toEqual([3000, 3000, 3000, 3000, 3000]);
    // 30s: 27s over four is 6.75s, which divides evenly at millisecond scale.
    expect(day1QuadSectionDurations(30)).toEqual([6750, 6750, 6750, 6750, 3000]);
  });
});
