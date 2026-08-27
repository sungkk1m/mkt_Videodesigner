// kv-object-animation M5, phase 5 — scan/repeat/zoomcurve JSON → the SC
// verdict numbers. No pixels here, just series.
//
//   SC1 : outside-band |on−off| against the same-phase cycle-repeat control —
//         the control IS the codec noise of identical content, so "≤ codec
//         noise" is a measured bound, not a chosen threshold.
//   SC2 : the cycle-repeat diff of the ON render inside the effect disc vs the
//         OFF render's — nondeterministic embers would blow the former up.
//   SC3 : glow pulse fit (period grid least squares, M4's method) — period and
//         phase must land on the closed form kvGlowOpacityAt evaluates.
//   SC4 : diff-centroid displacement between camera apex and rest vs the
//         prediction C + s·(c0 − C), against the static-canvas null.
//   SC5 : the renderer's own timings, from the two ?debug=1 logs.
//   defaults check: tracked ember count / diameter / rise speed vs the M4
//         calibration targets.
import {readFileSync, writeFileSync} from 'node:fs';

import {
  cameraScaleAt,
  FPS,
  HEAD_BLUR_END,
  SEG_FRAMES,
  SEGS,
  SRC_H,
  SRC_W,
  TAIL_BLUR_START,
} from './reader.mjs';

const read = (name) =>
  JSON.parse(readFileSync(new URL(`./out/${name}`, import.meta.url), 'utf8'));
const {perFrame} = read('scan.json');
const repeatOn = read('repeat-on.json').perFrame;
const repeatOff = read('repeat-off.json').perFrame;
const {centers} = read('locate.json');
const zoom = read('zoomcurve.json').rows;

