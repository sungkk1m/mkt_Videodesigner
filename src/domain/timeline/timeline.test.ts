import {describe, expect, it} from 'vitest';

import {EDITOR_FPS, MIN_SCENE_MS} from '../editor/types';
import {
  allocateSceneFrames,
  boundaryPositionsMs,
  createSceneDurations,
  isTrimShorterThanScene,
  moveBoundary,
  reconcileTrim,
  sceneStartsMs,
  sumDurationsMs,
  type SceneDurationsMs,
} from './timeline';

const sumFrames = (frames: readonly number[]) =>
  frames.reduce((sum, count) => sum + count, 0);

describe('createSceneDurations', () => {
  it('initializes the approved 15/30/60 second defaults', () => {
    expect(createSceneDurations(15)).toEqual([2000, 10000, 3000]);
    expect(createSceneDurations(30)).toEqual([3000, 24000, 3000]);
    expect(createSceneDurations(60)).toEqual([3000, 54000, 3000]);
  });

  it('returns a copy so preset tables stay immutable', () => {
    const durations = createSceneDurations(15);
    durations[0] = 9999;

    expect(createSceneDurations(15)[0]).toBe(2000);
  });
});

describe('moveBoundary', () => {
  const base: SceneDurationsMs = [2000, 10000, 3000];

  it('changes only the two adjacent scenes and keeps the total invariant', () => {
    const next = moveBoundary(base, 0, 4000);

    expect(next).toEqual([4000, 8000, 3000]);
    expect(sumDurationsMs(next)).toBe(sumDurationsMs(base));
  });

  it('moves the second boundary without touching the hook', () => {
    const next = moveBoundary(base, 1, 10000);

    expect(next).toEqual([2000, 8000, 5000]);
    expect(sumDurationsMs(next)).toBe(15000);
  });

  it('clamps the first boundary to the one-second minimum on both sides', () => {
    expect(moveBoundary(base, 0, -5000)).toEqual([1000, 11000, 3000]);
    expect(moveBoundary(base, 0, 99999)).toEqual([11000, 1000, 3000]);
  });

  it('clamps the second boundary to the one-second minimum on both sides', () => {
    expect(moveBoundary(base, 1, 0)).toEqual([2000, MIN_SCENE_MS, 12000]);
    expect(moveBoundary(base, 1, 99999)).toEqual([2000, 12000, MIN_SCENE_MS]);
  });

  it('reports boundary positions that round-trip through moveBoundary', () => {
    const moved = moveBoundary(base, 1, 9000);

    expect(boundaryPositionsMs(moved)).toEqual([2000, 9000]);
    expect(sceneStartsMs(moved)).toEqual([0, 2000, 9000]);
  });
});

describe('allocateSceneFrames', () => {
  it('matches the preset frame total exactly for the defaults', () => {
    expect(allocateSceneFrames([2000, 10000, 3000], 15, EDITOR_FPS)).toEqual([
      60, 300, 90,
    ]);
    expect(allocateSceneFrames([3000, 54000, 3000], 60, EDITOR_FPS)).toEqual([
      90, 1620, 90,
    ]);
  });

  it('absorbs rounding remainders so the total frame count never drifts', () => {
    const frames = allocateSceneFrames([2333, 9334, 3333], 15, EDITOR_FPS);

    expect(sumFrames(frames)).toBe(15 * EDITOR_FPS);
  });

  it('keeps every scene at or above one second of frames', () => {
    const frames = allocateSceneFrames([13500, 1000, 500], 15, EDITOR_FPS);

    expect(Math.min(...frames)).toBeGreaterThanOrEqual(EDITOR_FPS);
    expect(sumFrames(frames)).toBe(15 * EDITOR_FPS);
  });
});

