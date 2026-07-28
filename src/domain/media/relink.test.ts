import {describe, expect, it} from 'vitest';

import {testMediaReference} from '../../test/fixtures/media';
import {compareForRelink, pickRelinkMatch} from './relink';

const reference = testMediaReference({
  fingerprint: 'sha256-original',
  name: 'gameplay.mp4',
  sizeBytes: 2048,
  durationMs: 30_000,
});

const candidate = (overrides: Partial<Parameters<typeof compareForRelink>[1]>) => ({
  fingerprint: 'sha256-original',
  name: 'gameplay.mp4',
  sizeBytes: 2048,
  durationMs: 30_000,
  ...overrides,
});

describe('compareForRelink', () => {
  it('accepts a matching fingerprint even when the file was renamed', () => {
    expect(compareForRelink(reference, candidate({name: 'moved.mp4'}))).toEqual({
      confidence: 'exact',
      differences: [],
    });
  });

  it('treats the same name and size with a new fingerprint as a re-encode', () => {
    const verdict = compareForRelink(
      reference,
      candidate({fingerprint: 'sha256-reencoded', durationMs: 30_040}),
    );

    expect(verdict.confidence).toBe('metadata');
    expect(verdict.differences).toEqual([]);
  });

  it('explains every difference for an unrelated file', () => {
    const verdict = compareForRelink(
      reference,
      candidate({
        fingerprint: 'sha256-other',
        name: 'other.mp4',
        sizeBytes: 4096,
        durationMs: 12_000,
      }),
    );

    expect(verdict.confidence).toBe('mismatch');
    expect(verdict.differences).toHaveLength(3);
  });
});

describe('pickRelinkMatch', () => {
  it('prefers an exact fingerprint over an earlier metadata match', () => {
    const match = pickRelinkMatch(reference, [
      candidate({fingerprint: 'sha256-reencoded'}),
      candidate({name: 'renamed.mp4'}),
    ]);

    expect(match?.verdict.confidence).toBe('exact');
    expect(match?.candidate.name).toBe('renamed.mp4');
  });

  it('returns null when no candidate is close enough', () => {
    expect(
      pickRelinkMatch(reference, [
        candidate({fingerprint: 'sha256-other', name: 'other.mp4'}),
      ]),
    ).toBeNull();
  });
});
