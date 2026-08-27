// kv-object-animation M4, phase 3 — scan.json → the numbers the defaults
// need. No pixels here, just series.
//
//   glow   : per segment, least-squares fit of  a + b·t + c·sin + d·cos  over
//            a period grid — with 60-frame holds a straight autocorrelation
//            starves, a model fit does not. Period, relative swing, phase.
//   blobs  : compactness-filtered (edge slivers from camera breathing are
//            long and hollow, embers are round), then greedy nearest-neighbour
//            tracking inside each hold for velocity, lifetime and flicker.
import {readFileSync, writeFileSync} from 'node:fs';

import {FPS, SEG_FRAMES, SRC_H, SRC_W} from './reader.mjs';

const {perFrame} = JSON.parse(
  readFileSync(new URL('./out/scan.json', import.meta.url), 'utf8'),
);

const usable = ({f}) => f >= 18 && f < 476;
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

// ---------------------------------------------------------------- glow fit
const glow = [];
for (let seg = 0; seg < 8; seg += 1) {
  const rows = perFrame.filter((r) => r.seg === seg && usable(r));
  const t = rows.map((r) => r.f - seg * SEG_FRAMES);
  const y = rows.map((r) => r.annulus);
  const n = y.length;
  const mean = y.reduce((a, v) => a + v, 0) / n;

  let best = null;
  for (let period = 10; period <= 90; period += 0.5) {
    // Least squares for a + b·t + c·sin(ωt) + d·cos(ωt).
    const om = (2 * Math.PI) / period;
    const cols = [t.map(() => 1), t, t.map((v) => Math.sin(om * v)), t.map((v) => Math.cos(om * v))];
    // Normal equations, 4×4.
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
        phase: Math.atan2(x[3], x[2]),
        base: x[0] + (x[1] * (n - 1)) / 2,
      };
    }
  }
  glow.push({
    seg,
    periodFrames: best.period,
    periodMs: Math.round((best.period / FPS) * 1000),
    amp: +best.amp.toFixed(2),
    mean: +mean.toFixed(1),
    swingPct: +((100 * best.amp) / mean).toFixed(1),
    phaseDeg: Math.round((best.phase * 180) / Math.PI),
  });
}

// ------------------------------------------------------------------ blobs
const compact = (b) =>
  b.area / (b.bw * b.bh) >= 0.35 && Math.max(b.bw, b.bh) / Math.max(1, Math.min(b.bw, b.bh)) <= 4;

// f % 60 === 0 diffs across the hard cut — the whole artwork changes, every
// pixel "moved". Those frames carry no particle information.
const blobRows = perFrame
  .filter((r) => usable(r) && r.f % SEG_FRAMES !== 0)
  .map((r) => ({...r, blobs: r.blobs.filter(compact)}));

// Tracking inside each hold. No gap tolerance: reacquiring across missed
// frames chains unrelated twinkles into fake tracks (tried, rejected — it
// re-poisoned the counts the track filter had cleaned).
const GAP = 0;
const RADIUS = 24; // px per frame of gap
const tracks = [];
let open = [];
let prevSeg = -1;
for (const row of blobRows) {
  if (row.seg !== prevSeg) {
    for (const tr of open) tracks.push(tr);
    open = [];
    prevSeg = row.seg;
  }
  const survivors = [];
  for (const tr of open) {
    if (row.f - tr.pts[tr.pts.length - 1].f > GAP + 1) tracks.push(tr);
    else survivors.push(tr);
  }
  open = survivors;

  const taken = new Set();
  for (const tr of open) {
    const last = tr.pts[tr.pts.length - 1];
    const df = row.f - last.f;
    let bestI = -1;
    let bestD = RADIUS * df;
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
      tr.pts.push({f: row.f, ...row.blobs[bestI]});
    }
  }
  row.blobs.forEach((b, i) => {
    if (!taken.has(i)) open.push({seg: row.seg, pts: [{f: row.f, ...b}]});
  });
}
for (const tr of open) tracks.push(tr);