const median = (arr) => {
  if (arr.length === 0) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const quantile = (arr, q) => {
  if (arr.length === 0) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const r3 = (v) => +(+v).toFixed(3);

const body = perFrame.filter(
  (r) => r.f >= HEAD_BLUR_END && r.f < TAIL_BLUR_START,
);

// ------------------------------------------------------- SC1, phase-matched
// The camera's speed drives the codec noise, so compare per local-phase
// bucket: on-vs-off outside diff against the cycle-repeat control at the
// same phase. Control frames exist for local 26..149 (seg 0) and 0..149
// (segs 1, 2); scan frames cover all six segments.
const BUCKET = 10;
const bucketOf = (f) => Math.floor((f % SEG_FRAMES) / BUCKET) * BUCKET;
const phases = [];
for (let b = 0; b < SEG_FRAMES; b += BUCKET) {
  const scanRows = body.filter((r) => bucketOf(r.f) === b);
  const ctrlRows = [...repeatOn, ...repeatOff].filter(
    (r) => bucketOf(r.f) === b,
  );
  phases.push({
    local: b,
    scanOutMean: r3(median(scanRows.map((r) => r.outMean))),
    ctrlOutMean: r3(median(ctrlRows.map((r) => r.outMean))),
    scanOutMaxBlock: r3(quantile(scanRows.map((r) => r.outMaxBlock), 0.95)),
    ctrlOutMaxBlock: r3(quantile(ctrlRows.map((r) => r.outMaxBlock), 0.95)),
  });
}
const sc1 = {
  phases,
  scanOutMeanMax: r3(Math.max(...body.map((r) => r.outMean))),
  ctrlOutMeanMax: r3(
    Math.max(...[...repeatOn, ...repeatOff].map((r) => r.outMean)),
  ),
  scanOutMaxBlockMax: r3(Math.max(...body.map((r) => r.outMaxBlock))),
  ctrlOutMaxBlockMax: r3(
    Math.max(...[...repeatOn, ...repeatOff].map((r) => r.outMaxBlock)),
  ),
  pass: phases.every(
    (p) =>
      p.scanOutMean <= p.ctrlOutMean * 1.25 + 0.05 &&
      p.scanOutMaxBlock <= p.ctrlOutMaxBlock * 1.3 + 0.3,
  ),
};

// ------------------------------------------------------------------- SC2
// Same-phase pairs 450 frames apart: identical content by design. If embers
// were re-rolled per cycle the ON disc diff would carry their light; instead
// it must sit at the OFF render's own codec level.
const discOn = repeatOn.map((r) => r.discMean);
const discOff = repeatOff.map((r) => r.discMean);
const sc2 = {
  on: {
    outMed: r3(median(repeatOn.map((r) => r.outMean))),
    discMed: r3(median(discOn)),
    discP95: r3(quantile(discOn, 0.95)),
    fullMed: r3(median(repeatOn.map((r) => r.fullMean))),
  },
  off: {
    outMed: r3(median(repeatOff.map((r) => r.outMean))),
    discMed: r3(median(discOff)),
    discP95: r3(quantile(discOff, 0.95)),
    fullMed: r3(median(repeatOff.map((r) => r.fullMean))),
  },
  centerRepeatDelta: [0, 1, 2].map((k) =>
    r3(
      Math.hypot(
        (centers[k].cx - centers[k + 3].cx) * SRC_W,
        (centers[k].cy - centers[k + 3].cy) * SRC_H,
      ),
    ),
  ),
  pass: median(discOn) <= median(discOff) * 1.35 + 0.3,
};

// ------------------------------------------------- SC3 support — glow pulse
// Least-squares a + b·t + c·sin + d·cos over a period grid (M4's fit) on the
// annulus diff series. kvGlowOpacityAt is a pure +sin of the segment-local
// clock, so the fitted phase must sit at 0° and the period at 1300ms.
const fitSine = (t, y) => {
  const n = y.length;
  let best = null;
  for (let period = 40; period <= 140; period += 0.25) {
    const om = (2 * Math.PI) / period;
    const cols = [
      t.map(() => 1),
      t,
      t.map((v) => Math.sin(om * v)),
      t.map((v) => Math.cos(om * v)),
    ];
    const A = Array.from({length: 4}, () => new Float64Array(5));
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        A[i][j] = cols[i].reduce((a, v, k) => a + v * cols[j][k], 0);
      }
      A[i][4] = cols[i].reduce((a, v, k) => a + v * y[k], 0);
    }
    for (let i = 0; i < 4; i += 1) {
      const p = A[i][i];
      for (let j = i + 1; j < 4; j += 1) {
        const m = A[j][i] / p;
        for (let k = i; k < 5; k += 1) A[j][k] -= m * A[i][k];
      }
    }
    const x = new Float64Array(4);
    for (let i = 3; i >= 0; i -= 1) {
      let v = A[i][4];
      for (let j = i + 1; j < 4; j += 1) v -= A[i][j] * x[j];
      x[i] = v / A[i][i];
    }
    let rss = 0;
    for (let k = 0; k < n; k += 1) {
      const fit = x[0] + x[1] * t[k] + x[2] * cols[2][k] + x[3] * cols[3][k];
      rss += (y[k] - fit) ** 2;
    }
    if (!best || rss < best.rss) {
      best = {
        rss,
        period,
        amp: Math.hypot(x[2], x[3]),
        phaseDeg: Math.round((Math.atan2(x[3], x[2]) * 180) / Math.PI),
      };
    }
  }
  return best;
};

const glow = [];
for (let seg = 0; seg < SEGS; seg += 1) {
  const rows = body.filter((r) => r.seg === seg);
  const fit = fitSine(
    rows.map((r) => r.f - seg * SEG_FRAMES),
    rows.map((r) => r.annDiff),
  );
  glow.push({
    seg,
    periodMs: Math.round((fit.period / FPS) * 1000),
    phaseDeg: fit.phaseDeg,
    amp: r3(fit.amp),
    discDiffMed: r3(median(rows.map((r) => r.discDiff))),
  });
}
const sc3 = {
  glow,
  // 1300ms at 60fps is 78 frames; the fit grid is 0.25f ≈ 4ms.
  pass: glow.every(
    (g) => Math.abs(g.periodMs - 1300) <= 40 && Math.abs(g.phaseDeg) <= 20,
  ),
};

