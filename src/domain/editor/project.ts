// Design Ref: §10.2 — project state changes only through pure command functions.
import {DEFAULT_AUDIO_MIX} from '../audio/mix';
import {appIconRect} from '../day1/endCard';
import {quadLayout, splitLayout} from '../day1/layout';
import {
  DAY1_END_CARD_MS,
  activePanelForQuadSection,
  day1QuadSectionDurations,
  MIN_END_CARD_TRIM_MS,
  activePanelForSection,
  day1SectionDurations,
} from '../day1/playback';
import {resolveKvSet, resolveKvTitle} from '../kvloop/assets';
import {resolveKvMotion} from '../kvloop/motion';
import {
  kvLoopCombination,
  kvLoopCycleDurations,
  kvLoopSegments,
} from '../kvloop/cycle';
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
  sectionDurationsOf,
  sceneIndexOf,
  type BoundaryIndex,
} from '../timeline/timeline';
import {
  DAY1_SECTION_LABELS,
  DAY1_QUAD_DURATION_PRESETS,
  DAY1_QUAD_SECTION_LABELS,
  DAY1_QUAD_SECTION_ORDER,
  DAY1_SECTION_ORDER,
  DEFAULT_DAY1_PANEL_TRANSFORM,
  DEFAULT_KV_COUNT,
  DEFAULT_KV_LOOPS,
  DEFAULT_KV_TRANSITION_MS,
  DEFAULT_LOCALE,
  DEFAULT_RATIO,
  DEFAULT_SUBTITLE,
  DEFAULT_TRANSFORM,
  EDITOR_FPS,
  KV_LOOP_MAX_LOOPS,
  KV_LOOP_MIN_LOOPS,
  KV_LOOP_RATIO,
  LOCALES,
  MAX_CTA_BACKGROUND_BLUR,
  MAX_ICON_ADJUST,
  MAX_ICON_SCALE,
  MAX_LABEL_GLOW_PX,
  MAX_LABEL_OUTLINE_WIDTH_PX,
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MAX_SECTION_COUNT,
  MAX_SPLIT_LINE_WIDTH_PX,
  MAX_SUBTITLE_FONT_SIZE,
  MAX_TRANSITION_MS,
  MIN_ICON_SCALE,
  MIN_SCALE,
  MIN_SECTION_COUNT,
  MIN_SUBTITLE_FONT_SIZE,
  MIN_TRANSITION_MS,
  PROJECT_SCHEMA_VERSION,
  RATIO_DIMENSIONS,
  SCENE_LABELS,
  SCENE_ORDER,
  kvSectionId,
  kvSectionLabel,
  type ActivePanel,
  type AspectRatio,
  type AudioRenderProps,
  type CtaRenderProps,
  type CtaSceneSettings,
  type Day1Panel,
  type Day1PanelSlot,
  type Day1QuadProps,
  type Day1QuadSettings,
  type TemplateSettings,
  type Day1EndCardRenderProps,
  type Day1PanelRenderProps,
  type Day1Props,
  type Day1SectionRenderProps,
  type Day1Settings,
  type DurationPreset,
  type EditorProject,
  type EditorScene,
  type EditorScenes,
  type EditorSnapshot,
  type HookSceneSettings,
  type IconAdjust,
  type KvLoopProps,
  type KvLoopSettings,
  type KvMotion,
  type KvSegment,
  type KvSlotRenderProps,
  type Locale,
  type LocalizedCopy,
  type MediaStatus,
  type MediaTransform,
  type NarrationRenderProps,
  type RatioTransforms,
  type SceneKind,
  type SceneRenderProps,
  type Sections,
  type SubtitleStyle,
  type TemplateKind,
  type ThreeSceneProps,
  type ThreeSceneSettings,
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

/**
 * Day1 Design Ref: §3.2 — the documented starting values for a Day1 payload,
 * kept next to the three-scene defaults above. Module 5's template switch is the
 * first command that writes one; until then only the render path and tests read it.
 */
export const DEFAULT_DAY1_SETTINGS: Day1Settings = {
  template: 'day1',
  panelA: {
    source: null,
    trim: {inMs: 0, outMs: 0},
    transforms: {base: {...DEFAULT_DAY1_PANEL_TRANSFORM}, overrides: {}},
  },
  panelB: {
    source: null,
    trim: {inMs: 0, outMs: 0},
    transforms: {base: {...DEFAULT_DAY1_PANEL_TRANSFORM}, overrides: {}},
  },
  split: {lineColor: '#9ca3af', lineWidthPx: 6},
  labelStyle: {
    fontSize: 72,
    textColor: '#ffffff',
    outlineColor: '#000000',
    outlineWidthPx: 8,
    position: 'top',
    // day1-label-effects FR-06 — both effects start off, so a project made
    // before this cycle and a new one render the same label.
    showBackground: false,
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    glowEnabled: false,
    glowColor: '#ffffff',
    glowStrengthPx: 16,
  },
  endCard: {
    mode: 'banner',
    banner: null,
    appIcon: null,
    iconAdjust: {dx: 0, dy: 0, scale: 1},
    iconAnimation: 'pop',
    cardMotion: 'ken-burns',
    video: null,
    videoTrim: {inMs: 0, outMs: 0},
    videoAudioEnabled: true,
    videoAudioVolume: 1,
  },
};

/**
 * day1-quad Design §5.4 — the Day1 defaults with exactly one value changed.
 *
 * `labelStyle.fontSize` drops 72 → 44 because a quad cell is half as wide as a
 * Day1 panel (537px vs 1080px at 9:16), and 72px overflows it. Everything else
 * — the divider, the end card, and the panels' `contain` framing (Plan Q4) — is
 * the Day1 value, so `DEFAULT_DAY1_PANEL_TRANSFORM` is reused as is.
 */
export const DEFAULT_DAY1_QUAD_SETTINGS: Day1QuadSettings = {
  template: 'day1-quad',
  panelA: {
    source: null,
    trim: {inMs: 0, outMs: 0},
    transforms: {base: {...DEFAULT_DAY1_PANEL_TRANSFORM}, overrides: {}},
  },
  panelB: {
    source: null,
    trim: {inMs: 0, outMs: 0},
    transforms: {base: {...DEFAULT_DAY1_PANEL_TRANSFORM}, overrides: {}},
  },
  panelC: {
    source: null,
    trim: {inMs: 0, outMs: 0},
    transforms: {base: {...DEFAULT_DAY1_PANEL_TRANSFORM}, overrides: {}},
  },
  panelD: {
    source: null,
    trim: {inMs: 0, outMs: 0},
    transforms: {base: {...DEFAULT_DAY1_PANEL_TRANSFORM}, overrides: {}},
  },
  split: {...DEFAULT_DAY1_SETTINGS.split},
  labelStyle: {...DEFAULT_DAY1_SETTINGS.labelStyle, fontSize: 44},
  endCard: structuredClone(DEFAULT_DAY1_SETTINGS.endCard),
};

/**
 * day1-quad Plan Q9 — the labels start filled, with the same English in all
 * four locales: `Day1` … `Day7` are numbers, not copy to translate, and a value
 * in every locale means switching the language tab never blanks the frame.
 * Day1 (two panels) keeps its empty labels — Plan Q10's no-change rule.
 */
const DAY1_QUAD_DEFAULT_LABELS = {
  a: 'Day1',
  b: 'Day2',
  c: 'Day3',
  d: 'Day7',
} as const;

/**
 * key-visual-looping Design Ref: §3.2 — the documented starting values for a
 * looping payload. Four key visuals repeated twice is the reference format
 * (Plan §1.2), and the closing fade is on because both reference videos end on
 * one (FR-L17).
 */
export const DEFAULT_KV_LOOP_SETTINGS: KvLoopSettings = {
  template: 'kv-loop',
  slots: Array.from({length: DEFAULT_KV_COUNT}, () => ({
    transform: {...DEFAULT_TRANSFORM},
    // D-04 — null follows the loop-wide preset, so raising the count does not
    // ask the operator to set the same motion again on every new slot.
    motion: null,
  })),
  images: {},
  loopCount: DEFAULT_KV_LOOPS,
  kenBurnsIntensity: 0.5,
  motion: {kind: 'preset', preset: 'zoomIn'},
  transitionMs: DEFAULT_KV_TRANSITION_MS,
  // An overlay is artwork with its own margins, so it opens on `contain`:
  // cropping a game logo is never what was meant. §5.3.
  title: {images: {}, transform: {...DEFAULT_TRANSFORM, fit: 'contain'}},
  disclaimer: {fontSize: 32, textColor: '#ffffff'},
  fadeOutMs: DEFAULT_KV_TRANSITION_MS,
};

/**
 * Narrows a project to its three-scene payload, or null for any other template.
 *
 * Day1 Design Ref: §3.2 — this is the single place the `templateSettings`
 * discriminant is checked. Three-scene commands below no-op on a foreign
 * template rather than throwing, matching how the other commands in this file
 * already return the project unchanged when an edit does not apply.
 */
export const threeSceneOf = (
  project: EditorProject,
): ThreeSceneSettings | null =>
  project.templateSettings.template === 'three-scene'
    ? project.templateSettings
    : null;

/** The Day1 counterpart of `threeSceneOf`. Day1 Design Ref: §3.2. */
export const day1Of = (project: EditorProject): Day1Settings | null =>
  project.templateSettings.template === 'day1' ? project.templateSettings : null;

/** The looping counterpart of `threeSceneOf`. */
export const day1QuadOf = (
  project: EditorProject,
): Day1QuadSettings | null =>
  project.templateSettings.template === 'day1-quad'
    ? project.templateSettings
    : null;

export const kvLoopOf = (project: EditorProject): KvLoopSettings | null =>
  project.templateSettings.template === 'kv-loop'
    ? project.templateSettings
    : null;

/** Day1 Design Ref: §3.1 — the three-scene view of the shared time axis. */
const buildSections = (preset: DurationPreset): Sections => {
  const durations = createSceneDurations(preset);

  return SCENE_ORDER.map((kind, index) => ({
    id: kind,
    label: SCENE_LABELS[kind],
    durationMs: durations[index] as number,
  }));
};

const buildScenes = (): EditorScenes =>
  SCENE_ORDER.map((kind) => ({
    kind,
    trim: {inMs: 0, outMs: 0},
    transforms: {base: {...DEFAULT_TRANSFORM}, overrides: {}},
    subtitle: {...DEFAULT_SUBTITLE},
    transitionOut: {kind: 'cut' as const, durationMs: 300},
    ...(kind === 'hook' ? {hook: {...DEFAULT_HOOK}} : {}),
    ...(kind === 'cta' ? {cta: {...DEFAULT_CTA}} : {}),
  })) as EditorScenes;

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
    sections: buildSections(preset),
    templateSettings: {
      template: 'three-scene',
      source: null,
      scenes: buildScenes(),
    },
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
): EditorProject => {
  const settings = threeSceneOf(project);

  return settings
    ? {...project, templateSettings: {...settings, scenes}}
    : project;
};

