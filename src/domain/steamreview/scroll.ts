// steam-review Design Ref: §5 / D-3 — the 1:1 review list scrolls upward at a
// constant measured speed and loops seamlessly (the list is drawn twice and the
// offset wraps at one cycle). A pure function of the frame's wall-clock time,
// so the Player preview and the render agree at any fps.

/** Measured off the reference: 104px over 2s, correlation 0.992 (Design §1.3). */
export const SCROLL_SPEED_PX_PER_S = 52;

export const reviewScrollOffsetPx = (
  timeMs: number,
  cycleHeightPx: number,
): number =>
  cycleHeightPx <= 0
    ? 0
    : ((timeMs / 1000) * SCROLL_SPEED_PX_PER_S) % cycleHeightPx;
