// Design Ref: §10.2 — project state changes only through pure command functions.
import {DEFAULT_AUDIO_MIX} from '../audio/mix';
import {DEFAULT_PROFILE, fpsForProfile, type FrameRate, type RenderProfile} from '../render/profile';
import type {MediaReference} from '../media/reference';
import {
  createAppError,
  fail,
  ok,
  type Result,
} from '../../shared/errors/appError';
import {
  allocateSceneFrames,
  createSceneDurations,
  isTrimShorterThanScene,
  moveBoundary,
  msToFrames,
  reconcileTrim,
  sceneDurationsOf,
  sceneIndexOf,
  type BoundaryIndex,
} from '../timeline/timeline';
import {
  DEFAULT_LOCALE,
  DEFAULT_RATIO,
  DEFAULT_SUBTITLE,
  DEFAULT_TRANSFORM,
  EDITOR_FPS,
  LOCALES,
  MAX_CTA_BACKGROUND_BLUR,
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MAX_SUBTITLE_FONT_SIZE,
  MAX_TRANSITION_MS,
  MIN_SCALE,
  MIN_SUBTITLE_FONT_SIZE,
  MIN_TRANSITION_MS,
  PROJECT_SCHEMA_VERSION,
  RATIO_DIMENSIONS,
  SCENE_ORDER,
  type AspectRatio,
  type AudioRenderProps,
  type CtaRenderProps,
  type CtaSceneSettings,
  type DurationPreset,
  type EditorProject,
  type EditorScene,
  type EditorScenes,
  type HookSceneSettings,
  type Locale,
  type LocalizedCopy,
  type MediaStatus,
  type MediaTransform,
  type NarrationRenderProps,
  type SceneKind,
  type SceneRenderProps,
  type SubtitleStyle,
  type ThreeSceneProps,
  type TransitionRenderProps,
} from './types';
import {editorProjectSchema} from './schema';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const outputDimensions = (ratio: AspectRatio) => RATIO_DIMENSIONS[ratio];

const emptyCopy = (): LocalizedCopy => ({
  hook: '',
  hookSubcopy: '',
  sceneSubtitles: {hook: '', gameplay: '', cta: ''},
  ctaText: '',
  ctaSubcopy: '',
});

const createCopy = (): Record<Locale, LocalizedCopy> =>
  Object.fromEntries(LOCALES.map((locale) => [locale, emptyCopy()])) as Record<
    Locale,
    LocalizedCopy
  >;

const DEFAULT_HOOK: HookSceneSettings = {
  motionPreset: 'impact',
  emphasizedText: '',
  dimBackground: true,
};

const DEFAULT_CTA: CtaSceneSettings = {
  media: null,
  appIcon: null,
  logo: null,
  storeBadge: null,
  useGeneratedBackground: true,
  backgroundBlur: 16,
  backgroundDim: 0.35,
};

const buildScenes = (
  preset: DurationPreset,
  sourceDurationMs: number,
): EditorScenes => {
  const durations = createSceneDurations(preset);

  return SCENE_ORDER.map((kind, index) => ({
    kind,
    durationMs: durations[index] as number,
    trim: reconcileTrim(
      {inMs: 0, outMs: 0},
      sourceDurationMs,
      durations[index] as number,
    ),
    transforms: {base: {...DEFAULT_TRANSFORM}, overrides: {}},
    subtitle: {...DEFAULT_SUBTITLE},
    transitionOut: {kind: 'cut' as const, durationMs: 300},
    ...(kind === 'hook' ? {hook: {...DEFAULT_HOOK}} : {}),
    ...(kind === 'cta' ? {cta: {...DEFAULT_CTA}} : {}),
  })) as EditorScenes;
};

export interface CreateProjectOptions {
  id?: string;
  createdAt?: string;
}

export const createProject = (
  preset: DurationPreset = 15,
  {id, createdAt}: CreateProjectOptions = {},
): EditorProject => {
  const timestamp = createdAt ?? new Date().toISOString();

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: id ?? `project_${crypto.randomUUID()}`,
    name: 'ua-video',
    createdAt: timestamp,
    updatedAt: timestamp,
    durationPreset: preset,
    fps: EDITOR_FPS,
    scenes: buildScenes(preset, 0),
    source: null,
    copy: createCopy(),
    audio: structuredClone(DEFAULT_AUDIO_MIX),
    render: {
      profile: DEFAULT_PROFILE,
      fps: EDITOR_FPS,
      selectedLocales: [DEFAULT_LOCALE],
      selectedRatios: [DEFAULT_RATIO],
      filePrefix: '',
    },
    selectedLocale: DEFAULT_LOCALE,
    selectedRatio: DEFAULT_RATIO,
  };
};

