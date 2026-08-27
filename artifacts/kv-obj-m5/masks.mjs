// kv-object-animation M5 — the per-segment reach band, shared by scan.mjs
// (on-vs-off) and repeat.mjs (cycle-vs-cycle) so the two passes judge the
// same "outside" and their noise floors compare apples-to-apples.
//
// The band is the union of the particle reach box (kvParticlesReach closed
// form at the M4 defaults) and the glow disc at the located centre, swept
// through the camera's whole scale range and dilated for codec bleed.
import {SRC_H, SRC_W} from './reader.mjs';

export const REACH = {x0: 0.23, x1: 0.77, y0: 0.242, y1: 0.75};
export const GLOW_R = 0.18 * SRC_W;
export const MARGIN = 16;
export const S_SWEEP = [1.0, 1.025, 1.05, 1.075, 1.1];

/** Bit 1 = inside the exclusion band, bit 2 = ember candidate area. */
export const buildMasks = (centers) => {
  const w = SRC_W;
  const h = SRC_H;
  const CX = w / 2;
  const CY = h / 2;
  return centers.map(({cx, cy}) => {
    const gx = cx * w;
    const gy = cy * h;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let m = 0;
        for (const s of S_SWEEP) {
          const ux = CX + (x - CX) / s;
          const uy = CY + (y - CY) / s;
          const inBox =
            ux >= REACH.x0 * w - MARGIN &&
            ux <= REACH.x1 * w + MARGIN &&
            uy >= REACH.y0 * h - MARGIN &&
            uy <= REACH.y1 * h + MARGIN;
          const inGlow = Math.hypot(ux - gx, uy - gy) <= GLOW_R + MARGIN;
          if (inBox || inGlow) m |= 1;
          if (inBox) m |= 2;
        }
        mask[y * w + x] = m;
      }
    }
    return mask;
  });
};
