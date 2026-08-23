// key-visual-looping Design Ref: §5.2 — one key visual, held for its segment,
// with the Ken Burns push and the crossfade that carries it in.
//
// The framing controls are the same `objectFit` + translate/scale pair
// `SceneVideo` uses, so moving a still around feels like moving footage around.
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {
  KV_LOOP_MAX_KEN_BURNS_SCALE,
  type KvSlotRenderProps,
} from '../../domain/editor/types';
import {CANVAS_COLOR} from '../shared/SceneVideo';

/**
 * day1-video's blurred backdrop, for a still. `contain` keeps the whole key
 * visual, and this fills what it leaves so the space reads as part of the art
 * rather than as dead canvas (FR-L19). Sized against the frame width, as
 * `SplitFrame` sizes it against the panel width, so it looks the same at any
 * output size. Overscanned because a blur fades an element out at its own edges.
 */
const BACKDROP_BLUR_RATIO = 0.05;
const BACKDROP_OVERSCAN = 1.2;

export interface KvSceneProps {
  slot: KvSlotRenderProps;
  /** 0-1, scaled to `KV_LOOP_MAX_KEN_BURNS_SCALE` at 1. */
  intensity: number;
  /** The segment's own length, so the push finishes exactly as it ends. */
  holdInFrames: number;
  /** Zero on the opening segment, which has nothing to fade in from. */
  fadeInFrames: number;
}

export const KvScene = ({
  slot,
  intensity,
  holdInFrames,
  fadeInFrames,
}: KvSceneProps) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();

  const kenBurnsScale = slot.kenBurns
    ? interpolate(
        frame,
        [0, Math.max(1, holdInFrames - 1)],
        [1, 1 + intensity * (KV_LOOP_MAX_KEN_BURNS_SCALE - 1)],
        {extrapolateRight: 'clamp'},
      )
    : 1;
  const opacity =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], {
          extrapolateRight: 'clamp',
        })
      : 1;

  return (
    <AbsoluteFill style={{opacity, overflow: 'hidden'}}>
      {/* An empty slot is not an error: its segment shows the canvas and the
          loop carries on (Design §7). */}
      {slot.url === null ? (
        <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}} />
      ) : (
        <>
          {slot.fit === 'contain' ? (
            <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
              <Img
                src={slot.url}
                style={{
                  filter: `blur(${BACKDROP_BLUR_RATIO * width}px)`,
                  height: '100%',
                  objectFit: 'cover',
                  transform: `scale(${BACKDROP_OVERSCAN * kenBurnsScale})`,
                  width: '100%',
                }}
              />
            </AbsoluteFill>
          ) : null}

          <AbsoluteFill>
            <Img
              data-testid="kv-scene-image"
              src={slot.url}
              style={{
                height: '100%',
                objectFit: slot.fit,
                transform:
                  `translate(${slot.x}%, ${slot.y}%) ` +
                  `scale(${slot.scale * kenBurnsScale})`,
                width: '100%',
              }}
            />
          </AbsoluteFill>
        </>
      )}
    </AbsoluteFill>
  );
};
