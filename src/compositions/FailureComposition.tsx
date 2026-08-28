// failure-video Design §6.3 — four sections on the shared time axis: three level
// segments, then the end card. Built like `Day1QuadComposition`, and consuming
// the same `EndCardScene` and `AudioLayer` (Plan FR-07: no new end-card code).
import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';

import {failWindow} from '../domain/failure/effects';
import {failureEdgesAt} from '../domain/failure/effects';
import type {FailureProps} from '../domain/editor/types';
import {msToFrames} from '../domain/timeline/timeline';
import {EndCardScene} from './day1/EndCardScene';
import {FailureFrame} from './failure/FailureFrame';
import failThud from './failure/assets/fail-thud.wav';
import {AudioLayer} from './shared/AudioLayer';
import {CANVAS_COLOR} from './shared/SceneVideo';

/**
 * Length of `fail-thud.wav`. Must match `DURATION_SECONDS` in
 * `scripts/generate-fail-sfx.mjs`; it bounds the Sequence so the renderer's
 * audio mixer knows exactly how long the hit occupies.
 */
const FAIL_SFX_MS = 320;

const Placeholder = ({message}: {message: string}) => (
  <AbsoluteFill
    style={{
      alignItems: 'center',
      backgroundColor: CANVAS_COLOR,
      color: '#6f7883',
      fontFamily: 'Arial, sans-serif',
      fontSize: 44,
      justifyContent: 'center',
      padding: '0 8%',
      textAlign: 'center',
    }}
  >
    {message}
  </AbsoluteFill>
);

export const FailureComposition = ({
  audio,
  captionStyle,
  captions,
  endCard,
  fail,
  layout,
  orientation,
  panels,
  sections,
}: FailureProps) => {
  const {fps} = useVideoConfig();

  // Plan Q2 — the active orientation's three sources are all required, and there
  // is deliberately no fallback to the other group. The render path gates on
  // this too; this is what the editor preview shows while an upload is missing.
  if (panels.some((panel) => panel.url === null)) {
    return (
      <Placeholder
        message={
          orientation === 'horizontal'
            ? '가로(16:9)용 영상 3개를 모두 업로드하세요'
            : '세로(9:16)용 영상 3개를 모두 업로드하세요'
        }
      />
    );
  }

  // Plan D-3 — the beat is anchored to the end of level 1, so it follows the
  // boundary rather than storing a position that could disagree with it.
  const levelOne = sections[0];
  const beat = levelOne ? failWindow(levelOne.durationInFrames, fps) : null;
  const sfxFrame = levelOne && beat ? levelOne.fromFrame + beat.stampFrame : null;

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {sections.map((section, index) => (
        <Sequence
          durationInFrames={section.durationInFrames}
          from={section.fromFrame}
          key={section.id}
          name={section.id}
          // Same condition the quad template premounts for: a section boundary
          // swaps the whole Sequence, so without a lead-in the next segment
          // decodes from scratch on the frame it becomes visible and the
          // preview blacks out on every level change.
          premountFor={fps}
        >
          {section.activePanel ? (
            <FailureFrame
              audio={audio}
              caption={captions[index] ?? ''}
              captionStyle={captionStyle}
              durationInFrames={section.durationInFrames}
              edges={failureEdgesAt(index, sections.length)}
              fail={fail}
              failWindow={index === 0 ? beat : null}
              layout={layout}
              panel={panels[index] ?? panels[0]}
              sectionFromFrame={section.fromFrame}
              showFail={index === 0}
            />
          ) : (
            <EndCardScene
              durationInFrames={section.durationInFrames}
              endCard={endCard}
            />
          )}
        </Sequence>
      ))}

      {/* §6.6 — one hit on the frame the stamp lands, gated by its own toggle
          and by the stamp's: a hit with no stamp under it is a bug, not an
          option. */}
      {fail.sfxEnabled && fail.stampEnabled && sfxFrame !== null ? (
        <Sequence
          durationInFrames={Math.max(1, msToFrames(FAIL_SFX_MS, fps))}
          from={sfxFrame}
          name="fail-sfx"
        >
          <Audio src={failThud} />
        </Sequence>
      ) : null}

      <AudioLayer audio={audio} />
    </AbsoluteFill>
  );
};
