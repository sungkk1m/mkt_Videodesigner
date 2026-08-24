// Day1 Design Ref: §5.2 SplitFrame — the live panel plays while the other holds
// its own trim-in frame in greyscale, with the divider drawn between them.
//
// day1-quad Design §6.2 — the panel itself moved to `Panel.tsx` so the quad grid
// draws the same one. This file kept the two-panel arrangement and the divider.
import {AbsoluteFill} from 'remotion';

import {duckedVolumeAt, type NarrationWindow} from '../../domain/audio/ducking';
import type {
  ActivePanel,
  AudioRenderProps,
  Day1LabelStyle,
  Day1PanelRenderProps,
  SplitLayout,
} from '../../domain/editor/types';
import {CANVAS_COLOR} from '../shared/SceneVideo';
import {Panel} from './Panel';

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
