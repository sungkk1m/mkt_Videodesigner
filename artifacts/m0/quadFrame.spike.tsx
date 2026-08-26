// M0 SPIKE CODE — discarded after the gate. Not part of src/.
//
// `Panel` below is a VERBATIM copy of the internal `Panel` in
// src/compositions/day1/SplitFrame.tsx (read 2026-08-24). It is copied rather
// than imported because SplitFrame does not export it, and M0 must not modify
// src/. The measurement is only valid if the copy stays byte-identical in
// structure — `artifacts/m0/verify-panel-copy.mjs` diffs the two.
import {Video} from '@remotion/media';
import {AbsoluteFill, Freeze} from 'remotion';

import {duckedVolumeAt, type NarrationWindow} from '../../src/domain/audio/ducking';
import type {
  AudioRenderProps,
  Day1LabelStyle,
  Day1PanelRenderProps,
  PanelRect,
} from '../../src/domain/editor/types';
import {CANVAS_COLOR} from '../../src/compositions/shared/SceneVideo';

const JUSTIFY = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
} as const;

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

const BACKDROP_BLUR_RATIO = 0.05;
const BACKDROP_OVERSCAN = 1.2;

export const Panel = ({
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
      {panel.fit === 'contain' && panel.url !== null ? (
        <AbsoluteFill>
          <Freeze frame={0}>
            <Video
              muted
              objectFit="cover"
              src={panel.url}
              style={{
                filter:
                  `blur(${BACKDROP_BLUR_RATIO * rect.width}px)` +
                  (live ? '' : ' grayscale(1)'),
                height: '100%',
                transform: `scale(${BACKDROP_OVERSCAN})`,
                width: '100%',
              }}
              trimAfter={panel.trimBeforeFrames + 1}
              trimBefore={panel.trimBeforeFrames}
            />
          </Freeze>
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

/** Plan §2.1 — cells 4 + cross divider 2. */
export interface QuadLayout {
  cells: [PanelRect, PanelRect, PanelRect, PanelRect];
  lines: [PanelRect, PanelRect];
}

export type QuadActive = 0 | 1 | 2 | 3;

export const QuadFrame = ({
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
  panels: [
    Day1PanelRenderProps,
    Day1PanelRenderProps,
    Day1PanelRenderProps,
    Day1PanelRenderProps,
  ];
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
        <Panel
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
          data-testid={`quad-split-line-${index}`}
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
