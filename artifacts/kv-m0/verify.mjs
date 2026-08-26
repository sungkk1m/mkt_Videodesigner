// M0 verifier — reads the spike render and prints the pass/fail table the
// evidence doc quotes. Uses the devDependency ffmpeg/ffprobe binaries, so it
// runs in the codec-less container too.
import {execFile} from 'node:child_process';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const video = resolve(here, 'out/kv-m0-blur.webm');
const W = 270;
const H = 480;
const FRAMES = 90;

const work = await mkdtemp(join(tmpdir(), 'kv-m0-'));
await run(ffmpegPath, [
  '-v', 'error', '-i', video,
  '-vf', `scale=${W}:${H},format=gray`,
  '-f', 'rawvideo', '-y', join(work, 'all.gray'),
]);
const raw = await readFile(join(work, 'all.gray'));
const frame = (n) => raw.subarray(n * W * H, (n + 1) * W * H);

const meanAbsDiff = (a, b) => {
  let total = 0;
  for (let index = 0; index < W * H; index += 1) {
    total += Math.abs(a[index] - b[index]);
  }
  return total / (W * H);
};

// Sobel-ish sharpness: mean |horizontal gradient| over the frame.
const edgeEnergy = (img) => {
  let total = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 1; x < W - 1; x += 2) {
      total += Math.abs(img[y * W + x + 1] - img[y * W + x - 1]);
    }
  }
  return total / ((W / 2) * (H / 2));
};

const sampleAt = (img, x, y) => {
  const cx = Math.min(Math.max(x, 0), W - 1.001);
  const cy = Math.min(Math.max(y, 0), H - 1.001);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const dx = cx - x0;
  const dy = cy - y0;
  const i = y0 * W + x0;
  return (
    (img[i] * (1 - dx) + img[i + 1] * dx) * (1 - dy) +
    (img[i + W] * (1 - dx) + img[i + W + 1] * dx) * dy
  );
};

// The scale of `target` relative to `base`, by centred-zoom search.
const bestScale = (base, target) => {
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  let best = null;
  for (let s = 0.95; s <= 1.3001; s += 0.005) {
    let total = 0;
    let count = 0;
    for (let y = Math.floor(H * 0.2); y < H * 0.8; y += 3) {
      for (let x = Math.floor(W * 0.2); x < W * 0.8; x += 3) {
        const d =
          sampleAt(base, cx + (x - cx) / s, cy + (y - cy) / s) -
          target[y * W + x];
        total += d * d;
        count += 1;
      }
    }
    const mse = total / count;
    if (!best || mse < best.mse) {
      best = {scale: s, mse};
    }
  }
  return best;
};

const results = [];
const check = (name, pass, detail) => {
  results.push({name, pass, detail});
};

// 1. Hard cuts at the two hold boundaries, nothing crossfade-shaped inside.
const diffs = Array.from({length: FRAMES - 1}, (_, index) =>
  meanAbsDiff(frame(index), frame(index + 1)),
);
const inHold = diffs.filter((_, index) => ![29, 59].includes(index));
check(
  'cuts at 30/60, no crossfade',
  diffs[29] > 20 && diffs[59] > 20 && Math.max(...inHold) < 10,
  `boundary ${diffs[29].toFixed(1)}/${diffs[59].toFixed(1)}, in-hold max ${Math.max(...inHold).toFixed(1)}`,
);

// 2. Round trip: peak scale at the hold centre, exact return at the end.
const peak = bestScale(frame(31), frame(44));
const back = bestScale(frame(31), frame(59));
const quarterIn = bestScale(frame(31), frame(37));
const quarterOut = bestScale(frame(31), frame(52));
check(
  'round trip peaks at centre and returns',
  peak.scale > 1.15 && Math.abs(back.scale - 1) < 0.02,
  `peak ${peak.scale.toFixed(3)}, end ${back.scale.toFixed(3)}`,
);
check(
  'round trip is symmetric',
  Math.abs(quarterIn.scale - quarterOut.scale) < 0.02,
  `quarter points ${quarterIn.scale.toFixed(3)} vs ${quarterOut.scale.toFixed(3)}`,
);

// 3. Blur bookends: soft at both ends, sharp in the same hold's body. The
// comparison stays inside one segment — the three fixtures carry different
// detail levels, so a cross-image floor would judge content, not blur.
const energies = Array.from({length: FRAMES}, (_, index) =>
  edgeEnergy(frame(index)),
);
const headBody = Math.min(...energies.slice(12, 29));
const tailBody = Math.min(...energies.slice(66, 79));
check(
  'bookends blur both ends only',
  energies[0] < headBody * 0.75 &&
    energies[FRAMES - 1] < tailBody * 0.75 &&
    energies[11] > energies[0] &&
    energies[79] > energies[FRAMES - 1],
  `head ${energies[0].toFixed(1)}(f0) → body ${headBody.toFixed(1)}; tail body ${tailBody.toFixed(1)} → ${energies[FRAMES - 1].toFixed(1)}(f89)`,
);

// 4. FR-R10 — the overscan keeps the canvas colour out of the border.
const first = frame(0);
let ringTotal = 0;
let ringCount = 0;
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    if (x < 3 || x >= W - 3 || y < 3 || y >= H - 3) {
      ringTotal += first[y * W + x];
      ringCount += 1;
    }
  }
}
const ringMean = ringTotal / ringCount;
check('no canvas bleed at the border', ringMean > 40, `ring mean ${ringMean.toFixed(1)} vs canvas ≈13`);

for (const {name, pass, detail} of results) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}
process.exitCode = results.every((result) => result.pass) ? 0 : 1;
