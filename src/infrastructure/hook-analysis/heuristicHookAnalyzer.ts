// Design Ref: §2.2 Hook C-lite Analysis and §4.4 HookAnalyzer — downscale to a
// maximum of 320px, sample near 2fps, score in a Worker, add Web Audio energy,
// and return 3-5 candidate intervals with thumbnails.
//
// Scope note: the optional Beta object/person detector is not implemented, so
// `hasObjectSignal` is always false and the remaining weights are renormalised.
import {
  buildHookCandidates,
  type AudioSignal,
} from '../../domain/hook/scoring';
import type {
  FrameSampler,
  HookAnalysisRequest,
  HookAnalyzer,
  HookCandidateWithThumbnail,
} from '../../domain/ports';
import {createAppError, fail, ok} from '../../shared/errors/appError';
import type {
  HookSignalRequest,
  HookSignalResponse,
} from './hookSignals.worker';

const MAX_SAMPLE_EDGE = 320;
const SAMPLE_INTERVAL_MS = 500;
const MAX_SAMPLES = 240;

const analysisFailed = (cause: unknown) =>
  createAppError(
    'HOOK_ANALYSIS_FAILED',
    'Hook 후보를 분석하지 못했습니다. Hook 구간을 직접 선택하세요.',
    {action: {label: 'Hook 직접 선택', target: 'scene'}, retryable: true, cause},
  );

/**
 * Day1 Trim UX Design Ref: §3.3 — the 2fps grid this analyser has always used.
 * It moved out of the sample loop when frame decoding became a port, so the
 * times are now computed up front and handed to the sampler unchanged.
 *
 * These stay unrounded on purpose: the original loop seeked with the raw value
 * and only rounded when keying the worker input and the thumbnail map, so the
 * rounding stays at the call site to keep seek positions bit-identical.
 */
export const hookSampleTimesMs = (sourceDurationMs: number): number[] => {
  const sampleCount = Math.min(
    MAX_SAMPLES,
    Math.max(2, Math.floor(sourceDurationMs / SAMPLE_INTERVAL_MS)),
  );
  const step = sourceDurationMs / sampleCount;

  return Array.from({length: sampleCount}, (_, index) =>
    Math.min(index * step, sourceDurationMs - 1),
  );
};

/** RMS energy per sample window, aligned to the frame sample times. */
const analyseAudio = async (
  file: Blob,
  timesMs: readonly number[],
): Promise<AudioSignal[]> => {
  try {
    const context = new OfflineAudioContext(1, 1, 44_100);
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const windowSamples = Math.max(
      1,
      Math.round((SAMPLE_INTERVAL_MS / 1000) * sampleRate),
    );

    const energies = timesMs.map((timeMs) => {
      const start = Math.min(
        channel.length - 1,
        Math.max(0, Math.round((timeMs / 1000) * sampleRate)),
      );
      const end = Math.min(channel.length, start + windowSamples);
      let sum = 0;

      for (let index = start; index < end; index += 1) {
        const value = channel[index] as number;
        sum += value * value;
      }

      return Math.sqrt(sum / Math.max(1, end - start));
    });

    const peak = Math.max(...energies, 1e-6);

    return timesMs.map((timeMs, index) => ({
      timeMs,
      energy: Math.min(1, (energies[index] as number) / peak),
    }));
  } catch {
    // Design Ref: §4.4 — a missing or undecodable audio track degrades to a
    // heuristic-only score rather than failing the analysis.
    return [];
  }
};

const runWorker = (request: HookSignalRequest) =>
  new Promise<HookSignalResponse>((resolve, reject) => {
    const worker = new Worker(
      new URL('./hookSignals.worker.ts', import.meta.url),
      {type: 'module'},
    );

    worker.onmessage = (event: MessageEvent<HookSignalResponse>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'hook-worker-failed'));
    };

    worker.postMessage(request, request.frames);
  });

// Day1 Trim UX Design Ref: §3.3 — frame decoding moved to the FrameSampler port,
// so it arrives by injection. Scoring, the worker, and audio energy are untouched.
export const createHeuristicHookAnalyzer = (
  sampler: FrameSampler,
): HookAnalyzer => ({
  analyze: async ({
    url,
    sourceDurationMs,
    candidateDurationMs,
    signal,
    onProgress,
  }: HookAnalysisRequest) => {
    try {
      const sampleTimes = hookSampleTimesMs(sourceDurationMs);
      const sampleCount = sampleTimes.length;

      const frames: ArrayBuffer[] = [];
      const timesMs: number[] = [];
      const thumbnails = new Map<number, string>();
      let width = 0;
      let height = 0;

      const sampled = await sampler.sample({
        url,
        timesMs: sampleTimes,
        maxEdge: MAX_SAMPLE_EDGE,
        needsPixels: true,
        signal,
        onFrame: (frame) => {
          // The seek ran on the raw time; the worker and the thumbnail map have
          // always been keyed by the rounded one.
          const roundedMs = Math.round(frame.timeMs);

          frames.push(frame.pixels as ArrayBuffer);
          timesMs.push(roundedMs);
          thumbnails.set(roundedMs, frame.thumbnail);
          width = frame.width;
          height = frame.height;

          onProgress(timesMs.length / sampleCount);
        },
      });

      if (!sampled.ok) {
        if (signal.aborted) {
          return fail<HookCandidateWithThumbnail[]>(
            createAppError('HOOK_ANALYSIS_FAILED', 'Hook 분석을 취소했습니다.', {
              retryable: true,
            }),
          );
        }

        return fail<HookCandidateWithThumbnail[]>(
          analysisFailed(sampled.error),
        );
      }

      // The object URL is the only handle the editor keeps, so the audio track
      // is read back from it rather than threading the original File through.
      const [{signals}, audio] = await Promise.all([
        runWorker({frames, timesMs, width, height}),
        fetch(url)
          .then((response) => response.blob())
          .then((blob) => analyseAudio(blob, timesMs))
          .catch(() => [] as AudioSignal[]),
      ]);

      const candidates = buildHookCandidates(signals, audio, {
        candidateDurationMs,
        sourceDurationMs,
      });

      const nearestThumbnail = (startMs: number) => {
        let best: string | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const [timeMs, dataUrl] of thumbnails) {
          const distance = Math.abs(timeMs - startMs);

          if (distance < bestDistance) {
            bestDistance = distance;
            best = dataUrl;
          }
        }

        return best;
      };

      return ok(
        candidates.map((candidate) => ({
          ...candidate,
          thumbnail: nearestThumbnail(candidate.startMs),
        })),
      );
    } catch (cause) {
      return fail<HookCandidateWithThumbnail[]>(analysisFailed(cause));
    }
    // The <video> is released by the sampler, which now owns it.
  },
});
