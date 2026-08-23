// kv-motion-effects Design Ref: §8.1. The arithmetic is the whole feature, so it
// is pinned here rather than inferred from a render — a wrong sign in
// `rectToTransform` moves the camera the other way and nothing else would say so.
import {describe, expect, it} from 'vitest';

import {
  KV_MOTION_MAX_PRESET_SCALE,
  KV_MOTION_MAX_SCALE,
} from '../editor/constants';
import type {KvMotion} from '../editor/types';
import {
  FULL_KV_RECT,
  MIN_KV_RECT_SIZE,
  clampKvRect,
  effectiveKvMotion,
  isKvMotionStill,
  lerpKvRect,
  rectToTransform,
  resolveKvMotion,
} from './motion';
import {kvLoopProjectFixture} from '../../test/fixtures/project';
import {kvLoopOf} from '../editor/project';

const preset = (name: string): KvMotion =>
  ({kind: 'preset', preset: name} as KvMotion);

describe('rectToTransform', () => {
  it('leaves the whole frame alone — U-1', () => {
    // The regression baseline: no motion has to mean exactly today's transform.
    expect(rectToTransform(FULL_KV_RECT)).toEqual({
      scale: 1,
      xPercent: 0,
      yPercent: 0,
    });
  });

  it('doubles a centred half without shifting it — U-2', () => {
    expect(rectToTransform({x: 0.25, y: 0.25, size: 0.5})).toEqual({
      scale: 2,
      xPercent: 0,
      yPercent: 0,
    });
  });

  it('brings the top-left quadrant to the centre — U-3', () => {
    // Off-centre is where a sign error hides: the element has to move *right*
    // and *down* for the top-left of the picture to end up on screen.
    expect(rectToTransform({x: 0, y: 0, size: 0.5})).toEqual({
      scale: 2,
      xPercent: 50,
      yPercent: 50,
    });
  });

  it('mirrors that for the bottom-right quadrant', () => {
    expect(rectToTransform({x: 0.5, y: 0.5, size: 0.5})).toEqual({
      scale: 2,
      xPercent: -50,
      yPercent: -50,
    });
  });
});

describe('resolveKvMotion — presets', () => {
  it('ends zoomIn exactly at the preset ceiling — U-4', () => {
    const {from, to, easing} = resolveKvMotion(preset('zoomIn'), 1);

    expect(from).toEqual(FULL_KV_RECT);
    expect(rectToTransform(to).scale).toBeCloseTo(KV_MOTION_MAX_PRESET_SCALE, 10);
    expect(easing).toBe('easeOut');
  });

  it('is the intensity fraction of that ceiling in between', () => {
    // 0.5 is the intensity in real use, and 1.04 is the 42px that started this
    // cycle. Pinned so widening the ceiling cannot silently change the mapping.
    expect(
      rectToTransform(resolveKvMotion(preset('zoomIn'), 0.5).to).scale,
    ).toBeCloseTo(1.1, 10);
  });

  it('runs zoomOut as zoomIn reversed — U-5', () => {
    const zoomIn = resolveKvMotion(preset('zoomIn'), 0.7);
    const zoomOut = resolveKvMotion(preset('zoomOut'), 0.7);

    expect(zoomOut.from).toEqual(zoomIn.to);
    expect(zoomOut.to).toEqual(zoomIn.from);
  });

  it('travels one axis per pan, and only that axis — U-6', () => {
    for (const [name, axis, other] of [
      ['panLeftToRight', 'x', 'y'],
      ['panRightToLeft', 'x', 'y'],
      ['panTopToBottom', 'y', 'x'],
      ['panBottomToTop', 'y', 'x'],
    ] as const) {
      const {from, to, easing} = resolveKvMotion(preset(name), 1);

      expect({name, moved: from[axis] !== to[axis]}).toEqual({name, moved: true});
      expect({name, still: from[other] === to[other]}).toEqual({
        name,
        still: true,
      });
      // A pan holds its zoom; only the position changes.
      expect({name, size: from.size}).toEqual({name, size: to.size});
      // Linear, because easing a pan reads as the camera stopping.
      expect({name, easing}).toEqual({name, easing: 'linear'});
    }
  });

  it('points the two horizontal pans in opposite directions', () => {
    const rightward = resolveKvMotion(preset('panLeftToRight'), 1);
    const leftward = resolveKvMotion(preset('panRightToLeft'), 1);

    expect(rightward.to.x).toBeGreaterThan(rightward.from.x);
    expect(leftward.to.x).toBeLessThan(leftward.from.x);
  });

  it('collapses every preset to a still at intensity zero — U-7', () => {
    for (const name of [
      'zoomIn',
      'zoomOut',
      'panLeftToRight',
      'panTopToBottom',
    ] as const) {
      const {from, to} = resolveKvMotion(preset(name), 0);

      expect({name, from, to}).toEqual({
        name,
        from: FULL_KV_RECT,
        to: FULL_KV_RECT,
      });
    }
  });

  it('holds a still still at any intensity', () => {
    const {from, to} = resolveKvMotion(preset('still'), 1);

    expect(from).toEqual(FULL_KV_RECT);
    expect(to).toEqual(FULL_KV_RECT);
  });
});