// The overlay pass showed the survivors of the pixel gates split two ways:
// real embers, and chromatic artwork edges (title-stroke fringes, the
// snowman's carrot) wiggled by the camera breathing. The breathing moves an
// edge ≤ ~0.3px/frame while an ember travels ≥ ~1px/frame, so the track is
// the discriminator, not the pixel.
const isParticleTrack = (tr) => {
  const n = tr.pts.length;
  if (n < 4) return false;
  const a = tr.pts[0];
  const b = tr.pts[n - 1];
  const net = Math.hypot(b.x - a.x, b.y - a.y);
  let path = 0;
  for (let i = 1; i < n; i += 1) {
    path += Math.hypot(
      tr.pts[i].x - tr.pts[i - 1].x,
      tr.pts[i].y - tr.pts[i - 1].y,
    );
  }
  const meanStep = path / (n - 1);
  return net >= Math.max(5, 0.6 * n) && meanStep >= 0.8 && meanStep <= 30;
};

const particleTracks = tracks.filter(isParticleTrack);
const pointsByFrame = new Map();
for (const tr of particleTracks) {
  for (const p of tr.pts) {
    if (!pointsByFrame.has(p.f)) pointsByFrame.set(p.f, []);
    pointsByFrame.get(p.f).push({...p, seg: tr.seg});
  }
}

const perSeg = [];
for (let seg = 0; seg < 8; seg += 1) {
  const rows = blobRows.filter((r) => r.seg === seg);
  const counts = rows.map((r) => (pointsByFrame.get(r.f) ?? []).filter((p) => p.seg === seg).length);
  const all = rows.flatMap((r) => (pointsByFrame.get(r.f) ?? []).filter((p) => p.seg === seg));
  const diams = all.map((b) => 2 * Math.sqrt(b.area / Math.PI));
  const rgb = [0, 1, 2].map((c) =>
    Math.round(all.reduce((a, b) => a + b.rgb[c], 0) / Math.max(1, all.length)),
  );
  const xs = all.map((b) => b.x / SRC_W);
  const ys = all.map((b) => b.y / SRC_H);
  perSeg.push({
    seg,
    countMedian: median(counts),
    countP90: quantile(counts, 0.9),
    diamMedian: +median(diams).toFixed(1),
    diamP25: +quantile(diams, 0.25).toFixed(1),
    diamP75: +quantile(diams, 0.75).toFixed(1),
    rgb,
    cloud: {
      x0: +quantile(xs, 0.05).toFixed(2),
      x1: +quantile(xs, 0.95).toFixed(2),
      y0: +quantile(ys, 0.05).toFixed(2),
      y1: +quantile(ys, 0.95).toFixed(2),
    },
  });
}

