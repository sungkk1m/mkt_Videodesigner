// Debug view: draw every detected blob of chosen frames as a magenta box on
// the frame itself, so the eye can judge what the detector is calling an
// ember. Writes out/overlay-<f>.png via ffmpeg.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

import {frames, SRC_H, SRC_W} from './reader.mjs';

const require = createRequire(import.meta.url);
const FFMPEG = require('ffmpeg-static');

const WANT = new Set([45, 105, 165, 225]);
const {perFrame} = JSON.parse(
  readFileSync(new URL('./out/scan.json', import.meta.url), 'utf8'),
);
const byFrame = new Map(perFrame.map((r) => [r.f, r]));

const writePng = (rgb, path) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      FFMPEG,
      ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
       '-s', `${SRC_W}x${SRC_H}`, '-i', 'pipe:0', '-frames:v', '1', '-y', path],
      {stdio: ['pipe', 'inherit', 'inherit']},
    );
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(String(code)))));
    child.stdin.end(rgb);
  });

for await (const {index, data} of frames({pixFmt: 'rgb24'})) {
  if (!WANT.has(index)) {
    if (index > Math.max(...WANT)) break;
    continue;
  }
  const out = Buffer.from(data);
  for (const b of byFrame.get(index).blobs) {
    const half = Math.max(6, Math.ceil(Math.max(b.bw, b.bh) / 2) + 4);
    const x0 = Math.max(0, Math.round(b.x) - half);
    const x1 = Math.min(SRC_W - 1, Math.round(b.x) + half);
    const y0 = Math.max(0, Math.round(b.y) - half);
    const y1 = Math.min(SRC_H - 1, Math.round(b.y) + half);
    for (let x = x0; x <= x1; x += 1) {
      for (const y of [y0, y1]) {
        const i = 3 * (y * SRC_W + x);
        out[i] = 255;
        out[i + 1] = 0;
        out[i + 2] = 255;
      }
    }
    for (let y = y0; y <= y1; y += 1) {
      for (const x of [x0, x1]) {
        const i = 3 * (y * SRC_W + x);
        out[i] = 255;
        out[i + 1] = 0;
        out[i + 2] = 255;
      }
    }
  }
  const path = new URL(`./out/overlay-${index}.png`, import.meta.url).pathname;
  await writePng(out, path);
  console.log(`→ ${path} (${byFrame.get(index).blobs.length} blobs)`);
}
