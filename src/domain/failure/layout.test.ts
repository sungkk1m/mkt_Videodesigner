// failure-video Design §8.1 — the geometry, over both ratios the template has.
import {describe, expect, it} from 'vitest';

import {failureLayout} from './layout';
import {failureOrientationFor, failureOrientationsFor} from './orientation';
import {FAILURE_CAPTION_RATIO, FAILURE_RATIOS, RATIO_DIMENSIONS} from '../editor/types';

describe('failureLayout', () => {
  it('splits the frame into a video band and a caption bar that add up exactly', () => {
    for (const ratio of FAILURE_RATIOS) {
      const {width, height} = RATIO_DIMENSIONS[ratio];
      const {video, caption} = failureLayout(ratio);

      // A one-pixel gap between the two would show as a seam in the render.
      expect(video.height + caption.height).toBe(height);
      expect(video.width).toBe(width);
      expect(caption.width).toBe(width);
      expect(video.x).toBe(0);
      expect(video.y).toBe(0);
      expect(caption.y).toBe(video.height);
    }
  });

  it('puts the bar at the measured 10% of the frame height', () => {
    for (const ratio of FAILURE_RATIOS) {
      const {height} = RATIO_DIMENSIONS[ratio];

      expect(failureLayout(ratio).caption.height).toBe(
        Math.round(height * FAILURE_CAPTION_RATIO),
      );
    }
  });

  it('produces the documented pixel sizes', () => {
    expect(failureLayout('9:16')).toEqual({
      video: {x: 0, y: 0, width: 1080, height: 1728},
      caption: {x: 0, y: 1728, width: 1080, height: 192},
    });
    expect(failureLayout('16:9')).toEqual({
      video: {x: 0, y: 0, width: 1920, height: 972},
      caption: {x: 0, y: 972, width: 1920, height: 108},
    });
  });
});

describe('failureOrientationFor', () => {
  it('maps each supported ratio to its source group', () => {
    expect(failureOrientationFor('9:16')).toBe('vertical');
    expect(failureOrientationFor('16:9')).toBe('horizontal');
  });

  it('collapses a ratio list to the groups it actually needs', () => {
    expect(failureOrientationsFor(['9:16'])).toEqual(['vertical']);
    expect(failureOrientationsFor(['16:9'])).toEqual(['horizontal']);
    expect(failureOrientationsFor(['9:16', '16:9'])).toEqual([
      'vertical',
      'horizontal',
    ]);
    expect(failureOrientationsFor([])).toEqual([]);
  });
});
