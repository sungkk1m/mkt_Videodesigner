// Day1 Design Ref: §4.1 Split Layout — where the two panels and the divider sit
// for a given output ratio. Pure geometry: no React, no Remotion.
import {RATIO_DIMENSIONS, type AspectRatio} from '../editor/types';

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How the two panels are stacked, named after the axis they are arranged along:
 * `vertical` puts A above B, `horizontal` puts A left of B. The divider runs
 * across the other axis.
 */
export type SplitOrientation = 'vertical' | 'horizontal';

export interface SplitLayout {
  orientation: SplitOrientation;
  /** Always the panel that plays first — top for vertical, left for horizontal. */
  a: PanelRect;
  b: PanelRect;
  line: PanelRect;
}

/** Day1 Design Ref: §4.1 — landscape output splits left/right, the rest top/bottom. */
export const SPLIT_ORIENTATION: Record<AspectRatio, SplitOrientation> = {
  '1:1': 'vertical',
  '9:16': 'vertical',
  '16:9': 'horizontal',
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Panel rectangles for one output ratio.
 *
 * The two panels split whatever the divider leaves. An odd remainder goes to
 * panel B so `a + line + b` lands exactly on the output size — a one-pixel gap
 * would show as a seam in the render.
 */
export const splitLayout = (
  ratio: AspectRatio,
  lineWidthPx: number,
): SplitLayout => {
  const {width, height} = RATIO_DIMENSIONS[ratio];
  const orientation = SPLIT_ORIENTATION[ratio];
  const axis = orientation === 'vertical' ? height : width;
  // Two panels must survive even at an absurd divider width.
  const line = clamp(Math.round(lineWidthPx), 0, axis - 2);
  const aSize = Math.floor((axis - line) / 2);
  const bStart = aSize + line;
  const bSize = axis - bStart;

  if (orientation === 'vertical') {
    return {
      orientation,
      a: {x: 0, y: 0, width, height: aSize},
      line: {x: 0, y: aSize, width, height: line},
      b: {x: 0, y: bStart, width, height: bSize},
    };
  }

  return {
    orientation,
    a: {x: 0, y: 0, width: aSize, height},
    line: {x: aSize, y: 0, width: line, height},
    b: {x: bStart, y: 0, width: bSize, height},
  };
};

/**
 * day1-quad Design §5.1 — the four cells and the cross divider.
 *
 * Named after the reading order the panels play in (Plan Q3): A top-left,
 * B top-right, C bottom-left, D bottom-right.
 */
export interface QuadLayout {
  cells: readonly [PanelRect, PanelRect, PanelRect, PanelRect];
  /** `[vertical, horizontal]` — the two bars of the cross. */
  lines: readonly [PanelRect, PanelRect];
}

/**
 * Cell rectangles for one output ratio, in a 2x2 grid.
 *
 * Unlike `splitLayout` there is no per-ratio orientation: 2x2 is 2x2 at every
 * ratio, and that is exactly what makes each cell carry the output's own aspect
 * ratio (9:16 → 537x957, 1:1 → 537x537, 16:9 → 957x537, all within 0.25% of the
 * frame's). A source shaped like the output therefore fills a cell without a
 * crop, which the two-panel split could never offer.
 *
 * Same remainder rule as `splitLayout`: the odd pixel goes to the far cell so
 * `near + line + far` lands exactly on the output size. A one-pixel gap would
 * show as a seam in the render.
 */
export const quadLayout = (
  ratio: AspectRatio,
  lineWidthPx: number,
): QuadLayout => {
  const {width, height} = RATIO_DIMENSIONS[ratio];
  // Both axes must keep two cells alive even at an absurd divider width.
  const line = clamp(Math.round(lineWidthPx), 0, Math.min(width, height) - 2);
  const col0 = Math.floor((width - line) / 2);
  const col1Start = col0 + line;
  const col1 = width - col1Start;
  const row0 = Math.floor((height - line) / 2);
  const row1Start = row0 + line;
  const row1 = height - row1Start;

  return {
    cells: [
      {x: 0, y: 0, width: col0, height: row0},
      {x: col1Start, y: 0, width: col1, height: row0},
      {x: 0, y: row1Start, width: col0, height: row1},
      {x: col1Start, y: row1Start, width: col1, height: row1},
    ],
    lines: [
      {x: col0, y: 0, width: line, height},
      {x: 0, y: row0, width, height: line},
    ],
  };
};
