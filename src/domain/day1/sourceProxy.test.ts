// The proxy has to be invisible: whatever `planPanelProxy` returns must land the
// same source pixels on the same box pixels as the uncropped source did. These
// tests re-implement the forward mapping from `SplitFrame.tsx` and compare the
// two paths, which is the whole correctness argument — no render needed.
import {describe, expect, it} from 'vitest';

import {DEFAULT_TRANSFORM, type MediaTransform, type PanelRect} from '../editor/types';
import {splitLayout} from './layout';
import {
  MIN_PROXY_SAVINGS,
  panelVisibleRect,
  planPanelProxy,
  type CropRect,
  type SourceSize,
} from './sourceProxy';


/** The gameplay source both panels carried in the 2026-08-18 measurements. */
const SOURCE: SourceSize = {width: 1242, height: 2208};
const PANEL_9X16 = splitLayout('9:16', 6).a;

const transform = (patch: Partial<MediaTransform> = {}): MediaTransform => ({
  ...DEFAULT_TRANSFORM,
  ...patch,
});

/**
 * Box coordinate of a source pixel, exactly as the panel draws it: `cover`
 * centres the source, then the element transform scales about the centre and
 * translates by a percentage of the box.
 */
const project = (
  box: PanelRect,
  source: SourceSize,
  t: MediaTransform,
  u: number,
  v: number,
) => {
  const cover = Math.max(box.width / source.width, box.height / source.height);
  const k = cover * t.scale;

  return {
    x: box.width / 2 + (u - source.width / 2) * k + (t.x / 100) * box.width,
    y: box.height / 2 + (v - source.height / 2) * k + (t.y / 100) * box.height,
  };
};

/** The same projection for a proxy: source pixels are relative to the crop. */
const projectProxy = (
  box: PanelRect,
  crop: CropRect,
  t: MediaTransform,
  u: number,
  v: number,
) =>
  project(box, {width: crop.width, height: crop.height}, t, u - crop.left, v - crop.top);

describe('panelVisibleRect', () => {
  it('reports the half of a 9:16 gameplay source the panel actually shows', () => {
    const visible = panelVisibleRect(PANEL_9X16, SOURCE, transform());

    // cover scales by 1080/1242, so a 957px tall box sees 957 / (1080/1242) rows.
    expect(visible.left).toBeCloseTo(0, 6);
    expect(visible.width).toBeCloseTo(1242, 6);
    expect(visible.height).toBeCloseTo(1100.55, 2);
    expect(visible.top).toBeCloseTo((2208 - 1100.55) / 2, 2);
  });

  it('always carries the panel box aspect ratio', () => {
    for (const t of [transform(), transform({scale: 2, x: 10, y: -20}), transform({scale: 0.7})]) {
      const visible = panelVisibleRect(PANEL_9X16, SOURCE, t);

      expect(visible.width / visible.height).toBeCloseTo(
        PANEL_9X16.width / PANEL_9X16.height,
        6,
      );
    }
  });

  it('needs more of the source at 16:9 than at 9:16', () => {
    const wide = panelVisibleRect(splitLayout('16:9', 6).a, SOURCE, transform());
    const tall = panelVisibleRect(PANEL_9X16, SOURCE, transform());

    expect(wide.height).toBeGreaterThan(tall.height);
  });

  it('sees the whole source at the minimum scale, leaving nothing to crop', () => {
    // A 9:16 source in a half-height 9:16 panel is the exact case where the
    // 0.5 scale floor undoes the cover crop: 957 / (1080/1242 * 0.5) = 2201 of
    // 2208 rows. So zooming out is handled by the savings floor, not by the
    // bounds check.
    const zoomedOut = panelVisibleRect(PANEL_9X16, SOURCE, transform({scale: 0.5}));

    expect(zoomedOut.height).toBeCloseTo(2201.1, 1);
    expect(planPanelProxy(PANEL_9X16, SOURCE, transform({scale: 0.5}))).toBeNull();
  });
});

