// Day1 Design Ref: §8.1 — panel rectangles, orientation, and the invariant that
// the pieces tile the output frame exactly.
import {describe, expect, it} from 'vitest';

import {ASPECT_RATIOS, RATIO_DIMENSIONS} from '../editor/types';
import {MAX_SPLIT_LINE_WIDTH_PX} from '../editor/constants';
import {SPLIT_ORIENTATION, quadLayout, splitLayout} from './layout';

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

// day1-quad Design §5.1 / Plan SC2 — the 2x2 grid.
describe('quadLayout', () => {
  // The table in day1-quad Design §5.1, at the default 6px divider.
  it.each([
    ['9:16', 537, 537, 957, 957],
    ['1:1', 537, 537, 537, 537],
    ['16:9', 957, 957, 537, 537],
  ] as const)(
    '%s splits into four cells',
    (ratio, col0, col1, row0, row1) => {
      const {cells} = quadLayout(ratio, 6);

      expect(cells.map((cell) => cell.width)).toEqual([col0, col1, col0, col1]);
      expect(cells.map((cell) => cell.height)).toEqual([row0, row0, row1, row1]);
      // Plan Q3 reading order: A top-left, B top-right, C bottom-left, D bottom-right.
      expect(cells.map((cell) => [cell.x, cell.y])).toEqual([
        [0, 0],
        [col0 + 6, 0],
        [0, row0 + 6],
        [col0 + 6, row0 + 6],
      ]);
    },
  );

  /**
   * Plan SC2 — the pieces must tile the frame exactly. A one-pixel gap shows as
   * a seam in the render, so this is checked over every ratio at every divider
   * width the schema allows rather than at the default only.
   */
  it.each(ASPECT_RATIOS)('tiles %s exactly at every divider width', (ratio) => {
    const {width, height} = RATIO_DIMENSIONS[ratio];

    for (let lineWidthPx = 0; lineWidthPx <= MAX_SPLIT_LINE_WIDTH_PX; lineWidthPx += 1) {
      const {cells, lines} = quadLayout(ratio, lineWidthPx);
      const [a, b, c, d] = cells;
      const [vertical, horizontal] = lines;

      expect(a.width + vertical.width + b.width).toBe(width);
      expect(c.width + vertical.width + d.width).toBe(width);
      expect(a.height + horizontal.height + c.height).toBe(height);
      expect(b.height + horizontal.height + d.height).toBe(height);

      // Every cell has to survive, however wide the divider gets.
      cells.forEach((cell) => {
        expect(cell.width).toBeGreaterThan(0);
        expect(cell.height).toBeGreaterThan(0);
      });

      // The cross spans the frame and sits on the seams.
      expect(vertical).toEqual({x: a.width, y: 0, width: lineWidthPx, height});
      expect(horizontal).toEqual({x: 0, y: a.height, width, height: lineWidthPx});
    }
  });

  /**
   * The property the whole template rests on (Design §5.1): a quad cell carries
   * the output frame's own aspect ratio, so a source shaped like the output
   * fills a cell without a crop and framing survives a ratio change.
   */
  it.each(ASPECT_RATIOS)('gives %s cells the output aspect ratio', (ratio) => {
    const {width, height} = RATIO_DIMENSIONS[ratio];
    const frameAspect = width / height;

    quadLayout(ratio, 6).cells.forEach((cell) => {
      const error = Math.abs(cell.width / cell.height - frameAspect) / frameAspect;

      expect(error).toBeLessThan(0.003);
    });
  });

  it('has no per-ratio orientation, unlike splitLayout', () => {
    // splitLayout stacks 16:9 side by side and the rest top to bottom; a 2x2
    // grid is a 2x2 grid at every ratio, which is what §5.1 relies on.
    expect(SPLIT_ORIENTATION['16:9']).not.toBe(SPLIT_ORIENTATION['9:16']);
    ASPECT_RATIOS.forEach((ratio) => {
      const {cells} = quadLayout(ratio, 6);

      expect(cells[0].x).toBe(0);
      expect(cells[1].x).toBeGreaterThan(0);
      expect(cells[2].y).toBeGreaterThan(0);
    });
  });
});
