// failure-video Design §6.4 — the FAIL stamp slamming onto the frame.
//
// It sits outside the desaturation wrapper on purpose (D-9): the footage drains
// to grey while the stamp stays full red, which is the whole point of the beat.
// The reference does the same thing.
import {Img, useCurrentFrame, useVideoConfig} from 'remotion';

import {
  failStampStyleAt,
  type FailWindow,
} from '../../domain/failure/effects';
import stampSource from './assets/fail-stamp.png';

/**
 * Plan §1.2 measured the settled stamp inside the 15-55% band of the frame
 * height and reaching past both edges. The centre of that band and a width of
 * 120% put it exactly there.
 */
const CENTRE_Y_RATIO = 0.35;
const WIDTH_RATIO = 1.2;

export const FailStamp = ({window}: {window: FailWindow}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const style = failStampStyleAt(frame, window, fps);

  // Design Goal 4 — the stamp is not on screen for most of the section, and an
  // element that is not there costs nothing at all.
  if (!style) {
    return null;
  }

  return (
    <Img
      data-testid="failure-stamp"
      src={stampSource}
      style={{
        // A blur only while the stamp is still travelling; `undefined` the
        // moment it lands, so the settled frames carry no filter.
        filter:
          style.blurRatio > 0
            ? `blur(${style.blurRatio * width}px)`
            : undefined,
        left: '50%',
        opacity: style.opacity,
        position: 'absolute',
        top: `${CENTRE_Y_RATIO * 100}%`,
        transform:
          `translate(-50%, -50%)` +
          ` rotate(${style.rotateDeg}deg)` +
          ` scale(${style.scale})`,
        width: `${WIDTH_RATIO * 100}%`,
      }}
    />
  );
};
