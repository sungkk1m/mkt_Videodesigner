// Design Ref: §10.2 — Zod schemas are the runtime source of truth for project
// data and the inferred types are what the rest of the app consumes.
//
// Scope note: this covers modules 1-4 (persisted source reference, three scenes,
// four locales, three ratios, subtitles, transitions, Hook motion, CTA assets).
// Audio mix, narration, and Hook analysis join the schema with modules 5-6.
import {z} from 'zod';

import {mediaReferenceSchema} from '../media/reference';
import {FRAME_RATES, RENDER_PROFILES, fpsForProfile} from '../render/profile';
import {
  ASPECT_RATIOS,
  DURATION_PRESETS,
  HOOK_MOTION_PRESETS,
  LOCALES,
  MAX_BATCH_JOBS,
  MAX_COPY_LENGTH,
  MAX_CTA_BACKGROUND_BLUR,
  MAX_OFFSET_PERCENT,
  MAX_PROJECT_NAME_LENGTH,
  MAX_SCALE,
  MAX_SUBTITLE_FONT_SIZE,
  MAX_TRANSITION_MS,
  MIN_SCALE,
  MIN_SCENE_MS,
  MAX_TTS_SPEED,
  MIN_SUBTITLE_FONT_SIZE,
  MIN_TRANSITION_MS,
  MIN_TTS_SPEED,
  PROJECT_SCHEMA_VERSION,
  SCENE_ORDER,
  SUBTITLE_ALIGNMENTS,
  SUBTITLE_POSITIONS,
  TRANSITION_KINDS,
} from './constants';

export const sceneKindSchema = z.enum(SCENE_ORDER);
export const localeSchema = z.enum(LOCALES);
export const aspectRatioSchema = z.enum(ASPECT_RATIOS);
export const transitionKindSchema = z.enum(TRANSITION_KINDS);
export const hookMotionPresetSchema = z.enum(HOOK_MOTION_PRESETS);

export const durationPresetSchema = z.union([
  z.literal(DURATION_PRESETS[0]),
  z.literal(DURATION_PRESETS[1]),
  z.literal(DURATION_PRESETS[2]),
]);

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, {
  message: 'Color must be a #rrggbb value.',
});

const copyTextSchema = z.string().max(MAX_COPY_LENGTH);

export const mediaTrimSchema = z
  .object({
    inMs: z.number().nonnegative(),
    outMs: z.number().nonnegative(),
  })
  .refine((trim) => trim.outMs >= trim.inMs, {
    message: 'Trim out must not precede trim in.',
  });

export const mediaTransformSchema = z.object({
  fit: z.literal('cover'),
  scale: z.number().min(MIN_SCALE).max(MAX_SCALE),
  /** Horizontal offset as a percentage of the output frame width. */
  x: z.number().min(-MAX_OFFSET_PERCENT).max(MAX_OFFSET_PERCENT),
  /** Vertical offset as a percentage of the output frame height. */
  y: z.number().min(-MAX_OFFSET_PERCENT).max(MAX_OFFSET_PERCENT),
});

/** Design Ref: §3.1 — one base framing plus optional per-ratio overrides. */
export const ratioTransformsSchema = z.object({
  base: mediaTransformSchema,
  overrides: z.partialRecord(aspectRatioSchema, mediaTransformSchema),
});

export const subtitleStyleSchema = z.object({
  position: z.enum(SUBTITLE_POSITIONS),
  align: z.enum(SUBTITLE_ALIGNMENTS),
  fontSize: z.number().min(MIN_SUBTITLE_FONT_SIZE).max(MAX_SUBTITLE_FONT_SIZE),
  textColor: hexColorSchema,
  emphasisColor: hexColorSchema,
  showBackground: z.boolean(),
  backgroundColor: hexColorSchema,
  backgroundOpacity: z.number().min(0).max(1),
});

export const sceneTransitionSchema = z.object({
  kind: transitionKindSchema,
  durationMs: z.number().min(MIN_TRANSITION_MS).max(MAX_TRANSITION_MS),
});

export const hookSceneSettingsSchema = z.object({
  motionPreset: hookMotionPresetSchema,
  emphasizedText: copyTextSchema,
  dimBackground: z.boolean(),
});

