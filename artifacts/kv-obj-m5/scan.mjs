// kv-object-animation M5, phase 2 — the heavy pass, on the |on−off| domain at
// full resolution. Because the two renders differ only in the effect layer,
// every difference IS the layer (plus codec noise), so per aligned frame pair
// it collects:
//   · SC1: mean + max-16×16-block |diff| outside the reach band — the union of
//     the particle reach box (kvParticlesReach closed form, defaults) and the
//     glow disc at the located centre, swept through the camera's whole scale
//     range [1.0, 1.1] and dilated 16px for codec bleed,
//   · SC3/M4 defaults: the glow pulse — mean signed diff in a camera-tracked
//     annulus around the located centre,
//   · SC4: the diff centroid near the glow — under camera follow it must ride
//     C + s(f)·(c0 − C); a canvas that ignored the camera would hold still,
//   · density/speed: ember blobs. The temporal gate (a pixel's diff moving
//     > 15/frame) separates embers from the halo, whose pulse drifts ≤ ~3/frame.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

import {
  cameraScaleAt,
  pairs,
  SEG_FRAMES,
  SEGS,
  SRC_H,
  SRC_W,
} from './reader.mjs';
import {buildMasks} from './masks.mjs';

const BLOCK = 16;
const EMBER_DIFF = 25; // an ember's added light, over halo/noise
const EMBER_STEP = 15; // per-frame diff movement — the halo drifts ≤ ~3
const AREA_MIN = 2;
const AREA_MAX = 600;

const {onIsA, centers} = JSON.parse(
  readFileSync(new URL('./out/locate.json', import.meta.url), 'utf8'),
);
const A = process.env.KV_OBJ_M5_A ?? new URL('./out/a.mp4', import.meta.url).pathname;
const B = process.env.KV_OBJ_M5_B ?? new URL('./out/b.mp4', import.meta.url).pathname;

const w = SRC_W;
const h = SRC_H;
const px = w * h;
const CX = w / 2;
const CY = h / 2;

// Per-segment static masks. Bit 1 = inside the exclusion band (SC1 judges its
// complement), bit 2 = ember candidate area (particle reach swept + margin).
console.log('building masks…');
const masks = buildMasks(centers);

// Blocks fully outside the band, per segment, for the max-block statistic.
const bw = Math.floor(w / BLOCK);
const bh = Math.floor(h / BLOCK);
const outsideBlocks = masks.map((mask) => {
  const ok = new Uint8Array(bw * bh);
  for (let by = 0; by < bh; by += 1) {
    for (let bx = 0; bx < bw; bx += 1) {
      let outside = true;
      for (let y = by * BLOCK; outside && y < (by + 1) * BLOCK; y += 1) {
        for (let x = bx * BLOCK; x < (bx + 1) * BLOCK; x += 1) {
          if (mask[y * w + x] & 1) {
            outside = false;
            break;
          }
        }
      }
      ok[by * bw + bx] = outside ? 1 : 0;
    }
  }
  return ok;
});

const componentsOf = (candidate) => {
  const blobs = [];
  const stack = [];
  for (let start = 0; start < px; start += 1) {
    if (candidate[start] !== 1) continue;
    candidate[start] = 2;
    stack.length = 0;
    stack.push(start);
    let area = 0;
    let sx = 0;
    let sy = 0;
    let x0 = w;
    let x1 = 0;
    let y0 = h;
    let y1 = 0;
    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      area += 1;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && candidate[i - 1] === 1) {
        candidate[i - 1] = 2;
        stack.push(i - 1);
      }
      if (x < w - 1 && candidate[i + 1] === 1) {
        candidate[i + 1] = 2;
        stack.push(i + 1);
      }
      if (y > 0 && candidate[i - w] === 1) {
        candidate[i - w] = 2;
        stack.push(i - w);
      }
      if (y < h - 1 && candidate[i + w] === 1) {
        candidate[i + w] = 2;
        stack.push(i + w);
      }
    }
    if (area < AREA_MIN || area > AREA_MAX) continue;
    blobs.push({
      x: +(sx / area).toFixed(1),
      y: +(sy / area).toFixed(1),
      area,
      bw: x1 - x0 + 1,
      bh: y1 - y0 + 1,
    });
  }
  return blobs;
};

const diff = new Int16Array(px); // signed on−off
const prevDiff = new Int16Array(px);
const candidate = new Uint8Array(px);
const blockSum = new Float64Array(bw * bh);
const perFrame = [];

