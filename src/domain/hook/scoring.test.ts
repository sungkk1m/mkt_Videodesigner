import {describe, expect, it} from 'vitest';

import {
  buildHookCandidates,
  hookCandidateDurationMs,
  normalizedWeights,
  scoreFrames,
  type AudioSignal,
  type FrameSignal,
} from './scoring';

const frame = (
  timeMs: number,
  motion: number,
  sceneChange = 0,
  visualChange = 0,
): FrameSignal => ({timeMs, motion, sceneChange, visualChange});

const audio = (timeMs: number, energy: number): AudioSignal => ({
  timeMs,
  energy,
});

describe('normalizedWeights', () => {
  it('sums to one with the Beta detector available', () => {
    const weights = normalizedWeights(true);
    const total =
      weights.sceneMotion + weights.audio + weights.visual + weights.object;

    expect(total).toBeCloseTo(1);
    expect(weights.sceneMotion).toBeCloseTo(0.35);
  });

  it('redistributes the object weight when the detector is unavailable', () => {
    const weights = normalizedWeights(false);

    expect(weights.object).toBe(0);
    expect(
      weights.sceneMotion + weights.audio + weights.visual,
    ).toBeCloseTo(1);
    // 0.35 / 0.80
    expect(weights.sceneMotion).toBeCloseTo(0.4375);
  });
});

describe('scoreFrames', () => {
  const frames = [
    frame(0, 0.1, 0, 0.1),
    frame(500, 0.9, 0.8, 0.7),
    frame(1000, 0.2, 0, 0.2),
  ];
  const energies = [audio(0, 0.1), audio(500, 0.9), audio(1000, 0.2)];

  it('ranks the busiest frame highest', () => {
    const scored = scoreFrames(frames, energies);

    expect(scored).toHaveLength(3);
    expect(scored[1]?.score).toBeGreaterThan(scored[0]?.score ?? 1);
    expect(scored[1]?.score).toBeGreaterThan(scored[2]?.score ?? 1);
  });

  it('is deterministic for the same fixture', () => {
    expect(scoreFrames(frames, energies)).toEqual(
      scoreFrames(frames, energies),
    );
  });

  it('lists why a frame scored well', () => {
    expect(scoreFrames(frames, energies)[1]?.reasons).toEqual([
      'scene',
      'motion',
      'audio',
      'visual-change',
    ]);
  });

  it('produces no score at all for an empty sample set', () => {
    expect(scoreFrames([], [])).toEqual([]);
  });

  it('treats a flat signal as carrying no information', () => {
    const flat = [frame(0, 0.5), frame(500, 0.5), frame(1000, 0.5)];

    expect(scoreFrames(flat, []).map((entry) => entry.score)).toEqual([0, 0, 0]);
  });

  it('keeps heuristic scores usable when audio is missing entirely', () => {
    const scored = scoreFrames(frames, []);

    expect(scored[1]?.score).toBeGreaterThan(0);
    expect(scored[1]?.reasons).not.toContain('audio');
  });
});

describe('buildHookCandidates', () => {
  const options = {
    candidateDurationMs: 2000,
    sourceDurationMs: 12_000,
  };

  it('returns non-overlapping intervals of the requested length', () => {
    const frames = Array.from({length: 24}, (_, index) =>
      frame(index * 500, index % 6 === 0 ? 0.9 : 0.1, index % 6 === 0 ? 0.8 : 0),
    );
    const candidates = buildHookCandidates(frames, [], options);

    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates.length).toBeLessThanOrEqual(5);

    candidates.forEach((candidate, index) => {
      expect(candidate.endMs - candidate.startMs).toBe(2000);

      const previous = candidates[index - 1];

      if (previous) {
        expect(candidate.startMs).toBeGreaterThanOrEqual(previous.endMs);
      }
    });
  });

  it('never starts a candidate that would run past the source', () => {
    const candidates = buildHookCandidates(
      [frame(0, 0.1), frame(11_800, 0.9, 0.9)],
      [],
      options,
    );

    const last = candidates.at(-1);

    expect(last?.startMs).toBe(10_000);
    expect(last?.endMs).toBe(12_000);
    expect(
      candidates.every((candidate) => candidate.endMs <= 12_000),
    ).toBe(true);
  });

  it('returns candidates in timeline order', () => {
    const frames = [
      frame(8000, 0.9, 0.9),
      frame(1000, 0.6, 0.5),
      frame(4000, 0.7, 0.6),
    ];
    const candidates = buildHookCandidates(frames, [], options);

    expect(candidates.map((candidate) => candidate.startMs)).toEqual([
      1000, 4000, 8000,
    ]);
  });

  it('returns nothing when there is nothing to analyse', () => {
    expect(buildHookCandidates([], [], options)).toEqual([]);
  });
});

describe('hookCandidateDurationMs', () => {
  it('follows the approved Hook lengths per preset', () => {
    expect(hookCandidateDurationMs(15)).toBe(2000);
    expect(hookCandidateDurationMs(30)).toBe(3000);
    expect(hookCandidateDurationMs(60)).toBe(3000);
  });
});
