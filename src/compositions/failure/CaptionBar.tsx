// failure-video Design §6.5 — the black bar across the bottom of every level
// segment, with `LEVEL N` centred in it.
//
// `DisclaimerBar`'s successor: same "one line of copy pinned to the bottom, and
// it never wraps" idea, with the bar the reference actually has behind it. A
// line too long to fit is a copy problem the operator fixes, not something the
// render silently reflows.
import {useVideoConfig} from 'remotion';

import type {PanelRect} from '../../domain/editor/types';

export interface CaptionStyle {
  /** px against a 1920-high canvas — see the scaling below. */
  fontSize: number;
  textColor: string;
  barColor: string;
}

/**
 * Design D-3 — the stored size is measured against a 1920-high frame, and every
 * other canvas scales from it. Without this, one number would mean two different
 * physical sizes at 9:16 (1920 high) and 16:9 (1080 high): the same caption
 * would be nearly twice as tall in the landscape cut.
 */
const REFERENCE_FRAME_HEIGHT = 1920;

export const CaptionBar = ({
  rect,
  style,
  text,
}: {
  rect: PanelRect;
  style: CaptionStyle;
  text: string;
}) => {
  const {height} = useVideoConfig();

  return (
    <div
      data-testid="failure-caption-bar"
      style={{
        alignItems: 'center',
        backgroundColor: style.barColor,
        display: 'flex',
        height: rect.height,
        justifyContent: 'center',
        left: rect.x,
        position: 'absolute',
        top: rect.y,
        width: rect.width,
      }}
    >
      {/* An empty caption hides the text and keeps the bar: the bar is what
          holds the frame's composition steady from segment to segment. */}
      {text ? (
        <span
          style={{
            color: style.textColor,
            fontFamily: 'system-ui, sans-serif',
            fontSize: style.fontSize * (height / REFERENCE_FRAME_HEIGHT),
            fontWeight: 800,
            letterSpacing: '0.04em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
      ) : null}
    </div>
  );
};
