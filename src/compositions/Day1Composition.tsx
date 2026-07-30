// Day1 Design Ref: §5.1 — three sections on the shared time axis: panel A live,
// panel B live, then the end card. The Player preview and the browser render
// consume this same component and the same props snapshot.
import {AbsoluteFill, Sequence} from 'remotion';

import type {Day1Props} from '../domain/editor/types';
import {EndCardScene} from './day1/EndCardScene';
import {SplitFrame} from './day1/SplitFrame';
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

export const Day1Composition = ({
  audio,
  endCard,
  labelStyle,
  layout,
  lineColor,
  panelA,
  panelB,
  sections,
}: Day1Props) => {
  // FR-D03: both panels are required. The render path gates on this too, so this
  // is what the editor preview shows while an upload is still missing.
  if (panelA.url === null || panelB.url === null) {
    return <Placeholder message="영상 2개를 모두 업로드하세요" />;
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
            <SplitFrame
              active={section.activePanel}
              labelStyle={labelStyle}
              layout={layout}
              lineColor={lineColor}
              originalVolume={audio.originalVolume}
              panelA={panelA}
              panelB={panelB}
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
