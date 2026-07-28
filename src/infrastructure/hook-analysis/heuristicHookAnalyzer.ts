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

const seekTo = (video: HTMLVideoElement, timeMs: number) =>
  new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('seek-failed'));
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = timeMs / 1000;
  });

const loadVideo = (url: string) =>
  new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video');

    video.muted = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('decode-failed'));
    video.src = url;
  });

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

export const createHeuristicHookAnalyzer = (): HookAnalyzer => ({
  analyze: async ({
    url,
    sourceDurationMs,
    candidateDurationMs,
    signal,
    onProgress,
  }: HookAnalysisRequest) => {
    let video: HTMLVideoElement | null = null;

    try {
      video = await loadVideo(url);

      const sampleCount = Math.min(
        MAX_SAMPLES,
        Math.max(2, Math.floor(sourceDurationMs / SAMPLE_INTERVAL_MS)),
      );
      const step = sourceDurationMs / sampleCount;
      const scale = Math.min(
        1,
        MAX_SAMPLE_EDGE / Math.max(video.videoWidth, video.videoHeight),
      );
      const width = Math.max(2, Math.round(video.videoWidth * scale));
      const height = Math.max(2, Math.round(video.videoHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d', {willReadFrequently: true});

      if (!context) {
        throw new Error('canvas-unavailable');
      }

      const frames: ArrayBuffer[] = [];
      const timesMs: number[] = [];
      const thumbnails = new Map<number, string>();

      for (let index = 0; index < sampleCount; index += 1) {
        if (signal.aborted) {
          return fail<HookCandidateWithThumbnail[]>(
            createAppError('HOOK_ANALYSIS_FAILED', 'Hook 분석을 취소했습니다.', {
              retryable: true,
            }),
          );
        }

        const timeMs = Math.min(index * step, sourceDurationMs - 1);

        await seekTo(video, timeMs);
        context.drawImage(video, 0, 0, width, height);

        frames.push(context.getImageData(0, 0, width, height).data.buffer);
        timesMs.push(Math.round(timeMs));
        thumbnails.set(
          Math.round(timeMs),
          canvas.toDataURL('image/jpeg', 0.6),
        );

        onProgress((index + 1) / sampleCount);
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
    } finally {
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    }
  },
});
