// day1-quad Design §6.3 — four panels in a 2x2 grid with a cross divider. One
// panel plays while the other three hold their own trim-in frame in greyscale
// (Plan Q2), which is what keeps concurrent decoding at one stream.
//
// Structurally the same as `SplitFrame`: both draw `Panel` and a divider, and
// differ only in how many cells there are and how the divider is shaped.
import {AbsoluteFill} from 'remotion';

import {duckedVolumeAt, type NarrationWindow} from '../../domain/audio/ducking';
import {DAY1_PANEL_SLOTS} from '../../domain/editor/constants';
import type {
  AudioRenderProps,
  Day1LabelStyle,
  Day1PanelRenderProps,
  Day1PanelSlot,
  QuadLayout,
} from '../../domain/editor/types';
import {CANVAS_COLOR} from '../shared/SceneVideo';
import {Panel} from './Panel';

export interface QuadFrameProps {
  active: Day1PanelSlot;
  audio: AudioRenderProps;
  labelStyle: Day1LabelStyle;
  layout: QuadLayout;
  lineColor: string;
  panels: readonly [
    Day1PanelRenderProps,
    Day1PanelRenderProps,
    Day1PanelRenderProps,
    Day1PanelRenderProps,
  ];
  /** Absolute frame the section starts at, used to place the ducking windows. */
  sectionFromFrame: number;
}

export const QuadFrame = ({
  active,
  audio,
  labelStyle,
  layout,
  lineColor,
  panels,
  sectionFromFrame,
}: QuadFrameProps) => {
  // Same correction `SplitFrame` makes: narration frames are absolute while the
  // panel's volume callback counts from the section start.
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
          live={active === DAY1_PANEL_SLOTS[index]}
          liveVolume={liveVolume}
          panel={panel}
          rect={layout.cells[index] as QuadLayout['cells'][number]}
        />
      ))}

      {/* Plan SC4: solid fills, so the rendered pixels equal the configured hex
          exactly with no blending to measure against. Two bars, drawn after the
          panels so the cross sits on top of every seam. */}
      {layout.lines.map((line, index) => (
        <div
          data-testid={`day1-quad-split-line-${index}`}
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
