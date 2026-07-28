// Design Ref: §3.3 Audio and §3.5 "Narration length must not exceed its scene".
import type {
  AudioMix,
  AudioTrack,
  EditorProject,
  Locale,
  NarrationTrack,
  SceneKind,
} from '../editor/types';
import {sceneIndexOf} from '../timeline/timeline';

export const DEFAULT_AUDIO_MIX: AudioMix = {
  originalVolume: 1,
  bgm: null,
  narration: {},
  ducking: {
    enabled: true,
    targetGain: 0.25,
    attackMs: 150,
    releaseMs: 300,
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const withAudio = (
  project: EditorProject,
  audio: AudioMix,
): EditorProject => ({...project, audio});

export const setOriginalVolume = (
  project: EditorProject,
  volume: number,
): EditorProject =>
  withAudio(project, {...project.audio, originalVolume: clamp(volume, 0, 1)});

export const setBgm = (
  project: EditorProject,
  bgm: AudioTrack | null,
): EditorProject => withAudio(project, {...project.audio, bgm});

export const updateBgm = (
  project: EditorProject,
  patch: Partial<Omit<AudioTrack, 'source'>>,
): EditorProject =>
  project.audio.bgm
    ? withAudio(project, {
        ...project.audio,
        bgm: {
          ...project.audio.bgm,
          ...patch,
          volume: clamp(patch.volume ?? project.audio.bgm.volume, 0, 1),
          startMs: Math.max(0, patch.startMs ?? project.audio.bgm.startMs),
        },
      })
    : project;

export const setDucking = (
  project: EditorProject,
  patch: Partial<AudioMix['ducking']>,
): EditorProject =>
  withAudio(project, {
    ...project.audio,
    ducking: {
      ...project.audio.ducking,
      ...patch,
      targetGain: clamp(patch.targetGain ?? project.audio.ducking.targetGain, 0, 1),
      attackMs: clamp(patch.attackMs ?? project.audio.ducking.attackMs, 0, 2000),
      releaseMs: clamp(
        patch.releaseMs ?? project.audio.ducking.releaseMs,
        0,
        2000,
      ),
    },
  });

export const narrationOf = (
  project: EditorProject,
  locale: Locale,
  kind: SceneKind,
): NarrationTrack | null => project.audio.narration[locale]?.[kind] ?? null;

export const setNarration = (
  project: EditorProject,
  locale: Locale,
  kind: SceneKind,
  track: NarrationTrack | null,
): EditorProject => {
  const forLocale = {...(project.audio.narration[locale] ?? {})};

  if (track) {
    forLocale[kind] = track;
  } else {
    delete forLocale[kind];
  }

  return withAudio(project, {
    ...project.audio,
    narration: {...project.audio.narration, [locale]: forLocale},
  });
};

export const setNarrationVolume = (
  project: EditorProject,
  locale: Locale,
  kind: SceneKind,
  volume: number,
): EditorProject => {
  const track = narrationOf(project, locale, kind);

  return track
    ? setNarration(project, locale, kind, {...track, volume: clamp(volume, 0, 1)})
    : project;
};

export interface NarrationBlocker {
  locale: Locale;
  kind: SceneKind;
  narrationMs: number;
  sceneMs: number;
}

/**
 * Design Ref: §3.5 and §6.2 `NARRATION_TOO_LONG` — narration is never
 * time-stretched or truncated, so a track longer than its scene blocks the render.
 */
export const narrationBlockers = (
  project: EditorProject,
  locales: readonly Locale[] = [project.selectedLocale],
): NarrationBlocker[] => {
  const blockers: NarrationBlocker[] = [];

  for (const locale of locales) {
    const tracks = project.audio.narration[locale];

    if (!tracks) {
      continue;
    }

    for (const [kind, track] of Object.entries(tracks) as Array<
      [SceneKind, NarrationTrack]
    >) {
      const sceneMs = project.scenes[sceneIndexOf(kind)].durationMs;

      if (track.durationMs > sceneMs) {
        blockers.push({locale, kind, narrationMs: track.durationMs, sceneMs});
      }
    }
  }

  return blockers;
};