/** Design Ref: §3.4 — profile and frame rate stay consistent with each other. */
export const setRenderProfile = (
  project: EditorProject,
  profile: RenderProfile,
): EditorProject => ({
  ...project,
  render: {
    ...project.render,
    profile,
    fps: fpsForProfile(profile, project.render.fps),
  },
  fps: fpsForProfile(profile, project.render.fps),
});

export const setRenderFps = (
  project: EditorProject,
  fps: FrameRate,
): EditorProject => {
  const allowed = fpsForProfile(project.render.profile, fps);

  return {
    ...project,
    render: {...project.render, fps: allowed},
    fps: allowed,
  };
};

export const setRenderFilePrefix = (
  project: EditorProject,
  filePrefix: string,
): EditorProject => ({...project, render: {...project.render, filePrefix}});

/** Batch selection. At least one entry always stays selected. */
export const toggleRenderLocale = (
  project: EditorProject,
  locale: Locale,
): EditorProject => {
  const current = project.render.selectedLocales;
  const next = current.includes(locale)
    ? current.filter((entry) => entry !== locale)
    : [...current, locale];

  return next.length === 0
    ? project
    : {...project, render: {...project.render, selectedLocales: next}};
};

export const toggleRenderRatio = (
  project: EditorProject,
  ratio: AspectRatio,
): EditorProject => {
  const current = project.render.selectedRatios;
  const next = current.includes(ratio)
    ? current.filter((entry) => entry !== ratio)
    : [...current, ratio];

  return next.length === 0
    ? project
    : {...project, render: {...project.render, selectedRatios: next}};
};

/** Stamps the save time. Called by the persistence layer, not by editing. */
export const touchProject = (
  project: EditorProject,
  updatedAt: string = new Date().toISOString(),
): EditorProject => ({...project, updatedAt});

const withScenes = (
  project: EditorProject,
  scenes: EditorScenes,
): EditorProject => ({...project, scenes});

const mapScene = (
  project: EditorProject,
  kind: SceneKind,
  update: (scene: EditorScene) => EditorScene,
): EditorProject => {
  const index = sceneIndexOf(kind);

  return withScenes(
    project,
    project.scenes.map((scene, currentIndex) =>
      currentIndex === index ? update(scene) : scene,
    ) as EditorScenes,
  );
};

/** Re-clamps every trim after a duration or source change. */
const reconcileAllTrims = (project: EditorProject): EditorProject =>
  withScenes(
    project,
    project.scenes.map((scene) => ({
      ...scene,
      trim: reconcileTrim(
        scene.trim,
        project.source?.durationMs ?? 0,
        scene.durationMs,
      ),
    })) as EditorScenes,
  );

/** A transition may never exceed half of its own scene. Design Ref: §3.5. */
const reconcileTransitions = (project: EditorProject): EditorProject =>
  withScenes(
    project,
    project.scenes.map((scene) => ({
      ...scene,
      transitionOut: {
        ...scene.transitionOut,
        durationMs: clamp(
          scene.transitionOut.durationMs,
          MIN_TRANSITION_MS,
          Math.max(MIN_TRANSITION_MS, Math.floor(scene.durationMs / 2)),
        ),
      },
    })) as EditorScenes,
  );

const reconcile = (project: EditorProject) =>
  reconcileTransitions(reconcileAllTrims(project));

export const renameProject = (
  project: EditorProject,
  name: string,
): EditorProject => ({...project, name});

/**
 * Reloads the approved scene lengths. Trims restart at zero because the previous
 * source interval belonged to a different scene length. Framing, copy, and scene
 * settings are preserved.
 */
export const applyDurationPreset = (
  project: EditorProject,
  preset: DurationPreset,
): EditorProject => {
  const durations = createSceneDurations(preset);

  return reconcile({
    ...project,
    durationPreset: preset,
    scenes: project.scenes.map((scene, index) => ({
      ...scene,
      durationMs: durations[index] as number,
      trim: {inMs: 0, outMs: 0},
    })) as EditorScenes,
  });
};

/** Upload applies the same footage to Hook, Gameplay, and CTA at once. */
export const applySourceToAllScenes = (
  project: EditorProject,
  source: MediaReference,
): EditorProject =>
  reconcile({
    ...project,
    source,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      trim: {inMs: 0, outMs: 0},
    })) as EditorScenes,
  });

/**
 * Restores a missing source with a file the user picked. Trims are re-clamped
 * because the replacement may be shorter. Design Ref: §3.6 assisted relinking.
 */
