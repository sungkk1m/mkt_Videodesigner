// Day1 Design Ref: §5.2 SplitFrame — the live panel plays while the other holds
// its own trim-in frame in greyscale, with the divider drawn between them.
//
// Plan SC2: the greyscale must survive into the MP4, which is why it is a CSS
// filter on the video element rather than a preview-only overlay.
import {Video} from '@remotion/media';
import {AbsoluteFill, Freeze} from 'remotion';

import {duckedVolumeAt, type NarrationWindow} from '../../domain/audio/ducking';
import type {
  ActivePanel,
  AudioRenderProps,
  Day1LabelStyle,
  Day1PanelRenderProps,
  PanelRect,
  SplitLayout,
} from '../../domain/editor/types';
import {CANVAS_COLOR} from '../shared/SceneVideo';

const JUSTIFY = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
} as const;

/**
 * Day1 Design Ref: §5.2 — heavy outlined text. `paintOrder: 'stroke'` draws the
 * stroke behind the glyph so a thick outline never eats into the letter shape,
 * which is what the reference GIF's lettering does.
 */
const PanelLabel = ({
  label,
  style,
}: {
  label: string;
  style: Day1LabelStyle;
}) => (
  <AbsoluteFill
    style={{
      alignItems: 'center',
      justifyContent: JUSTIFY[style.position],
      padding: '6%',
    }}
  >
    <span
      style={{
        color: style.textColor,
        fontFamily: 'system-ui, sans-serif',
        fontSize: style.fontSize,
        fontWeight: 900,
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        paintOrder: 'stroke',
        textAlign: 'center',
        WebkitTextStroke: `${style.outlineWidthPx}px ${style.outlineColor}`,
        whiteSpace: 'pre-wrap',
      }}
    >
      {label}
    </span>
  </AbsoluteFill>
);

const Panel = ({
  labelStyle,
  live,
  liveVolume,
  panel,
  rect,
}: {
  labelStyle: Day1LabelStyle;
  live: boolean;
  liveVolume: (panelFrame: number) => number;
  panel: Day1PanelRenderProps;
  rect: PanelRect;
}) => {
  const framing = {
    height: '100%',
    width: '100%',
    transform: `translate(${panel.x}%, ${panel.y}%) scale(${panel.scale})`,
  };

  return (
    <div
      style={{
        backgroundColor: CANVAS_COLOR,
        height: rect.height,
        left: rect.x,
        overflow: 'hidden',
        position: 'absolute',
        top: rect.y,
        width: rect.width,
      }}
    >
      {panel.url === null ? null : live ? (
        <Video
          objectFit="cover"
          src={panel.url}
          style={framing}
          trimAfter={panel.trimAfterFrames}
          trimBefore={panel.trimBeforeFrames}
          // Plan D7 / Design §5.2: the live panel carries the original sound
          // through the same ducking curve the three-scene path uses.
          volume={liveVolume}
        />
      ) : (
        // Freeze pins its children to frame 0, so `trimBefore` alone chooses
        // which source frame is held — the panel's own trim-in (Design D11).
        <Freeze frame={0}>
          <Video
            muted
            objectFit="cover"
            src={panel.url}
            style={{...framing, filter: 'grayscale(1)'}}
            trimAfter={panel.trimBeforeFrames + 1}
            trimBefore={panel.trimBeforeFrames}
          />
        </Freeze>
      )}

      {panel.label ? <PanelLabel label={panel.label} style={labelStyle} /> : null}
    </div>
  );
};

export interface SplitFrameProps {
  active: ActivePanel;
  audio: AudioRenderProps;
  labelStyle: Day1LabelStyle;
  layout: SplitLayout;
  lineColor: string;
  panelA: Day1PanelRenderProps;
  panelB: Day1PanelRenderProps;
  /** Absolute frame the section starts at, used to place the ducking windows. */
  sectionFromFrame: number;
}

export const SplitFrame = ({
  active,
  audio,
  labelStyle,
  layout,
  lineColor,
  panelA,
  panelB,
  sectionFromFrame,
}: SplitFrameProps) => {
  // Narration frames are absolute while the panel's volume callback counts from
  // the section start. Day1 ships without narration (Plan §2.2) so the list is
  // empty and the curve is flat today; going through `duckedVolumeAt` anyway is
  // what stops the two templates from drifting once narration arrives.
  const duckWindows: NarrationWindow[] = audio.narration.map((track) => ({
    fromFrame: track.fromFrame - sectionFromFrame,
    durationInFrames: track.durationInFrames,
  }));
  const liveVolume = (panelFrame: number) =>
    duckedVolumeAt(panelFrame, audio.originalVolume, duckWindows, audio.ducking);

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      <Panel
        labelStyle={labelStyle}
        live={active === 'a'}
        liveVolume={liveVolume}
        panel={panelA}
        rect={layout.a}
      />
      <Panel
        labelStyle={labelStyle}
        live={active === 'b'}
        liveVolume={liveVolume}
        panel={panelB}
        rect={layout.b}
      />

      {/* Plan SC4: the divider is a solid fill so its rendered pixels equal the
          configured hex exactly, with no blending to measure against. */}
      <div
        data-testid="day1-split-line"
        style={{
          backgroundColor: lineColor,
          height: layout.line.height,
          left: layout.line.x,
          position: 'absolute',
          top: layout.line.y,
          width: layout.line.width,
        }}
      />
    </AbsoluteFill>
  );
};
