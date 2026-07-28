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
