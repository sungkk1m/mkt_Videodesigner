// kv-object-animation M5, phase 1 — which render is "effects on", and where
// the operator dragged each artwork's glow centre (runbook §2 moves only the
// centre; every other value is the M4 default).
//
// Works on the |on−off| difference, which is the effect layer itself plus
// codec noise — none of M4's ember-vs-artwork discrimination is needed. Per
// segment the early-hold frames (camera ≈ 1.0) are accumulated in DE-SCALED
// canvas coordinates (each pixel binned back through the model camera scale),
// then box-blurred; the peak is the glow centre — a 0.18W radial gradient
// survives a 16px blur, 6px ember dots do not.
import {mkdirSync, writeFileSync} from 'node:fs';

import {cameraScaleAt, HEAD_BLUR_END, pairs, SEG_FRAMES, SEGS} from './reader.mjs';

const SCALE = 2; // 540×960 — centre detection needs no full resolution
const DIFF_MIN = 8; // below is codec noise, not effect light
const BLUR_R = 8; // half-res px — kills ember dots, keeps the halo blob

const A = process.env.KV_OBJ_M5_A ?? new URL('./out/a.mp4', import.meta.url).pathname;
const B = process.env.KV_OBJ_M5_B ?? new URL('./out/b.mp4', import.meta.url).pathname;

// Early-hold accumulation windows (segment-local): camera ≤ ~1.01, and clear
// of the head bookend blur on segment 0.
const windowOf = (seg) => (seg === 0 ? [26, 40] : [3, 20]);

let w = 0;
let h = 0;
let px = 0;
let acc = null; // SEGS × px Float32 — de-scaled |a−b|
let lumaA = 0;
let lumaB = 0;
let discN = 0;
const meanDiffPerFrame = [];

for await (const {index, a, b, w: fw, h: fh} of pairs(A, B, {scale: SCALE})) {
  if (acc === null) {
    w = fw;
    h = fh;
    px = w * h;
    acc = Array.from({length: SEGS}, () => new Float32Array(px));
  }
  const seg = Math.min(SEGS - 1, Math.floor(index / SEG_FRAMES));
  const local = index - seg * SEG_FRAMES;
  let sum = 0;
  for (let i = 0; i < px; i += 1) sum += Math.abs(a[i] - b[i]);
  meanDiffPerFrame.push(+(sum / px).toFixed(3));

  const [lo, hi] = windowOf(seg);
  if (local < lo || local > hi || index < HEAD_BLUR_END) continue;

  const s = cameraScaleAt(local);
  const cx = w / 2;
  const cy = h / 2;
  const target = acc[seg];
  for (let i = 0; i < px; i += 1) {
    const d = Math.abs(a[i] - b[i]);
    if (d < DIFF_MIN) continue;
    const x = i % w;
    const y = (i - x) / w;
    // De-scale: where this pixel sits on the untransformed effect canvas.
    const ux = Math.round(cx + (x - cx) / s);
    const uy = Math.round(cy + (y - cy) / s);
    if (ux < 0 || ux >= w || uy < 0 || uy >= h) continue;
    target[uy * w + ux] += d;
    lumaA += a[i];
    lumaB += b[i];
    discN += 1;
  }
  if (index % 150 === 0) console.log(`frame ${index}…`);
}

// Box blur (two-pass separable) then peak + local centroid per segment.
const blur = (src) => {
  const tmp = new Float32Array(px);
  const dst = new Float32Array(px);
  const r = BLUR_R;
  for (let y = 0; y < h; y += 1) {
    let s = 0;
    for (let x = -r; x <= r; x += 1) s += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x += 1) {
      tmp[y * w + x] = s;
      const add = Math.min(w - 1, x + r + 1);
      const sub = Math.max(0, x - r);
      s += src[y * w + add] - src[y * w + sub];
    }
  }
  for (let x = 0; x < w; x += 1) {
    let s = 0;
    for (let y = -r; y <= r; y += 1) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y += 1) {
      dst[y * w + x] = s;
      const add = Math.min(h - 1, y + r + 1);
      const sub = Math.max(0, y - r);
      s += tmp[add * w + x] - tmp[sub * w + x];
    }
  }
  return dst;
};

const centers = [];
for (let seg = 0; seg < SEGS; seg += 1) {
  const smooth = blur(acc[seg]);
  let peakI = 0;
  for (let i = 1; i < px; i += 1) if (smooth[i] > smooth[peakI]) peakI = i;
  const pxX = peakI % w;
  const pxY = (peakI - pxX) / w;
  // Sub-peak centroid within the halo's own radius.
  const R = Math.round(0.2 * w);
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (let y = Math.max(0, pxY - R); y < Math.min(h, pxY + R); y += 1) {
    for (let x = Math.max(0, pxX - R); x < Math.min(w, pxX + R); x += 1) {
      const v = acc[seg][y * w + x];
      if (v <= 0) continue;
      sw += v;
      sx += v * x;
      sy += v * y;
    }
  }
  centers.push({
    seg,
    cx: +(sx / sw / w).toFixed(4),
    cy: +(sy / sw / h).toFixed(4),
    peak: +(smooth[peakI] / (2 * BLUR_R + 1) ** 2).toFixed(2),
  });
}

// Which file is ON: inside the accumulated effect areas, the brighter one.
const onIsA = lumaA > lumaB;
const result = {
  files: {a: A, b: B},
  onIsA,
  on: onIsA ? A : B,
  off: onIsA ? B : A,
  discLuma: {a: +(lumaA / discN).toFixed(2), b: +(lumaB / discN).toFixed(2)},
  centers,
  meanDiffPerFrame,
};

mkdirSync(new URL('./out', import.meta.url), {recursive: true});
writeFileSync(new URL('./out/locate.json', import.meta.url), JSON.stringify(result));
console.log(JSON.stringify({onIsA, discLuma: result.discLuma, centers}, null, 1));
console.log('→ out/locate.json');