const withSectionDurations = (
  project: EditorProject,
  durations: readonly number[],
): EditorProject => ({
  ...project,
  sections: project.sections.map((section, index) => ({
    ...section,
    durationMs: durations[index] as number,
  })),
});

const mapScene = (
  project: EditorProject,
  kind: SceneKind,
  update: (scene: EditorScene) => EditorScene,
): EditorProject => {
  const settings = threeSceneOf(project);

  if (!settings) {
    return project;
  }

  const index = sceneIndexOf(kind);

  return withScenes(
    project,
    settings.scenes.map((scene, currentIndex) =>
      currentIndex === index ? update(scene) : scene,
    ) as EditorScenes,
  );
};

/** Re-clamps every trim after a duration or source change. */
const reconcileAllTrims = (project: EditorProject): EditorProject => {
  const settings = threeSceneOf(project);

  if (!settings) {
    return project;
  }

  return withScenes(
    project,
    settings.scenes.map((scene, index) => ({
      ...scene,
      trim: reconcileTrim(
        scene.trim,
        settings.source?.durationMs ?? 0,
        project.sections[index]?.durationMs ?? 0,
      ),
    })) as EditorScenes,
  );
};

/** A transition may never exceed half of its own section. Design Ref: §3.5. */
const reconcileTransitions = (project: EditorProject): EditorProject => {
  const settings = threeSceneOf(project);

  if (!settings) {
    return project;
  }

  return withScenes(
    project,
    settings.scenes.map((scene, index) => ({
      ...scene,
      transitionOut: {
        ...scene.transitionOut,
        durationMs: clamp(
          scene.transitionOut.durationMs,
          MIN_TRANSITION_MS,
          Math.max(
            MIN_TRANSITION_MS,
            Math.floor((project.sections[index]?.durationMs ?? 0) / 2),
          ),
        ),
      },
    })) as EditorScenes,
  );
};

/** Each step no-ops on a template it does not own, so this is template-agnostic. */
const reconcile = (project: EditorProject) =>
  reconcileDay1Trims(reconcileTransitions(reconcileAllTrims(project)));

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
  const settingsBefore = project.templateSettings;
  const resized = withSectionDurations(
    {...project, durationPreset: preset},
    settingsBefore.template === 'day1'
      ? day1SectionDurations(preset)
      : // day1-quad — five sections, not three. Without this arm the preset
        // switch fell through to `createSceneDurations`, laying the
        // three-scene lengths [3s, 24s, 3s] over a five-section axis: panel D
        // and the end card became NaN, and the composition crashed on
        // `Sequence from=NaN` — a black preview and a failed render.
        settingsBefore.template === 'day1-quad'
        ? day1QuadSectionDurations(preset)
        : settingsBefore.template === 'kv-loop'
        ? // The cycle is redivided evenly; the caller is expected to have
          // cleared `kvLoopCombination` first, exactly as the template switch
          // is expected to have been confirmed. Plan L8 forbids quietly
          // correcting a combination that does not fit.
          kvLoopCycleDurations(
            preset,
            settingsBefore.loopCount,
            settingsBefore.slots.length,
          )
        : createSceneDurations(preset),
  );
  const settings = threeSceneOf(resized);

  return reconcile(
    settings
      ? withScenes(
          resized,
          settings.scenes.map((scene) => ({
            ...scene,
            trim: {inMs: 0, outMs: 0},
          })) as EditorScenes,
        )
      : resized,
  );
};

/** Upload applies the same footage to Hook, Gameplay, and CTA at once. */
export const applySourceToAllScenes = (
  project: EditorProject,
  source: MediaReference,
): EditorProject => {
  const settings = threeSceneOf(project);

  if (!settings) {
    return project;
  }

  return reconcile({
    ...project,
    templateSettings: {
      ...settings,
      source,
      scenes: settings.scenes.map((scene) => ({
        ...scene,
        trim: {inMs: 0, outMs: 0},
      })) as EditorScenes,
    },
  });
};

/**
 * Restores a missing source with a file the user picked. Trims are re-clamped
 * because the replacement may be shorter. Design Ref: §3.6 assisted relinking.
 */
export const relinkSource = (
  project: EditorProject,
  source: MediaReference,
): EditorProject => {
  const settings = threeSceneOf(project);

  return settings
    ? reconcile({...project, templateSettings: {...settings, source}})
    : project;
};

export const setSourceStatus = (
  project: EditorProject,
  status: MediaStatus,
): EditorProject => {
  const settings = threeSceneOf(project);

  return settings?.source
    ? {
        ...project,
        templateSettings: {
          ...settings,
          source: {...settings.source, status},
        },
      }
    : project;
};

/** Template-agnostic: boundaries move the shared section axis. */
export const moveTimelineBoundary = (
  project: EditorProject,
  boundary: BoundaryIndex,
  positionMs: number,
): EditorProject =>
  reconcile(
    withSectionDurations(
      project,
      moveBoundary(sectionDurationsOf(project.sections), boundary, positionMs),
    ),
  );