export const ctaSceneSettingsSchema = z.object({
  /** Dedicated CTA footage; null falls back to the last gameplay frame. */
  media: mediaReferenceSchema.nullable(),
  appIcon: mediaReferenceSchema.nullable(),
  logo: mediaReferenceSchema.nullable(),
  storeBadge: mediaReferenceSchema.nullable(),
  useGeneratedBackground: z.boolean(),
  backgroundBlur: z.number().min(0).max(MAX_CTA_BACKGROUND_BLUR),
  backgroundDim: z.number().min(0).max(1),
});

/**
 * Design Ref: §3.3 Audio.
 *
 * Scope note: generated narration is stored as a `MediaReference` whose id is the
 * TTS cache key and whose fingerprint is the request hash, instead of the separate
 * `CachedAudioReference` shape in the Design. One reference type means one URL
 * resolver, one relink path, and one persistence rule for every audio asset.
 */
export const audioTrackSchema = z.object({
  source: mediaReferenceSchema,
  volume: z.number().min(0).max(1),
  startMs: z.number().nonnegative(),
  loop: z.boolean(),
});

export const narrationTrackSchema = z.object({
  mode: z.enum(['generated', 'uploaded']),
  providerId: z.string().min(1),
  source: mediaReferenceSchema,
  durationMs: z.number().positive(),
  volume: z.number().min(0).max(1),
  voiceId: z.string().optional(),
  speed: z.number().min(MIN_TTS_SPEED).max(MAX_TTS_SPEED).optional(),
  requestHash: z.string().optional(),
});

export const audioMixSchema = z.object({
  originalVolume: z.number().min(0).max(1),
  bgm: audioTrackSchema.nullable(),
  narration: z.partialRecord(
    localeSchema,
    z.partialRecord(sceneKindSchema, narrationTrackSchema),
  ),
  ducking: z.object({
    enabled: z.boolean(),
    /** Gain applied to original audio and BGM while narration plays. */
    targetGain: z.number().min(0).max(1),
    attackMs: z.number().min(0).max(2000),
    releaseMs: z.number().min(0).max(2000),
  }),
});

/** Design Ref: §3.4 RenderSettings. */
export const renderSettingsSchema = z.object({
  profile: z.enum(RENDER_PROFILES),
  fps: z.union([z.literal(FRAME_RATES[0]), z.literal(FRAME_RATES[1])]),
  selectedLocales: z.array(localeSchema).min(1).max(LOCALES.length),
  selectedRatios: z.array(aspectRatioSchema).min(1).max(ASPECT_RATIOS.length),
  filePrefix: z.string().max(MAX_PROJECT_NAME_LENGTH),
});

export const localizedCopySchema = z.object({
  hook: copyTextSchema,
  hookSubcopy: copyTextSchema,
  sceneSubtitles: z.record(sceneKindSchema, copyTextSchema),
  ctaText: copyTextSchema,
  ctaSubcopy: copyTextSchema,
});

export const editorSceneSchema = z.object({
  kind: sceneKindSchema,
  durationMs: z.number().min(MIN_SCENE_MS),
  trim: mediaTrimSchema,
  transforms: ratioTransformsSchema,
  subtitle: subtitleStyleSchema,
  transitionOut: sceneTransitionSchema,
  hook: hookSceneSettingsSchema.optional(),
  cta: ctaSceneSettingsSchema.optional(),
});