// --------------------------------------------------------------------- SC4
// Camera apex (local 65..84, s ≥ 1.097) vs camera rest (local ≤ 10 or ≥ 140,
// s ≤ 1.003): the diff centroid must move by (s̄hi − s̄lo)·(c_eff − C), where
// c_eff is the de-scaled centroid the same frames measure. Null: 0.
const sc4Segs = [];
for (let seg = 0; seg < SEGS; seg += 1) {
  const rows = body.filter(
    (r) => r.seg === seg && r.hx !== null && r.hw > 5000,
  );
  const lo = rows.filter((r) => r.f % SEG_FRAMES <= 10 || r.f % SEG_FRAMES >= 140);
  const hi = rows.filter((r) => {
    const l = r.f % SEG_FRAMES;
    return l >= 65 && l <= 84;
  });
  if (lo.length === 0 || hi.length === 0) continue;
  const mean = (a) => a.reduce((x, v) => x + v, 0) / a.length;
  const sLo = mean(lo.map((r) => r.s));
  const sHi = mean(hi.map((r) => r.s));
  // De-scaled effective centroid, from every usable frame.
  const cyEff = mean(rows.map((r) => SRC_H / 2 + (r.hy - SRC_H / 2) / r.s));
  const cxEff = mean(rows.map((r) => SRC_W / 2 + (r.hx - SRC_W / 2) / r.s));
  const predDy = (sHi - sLo) * (cyEff - SRC_H / 2);
  const predDx = (sHi - sLo) * (cxEff - SRC_W / 2);
  const measDy = mean(hi.map((r) => r.hy)) - mean(lo.map((r) => r.hy));
  const measDx = mean(hi.map((r) => r.hx)) - mean(lo.map((r) => r.hx));
  sc4Segs.push({
    seg,
    predDy: r3(predDy),
    measDy: r3(measDy),
    predDx: r3(predDx),
    measDx: r3(measDx),
    errPx: r3(Math.hypot(measDy - predDy, measDx - predDx)),
    nullErrPx: r3(Math.hypot(measDy, measDx)),
  });
}
const sc4 = {
  segs: sc4Segs,
  // Follows the camera: the residual against the prediction stays inside a
  // few px while the static-canvas null is off by the full displacement —
  // judged on the segments whose displacement is big enough to measure.
  pass: sc4Segs.every(
    (r) =>
      r.errPx <= Math.max(3, 0.15 * Math.hypot(r.predDy, r.predDx)) ||
      Math.hypot(r.predDy, r.predDx) < 8,
  ),
};

// ------------------------------------------------ SC5 — the renderer's own
// timings from the two ?debug=1 diagnostic logs (ms). The wall-clock blanks
// in the request were left unfilled; these are the render pipeline's own
// numbers for the same runs.
const timings = {
  on: {waitForReady: 168.6, createFrame: 1383.5, addSample: 4036.4, audioMixing: 33.5},
  off: {waitForReady: 172.1, createFrame: 1139.7, addSample: 4403.1, audioMixing: 33.4},
};
const total = (t) => t.waitForReady + t.createFrame + t.addSample + t.audioMixing;
const sc5 = {
  onTotalMs: total(timings.on),
  offTotalMs: total(timings.off),
  deltaMs: r3(total(timings.on) - total(timings.off)),
  deltaPct: r3((100 * (total(timings.on) - total(timings.off))) / total(timings.off)),
  createFrameDeltaMs: r3(timings.on.createFrame - timings.off.createFrame),
  createFrameDeltaPctOfTotal: r3(
    (100 * (timings.on.createFrame - timings.off.createFrame)) / total(timings.off),
  ),
  pass: Math.abs(total(timings.on) - total(timings.off)) / total(timings.off) <= 0.05,
};

