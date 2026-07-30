// Design Ref: §10.2 — project state changes only through pure command functions.
import {DEFAULT_AUDIO_MIX} from '../audio/mix';
import {appIconRect} from '../day1/endCard';
import {splitLayout} from '../day1/layout';
import {activePanelForSection, day1SectionDurations} from '../day1/playback';
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
  DAY1_SECTION_ORDER,
  DEFAULT_LOCALE,
  DEFAULT_RATIO,
  DEFAULT_SUBTITLE,
  DEFAULT_TRANSFORM,
  EDITOR_FPS,
  LOCALES,
  MAX_CTA_BACKGROUND_BLUR,
  MAX_ICON_ADJUST,
  MAX_ICON_SCALE,
  MAX_LABEL_OUTLINE_WIDTH_PX,
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MAX_SPLIT_LINE_WIDTH_PX,
  MAX_SUBTITLE_FONT_SIZE,
  MAX_TRANSITION_MS,
  MIN_ICON_SCALE,
  MIN_SCALE,
  MIN_SUBTITLE_FONT_SIZE,
  MIN_TRANSITION_MS,
  PROJECT_SCHEMA_VERSION,
  RATIO_DIMENSIONS,
  SCENE_LABELS,
  SCENE_ORDER,
  type ActivePanel,
  type AspectRatio,
  type AudioRenderProps,
  type CtaRenderProps,
  type CtaSceneSettings,
  type Day1Panel,
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
    transforms: {base: {...DEFAULT_TRANSFORM}, overrides: {}},
  },
  panelB: {
    source: null,
    trim: {inMs: 0, outMs: 0},
    transforms: {base: {...DEFAULT_TRANSFORM}, overrides: {}},
  },
  split: {lineColor: '#9ca3af', lineWidthPx: 6},
  labelStyle: {
    fontSize: 72,
    textColor: '#ffffff',
    outlineColor: '#000000',
    outlineWidthPx: 8,
    position: 'top',
  },
  endCard: {
    banner: null,
    appIcon: null,
    iconAdjust: {dx: 0, dy: 0, scale: 1},
    iconAnimation: 'pop',
    cardMotion: 'ken-burns',
  },
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

/** Day1 Design Ref: §3.1 — the three-scene view of the shared time axis. */
const buildSections = (preset: DurationPreset): Sections => {
  const durations = createSceneDurations(preset);

  return SCENE_ORDER.map((kind, index) => ({
    id: kind,
    label: SCENE_LABELS[kind],
    durationMs: durations[index] as number,
  })) as Sections;
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
  })) as Sections,
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
  const resized = withSectionDurations(
    {...project, durationPreset: preset},
    project.templateSettings.template === 'day1'
      ? day1SectionDurations(preset)
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
  patch: Partial<Omit<MediaTransform, 'fit'>>,
): MediaTransform => ({
  fit: 'cover',
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
  patch: Partial<Omit<MediaTransform, 'fit'>>,
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

// ---------------------------------------------------------------------------
// Day1 commands. Day1 Design Ref: §6.1 template switch, §6.3 inspector.
// Each one no-ops on a foreign template, matching the three-scene commands above.
// ---------------------------------------------------------------------------

export type Day1PanelKey = 'panelA' | 'panelB';

/** Panel A owns section 0, panel B section 1. Day1 Design Ref: §1.2. */
const DAY1_PANEL_SECTION: Record<Day1PanelKey, 0 | 1> = {panelA: 0, panelB: 1};

const withDay1 = (
  project: EditorProject,
  settings: Day1Settings,
): EditorProject => ({...project, templateSettings: settings});

const mapDay1Panel = (
  project: EditorProject,
  key: Day1PanelKey,
  update: (panel: Day1Panel) => Day1Panel,
): EditorProject => {
  const settings = day1Of(project);

  return settings
    ? withDay1(project, {...settings, [key]: update(settings[key])})
    : project;
};

const day1SectionMs = (project: EditorProject, key: Day1PanelKey) =>
  project.sections[DAY1_PANEL_SECTION[key]]?.durationMs ?? 0;

/** Day1 Design Ref: §3.5 — a panel trim window never outgrows its section. */
const reconcileDay1Trims = (project: EditorProject): EditorProject => {
  const settings = day1Of(project);

  if (!settings) {
    return project;
  }

  const trimOf = (key: Day1PanelKey) =>
    reconcileTrim(
      settings[key].trim,
      settings[key].source?.durationMs ?? 0,
      day1SectionMs(project, key),
    );

  return withDay1(project, {
    ...settings,
    panelA: {...settings.panelA, trim: trimOf('panelA')},
    panelB: {...settings.panelB, trim: trimOf('panelB')},
  });
};

/** Day1 Design Ref: §3.1 — the Day1 view of the shared time axis. */
const buildDay1Sections = (preset: DurationPreset): Sections => {
  const durations = day1SectionDurations(preset);

  return DAY1_SECTION_ORDER.map((id, index) => ({
    id,
    label: DAY1_SECTION_LABELS[id],
    durationMs: durations[index] as number,
  })) as Sections;
};

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

  return template === 'day1'
    ? {
        ...project,
        sections: buildDay1Sections(project.durationPreset),
        templateSettings: structuredClone(DEFAULT_DAY1_SETTINGS),
      }
    : {
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
  const settings = day1Of(project);

  if (!settings) {
    return project;
  }

  const sourceMs = settings[key].source?.durationMs ?? 0;

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
  const settings = day1Of(project);

  if (!settings) {
    return project;
  }

  const sectionMs = day1SectionMs(project, key);
  const windowMs = Math.min(
    sectionMs,
    settings[key].source?.durationMs ?? sectionMs,
  );

  return setDay1TrimInMs(project, key, outMs - windowMs);
};

/** FR-D07 — per-panel Cover reframing with the same override rules as a scene. */
export const updateDay1Transform = (
  project: EditorProject,
  key: Day1PanelKey,
  ratio: AspectRatio,
  patch: Partial<Omit<MediaTransform, 'fit'>>,
): EditorProject =>
  mapDay1Panel(project, key, (panel) => writeTransform(panel, ratio, patch));

export const resetDay1Transform = (
  project: EditorProject,
  key: Day1PanelKey,
  ratio: AspectRatio,
): EditorProject =>
  updateDay1Transform(project, key, ratio, DEFAULT_TRANSFORM);

export const setDay1RatioOverride = (
  project: EditorProject,
  key: Day1PanelKey,
  ratio: AspectRatio,
  enabled: boolean,
): EditorProject =>
  mapDay1Panel(project, key, (panel) =>
    writeRatioOverride(panel, ratio, enabled),
  );

/** FR-D08 — split line colour and thickness. */
export const updateDay1Split = (
  project: EditorProject,
  patch: Partial<Day1Settings['split']>,
): EditorProject => {
  const settings = day1Of(project);

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
  const settings = day1Of(project);

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
    },
  });
};

