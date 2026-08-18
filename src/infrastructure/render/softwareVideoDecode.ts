// Render-time video decoding is forced onto Chrome's software decoder.
//
// Measured on the failing machine (Windows Chrome 151, the ?debug trace of
// 2026-08-18): render frames 0-2 cleared in 39/2/1ms, then frame 3 hung for
// 28008ms inside mediabunny's sample iterator — "Added frame at 0.0833sec to
// bank" was the last video event, and the next sample never arrived. At that
// moment 7 decoded VideoFrames were held open: 6 from the 60fps panel source
// inside @remotion/media's keyframe bank (its eviction threshold is
// `timestamp - 0.2s`, so nothing is released this early), plus 1 from the
// frozen panel, plus the sink's read-ahead in flight.
//
// Hardware VideoDecoders hand out frames from a fixed pool; when enough of
// them are held open, decode output stalls by design — the WebCodecs "close
// your frames" rule. The bank's 0.2s window legitimately holds 12 frames of a
// 60fps source, more than this machine's pool, so the render wedges while the
// preview — which closes each frame right after drawing it — plays the same
// file without trouble.
//
// The app cannot shrink the bank and cannot pass decoder options through
// <Video> (verified against @remotion/media 4.0.499 and 4.0.512: zero
// decoderOptions / hardwareAcceleration references on the decode side). What
// it can do is take the fixed pool out of the equation for the duration of a
// render: software decoding allocates frames from memory and cannot wedge
// this way. Preview stays on hardware.

interface DecoderConfig {
  codec: string;
  hardwareAcceleration?: string;
}

interface VideoDecoderLike {
  prototype: {configure: (config: DecoderConfig) => void};
  isConfigSupported: (
    config: DecoderConfig,
  ) => Promise<{supported?: boolean}>;
}

export interface DecoderScope {
  VideoDecoder?: VideoDecoderLike;
}

/**
 * Codec families desktop Chrome always ships a software decoder for (ffmpeg,
 * libvpx, dav1d). HEVC is deliberately absent: its software support is not
 * universal, and a wrong guess would turn a working hardware decode into a
 * refusal — pool exhaustion on an HEVC source stays an open risk instead.
 */
const SOFTWARE_DECODABLE = /^(avc1|avc3|vp8|vp09|av01)/;

let active = 0;
let restore: (() => void) | null = null;

/**
 * Runs `run` with VideoDecoder.configure rewriting eligible configs to
 * `hardwareAcceleration: 'prefer-software'`, then restores the original.
 * If the browser reports no software H.264 decoder, `run` executes unpatched —
 * the status quo, not a new failure mode.
 */
export const withSoftwareVideoDecoding = async <T>(
  run: () => Promise<T>,
  scope: DecoderScope = globalThis as DecoderScope,
): Promise<T> => {
  const decoder = scope.VideoDecoder;
  const supported =
    decoder !== undefined &&
    (await decoder
      .isConfigSupported({
        codec: 'avc1.640028',
        hardwareAcceleration: 'prefer-software',
      })
      .then((result) => result.supported === true)
      .catch(() => false));

  if (!decoder || !supported) {
    return run();
  }

  if (active === 0) {
    const original = decoder.prototype.configure;

    decoder.prototype.configure = function (
      this: unknown,
      config: DecoderConfig,
    ) {
      // An explicit 'prefer-hardware' from a caller is respected; mediabunny
      // never sets one for decoding today, so in practice every H.264/VP8/
      // VP9/AV1 configure during a render lands on the software decoder.
      const eligible =
        SOFTWARE_DECODABLE.test(config.codec) &&
        config.hardwareAcceleration !== 'prefer-hardware';

      return original.call(
        this,
        eligible
          ? {...config, hardwareAcceleration: 'prefer-software'}
          : config,
      );
    };
    restore = () => {
      decoder.prototype.configure = original;
    };
  }

  active += 1;

  try {
    return await run();
  } finally {
    active -= 1;
    if (active === 0) {
      restore?.();
      restore = null;
    }
  }
};
