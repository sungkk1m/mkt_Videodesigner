// kv-object-animation M4, phase 1 — where is the fire in each segment?
//
// Downscaled gray pass accumulating per-segment, per-pixel mean and range.
// The flame core is the one thing that is both bright on average and swings
// hard frame-to-frame (the title text is bright but static), so
// score = mean × range, smoothed, restricted to the visually confirmed
// central band, names the core. The radial profile of temporal std around
// that core is written out too — analyze.mjs reads the halo extent off it.
import {mkdirSync, writeFileSync} from 'node:fs';

import {frames, SEG_FRAMES} from './reader.mjs';

const SCALE = 8; // 135×240 — plenty for a 0.4-wide halo
const SEGS = 8;

const w = 1080 / SCALE;
const h = 1920 / SCALE;
const px = w * h;

const sum = Array.from({length: SEGS}, () => new Float64Array(px));
const sumSq = Array.from({length: SEGS}, () => new Float64Array(px));
const min = Array.from({length: SEGS}, () => new Float64Array(px).fill(255));
const max = Array.from({length: SEGS}, () => new Float64Array(px));
const counts = new Array(SEGS).fill(0);

for await (const {index, data} of frames({pixFmt: 'gray', scale: SCALE})) {
  const seg = Math.floor(index / SEG_FRAMES);
  // The opening ~16 frames are the blur/darkness ramp (reference-measurement
  // §1) and the last ~4 frames dim out — both would poison the statistics.
  if (index < 18 || index >= 476) continue;
  const s = sum[seg];
  const q = sumSq[seg];
  const lo = min[seg];
  const hi = max[seg];
  for (let i = 0; i < px; i += 1) {
    const v = data[i];
    s[i] += v;
    q[i] += v * v;
    if (v < lo[i]) lo[i] = v;
    if (v > hi[i]) hi[i] = v;
  }
  counts[seg] += 1;
}

const centers = [];
for (let seg = 0; seg < SEGS; seg += 1) {
  const n = counts[seg];
  // Fire sits at ≈(0.5, 0.74) on every artwork (frames 30/90/150/210
  // eyeballed) — restrict the argmax tightly so the camera breathing on
  // high-contrast character edges (the winter snowman) can't win.
  let best = -1;
  let bestI = 0;
  for (let y = Math.floor(0.68 * h); y < Math.floor(0.82 * h); y += 1) {
    for (let x = Math.floor(0.40 * w); x < Math.floor(0.62 * w); x += 1) {
      // 3×3 smoothing of mean×range.
      let score = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const i = (y + dy) * w + (x + dx);
          score += (sum[seg][i] / n) * (max[seg][i] - min[seg][i]);
        }
      }
      if (score > best) {
        best = score;
        bestI = y * w + x;
      }
    }
  }
  const cx = (bestI % w) / w;
  const cy = Math.floor(bestI / w) / h;

  // Radial profile of temporal std, 40 bins out to half the frame width.
  const bins = 40;
  const binR = 0.5 / bins; // in width fractions
  const acc = new Float64Array(bins);
  const cnt = new Float64Array(bins);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const dx = x / w - cx;
      const dy = (y / h - cy) * (1920 / 1080); // px-true distance, width units
      const r = Math.hypot(dx, dy);
      const bin = Math.floor(r / binR);
      if (bin >= bins) continue;
      const mean = sum[seg][i] / n;
      const varr = sumSq[seg][i] / n - mean * mean;
      acc[bin] += Math.sqrt(Math.max(0, varr));
      cnt[bin] += 1;
    }
  }
  const profile = Array.from(acc, (v, b) => +(v / Math.max(1, cnt[b])).toFixed(3));

  centers.push({seg, cx: +cx.toFixed(4), cy: +cy.toFixed(4), stdProfile: profile});
  console.log(`seg${seg}: fire ≈ (${cx.toFixed(3)}, ${cy.toFixed(3)})`);
}

mkdirSync(new URL('./out', import.meta.url), {recursive: true});
writeFileSync(
  new URL('./out/locate.json', import.meta.url),
  JSON.stringify({scale: SCALE, centers}, null, 1),
);
console.log('→ out/locate.json');
