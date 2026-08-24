// day1-quad Design §6.4 — five sections on the shared time axis: four panels
// live in reading order, then the end card. Built like `Day1Composition`, and
// consuming the same `EndCardScene` and `AudioLayer`.
import {AbsoluteFill, Sequence} from 'remotion';

import type {Day1QuadProps} from '../domain/editor/types';
import {EndCardScene} from './day1/EndCardScene';
import {QuadFrame} from './day1/QuadFrame';
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

export const Day1QuadComposition = ({
  audio,
  endCard,
  labelStyle,
  layout,
  lineColor,
  panels,
  sections,
}: Day1QuadProps) => {
  // FR-Q02: all four panels are required. The render path gates on this too, so
  // this is what the editor preview shows while an upload is still missing.
  if (panels.some((panel) => panel.url === null)) {
    return <Placeholder message="영상 4개를 모두 업로드하세요" />;
  }

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {sections.map((section) => (
        <Sequence
          durationInFrames={section.durationInFrames}
          from={section.fromFrame}
          key={section.id}
          name={section.id}
        >
          {section.activePanel ? (
            <QuadFrame
              active={section.activePanel}
              audio={audio}
              labelStyle={labelStyle}
              layout={layout}
              lineColor={lineColor}
              panels={panels}
              sectionFromFrame={section.fromFrame}
            />
          ) : (
            <EndCardScene
              durationInFrames={section.durationInFrames}
              endCard={endCard}
            />
          )}
        </Sequence>
      ))}

      <AudioLayer audio={audio} />
    </AbsoluteFill>
  );
};