export const relinkSource = (
  project: EditorProject,
  source: MediaReference,
): EditorProject => reconcile({...project, source});

export const setSourceStatus = (
  project: EditorProject,
  status: MediaStatus,
): EditorProject =>
  project.source ? {...project, source: {...project.source, status}} : project;

export const moveTimelineBoundary = (
  project: EditorProject,
  boundary: BoundaryIndex,
  positionMs: number,
): EditorProject => {
  const durations = moveBoundary(
    sceneDurationsOf(project.scenes),
    boundary,
    positionMs,
  );

  return reconcile(
    withScenes(
      project,
      project.scenes.map((scene, index) => ({
        ...scene,
        durationMs: durations[index] as number,
      })) as EditorScenes,
    ),
  );
};

export const setSceneTrimInMs = (
  project: EditorProject,
  kind: SceneKind,
  inMs: number,
): EditorProject =>
  mapScene(project, kind, (scene) => ({
    ...scene,
    trim: reconcileTrim(
      {inMs, outMs: inMs},
      project.source?.durationMs ?? 0,
      scene.durationMs,
    ),
  }));

/**
 * Trim out is the same interval seen from its end, so setting it moves the in
 * point by the scene length. This keeps the window equal to the scene duration.
 */
export const setSceneTrimOutMs = (
  project: EditorProject,
  kind: SceneKind,
  outMs: number,
): EditorProject => {
  const scene = project.scenes[sceneIndexOf(kind)];
  const windowMs = Math.min(
    scene.durationMs,
    project.source?.durationMs ?? scene.durationMs,
  );

  return setSceneTrimInMs(project, kind, outMs - windowMs);
};

export const setSelectedLocale = (
  project: EditorProject,
  locale: Locale,
): EditorProject => ({...project, selectedLocale: locale});

export const setSelectedRatio = (
  project: EditorProject,
  ratio: AspectRatio,
): EditorProject => ({...project, selectedRatio: ratio});

/** The framing in effect for a ratio: its override, or the shared base. */
export const activeTransform = (
  scene: EditorScene,
  ratio: AspectRatio,
): MediaTransform => scene.transforms.overrides[ratio] ?? scene.transforms.base;

export const hasRatioOverride = (scene: EditorScene, ratio: AspectRatio) =>
  scene.transforms.overrides[ratio] !== undefined;

const clampTransform = (
  current: MediaTransform,
  patch: Partial<Omit<MediaTransform, 'fit'>>,
): MediaTransform => ({
  fit: 'cover',
  scale: clamp(patch.scale ?? current.scale, MIN_SCALE, MAX_SCALE),
  x: clamp(patch.x ?? current.x, -MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT),
  y: clamp(patch.y ?? current.y, -MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT),
});

/** Writes to the ratio override when one exists, otherwise to the base. */
export const updateSceneTransform = (
  project: EditorProject,
  kind: SceneKind,
  ratio: AspectRatio,
  patch: Partial<Omit<MediaTransform, 'fit'>>,
): EditorProject =>
  mapScene(project, kind, (scene) => {
    const next = clampTransform(activeTransform(scene, ratio), patch);

    return hasRatioOverride(scene, ratio)
      ? {
          ...scene,
          transforms: {
            ...scene.transforms,
            overrides: {...scene.transforms.overrides, [ratio]: next},
          },
        }
      : {...scene, transforms: {...scene.transforms, base: next}};
  });

export const resetSceneTransform = (
  project: EditorProject,
  kind: SceneKind,
  ratio: AspectRatio,
): EditorProject => updateSceneTransform(project, kind, ratio, DEFAULT_TRANSFORM);

/** Design Ref: §5.5 "Toggle: use ratio-specific transform override". */
export const setRatioOverride = (
  project: EditorProject,
  kind: SceneKind,
  ratio: AspectRatio,
  enabled: boolean,
): EditorProject =>
  mapScene(project, kind, (scene) => {
    const overrides = {...scene.transforms.overrides};

    if (enabled) {
      overrides[ratio] = {...activeTransform(scene, ratio)};
    } else {
      delete overrides[ratio];
    }

    return {...scene, transforms: {...scene.transforms, overrides}};
  });

export const updateSubtitleStyle = (
  project: EditorProject,
  kind: SceneKind,
  patch: Partial<SubtitleStyle>,
): EditorProject =>
  mapScene(project, kind, (scene) => ({
    ...scene,
    subtitle: {
      ...scene.subtitle,
      ...patch,
      fontSize: clamp(
        patch.fontSize ?? scene.subtitle.fontSize,
        MIN_SUBTITLE_FONT_SIZE,
        MAX_SUBTITLE_FONT_SIZE,
      ),
      backgroundOpacity: clamp(
        patch.backgroundOpacity ?? scene.subtitle.backgroundOpacity,
        0,
        1,
      ),
    },
  }));

