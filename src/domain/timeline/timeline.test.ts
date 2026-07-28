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
      120, 600, 180,
    ]);
    expect(allocateSceneFrames([3000, 54000, 3000], 60, EDITOR_FPS)).toEqual([
      180, 3240, 180,
    ]);
  });

  it('absorbs rounding remainders so the total frame count never drifts', () => {
    const frames = allocateSceneFrames([2333, 9334, 3333], 15, EDITOR_FPS);

    expect(frames[0] + frames[1] + frames[2]).toBe(15 * EDITOR_FPS);
  });

  it('keeps every scene at or above one second of frames', () => {
    const frames = allocateSceneFrames([13500, 1000, 500], 15, EDITOR_FPS);

    expect(Math.min(...frames)).toBeGreaterThanOrEqual(EDITOR_FPS);
    expect(frames[0] + frames[1] + frames[2]).toBe(15 * EDITOR_FPS);
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