export const editorProjectSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    id: z.string().min(1),
    name: z.string().max(MAX_PROJECT_NAME_LENGTH),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    durationPreset: durationPresetSchema,
    fps: z.union([z.literal(FRAME_RATES[0]), z.literal(FRAME_RATES[1])]),
    scenes: z.tuple([editorSceneSchema, editorSceneSchema, editorSceneSchema]),
    source: mediaReferenceSchema.nullable(),
    copy: z.record(localeSchema, localizedCopySchema),
    audio: audioMixSchema,
    render: renderSettingsSchema,
    selectedLocale: localeSchema,
    selectedRatio: aspectRatioSchema,
  })
  .superRefine((project, context) => {
    project.scenes.forEach((scene, index) => {
      if (scene.kind !== SCENE_ORDER[index]) {
        context.addIssue({
          code: 'custom',
          path: ['scenes', index, 'kind'],
          message: `Scene ${index} must be ${SCENE_ORDER[index]}.`,
        });
      }
    });

    if (!project.scenes[0].hook) {
      context.addIssue({
        code: 'custom',
        path: ['scenes', 0, 'hook'],
        message: 'The Hook scene must carry Hook settings.',
      });
    }

    if (!project.scenes[2].cta) {
      context.addIssue({
        code: 'custom',
        path: ['scenes', 2, 'cta'],
        message: 'The CTA scene must carry CTA settings.',
      });
    }

    const totalMs = project.scenes.reduce(
      (sum, scene) => sum + scene.durationMs,
      0,
    );

    if (totalMs !== project.durationPreset * 1000) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: `Scene durations must total ${project.durationPreset} seconds, received ${totalMs / 1000}.`,
      });
    }

    // Design Ref: §3.5 — a transition may not exceed half of its own scene.
    project.scenes.forEach((scene, index) => {
      if (scene.transitionOut.kind !== 'cut') {
        const limit = scene.durationMs / 2;

        if (scene.transitionOut.durationMs > limit) {
          context.addIssue({
            code: 'custom',
            path: ['scenes', index, 'transitionOut', 'durationMs'],
            message: `Transition must not exceed half of the scene (${limit}ms).`,
          });
        }
      }
    });

    const jobCount =
      project.render.selectedLocales.length *
      project.render.selectedRatios.length;

    if (jobCount > MAX_BATCH_JOBS) {
      context.addIssue({
        code: 'custom',
        path: ['render'],
        message: `Batch expands to ${jobCount} jobs, above the ${MAX_BATCH_JOBS} maximum.`,
      });
    }

    if (project.render.fps !== fpsForProfile(project.render.profile, project.render.fps)) {
      context.addIssue({
        code: 'custom',
        path: ['render', 'fps'],
        message: `Profile ${project.render.profile} does not allow ${project.render.fps}fps.`,
      });
    }

    if (project.source) {
      if (!project.source.durationMs) {
        context.addIssue({
          code: 'custom',
          path: ['source', 'durationMs'],
          message: 'The project source must be a video with a duration.',
        });
      }

      project.scenes.forEach((scene, index) => {
        if (scene.trim.outMs > (project.source?.durationMs ?? 0)) {
          context.addIssue({
            code: 'custom',
            path: ['scenes', index, 'trim', 'outMs'],
            message: 'Trim out must stay inside the source duration.',
          });
        }
      });
    }
  });

export type SceneKind = z.infer<typeof sceneKindSchema>;
export type Locale = z.infer<typeof localeSchema>;
export type AspectRatio = z.infer<typeof aspectRatioSchema>;
export type TransitionKind = z.infer<typeof transitionKindSchema>;
export type HookMotionPreset = z.infer<typeof hookMotionPresetSchema>;
export type DurationPreset = z.infer<typeof durationPresetSchema>;
export type MediaTrim = z.infer<typeof mediaTrimSchema>;
export type MediaTransform = z.infer<typeof mediaTransformSchema>;
export type RatioTransforms = z.infer<typeof ratioTransformsSchema>;
export type SubtitleStyle = z.infer<typeof subtitleStyleSchema>;
export type SceneTransition = z.infer<typeof sceneTransitionSchema>;
export type HookSceneSettings = z.infer<typeof hookSceneSettingsSchema>;
export type CtaSceneSettings = z.infer<typeof ctaSceneSettingsSchema>;
export type LocalizedCopy = z.infer<typeof localizedCopySchema>;
export type AudioTrack = z.infer<typeof audioTrackSchema>;
export type NarrationTrack = z.infer<typeof narrationTrackSchema>;
export type AudioMix = z.infer<typeof audioMixSchema>;
export type RenderSettings = z.infer<typeof renderSettingsSchema>;
export type EditorScene = z.infer<typeof editorSceneSchema>;
export type EditorProject = z.infer<typeof editorProjectSchema>;
export type EditorScenes = EditorProject['scenes'];
