import {describe, expect, it} from 'vitest';

import type {TransitionRenderProps} from '../editor/types';
import {transitionStyleAt} from './transition';

const CUT: TransitionRenderProps = {kind: 'cut', durationInFrames: 0};
const FADE: TransitionRenderProps = {kind: 'fade', durationInFrames: 10};
const ZOOM: TransitionRenderProps = {kind: 'zoom', durationInFrames: 10};

describe('transitionStyleAt', () => {
  it('leaves a cut scene untouched for its whole range', () => {
    for (const frame of [0, 30, 59]) {
      expect(transitionStyleAt(frame, 60, CUT, CUT)).toEqual({
        opacity: 1,
        scale: 1,
      });
    }
  });

  it('fades in over the incoming transition and reaches full opacity', () => {
    expect(transitionStyleAt(0, 60, FADE, CUT).opacity).toBeCloseTo(0.1);
    expect(transitionStyleAt(9, 60, FADE, CUT).opacity).toBe(1);
    expect(transitionStyleAt(20, 60, FADE, CUT).opacity).toBe(1);
  });

  it('fades out over the last frames of the scene', () => {
    expect(transitionStyleAt(49, 60, CUT, FADE).opacity).toBeCloseTo(1);
    expect(transitionStyleAt(55, 60, CUT, FADE).opacity).toBeCloseTo(0.5);
    expect(transitionStyleAt(59, 60, CUT, FADE).opacity).toBeCloseTo(0.1);
  });

  it('scales while zooming and settles back to 1', () => {
    expect(transitionStyleAt(0, 60, ZOOM, CUT).scale).toBeGreaterThan(1);
    expect(transitionStyleAt(9, 60, ZOOM, CUT).scale).toBe(1);
    expect(transitionStyleAt(59, 60, CUT, ZOOM).scale).toBeGreaterThan(1);
  });

  it('never leaves opacity outside 0..1 at the boundaries', () => {
    for (let frame = 0; frame < 60; frame += 1) {
      const {opacity} = transitionStyleAt(frame, 60, FADE, FADE);

      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });
});
