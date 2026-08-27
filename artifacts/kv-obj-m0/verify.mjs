// M0 verifier — decodes the spike renders and prints the gate table the
// evidence doc quotes (Design §4.3). ffmpeg from the devDependency binary, so
// it runs in the codec-less container.
//
// Effect placement (spike.tsx) implies these reach bounds at analysis scale:
//   particles: x ∈ [0.28, 0.72], y ∈ [0.42, 0.75]
//   glow:      x ∈ [0.32, 0.68], y ∈ [0.52, 0.73]
// so the isolation bands are y < 0.30 (top) and y > 0.85 (bottom).
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const W = 270;
const H = 480;
const FRAMES = 90;
const PURE_FRAMES = [10, 45, 80];
/** Glow pulse period in frames (spike periodMs 1500 at 30fps). */
const PULSE = 45;

const work = await mkdtemp(join(tmpdir(), 'kv-obj-m0-'));

const decode = async (name) => {
  const raw = join(work, `${name}.gray`);
  await run(ffmpegPath, [
    '-v', 'error', '-i', resolve(here, `out/${name}.webm`),
    '-vf', `scale=${W}:${H},format=gray`,
    '-f', 'rawvideo', '-y', raw,
  ]);
  const bytes = await readFile(raw);
  return (n) => bytes.subarray(n * W * H, (n + 1) * W * H);
};

const decodePng = async (name) => {
  const raw = join(work, `${name}.gray`);
  await run(ffmpegPath, [
    '-v', 'error', '-i', resolve(here, `out/${name}.png`),
    '-vf', `scale=${W}:${H},format=gray`,
    '-f', 'rawvideo', '-y', raw,
  ]);
  return readFile(raw);
};

/** Mean absolute difference inside a fractional window (whole frame default). */
const meanAbsDiff = (a, b, x0 = 0, y0 = 0, x1 = 1, y1 = 1) => {
  let total = 0;
  let count = 0;
  for (let y = Math.floor(y0 * H); y < y1 * H; y += 1) {
    for (let x = Math.floor(x0 * W); x < x1 * W; x += 1) {
      total += Math.abs(a[y * W + x] - b[y * W + x]);
      count += 1;
    }
  }
  return total / count;
};

/** Diff-weighted centroid y (fraction of H) inside a window. */
const diffCentroidY = (a, b, x0, y0, x1, y1) => {
  let total = 0;
  let moment = 0;
  for (let y = Math.floor(y0 * H); y < y1 * H; y += 1) {
    for (let x = Math.floor(x0 * W); x < x1 * W; x += 1) {
      const d = Math.abs(a[y * W + x] - b[y * W + x]);
      total += d;
      moment += d * y;
    }
  }
  return total > 0 ? moment / total / H : Number.NaN;
};

const [a1, a2, off, cam, camoff] = await Promise.all(
  ['a1', 'a2', 'off', 'cam', 'camoff'].map(decode),
);
const timings = JSON.parse(
  await readFile(resolve(here, 'out/timings.json'), 'utf8'),
);

const results = [];
const check = (name, pass, detail) => {
  results.push({name, pass, detail});
};

// ① Determinism — two renders of the same seed, frame for frame.
const hashOf = async (name) =>
  createHash('sha256')
    .update(await readFile(resolve(here, `out/${name}.webm`)))
    .digest('hex');
const [h1, h2] = await Promise.all([hashOf('a1'), hashOf('a2')]);
let detMax = 0;
for (let n = 0; n < FRAMES; n += 1) {
  detMax = Math.max(detMax, meanAbsDiff(a1(n), a2(n)));
}
check(
  '① two renders are frame-identical',
  detMax < 0.3,
  `decoded max diff ${detMax.toFixed(3)}; files ${h1 === h2 ? 'bit-identical' : 'differ (encoder), decoded compared'}`,
);

// Effects are actually visible — a silent no-op layer would pass every
// isolation gate, so presence is checked first.
let presence = 0;
for (let n = 0; n < FRAMES; n += 1) {
  presence += meanAbsDiff(a1(n), off(n), 0.32, 0.52, 0.68, 0.73);
}
presence /= FRAMES;
check('effects visible in the glow window', presence > 2, `mean on/off diff ${presence.toFixed(1)}`);

// ③ Isolation — outside the reach bounds, on/off must match to codec noise.
let bandMax = 0;
for (let n = 0; n < FRAMES; n += 1) {
  bandMax = Math.max(
    bandMax,
    meanAbsDiff(a1(n), off(n), 0, 0, 1, 0.3),
    meanAbsDiff(a1(n), off(n), 0, 0.85, 1, 1),
  );
}
check('③ no change outside the reach bounds', bandMax < 0.8, `band max ${bandMax.toFixed(3)}`);

// ⑤ Pure-function frame (the scrub equivalent) vs the encoded frame.
let pureMax = 0;
for (const n of PURE_FRAMES) {
  const pure = await decodePng(`pure-${n}`);
  pureMax = Math.max(pureMax, meanAbsDiff(pure, a1(n)));
}
check(
  '⑤ standalone draw matches encoded frame',
  pureMax < 3,
  `max diff ${pureMax.toFixed(2)} at f${PURE_FRAMES.join('/f')}`,
);

// ④ Camera follow — the glow centroid must sit where the shared transform
// puts it: y = 0.62 at identity (f0), (0.62 − 0.5) × 1.2 + 0.5 = 0.644 at the
// zoom peak (f44/f45).
const centroidAt = (n) => diffCentroidY(cam(n), camoff(n), 0.3, 0.45, 0.7, 0.85);
const c0 = centroidAt(0);
const cPeak = (centroidAt(44) + centroidAt(45)) / 2;
check(
  '④ glow rides the zoom to the predicted position',
  Math.abs(c0 - 0.62) < 0.025 && Math.abs(cPeak - 0.644) < 0.025 && cPeak - c0 > 0.012,
  `centroid y ${c0.toFixed(3)} (f0, want 0.620) → ${cPeak.toFixed(3)} (peak, want 0.644)`,
);

// Informational — glow pulse repeats with its 45-frame period.
const pulseSeries = Array.from({length: FRAMES}, (_, n) =>
  meanAbsDiff(a1(n), off(n), 0.32, 0.52, 0.68, 0.73),
);
let pulseGap = 0;
for (let n = 0; n + PULSE < FRAMES; n += 1) {
  pulseGap = Math.max(pulseGap, Math.abs(pulseSeries[n] - pulseSeries[n + PULSE]));
}
const swing = Math.max(...pulseSeries) - Math.min(...pulseSeries);
console.log(
  `info  glow pulse — swing ${swing.toFixed(1)}, max |s(f)−s(f+45)| ${pulseGap.toFixed(2)}`,
);

// ② Cost — recorded, not gated here (D-05: the real-device run sets the gate).
const {a1: onMs, off: offMs} = timings.renders;
console.log(
  `info  ② cost — effects on ${onMs}ms vs off ${offMs}ms → +${((onMs - offMs) / FRAMES).toFixed(1)}ms/frame (nativeHtmlInCanvas: ${timings.nativeHtmlInCanvas})`,
);

for (const {name, pass, detail} of results) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}
process.exitCode = results.every((result) => result.pass) ? 0 : 1;
