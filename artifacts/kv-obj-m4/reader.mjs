// kv-object-animation M4 — shared raw-frame reader for the reference mp4.
// Streams rawvideo frames out of the bundled ffmpeg so the analysis scripts
// never hold more than a frame or two in memory.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const FFMPEG = require('ffmpeg-static');

export const REF =
  process.env.KV_OBJ_M4_REF ??
  new URL('./out/reference.mp4', import.meta.url).pathname;

/** Reference geometry, verified by ffprobe before analysis. */
export const SRC_W = 1080;
export const SRC_H = 1920;
export const FPS = 30;
export const FRAMES = 480;
export const SEG_FRAMES = 60; // hard cuts at n = 60k (reference-measurement §1)

/**
 * Async generator of {index, data} frames. `pixFmt` is 'gray' (1 byte/px) or
 * 'rgb24' (3 bytes/px); `scale` divides both axes before delivery.
 */
export async function* frames({pixFmt = 'gray', scale = 1} = {}) {
  const w = SRC_W / scale;
  const h = SRC_H / scale;
  const bpp = pixFmt === 'rgb24' ? 3 : 1;
  const frameSize = w * h * bpp;
  const args = [
    '-v', 'error',
    '-i', REF,
    ...(scale === 1 ? [] : ['-vf', `scale=${w}:${h}:flags=area`]),
    '-f', 'rawvideo',
    '-pix_fmt', pixFmt,
    'pipe:1',
  ];
  const child = spawn(FFMPEG, args, {stdio: ['ignore', 'pipe', 'inherit']});

  let pending = [];
  let pendingBytes = 0;
  let index = 0;

  for await (const chunk of child.stdout) {
    pending.push(chunk);
    pendingBytes += chunk.length;
    while (pendingBytes >= frameSize) {
      const buf = Buffer.concat(pending, pendingBytes);
      yield {index, data: buf.subarray(0, frameSize), w, h};
      index += 1;
      const rest = buf.subarray(frameSize);
      pending = rest.length > 0 ? [rest] : [];
      pendingBytes = rest.length;
    }
  }
}

export const lumaOf = (rgb, offset) =>
  (77 * rgb[offset] + 150 * rgb[offset + 1] + 29 * rgb[offset + 2]) >> 8;
