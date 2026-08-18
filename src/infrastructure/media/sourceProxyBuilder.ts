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

/**
 * Bits per pixel per frame for the proxy, assuming a 60fps source — a 30fps one
 * simply gets twice the headroom.
 *
 * The source measured on 2026-08-18 carried 0.064 bits/px (1242x2208, 60fps,
 * 10.6Mbps), and the render's own H.264 pass is 5.7Mbps at 1080x1920/60. Feeding
 * the render a proxy at that rate was measured against the current path, both
 * scored on a lossless reference: the extra encode generation cost 0.009dB of
 * PSNR-Y, and even a deliberately crippled encoder at 0.064 bits/px only cost
 * 0.09dB — two orders of magnitude below the 0.5dB just-noticeable threshold.
 *
 * This is a target, not a promise: asked for 0.1, the hardware encoder delivered
 * 0.069 in the live render (4.3MB for a 6s 1242x1100 crop), landing at the bottom
 * of that measured range instead of the middle. 0.15 is the same margin restated
 * for an encoder that undershoots by a third, and still asks less than the config
 * this machine once refused outright (day1-render-hwaccel.analysis.md §1.1).
 */
const PROXY_BITS_PER_PIXEL = 0.15;
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
  const url = URL.createObjectURL(blob);
  const input = new Input({formats: ALL_FORMATS, source: new UrlSource(url)});

  try {
    const track = await input.getPrimaryVideoTrack();

    return fromSeconds - (track ? await track.getFirstTimestamp() : 0);
  } finally {
    input.dispose();
    URL.revokeObjectURL(url);
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
        showWarnings: false,
      });

      // A dropped track would be a silent content change — most likely the
      // panel's own audio, which the live panel plays. Its reason is also the one
      // place mediabunny reports an encoder that refused the config, so it is
      // carried out to the caller rather than collapsed into "failed".
      if (!conversion.isValid || conversion.discardedTracks.length > 0) {
        return fail(
          buildFailed(
            new Error(
              conversion.discardedTracks
                .map((track) => `${track.track.type} track: ${track.reason}`)
                .join('; ') || 'conversion reported itself invalid',
            ),
          ),
        );
      }

      abort = () => void conversion.cancel();
      signal.addEventListener('abort', abort);

      await conversion.execute();

      if (!target.buffer) {
        return fail(buildFailed(new Error('empty output')));
      }

      const blob = new Blob([target.buffer], {type: 'video/mp4'});

      return ok({
        url: URL.createObjectURL(blob),
        sourceTimeOffsetSeconds: await readTimeOffset(blob, fromSeconds),
        sizeBytes: blob.size,
        elapsedMs: Math.round(performance.now() - startedAt),
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
