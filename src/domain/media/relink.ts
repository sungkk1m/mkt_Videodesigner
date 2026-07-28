// Design Ref: §3.6 — "Import and restore show a missing-asset list and support
// assisted relinking by fingerprint." Pure comparison so the UI can explain the
// match before it replaces a reference.
import type {MediaReference} from './reference';

/** The subset of a freshly probed file needed to judge a relink. */
export interface RelinkCandidate {
  fingerprint: string;
  name: string;
  sizeBytes: number;
  durationMs: number;
}

export type RelinkConfidence = 'exact' | 'metadata' | 'mismatch';

export interface RelinkVerdict {
  confidence: RelinkConfidence;
  /** Korean, user-facing explanations of what differs. Empty when exact. */
  differences: string[];
}

const DURATION_TOLERANCE_MS = 100;

export const compareForRelink = (
  reference: MediaReference,
  candidate: RelinkCandidate,
): RelinkVerdict => {
  if (reference.fingerprint === candidate.fingerprint) {
    return {confidence: 'exact', differences: []};
  }

  const differences: string[] = [];

  if (reference.name !== candidate.name) {
    differences.push(`이름이 다릅니다 (${reference.name} → ${candidate.name})`);
  }

  if (reference.sizeBytes !== candidate.sizeBytes) {
    differences.push(
      `크기가 다릅니다 (${reference.sizeBytes} → ${candidate.sizeBytes} bytes)`,
    );
  }

  const referenceDurationMs = reference.durationMs ?? 0;

  if (
    Math.abs(referenceDurationMs - candidate.durationMs) > DURATION_TOLERANCE_MS
  ) {
    differences.push(
      `길이가 다릅니다 (${(referenceDurationMs / 1000).toFixed(2)}초 → ${(
        candidate.durationMs / 1000
      ).toFixed(2)}초)`,
    );
  }

  // Same name and size with a different fingerprint is a re-encode or an edit of
  // the same asset: usable, but the user should be told before it is accepted.
  const sameMetadata =
    reference.name === candidate.name &&
    reference.sizeBytes === candidate.sizeBytes;

  return {
    confidence: sameMetadata ? 'metadata' : 'mismatch',
    differences,
  };
};

/** Best candidate for an assisted folder match, or null when nothing fits. */
export const pickRelinkMatch = <TCandidate extends RelinkCandidate>(
  reference: MediaReference,
  candidates: readonly TCandidate[],
): {candidate: TCandidate; verdict: RelinkVerdict} | null => {
  let best: {candidate: TCandidate; verdict: RelinkVerdict} | null = null;

  for (const candidate of candidates) {
    const verdict = compareForRelink(reference, candidate);

    if (verdict.confidence === 'exact') {
      return {candidate, verdict};
    }

    if (verdict.confidence === 'metadata' && best === null) {
      best = {candidate, verdict};
    }
  }

  return best;
};
