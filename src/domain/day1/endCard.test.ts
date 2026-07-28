// Day1 Design Ref: §8.1 — the icon constants, the 16:9 gap, and iconAdjust.
//
// SC5 (icon overlays the baked-in banner icon within 2px) rests on these
// numbers, so the first test checks them against the raw bannerdesigner CSS
// pixel values rather than restating the normalised decimals.
import {describe, expect, it} from 'vitest';

import {RATIO_DIMENSIONS} from '../editor/types';
import {APP_ICON_RECT, DEFAULT_ICON_ADJUST, appIconRect} from './endCard';

describe('APP_ICON_RECT', () => {
  // Source: today-banner-designer.html `.tmpl-app-badge.size-* .ab-icon`.
  it.each([
    ['1:1' as const, {left: 282, top: 375, size: 515, radius: 96}],
    ['9:16' as const, {left: 200, top: 820, size: 680, radius: 120}],
  ])('places the %s icon back on its CSS pixels', (ratio, css) => {
    const {width, height} = RATIO_DIMENSIONS[ratio];
    const rect = APP_ICON_RECT[ratio];

    if (!rect) {
      throw new Error(`${ratio} must have an icon rectangle`);
    }

    expect(rect.x * width).toBeCloseTo(css.left, 6);
    expect(rect.y * height).toBeCloseTo(css.top, 6);
    // The icon is square in pixels even where the frame is not.
    expect(rect.w * width).toBeCloseTo(css.size, 6);
    expect(rect.h * height).toBeCloseTo(css.size, 6);
    expect(rect.radius * width).toBeCloseTo(css.radius, 6);
  });

  it('has no 16:9 entry — bannerdesigner ships no such layout', () => {
    expect(APP_ICON_RECT['16:9']).toBeUndefined();
  });

  it('keeps the icon inside the frame', () => {
    for (const ratio of ['1:1', '9:16'] as const) {
      const rect = APP_ICON_RECT[ratio];

      if (!rect) {
        throw new Error(`${ratio} must have an icon rectangle`);
      }

      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(1);
      expect(rect.y + rect.h).toBeLessThanOrEqual(1);
    }
  });
});

describe('appIconRect', () => {
  it('returns the untouched constant with the default adjustment', () => {
    expect(appIconRect('1:1', DEFAULT_ICON_ADJUST)).toEqual(APP_ICON_RECT['1:1']);
  });

  it('defaults the adjustment when none is given', () => {
    expect(appIconRect('9:16')).toEqual(APP_ICON_RECT['9:16']);
  });

  it('returns null for 16:9 so the inspector can ask for manual placement', () => {
    expect(appIconRect('16:9', DEFAULT_ICON_ADJUST)).toBeNull();
  });

  it('translates by dx and dy', () => {
    const base = APP_ICON_RECT['1:1'];
    const moved = appIconRect('1:1', {dx: 0.1, dy: -0.05, scale: 1});

    if (!base || !moved) {
      throw new Error('1:1 must have an icon rectangle');
    }

    expect(moved.x).toBeCloseTo(base.x + 0.1, 10);
    expect(moved.y).toBeCloseTo(base.y - 0.05, 10);
    // Size is untouched by a pure move.
    expect(moved.w).toBeCloseTo(base.w, 10);
    expect(moved.h).toBeCloseTo(base.h, 10);
  });

  it('scales about the icon centre rather than its corner', () => {
    const base = APP_ICON_RECT['1:1'];
    const grown = appIconRect('1:1', {dx: 0, dy: 0, scale: 1.2});

    if (!base || !grown) {
      throw new Error('1:1 must have an icon rectangle');
    }

    const centreOf = (rect: {x: number; y: number; w: number; h: number}) => ({
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    });

    expect(centreOf(grown).x).toBeCloseTo(centreOf(base).x, 10);
    expect(centreOf(grown).y).toBeCloseTo(centreOf(base).y, 10);
    expect(grown.w).toBeCloseTo(base.w * 1.2, 10);
    expect(grown.h).toBeCloseTo(base.h * 1.2, 10);
  });

  it('scales the corner radius with the icon so the shape stays proportional', () => {
    const base = APP_ICON_RECT['9:16'];
    const grown = appIconRect('9:16', {dx: 0, dy: 0, scale: 1.5});

    if (!base || !grown) {
      throw new Error('9:16 must have an icon rectangle');
    }

    expect(grown.radius).toBeCloseTo(base.radius * 1.5, 10);
  });

  it('shrinks about the centre too', () => {
    const base = APP_ICON_RECT['1:1'];
    const shrunk = appIconRect('1:1', {dx: 0, dy: 0, scale: 0.5});

    if (!base || !shrunk) {
      throw new Error('1:1 must have an icon rectangle');
    }

    expect(shrunk.w).toBeCloseTo(base.w * 0.5, 10);
    expect(shrunk.x).toBeCloseTo(base.x + base.w * 0.25, 10);
  });

  it('never mutates the shared constant', () => {
    const before = structuredClone(APP_ICON_RECT['1:1']);

    appIconRect('1:1', {dx: 0.2, dy: 0.2, scale: 2});

    expect(APP_ICON_RECT['1:1']).toEqual(before);
  });
});
