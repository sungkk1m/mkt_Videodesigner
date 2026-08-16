// Day1 Trim UX Design Ref: §3.2 — decoding frames out of a source video used to
// live inside the hook analyser. It is lifted here unchanged so the trim strip
// can reuse it, with the sample grid moved out to the caller (§1.5 D-D01).
//
// Design Ref: §2.3 — every run owns its own <video>, so concurrent callers never
// share state and need no serialisation.
import type {
  FrameSampleRequest,
  FrameSampler,
  SampledFrame,
} from '../../domain/ports';
import {createAppError, fail, ok} from '../../shared/errors/appError';

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

/**
 * Design Ref: §3.2 — the sampler has no user-facing error identity of its own.
 * Consumers wrap this: hook analysis reports HOOK_ANALYSIS_FAILED, and the trim
 * strip degrades silently (FR-T09). MEDIA_PROBE_FAILED is reused rather than
 * adding a code, because a failure here is always a decode failure.
 */
const sampleFailed = (cause: unknown) =>
  createAppError('MEDIA_PROBE_FAILED', '영상 프레임을 읽지 못했습니다.', {
    retryable: true,
    cause,
  });

export const createFrameSampler = (): FrameSampler => ({
  sample: async ({
    url,
    timesMs,
    maxEdge,
    needsPixels,
    signal,
    onFrame,
  }: FrameSampleRequest) => {
    let video: HTMLVideoElement | null = null;

    try {
      video = await loadVideo(url);

      const scale = Math.min(
        1,
        maxEdge / Math.max(video.videoWidth, video.videoHeight),
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

      for (const timeMs of timesMs) {
        if (signal.aborted) {
          return fail<void>(sampleFailed(new Error('aborted')));
        }

        await seekTo(video, timeMs);
        context.drawImage(video, 0, 0, width, height);

        const frame: SampledFrame = {
          timeMs,
          width,
          height,
          thumbnail: canvas.toDataURL('image/jpeg', 0.6),
          pixels: needsPixels
            ? context.getImageData(0, 0, width, height).data.buffer
            : null,
        };

        onFrame(frame);
      }

      return ok(undefined);
    } catch (cause) {
      return fail<void>(sampleFailed(cause));
    } finally {
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    }
  },
});