// ------------------------------------- SC6 support — the off render's camera
const prevCycle = {1: 1.0, 38: 1.05, 74: 1.1, 112: 1.046, 149: 1.0};
const sc6 = {
  rows: zoom,
  maxModelErr: r3(Math.max(...zoom.map((r) => Math.abs(r.measured - r.model)))),
  maxPrevCycleErr: r3(
    Math.max(...zoom.map((r) => Math.abs(r.measured - prevCycle[r.local]))),
  ),
  pass: zoom.every((r) => Math.abs(r.measured - r.model) <= 0.008),
};

// ---------------------------------------- ember stats vs the M4 calibration
// Track only inside slow-camera windows — during the fast mid-zoom the codec's
// own motion noise passes the temporal gate and would pollute the tracks.
const SLOW = (l) => l <= 20 || (l >= 55 && l <= 95) || l >= 130;
const tracks = [];
let open = [];
let prevKey = null;
for (const row of body) {
  const local = row.f % SEG_FRAMES;
  if (!SLOW(local) || row.f % SEG_FRAMES === 0) continue;
  const winKey = `${row.seg}:${local <= 20 ? 'a' : local <= 95 ? 'b' : 'c'}`;
  if (winKey !== prevKey) {
    tracks.push(...open);
    open = [];
    prevKey = winKey;
  }
  const taken = new Set();
  for (const tr of open) {
    const last = tr.pts[tr.pts.length - 1];
    if (row.f - last.f > 1) continue;
    let bestI = -1;
    let bestD = 12;
    row.blobs.forEach((b, i) => {
      if (taken.has(i)) return;
      const d = Math.hypot(b.x - last.x, b.y - last.y);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI >= 0) {
      taken.add(bestI);
      tr.pts.push({f: row.f, s: row.s, ...row.blobs[bestI]});
    }
  }
  open = open.filter(
    (tr) => row.f - tr.pts[tr.pts.length - 1].f <= 1 || (tracks.push(tr), false),
  );
  row.blobs.forEach((b, i) => {
    if (!taken.has(i)) open.push({seg: row.seg, pts: [{f: row.f, s: row.s, ...b}]});
  });
}
tracks.push(...open);

const isEmber = (tr) => {
  const n = tr.pts.length;
  if (n < 4) return false;
  const a = tr.pts[0];
  const b = tr.pts[n - 1];
  return b.y < a.y && Math.hypot(b.x - a.x, b.y - a.y) >= Math.max(4, 0.5 * n);
};
const embers = tracks.filter(isEmber);
const byFrame = new Map();
const stepVy = [];
const stepVx = [];
for (const tr of embers) {
  for (const p of tr.pts) {
    byFrame.set(p.f, (byFrame.get(p.f) ?? 0) + 1);
  }
  for (let i = 1; i < tr.pts.length; i += 1) {
    const df = tr.pts[i].f - tr.pts[i - 1].f;
    const s = tr.pts[i].s;
    stepVy.push(((tr.pts[i].y - tr.pts[i - 1].y) / df / s) * FPS);
    stepVx.push(((tr.pts[i].x - tr.pts[i - 1].x) / df / s) * FPS);
  }
}
const diams = embers.flatMap((tr) => tr.pts.map((p) => 2 * Math.sqrt(p.area / Math.PI)));
const emberStats = {
  tracks: embers.length,
  concurrentMedian: median([...byFrame.values()]),
  concurrentP90: quantile([...byFrame.values()], 0.9),
  diamMedianPx: r3(median(diams)),
  vyMedian: r3(median(stepVy)),
  vyP25: r3(quantile(stepVy, 0.25)),
  vyP75: r3(quantile(stepVy, 0.75)),
  vxAbsMedian: r3(median(stepVx.map(Math.abs))),
  // Model at the defaults: travel 0.158·1920px over a 1.5–3.0s life →
  // 101–202 px/s upward, ~135 at the median life.
  modelVyBand: [-202, -101],
};

const summary = {sc1, sc2, sc3, sc4, sc5, sc6, emberStats};
console.log(JSON.stringify(summary, null, 1));
writeFileSync(
  new URL('./out/analysis.json', import.meta.url),
  JSON.stringify(summary, null, 1),
);
console.log('→ out/analysis.json');
