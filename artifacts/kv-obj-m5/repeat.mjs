// kv-object-animation M5, phase 3 — the codec-noise control, and SC2's device
// evidence in one pass. Frame f against frame f+450 of the SAME video is a
// pair whose content is exactly identical by design (3 artworks × 2 cycles;
// effects run on segment-local frames, Design §3.4), so any pixel difference
// is H.264 alone — same motion phase, same effects, different GOP. That gives
//   · SC2: the effect layer repeats deterministically on the device render,
//   · SC1's yardstick: the on-vs-off outside-band diff must sit at or below
//     THIS diff at the same segment phase.
// Judged over f ∈ [26, 424] — both sides clear of the head/tail bookend blur.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

import {
  cameraScaleAt,
  frames,
  SEG_FRAMES,
  SEGS,
  SRC_H,
  SRC_W,
} from './reader.mjs';
import {buildMasks} from './masks.mjs';

const CYCLE = 3 * SEG_FRAMES; // 450
const F_LO = 26;
const F_HI = 424;

const {onIsA, centers} = JSON.parse(
  readFileSync(new URL('./out/locate.json', import.meta.url), 'utf8'),
);
const A = process.env.KV_OBJ_M5_A ?? new URL('./out/a.mp4', import.meta.url).pathname;
const B = process.env.KV_OBJ_M5_B ?? new URL('./out/b.mp4', import.meta.url).pathname;
const target = process.argv[2] === 'off' ? 'off' : 'on';
const path = (target === 'on') === onIsA ? A : B;

const w = SRC_W;
const h = SRC_H;
const px = w * h;
const CX = w / 2;
const CY = h / 2;
const masks = buildMasks(centers);

// Same block statistic as scan.mjs, so the control compares block-for-block.
const BLOCK = 16;
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
const blockSum = new Float64Array(bw * bh);

const early = frames(path, {});
const late = frames(path, {});
for (let i = 0; i < CYCLE; i += 1) await late.next(); // advance to f+450

const perFrame = [];
for (;;) {
  const [ra, rb] = [await early.next(), await late.next()];
  if (ra.done || rb.done) break;
  const f = ra.value.index;
  if (f < F_LO) continue;
  if (f > F_HI) {
    await early.return();
    await late.return();
    break;
  }
  const a = ra.value.data;
  const b = rb.value.data;
  const seg = Math.floor(f / SEG_FRAMES);
  const local = f - seg * SEG_FRAMES;
  const mask = masks[seg];
  const s = cameraScaleAt(local);
  const gx = CX + s * (centers[seg].cx * w - CX);
  const gy = CY + s * (centers[seg].cy * h - CY);
  const rAnn1 = 0.2 * w * s;

  let outSum = 0;
  let outN = 0;
  let fullSum = 0;
  blockSum.fill(0);
  for (let i = 0; i < px; i += 1) {
    const d = Math.abs(a[i] - b[i]);
    fullSum += d;
    if ((mask[i] & 1) === 0) {
      outSum += d;
      outN += 1;
      const x = i % w;
      const y = (i - x) / w;
      blockSum[Math.floor(y / BLOCK) * bw + Math.floor(x / BLOCK)] += d;
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
  let discSum = 0;
  let discN = 0;
  const yLo = Math.max(0, Math.floor(gy - rAnn1));
  const yHi = Math.min(h, Math.ceil(gy + rAnn1));
  const xLo = Math.max(0, Math.floor(gx - rAnn1));
  const xHi = Math.min(w, Math.ceil(gx + rAnn1));
  for (let y = yLo; y < yHi; y += 1) {
    for (let x = xLo; x < xHi; x += 1) {
      if (Math.hypot(x - gx, y - gy) > rAnn1) continue;
      discSum += Math.abs(a[y * w + x] - b[y * w + x]);
      discN += 1;
    }
  }
  perFrame.push({
    f,
    seg,
    outMean: +(outSum / outN).toFixed(4),
    outMaxBlock: +outMaxBlock.toFixed(3),
    fullMean: +(fullSum / px).toFixed(4),
    discMean: +(discSum / discN).toFixed(4),
  });
  if (f % 100 === 0) console.log(`frame ${f}…`);
}

mkdirSync(new URL('./out', import.meta.url), {recursive: true});
writeFileSync(
  new URL(`./out/repeat-${target}.json`, import.meta.url),
  JSON.stringify({target, path, perFrame}),
);
console.log(`→ out/repeat-${target}.json (${perFrame.length} pairs)`);