describe('resolveKvMotion — drawn pairs', () => {
  const custom: KvMotion = {
    kind: 'custom',
    from: {x: 0.1, y: 0.2, size: 0.4},
    to: {x: 0, y: 0, size: 1},
  };

  it('ignores intensity — U-8 / I-4', () => {
    // The rectangles already say how far the camera goes. Letting the slider
    // rescale them would make the preview disagree with what was drawn.
    expect(resolveKvMotion(custom, 0)).toEqual(resolveKvMotion(custom, 1));
    expect(resolveKvMotion(custom, 0.3).from).toEqual(custom.from);
  });

  it('eases both ends, unlike a preset', () => {
    expect(resolveKvMotion(custom, 0.5).easing).toBe('easeInOut');
  });

  it('clamps a stored pair that reaches outside the frame', () => {
    const outside: KvMotion = {
      kind: 'custom',
      from: {x: 0.9, y: 0.9, size: 0.5},
      to: {x: 0, y: 0, size: 1},
    };

    expect(resolveKvMotion(outside, 0.5).from).toEqual({
      x: 0.5,
      y: 0.5,
      size: 0.5,
    });
  });
});

describe('clampKvRect — U-9', () => {
  it('folds a rectangle back inside the frame', () => {
    expect(clampKvRect({x: 2, y: -1, size: 0.5})).toEqual({
      x: 0.5,
      y: 0,
      size: 0.5,
    });
  });

  it('stops shrinking at the one hard bound', () => {
    expect(clampKvRect({x: 0, y: 0, size: 0.01}).size).toBeCloseTo(
      1 / KV_MOTION_MAX_SCALE,
      10,
    );
    expect(MIN_KV_RECT_SIZE).toBeCloseTo(1 / KV_MOTION_MAX_SCALE, 10);
  });

  it('never grows past the whole frame', () => {
    expect(clampKvRect({x: 0.4, y: 0.4, size: 4})).toEqual({
      x: 0,
      y: 0,
      size: 1,
    });
  });
});

describe('lerpKvRect — U-10', () => {
  const from = {x: 0, y: 0, size: 1};
  const to = {x: 0.25, y: 0.5, size: 0.5};

  it('returns the endpoints at 0 and 1', () => {
    expect(lerpKvRect(from, to, 0)).toEqual(from);
    expect(lerpKvRect(from, to, 1)).toEqual(to);
  });

  it('sits halfway at 0.5', () => {
    expect(lerpKvRect(from, to, 0.5)).toEqual({
      x: 0.125,
      y: 0.25,
      size: 0.75,
    });
  });
});

describe('effectiveKvMotion', () => {
  const settings = () => {
    const loop = kvLoopOf(kvLoopProjectFixture());

    if (!loop) {
      throw new Error('fixture is not a looping project');
    }

    return loop;
  };

  it('falls back to the loop default when a slot has none — D-04', () => {
    const loop = settings();

    expect(loop.slots[0]?.motion).toBeNull();
    expect(effectiveKvMotion(loop, 0)).toEqual(loop.motion);
  });

  it('prefers the slot when it has one', () => {
    const loop = settings();
    const own = preset('panBottomToTop');

    expect(
      effectiveKvMotion(
        {...loop, slots: [{...loop.slots[0]!, motion: own}, ...loop.slots.slice(1)]},
        0,
      ),
    ).toEqual(own);
  });

  it('tells a chosen still from a moving preset', () => {
    expect(isKvMotionStill(preset('still'))).toBe(true);
    expect(isKvMotionStill(preset('zoomIn'))).toBe(false);
    expect(
      isKvMotionStill({
        kind: 'custom',
        from: FULL_KV_RECT,
        to: FULL_KV_RECT,
      }),
    ).toBe(false);
  });
});
