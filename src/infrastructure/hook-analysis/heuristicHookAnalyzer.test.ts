// Day1 Trim UX Design Ref: §7.1 — the static half of SC8. Frame decoding moved
// out to the FrameSampler port, and the risk that carries is a silently
// different sample grid: the worker would still score, still return candidates,
// and nothing would look broken. These tests pin the grid and the request the
// analyser makes, so a drift fails here instead of in a render weeks later.
import {describe, expect, it} from 'vitest';

import type {FrameSampleRequest, FrameSampler} from '../../domain/ports';
import {ok} from '../../shared/errors/appError';
import {hookSampleTimesMs} from './heuristicHookAnalyzer';

const MAX_SAMPLES = 240;
const SAMPLE_INTERVAL_MS = 500;

/** The grid the analyser used before frame decoding became a port. */
const legacySampleTimesMs = (sourceDurationMs: number) => {
  const sampleCount = Math.min(
    MAX_SAMPLES,
    Math.max(2, Math.floor(sourceDurationMs / SAMPLE_INTERVAL_MS)),
  );
  const step = sourceDurationMs / sampleCount;
  const times: number[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    times.push(Math.min(index * step, sourceDurationMs - 1));
  }

  return times;
};

describe('hookSampleTimesMs', () => {
  it.each([1000, 15_000, 75_000, 119_500, 120_000, 600_000])(
    'matches the pre-extraction grid for a %ims source',
    (sourceDurationMs) => {
      expect(hookSampleTimesMs(sourceDurationMs)).toEqual(
        legacySampleTimesMs(sourceDurationMs),
      );
    },
  );

  it('caps at 240 samples so a long source cannot explode the worker input', () => {
    expect(hookSampleTimesMs(600_000)).toHaveLength(MAX_SAMPLES);
  });

  it('samples at 2fps below the cap', () => {
    expect(hookSampleTimesMs(15_000)).toHaveLength(30);
  });

  it('never samples at or past the source end', () => {
    const sourceDurationMs = 75_000;

    for (const timeMs of hookSampleTimesMs(sourceDurationMs)) {
      expect(timeMs).toBeGreaterThanOrEqual(0);
      expect(timeMs).toBeLessThanOrEqual(sourceDurationMs - 1);
    }
  });

  it('keeps times unrounded so seek positions survive the extraction', () => {
    // 7000/14 = 500 exactly, so pick a duration whose step is fractional.
    const times = hookSampleTimesMs(7333);

    expect(times.some((timeMs) => !Number.isInteger(timeMs))).toBe(true);
  });

  it('rises monotonically', () => {
    const times = hookSampleTimesMs(75_000);

    for (let index = 1; index < times.length; index += 1) {
      expect(times[index] as number).toBeGreaterThan(
        times[index - 1] as number,
      );
    }
  });
});

describe('the sampler request hook analysis makes', () => {
  const captureRequest = async (sourceDurationMs: number) => {
    let captured: FrameSampleRequest | null = null;

    const sampler: FrameSampler = {
      sample: async (request) => {
        captured = request;

        return ok(undefined);
      },
    };

    // Importing the factory lazily keeps the worker URL out of this test file.
    const {createHeuristicHookAnalyzer} = await import(
      './heuristicHookAnalyzer'
    );

    await createHeuristicHookAnalyzer(sampler).analyze({
      url: 'blob:test',
      sourceDurationMs,
      candidateDurationMs: 3000,
      signal: new AbortController().signal,
      onProgress: () => {},
    });

    return captured as FrameSampleRequest | null;
  };

  it('asks for raw pixels, because the scoring worker needs them', async () => {
    const request = await captureRequest(15_000);

    expect(request?.needsPixels).toBe(true);
  });

  it('keeps the 320px downscale the scoring weights were tuned against', async () => {
    const request = await captureRequest(15_000);

    expect(request?.maxEdge).toBe(320);
  });

  it('passes exactly the legacy grid', async () => {
    const request = await captureRequest(75_000);

    expect(request?.timesMs).toEqual(legacySampleTimesMs(75_000));
  });
});