export const setSceneTransition = (
  project: EditorProject,
  kind: SceneKind,
  patch: Partial<EditorScene['transitionOut']>,
): EditorProject =>
  mapScene(project, kind, (scene) => ({
    ...scene,
    transitionOut: {
      kind: patch.kind ?? scene.transitionOut.kind,
      durationMs: clamp(
        patch.durationMs ?? scene.transitionOut.durationMs,
        MIN_TRANSITION_MS,
        Math.min(MAX_TRANSITION_MS, Math.floor(scene.durationMs / 2)),
      ),
    },
  }));

export const updateHookSettings = (
  project: EditorProject,
  patch: Partial<HookSceneSettings>,
): EditorProject =>
  mapScene(project, 'hook', (scene) => ({
    ...scene,
    hook: {...(scene.hook ?? DEFAULT_HOOK), ...patch},
  }));

export const updateCtaSettings = (
  project: EditorProject,
  patch: Partial<CtaSceneSettings>,
): EditorProject =>
  mapScene(project, 'cta', (scene) => {
    const current = scene.cta ?? DEFAULT_CTA;

    return {
      ...scene,
      cta: {
        ...current,
        ...patch,
        backgroundBlur: clamp(
          patch.backgroundBlur ?? current.backgroundBlur,
          0,
          MAX_CTA_BACKGROUND_BLUR,
        ),
        backgroundDim: clamp(patch.backgroundDim ?? current.backgroundDim, 0, 1),
      },
    };
  });

type CopyTextField = 'hook' | 'hookSubcopy' | 'ctaText' | 'ctaSubcopy';

export const setCopyField = (
  project: EditorProject,
  locale: Locale,
  field: CopyTextField,
  value: string,
): EditorProject => ({
  ...project,
  copy: {
    ...project.copy,
    [locale]: {...(project.copy[locale] as LocalizedCopy), [field]: value},
  },
});

export const setSceneSubtitleText = (
  project: EditorProject,
  locale: Locale,
  kind: SceneKind,
  value: string,
): EditorProject => {
  const current = project.copy[locale] as LocalizedCopy;

  return {
    ...project,
    copy: {
      ...project.copy,
      [locale]: {
        ...current,
        sceneSubtitles: {...current.sceneSubtitles, [kind]: value},
      },
    },
  };
};

/**
 * Runtime gate for any project that did not come from these command functions,
 * such as a stored or imported document. Design Ref: §6.2 `PROJECT_INVALID`.
 */
export const parseProject = (input: unknown): Result<EditorProject> => {
  const result = editorProjectSchema.safeParse(input);

  if (result.success) {
    return ok(result.data);
  }

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return fail(
    createAppError('PROJECT_INVALID', '프로젝트 데이터가 올바르지 않습니다.', {
      details: {issues},
      action: {label: '문제 항목 보기', target: 'diagnostics'},
    }),
  );
};

export const projectTotalFrames = (project: EditorProject) =>
  project.durationPreset * project.fps;

export const scenesShorterThanSource = (project: EditorProject) =>
  project.scenes.filter((scene) =>
    isTrimShorterThanScene(scene.trim, scene.durationMs),
  );

const NO_TRANSITION: TransitionRenderProps = {kind: 'cut', durationInFrames: 0};

/**
 * Deep-frozen snapshot consumed by the Player and by an active render job, so
 * later edits cannot mutate a running job. Design Ref: §4.3.
 *
 * Playable URLs are session state, not project data, so the caller resolves them.
 */