describe('planPanelProxy', () => {
  // day1-video — every rectangle here is inverted out of `cover`. Under
  // `contain` the panel shows the whole source, so there is no crop to plan and
  // the cover arithmetic must not be applied to it anyway.
  it('plans no crop for a contain framing', () => {
    expect(planPanelProxy(PANEL_9X16, SOURCE, transform({fit: 'contain'})))
      .toBeNull();
  });

  it('still crops the same contain source under cover', () => {
    const plan = planPanelProxy(PANEL_9X16, SOURCE, transform({fit: 'cover'}));

    expect(plan?.savings).toBeCloseTo(0.5018, 3);
  });

  it('crops a 9:16 panel to the visible band and keeps the full width', () => {
    const plan = planPanelProxy(PANEL_9X16, SOURCE, transform());

    expect(plan).not.toBeNull();
    expect(plan?.crop).toEqual({left: 0, top: 554, width: 1242, height: 1100});
    // 1242x1100 of 1242x2208 — the decode drops half its pixels.
    expect(plan?.savings).toBeCloseTo(0.5018, 3);
  });

  it.each([
    ['centred', transform()],
    ['panned down', transform({y: 20})],
    ['panned up', transform({y: -20})],
    ['zoomed in', transform({scale: 1.8})],
    ['zoomed and panned', transform({scale: 1.4, x: 3, y: -12})],
  ])('puts every corner within a pixel of the original framing — %s', (_label, t) => {
    const plan = planPanelProxy(PANEL_9X16, SOURCE, t);

    expect(plan).not.toBeNull();

    if (!plan) {
      return;
    }

    // Sample the crop's own corners: if these land where they landed before, the
    // linear mapping in between does too.
    const corners = [
      [plan.crop.left, plan.crop.top],
      [plan.crop.left + plan.crop.width, plan.crop.top],
      [plan.crop.left, plan.crop.top + plan.crop.height],
      [plan.crop.left + plan.crop.width, plan.crop.top + plan.crop.height],
    ] as const;

    for (const [u, v] of corners) {
      const before = project(PANEL_9X16, SOURCE, t, u, v);
      const after = projectProxy(PANEL_9X16, plan.crop, plan.transform, u, v);

      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    }
  });

  it('stays near identity, far inside the schema limits, whatever it is given', () => {
    // The residual only absorbs the crop's rounding onto even pixels, so it
    // never approaches MIN_SCALE/MAX_SCALE or the +-50% offset clamp that would
    // silently shift the picture.
    for (const t of [
      transform(),
      transform({scale: 1.4, y: -12}),
      transform({scale: 2.5, x: 20, y: 30}),
    ]) {
      const plan = planPanelProxy(PANEL_9X16, SOURCE, t);

      expect(plan).not.toBeNull();
      expect(plan?.transform.scale).toBeGreaterThan(0.99);
      expect(plan?.transform.scale).toBeLessThan(1.01);
      // The crop has already absorbed the pan, so the residual offset is ~0
      // no matter how far the original framing was pushed.
      expect(Math.abs(plan?.transform.x ?? 0)).toBeLessThan(1);
      expect(Math.abs(plan?.transform.y ?? 0)).toBeLessThan(1);
    }
  });

  it('refuses framings that reach past the source edge', () => {
    // A landscape source in a vertical panel already shows all of its height, so
    // any vertical pan puts the visible rectangle outside it. The panel fills
    // that gap with its own background colour, which a cropped source cannot
    // reproduce through `cover`.
    const landscape: SourceSize = {width: 1920, height: 1080};

    expect(panelVisibleRect(PANEL_9X16, landscape, transform()).height).toBeCloseTo(
      1080,
      6,
    );
    expect(planPanelProxy(PANEL_9X16, landscape, transform({y: 10}))).toBeNull();
  });

  it('refuses sources that are already close to what the panel shows', () => {
    // Already panel-shaped: a crop would save 0.6%, which no transcode repays.
    const plan = planPanelProxy(PANEL_9X16, {width: 1100, height: 980}, transform());

    expect(plan).toBeNull();
    expect(MIN_PROXY_SAVINGS).toBe(0.2);
  });

  it('handles the horizontal split, where the box is landscape', () => {
    const box = splitLayout('16:9', 6).a;
    const plan = planPanelProxy(box, SOURCE, transform());

    if (!plan) {
      throw new Error('16:9 panels crop too');
    }

    expect(plan.crop.width).toBe(1242);
    // 16:9 needs 63.5% of the height, so it saves less than 9:16 does.
    expect(plan.savings).toBeLessThan(0.5018);

    for (const [u, v] of [
      [plan.crop.left, plan.crop.top],
      [plan.crop.left + plan.crop.width, plan.crop.top + plan.crop.height],
    ] as const) {
      const before = project(box, SOURCE, transform(), u, v);
      const after = projectProxy(box, plan.crop, plan.transform, u, v);

      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    }
  });
});
