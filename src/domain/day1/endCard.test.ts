// Day1 Design Ref: §8.1 — the icon constants and iconAdjust. The 16:9 row was
// added once bannerdesigner v1.18 shipped an app-badge 1920x1080 layout, which
// retired the manual-placement degradation of Design D12.
//
// SC5 (icon overlays the baked-in banner icon within 2px) rests on these
// numbers, so the first test checks them against the raw bannerdesigner CSS
// pixel values rather than restating the normalised decimals.
import {describe, expect, it} from 'vitest';

import {RATIO_DIMENSIONS} from '../editor/types';
import {
  APP_ICON_RECT,
  DEFAULT_ICON_ADJUST,
  END_CARD_AUDIO_FADE_S,
  appIconRect,
  endCardAudioVolumeAt,
} from './endCard';

describe('APP_ICON_RECT', () => {
  // Source: today-banner-designer.html `.tmpl-app-badge.size-* .ab-icon`.
  it.each([
    ['1:1' as const, {left: 282, top: 375, size: 515, radius: 96}],
    ['9:16' as const, {left: 200, top: 820, size: 680, radius: 120}],
    ['16:9' as const, {left: 1096, top: 238, size: 640, radius: 125}],
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

  it('covers every output ratio, so nothing falls back to manual placement', () => {
    for (const ratio of ['1:1', '9:16', '16:9'] as const) {
      expect(APP_ICON_RECT[ratio]).toBeDefined();
    }
  });

  it('keeps the icon inside the frame', () => {
    for (const ratio of ['1:1', '9:16', '16:9'] as const) {
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

  it('has a constant for 16:9 too, so no ratio needs manual placement', () => {
    expect(appIconRect('16:9', DEFAULT_ICON_ADJUST)).toEqual(
      APP_ICON_RECT['16:9'],
    );
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

describe('16:9, once bannerdesigner v1.18 gave it a layout', () => {
  it('is square in pixels like the other two ratios', () => {
    const {width, height} = RATIO_DIMENSIONS['16:9'];
    const rect = appIconRect('16:9', DEFAULT_ICON_ADJUST);

    expect(rect.w * width).toBeCloseTo(rect.h * height, 6);
  });

  it('adjusts the same way as the ratios that always had constants', () => {
    const base = appIconRect('16:9', DEFAULT_ICON_ADJUST);
    const moved = appIconRect('16:9', {dx: 0.1, dy: -0.2, scale: 1.5});

    expect(moved.w).toBeCloseTo(base.w * 1.5, 10);
    expect(moved.h).toBeCloseTo(base.h * 1.5, 10);
    // Scale about the centre, then the nudge.
    expect(moved.x + moved.w / 2).toBeCloseTo(base.x + base.w / 2 + 0.1, 10);
    expect(moved.y + moved.h / 2).toBeCloseTo(base.y + base.h / 2 - 0.2, 10);
  });
});

// day1-endcard-audio FR-03/SC3 — the fade is a pure function so the Player and
// the renderer compute the identical curve.
describe('endCardAudioVolumeAt', () => {
  const fps = 30;
  const durationInFrames = 90;
  const fadeFrames = END_CARD_AUDIO_FADE_S * fps;

  it('holds the base volume through the body of the card', () => {
    expect(endCardAudioVolumeAt(0, fps, durationInFrames, 1)).toBe(1);
    expect(
      endCardAudioVolumeAt(durationInFrames - fadeFrames - 1, fps, durationInFrames, 0.6),
    ).toBe(0.6);
  });

  it('fades linearly to zero across the last quarter second', () => {
    const midFade = durationInFrames - fadeFrames / 2;

    expect(endCardAudioVolumeAt(midFade, fps, durationInFrames, 1)).toBeCloseTo(
      0.5,
      5,
    );
    expect(
      endCardAudioVolumeAt(durationInFrames, fps, durationInFrames, 1),
    ).toBe(0);
  });

  it('stays finite when the renderer probes with a NaN frame', () => {
    // @remotion/media evaluates the volume callback with frame=NaN while the
    // media is not ready and rejects the render if it gets NaN back.
    expect(endCardAudioVolumeAt(Number.NaN, fps, durationInFrames, 0.8)).toBe(
      0.8,
    );
  });

  it('scales the fade by the chosen volume and never goes negative', () => {
    const midFade = durationInFrames - fadeFrames / 2;

    expect(
      endCardAudioVolumeAt(midFade, fps, durationInFrames, 0.5),
    ).toBeCloseTo(0.25, 5);
    expect(
      endCardAudioVolumeAt(durationInFrames + 10, fps, durationInFrames, 1),
    ).toBe(0);
    expect(endCardAudioVolumeAt(10, fps, durationInFrames, 0)).toBe(0);
  });
});