export const buildCompositionProps = (
  project: EditorProject,
  resolveUrl: (reference: MediaReference | null | undefined) => string | null,
): ThreeSceneProps => {
  const frames = allocateSceneFrames(
    sceneDurationsOf(project.scenes),
    project.durationPreset,
    project.fps,
  );
  const copy = project.copy[project.selectedLocale] as LocalizedCopy;
  const gameplay = project.scenes[1];
  const sourceUrl = resolveUrl(project.source);
  let cursor = 0;

  const transitionOf = (index: number): TransitionRenderProps => {
    const scene = project.scenes[index];

    // Only the two inner boundaries carry a transition.
    if (!scene || index > 1 || scene.transitionOut.kind === 'cut') {
      return NO_TRANSITION;
    }

    return {
      kind: scene.transitionOut.kind,
      durationInFrames: Math.max(
        1,
        msToFrames(scene.transitionOut.durationMs, project.fps),
      ),
    };
  };

  const scenes: SceneRenderProps[] = project.scenes.map((scene, index) => {
    const durationInFrames = frames[index] as number;
    const trimBeforeFrames = msToFrames(scene.trim.inMs, project.fps);
    const transform = activeTransform(scene, project.selectedRatio);
    const subtitleText = copy.sceneSubtitles[scene.kind] ?? '';

    const props: SceneRenderProps = {
      kind: scene.kind,
      fromFrame: cursor,
      durationInFrames,
      trimBeforeFrames,
      trimAfterFrames: Math.max(
        trimBeforeFrames + 1,
        msToFrames(scene.trim.outMs, project.fps),
      ),
      scale: transform.scale,
      x: transform.x,
      y: transform.y,
      subtitle: subtitleText
        ? Object.freeze({
            text: subtitleText,
            emphasizedText:
              scene.kind === 'hook' ? (scene.hook?.emphasizedText ?? '') : '',
            style: Object.freeze({...scene.subtitle}),
          })
        : null,
      transitionIn: index > 0 ? transitionOf(index - 1) : NO_TRANSITION,
      transitionOut: transitionOf(index),
      ...(scene.kind === 'hook' && scene.hook
        ? {
            hook: Object.freeze({
              motionPreset: scene.hook.motionPreset,
              headline: copy.hook,
              subcopy: copy.hookSubcopy,
              dimBackground: scene.hook.dimBackground,
            }),
          }
        : {}),
      ...(scene.kind === 'cta' && scene.cta
        ? {
            cta: Object.freeze({
              text: copy.ctaText,
              subcopy: copy.ctaSubcopy,
              appIconUrl: resolveUrl(scene.cta.appIcon),
              logoUrl: resolveUrl(scene.cta.logo),
              storeBadgeUrl: resolveUrl(scene.cta.storeBadge),
              mediaUrl: resolveUrl(scene.cta.media),
              // Design Ref: §1.3 — with no dedicated CTA media the background is
              // generated from the last gameplay frame.
              freezeSourceFrame:
                scene.cta.media || !scene.cta.useGeneratedBackground
                  ? null
                  : Math.max(
                      0,
                      msToFrames(gameplay.trim.outMs, project.fps) - 1,
                    ),
              backgroundBlur: scene.cta.backgroundBlur,
              backgroundDim: scene.cta.backgroundDim,
            }) as CtaRenderProps,
          }
        : {}),
    };

    cursor += durationInFrames;

    return Object.freeze(props);
  });

  return Object.freeze({
    src: project.source ? sourceUrl : null,
    scenes: Object.freeze(scenes) as SceneRenderProps[],
    audio: buildAudioRenderProps(project, scenes, resolveUrl),
  });
};

/** Design Ref: §3.3 — original, BGM, and per-scene narration with ducking. */
const buildAudioRenderProps = (
  project: EditorProject,
  scenes: readonly SceneRenderProps[],
  resolveUrl: (reference: MediaReference | null | undefined) => string | null,
): AudioRenderProps => {
  const {audio, fps} = project;
  const bgmUrl = resolveUrl(audio.bgm?.source);
  const tracks = audio.narration[project.selectedLocale] ?? {};

  const narration = scenes.flatMap<NarrationRenderProps>((scene) => {
    const track = tracks[scene.kind];
    const url = resolveUrl(track?.source);

    if (!track || !url) {
      return [];
    }

    return [
      Object.freeze({
        kind: scene.kind,
        url,
        volume: track.volume,
        fromFrame: scene.fromFrame,
        // Never stretched or truncated: a track longer than its scene is a
        // render blocker, surfaced by `narrationBlockers`.
        durationInFrames: Math.min(
          scene.durationInFrames,
          Math.max(1, msToFrames(track.durationMs, fps)),
        ),
      }),
    ];
  });

  return Object.freeze({
    originalVolume: audio.originalVolume,
    bgm:
      audio.bgm && bgmUrl
        ? Object.freeze({
            url: bgmUrl,
            volume: audio.bgm.volume,
            startInFrames: msToFrames(audio.bgm.startMs, fps),
            loop: audio.bgm.loop,
          })
        : null,
    narration: Object.freeze(narration) as NarrationRenderProps[],
    ducking: Object.freeze({
      enabled: audio.ducking.enabled,
      targetGain: audio.ducking.targetGain,
      attackInFrames: msToFrames(audio.ducking.attackMs, fps),
      releaseInFrames: msToFrames(audio.ducking.releaseMs, fps),
    }),
  });
};
