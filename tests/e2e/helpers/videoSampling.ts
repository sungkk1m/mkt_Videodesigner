// Pixel sampling for E2E assertions made on the rendered MP4 rather than on the
// preview DOM. Extracted from `day1-template.spec.ts` when the Day1 Trim UX cycle
// needed the same tools to correlate a chosen trim point against the output
// (Day1 Trim UX Design §7.2 E2); both specs import from here rather than keeping
// two copies that can drift.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);

export type Rgb = [number, number, number];

export const hexToRgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

export const saturation = ([r, g, b]: Rgb) =>
  Math.max(r, g, b) - Math.min(r, g, b);

/**
 * Index of the palette entry a sampled pixel is closest to.
 *
 * The colour-per-second fixtures make this the whole trick: the colour on screen
 * says *which source second* is being shown, so a trim point can be asserted on
 * the output instead of inferred.
 */
export const nearestPaletteIndex = (pixel: Rgb, palette: readonly string[]) => {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  palette.forEach((hex, index) => {
    const [r, g, b] = hexToRgb(hex);
    const distance =
      (r - pixel[0]) ** 2 + (g - pixel[1]) ** 2 + (b - pixel[2]) ** 2;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
};

/** Two H.264 generations plus 4:2:0 chroma leave this much drift on a flat fill. */
export const CHANNEL_TOLERANCE = 10;

export const probeVideo = async (filePath: string) => {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_name,codec_type,width,height',
    '-of',
    'json',
    filePath,
  ]);

  return JSON.parse(stdout) as {
    format: {duration: string};
    streams: {
      codec_name: string;
      codec_type: string;
      width?: number;
      height?: number;
    }[];
  };
};

/**
 * Every RGB pixel of one region of one output frame.
 *
 * Deliberately unscaled: asking ffmpeg to `scale` a crop down to a few samples
 * uses bilinear taps that reach outside the crop, which silently mixes the
 * divider with the panels either side of it. Averaging here instead keeps the
 * region boundaries exact.
 */
export const sampleRegion = async (
  filePath: string,
  seconds: number,
  crop: {x: number; y: number; width: number; height: number},
): Promise<Rgb[]> => {
  const {stdout} = await execFileAsync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-ss',
      String(seconds),
      '-i',
      filePath,
      '-frames:v',
      '1',
      '-vf',
      `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    {encoding: 'buffer', maxBuffer: 64 * 1024 * 1024},
  );

  const pixels: Rgb[] = [];

  for (let index = 0; index + 2 < stdout.length; index += 3) {
    pixels.push([
      stdout[index] as number,
      stdout[index + 1] as number,
      stdout[index + 2] as number,
    ]);
  }

  return pixels;
};

export const meanRgb = (pixels: Rgb[]): Rgb =>
  [0, 1, 2].map(
    (channel) =>
      pixels.reduce((sum, pixel) => sum + (pixel[channel] as number), 0) /
      pixels.length,
  ) as Rgb;

export const meanSaturation = (pixels: Rgb[]) =>
  pixels.reduce((sum, pixel) => sum + saturation(pixel), 0) / pixels.length;
