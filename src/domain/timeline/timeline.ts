// Design Ref: §3.5 Invariants — preset defaults, invariant total duration,
// one-second minimum scene length, and trim ranges bounded by the source.
import type {
  DurationPreset,
  MediaTrim,
  SceneKind,
  Sections,
} from '../editor/types';
import {MIN_SCENE_MS} from '../editor/types';

/**
 * The section axis, in order. key-visual-looping Design Ref: §4.4 — a variable
 * length list rather than the three-tuple it used to be, so a template can take
 * as many sections as it has clips. The existing two stay at three, which the
 * schema pins.
 */
export type SceneDurationsMs = readonly number[];
/** Index of a boundary, so `0` is the one between sections 0 and 1. */
export type BoundaryIndex = number;

export const SCENE_DURATION_PRESETS_MS: Record<
  DurationPreset,
  SceneDurationsMs
> = {
  15: [2000, 10000, 3000],
  // steam-review Design D-2 — present because the Record's key type demands it,
  // unreachable in practice: no template that builds three-scene sections offers
  // the 20s preset (`durationPresetsForTemplate`), and steam-review builds its
  // own one-section axis at whatever length its footage gives it.
  20: [2000, 15000, 3000],
  30: [3000, 24000, 3000],
  60: [3000, 54000, 3000],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const presetTotalMs = (preset: DurationPreset) => preset * 1000;

export const msToFrames = (ms: number, fps: number) =>
  Math.round((ms / 1000) * fps);

/**
 * The only function here that ever touched a template-shaped value. It now
 * reads the shared section axis, which makes the rest of this module — boundary
 * dragging, frame allocation, presets — reusable by any template unchanged.
 * Day1 Design Ref: §1.2.
 */
export const sectionDurationsOf = (sections: Sections): SceneDurationsMs =>
  sections.map((section) => section.durationMs);

export const sumDurationsMs = (durations: SceneDurationsMs) =>
  durations.reduce((sum, durationMs) => sum + durationMs, 0);

/** Where each section opens, so the first is always zero. */
export const sceneStartsMs = (durations: SceneDurationsMs): SceneDurationsMs => {
  const starts: number[] = [];
  let cursor = 0;

  for (const durationMs of durations) {
    starts.push(cursor);
    cursor += durationMs;
  }

  return starts;
};

/**
 * Absolute timeline positions of the inner boundaries — the section starts with
 * the leading zero dropped, so n sections give n-1 handles.
 */
export const boundaryPositionsMs = (
  durations: SceneDurationsMs,
): readonly number[] => sceneStartsMs(durations).slice(1);

/**
 * Moves one boundary to an absolute timeline position. Only the two adjacent
 * scenes change, the total stays invariant, and every scene keeps the minimum.
 */
export const moveBoundary = (
  durations: SceneDurationsMs,
  boundary: BoundaryIndex,
  positionMs: number,
): SceneDurationsMs => {
  const left = durations[boundary];
  const right = durations[boundary + 1];

  // A boundary sits between two sections, so the index past the last pair has
  // nothing to move. Reachable now that the index is a plain number.
  if (left === undefined || right === undefined) {
    return durations;
  }

  const before = sceneStartsMs(durations)[boundary] as number;
  const pairEndMs = before + left + right;
  const next = clamp(
    Math.round(positionMs),
    before + MIN_SCENE_MS,
    pairEndMs - MIN_SCENE_MS,
  );

  return durations.map((durationMs, index) =>
    index === boundary
      ? next - before
      : index === boundary + 1
        ? pairEndMs - next
        : durationMs,
  );
};

/**
 * Converts scene milliseconds to frames. The last scene absorbs the rounding
 * remainder so the frame sum always equals the preset duration exactly.
 */
export const allocateSceneFrames = (
  durations: SceneDurationsMs,
  /**
   * The project's length in seconds, not necessarily one of the presets:
   * steam-review fits its own to the gameplay source. Only the frame total is
   * read from it, so any whole second works.
   */
  preset: number,
  fps: number,
): readonly number[] => {
  const totalFrames = preset * fps;
  const minFrames = msToFrames(MIN_SCENE_MS, fps);
  const frames: number[] = [];
  let allocated = 0;

  // Every section but the last takes its own length, kept clear of the minimum
  // the sections after it still need.
  for (let index = 0; index < durations.length - 1; index += 1) {
    const remaining = durations.length - 1 - index;
    const scene = clamp(
      msToFrames(durations[index] as number, fps),
      minFrames,
      totalFrames - allocated - minFrames * remaining,
    );

    frames.push(scene);
    allocated += scene;
  }

  frames.push(totalFrames - allocated);

  return frames;
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

export const createSceneDurations = (preset: DurationPreset): number[] => [
  ...SCENE_DURATION_PRESETS_MS[preset],
];

export const sceneIndexOf = (kind: SceneKind): 0 | 1 | 2 =>
  kind === 'hook' ? 0 : kind === 'gameplay' ? 1 : 2;