describe('a variable length section axis', () => {
  // key-visual-looping Design Ref: §4.4 — the axis widened from a three-tuple to
  // an array, and module-1 ships no new behaviour. These pin the three-section
  // results the tuple implementation produced, so a regression here is visible
  // as a changed number rather than as a broken render.
  it('moves a boundary to the same millisecond the three-tuple did', () => {
    const durations: SceneDurationsMs = [2000, 10000, 3000];

    expect(moveBoundary(durations, 0, 5000)).toEqual([5000, 7000, 3000]);
    expect(moveBoundary(durations, 0, -5000)).toEqual([1000, 11000, 3000]);
    expect(moveBoundary(durations, 0, 20000)).toEqual([11000, 1000, 3000]);
    expect(moveBoundary(durations, 0, 2500.7)).toEqual([2501, 9499, 3000]);
    expect(moveBoundary(durations, 1, 7000)).toEqual([2000, 5000, 8000]);
    expect(moveBoundary(durations, 1, 0)).toEqual([2000, 1000, 12000]);
    expect(moveBoundary(durations, 1, 20000)).toEqual([2000, 12000, 1000]);
    expect(moveBoundary([3000, 54000, 3000], 1, 59000)).toEqual([
      3000, 56000, 1000,
    ]);
  });

  it('allocates the same frames the three-tuple did', () => {
    expect(allocateSceneFrames([2000, 10000, 3000], 15, 30)).toEqual([
      60, 300, 90,
    ]);
    expect(allocateSceneFrames([2000, 10000, 3000], 15, 60)).toEqual([
      120, 600, 180,
    ]);
    expect(allocateSceneFrames([2333, 9334, 3333], 15, 30)).toEqual([
      70, 280, 100,
    ]);
    expect(allocateSceneFrames([1000, 1000, 13000], 15, 30)).toEqual([
      30, 30, 390,
    ]);
    expect(allocateSceneFrames([13000, 1000, 1000], 15, 30)).toEqual([
      390, 30, 30,
    ]);
    expect(allocateSceneFrames([6000, 21000, 3000], 30, 60)).toEqual([
      360, 1260, 180,
    ]);
  });

  it('reads starts and boundaries as it did for three sections', () => {
    expect(sceneStartsMs([2000, 10000, 3000])).toEqual([0, 2000, 12000]);
    expect(boundaryPositionsMs([2000, 10000, 3000])).toEqual([2000, 12000]);
  });

  it('reports one boundary fewer than it has sections', () => {
    expect(boundaryPositionsMs([7000, 8000])).toEqual([7000]);
    expect(boundaryPositionsMs([3000, 4000, 5000, 3000])).toEqual([
      3000, 7000, 12000,
    ]);
    expect(sceneStartsMs([7000, 8000])).toEqual([0, 7000]);
  });

  it('keeps the total invariant when a boundary moves, at any length', () => {
    const cases: SceneDurationsMs[] = [
      [7000, 8000],
      [3000, 4000, 5000, 3000],
      [2000, 2000, 2000, 2000, 2000, 2000, 2000, 1000],
    ];

    for (const durations of cases) {
      const total = sumDurationsMs(durations);

      for (let boundary = 0; boundary < durations.length - 1; boundary += 1) {
        for (const positionMs of [-1000, 1500, 6000, 14_500, 99_000]) {
          const moved = moveBoundary(durations, boundary, positionMs);

          expect(sumDurationsMs(moved)).toBe(total);
          expect(moved).toHaveLength(durations.length);
          expect(Math.min(...moved)).toBeGreaterThanOrEqual(MIN_SCENE_MS);
        }
      }
    }
  });

  it('moves only the two sections a boundary sits between', () => {
    const moved = moveBoundary([3000, 4000, 5000, 3000], 1, 5000);

    expect(moved).toEqual([3000, 2000, 7000, 3000]);
  });

  it('leaves the axis alone for a boundary past the last pair', () => {
    const durations: SceneDurationsMs = [2000, 10000, 3000];

    expect(moveBoundary(durations, 2, 5000)).toEqual(durations);
  });

  it('allocates frames that total the preset, at any length', () => {
    const cases: SceneDurationsMs[] = [
      [7000, 8000],
      [3000, 4000, 5000, 3000],
      [1875, 1875, 1875, 1875, 1875, 1875, 1875, 1875],
    ];

    for (const durations of cases) {
      for (const fps of [30, 60]) {
        const frames = allocateSceneFrames(durations, 15, fps);

        expect(frames).toHaveLength(durations.length);
        expect(sumFrames(frames)).toBe(15 * fps);
        expect(Math.min(...frames)).toBeGreaterThanOrEqual(fps);
      }
    }
  });
});

describe('reconcileTrim', () => {
  it('keeps the source window exactly as long as the scene', () => {
    expect(reconcileTrim({inMs: 4000, outMs: 4200}, 30000, 10000)).toEqual({
      inMs: 4000,
      outMs: 14000,
    });
  });

  it('clamps a trim in point that would exceed the source duration', () => {
    expect(reconcileTrim({inMs: 28000, outMs: 40000}, 30000, 10000)).toEqual({
      inMs: 20000,
      outMs: 30000,
    });
  });

  it('rejects negative and reversed intervals', () => {
    expect(reconcileTrim({inMs: -5000, outMs: -1000}, 30000, 2000)).toEqual({
      inMs: 0,
      outMs: 2000,
    });
  });

  it('shortens the window when the source is shorter than the scene', () => {
    const trim = reconcileTrim({inMs: 2000, outMs: 12000}, 6000, 10000);

    expect(trim).toEqual({inMs: 0, outMs: 6000});
    expect(isTrimShorterThanScene(trim, 10000)).toBe(true);
  });

  it('returns an empty interval when no source is loaded', () => {
    expect(reconcileTrim({inMs: 1000, outMs: 2000}, 0, 10000)).toEqual({
      inMs: 0,
      outMs: 0,
    });
  });
});
