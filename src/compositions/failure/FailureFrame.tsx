// failure-video Design §6.3 — one level segment's frame: the footage in the
// upper band, the caption bar under it, and on level 1 the FAIL beat over both.
//
// The layer order is the measurement (Plan §1.2-4, §1.3) turned into a tree, and
// Design D-9 is the rule it encodes:
//
//   - the punch transition and the impact shake move the WHOLE frame, caption
//     bar included, so they sit on the outer wrapper;
//   - the FAIL zoom and the colour drain touch the FOOTAGE only, so they sit on
//     a wrapper inside it — during the lead-in the caption holds still;
//   - the stamp is outside the drain wrapper, so it stays red on a grey frame.
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

import {duckedVolumeAt, type NarrationWindow} from '../../domain/audio/ducking';
import {
  failShakeAt,
  failVideoStyleAt,
  zoomPunchAt,
  type FailWindow,
  type FailureEdges,
} from '../../domain/failure/effects';
import type {FailureLayout} from '../../domain/failure/layout';
import type {
  AudioRenderProps,
  Day1LabelStyle,
  Day1PanelRenderProps,
  FailureProps,
} from '../../domain/editor/types';
import {CANVAS_COLOR} from '../shared/SceneVideo';
import {Panel} from '../day1/Panel';
import {CaptionBar} from './CaptionBar';
import {FailStamp} from './FailStamp';

/**
 * `Panel` takes a label style, and a failure segment has no label — the caption
 * bar carries the text instead, so every panel's `label` is `''` and `Panel`
 * never mounts its overlay. This satisfies the prop without pulling the whole
 * Day1 defaults module into the composition layer.
 */
const NO_LABEL: Day1LabelStyle = {
  fontSize: 0,
  textColor: '#ffffff',
  outlineColor: '#000000',
  outlineWidthPx: 0,
  position: 'top',
  showBackground: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  glowEnabled: false,
  glowColor: '#000000',
  glowStrengthPx: 0,
  boxGlowEnabled: false,
  boxGlowColor: '#000000',
  boxGlowStrengthPx: 0,
};

export const FailureFrame = ({
  audio,
  caption,
  captionStyle,
  durationInFrames,
  edges,
  fail,
  failWindow,
  layout,
  panel,
  sectionFromFrame,
  showFail,
}: {
  audio: AudioRenderProps;
  caption: string;
  captionStyle: FailureProps['captionStyle'];
  durationInFrames: number;
  edges: FailureEdges;
  fail: FailureProps['fail'];
  /** Null on every segment but level 1, where the beat lives (Plan D-3). */
  failWindow: FailWindow | null;
  layout: FailureLayout;
  panel: Day1PanelRenderProps;
  /** Absolute frame the section starts at, used to place the ducking windows. */
  sectionFromFrame: number;
  showFail: boolean;
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  // The same correction `SplitFrame` and `QuadFrame` make: narration frames are
  // absolute while a panel's volume callback counts from the section start.
  const duckWindows: NarrationWindow[] = audio.narration.map((track) => ({
    fromFrame: track.fromFrame - sectionFromFrame,
    durationInFrames: track.durationInFrames,
  }));
  const liveVolume = (panelFrame: number) =>
    duckedVolumeAt(panelFrame, audio.originalVolume, duckWindows, audio.ducking);

  const punch = zoomPunchAt(frame, durationInFrames, fps, edges);
  const shake =
    showFail && fail.shakeEnabled && failWindow
      ? failShakeAt(frame, failWindow, fps)
      : null;
  const video =
    showFail && failWindow
      ? failVideoStyleAt(frame, failWindow, fail)
      : null;

  // Design Goal 4 — a frame with no effect on it gets `undefined`, not
  // `scale(1)`. An always-present `filter` cost the quad template 2.13x its
  // render time, which is the measurement this rule exists for.
  const frameTransform =
    punch || shake
      ? [
          shake ? `translate(${shake.dx * width}px, ${shake.dy * height}px)` : '',
          punch ? `scale(${punch.scale})` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : undefined;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CANVAS_COLOR,
        filter:
          punch && punch.blurRatio > 0
            ? `blur(${punch.blurRatio * width}px)`
            : undefined,
        transform: frameTransform,
      }}
    >
      <div
        style={{
          height: layout.video.height,
          left: layout.video.x,
          overflow: 'hidden',
          position: 'absolute',
          top: layout.video.y,
          width: layout.video.width,
          ...(video
            ? {
                filter:
                  video.grayscale > 0
                    ? `grayscale(${video.grayscale})`
                    : undefined,
                transform: `scale(${video.scale})`,
                // FR-12 — the dying character is not always centre frame.
                transformOrigin: `${video.originX}% ${video.originY}%`,
              }
            : {}),
        }}
      >
        {/* day1-quad D-1's dividend: `Panel` is presentational, so a single
            full-width segment reuses it untouched — trim, framing, the
            `contain` backdrop, and the ducked original audio all come free. */}
        <Panel
          labelStyle={NO_LABEL}
          live
          liveVolume={liveVolume}
          panel={panel}
          rect={{
            x: 0,
            y: 0,
            width: layout.video.width,
            height: layout.video.height,
          }}
        />
      </div>

      {showFail && fail.stampEnabled && failWindow ? (
        <FailStamp window={failWindow} />
      ) : null}

      <CaptionBar rect={layout.caption} style={captionStyle} text={caption} />
    </AbsoluteFill>
  );
};
