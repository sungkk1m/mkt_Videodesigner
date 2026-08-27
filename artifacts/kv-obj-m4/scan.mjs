// kv-object-animation M4, phase 2 — the heavy pass. Full-resolution rgb24
// stream; per frame it collects
//   · the glow series: mean luma of an annulus around the segment's fire
//     (locate.json) — the halo pulse lives here, the flame core is masked out,
//   · particle blobs: pixels that are bright, moved frame-to-frame AND are
//     saturated in colour. The probe (probe.mjs) showed the discriminator:
//     embers are coloured (chroma 46-85) while the title strokes and snowman
//     edges the camera breathing wiggles are near-neutral (chroma ≤ 10).
// Output is raw series + blobs; analyze.mjs turns them into numbers.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

import {frames, lumaOf, SEG_FRAMES, SRC_H, SRC_W} from './reader.mjs';

const BRIGHT = 90; // 0-255 luma — embers are lights on dark artwork
const MOVED = 45; // breathing shifts edges ≤ ~0.3px/frame; particles jump px
const CHROMA = 24; // max(rgb)-min(rgb) — embers are coloured, edges neutral
const AREA_MIN = 2;
const AREA_MAX = 600; // anything bigger is flame, not ember
const BAND_MAX_Y = 0.82; // below sits ground / the hell artwork's baked blaze
const CORE_R = 0.09; // width fractions — flame core exclusion around the fire
const CORE_STRETCH = 2; // flames are tall: the exclusion is a vertical ellipse
const ANNULUS_R0 = 0.045;
const ANNULUS_R1 = 0.22;

const {centers} = JSON.parse(
  readFileSync(new URL('./out/locate.json', import.meta.url), 'utf8'),
);

const w = SRC_W;
const h = SRC_H;
const px = w * h;
const aspect = h / w;

// Per-segment pixel masks, bitwise: 1 = in glow annulus, 2 = in flame core
// (excluded from particle candidates; the annulus is NOT — embers rise right
// through it).
const masks = centers.map(({cx, cy}) => {
  const mask = new Uint8Array(px);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x / w - cx;
      const dy = (y / h - cy) * aspect;
      const r = Math.hypot(dx, dy);
      let m = 0;
      if (r >= ANNULUS_R0 && r <= ANNULUS_R1) m |= 1;
      if (Math.hypot(dx, dy / CORE_STRETCH) < CORE_R) m |= 2;
      mask[y * w + x] = m;
    }
  }
  return mask;
});

const prev = new Uint8Array(px);
const luma = new Uint8Array(px);
const perFrame = [];

const componentsOf = (candidate, rgb) => {
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
    let peak = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
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
      if (luma[i] > peak) peak = luma[i];
      sr += rgb[3 * i];
      sg += rgb[3 * i + 1];
      sb += rgb[3 * i + 2];
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
      peak,
      bw: x1 - x0 + 1,
      bh: y1 - y0 + 1,
      rgb: [
        Math.round(sr / area),
        Math.round(sg / area),
        Math.round(sb / area),
      ],
    });
  }
  return blobs;
};

const candidate = new Uint8Array(px);
const bandMax = Math.floor(BAND_MAX_Y * h);

for await (const {index, data} of frames({pixFmt: 'rgb24'})) {
  const seg = Math.min(7, Math.floor(index / SEG_FRAMES));
  const mask = masks[seg];

  let annulusSum = 0;
  let annulusN = 0;
  let coreSum = 0;
  let coreN = 0;
  candidate.fill(0);
  for (let i = 0; i < px; i += 1) {
    const v = lumaOf(data, 3 * i);
    luma[i] = v;
    if (mask[i] & 1) {
      annulusSum += v;
      annulusN += 1;
    }
    if (mask[i] & 2) {
      coreSum += v;
      coreN += 1;
    }
    if (
      v > BRIGHT &&
      (mask[i] & 2) === 0 &&
      i < bandMax * w &&
      Math.abs(v - prev[i]) > MOVED
    ) {
      const r = data[3 * i];
      const g = data[3 * i + 1];
      const b = data[3 * i + 2];
      if (
        Math.max(r, g, b) - Math.min(r, g, b) >= CHROMA
      ) {
        candidate[i] = 1;
      }
    }
  }

  // The first frame has no predecessor — its diffs are the frame itself.
  const blobs = index === 0 ? [] : componentsOf(candidate, data);

  perFrame.push({
    f: index,
    seg,
    annulus: +(annulusSum / annulusN).toFixed(3),
    core: +(coreSum / coreN).toFixed(3),
    blobs,
  });
  prev.set(luma);
  if (index % 60 === 0) console.log(`frame ${index}…`);
}

mkdirSync(new URL('./out', import.meta.url), {recursive: true});
writeFileSync(
  new URL('./out/scan.json', import.meta.url),
  JSON.stringify({perFrame}),
);
console.log(`→ out/scan.json (${perFrame.length} frames)`);
