// Design Ref: §3.3 — BGM plus per-scene narration, with original audio and BGM
// ducked while narration plays. Narration is never stretched or truncated.
//
// Day1 Design Ref: §5.1 — shared by both compositions. Day1 passes an empty
// narration list (Plan §2.2), so this renders BGM only there.
import {Audio} from '@remotion/media';
import {Sequence} from 'remotion';

import {duckedVolumeAt} from '../../domain/audio/ducking';
import type {AudioRenderProps} from '../../domain/editor/types';

export const AudioLayer = ({audio}: {audio: AudioRenderProps}) => {
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
