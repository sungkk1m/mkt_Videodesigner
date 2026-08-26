// key-visual-looping Design Ref: §5.2 — one key visual, held for its segment,
// with the Ken Burns push and the crossfade that carries it in.
//
// The framing controls are the same `objectFit` + translate/scale pair
// `SceneVideo` uses, so moving a still around feels like moving footage around.
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import type {KvEasing, KvSlotRenderProps} from '../../domain/editor/types';
import {lerpKvRect, rectToTransform} from '../../domain/kvloop/motion';
import {CANVAS_COLOR} from '../shared/SceneVideo';
import {KvEffectsCanvas} from './KvEffectsCanvas';

/**
 * day1-video's blurred backdrop, for a still. `contain` keeps the whole key
 * visual, and this fills what it leaves so the space reads as part of the art
 * rather than as dead canvas (FR-L19). Sized against the frame width, as
 * `SplitFrame` sizes it against the panel width, so it looks the same at any
 * output size. Overscanned because a blur fades an element out at its own edges.
 */
const BACKDROP_BLUR_RATIO = 0.05;
const BACKDROP_OVERSCAN = 1.2;

/**
 * kv-motion-effects Design Ref: §2.1 — the domain names the curve and this maps
 * it, because `domain` may not import Remotion.
 */
const EASING: Record<KvEasing, (input: number) => number> = {
  linear: (input) => input,
  easeOut: Easing.out(Easing.cubic),
  easeInOut: Easing.inOut(Easing.cubic),
};

export interface KvSceneProps {
  slot: KvSlotRenderProps;
  /** The segment's own length, so the move finishes exactly as it ends. */
  holdInFrames: number;
  /** Zero on the opening segment, which has nothing to fade in from. */
  fadeInFrames: number;
}

export const KvScene = ({
  slot,
  holdInFrames,
  fadeInFrames,
}: KvSceneProps) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();

  // kv-motion-effects §5 — one interpolation for every motion there is. The
  // clamp stays: a segment is held open for the crossfade that follows it, and
  // holding the last camera position through that overlap is what a cut looks
  // like from the incoming side.
  //
  // kv-loop-reference-motion R-1/R-2 — a round trip is the same interpolation
  // with a third stop: the peak sits at the hold's exact centre (fractional on
  // an even count, so symmetry is exact) and the last frame is back at 0. That
  // zero is what makes a cut into the next hold seamless (FR-R03), and the
  // easing applies per segment, so the peak velocity is zero on both sides.
  const last = Math.max(1, holdInFrames - 1);
  const progress = interpolate(
    frame,
    slot.motion.roundTrip ? [0, last / 2, last] : [0, last],
    slot.motion.roundTrip ? [0, 1, 0] : [0, 1],
    {easing: EASING[slot.motion.easing], extrapolateRight: 'clamp'},
  );
  const {
    scale: motionScale,
    xPercent,
    yPercent,
  } = rectToTransform(lerpKvRect(slot.motion.from, slot.motion.to, progress));
  // kv-object-animation §4.1 — one transform string for the image and the
  // effect layer. Same layout box + same transform = one coordinate space, so
  // the effects follow the camera and the operator's framing by construction.
  const sceneTransform =
    `translate(${slot.x + xPercent}%, ${slot.y + yPercent}%) ` +
    `scale(${slot.scale * motionScale})`;
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
                  transform: `scale(${BACKDROP_OVERSCAN * motionScale})`,
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
                transform: sceneTransform,
                width: '100%',
              }}
            />
          </AbsoluteFill>

          {/* kv-object-animation NFR-O01 — no effects, no canvas element: a
              project without designations keeps its exact render tree. */}
          {slot.effects.length > 0 ? (
            <AbsoluteFill>
              <KvEffectsCanvas
                effects={slot.effects}
                transform={sceneTransform}
              />
            </AbsoluteFill>
          ) : null}
        </>
      )}
    </AbsoluteFill>
  );
};
