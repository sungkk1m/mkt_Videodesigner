// Design Ref: §1.1 goal 2 — the Player preview and the browser render consume the
// exact same composition and props.
import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';

import {duckedVolumeAt} from '../domain/audio/ducking';
import type {
  AudioRenderProps,
  SceneRenderProps,
  ThreeSceneProps,
} from '../domain/editor/types';
import {transitionStyleAt} from '../domain/render/transition';
import {HookScene} from './scenes/HookScene';
import {CtaScene} from './scenes/CtaScene';
import {CANVAS_COLOR, SceneVideo} from './shared/SceneVideo';
import {SubtitleOverlay} from './shared/SubtitleOverlay';

/**
 * Design Ref: §3.3 — BGM plus per-scene narration, with original audio and BGM
 * ducked while narration plays. Narration is never stretched or truncated.
 */
const AudioLayer = ({audio}: {audio: AudioRenderProps}) => {
  const bgm = audio.bgm;

  return (
    <>
      {bgm ? (
        <Sequence from={bgm.startInFrames} name="bgm">
          <Audio
            loop={bgm.loop}
            src={bgm.url}
            volume={(frame) =>
              duckedVolumeAt(
                frame,
                bgm.volume,
                audio.narration.map((track) => ({
                  fromFrame: track.fromFrame - bgm.startInFrames,
                  durationInFrames: track.durationInFrames,
                })),
                audio.ducking,
              )
            }
          />
        </Sequence>
      ) : null}

      {audio.narration.map((track) => (
        <Sequence
          durationInFrames={track.durationInFrames}
          from={track.fromFrame}
          key={track.kind}
          name={`narration-${track.kind}`}
        >
          <Audio src={track.url} volume={track.volume} />
        </Sequence>
      ))}
    </>
  );
};

const SceneLayer = ({
  audio,
  scene,
  src,
}: {
  audio: AudioRenderProps;
  scene: SceneRenderProps;
  src: string | null;
}) => {
  const frame = useCurrentFrame();
  const narration = audio.narration.find((track) => track.kind === scene.kind);
  // Inside a Sequence the frame is scene-relative, so the narration window is too.
  const duckWindows = narration
    ? [{fromFrame: 0, durationInFrames: narration.durationInFrames}]
    : [];
  const transition = transitionStyleAt(
    frame,
    scene.durationInFrames,
    scene.transitionIn,
    scene.transitionOut,
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CANVAS_COLOR,
        opacity: transition.opacity,
        transform: `scale(${transition.scale})`,
      }}
    >
      {scene.cta ? (
        <CtaScene cta={scene.cta} scene={scene} src={src} />
      ) : (
        <>
          {src ? (
            <SceneVideo
              scale={scene.scale}
              src={src}
              trimAfterFrames={scene.trimAfterFrames}
              trimBeforeFrames={scene.trimBeforeFrames}
              volume={(sceneFrame) =>
                duckedVolumeAt(
                  sceneFrame,
                  audio.originalVolume,
                  duckWindows,
                  audio.ducking,
                )
              }
              x={scene.x}
              y={scene.y}
            />
          ) : (
            <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}} />
          )}
          {scene.hook ? <HookScene hook={scene.hook} /> : null}
        </>
      )}

      {scene.subtitle ? <SubtitleOverlay subtitle={scene.subtitle} /> : null}
    </AbsoluteFill>
  );
};

export const ThreeSceneComposition = ({
  src,
  scenes,
  audio,
}: ThreeSceneProps) => {
  if (src === null) {
    return (
      <AbsoluteFill
        style={{
          alignItems: 'center',
          backgroundColor: CANVAS_COLOR,
          color: '#6f7883',
          fontFamily: 'Arial, sans-serif',
          fontSize: 44,
          justifyContent: 'center',
        }}
      >
        영상을 업로드하세요
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {scenes.map((scene) => (
        <Sequence
          durationInFrames={scene.durationInFrames}
          from={scene.fromFrame}
          key={scene.kind}
          name={scene.kind}
        >
          <SceneLayer audio={audio} scene={scene} src={src} />
        </Sequence>
      ))}

      <AudioLayer audio={audio} />
    </AbsoluteFill>
  );
};
