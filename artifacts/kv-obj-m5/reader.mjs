// kv-object-animation M5 — raw-frame reader for the two real-device renders
// (effects on / off). Same streaming shape as the M4 reader, parameterised by
// path because this pass always reads two files in lockstep.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const FFMPEG = require('ffmpeg-static');

/** Render geometry — the product path (verified with ffmpeg -i before analysis). */
export const SRC_W = 1080;
export const SRC_H = 1920;
export const FPS = 60;
export const FRAMES = 900;
export const SEG_FRAMES = 150; // 3 artworks × 2 cycles over 15s
export const SEGS = 6;

/** Head/tail bookend blur (333ms @60fps) — a global filter that smears the
 * effect light past its reach box, so SC1's band excludes these frames. */
export const HEAD_BLUR_END = 26;
export const TAIL_BLUR_START = 874;

/**
 * The camera's scale at a segment-local frame, from the shipped default motion
 * (round trip to 1.10, easeInOut cubic, peak at the hold's exact centre).
 * Validated against the previous cycle's device measurement:
 * +38→1.050, +74→1.100, +112→1.046 (kv-loop-reference-motion.m4-render-verification §2).
 */
export const cameraScaleAt = (local) => {
  const last = SEG_FRAMES - 1;
  const half = last / 2;
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const p =
    local <= half
      ? easeInOutCubic(local / half)
      : 1 - easeInOutCubic((local - half) / half);
  return 1 / (1 - p * (1 - 1 / 1.1));
};

/** Async generator of {index, data} frames for one file. */
export async function* frames(path, {pixFmt = 'gray', scale = 1} = {}) {
  const w = SRC_W / scale;
  const h = SRC_H / scale;
  const bpp = pixFmt === 'rgb24' ? 3 : 1;
  const frameSize = w * h * bpp;
  const args = [
    '-v', 'error',
    '-i', path,
    ...(scale === 1 ? [] : ['-vf', `scale=${w}:${h}:flags=area`]),
    '-f', 'rawvideo',
    '-pix_fmt', pixFmt,
    'pipe:1',
  ];
  const child = spawn(FFMPEG, args, {stdio: ['ignore', 'pipe', 'inherit']});

  // A consumer that stops early (repeat/zoomcurve read a slice) must not leave
  // the decoder blocked on a full pipe — the process would never exit.
  try {
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
  } finally {
    child.kill('SIGKILL');
  }
}

/** Zips two frame streams — pull-based, so decode stays in lockstep. */
export async function* pairs(pathA, pathB, opts) {
  const a = frames(pathA, opts);
  const b = frames(pathB, opts);
  for (;;) {
    const [ra, rb] = [await a.next(), await b.next()];
    if (ra.done || rb.done) return;
    yield {index: ra.value.index, a: ra.value.data, b: rb.value.data, w: ra.value.w, h: ra.value.h};
  }
}