export const setSceneTrimInMs = (
  project: EditorProject,
  kind: SceneKind,
  inMs: number,
): EditorProject => {
  const sectionMs = project.sections[sceneIndexOf(kind)]?.durationMs ?? 0;
  const sourceMs = threeSceneOf(project)?.source?.durationMs ?? 0;

  return mapScene(project, kind, (scene) => ({
    ...scene,
    trim: reconcileTrim({inMs, outMs: inMs}, sourceMs, sectionMs),
  }));
};

/**
 * Trim out is the same interval seen from its end, so setting it moves the in
 * point by the scene length. This keeps the window equal to the scene duration.
 */
export const setSceneTrimOutMs = (
  project: EditorProject,
  kind: SceneKind,
  outMs: number,
): EditorProject => {
  const sectionMs = project.sections[sceneIndexOf(kind)]?.durationMs ?? 0;
  const windowMs = Math.min(
    sectionMs,
    threeSceneOf(project)?.source?.durationMs ?? sectionMs,
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

/**
 * The framing in effect for a ratio: its override, or the shared base.
 *
 * Takes anything that carries `transforms` so a Day1 panel reads it the same way
 * a scene does. Day1 Design Ref: §3.2 — both shapes hold a `RatioTransforms`.
 */
export const activeTransform = (
  target: {transforms: RatioTransforms},
  ratio: AspectRatio,
): MediaTransform =>
  target.transforms.overrides[ratio] ?? target.transforms.base;

/**
 * Day1 Design Ref: §6.3 — widened from `EditorScene` to anything carrying
 * `transforms` so a Day1 panel answers the same question as a scene.
 */
export const hasRatioOverride = (
  target: {transforms: RatioTransforms},
  ratio: AspectRatio,
) => target.transforms.overrides[ratio] !== undefined;

const clampTransform = (
  current: MediaTransform,
  patch: Partial<MediaTransform>,
): MediaTransform => ({
  fit: patch.fit ?? current.fit,
  scale: clamp(patch.scale ?? current.scale, MIN_SCALE, MAX_SCALE),
  x: clamp(patch.x ?? current.x, -MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT),
  y: clamp(patch.y ?? current.y, -MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT),
});

/**
 * Writes to the ratio override when one exists, otherwise to the base.
 *
 * Generic over the carrier so scenes and Day1 panels share one implementation.
 */
const writeTransform = <T extends {transforms: RatioTransforms}>(
  target: T,
  ratio: AspectRatio,
  patch: Partial<MediaTransform>,
): T => {
  const next = clampTransform(activeTransform(target, ratio), patch);

  return hasRatioOverride(target, ratio)
    ? {
        ...target,
        transforms: {
          ...target.transforms,
          overrides: {...target.transforms.overrides, [ratio]: next},
        },
      }
    : {...target, transforms: {...target.transforms, base: next}};
};

/** Design Ref: §5.5 — turning an override on seeds it from what is on screen. */
const writeRatioOverride = <T extends {transforms: RatioTransforms}>(
  target: T,
  ratio: AspectRatio,
  enabled: boolean,
): T => {
  const overrides = {...target.transforms.overrides};

  if (enabled) {
    overrides[ratio] = {...activeTransform(target, ratio)};
  } else {
    delete overrides[ratio];
  }

  return {...target, transforms: {...target.transforms, overrides}};
};

export const updateSceneTransform = (
  project: EditorProject,
  kind: SceneKind,
  ratio: AspectRatio,
  patch: Partial<Omit<MediaTransform, 'fit'>>,
): EditorProject =>
  mapScene(project, kind, (scene) => writeTransform(scene, ratio, patch));

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
  mapScene(project, kind, (scene) =>
    writeRatioOverride(scene, ratio, enabled),
  );

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
): EditorProject => {
  const sectionMs = project.sections[sceneIndexOf(kind)]?.durationMs ?? 0;

  return mapScene(project, kind, (scene) => ({
    ...scene,
    transitionOut: {
      kind: patch.kind ?? scene.transitionOut.kind,
      durationMs: clamp(
        patch.durationMs ?? scene.transitionOut.durationMs,
        MIN_TRANSITION_MS,
        Math.min(MAX_TRANSITION_MS, Math.floor(sectionMs / 2)),
      ),
    },
  }));
};

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

type CopyTextField =
  | 'hook'
  | 'hookSubcopy'
  | 'ctaText'
  | 'ctaSubcopy'
  /** key-visual-looping FR-L11 — the looping bottom line, same shape. */
  | 'kvLoopDisclaimer';

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

// ---------------------------------------------------------------------------
// Day1 commands. Day1 Design Ref: §6.1 template switch, §6.3 inspector.
// Each one no-ops on a foreign template, matching the three-scene commands above.
// ---------------------------------------------------------------------------

/**
 * day1-quad Design §5.5 / D-0 — widened from the two Day1 keys so the fifteen
 * commands below serve both templates. A command asked for a key the current
 * payload does not have no-ops, which is the same contract a command aimed at a
 * foreign template already had.
 */
export type Day1PanelKey = 'panelA' | 'panelB' | 'panelC' | 'panelD';

const DAY1_PANEL_KEYS = ['panelA', 'panelB'] as const;
const DAY1_QUAD_PANEL_KEYS = [
  'panelA',
  'panelB',
  'panelC',
  'panelD',
] as const;

/**
 * The panel keys a template actually has, in order. Empty for the templates
 * with no panels, so callers holding a plain `TemplateSettings` need no
 * narrowing. UI, proxies, and the render preflight all read this.
 */
export const panelKeysOf = (
  settings: TemplateSettings,
): readonly Day1PanelKey[] =>
  settings.template === 'day1'
    ? DAY1_PANEL_KEYS
    : settings.template === 'day1-quad'
      ? DAY1_QUAD_PANEL_KEYS
      : [];

/**
 * Panel to section index. Day1 Design Ref: §1.2 — panel A owns section 0 and
 * panel B section 1; day1-quad Design §5.5 — C and D continue that, so one
 * mapping is correct for both templates.
 */
const DAY1_PANEL_SECTION: Record<Day1PanelKey, 0 | 1 | 2 | 3> = {
  panelA: 0,
  panelB: 1,
  panelC: 2,
  panelD: 3,
};

const withDay1 = (
  project: EditorProject,
  settings: Day1Settings | Day1QuadSettings,
): EditorProject => ({...project, templateSettings: settings});

/**
 * day1-quad Design §5.5 — either panelled payload. The commands below read only
 * fields the two arms share, so they do not care which one they were handed.
 */
export const day1PanelsOf = (
  project: EditorProject,
): Day1Settings | Day1QuadSettings | null =>
  day1Of(project) ?? day1QuadOf(project);

/**
 * One panel off a project, or null when the template has no such panel.
 *
 * Exported because the feature layer used to reach in as `day1Of(project)?.[key]`,
 * which stops type-checking the moment `Day1PanelKey` covers keys a Day1 payload
 * does not have. conventions §3.1 — narrow through a helper, never index
 * `templateSettings` directly.
 */
export const day1PanelAt = (
  project: EditorProject,
  key: Day1PanelKey,
): Day1Panel | null => {
  const settings = day1PanelsOf(project);

  return settings ? panelAt(settings, key) : null;
};

/** One panel off either payload, or null when that key is not in it. */
const panelAt = (
  settings: Day1Settings | Day1QuadSettings,
  key: Day1PanelKey,
): Day1Panel | null =>
  key in settings ? (settings[key as keyof typeof settings] as Day1Panel) : null;

const mapDay1Panel = (
  project: EditorProject,
  key: Day1PanelKey,
  update: (panel: Day1Panel) => Day1Panel,
): EditorProject => {
  const settings = day1PanelsOf(project);

  // A Day1 payload has no `panelC`. Asking it to change one is a no-op, not a
  // crash — the same contract as a command aimed at a foreign template.
  if (!settings || !(key in settings)) {
    return project;
  }

  return withDay1(project, {
    ...settings,
    [key]: update(panelAt(settings, key) as Day1Panel),
  });
};

const day1SectionMs = (project: EditorProject, key: Day1PanelKey) =>
  project.sections[DAY1_PANEL_SECTION[key]]?.durationMs ?? 0;

/** Day1 Design Ref: §3.5 — a panel trim window never outgrows its section. */
const reconcileDay1Trims = (project: EditorProject): EditorProject => {
  const settings = day1PanelsOf(project);

  if (!settings) {
    return project;
  }

  // day1-quad Design §5.5 — driven by the payload's own key list, so the two
  // and four panel templates share one reconciliation.
  const reconciled = Object.fromEntries(
    panelKeysOf(settings).map((key) => {
      const panel = panelAt(settings, key) as Day1Panel;

      return [
        key,
        {
          ...panel,
          trim: reconcileTrim(
            panel.trim,
            panel.source?.durationMs ?? 0,
            day1SectionMs(project, key),
          ),
        },
      ];
    }),
  );

  return withDay1(project, {...settings, ...reconciled});
};

/** Day1 Design Ref: §3.1 — the Day1 view of the shared time axis. */
const buildDay1Sections = (preset: DurationPreset): Sections => {
  const durations = day1SectionDurations(preset);

  return DAY1_SECTION_ORDER.map((id, index) => ({
    id,
    label: DAY1_SECTION_LABELS[id],
    durationMs: durations[index] as number,
  }));
};

/** day1-quad Design §6.1 — four panels then the end card. */
const buildDay1QuadSections = (preset: DurationPreset): Sections => {
  const durations = day1QuadSectionDurations(preset);

  return DAY1_QUAD_SECTION_ORDER.map((id, index) => ({
    id,
    label: DAY1_QUAD_SECTION_LABELS[id],
    durationMs: durations[index] as number,
  }));
};

/**
 * key-visual-looping Design Ref: §3.1 — one section per key visual, holding an
 * even share of a single cycle. Design D-02: the count comes from `slots`, so
 * these two are built from the same number and cannot drift.
 */
const buildKvLoopSections = (
  preset: DurationPreset,
  loopCount: number,
  kvCount: number,
): Sections =>
  kvLoopCycleDurations(preset, loopCount, kvCount).map((durationMs, index) => ({
    id: kvSectionId(index),
    label: kvSectionLabel(index),
    durationMs,
  }));

/**
 * Day1 Design Ref: §6.1 — switching is destructive because per-scene settings and
 * panel settings cannot be carried across. The common fields (name, copy, audio,
 * render settings, selected locale and ratio) survive; the payload and the section
 * axis are replaced by the target template's defaults.
 *
 * The caller is responsible for confirming with the user first.
 */
export const switchTemplate = (
  project: EditorProject,
  template: TemplateKind,
): EditorProject => {
  if (project.templateSettings.template === template) {
    return project;
  }

  if (template === 'day1') {
    return {
      ...project,
      sections: buildDay1Sections(project.durationPreset),
      templateSettings: structuredClone(DEFAULT_DAY1_SETTINGS),
    };
  }

  if (template === 'day1-quad') {
    // Plan Q8a / Design §4.4 — the quad template offers 15s and 30s, so a 60s
    // project is coerced on the way in. The dialog says so before it happens,
    // which is the same contract the looping template's ratio coercion has.
    const preset = (
      DAY1_QUAD_DURATION_PRESETS as readonly DurationPreset[]
    ).includes(project.durationPreset)
      ? project.durationPreset
      : 30;

    return {
      ...project,
      durationPreset: preset,
      sections: buildDay1QuadSections(preset),
      templateSettings: structuredClone(DEFAULT_DAY1_QUAD_SETTINGS),
      // Plan Q9 — labels arrive filled, in every locale.
      copy: Object.fromEntries(
        LOCALES.map((locale) => [
          locale,
          {
            ...(project.copy[locale] as LocalizedCopy),
            day1Labels: {...DAY1_QUAD_DEFAULT_LABELS},
          },
        ]),
      ) as Record<Locale, LocalizedCopy>,
    };
  }

  // key-visual-looping FR-L14 / Design D-06 — the looping template renders 9:16
  // only, so entering it forces the ratio rather than letting the schema reject
  // a project the user cannot see is wrong. §6.1 has the dialog say so.
  if (template === 'kv-loop') {
    return {
      ...project,
      sections: buildKvLoopSections(
        project.durationPreset,
        DEFAULT_KV_LOOPS,
        DEFAULT_KV_COUNT,
      ),
      templateSettings: structuredClone(DEFAULT_KV_LOOP_SETTINGS),
      render: {...project.render, selectedRatios: [KV_LOOP_RATIO]},
      selectedRatio: KV_LOOP_RATIO,
    };
  }

  return {
    ...project,
    sections: buildSections(project.durationPreset),
    templateSettings: {
      template: 'three-scene',
      source: null,
      scenes: buildScenes(),
    },
  };
};

/** A new panel video restarts that panel's trim; the other panel is untouched. */
/**
 * day1-video — resets the framing along with the trim, so an upload always lands
 * on the lossless default. Carrying the previous clip's `cover` or zoom over
 * would crop the new footage before it was ever looked at. `relinkDay1PanelSource`
 * below is the path that keeps an edit.
 */
export const setDay1PanelSource = (
  project: EditorProject,
  key: Day1PanelKey,
  source: MediaReference | null,
): EditorProject =>
  reconcile(
    mapDay1Panel(project, key, (panel) => ({
      ...panel,
      source,
      trim: {inMs: 0, outMs: 0},
      transforms: {base: {...DEFAULT_DAY1_PANEL_TRANSFORM}, overrides: {}},
    })),
  );

/** Keeps a relinked panel's edit intact, unlike `setDay1PanelSource`. */
export const relinkDay1PanelSource = (
  project: EditorProject,
  key: Day1PanelKey,
  source: MediaReference,
): EditorProject =>
  reconcile(mapDay1Panel(project, key, (panel) => ({...panel, source})));

export const setDay1PanelSourceStatus = (
  project: EditorProject,
  key: Day1PanelKey,
  status: MediaStatus,
): EditorProject =>
  mapDay1Panel(project, key, (panel) =>
    panel.source ? {...panel, source: {...panel.source, status}} : panel,
  );

export const setDay1TrimInMs = (
  project: EditorProject,
  key: Day1PanelKey,
  inMs: number,
): EditorProject => {
  const settings = day1PanelsOf(project);
  const panel = settings && panelAt(settings, key);

  if (!panel) {
    return project;
  }

  const sourceMs = panel.source?.durationMs ?? 0;

  return mapDay1Panel(project, key, (panel) => ({
    ...panel,
    trim: reconcileTrim(
      {inMs, outMs: inMs},
      sourceMs,
      day1SectionMs(project, key),
    ),
  }));
};

/** The same interval seen from its end, mirroring `setSceneTrimOutMs`. */
export const setDay1TrimOutMs = (
  project: EditorProject,
  key: Day1PanelKey,
  outMs: number,
): EditorProject => {
  const settings = day1PanelsOf(project);
  const panel = settings && panelAt(settings, key);

  if (!panel) {
    return project;
  }

  const sectionMs = day1SectionMs(project, key);
  const windowMs = Math.min(sectionMs, panel.source?.durationMs ?? sectionMs);

  return setDay1TrimInMs(project, key, outMs - windowMs);
};

/**
 * FR-D07 — per-panel reframing with the same override rules as a scene.
 *
 * day1-video — unlike a scene, a panel also chooses its `fit`: half of a 9:16
 * frame is landscape, so a portrait capture has to either lose half its height
 * (`cover`) or keep all of it against a blurred backdrop (`contain`).
 */
export const updateDay1Transform = (
  project: EditorProject,
  key: Day1PanelKey,
  ratio: AspectRatio,
  patch: Partial<MediaTransform>,
): EditorProject =>
  mapDay1Panel(project, key, (panel) => writeTransform(panel, ratio, patch));

export const resetDay1Transform = (
  project: EditorProject,
  key: Day1PanelKey,
  ratio: AspectRatio,
): EditorProject =>
  updateDay1Transform(project, key, ratio, DEFAULT_DAY1_PANEL_TRANSFORM);

export const setDay1RatioOverride = (
  project: EditorProject,
  key: Day1PanelKey,
  ratio: AspectRatio,
  enabled: boolean,
): EditorProject =>
  mapDay1Panel(project, key, (panel) =>
    writeRatioOverride(panel, ratio, enabled),
  );

/**
 * FR-D08 — split line colour and thickness.
 *
 * day1-quad Design §5.5 — split, label style, and the end card are fields both
 * panelled payloads share, so this command and the five below read
 * `day1PanelsOf`. They read `day1Of` when the quad template shipped, which
 * made each of them a silent no-op there — the end card could not even switch
 * modes, so its video slot was unreachable.
 */
export const updateDay1Split = (
  project: EditorProject,
  patch: Partial<Day1Settings['split']>,
): EditorProject => {
  const settings = day1PanelsOf(project);

  if (!settings) {
    return project;
  }

  return withDay1(project, {
    ...settings,
    split: {
      lineColor: patch.lineColor ?? settings.split.lineColor,
      lineWidthPx: clamp(
        patch.lineWidthPx ?? settings.split.lineWidthPx,
        0,
        MAX_SPLIT_LINE_WIDTH_PX,
      ),
    },
  });
};

/** FR-D09 — label styling. The wording itself lives in `copy.day1Labels`. */
export const updateDay1LabelStyle = (
  project: EditorProject,
  patch: Partial<Day1Settings['labelStyle']>,
): EditorProject => {
  const settings = day1PanelsOf(project);

  if (!settings) {
    return project;
  }

  const current = settings.labelStyle;

  return withDay1(project, {
    ...settings,
    labelStyle: {
      ...current,
      ...patch,
      fontSize: clamp(
        patch.fontSize ?? current.fontSize,
        MIN_SUBTITLE_FONT_SIZE,
        MAX_SUBTITLE_FONT_SIZE,
      ),
      outlineWidthPx: clamp(
        patch.outlineWidthPx ?? current.outlineWidthPx,
        0,
        MAX_LABEL_OUTLINE_WIDTH_PX,
      ),
      // day1-label-effects FR-02/FR-04 — the two numeric effect fields clamp
      // like every other bounded label value rather than rejecting the patch.
      backgroundOpacity: clamp(
        patch.backgroundOpacity ?? current.backgroundOpacity,
        0,
        1,
      ),
      glowStrengthPx: clamp(
        patch.glowStrengthPx ?? current.glowStrengthPx,
        0,
        MAX_LABEL_GLOW_PX,
      ),
    },
  });
};

// `videoTrim` is excluded so it cannot bypass reconciliation — the trim moves
// only through `setDay1EndCardTrimInMs` (Endcard-Video Design D-04).
export type Day1EndCardPatch = Partial<
  Omit<Day1Settings['endCard'], 'iconAdjust' | 'videoTrim'>
> & {iconAdjust?: Partial<IconAdjust>};

/** FR-D11 ~ FR-D13 — banner, icon layer, nudge, and the motion presets. */
export const updateDay1EndCard = (
  project: EditorProject,
  patch: Day1EndCardPatch,
): EditorProject => {
  const settings = day1PanelsOf(project);

  if (!settings) {
    return project;
  }

  const current = settings.endCard;
  const adjust = {...current.iconAdjust, ...patch.iconAdjust};

  return withDay1(project, {
    ...settings,
    endCard: {
      ...current,
      ...patch,
      iconAdjust: {
        dx: clamp(adjust.dx, -MAX_ICON_ADJUST, MAX_ICON_ADJUST),
        dy: clamp(adjust.dy, -MAX_ICON_ADJUST, MAX_ICON_ADJUST),
        scale: clamp(adjust.scale, MIN_ICON_SCALE, MAX_ICON_SCALE),
      },
      // day1-endcard-audio FR-01 — same clamp treatment as iconAdjust.
      videoAudioVolume: clamp(
        patch.videoAudioVolume ?? current.videoAudioVolume,
        0,
        1,
      ),
    },
  });
};

/**
 * Endcard-Video FR-02/§3.4 — mirrors `setDay1PanelSource`: setting the video
 * resets its trim window to the start. A source shorter than the 3s card gets
 * a window covering all of it, which the always-on loop then fills (D-01).
 */
export const setDay1EndCardVideo = (
  project: EditorProject,
  reference: MediaReference | null,
): EditorProject => {
  const settings = day1PanelsOf(project);

  if (!settings) {
    return project;
  }

  return withDay1(project, {
    ...settings,
    endCard: {
      ...settings.endCard,
      video: reference,
      videoTrim: reconcileTrim(
        {inMs: 0, outMs: 0},
        reference?.durationMs ?? 0,
        endCardSectionMs(project),
      ),
    },
  });
};

/**
 * day1-quad Design §4.1 — the end card's own section length, not the 3s
 * constant. `DAY1_END_CARD_MS` is only the value the section *starts* at; the
 * timeline boundary has always been draggable past it, and `EndCardScene`
 * already renders whatever length the section holds. The end card is the last
 * section in both Day1 and Day1-quad, so "last" is the rule.
 */
const endCardSectionMs = (project: EditorProject): number =>
  project.sections[project.sections.length - 1]?.durationMs ?? DAY1_END_CARD_MS;

/**
 * day1-trim-preview FR-05 — the length the user chose, surviving moves. {0,0}
 * (no video picked yet) falls back to the whole card.
 */
const endCardWindowMs = (
  endCard: Day1Settings['endCard'],
  sectionMs: number,
): number => {
  const lengthMs = endCard.videoTrim.outMs - endCard.videoTrim.inMs;

  return lengthMs > 0 ? lengthMs : sectionMs;
};

/** Endcard-Video FR-07 — mirrors `setDay1TrimInMs` at the chosen window length. */
export const setDay1EndCardTrimInMs = (
  project: EditorProject,
  inMs: number,
): EditorProject => {
  const settings = day1PanelsOf(project);

  if (!settings) {
    return project;
  }

  return withDay1(project, {
    ...settings,
    endCard: {
      ...settings.endCard,
      videoTrim: reconcileTrim(
        {inMs, outMs: inMs},
        settings.endCard.video?.durationMs ?? 0,
        endCardWindowMs(settings.endCard, endCardSectionMs(project)),
      ),
    },
  });
};

/**
 * day1-trim-preview FR-05 — window length from 0.5s up to the end card's own
 * length, capped by the source, so a single cut can loop the card.
 * `reconcileTrim` slides the in point back when the longer window would leave
 * the source.
 *
 * day1-quad Design §4.1 — the upper bound used to be the 3s constant, which
 * meant dragging the end card longer left the extra time unreachable: the
 * operator could only pick a 3s window and the rest was filled by looping.
 */
export const setDay1EndCardTrimLengthMs = (
  project: EditorProject,
  lengthMs: number,
): EditorProject => {
  const settings = day1PanelsOf(project);

  if (!settings) {
    return project;
  }

  const {videoTrim} = settings.endCard;

  return withDay1(project, {
    ...settings,
    endCard: {
      ...settings.endCard,
      videoTrim: reconcileTrim(
        {inMs: videoTrim.inMs, outMs: videoTrim.inMs},
        settings.endCard.video?.durationMs ?? 0,
        clamp(
          Math.round(lengthMs),
          MIN_END_CARD_TRIM_MS,
          endCardSectionMs(project),
        ),
      ),
    },
  });
};

/** FR-D09 — per-panel label wording in the locale currently selected. */
export const setDay1LabelText = (
  project: EditorProject,
  locale: Locale,
  // day1-quad Design §5.3 — widened from `ActivePanel`, because the quad
  // template has slots `c` and `d` too.
  panel: Day1PanelSlot,
  value: string,
): EditorProject => {
  const current = project.copy[locale] as LocalizedCopy;
  const labels = current.day1Labels ?? {a: '', b: ''};

  return {
    ...project,
    copy: {
      ...project.copy,
      [locale]: {...current, day1Labels: {...labels, [panel]: value}},
    },
  };
};

/**
 * key-visual-looping §6.2/§6.3 — the looping commands. Same contract as the
 * Day1 ones: a command that does not apply to the current template returns the
 * project unchanged rather than throwing.
 */
const mapKvLoop = (
  project: EditorProject,
  update: (settings: KvLoopSettings) => KvLoopSettings,
): EditorProject => {
  const settings = kvLoopOf(project);

  if (!settings) {
    return project;
  }

  const next = update(settings);

  // An update that declines to change anything hands the settings straight back,
  // and then so does this — a no-op edit must not re-render the editor.
  return next === settings ? project : {...project, templateSettings: next};
};

const kvImagesAt = (
  settings: KvLoopSettings,
  locale: Locale,
): (MediaReference | null)[] =>
  Array.from(
    {length: settings.slots.length},
    (_, index) => settings.images[locale]?.[index] ?? null,
  );

/** FR-L03 — upload, replace, or clear one key visual of one locale's set. */
export const setKvImage = (
  project: EditorProject,
  locale: Locale,
  index: number,
  reference: MediaReference | null,
): EditorProject =>
  mapKvLoop(project, (settings) => ({
    ...settings,
    images: {
      ...settings.images,
      [locale]: kvImagesAt(settings, locale).map((current, slot) =>
        slot === index ? reference : current,
      ),
    },
  }));

/** A key visual whose file went missing and came back. */
export const setKvImageStatus = (
  project: EditorProject,
  locale: Locale,
  index: number,
  status: MediaStatus,
): EditorProject =>
  mapKvLoop(project, (settings) => ({
    ...settings,
    images: {
      ...settings.images,
      [locale]: kvImagesAt(settings, locale).map((current, slot) =>
        slot === index && current ? {...current, status} : current,
      ),
    },
  }));

/**
 * FR-L03 — reorder. The framing travels with the key visual, and so does every
 * locale's pixel, because a set is the same art in another language (D-04). The
 * hold times belong to positions on the timeline, so they stay where they are.
 */
export const moveKvImage = (
  project: EditorProject,
  from: number,
  to: number,
): EditorProject =>
  mapKvLoop(project, (settings) => {
    const count = settings.slots.length;

    if (from === to || from < 0 || to < 0 || from >= count || to >= count) {
      return settings;
    }

    const reorder = <TItem>(items: readonly TItem[]): TItem[] => {
      const next = [...items];
      const [moved] = next.splice(from, 1);

      next.splice(to, 0, moved as TItem);

      return next;
    };

    return {
      ...settings,
      slots: reorder(settings.slots),
      images: Object.fromEntries(
        Object.keys(settings.images).map((locale) => [
          locale,
          reorder(kvImagesAt(settings, locale as Locale)),
        ]),
      ) as KvLoopSettings['images'],
    };
  });

/**
 * FR-L03/FR-L06 — the count of key visuals, or how often the cycle plays. Both
 * redivide the cycle evenly, because the previous hold times were shares of a
 * cycle that no longer exists.
 *
 * A combination that cannot hold a second per key visual is refused, not
 * corrected: Plan L8 wants the reason shown, which `kvLoopCombination` words for
 * the UI. Nothing is silently adjusted here, and no unsavable project is made.
 */
const withKvCycle = (
  project: EditorProject,
  loopCount: number,
  kvCount: number,
  settings: KvLoopSettings,
): EditorProject => {
  if (!kvLoopCombination(project.durationPreset, loopCount, kvCount).ok) {
    return project;
  }

  const durations = kvLoopCycleDurations(
    project.durationPreset,
    loopCount,
    kvCount,
  );

  return {
    ...project,
    sections: durations.map((durationMs, index) => ({
      id: kvSectionId(index),
      label: kvSectionLabel(index),
      durationMs,
    })),
    templateSettings: {
      ...settings,
      loopCount,
      slots: Array.from(
        {length: kvCount},
        (_, index) =>
          settings.slots[index] ?? {
            transform: {...DEFAULT_TRANSFORM},
            motion: null,
          },
      ),
      images: Object.fromEntries(
        Object.entries(settings.images).map(([locale, references]) => [
          locale,
          Array.from({length: kvCount}, (_, index) => references?.[index] ?? null),
        ]),
      ) as KvLoopSettings['images'],
    },
  };
};

export const setKvCount = (
  project: EditorProject,
  kvCount: number,
): EditorProject => {
  const settings = kvLoopOf(project);

  return settings &&
    kvCount >= MIN_SECTION_COUNT &&
    kvCount <= MAX_SECTION_COUNT
    ? withKvCycle(project, settings.loopCount, kvCount, settings)
    : project;
};

export const setKvLoopCount = (
  project: EditorProject,
  loopCount: number,
): EditorProject => {
  const settings = kvLoopOf(project);

  return settings &&
    loopCount >= KV_LOOP_MIN_LOOPS &&
    loopCount <= KV_LOOP_MAX_LOOPS
    ? withKvCycle(project, loopCount, settings.slots.length, settings)
    : project;
};

/** FR-L09/FR-L19 — one key visual's framing, including its `fit`. */
export const updateKvSlotTransform = (
  project: EditorProject,
  index: number,
  patch: Partial<MediaTransform>,
): EditorProject =>
  mapKvLoop(project, (settings) => ({
    ...settings,
    slots: settings.slots.map((slot, slotIndex) =>
      slotIndex === index
        ? {
            ...slot,
            transform: {
              ...slot.transform,
              ...patch,
              ...(patch.scale === undefined
                ? {}
                : {scale: clamp(patch.scale, MIN_SCALE, MAX_SCALE)}),
              ...(patch.x === undefined
                ? {}
                : {x: clamp(patch.x, -MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT)}),
              ...(patch.y === undefined
                ? {}
                : {y: clamp(patch.y, -MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT)}),
            },
          }
        : slot,
    ),
  }));

export const resetKvSlotTransform = (
  project: EditorProject,
  index: number,
): EditorProject =>
  mapKvLoop(project, (settings) => ({
    ...settings,
    slots: settings.slots.map((slot, slotIndex) =>
      slotIndex === index ? {...slot, transform: {...DEFAULT_TRANSFORM}} : slot,
    ),
  }));

/**
 * kv-motion-effects FR-M01/FR-M02 — one key visual's motion. `null` hands the
 * slot back to the loop-wide default, which is the state a new slot starts in.
 */
export const setKvMotion = (
  project: EditorProject,
  index: number,
  motion: KvMotion | null,
): EditorProject =>
  mapKvLoop(project, (settings) => ({
    ...settings,
    slots: settings.slots.map((slot, slotIndex) =>
      slotIndex === index ? {...slot, motion} : slot,
    ),
  }));

/** FR-M02 — the preset every slot follows unless it says otherwise. */
export const setKvDefaultMotion = (
  project: EditorProject,
  motion: KvMotion,
): EditorProject => mapKvLoop(project, (settings) => ({...settings, motion}));

export type KvLoopPatch = Partial<{
  kenBurnsIntensity: number;
  transitionMs: number;
  fadeOutMs: number;
}>;

/** FR-L08/FR-L09/FR-L17 — the loop-wide motion values. */
export const updateKvLoopSettings = (
  project: EditorProject,
  patch: KvLoopPatch,
): EditorProject =>
  mapKvLoop(project, (settings) => ({
    ...settings,
    ...(patch.kenBurnsIntensity === undefined
      ? {}
      : {kenBurnsIntensity: clamp(patch.kenBurnsIntensity, 0, 1)}),
    ...(patch.transitionMs === undefined
      ? {}
      : {
          transitionMs: clamp(
            patch.transitionMs,
            MIN_TRANSITION_MS,
            MAX_TRANSITION_MS,
          ),
        }),
    ...(patch.fadeOutMs === undefined
      ? {}
      : {fadeOutMs: clamp(patch.fadeOutMs, 0, MAX_TRANSITION_MS)}),
  }));

/** FR-L10 — the optional title, per locale. Clearing it is a normal edit. */
export const setKvTitleImage = (
  project: EditorProject,
  locale: Locale,
  reference: MediaReference | null,
): EditorProject =>
  mapKvLoop(project, (settings) => {
    const images = {...settings.title.images};

    if (reference) {
      images[locale] = reference;
    } else {
      delete images[locale];
    }

    return {...settings, title: {...settings.title, images}};
  });

export const updateKvTitleTransform = (
  project: EditorProject,
  patch: Partial<MediaTransform>,
): EditorProject =>
  mapKvLoop(project, (settings) => ({
    ...settings,
    title: {
      ...settings.title,
      transform: {
        ...settings.title.transform,
        ...patch,
        ...(patch.scale === undefined
          ? {}
          : {scale: clamp(patch.scale, MIN_SCALE, MAX_SCALE)}),
        ...(patch.x === undefined
          ? {}
          : {x: clamp(patch.x, -MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT)}),
        ...(patch.y === undefined
          ? {}
          : {y: clamp(patch.y, -MAX_OFFSET_PERCENT, MAX_OFFSET_PERCENT)}),
      },
    },
  }));

/** FR-L11 — the disclaimer's styling; its wording lives in `copy`. */
export const updateKvDisclaimerStyle = (
  project: EditorProject,
  patch: Partial<KvLoopSettings['disclaimer']>,
): EditorProject =>
  mapKvLoop(project, (settings) => ({
    ...settings,
    disclaimer: {
      ...settings.disclaimer,
      ...patch,
      ...(patch.fontSize === undefined
        ? {}
        : {
            fontSize: clamp(
              patch.fontSize,
              MIN_SUBTITLE_FONT_SIZE,
              MAX_SUBTITLE_FONT_SIZE,
            ),
          }),
    },
  }));

/**
 * FR-D03 — the panels still missing a video. A non-empty list blocks the render;
 * the end card banner is deliberately not part of it (Plan and Design require two
 * videos and nothing else), so a missing banner is only a warning in the UI.
 */
export const day1MissingPanels = (
  project: EditorProject,
): Day1PanelKey[] => {
  const settings = day1PanelsOf(project);

  // day1-quad Plan Q6 — all four are required, which needs no new rule: the key
  // list is simply four long.
  return settings
    ? panelKeysOf(settings).filter(
        (key) => panelAt(settings, key)?.source == null,
      )
    : [];
};

/**
 * Day1 Trim UX FR-S01 — panels whose source cannot fill their section. The
 * source runs out partway and the panel renders black for the remainder, with
 * nothing in the UI saying so, which is what this exists to surface.
 *
 * A panel with no source at all belongs to `day1MissingPanels`, so the zero
 * guard keeps the two from reporting the same panel twice.
 */
export const day1PanelsShorterThanSection = (
  project: EditorProject,
): Day1PanelKey[] => {
  const settings = day1PanelsOf(project);

  return settings
    ? panelKeysOf(settings).filter((key) => {
        const sourceMs = panelAt(settings, key)?.source?.durationMs ?? 0;

        return sourceMs > 0 && sourceMs < day1SectionMs(project, key);
      })
    : [];
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
  (threeSceneOf(project)?.scenes ?? []).filter((scene, index) =>
    isTrimShorterThanScene(
      scene.trim,
      project.sections[index]?.durationMs ?? 0,
    ),
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
  const settings = threeSceneOf(project);

  // Day1 renders through its own composition and prop builder (module 3). The
  // editor gates on the template before it gets here, so this is a guard, not
  // a code path a user can reach.
  if (!settings) {
    return Object.freeze({
      src: null,
      scenes: Object.freeze([] as SceneRenderProps[]) as SceneRenderProps[],
      audio: buildAudioRenderProps(project, [], resolveUrl),
    });
  }

  const frames = allocateSceneFrames(
    sectionDurationsOf(project.sections),
    project.durationPreset,
    project.fps,
  );
  const copy = project.copy[project.selectedLocale] as LocalizedCopy;
  const gameplay = settings.scenes[1];
  const sourceUrl = resolveUrl(settings.source);
  let cursor = 0;

  const transitionOf = (index: number): TransitionRenderProps => {
    const scene = settings.scenes[index];

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

  const scenes: SceneRenderProps[] = settings.scenes.map((scene, index) => {
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
    src: settings.source ? sourceUrl : null,
    scenes: Object.freeze(scenes) as SceneRenderProps[],
    audio: buildAudioRenderProps(project, scenes, resolveUrl),
  });
};

/**
 * Endcard-Video Design §3.3 — both treatments resolved side by side; `mode` is
 * what the composition branches on. The fps conversion happens only here, so
 * the composition never computes frames itself.
 */
const buildEndCardProps = (
  endCard: Day1Settings['endCard'],
  project: EditorProject,
  resolveUrl: (reference: MediaReference | null | undefined) => string | null,
): Day1EndCardRenderProps => {
  const videoTrimBeforeFrames = msToFrames(endCard.videoTrim.inMs, project.fps);

  return Object.freeze({
    mode: endCard.mode,
    bannerUrl: resolveUrl(endCard.banner),
    iconUrl: resolveUrl(endCard.appIcon),
    iconRect: Object.freeze(
      appIconRect(project.selectedRatio, endCard.iconAdjust),
    ),
    iconAnimation: endCard.iconAnimation,
    cardMotion: endCard.cardMotion,
    videoUrl: resolveUrl(endCard.video),
    videoTrimBeforeFrames,
    videoTrimAfterFrames: Math.max(
      videoTrimBeforeFrames + 1,
      msToFrames(endCard.videoTrim.outMs, project.fps),
    ),
    // day1-endcard-audio FR-01 — straight through; the fade is computed in the
    // composition from these plus the section length.
    videoAudioEnabled: endCard.videoAudioEnabled,
    videoAudioVolume: endCard.videoAudioVolume,
  });
};

/**
 * Day1 counterpart of `buildCompositionProps`. Day1 Design Ref: §2.2 — the split
 * geometry, the section frame layout, and the resolved URLs are all baked in here
 * so the composition is presentational and the Player and the render job consume
 * one identical snapshot.
 *
 * Returns null for a foreign template rather than an empty snapshot: unlike
 * three-scene there is no meaningful Day1 frame to draw without a payload, and a
 * nullable return makes the caller's template check the compiler's problem.
 */
export const buildDay1Props = (
  project: EditorProject,
  resolveUrl: (reference: MediaReference | null | undefined) => string | null,
): Day1Props | null => {
  const settings = day1Of(project);

  if (!settings) {
    return null;
  }

  const frames = allocateSceneFrames(
    sectionDurationsOf(project.sections),
    project.durationPreset,
    project.fps,
  );
  const copy = project.copy[project.selectedLocale] as LocalizedCopy;
  let cursor = 0;

  const sections = project.sections.map((section, index) => {
    const durationInFrames = frames[index] as number;
    const props: Day1SectionRenderProps = {
      id: section.id,
      fromFrame: cursor,
      durationInFrames,
      activePanel: activePanelForSection(index as 0 | 1 | 2),
    };

    cursor += durationInFrames;

    return Object.freeze(props);
  });

  const panelProps = (
    panel: Day1Panel,
    label: string,
  ): Day1PanelRenderProps => {
    const transform = activeTransform(panel, project.selectedRatio);
    const trimBeforeFrames = msToFrames(panel.trim.inMs, project.fps);

    return Object.freeze({
      url: resolveUrl(panel.source),
      trimBeforeFrames,
      trimAfterFrames: Math.max(
        trimBeforeFrames + 1,
        msToFrames(panel.trim.outMs, project.fps),
      ),
      fit: transform.fit,
      scale: transform.scale,
      x: transform.x,
      y: transform.y,
      label,
    });
  };

  const {endCard} = settings;

  return Object.freeze({
    layout: Object.freeze(
      splitLayout(project.selectedRatio, settings.split.lineWidthPx),
    ),
    lineColor: settings.split.lineColor,
    panelA: panelProps(settings.panelA, copy.day1Labels?.a ?? ''),
    panelB: panelProps(settings.panelB, copy.day1Labels?.b ?? ''),
    labelStyle: Object.freeze({...settings.labelStyle}),
    endCard: buildEndCardProps(endCard, project, resolveUrl),
    sections: Object.freeze(sections) as Day1SectionRenderProps[],
    // Plan §2.2 keeps narration and TTS out of Day1, so passing no scenes yields
    // an empty narration list: only BGM and the live panel's own audio play.
    audio: buildAudioRenderProps(project, [], resolveUrl),
  });
};

/**
 * day1-quad Design §6.4 — the Day1 prop builder over four panels. Returns null
 * for any other template, matching `buildDay1Props`.
 *
 * Everything the composition needs is resolved here: the grid geometry, the
 * per-section frame layout, the four panels with their locale-resolved labels,
 * and the end card — which is `buildEndCardProps` unchanged, because Plan Q7
 * reuses the Day1 card whole.
 */
export const buildDay1QuadProps = (
  project: EditorProject,
  resolveUrl: (reference: MediaReference | null | undefined) => string | null,
): Day1QuadProps | null => {
  const settings = day1QuadOf(project);

  if (!settings) {
    return null;
  }

  const frames = allocateSceneFrames(
    sectionDurationsOf(project.sections),
    project.durationPreset,
    project.fps,
  );
  const copy = project.copy[project.selectedLocale] as LocalizedCopy;
  let cursor = 0;

  const sections = project.sections.map((section, index) => {
    const durationInFrames = frames[index] as number;
    const props: Day1SectionRenderProps<Day1PanelSlot> = {
      id: section.id,
      fromFrame: cursor,
      durationInFrames,
      activePanel: activePanelForQuadSection(index),
    };

    cursor += durationInFrames;

    return Object.freeze(props);
  });

  const panelProps = (panel: Day1Panel, label: string): Day1PanelRenderProps => {
    const transform = activeTransform(panel, project.selectedRatio);
    const trimBeforeFrames = msToFrames(panel.trim.inMs, project.fps);

    return Object.freeze({
      url: resolveUrl(panel.source),
      trimBeforeFrames,
      trimAfterFrames: Math.max(
        trimBeforeFrames + 1,
        msToFrames(panel.trim.outMs, project.fps),
      ),
      fit: transform.fit,
      scale: transform.scale,
      x: transform.x,
      y: transform.y,
      label,
    });
  };

  const labels = copy.day1Labels;

  return Object.freeze({
    layout: Object.freeze(
      quadLayout(project.selectedRatio, settings.split.lineWidthPx),
    ),
    lineColor: settings.split.lineColor,
    panels: Object.freeze([
      panelProps(settings.panelA, labels?.a ?? ''),
      panelProps(settings.panelB, labels?.b ?? ''),
      panelProps(settings.panelC, labels?.c ?? ''),
      panelProps(settings.panelD, labels?.d ?? ''),
    ]) as Day1QuadProps['panels'],
    labelStyle: Object.freeze({...settings.labelStyle}),
    endCard: buildEndCardProps(settings.endCard, project, resolveUrl),
    sections: Object.freeze(sections) as Day1SectionRenderProps<Day1PanelSlot>[],
    // Plan §3.2 keeps narration and TTS out of the quad template too, so passing
    // no scenes yields an empty narration list: only BGM and the live panel.
    audio: buildAudioRenderProps(project, [], resolveUrl),
  });
};

/**
 * key-visual-looping Design Ref: §5.1 — the looping render contract. Returns
 * null for any other template, matching `buildDay1Props`.
 *
 * Everything the composition needs is resolved here: the flattened cycle, the
 * locale's key visuals (or the set it inherits), the crossfade in frames, and
 * the two overlays whose absence is a normal state (Plan L5).
 */
export const buildKvLoopProps = (
  project: EditorProject,
  resolveUrl: (reference: MediaReference | null | undefined) => string | null,
): KvLoopProps | null => {
  const settings = kvLoopOf(project);

  if (!settings) {
    return null;
  }

  const totalFrames = projectTotalFrames(project);
  const segments = kvLoopSegments(
    sectionDurationsOf(project.sections),
    settings.loopCount,
    totalFrames,
  );
  const {references} = resolveKvSet(
    settings.images,
    project.selectedLocale,
    settings.slots.length,
  );
  const title = resolveKvTitle(settings.title.images, project.selectedLocale);
  const copy = project.copy[project.selectedLocale] as LocalizedCopy;

  // A crossfade lives inside the segment it fades into, so half of the shortest
  // segment is the ceiling — the same "never longer than half its own section"
  // rule the three-scene transitions follow.
  const shortestFrames = segments.reduce(
    (shortest, segment) => Math.min(shortest, segment.durationInFrames),
    Number.POSITIVE_INFINITY,
  );
  const transitionInFrames = Number.isFinite(shortestFrames)
    ? Math.min(
        msToFrames(settings.transitionMs, project.fps),
        Math.floor(shortestFrames / 2),
      )
    : 0;

  // kv-motion-effects §2.2 — the keyframes are resolved once, here, so the
  // Player and the render job interpolate the identical pair.
  const slots = settings.slots.map((slot, index) =>
    Object.freeze({
      url: resolveUrl(references[index]),
      fit: slot.transform.fit,
      scale: slot.transform.scale,
      x: slot.transform.x,
      y: slot.transform.y,
      motion: Object.freeze(
        resolveKvMotion(
          slot.motion ?? settings.motion,
          settings.kenBurnsIntensity,
        ),
      ),
    }),
  );

  return Object.freeze({
    segments: Object.freeze(segments) as KvSegment[],
    slots: Object.freeze(slots) as KvSlotRenderProps[],
    kenBurnsIntensity: settings.kenBurnsIntensity,
    transitionInFrames,
    fadeOutFrames: msToFrames(settings.fadeOutMs, project.fps),
    totalFrames,
    title: Object.freeze({
      url: resolveUrl(title.reference),
      fit: settings.title.transform.fit,
      scale: settings.title.transform.scale,
      x: settings.title.transform.x,
      y: settings.title.transform.y,
    }),
    disclaimer: Object.freeze({
      text: copy.kvLoopDisclaimer ?? '',
      fontSize: settings.disclaimer.fontSize,
      textColor: settings.disclaimer.textColor,
    }),
    // Plan L9 — BGM only, so no scenes go in and the narration list comes back
    // empty, the same call Day1 makes.
    audio: buildAudioRenderProps(project, [], resolveUrl),
  });
};

/**
 * The one place the template decides which snapshot a render job carries.
 * Day1 Design Ref: §2.1 — the editor preview, the single render, and the Batch
 * queue all go through here, so the branch cannot drift between them.
 *
 * Plan SC1: a Day1 job must reach `Day1Composition`, never a three-scene snapshot,
 * and key-visual-looping SC1 asks the same of a looping job.
 */
export const buildEditorSnapshot = (
  project: EditorProject,
  resolveUrl: (reference: MediaReference | null | undefined) => string | null,
): EditorSnapshot => {
  // Each builder returns non-null exactly for its own payload, and
  // `buildCompositionProps` already degrades a foreign template to an empty
  // three-scene snapshot. So this stays total without a cast.
  const day1Props = buildDay1Props(project, resolveUrl);

  if (day1Props) {
    return {template: 'day1', props: day1Props};
  }

  const day1QuadProps = buildDay1QuadProps(project, resolveUrl);

  if (day1QuadProps) {
    return {template: 'day1-quad', props: day1QuadProps};
  }

  const kvLoopProps = buildKvLoopProps(project, resolveUrl);

  return kvLoopProps
    ? {template: 'kv-loop', props: kvLoopProps}
    : {template: 'three-scene', props: buildCompositionProps(project, resolveUrl)};
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
