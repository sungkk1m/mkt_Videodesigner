// steam-review Design Ref: §12.1 — the scroll is a pure function of wall-clock
// time, so preview and render agree at any fps, and it wraps at one cycle.
import {describe, expect, it} from 'vitest';

import {SCROLL_SPEED_PX_PER_S, reviewScrollOffsetPx} from './scroll';

const CYCLE = 645;

describe('reviewScrollOffsetPx', () => {
  it('starts at zero', () => {
    expect(reviewScrollOffsetPx(0, CYCLE)).toBe(0);
  });

  it('moves at the measured 52px/s', () => {
    expect(SCROLL_SPEED_PX_PER_S).toBe(52);
    expect(reviewScrollOffsetPx(1000, CYCLE)).toBe(52);
    expect(reviewScrollOffsetPx(2000, CYCLE)).toBe(104);
  });

  it('wraps seamlessly at one cycle', () => {
    const cycleMs = (CYCLE / SCROLL_SPEED_PX_PER_S) * 1000;

    expect(reviewScrollOffsetPx(cycleMs, CYCLE)).toBeCloseTo(0, 6);
    expect(reviewScrollOffsetPx(cycleMs + 1000, CYCLE)).toBeCloseTo(52, 6);
  });

  it('is a function of time only, so 30fps and 60fps sampling agree', () => {
    // The same wall-clock instant expressed as frame 45 @30fps and 90 @60fps.
    const at30 = reviewScrollOffsetPx((45 / 30) * 1000, CYCLE);
    const at60 = reviewScrollOffsetPx((90 / 60) * 1000, CYCLE);

    expect(at30).toBe(at60);
  });

  it('answers zero for an empty cycle instead of NaN', () => {
    expect(reviewScrollOffsetPx(1000, 0)).toBe(0);
  });
});
