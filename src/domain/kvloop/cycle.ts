// key-visual-looping Design Ref: §4.1 — the one place a cycle is flattened into
// frames. The composition and the timeline both read this, so the two can never
// disagree about where a key visual starts (Design §1.1 goal 2).
import {createAppError, fail, ok, type Result} from '../../shared/errors/appError';
import {DURATION_PRESETS, MIN_SCENE_MS} from '../editor/constants';
import type {DurationPreset} from '../editor/types';

export interface KvSegment {
  /** Index within one cycle, so the key for `slots` and `images`. */
  kvIndex: number;
  /** Zero-based repeat number. SC3 pairs corresponding segments by this. */
  cycle: number;
  fromFrame: number;
  durationInFrames: number;
}

export const cycleTotalMs = (cycleDurationsMs: readonly number[]) =>
  cycleDurationsMs.reduce((sum, durationMs) => sum + durationMs, 0);

/**
 * The starting hold per key visual: an even split of one cycle. The remainder
 * goes one millisecond at a time to the leading sections, so the cycle sums
 * exactly and the schema's total-duration invariant holds on the first render.
 *
 * The caller is expected to have cleared `kvLoopCombination` first; an
 * impossible combination still returns even lengths here, and the schema then
 * rejects the sub-second sections rather than this function guessing.
 */
export const kvLoopCycleDurations = (
  preset: DurationPreset,
  loopCount: number,
  kvCount: number,
): number[] => {
  const cycleMs = Math.floor((preset * 1000) / loopCount);
  const base = Math.floor(cycleMs / kvCount);
  const remainder = cycleMs - base * kvCount;

  return Array.from({length: kvCount}, (_, index) =>
    index < remainder ? base + 1 : base,
  );
};

/**
 * Design D-03 — cumulative rounding. Each boundary is rounded from its exact
 * position in the whole timeline, so a segment is at most one frame off its
 * ideal length and the frames still total `totalFrames` exactly.
 *
 * `allocateSceneFrames`'s "last section absorbs the remainder" rule is wrong
 * here: across eight segments the last would take the whole drift, which is
 * exactly what SC3 (cycle 1 and cycle 2 are the same) measures.
 *
 * Takes `totalFrames` rather than fps, so there is no code path where the frame
 * sum can disagree with the preset.
 */
export const kvLoopSegments = (
  cycleDurationsMs: readonly number[],
  loopCount: number,
  totalFrames: number,
): KvSegment[] => {
  const cycleMs = cycleTotalMs(cycleDurationsMs);

  if (cycleMs <= 0 || cycleDurationsMs.length === 0 || loopCount <= 0) {
    return [];
  }

  const totalMs = cycleMs * loopCount;
  const boundaryFrame = (elapsedMs: number) =>
    Math.round((elapsedMs / totalMs) * totalFrames);

  const segments: KvSegment[] = [];
  let elapsedMs = 0;
  let fromFrame = 0;

  for (let cycle = 0; cycle < loopCount; cycle += 1) {
    cycleDurationsMs.forEach((durationMs, kvIndex) => {
      elapsedMs += durationMs;

      const nextFrame = boundaryFrame(elapsedMs);

      segments.push({
        kvIndex,
        cycle,
        fromFrame,
        durationInFrames: nextFrame - fromFrame,
      });

      fromFrame = nextFrame;
    });
  }

  return segments;
};

/**
 * FR-L07. Kept out of the schema on purpose (Design §3.4): the schema's own
 * rejection would say "a section is 937ms, minimum is 1000ms", which does not
 * tell the user which of the three numbers to change.
 */
export const kvLoopCombination = (
  preset: DurationPreset,
  loopCount: number,
  kvCount: number,
): Result<void> => {
  const perKvMs = Math.floor((preset * 1000) / loopCount / kvCount);

  if (perKvMs >= MIN_SCENE_MS) {
    return ok(undefined);
  }

  const holdsAt = (candidatePreset: number, candidateLoops: number) =>
    Math.floor((candidatePreset * 1000) / candidateLoops / kvCount) >=
    MIN_SCENE_MS;

  const longerPreset = DURATION_PRESETS.find(
    (candidate) => candidate > preset && holdsAt(candidate, loopCount),
  );
  const fewerLoops = Math.floor((preset * 1000) / kvCount / MIN_SCENE_MS);
  const ways = [
    ...(longerPreset ? [`${longerPreset}초로 올리`] : []),
    ...(fewerLoops >= 1 && fewerLoops < loopCount
      ? [`반복을 ${fewerLoops}회로 줄이`]
      : []),
  ];

  return fail(
    createAppError(
      'PROJECT_INVALID',
      `${preset}초 · ${kvCount}장 · ${loopCount}회는 장당 ${(perKvMs / 1000).toFixed(2)}초라 ` +
        `최소 ${MIN_SCENE_MS / 1000}초를 밑돕니다. ` +
        (ways.length > 0
          ? `${ways.join('거나 ')}거나 장수를 줄여주세요.`
          : '장수를 줄여주세요.'),
      {
        details: {preset, loopCount, kvCount, perKvMs},
        action: {label: '설정 열기', target: 'settings'},
      },
    ),
  );
};
