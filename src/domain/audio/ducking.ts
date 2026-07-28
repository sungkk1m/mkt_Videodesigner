// Design Ref: §3.3 — "Default ducking lowers original and BGM gain while
// narration is active, with configurable amount and an envelope around narration
// boundaries." Pure so the Player and the render share one gain curve.

export interface NarrationWindow {
  fromFrame: number;
  durationInFrames: number;
}

export interface DuckingEnvelope {
  enabled: boolean;
  /** Gain applied while narration plays, 0..1. */
  targetGain: number;
  attackInFrames: number;
  releaseInFrames: number;
}

/**
 * Gain multiplier at one frame. Overlapping windows take the strongest duck so a
 * back-to-back narration never bounces back to full volume between scenes.
 */
export const duckingGainAt = (
  frame: number,
  windows: readonly NarrationWindow[],
  {enabled, targetGain, attackInFrames, releaseInFrames}: DuckingEnvelope,
) => {
  if (!enabled || windows.length === 0) {
    return 1;
  }

  let gain = 1;

  for (const window of windows) {
    const start = window.fromFrame;
    const end = start + window.durationInFrames;

    if (frame >= start && frame < end) {
      gain = Math.min(gain, targetGain);
      continue;
    }

    if (attackInFrames > 0 && frame >= start - attackInFrames && frame < start) {
      const progress = (frame - (start - attackInFrames)) / attackInFrames;

      gain = Math.min(gain, 1 - progress * (1 - targetGain));
      continue;
    }

    if (releaseInFrames > 0 && frame >= end && frame < end + releaseInFrames) {
      const progress = (frame - end) / releaseInFrames;

      gain = Math.min(gain, targetGain + progress * (1 - targetGain));
    }
  }

  return gain;
};

export const duckedVolumeAt = (
  frame: number,
  baseVolume: number,
  windows: readonly NarrationWindow[],
  envelope: DuckingEnvelope,
) => baseVolume * duckingGainAt(frame, windows, envelope);
