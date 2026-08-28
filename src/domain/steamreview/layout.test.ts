// steam-review Design Ref: §12.1 — the three coordinate sets are reference
// measurements, so the video slots are pinned to the measured values and the
// per-ratio element presence is pinned to the reference's screen makeup (§1.1).
import {describe, expect, it} from 'vitest';

import {ASPECT_RATIOS, RATIO_DIMENSIONS} from '../editor/constants';
import {
  STEAM_REVIEW_CARD_SPECS,
  steamReviewLayout,
  steamReviewScrollCycleHeight,
} from './layout';

describe('steamReviewLayout', () => {
  it('places the video slot at the measured rect for every ratio', () => {
    // Design §1.3 — the reference uses a 16:9 slot on all three canvases.
    expect(steamReviewLayout('9:16').video).toEqual({
      x: 32,
      y: 499,
      w: 1016,
      h: 571,
    });
    expect(steamReviewLayout('16:9').video).toEqual({
      x: 101,
      y: 209,
      w: 1088,
      h: 612,
    });
    expect(steamReviewLayout('1:1').video).toEqual({
      x: 32,
      y: 206,
      w: 1016,
      h: 571,
    });
  });

  it('matches each canvas to its output dimensions', () => {
    for (const ratio of ASPECT_RATIOS) {
      expect(steamReviewLayout(ratio).canvas).toEqual(RATIO_DIMENSIONS[ratio]);
    }
  });

  // Plan §1.1 — the per-ratio screen makeup table.
  it('gives each ratio the elements the reference shows', () => {
    const vertical = steamReviewLayout('9:16');
    const wide = steamReviewLayout('16:9');
    const square = steamReviewLayout('1:1');

    // Key art: 9:16 banner + 16:9 sidebar; 1:1 shows none (Plan Q11).
    expect(vertical.keyArtBanner).toBeDefined();
    expect(wide.keyArtBanner).toBeUndefined();
    expect(wide.sidebar?.keyArt).toBeDefined();
    expect(square.keyArtBanner).toBeUndefined();
    expect(square.sidebar).toBeUndefined();

    // Thumbnails: 4 wide, 3 vertical, none square (Plan Q10).
    expect(wide.thumbStrip?.count).toBe(4);
    expect(vertical.thumbStrip?.count).toBe(3);
    expect(square.thumbStrip).toBeUndefined();

    // The decorative pagination row exists on 16:9 only.
    expect(wide.pagination).toBeDefined();
    expect(vertical.pagination).toBeUndefined();

    // The description renders on 16:9 only (Plan Q8).
    expect(wide.sidebar?.description).toBeDefined();
  });

  // Design D-7 — review subsets: 16:9 shows all four, the others three.
  it('assigns the measured review subsets', () => {
    expect(steamReviewLayout('16:9').reviews.indexes).toEqual([0, 1, 2, 3]);
    expect(steamReviewLayout('9:16').reviews.indexes).toEqual([1, 2, 3]);
    expect(steamReviewLayout('1:1').reviews.indexes).toEqual([1, 2, 3]);
  });

  // Design D-3 / Plan Q9 — only the square list scrolls.
  it('marks only the square review list as scrolling', () => {
    expect(steamReviewLayout('1:1').reviews.variant).toBe('scrolling');
    expect(steamReviewLayout('9:16').reviews.variant).toBe('static');
    expect(steamReviewLayout('16:9').reviews.variant).toBe('static');
  });

  it('derives the measured 645px scroll cycle for the square list', () => {
    // §7.3 — pitch 215 (180 + 35) times three cards.
    expect(
      steamReviewScrollCycleHeight(steamReviewLayout('1:1').reviews),
    ).toBe(645);
  });

  it('uses the lg card internals on 9:16/1:1 and sm on the 16:9 sidebar', () => {
    expect(steamReviewLayout('9:16').reviews.cardSize).toBe('lg');
    expect(steamReviewLayout('1:1').reviews.cardSize).toBe('lg');
    expect(steamReviewLayout('16:9').reviews.cardSize).toBe('sm');
    // §7.2 — the sidebar card clamps its body at two lines.
    expect(STEAM_REVIEW_CARD_SPECS.sm.bodyMaxLines).toBe(2);
    expect(STEAM_REVIEW_CARD_SPECS.lg.bodyMaxLines).toBe(0);
  });
});
