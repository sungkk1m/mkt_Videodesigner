// Day1 render speed — the transcoder behind `SourceProxyBuilder`.
//
// mediabunny is already in the tree (`@remotion/media` pins the same 1.50.8) and
// its Conversion API takes a crop rectangle directly, so this needs no new
// decoder, no WASM, and no worker.
//
// Deliberately outside `withSoftwareVideoDecoding`: a Conversion is a streaming
// pipeline with backpressure, so it never holds the pile of open frames that
// wedges the hardware decoder during a render (see `softwareVideoDecode.ts`).
// Letting it use the hardware decoder is what keeps preparation to seconds.
import {
  ALL_FORMATS,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  UrlSource,
} from 'mediabunny';

import type {
  SourceProxy,
  SourceProxyBuilder,
  SourceProxyRequest,
} from '../../domain/ports';
import {
  createAppError,
  fail,
  ok,
  type Result,
} from '../../shared/errors/appError';
import {recordLine} from '../render/debugLog';

/**
 * Bits per pixel per frame for the proxy, assuming a 60fps source — a 30fps one
 * simply gets twice the headroom.
 *
 * The source measured on 2026-08-18 carried 0.064 bits/px (1242x2208, 60fps,
 * 10.6Mbps), and the render's own H.264 pass is 5.7Mbps at 1080x1920/60. Feeding
 * the render a proxy at this rate was measured against the current path, both
 * scored on a lossless reference: the extra encode generation costs 0.002dB of
 * PSNR-Y and 4e-5 of SSIM, two orders of magnitude below the 0.5dB
 * just-noticeable threshold and below the final encoder's own run-to-run noise.
 * Cutting it to 0.064 bits/px was still only 0.09dB, so this rate has room to
 * spare for a hardware encoder that spends its bits less carefully than x264.
 */
const PROXY_BITS_PER_PIXEL = 0.2;
const ASSUMED_FPS = 60;

const buildFailed = (cause: unknown) =>
  createAppError('MEDIA_PROBE_FAILED', '소스 프록시를 만들지 못했습니다.', {
    retryable: true,
    cause,
  });

/**
 * The source time of the proxy's first frame is read back rather than assumed:
 * a transcoder may rebase a trimmed timeline to zero or keep the original
 * timestamps, and the caller's trim arithmetic has to hold either way.
 */
const readTimeOffset = async (blob: Blob, fromSeconds: number) => {
  const input = new Input({formats: ALL_FORMATS, source: new UrlSource(URL.createObjectURL(blob))});

  try {
    const track = await input.getPrimaryVideoTrack();

    return fromSeconds - (track ? await track.getFirstTimestamp() : 0);
  } finally {
    input.dispose();
  }
};

export const createSourceProxyBuilder = (): SourceProxyBuilder => ({
  build: async ({
    url,
    crop,
    fromSeconds,
    toSeconds,
    signal,
  }: SourceProxyRequest): Promise<Result<SourceProxy>> => {
    const startedAt = performance.now();
    const input = new Input({formats: ALL_FORMATS, source: new UrlSource(url)});
    const target = new BufferTarget();
    let abort: (() => void) | null = null;

    try {
      const conversion = await Conversion.init({
        input,
        output: new Output({format: new Mp4OutputFormat(), target}),
        video: {
          crop,
          bitrate: Math.round(
            PROXY_BITS_PER_PIXEL * crop.width * crop.height * ASSUMED_FPS,
          ),
        },
        trim: {start: fromSeconds, end: toSeconds},
      });

      // A dropped track would be a silent content change — most likely the
      // panel's own audio, which the live panel plays. Falling back to the
      // original source is the only safe answer.
      if (!conversion.isValid || conversion.discardedTracks.length > 0) {
        return fail(
          buildFailed(
            new Error(
              `discarded-tracks: ${conversion.discardedTracks
                .map((track) => track.reason)
                .join(',')}`,
            ),
          ),
        );
      }

      abort = () => void conversion.cancel();
      signal.addEventListener('abort', abort);

      await conversion.execute();

      if (!target.buffer) {
        return fail(buildFailed(new Error('empty-output')));
      }

      const blob = new Blob([target.buffer], {type: 'video/mp4'});

      // Goes into the ?debug report, which is how a slow render gets diagnosed
      // here: without it there is no way to tell a proxy that was skipped from
      // one that was built.
      recordLine('info', [
        `Source proxy: ${crop.width}x${crop.height} at ${crop.left},${crop.top}`,
        `${(toSeconds - fromSeconds).toFixed(2)}s`,
        `${(blob.size / 1e6).toFixed(1)}MB`,
        `in ${Math.round(performance.now() - startedAt)}ms`,
      ]);

      return ok({
        url: URL.createObjectURL(blob),
        sourceTimeOffsetSeconds: await readTimeOffset(blob, fromSeconds),
        sizeBytes: blob.size,
      });
    } catch (error) {
      return fail(buildFailed(error));
    } finally {
      if (abort) {
        signal.removeEventListener('abort', abort);
      }

      input.dispose();
    }
  },
});
