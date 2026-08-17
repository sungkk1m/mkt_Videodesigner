// Day1 Design Ref: §5.3 EndCardScene — two layers: the finished bannerdesigner
// export as the background, and the app icon again on top so it can animate.
//
// Plan D4 / Design §5.3: the banner already has the icon painted into it, so any
// overlay motion that drops below scale 1 uncovers the baked-in copy. Every
// preset below therefore stays at scale >= 1.
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {endCardAudioVolumeAt} from '../../domain/day1/endCard';
import type {
  Day1CardMotion,
  Day1EndCardRenderProps,
  Day1IconAnimation,
  NormalizedRect,
} from '../../domain/editor/types';
import {CANVAS_COLOR, SceneVideo} from '../shared/SceneVideo';

/** Ken Burns pushes in by this much across the whole section. */
const KEN_BURNS_END_SCALE = 1.06;
const FADE_IN_SECONDS = 0.4;

const POP_AMPLITUDE = 0.12;
const POP_RISE_SECONDS = 0.35;
const POP_SETTLE_SECONDS = 0.45;

const PULSE_AMPLITUDE = 0.06;
const PULSE_PERIOD_SECONDS = 1.2;

const GLOW_PERIOD_SECONDS = 1.6;
const GLOW_MIN_ALPHA = 0.15;
const GLOW_MAX_ALPHA = 0.55;

/**
 * A 0..1 wave that starts and ends at 0, so a looping preset never jumps on its
 * first frame the way a raw sine would.
 */
const wave = (frame: number, fps: number, periodSeconds: number) =>
  (1 - Math.cos((2 * Math.PI * frame) / (periodSeconds * fps))) / 2;

const cardStyle = (
  motion: Day1CardMotion,
  frame: number,
  fps: number,
  durationInFrames: number,
): React.CSSProperties => {
  if (motion === 'ken-burns') {
    return {
      transform: `scale(${interpolate(
        frame,
        [0, Math.max(1, durationInFrames - 1)],
        [1, KEN_BURNS_END_SCALE],
        {extrapolateRight: 'clamp'},
      )})`,
    };
  }

  if (motion === 'fade') {
    return {
      opacity: interpolate(frame, [0, FADE_IN_SECONDS * fps], [0, 1], {
        extrapolateRight: 'clamp',
      }),
    };
  }

  return {};
};

const iconStyle = (
  animation: Day1IconAnimation,
  frame: number,
  fps: number,
): React.CSSProperties => {
  if (animation === 'pop') {
    // Spring for the rise, then a linear release back to rest: 1.0 -> 1.12 -> 1.0.
    const riseFrames = POP_RISE_SECONDS * fps;
    const rise = spring({
      frame,
      fps,
      durationInFrames: Math.round(riseFrames),
      config: {damping: 12},
    });
    const settle = interpolate(
      frame,
      [riseFrames, riseFrames + POP_SETTLE_SECONDS * fps],
      [1, 0],
      {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
    );

    return {transform: `scale(${1 + POP_AMPLITUDE * rise * settle})`};
  }

  if (animation === 'pulse') {
    return {
      transform: `scale(${
        1 + PULSE_AMPLITUDE * wave(frame, fps, PULSE_PERIOD_SECONDS)
      })`,
    };
  }

  if (animation === 'glow') {
    // No transform at all — the safest preset against the baked-in icon.
    const alpha = interpolate(
      wave(frame, fps, GLOW_PERIOD_SECONDS),
      [0, 1],
      [GLOW_MIN_ALPHA, GLOW_MAX_ALPHA],
    );

    return {boxShadow: `0 0 48px 12px rgba(255, 255, 255, ${alpha})`};
  }

  return {};
};

const IconOverlay = ({
  animation,
  rect,
  url,
}: {
  animation: Day1IconAnimation;
  rect: NormalizedRect;
  url: string;
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  return (
    <div
      data-testid="day1-endcard-icon"
      style={{
        borderRadius: rect.radius * width,
        height: rect.h * height,
        left: rect.x * width,
        overflow: 'hidden',
        position: 'absolute',
        top: rect.y * height,
        // Grow outward from the icon's own centre so it keeps covering the copy
        // painted into the banner underneath.
        transformOrigin: 'center center',
        width: rect.w * width,
        ...iconStyle(animation, frame, fps),
      }}
    >
      <Img src={url} style={{height: '100%', objectFit: 'cover', width: '100%'}} />
    </div>
  );
};

export const EndCardScene = ({
  durationInFrames,
  endCard,
}: {
  durationInFrames: number;
  endCard: Day1EndCardRenderProps;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Endcard-Video Design §2.1 — `mode` is the single truth; the other
  // treatment's fields are inactive, not absent (D-02/D-03).
  if (endCard.mode === 'video') {
    return (
      <AbsoluteFill style={{backgroundColor: CANVAS_COLOR, overflow: 'hidden'}}>
        {endCard.videoUrl ? (
          <AbsoluteFill
            style={cardStyle(endCard.cardMotion, frame, fps, durationInFrames)}
          >
            {/* Always looping is branch-free and correct in both cases: a
                source >= 3s has a window exactly as long as the card, so the
                loop never fires; a shorter one loops to fill it (D-01).
                day1-endcard-audio FR-01/FR-03 — the card's own audio follows
                the trim window and the loop, gated by the toggle, with the
                closing fade computed by the shared pure function so the
                Player and the renderer agree. */}
            <SceneVideo
              loop
              muted={!endCard.videoAudioEnabled}
              scale={1}
              src={endCard.videoUrl}
              trimAfterFrames={endCard.videoTrimAfterFrames}
              trimBeforeFrames={endCard.videoTrimBeforeFrames}
              volume={(videoFrame) =>
                endCardAudioVolumeAt(
                  videoFrame,
                  fps,
                  durationInFrames,
                  endCard.videoAudioVolume,
                )
              }
              x={0}
              y={0}
            />
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR, overflow: 'hidden'}}>
      {endCard.bannerUrl ? (
        <AbsoluteFill
          style={cardStyle(endCard.cardMotion, frame, fps, durationInFrames)}
        >
          <Img
            src={endCard.bannerUrl}
            style={{height: '100%', objectFit: 'cover', width: '100%'}}
          />
        </AbsoluteFill>
      ) : null}

      {/* Design §5.3: `none` means show the banner exactly as exported. */}
      {endCard.iconUrl && endCard.iconAnimation !== 'none' ? (
        <IconOverlay
          animation={endCard.iconAnimation}
          rect={endCard.iconRect}
          url={endCard.iconUrl}
        />
      ) : null}
    </AbsoluteFill>
  );
};
