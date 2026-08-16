// Day1 Trim UX Design Ref: §4.1 — the geometry the trim strip draws, kept beside
// `reconcileTrim` because it is the same rule seen from the UI side.
//
// Design Ref: §1.3 — `reconcileTrim` slides a fixed-length window over the
// source, so the only free value is `inMs`. Everything here derives from that:
// the window has a fixed width and moves, and when the source cannot fill the
// section the window covers the whole track and stops moving.

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** The fixed-length window `reconcileTrim` slides over the source. */
export const trimWindowMs = (
  sourceDurationMs: number,
  sectionDurationMs: number,
) => Math.min(Math.max(0, sectionDurationMs), Math.max(0, sourceDurationMs));

/** Highest legal Trim In. Zero when the source cannot fill the section. */
export const maxTrimInMs = (
  sourceDurationMs: number,
  sectionDurationMs: number,
) =>
  Math.max(0, sourceDurationMs) -
  trimWindowMs(sourceDurationMs, sectionDurationMs);

/**
 * Window geometry on a 0..1 track. `widthRatio` is 1 when the source is shorter
 * than the section, which is the visual form of "there is nothing to choose"
 * (FR-S05).
 */
export const windowBoundsRatio = (
  inMs: number,
  sourceDurationMs: number,
  sectionDurationMs: number,
): {startRatio: number; widthRatio: number} => {
  if (sourceDurationMs <= 0) {
    return {startRatio: 0, widthRatio: 0};
  }

  const startMs = clamp(
    inMs,
    0,
    maxTrimInMs(sourceDurationMs, sectionDurationMs),
  );

  return {
    startRatio: startMs / sourceDurationMs,
    widthRatio:
      trimWindowMs(sourceDurationMs, sectionDurationMs) / sourceDurationMs,
  };
};

/** Track position 0..1 → Trim In, clamped to the legal range. */
export const trimInFromRatio = (
  ratio: number,
  sourceDurationMs: number,
  sectionDurationMs: number,
): number =>
  clamp(
    Math.round(clamp(ratio, 0, 1) * Math.max(0, sourceDurationMs)),
    0,
    maxTrimInMs(sourceDurationMs, sectionDurationMs),
  );

/**
 * Evenly spaced sample times, one centred in each cell. Centres rather than
 * edges so the first cell shows the source a moment in, which reads better than
 * the black or logo frame many captures open on.
 */
export const stripSampleTimesMs = (
  sourceDurationMs: number,
  cellCount: number,
): number[] => {
  if (sourceDurationMs <= 0 || cellCount <= 0) {
    return [];
  }

  const step = sourceDurationMs / cellCount;

  return Array.from({length: cellCount}, (_, index) =>
    Math.min(
      Math.round((index + 0.5) * step),
      Math.max(0, sourceDurationMs - 1),
    ),
  );
};

/** Strip cell nearest a time — the drag-time approximation for FR-T05. */
export const nearestSampleIndex = (
  timeMs: number,
  sourceDurationMs: number,
  cellCount: number,
): number => {
  if (cellCount <= 0 || sourceDurationMs <= 0) {
    return 0;
  }

  const step = sourceDurationMs / cellCount;

  return clamp(
    Math.floor(clamp(timeMs, 0, sourceDurationMs) / step),
    0,
    cellCount - 1,
  );
};
