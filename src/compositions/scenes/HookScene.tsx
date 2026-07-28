// Design Ref: §1.3 Hook — user copy plus the Impact, Caption, and Focus motion
// presets over the selected source interval.
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

import type {HookRenderProps} from '../../domain/editor/types';

const ENTRY_FRAMES = 18;

/** Per-preset entry motion for the headline block. */
const motionStyleAt = (
  preset: HookRenderProps['motionPreset'],
  frame: number,
): {opacity: number; transform: string; letterSpacing: number} => {
  const progress = interpolate(frame, [0, ENTRY_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (preset === 'caption') {
    return {
      opacity: progress,
      transform: `translateY(${(1 - progress) * 12}%)`,
      letterSpacing: 0,
    };
  }

  if (preset === 'focus') {
    return {
      opacity: progress,
      transform: 'none',
      letterSpacing: interpolate(progress, [0, 1], [0.25, 0], {
        extrapolateRight: 'clamp',
      }),
    };
  }

  // impact: a short overshoot that settles at full size.
  const scale = interpolate(progress, [0, 0.7, 1], [0.7, 1.06, 1], {
    extrapolateRight: 'clamp',
  });

  return {opacity: progress, transform: `scale(${scale})`, letterSpacing: 0};
};

export const HookScene = ({hook}: {hook: HookRenderProps}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const motion = motionStyleAt(hook.motionPreset, frame);
  // Focus dims harder so the headline carries the frame.
  const dimOpacity = hook.dimBackground
    ? hook.motionPreset === 'focus'
      ? 0.55
      : 0.35
    : 0;

  if (!hook.headline && !hook.subcopy) {
    return null;
  }

  return (
    <AbsoluteFill>
      {dimOpacity > 0 ? (
        <AbsoluteFill
          style={{backgroundColor: `rgba(0, 0, 0, ${dimOpacity})`}}
        />
      ) : null}

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: width * 0.02,
            opacity: motion.opacity,
            textAlign: 'center',
            transform: motion.transform,
          }}
        >
          <span
            style={{
              color: '#ffffff',
              fontFamily: 'system-ui, sans-serif',
              fontSize: width * 0.095,
              fontWeight: 800,
              letterSpacing: `${motion.letterSpacing}em`,
              lineHeight: 1.15,
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.55)',
            }}
          >
            {hook.headline}
          </span>

          {hook.subcopy ? (
            <span
              style={{
                color: '#dfe3e8',
                fontFamily: 'system-ui, sans-serif',
                fontSize: width * 0.042,
                fontWeight: 500,
                textShadow: '0 2px 14px rgba(0, 0, 0, 0.5)',
              }}
            >
              {hook.subcopy}
            </span>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
