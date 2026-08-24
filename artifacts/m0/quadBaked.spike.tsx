// M0 SPIKE — the degradation variant Plan §7 R1 names: the `contain` backdrop as
// a pre-blurred bitmap instead of a live-blurred video element.
//
// Why this can work at all: the real backdrop is ALREADY a still. It is
// `<Freeze frame={0}>` over the source with objectFit:cover, scale(1.2) and
// `blur(0.05 * cellWidth)`. Nothing about it changes between frames — but the
// renderer re-rasterises the blur and re-draws the video element on every one of
// the 450 frames. Baking it removes both costs.
//
// Everything except the backdrop is identical to `quadFrame.spike.tsx`.
import {Video} from '@remotion/media';
import {AbsoluteFill, Freeze, Img} from 'remotion';

import {duckedVolumeAt, type NarrationWindow} from '../../src/domain/audio/ducking';
import type {
  AudioRenderProps,
  Day1LabelStyle,
  Day1PanelRenderProps,
  PanelRect,
} from '../../src/domain/editor/types';
import {CANVAS_COLOR} from '../../src/compositions/shared/SceneVideo';
import type {QuadActive, QuadLayout} from './quadFrame.spike';

const JUSTIFY = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
} as const;

const PanelLabel = ({label, style}: {label: string; style: Day1LabelStyle}) => (
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

/** A panel source plus the two baked backdrops for it. */
export interface BakedPanel extends Day1PanelRenderProps {
  backdropColorUrl: string;
  backdropGreyUrl: string;
}

const PanelBaked = ({
  labelStyle,
  live,
  liveVolume,
  panel,
  rect,
}: {
  labelStyle: Day1LabelStyle;
  live: boolean;
  liveVolume: (panelFrame: number) => number;
  panel: BakedPanel;
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
      {panel.fit === 'contain' && panel.url !== null ? (
        <AbsoluteFill>
          {/* The blur and the greyscale are baked into the bitmap, so no CSS
              filter runs per frame. The overscan is baked in too. */}
          <Img
            src={live ? panel.backdropColorUrl : panel.backdropGreyUrl}
            style={{height: '100%', objectFit: 'cover', width: '100%'}}
          />
        </AbsoluteFill>
      ) : null}

      {panel.url === null ? null : live ? (
        <Video
          objectFit={panel.fit}
          src={panel.url}
          style={framing}
          trimAfter={panel.trimAfterFrames}
          trimBefore={panel.trimBeforeFrames}
          volume={liveVolume}
        />
      ) : (
        <Freeze frame={0}>
          <Video
            muted
            objectFit={panel.fit}
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

export const QuadFrameBaked = ({
  active,
  audio,
  labelStyle,
  layout,
  lineColor,
  panels,
  sectionFromFrame,
}: {
  active: QuadActive;
  audio: AudioRenderProps;
  labelStyle: Day1LabelStyle;
  layout: QuadLayout;
  lineColor: string;
  panels: [BakedPanel, BakedPanel, BakedPanel, BakedPanel];
  sectionFromFrame: number;
}) => {
  const duckWindows: NarrationWindow[] = audio.narration.map((track) => ({
    fromFrame: track.fromFrame - sectionFromFrame,
    durationInFrames: track.durationInFrames,
  }));
  const liveVolume = (panelFrame: number) =>
    duckedVolumeAt(panelFrame, audio.originalVolume, duckWindows, audio.ducking);

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {panels.map((panel, index) => (
        <PanelBaked
          key={index}
          labelStyle={labelStyle}
          live={active === index}
          liveVolume={liveVolume}
          panel={panel}
          rect={layout.cells[index] as PanelRect}
        />
      ))}
      {layout.lines.map((line, index) => (
        <div
          key={index}
          style={{
            backgroundColor: lineColor,
            height: line.height,
            left: line.x,
            position: 'absolute',
            top: line.y,
            width: line.width,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
