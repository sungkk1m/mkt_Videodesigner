// Design Ref: §2.2 Hook C-lite Analysis — weighted normalised scoring over
// motion/scene, audio energy, and luminance/colour change, followed by temporal
// merging into 3-5 candidate intervals.
//
// This is a visual-salience heuristic, not an ad-performance prediction.

/** One sampled video frame, produced by the analyzer at roughly 2fps. */
export interface FrameSignal {
  timeMs: number;
  /** Mean absolute pixel change against the previous sample, 0..1. */
  motion: number;
  /** Large-step change suggesting a scene cut, 0..1. */
  sceneChange: number;
  /** Luminance and colour change against the previous sample, 0..1. */
  visualChange: number;
}

/** One audio window aligned to the frame samples. */
export interface AudioSignal {
  timeMs: number;
  /** RMS energy of the window, 0..1. */
  energy: number;
}

export type HookReason = 'scene' | 'motion' | 'audio' | 'visual-change';

export interface HookCandidate {
  id: string;
  startMs: number;
  endMs: number;
  /** Normalised 0..1 weighted score. */
  score: number;
  reasons: HookReason[];
  source: 'heuristic';
}

/** Design Ref: §2.2 — the object/person signal belongs to the optional Beta detector. */
export const HOOK_WEIGHTS = {
  sceneMotion: 0.35,
  audio: 0.25,
  visual: 0.2,
  object: 0.2,
} as const;

export interface HookAnalysisOptions {
  /** Candidate length: 2s for the 15s preset, 3s for 30s and 60s. */
  candidateDurationMs: number;
  sourceDurationMs: number;
  /** Frames kept before temporal merging. Design Ref: §2.2 "top 20-30". */
  topFrameCount?: number;
  maxCandidates?: number;
  /** True once the optional Beta detector contributed a signal. */
  hasObjectSignal?: boolean;
}

const DEFAULT_TOP_FRAMES = 24;
const DEFAULT_MAX_CANDIDATES = 5;
/** A signal has to beat its own mean by this much to be listed as a reason. */
const REASON_MARGIN = 0.05;

/**
 * Renormalises the available weights to 100% so a missing Beta detector never
 * silently lowers every score. Design Ref: §2.2.
 */
export const normalizedWeights = (hasObjectSignal: boolean) => {
  const total =
    HOOK_WEIGHTS.sceneMotion +
    HOOK_WEIGHTS.audio +
    HOOK_WEIGHTS.visual +
    (hasObjectSignal ? HOOK_WEIGHTS.object : 0);

  return {
    sceneMotion: HOOK_WEIGHTS.sceneMotion / total,
    audio: HOOK_WEIGHTS.audio / total,
    visual: HOOK_WEIGHTS.visual / total,
    object: hasObjectSignal ? HOOK_WEIGHTS.object / total : 0,
  };
};

const normalize = (values: number[]) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  // A flat signal carries no information, so it contributes nothing.
  return values.map((value) => (span === 0 ? 0 : (value - min) / span));
};

const mean = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const audioAt = (audio: readonly AudioSignal[], timeMs: number) => {
  if (audio.length === 0) {
    return 0;
  }

  let closest = audio[0] as AudioSignal;

  for (const sample of audio) {
    if (
      Math.abs(sample.timeMs - timeMs) < Math.abs(closest.timeMs - timeMs)
    ) {
      closest = sample;
    }
  }

  return closest.energy;
};

export interface ScoredFrame {
  timeMs: number;
  score: number;
  reasons: HookReason[];
}

export const scoreFrames = (
  frames: readonly FrameSignal[],
  audio: readonly AudioSignal[],
  hasObjectSignal = false,
): ScoredFrame[] => {
  if (frames.length === 0) {
    return [];
  }

  const weights = normalizedWeights(hasObjectSignal);
  const sceneMotion = normalize(
    frames.map((frame) => Math.max(frame.motion, frame.sceneChange)),
  );
  const visual = normalize(frames.map((frame) => frame.visualChange));
  const energy = normalize(frames.map((frame) => audioAt(audio, frame.timeMs)));
  const sceneCuts = normalize(frames.map((frame) => frame.sceneChange));

  const sceneMotionMean = mean(sceneMotion);
  const visualMean = mean(visual);
  const energyMean = mean(energy);
  const sceneCutMean = mean(sceneCuts);

  return frames.map((frame, index) => {
    const motionValue = sceneMotion[index] as number;
    const visualValue = visual[index] as number;
    const energyValue = energy[index] as number;
    const cutValue = sceneCuts[index] as number;
    const reasons: HookReason[] = [];

    if (cutValue > sceneCutMean + REASON_MARGIN) {
      reasons.push('scene');
    }

    if (motionValue > sceneMotionMean + REASON_MARGIN) {
      reasons.push('motion');
    }

    if (energyValue > energyMean + REASON_MARGIN) {
      reasons.push('audio');
    }

    if (visualValue > visualMean + REASON_MARGIN) {
      reasons.push('visual-change');
    }

    return {
      timeMs: frame.timeMs,
      score:
        motionValue * weights.sceneMotion +
        energyValue * weights.audio +
        visualValue * weights.visual,
      reasons,
    };
  });
};

/**
 * Non-maximum suppression over candidate intervals: the highest-scoring frame
 * wins its window and any overlapping lower-scoring window is dropped. This is
 * the "adjacent or overlapping intervals are merged" step of §2.2.
 */
export const buildHookCandidates = (
  frames: readonly FrameSignal[],
  audio: readonly AudioSignal[],
  {
    candidateDurationMs,
    sourceDurationMs,
    topFrameCount = DEFAULT_TOP_FRAMES,
    maxCandidates = DEFAULT_MAX_CANDIDATES,
    hasObjectSignal = false,
  }: HookAnalysisOptions,
): HookCandidate[] => {
  const latestStartMs = Math.max(0, sourceDurationMs - candidateDurationMs);
  const ranked = scoreFrames(frames, audio, hasObjectSignal)
    .slice()
    .sort((left, right) => right.score - left.score)
    .slice(0, topFrameCount);

  const candidates: HookCandidate[] = [];

  for (const frame of ranked) {
    if (candidates.length >= maxCandidates) {
      break;
    }

    const startMs = Math.min(Math.max(0, Math.round(frame.timeMs)), latestStartMs);
    const endMs = startMs + candidateDurationMs;
    const overlaps = candidates.some(
      (candidate) => startMs < candidate.endMs && endMs > candidate.startMs,
    );

    if (overlaps) {
      continue;
    }

    candidates.push({
      id: `hook_${startMs}`,
      startMs,
      endMs,
      score: Number(frame.score.toFixed(4)),
      reasons: frame.reasons,
      source: 'heuristic',
    });
  }

  return candidates.sort((left, right) => left.startMs - right.startMs);
};

/** Design Ref: §3.5 — 2 seconds for the 15s preset, 3 seconds otherwise. */
export const hookCandidateDurationMs = (durationPreset: number) =>
  durationPreset === 15 ? 2000 : 3000;
