// Day1 Trim UX Design Ref: §7.1 — the boundary table from §4.1, pinned. These are
// the whole reason the geometry lives in `domain`: the strip itself needs canvas
// and a real <video>, but the arithmetic that decides where the window sits does
// not, so it gets tested properly here instead of only through E2E.
import {describe, expect, it} from 'vitest';

import {reconcileTrim} from './timeline';
import {
  maxTrimInMs,
  nearestSampleIndex,
  stripSampleTimesMs,
  trimInFromRatio,
  trimWindowMs,
  windowBoundsRatio,
} from './trimWindow';

const SECTION_MS = 6000;

describe('trimWindowMs', () => {
  it('is the section length when the source can fill it', () => {
    expect(trimWindowMs(75_000, SECTION_MS)).toBe(SECTION_MS);
  });

  it('collapses to the source length when the source is short', () => {
    expect(trimWindowMs(4000, SECTION_MS)).toBe(4000);
  });

  it('is zero without a source', () => {
    expect(trimWindowMs(0, SECTION_MS)).toBe(0);
  });

  it('agrees with reconcileTrim, which owns the same rule', () => {
    for (const sourceMs of [0, 1000, 4000, 6000, 75_000]) {
      const reconciled = reconcileTrim({inMs: 0, outMs: 0}, sourceMs, SECTION_MS);

      expect(trimWindowMs(sourceMs, SECTION_MS)).toBe(
        reconciled.outMs - reconciled.inMs,
      );
    }
  });
});

describe('maxTrimInMs', () => {
  it('leaves room to slide when the source is longer than the section', () => {
    expect(maxTrimInMs(75_000, SECTION_MS)).toBe(69_000);
  });

  it('is zero when the source exactly fills the section', () => {
    expect(maxTrimInMs(SECTION_MS, SECTION_MS)).toBe(0);
  });

  it('is zero when the source is shorter — nothing to choose (FR-S05)', () => {
    expect(maxTrimInMs(4000, SECTION_MS)).toBe(0);
  });

  it('is zero without a source', () => {
    expect(maxTrimInMs(0, SECTION_MS)).toBe(0);
  });
});

describe('windowBoundsRatio', () => {
  it('is an empty window without a source', () => {
    expect(windowBoundsRatio(0, 0, SECTION_MS)).toEqual({
      startRatio: 0,
      widthRatio: 0,
    });
  });

  it('covers the whole track when the source is short (FR-S05)', () => {
    expect(windowBoundsRatio(0, 4000, SECTION_MS)).toEqual({
      startRatio: 0,
      widthRatio: 1,
    });
  });

  it('is a narrow window on a long source', () => {
    const bounds = windowBoundsRatio(0, 75_000, SECTION_MS);

    expect(bounds.startRatio).toBe(0);
    expect(bounds.widthRatio).toBeCloseTo(0.08, 5);
  });

  it('moves the window without changing its width', () => {
    const atStart = windowBoundsRatio(0, 75_000, SECTION_MS);
    const moved = windowBoundsRatio(30_000, 75_000, SECTION_MS);

    expect(moved.startRatio).toBeCloseTo(0.4, 5);
    expect(moved.widthRatio).toBeCloseTo(atStart.widthRatio, 10);
  });

  it('never lets the window run past the end of the track', () => {
    const bounds = windowBoundsRatio(999_000, 75_000, SECTION_MS);

    expect(bounds.startRatio + bounds.widthRatio).toBeLessThanOrEqual(1);
  });

  it('clamps a negative Trim In to the start', () => {
    expect(windowBoundsRatio(-5000, 75_000, SECTION_MS).startRatio).toBe(0);
  });
});

describe('trimInFromRatio', () => {
  it('maps the middle of the track into the legal range', () => {
    expect(trimInFromRatio(0.5, 75_000, SECTION_MS)).toBe(37_500);
  });

  it('clamps the far end to the last legal Trim In', () => {
    expect(trimInFromRatio(1, 75_000, SECTION_MS)).toBe(69_000);
  });

  it('clamps out-of-range positions', () => {
    expect(trimInFromRatio(-2, 75_000, SECTION_MS)).toBe(0);
    expect(trimInFromRatio(4, 75_000, SECTION_MS)).toBe(69_000);
  });

  it('always returns zero when the source is short (FR-S05)', () => {
    for (const ratio of [0, 0.5, 1]) {
      expect(trimInFromRatio(ratio, 4000, SECTION_MS)).toBe(0);
    }
  });

  it('round-trips against windowBoundsRatio', () => {
    for (const inMs of [0, 12_000, 40_000, 69_000]) {
      const {startRatio} = windowBoundsRatio(inMs, 75_000, SECTION_MS);

      expect(trimInFromRatio(startRatio, 75_000, SECTION_MS)).toBe(inMs);
    }
  });
});

describe('stripSampleTimesMs', () => {
  it('returns one time per cell', () => {
    expect(stripSampleTimesMs(75_000, 16)).toHaveLength(16);
  });

  it('is empty without a source', () => {
    expect(stripSampleTimesMs(0, 16)).toEqual([]);
  });

  it('is empty without cells', () => {
    expect(stripSampleTimesMs(75_000, 0)).toEqual([]);
  });

  it('centres each sample in its cell, so the first is not frame zero', () => {
    expect(stripSampleTimesMs(16_000, 16)).toEqual([
      500, 1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10_500,
      11_500, 12_500, 13_500, 14_500, 15_500,
    ]);
  });

  it('rises monotonically and stays inside the source', () => {
    const times = stripSampleTimesMs(75_000, 16);

    for (const [index, timeMs] of times.entries()) {
      expect(timeMs).toBeGreaterThanOrEqual(0);
      expect(timeMs).toBeLessThanOrEqual(75_000 - 1);

      if (index > 0) {
        expect(timeMs).toBeGreaterThan(times[index - 1] as number);
      }
    }
  });

  it('stays inside a source shorter than the cell count', () => {
    for (const timeMs of stripSampleTimesMs(8, 16)) {
      expect(timeMs).toBeLessThanOrEqual(7);
    }
  });
});

describe('nearestSampleIndex', () => {
  it('maps a time to the cell containing it', () => {
    expect(nearestSampleIndex(0, 16_000, 16)).toBe(0);
    expect(nearestSampleIndex(8000, 16_000, 16)).toBe(8);
    expect(nearestSampleIndex(15_999, 16_000, 16)).toBe(15);
  });

  it('never leaves the cell range', () => {
    expect(nearestSampleIndex(-5000, 16_000, 16)).toBe(0);
    expect(nearestSampleIndex(999_999, 16_000, 16)).toBe(15);
  });

  it('is zero for a degenerate strip', () => {
    expect(nearestSampleIndex(1000, 16_000, 0)).toBe(0);
    expect(nearestSampleIndex(1000, 0, 16)).toBe(0);
  });

  it('indexes every time produced by stripSampleTimesMs', () => {
    const cellCount = 16;
    const times = stripSampleTimesMs(75_000, cellCount);

    for (const [expected, timeMs] of times.entries()) {
      expect(nearestSampleIndex(timeMs, 75_000, cellCount)).toBe(expected);
    }
  });
});
