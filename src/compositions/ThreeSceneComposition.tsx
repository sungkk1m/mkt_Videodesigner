// Design Ref: §1.1 goal 2 — the Player preview and the browser render consume the
// exact same composition and props.
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
import {AudioLayer} from './shared/AudioLayer';
import {CANVAS_COLOR, SceneVideo} from './shared/SceneVideo';
import {SubtitleOverlay} from './shared/SubtitleOverlay';

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
