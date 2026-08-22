// key-visual-looping Design Ref: §8.1 — the cycle flattener's frame arithmetic,
// which SC3 (cycle 1 equals cycle 2) rests on.
import {describe, expect, it} from 'vitest';

import {DURATION_PRESETS, MIN_SCENE_MS} from '../editor/constants';
import type {DurationPreset} from '../editor/types';
import {
  cycleTotalMs,
  kvLoopCombination,
  kvLoopCycleDurations,
  kvLoopSegments,
} from './cycle';

const LOOPS = [1, 2, 3, 4];
const COUNTS = [2, 3, 4, 5, 6, 7, 8];
const FRAME_RATES = [30, 60];

describe('kvLoopCycleDurations', () => {
  it('divides one cycle evenly', () => {
    expect(kvLoopCycleDurations(15, 2, 4)).toEqual([1875, 1875, 1875, 1875]);
    expect(kvLoopCycleDurations(30, 1, 2)).toEqual([15_000, 15_000]);
  });

  it('gives the remainder to the leading sections, one millisecond each', () => {
    // 15s / 1 loop / 7 KV = 2142.857…, so six sections carry one extra ms.
    const durations = kvLoopCycleDurations(15, 1, 7);

    expect(durations).toEqual([2143, 2143, 2143, 2143, 2143, 2143, 2142]);
    expect(cycleTotalMs(durations)).toBe(15_000);
  });

  it('always sums to one cycle exactly', () => {
    for (const preset of DURATION_PRESETS) {
      for (const loopCount of LOOPS) {
        for (const kvCount of COUNTS) {
          const durations = kvLoopCycleDurations(preset, loopCount, kvCount);

          expect({preset, loopCount, kvCount, total: cycleTotalMs(durations)}).toEqual(
            {
              preset,
              loopCount,
              kvCount,
              total: (preset * 1000) / loopCount,
            },
          );
          expect(durations).toHaveLength(kvCount);
        }
      }
    }
  });

  it('satisfies the schema invariant — cycle times repeats equals the preset', () => {
    for (const preset of DURATION_PRESETS) {
      for (const loopCount of LOOPS) {
        const total =
          cycleTotalMs(kvLoopCycleDurations(preset, loopCount, 4)) * loopCount;

        expect(total).toBe(preset * 1000);
      }
    }
  });
});

describe('kvLoopSegments', () => {
  it('flattens the cycle into one segment per key visual per repeat', () => {
    const segments = kvLoopSegments([2000, 3000], 2, 300);

    expect(segments.map(({kvIndex, cycle}) => `${cycle}-${kvIndex}`)).toEqual([
      '0-0',
      '0-1',
      '1-0',
      '1-1',
    ]);
    expect(segments.map((segment) => segment.fromFrame)).toEqual([
      0, 60, 150, 210,
    ]);
    expect(segments.map((segment) => segment.durationInFrames)).toEqual([
      60, 90, 60, 90,
    ]);
  });

  it('totals the preset frames exactly for every combination', () => {
    for (const preset of DURATION_PRESETS) {
      for (const fps of FRAME_RATES) {
        for (const loopCount of LOOPS) {
          for (const kvCount of COUNTS) {
            const totalFrames = preset * fps;
            const segments = kvLoopSegments(
              kvLoopCycleDurations(preset, loopCount, kvCount),
              loopCount,
              totalFrames,
            );
            const summed = segments.reduce(
              (sum, segment) => sum + segment.durationInFrames,
              0,
            );

            expect({preset, fps, loopCount, kvCount, summed}).toEqual({
              preset,
              fps,
              loopCount,
              kvCount,
              summed: totalFrames,
            });
            expect(segments).toHaveLength(loopCount * kvCount);
          }
        }
      }
    }
  });

  it('leaves no gap between segments', () => {
    const segments = kvLoopSegments(kvLoopCycleDurations(15, 4, 3), 4, 450);

    segments.forEach((segment, index) => {
      const previous = segments[index - 1];

      expect(segment.fromFrame).toBe(
        previous ? previous.fromFrame + previous.durationInFrames : 0,
      );
    });
  });

  it('keeps corresponding segments within one frame across cycles — SC3', () => {
    for (const preset of DURATION_PRESETS) {
      for (const fps of FRAME_RATES) {
        for (const loopCount of LOOPS) {
          for (const kvCount of COUNTS) {
            const segments = kvLoopSegments(
              kvLoopCycleDurations(preset, loopCount, kvCount),
              loopCount,
              preset * fps,
            );

            for (let kvIndex = 0; kvIndex < kvCount; kvIndex += 1) {
              const lengths = segments
                .filter((segment) => segment.kvIndex === kvIndex)
                .map((segment) => segment.durationInFrames);

              expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(
                1,
              );
            }
          }
        }
      }
    }
  });

  it('spreads a fractional cycle instead of dumping it on one segment — D-03', () => {
    // 15s at 30fps over 4 repeats is 112.5 frames per cycle, and three key
    // visuals make an ideal 37.5 frames each — the case the "last section
    // absorbs everything" rule would have distorted.
    const segments = kvLoopSegments(kvLoopCycleDurations(15, 4, 3), 4, 450);
    const lengths = segments.map((segment) => segment.durationInFrames);

    expect(lengths.every((length) => length === 37 || length === 38)).toBe(true);
    expect(lengths.reduce((sum, length) => sum + length, 0)).toBe(450);
  });

  it('returns nothing when there is no cycle to flatten', () => {
    expect(kvLoopSegments([], 2, 450)).toEqual([]);
    expect(kvLoopSegments([1000], 0, 450)).toEqual([]);
  });
});

describe('kvLoopCombination', () => {
  it('accepts the reference format', () => {
    expect(kvLoopCombination(15, 2, 4).ok).toBe(true);
    expect(kvLoopCombination(30, 4, 7).ok).toBe(true);
  });

  it('blocks a sub-second hold and names the ways out — FR-L07 / SC7', () => {
    const result = kvLoopCombination(15, 2, 8);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.message).toContain('0.94초');
    expect(result.error.message).toContain('30초로 올리');
    expect(result.error.message).toContain('반복을 1회로 줄이');
    expect(result.error.details).toMatchObject({
      preset: 15,
      loopCount: 2,
      kvCount: 8,
    });
  });

  it('names the repeat count that does fit, not just one fewer', () => {
    const result = kvLoopCombination(30, 4, 8);

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    // 30s over eight key visuals holds each for a second at three repeats, so
    // three is the answer — "one fewer" would still be too many.
    expect(result.error.message).toContain('반복을 3회로 줄이');
    expect(result.error.message).toContain('60초로 올리');
  });

  it('agrees with the one-second minimum it is guarding', () => {
    for (const preset of DURATION_PRESETS) {
      for (const loopCount of LOOPS) {
        for (const kvCount of COUNTS) {
          const perKvMs = Math.floor((preset * 1000) / loopCount / kvCount);
          const result = kvLoopCombination(
            preset as DurationPreset,
            loopCount,
            kvCount,
          );

          expect({preset, loopCount, kvCount, ok: result.ok}).toEqual({
            preset,
            loopCount,
            kvCount,
            ok: perKvMs >= MIN_SCENE_MS,
          });
        }
      }
    }
  });
});
