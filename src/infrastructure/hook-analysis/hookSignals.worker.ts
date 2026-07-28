// Design Ref: §2.2 — "Worker: motion, scene, luminance/color scoring". Decoding
// stays on the main thread because only it owns an HTMLVideoElement; the
// per-pixel comparison of the downscaled frames runs here so the editor keeps
// responding while a clip is analysed.
export interface HookSignalRequest {
  /** RGBA bytes of every downscaled sample, in timeline order. */
  frames: ArrayBuffer[];
  timesMs: number[];
  width: number;
  height: number;
}

export interface HookSignalResponse {
  signals: Array<{
    timeMs: number;
    motion: number;
    sceneChange: number;
    visualChange: number;
  }>;
}

/** Above this mean pixel delta a change reads as a cut rather than movement. */
const SCENE_CUT_THRESHOLD = 0.28;

const luminanceOf = (pixels: Uint8ClampedArray) => {
  let total = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    total +=
      0.2126 * (pixels[index] as number) +
      0.7152 * (pixels[index + 1] as number) +
      0.0722 * (pixels[index + 2] as number);
  }

  return total / (pixels.length / 4) / 255;
};

const meanChannels = (pixels: Uint8ClampedArray) => {
  let red = 0;
  let green = 0;
  let blue = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    red += pixels[index] as number;
    green += pixels[index + 1] as number;
    blue += pixels[index + 2] as number;
  }

  const count = pixels.length / 4;

  return [red / count / 255, green / count / 255, blue / count / 255] as const;
};

const meanAbsoluteDelta = (
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray,
) => {
  let total = 0;

  for (let index = 0; index < current.length; index += 4) {
    total +=
      Math.abs((current[index] as number) - (previous[index] as number)) +
      Math.abs(
        (current[index + 1] as number) - (previous[index + 1] as number),
      ) +
      Math.abs((current[index + 2] as number) - (previous[index + 2] as number));
  }

  return total / (current.length / 4) / 3 / 255;
};

export const computeHookSignals = ({
  frames,
  timesMs,
}: HookSignalRequest): HookSignalResponse => {
  const signals: HookSignalResponse['signals'] = [];
  let previous: Uint8ClampedArray | null = null;
  let previousLuminance = 0;
  let previousChannels: readonly [number, number, number] = [0, 0, 0];

  frames.forEach((buffer, index) => {
    const pixels = new Uint8ClampedArray(buffer);
    const luminance = luminanceOf(pixels);
    const channels = meanChannels(pixels);
    const motion = previous ? meanAbsoluteDelta(pixels, previous) : 0;
    const colorShift = previous
      ? (Math.abs(channels[0] - previousChannels[0]) +
          Math.abs(channels[1] - previousChannels[1]) +
          Math.abs(channels[2] - previousChannels[2])) /
        3
      : 0;

    signals.push({
      timeMs: timesMs[index] as number,
      motion: Math.min(1, motion),
      sceneChange: motion > SCENE_CUT_THRESHOLD ? Math.min(1, motion) : 0,
      visualChange: Math.min(
        1,
        Math.abs(luminance - previousLuminance) + colorShift,
      ),
    });

    previous = pixels;
    previousLuminance = luminance;
    previousChannels = channels;
  });

  return {signals};
};

// Guard so the module can also be imported directly by unit tests.
if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = (event: MessageEvent<HookSignalRequest>) => {
    self.postMessage(computeHookSignals(event.data));
  };
}
