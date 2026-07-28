// Day1 Design Ref: §8.1 — panel rectangles, orientation, and the invariant that
// the pieces tile the output frame exactly.
import {describe, expect, it} from 'vitest';

import {ASPECT_RATIOS, RATIO_DIMENSIONS} from '../editor/types';
import {SPLIT_ORIENTATION, splitLayout} from './layout';

describe('splitLayout', () => {
  // The table in Day1 Design §4.1, at the default 6px divider.
  it.each([
    ['1:1' as const, 'vertical' as const, {width: 1080, height: 537}],
    ['16:9' as const, 'horizontal' as const, {width: 957, height: 1080}],
    ['9:16' as const, 'vertical' as const, {width: 1080, height: 957}],
  ])('matches the design table for %s', (ratio, orientation, panel) => {
    const layout = splitLayout(ratio, 6);

    expect(layout.orientation).toBe(orientation);
    expect(layout.a).toMatchObject(panel);
    expect(layout.b).toMatchObject(panel);
  });

  it('puts panel A first — top when stacked, left when side by side', () => {
    const stacked = splitLayout('9:16', 6);
    expect(stacked.a.y).toBe(0);
    expect(stacked.b.y).toBeGreaterThan(stacked.a.y);
    expect(stacked.a.x).toBe(stacked.b.x);

    const sideBySide = splitLayout('16:9', 6);
    expect(sideBySide.a.x).toBe(0);
    expect(sideBySide.b.x).toBeGreaterThan(sideBySide.a.x);
    expect(sideBySide.a.y).toBe(sideBySide.b.y);
  });

  it('seats the divider exactly between the two panels', () => {
    for (const ratio of ASPECT_RATIOS) {
      const layout = splitLayout(ratio, 6);

      if (layout.orientation === 'vertical') {
        expect(layout.line.y).toBe(layout.a.y + layout.a.height);
        expect(layout.b.y).toBe(layout.line.y + layout.line.height);
      } else {
        expect(layout.line.x).toBe(layout.a.x + layout.a.width);
        expect(layout.b.x).toBe(layout.line.x + layout.line.width);
      }
    }
  });

  it('tiles the frame exactly, for every ratio and divider width', () => {
    for (const ratio of ASPECT_RATIOS) {
      const {width, height} = RATIO_DIMENSIONS[ratio];

      // 0-24 is the schema's allowed range; odd values force a remainder.
      for (let lineWidthPx = 0; lineWidthPx <= 24; lineWidthPx += 1) {
        const layout = splitLayout(ratio, lineWidthPx);
        const along =
          layout.orientation === 'vertical'
            ? layout.a.height + layout.line.height + layout.b.height
            : layout.a.width + layout.line.width + layout.b.width;

        expect({ratio, lineWidthPx, along}).toEqual({
          ratio,
          lineWidthPx,
          along: layout.orientation === 'vertical' ? height : width,
        });

        // The cross axis is always full-bleed.
        if (layout.orientation === 'vertical') {
          expect([layout.a.width, layout.b.width, layout.line.width]).toEqual([
            width,
            width,
            width,
          ]);
        } else {
          expect([
            layout.a.height,
            layout.b.height,
            layout.line.height,
          ]).toEqual([height, height, height]);
        }
      }
    }
  });

  it('gives an odd remainder to panel B rather than losing a pixel', () => {
    // 1080 - 7 = 1073, which cannot halve evenly.
    const layout = splitLayout('1:1', 7);

    expect(layout.a.height).toBe(536);
    expect(layout.b.height).toBe(537);
    expect(layout.a.height + 7 + layout.b.height).toBe(1080);
  });

  it('produces whole pixels only', () => {
    for (const ratio of ASPECT_RATIOS) {
      const layout = splitLayout(ratio, 5);

      for (const rect of [layout.a, layout.b, layout.line]) {
        for (const value of Object.values(rect)) {
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    }
  });

  it('keeps both panels visible even at an absurd divider width', () => {
    const layout = splitLayout('1:1', 99_999);

    expect(layout.a.height).toBeGreaterThan(0);
    expect(layout.b.height).toBeGreaterThan(0);
    expect(layout.a.height + layout.line.height + layout.b.height).toBe(1080);
  });

  it('collapses the divider to nothing at width zero', () => {
    const layout = splitLayout('1:1', 0);

    expect(layout.line.height).toBe(0);
    expect(layout.a.height).toBe(540);
    expect(layout.b.height).toBe(540);
  });

  it('covers every supported ratio', () => {
    expect(Object.keys(SPLIT_ORIENTATION).sort()).toEqual(
      [...ASPECT_RATIOS].sort(),
    );
  });
});
