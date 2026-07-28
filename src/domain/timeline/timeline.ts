// Design Ref: §3.5 Invariants — preset defaults, invariant total duration,
// one-second minimum scene length, and trim ranges bounded by the source.
import type {
  DurationPreset,
  EditorScenes,
  MediaTrim,
  SceneKind,
} from '../editor/types';
import {MIN_SCENE_MS} from '../editor/types';

export type SceneDurationsMs = [number, number, number];
export type BoundaryIndex = 0 | 1;

export const SCENE_DURATION_PRESETS_MS: Record<
  DurationPreset,
  SceneDurationsMs
> = {
  15: [2000, 10000, 3000],
  30: [3000, 24000, 3000],
  60: [3000, 54000, 3000],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const presetTotalMs = (preset: DurationPreset) => preset * 1000;

export const msToFrames = (ms: number, fps: number) =>
  Math.round((ms / 1000) * fps);

export const sceneDurationsOf = (scenes: EditorScenes): SceneDurationsMs => [
  scenes[0].durationMs,
  scenes[1].durationMs,
  scenes[2].durationMs,
];

export const sumDurationsMs = (durations: SceneDurationsMs) =>
  durations[0] + durations[1] + durations[2];

export const sceneStartsMs = (durations: SceneDurationsMs): SceneDurationsMs => [
  0,
  durations[0],
  durations[0] + durations[1],
];

/** Absolute timeline positions of the Hook|Gameplay and Gameplay|CTA boundaries. */
export const boundaryPositionsMs = (
  durations: SceneDurationsMs,
): [number, number] => [durations[0], durations[0] + durations[1]];

/**
 * Moves one boundary to an absolute timeline position. Only the two adjacent
 * scenes change, the total stays invariant, and every scene keeps the minimum.
 */
export const moveBoundary = (
  durations: SceneDurationsMs,
  boundary: BoundaryIndex,
  positionMs: number,
): SceneDurationsMs => {
  const [hook, gameplay, cta] = durations;
  const total = hook + gameplay + cta;
  const requested = Math.round(positionMs);

  if (boundary === 0) {
    const next = clamp(requested, MIN_SCENE_MS, hook + gameplay - MIN_SCENE_MS);
    return [next, hook + gameplay - next, cta];
  }

  const next = clamp(requested, hook + MIN_SCENE_MS, total - MIN_SCENE_MS);
  return [hook, next - hook, total - next];
};

/**
 * Converts scene milliseconds to frames. The last scene absorbs the rounding
 * remainder so the frame sum always equals the preset duration exactly.
 */
export const allocateSceneFrames = (
  durations: SceneDurationsMs,
  preset: DurationPreset,
  fps: number,
): [number, number, number] => {
  const totalFrames = preset * fps;
  const minFrames = msToFrames(MIN_SCENE_MS, fps);
  const hook = clamp(
    msToFrames(durations[0], fps),
    minFrames,
    totalFrames - minFrames * 2,
  );
  const gameplay = clamp(
    msToFrames(durations[1], fps),
    minFrames,
    totalFrames - hook - minFrames,
  );

  return [hook, gameplay, totalFrames - hook - gameplay];
};

/**
 * Keeps the selected source interval exactly as long as the scene when the
 * source allows it, and clamps it inside the source otherwise. A source shorter
 * than the scene produces a shorter window, which callers surface as a warning.
 */
export const reconcileTrim = (
  trim: MediaTrim,
  sourceDurationMs: number,
  sceneDurationMs: number,
): MediaTrim => {
  if (sourceDurationMs <= 0) {
    return {inMs: 0, outMs: 0};
  }

  const windowMs = Math.min(sceneDurationMs, sourceDurationMs);
  const inMs = clamp(Math.round(trim.inMs), 0, sourceDurationMs - windowMs);

  return {inMs, outMs: inMs + windowMs};
};

export const isTrimShorterThanScene = (
  trim: MediaTrim,
  sceneDurationMs: number,
) => trim.outMs - trim.inMs < sceneDurationMs;

export const createSceneDurations = (
  preset: DurationPreset,
): SceneDurationsMs => [...SCENE_DURATION_PRESETS_MS[preset]];

export const sceneIndexOf = (kind: SceneKind): 0 | 1 | 2 =>
  kind === 'hook' ? 0 : kind === 'gameplay' ? 1 : 2;
