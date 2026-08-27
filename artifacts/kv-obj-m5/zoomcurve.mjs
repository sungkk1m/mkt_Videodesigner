// kv-object-animation M5, phase 4 — SC6's device corroboration: the effects-off
// render must still drive the camera the previous cycle measured
// (kv-loop-reference-motion.m4-render-verification §2: +38→1.050, +74→1.100,
// +112→1.046). Scale search per probe frame against the segment's own +1
// baseline, bilinear resampling over a central window, like that cycle's
// method. Also validates cameraScaleAt(), which the SC4 prediction uses.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

import {cameraScaleAt, frames, SEG_FRAMES} from './reader.mjs';

const SCALE = 2; // 540×960
const PROBES = [1, 38, 74, 112, 149];
const SEGS_TO_PROBE = [1, 2, 4];

const {onIsA} = JSON.parse(
  readFileSync(new URL('./out/locate.json', import.meta.url), 'utf8'),
);
const A = process.env.KV_OBJ_M5_A ?? new URL('./out/a.mp4', import.meta.url).pathname;
const B = process.env.KV_OBJ_M5_B ?? new URL('./out/b.mp4', import.meta.url).pathname;
const path = onIsA ? B : A; // the effects-off render

const wanted = new Set();
for (const seg of SEGS_TO_PROBE) {
  for (const p of PROBES) wanted.add(seg * SEG_FRAMES + p);
}

const grabbed = new Map();
let w = 0;
let h = 0;
for await (const {index, data, w: fw, h: fh} of frames(path, {scale: SCALE})) {
  if (wanted.has(index)) {
    grabbed.set(index, Buffer.from(data));
    w = fw;
    h = fh;
  }
  if (index > Math.max(...wanted)) break;
}

const CX = w / 2;
const CY = h / 2;
const sample = (buf, x, y) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * w + x0;
  return (
    buf[i] * (1 - fx) * (1 - fy) +
    buf[i + 1] * fx * (1 - fy) +
    buf[i + w] * (1 - fx) * fy +
    buf[i + w + 1] * fx * fy
  );
};

// RMS between probe and the baseline resampled at relative scale s, over a
// central window (clear of the blurred backdrop bars and title overlay edges).
const rmsAt = (probe, base, s) => {
  let sum = 0;
  let n = 0;
  for (let y = Math.round(0.28 * h); y < 0.75 * h; y += 2) {
    for (let x = Math.round(0.2 * w); x < 0.8 * w; x += 2) {
      const ux = CX + (x - CX) / s;
      const uy = CY + (y - CY) / s;
      if (ux < 1 || ux >= w - 2 || uy < 1 || uy >= h - 2) continue;
      const d = probe[y * w + x] - sample(base, ux, uy);
      sum += d * d;
      n += 1;
    }
  }
  return Math.sqrt(sum / n);
};

const rows = [];
for (const seg of SEGS_TO_PROBE) {
  const base = grabbed.get(seg * SEG_FRAMES + 1);
  const sBase = cameraScaleAt(1);
  for (const p of PROBES) {
    const probe = grabbed.get(seg * SEG_FRAMES + p);
    let best = {s: 1, rms: Infinity};
    for (let s = 0.985; s <= 1.125; s += 0.0025) {
      const rms = rmsAt(probe, base, s);
      if (rms < best.rms) best = {s, rms};
    }
    // Refine around the winner.
    for (let s = best.s - 0.002; s <= best.s + 0.002; s += 0.0005) {
      const rms = rmsAt(probe, base, s);
      if (rms < best.rms) best = {s, rms};
    }
    rows.push({
      seg,
      local: p,
      measured: +(best.s * sBase).toFixed(4),
      model: +cameraScaleAt(p).toFixed(4),
      rms: +best.rms.toFixed(2),
    });
  }
}

console.table(rows);
mkdirSync(new URL('./out', import.meta.url), {recursive: true});
writeFileSync(
  new URL('./out/zoomcurve.json', import.meta.url),
  JSON.stringify({path, rows}),
);
console.log('→ out/zoomcurve.json');
