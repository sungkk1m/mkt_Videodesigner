// key-visual-looping Design Ref: §5.1 — the cycle, repeated, with the two fixed
// overlays over it. The Player preview and the browser render consume this same
// component and the same props snapshot.
import type {ReactNode} from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import type {
  KvLoopProps,
  KvSlotRenderProps,
} from '../domain/editor/types';
import {DisclaimerBar} from './kvloop/DisclaimerBar';
import {KvScene} from './kvloop/KvScene';
import {TitleOverlay} from './kvloop/TitleOverlay';
import {AudioLayer} from './shared/AudioLayer';
import {CANVAS_COLOR} from './shared/SceneVideo';

const Placeholder = ({message}: {message: string}) => (
  <AbsoluteFill
    style={{
      alignItems: 'center',
      backgroundColor: CANVAS_COLOR,
      color: '#6f7883',
      fontFamily: 'Arial, sans-serif',
      fontSize: 44,
      justifyContent: 'center',
      textAlign: 'center',
    }}
  >
    {message}
  </AbsoluteFill>
);

/** FR-L17 — the closing fade the reference videos end on. */
const FadeOut = ({
  frames,
  totalFrames,
}: {
  frames: number;
  totalFrames: number;
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: interpolate(
          frame,
          [Math.max(0, totalFrames - frames), Math.max(1, totalFrames - 1)],
          [0, 1],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        ),
      }}
    />
  );
};

/**
 * kv-loop-reference-motion R-4 — the gaussian bookends. One container around
 * the scenes and both overlays (D-05: a sharp title over a blurred frame reads
 * as a mistake), so the whole picture goes out of and into focus together.
 *
 * The scale rides the blur: a gaussian bleeds the canvas colour in from the
 * edges over ~3σ, so the frame is overscanned by exactly that much (FR-R10).
 * Both reach identity the moment the amount does, so there is no pop at the
 * boundary — and body frames carry no `filter` at all (NFR-R01), which keeps
 * the rasterizer's per-frame cost untouched outside the bookends.
 */
const BlurBookend = ({
  frames,
  amountPx,
  totalFrames,
  children,
}: {
  frames: number;
  amountPx: number;
  totalFrames: number;
  children: ReactNode;
}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const active = frames > 0 && amountPx > 0;
  const options = {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  } as const;
  const amount = active
    ? amountPx *
      Math.max(
        interpolate(frame, [0, frames], [1, 0], options),
        interpolate(
          frame,
          [Math.max(0, totalFrames - 1 - frames), Math.max(1, totalFrames - 1)],
          [0, 1],
          options,
        ),
      )
    : 0;

  return (
    <AbsoluteFill
      data-testid="kv-blur-bookend"
      style={
        amount > 0
          ? {
              filter: `blur(${amount}px)`,
              transform: `scale(${1 + (3 * amount) / width})`,
            }
          : undefined
      }
    >
      {children}
    </AbsoluteFill>
  );
};

export const KvLoopComposition = ({
  audio,
  blurAmountPx,
  blurInFrames,
  disclaimer,
  fadeOutFrames,
  kenBurnsIntensity,
  segments,
  slots,
  title,
  totalFrames,
  transitionInFrames,
}: KvLoopProps) => {
  const filled = slots.filter((slot) => slot.url !== null).length;

  // FR-L13 — the same threshold the render preflight gates on, so the preview
  // says what the render would refuse rather than showing a broken loop.
  if (filled < 2) {
    return <Placeholder message="키비주얼 이미지를 2장 이상 올려주세요" />;
  }

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      <BlurBookend
        amountPx={blurAmountPx}
        frames={blurInFrames}
        totalFrames={totalFrames}
      >
        {segments.map((segment, index) => {
          const last = index === segments.length - 1;

          return (
            <Sequence
              // A crossfade is the incoming segment fading in over the outgoing
              // one, so every segment but the last is held open for the overlap.
              durationInFrames={
                segment.durationInFrames + (last ? 0 : transitionInFrames)
              }
              from={segment.fromFrame}
              // The same key visual comes back every cycle, so the index alone
              // would collide.
              key={`${segment.cycle}-${segment.kvIndex}`}
              name={`kv-${segment.kvIndex} · ${segment.cycle + 1}`}
            >
              <KvScene
                fadeInFrames={index === 0 ? 0 : transitionInFrames}
                holdInFrames={segment.durationInFrames}
                slot={slots[segment.kvIndex] as KvSlotRenderProps}
              />
            </Sequence>
          );
        })}

        <TitleOverlay title={title} />
        <DisclaimerBar disclaimer={disclaimer} />
      </BlurBookend>

      {fadeOutFrames > 0 ? (
        <FadeOut frames={fadeOutFrames} totalFrames={totalFrames} />
      ) : null}

      {/* Plan L9 — BGM only; the narration list is always empty here. */}
      <AudioLayer audio={audio} />
    </AbsoluteFill>
  );
};