export type Day1EndCardPatch = Partial<
  Omit<Day1Settings['endCard'], 'iconAdjust'>
> & {iconAdjust?: Partial<IconAdjust>};

/** FR-D11 ~ FR-D13 — banner, icon layer, nudge, and the motion presets. */
export const updateDay1EndCard = (
  project: EditorProject,
  patch: Day1EndCardPatch,
): EditorProject => {
  const settings = day1Of(project);

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
    },
  });
};

/** FR-D09 — per-panel label wording in the locale currently selected. */
export const setDay1LabelText = (
  project: EditorProject,
  locale: Locale,
  panel: ActivePanel,
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
 * FR-D03 — the panels still missing a video. A non-empty list blocks the render;
 * the end card banner is deliberately not part of it (Plan and Design require two
 * videos and nothing else), so a missing banner is only a warning in the UI.
 */
export const day1MissingPanels = (
  project: EditorProject,
): Day1PanelKey[] => {
  const settings = day1Of(project);

  return settings
    ? (['panelA', 'panelB'] as Day1PanelKey[]).filter(
        (key) => settings[key].source === null,
      )
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
    endCard: Object.freeze({
      bannerUrl: resolveUrl(endCard.banner),
      iconUrl: resolveUrl(endCard.appIcon),
      iconRect: Object.freeze(
        appIconRect(project.selectedRatio, endCard.iconAdjust),
      ),
      iconAnimation: endCard.iconAnimation,
      cardMotion: endCard.cardMotion,
    }),
    sections: Object.freeze(sections) as Day1SectionRenderProps[],
    // Plan §2.2 keeps narration and TTS out of Day1, so passing no scenes yields
    // an empty narration list: only BGM and the live panel's own audio play.
    audio: buildAudioRenderProps(project, [], resolveUrl),
  });
};

/**
 * The one place the template decides which snapshot a render job carries.
 * Day1 Design Ref: §2.1 — the editor preview, the single render, and the Batch
 * queue all go through here, so the branch cannot drift between them.
 *
 * Plan SC1: a Day1 job must reach `Day1Composition`, never a three-scene snapshot.
 */
export const buildEditorSnapshot = (
  project: EditorProject,
  resolveUrl: (reference: MediaReference | null | undefined) => string | null,
): EditorSnapshot => {
  // `buildDay1Props` returns non-null exactly for a Day1 payload, and
  // `buildCompositionProps` already degrades a foreign template to an empty
  // three-scene snapshot. So this stays total without a cast.
  const day1Props = buildDay1Props(project, resolveUrl);

  return day1Props
    ? {template: 'day1', props: day1Props}
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
