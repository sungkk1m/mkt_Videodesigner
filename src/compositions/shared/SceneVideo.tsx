// Shared full-frame source layer. Design Ref: §1.3 "Ratio edit: default cover,
// with scale/X/Y" — framing is identical in the Player and in the render.
import {Video} from '@remotion/media';
import {AbsoluteFill} from 'remotion';

export const CANVAS_COLOR = '#0b0d10';

export interface SceneVideoProps {
  src: string;
  trimBeforeFrames: number;
  trimAfterFrames: number;
  scale: number;
  x: number;
  y: number;
  /** CSS blur radius in pixels, used by the generated CTA background. */
  blur?: number;
  muted?: boolean;
  /** Per-frame gain so ducking is identical in preview and render. */
  volume?: number | ((frame: number) => number);
}

export const SceneVideo = ({
  src,
  trimBeforeFrames,
  trimAfterFrames,
  scale,
  x,
  y,
  blur = 0,
  muted = false,
  volume = 1,
}: SceneVideoProps) => (
  <AbsoluteFill style={{backgroundColor: CANVAS_COLOR, overflow: 'hidden'}}>
    <Video
      muted={muted}
      objectFit="cover"
      volume={volume}
      src={src}
      style={{
        height: '100%',
        width: '100%',
        transform: `translate(${x}%, ${y}%) scale(${scale})`,
        ...(blur > 0 ? {filter: `blur(${blur}px)`} : {}),
      }}
      trimAfter={trimAfterFrames}
      trimBefore={trimBeforeFrames}
    />
  </AbsoluteFill>
);