for await (const {index, a, b} of pairs(A, B, {})) {
  const on = onIsA ? a : b;
  const off = onIsA ? b : a;
  const seg = Math.min(SEGS - 1, Math.floor(index / SEG_FRAMES));
  const local = index - seg * SEG_FRAMES;
  const mask = masks[seg];
  const s = cameraScaleAt(local);
  const gx = CX + s * (centers[seg].cx * w - CX);
  const gy = CY + s * (centers[seg].cy * h - CY);
  const rAnn0 = 0.06 * w * s;
  const rAnn1 = 0.2 * w * s;
  const rCentroid = 0.24 * w * s;

  let outSum = 0;
  let outN = 0;
  let annSum = 0;
  let annN = 0;
  let discSum = 0;
  let discN = 0;
  let cw = 0;
  let cwx = 0;
  let cwy = 0;
  // Halo-only centroid: the pulse drifts ≤ ~3/frame, embers flicker and move —
  // the temporal gate that finds embers, inverted, isolates the glow (SC4's
  // estimator must not be dragged around by ember phase).
  let hw = 0;
  let hwx = 0;
  let hwy = 0;
  blockSum.fill(0);
  candidate.fill(0);

  for (let i = 0; i < px; i += 1) {
    const d = on[i] - off[i];
    diff[i] = d;
    const ad = d < 0 ? -d : d;
    const m = mask[i];
    if ((m & 1) === 0) {
      outSum += ad;
      outN += 1;
      const x = i % w;
      const y = (i - x) / w;
      const bi = Math.floor(y / BLOCK) * bw + Math.floor(x / BLOCK);
      blockSum[bi] += ad;
    }
    if (
      (m & 2) !== 0 &&
      d > EMBER_DIFF &&
      Math.abs(d - prevDiff[i]) > EMBER_STEP
    ) {
      candidate[i] = 1;
    }
  }

  // Camera-tracked annulus / disc / centroid — bounded loop around the glow.
  const yLo = Math.max(0, Math.floor(gy - rCentroid));
  const yHi = Math.min(h, Math.ceil(gy + rCentroid));
  const xLo = Math.max(0, Math.floor(gx - rCentroid));
  const xHi = Math.min(w, Math.ceil(gx + rCentroid));
  for (let y = yLo; y < yHi; y += 1) {
    for (let x = xLo; x < xHi; x += 1) {
      const r = Math.hypot(x - gx, y - gy);
      if (r > rCentroid) continue;
      const d = diff[y * w + x];
      if (r <= rAnn1) {
        discSum += d;
        discN += 1;
        if (r >= rAnn0) {
          annSum += d;
          annN += 1;
        }
      }
      const wgt = d - 6;
      if (wgt > 0) {
        cw += wgt;
        cwx += wgt * x;
        cwy += wgt * y;
        if (Math.abs(d - prevDiff[y * w + x]) <= 8) {
          hw += wgt;
          hwx += wgt * x;
          hwy += wgt * y;
        }
      }
    }
  }

  let outMaxBlock = 0;
  const okBlocks = outsideBlocks[seg];
  for (let bi = 0; bi < bw * bh; bi += 1) {
    if (okBlocks[bi] === 1) {
      const v = blockSum[bi] / (BLOCK * BLOCK);
      if (v > outMaxBlock) outMaxBlock = v;
    }
  }

  const blobs =
    index === 0 || local === 0 ? [] : componentsOf(candidate);

  perFrame.push({
    f: index,
    seg,
    s: +s.toFixed(4),
    outMean: +(outSum / outN).toFixed(4),
    outMaxBlock: +outMaxBlock.toFixed(3),
    annDiff: +(annSum / annN).toFixed(3),
    discDiff: +(discSum / discN).toFixed(3),
    cx: cw > 0 ? +(cwx / cw).toFixed(1) : null,
    cy: cw > 0 ? +(cwy / cw).toFixed(1) : null,
    cw: Math.round(cw),
    // Cut frames have no valid prevDiff — the halo gate is meaningless there.
    hx: hw > 0 && index > 0 && local !== 0 ? +(hwx / hw).toFixed(1) : null,
    hy: hw > 0 && index > 0 && local !== 0 ? +(hwy / hw).toFixed(1) : null,
    hw: Math.round(hw),
    blobs,
  });
  prevDiff.set(diff);
  if (index % 100 === 0) console.log(`frame ${index}…`);
}

mkdirSync(new URL('./out', import.meta.url), {recursive: true});
writeFileSync(
  new URL('./out/scan.json', import.meta.url),
  JSON.stringify({perFrame}),
);
console.log(`→ out/scan.json (${perFrame.length} frames)`);