// Velocity and lifetime off the qualifying tracks — per segment, because the
// winter artwork's dots turned out to be in-place twinkles whose appearances
// the matcher chains into fake fast movers. A physical ember never jumps more
// than a few px per frame, so tracks with any step > 8px are excluded from
// the velocity estimate.
const maxStepOf = (tr) => {
  let m = 0;
  for (let i = 1; i < tr.pts.length; i += 1) {
    m = Math.max(
      m,
      Math.hypot(tr.pts[i].x - tr.pts[i - 1].x, tr.pts[i].y - tr.pts[i - 1].y),
    );
  }
  return m;
};
const perSegMotion = [];
for (let seg = 0; seg < 8; seg += 1) {
  const segTracks = particleTracks.filter((tr) => tr.seg === seg);
  // Speed comes from the individual matched steps, gap-normalised, with a
  // physical cap — one bad reacquisition can't poison a track's estimate.
  const stepVy = [];
  const stepVx = [];
  for (const tr of segTracks) {
    for (let i = 1; i < tr.pts.length; i += 1) {
      const df = tr.pts[i].f - tr.pts[i - 1].f;
      const dx = (tr.pts[i].x - tr.pts[i - 1].x) / df;
      const dy = (tr.pts[i].y - tr.pts[i - 1].y) / df;
      // Physical cap — a real ember crosses ≤ ~14px in a 33ms frame; longer
      // "steps" are the matcher hopping between neighbours.
      if (Math.hypot(dx, dy) > 14) continue;
      stepVy.push(dy * FPS);
      stepVx.push(dx * FPS);
    }
  }
  const spanSec = segTracks.map(
    (tr) => (tr.pts[tr.pts.length - 1].f - tr.pts[0].f + 1) / FPS,
  );
  perSegMotion.push({
    seg,
    tracks: segTracks.length,
    steps: stepVy.length,
    vyMedian: +median(stepVy).toFixed(1),
    vyP25: +quantile(stepVy, 0.25).toFixed(1),
    vyP75: +quantile(stepVy, 0.75).toFixed(1),
    vxAbsMedian: +median(stepVx.map(Math.abs)).toFixed(1),
    lifeMedianSec: +median(spanSec).toFixed(2),
    lifeP90Sec: +quantile(spanSec, 0.9).toFixed(2),
    lifeMaxSec: +Math.max(0, ...spanSec).toFixed(2),
  });
}

const vys = [];
const vxs = [];
for (const tr of particleTracks) {
  const a = tr.pts[0];
  const b = tr.pts[tr.pts.length - 1];
  const df = b.f - a.f;
  vys.push(((b.y - a.y) / df) * FPS); // px/s, +down
  vxs.push(((b.x - a.x) / df) * FPS);
}
const lifeFrames = particleTracks.map((tr) => tr.pts.length);
const risers = vys.filter((v) => v < 0);

// Flicker: dominant frequency of the detrended peak-luma series of long tracks.
const flickerHz = [];
for (const tr of particleTracks.filter((t) => t.pts.length >= 24)) {
  const y = tr.pts.map((p) => p.peak);
  const meanY = y.reduce((a, v) => a + v, 0) / y.length;
  const d = y.map((v) => v - meanY);
  let bestP = 0;
  let bestPow = 0;
  for (let period = 4; period <= 30; period += 1) {
    const om = (2 * Math.PI) / period;
    let s = 0;
    let c = 0;
    d.forEach((v, k) => {
      s += v * Math.sin(om * k);
      c += v * Math.cos(om * k);
    });
    const pow = s * s + c * c;
    if (pow > bestPow) {
      bestPow = pow;
      bestP = period;
    }
  }
  if (bestP > 0) flickerHz.push(FPS / bestP);
}

const summary = {
  glow,
  perSeg,
  perSegMotion,
  velocity: {
    n: vys.length,
    vyMedian: +median(vys).toFixed(1),
    vyP25: +quantile(vys, 0.25).toFixed(1),
    vyP75: +quantile(vys, 0.75).toFixed(1),
    risersShare: +(risers.length / Math.max(1, vys.length)).toFixed(2),
    riserVyMedian: +median(risers).toFixed(1),
    vxAbsMedian: +median(vxs.map(Math.abs)).toFixed(1),
  },
  lifetime: {
    n: lifeFrames.length,
    medianSec: +(median(lifeFrames) / FPS).toFixed(2),
    p75Sec: +(quantile(lifeFrames, 0.75) / FPS).toFixed(2),
    p90Sec: +(quantile(lifeFrames, 0.9) / FPS).toFixed(2),
    maxSec: +(Math.max(...lifeFrames) / FPS).toFixed(2),
  },
  flicker: {
    n: flickerHz.length,
    hzMedian: +median(flickerHz).toFixed(1),
  },
};

console.log(JSON.stringify(summary, null, 1));
writeFileSync(
  new URL('./out/analysis.json', import.meta.url),
  JSON.stringify(summary, null, 1),
);
console.log('→ out/analysis.json');
