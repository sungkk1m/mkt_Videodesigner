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
  DAY1_CARD_MOTIONS,
  DAY1_END_CARD_MODES,
  DAY1_ICON_ANIMATIONS,
  DAY1_QUAD_DURATION_PRESETS,
  DAY1_QUAD_SECTION_ORDER,
  DAY1_SECTION_ORDER,
  DURATION_PRESETS,
  HOOK_MOTION_PRESETS,
  KV_LOOP_MAX_LOOPS,
  KV_LOOP_MIN_LOOPS,
  KV_LOOP_RATIO,
  KV_MOTION_MAX_SCALE,
  KV_MOTION_PRESETS,
  LOCALES,
  MAX_BATCH_JOBS,
  MAX_COPY_LENGTH,
  MAX_CTA_BACKGROUND_BLUR,
  MAX_ICON_ADJUST,
  MAX_ICON_SCALE,
  MAX_LABEL_OUTLINE_WIDTH_PX,
  MAX_OFFSET_PERCENT,
  MAX_PROJECT_NAME_LENGTH,
  MAX_SCALE,
  MAX_SECTION_COUNT,
  MAX_SPLIT_LINE_WIDTH_PX,
  MAX_SUBTITLE_FONT_SIZE,
  MAX_KV_BLUR_PX,
  MAX_TRANSITION_MS,
  MIN_ICON_SCALE,
  MEDIA_FITS,
  MIN_SCALE,
  MIN_SCENE_MS,
  MIN_SECTION_COUNT,
  MAX_TTS_SPEED,
  MIN_SUBTITLE_FONT_SIZE,
  MIN_TRANSITION_MS,
  MIN_TTS_SPEED,
  PROJECT_SCHEMA_VERSION,
  SCENE_ORDER,
  SUBTITLE_ALIGNMENTS,
  SUBTITLE_POSITIONS,
  TEMPLATE_KINDS,
  TRANSITION_KINDS,
  kvSectionId,
} from './constants';

export const sceneKindSchema = z.enum(SCENE_ORDER);
export const templateKindSchema = z.enum(TEMPLATE_KINDS);
export const localeSchema = z.enum(LOCALES);
export const aspectRatioSchema = z.enum(ASPECT_RATIOS);
export const transitionKindSchema = z.enum(TRANSITION_KINDS);
export const hookMotionPresetSchema = z.enum(HOOK_MOTION_PRESETS);

export const durationPresetSchema = z.union([
  z.literal(DURATION_PRESETS[0]),
  z.literal(DURATION_PRESETS[1]),
  z.literal(DURATION_PRESETS[2]),
]);

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, {
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
  /** day1-video — `cover` crops to fill, `contain` keeps the whole source. */
  fit: z.enum(MEDIA_FITS),
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
  /**
   * Day1 panel labels. Day1 Design Ref: §3.3 — optional so a v1 copy block
   * parses untouched and three-scene projects never carry the field.
   */
  day1Labels: z
    .object({
      a: copyTextSchema,
      b: copyTextSchema,
      /**
       * day1-quad Design §5.3 — optional, so a stored Day1 document parses
       * untouched and no migration is needed. Same trick as `endCard.mode`.
       */
      c: copyTextSchema.optional(),
      d: copyTextSchema.optional(),
    })
    .optional(),
  /**
   * key-visual-looping Design Ref: §3.3 — the looping template's bottom
   * disclaimer. Optional for the same reason `day1Labels` is: a copy block saved
   * by either existing template parses untouched.
   */
  kvLoopDisclaimer: copyTextSchema.optional(),
});

/**
 * Day1 Design Ref: §3.2 — per-scene settings without `durationMs`, which now
 * lives on the shared `sections` axis so the two never drift apart.
 */
export const sceneSettingsSchema = z.object({
  kind: sceneKindSchema,
  trim: mediaTrimSchema,
  transforms: ratioTransformsSchema,
  subtitle: subtitleStyleSchema,
  transitionOut: sceneTransitionSchema,
  hook: hookSceneSettingsSchema.optional(),
  cta: ctaSceneSettingsSchema.optional(),
});

/** Day1 Design Ref: §3.1 — the time axis every template shares. */
export const sectionSchema = z.object({
  /** `hook`|`gameplay`|`cta` for three-scene, `panel-a`|`panel-b`|`endcard` for Day1. */
  id: z.string().min(1),
  /** Shown on the timeline clip. */
  label: z.string().min(1),
  durationMs: z.number().min(MIN_SCENE_MS),
});

/**
 * key-visual-looping Design Ref: §3.1 — a variable length axis. Stored v2
 * documents hold exactly three sections, so they parse unchanged and there is no
 * migration; `PROJECT_SCHEMA_VERSION` stays 2. The per-template count is pinned
 * below in `superRefine`, which is what keeps the existing two at three.
 */
export const sectionsSchema = z
  .array(sectionSchema)
  .min(MIN_SECTION_COUNT)
  .max(MAX_SECTION_COUNT);

export const threeSceneSettingsSchema = z.object({
  template: z.literal('three-scene'),
  source: mediaReferenceSchema.nullable(),
  scenes: z.tuple([
    sceneSettingsSchema,
    sceneSettingsSchema,
    sceneSettingsSchema,
  ]),
});

/** Day1 Design Ref: §3.2 — one half of the split frame. */
export const day1PanelSchema = z.object({
  source: mediaReferenceSchema.nullable(),
  trim: mediaTrimSchema,
  /** Cover fill plus per-ratio reframing. Day1 Plan D5. */
  transforms: ratioTransformsSchema,
});

/**
 * day1-quad Design §5.2 — the three payload pieces Day1 and Day1-quad share,
 * lifted out of `day1SettingsSchema` unchanged so both arms reference one
 * definition. Values, bounds, comments, and above all the `.default()`s are
 * verbatim: those defaults ARE the migration story for stored documents, and
 * dropping one would make an existing Day1 project fail to parse.
 */
export const day1SplitSchema = z.object({
  lineColor: hexColorSchema,
  lineWidthPx: z.number().min(0).max(MAX_SPLIT_LINE_WIDTH_PX),
});

/** Label wording lives in `copy.day1Labels`; only the styling is here. */
export const day1LabelStyleSchema = z.object({
  fontSize: z.number().min(MIN_SUBTITLE_FONT_SIZE).max(MAX_SUBTITLE_FONT_SIZE),
  textColor: hexColorSchema,
  outlineColor: hexColorSchema,
  outlineWidthPx: z.number().min(0).max(MAX_LABEL_OUTLINE_WIDTH_PX),
  position: z.enum(SUBTITLE_POSITIONS),
});

export const day1EndCardSchema = z.object({
  /**
   * Which of the two mutually exclusive treatments renders. The `.default`
   * is the entire migration story (Endcard-Video Design §3.1): a stored v2
   * document has no `mode` key and parses as the banner behaviour it was
   * saved with — no migration code, no schemaVersion bump.
   */
  mode: z.enum(DAY1_END_CARD_MODES).default('banner'),
  /** Finished bannerdesigner export used as the card background. */
  banner: mediaReferenceSchema.nullable(),
  /** Same app icon as a separate layer so it can animate. Day1 Plan D4. */
  appIcon: mediaReferenceSchema.nullable(),
  iconAdjust: z.object({
    dx: z.number().min(-MAX_ICON_ADJUST).max(MAX_ICON_ADJUST),
    dy: z.number().min(-MAX_ICON_ADJUST).max(MAX_ICON_ADJUST),
    scale: z.number().min(MIN_ICON_SCALE).max(MAX_ICON_SCALE),
  }),
  iconAnimation: z.enum(DAY1_ICON_ANIMATIONS),
  cardMotion: z.enum(DAY1_CARD_MOTIONS),
  /** One animated illustration that plays for the whole end card. */
  video: mediaReferenceSchema.nullable().default(null),
  /**
   * Window into `video`. When the source is shorter the window covers all of
   * it and playback loops to fill the card (Endcard-Video Design D-01).
   * day1-quad Design §4.1 — the card's length is its section's, not a constant.
   */
  videoTrim: mediaTrimSchema.default({inMs: 0, outMs: 0}),
  /**
   * day1-endcard-audio FR-01/FR-05 — the video's own audio, on by default.
   * The `.default()`s are again the entire migration story: documents saved
   * while the card was hard-muted parse as audible at full volume.
   */
  videoAudioEnabled: z.boolean().default(true),
  videoAudioVolume: z.number().min(0).max(1).default(1),
});

export const day1SettingsSchema = z.object({
  template: z.literal('day1'),
  panelA: day1PanelSchema,
  panelB: day1PanelSchema,
  split: day1SplitSchema,
  labelStyle: day1LabelStyleSchema,
  endCard: day1EndCardSchema,
});

/**
 * day1-quad Design §5.2 / D-0 — four panels under named keys rather than an
 * array. That is what lets the fifteen existing Day1 panel commands serve both
 * templates after `Day1PanelKey` widens, and it keeps one panel-to-section
 * mapping (`{panelA:0 … panelD:3}`) valid for both.
 *
 * Everything else is the Day1 payload verbatim: Plan Q5 keeps one divider and
 * one label style for all four panels, and Q7 reuses the end card whole.
 */
export const day1QuadSettingsSchema = z.object({
  template: z.literal('day1-quad'),
  panelA: day1PanelSchema,
  panelB: day1PanelSchema,
  panelC: day1PanelSchema,
  panelD: day1PanelSchema,
  split: day1SplitSchema,
  labelStyle: day1LabelStyleSchema,
  endCard: day1EndCardSchema,
});

/**
 * key-visual-looping Design Ref: §3.2 D-04 — per-KV framing and motion, held
 * apart from the per-locale pixels. Locale sets are the same illustration with a
 * different title baked in, so the framing is shared and switching the locale tab
 * must not reset Scale/X/Y.
 *
 * `transform` inherits `fit` from `mediaTransformSchema`, which day1-video
 * widened to `['cover', 'contain']` — that is what makes FR-L19 (a non-portrait
 * key visual kept whole over a blurred backdrop) a real option rather than a
 * warning.
 */
/**
 * kv-motion-effects Design Ref: §2.3 — a camera position, in frame coordinates.
 * `size` applies to both axes, so the region is always the frame's own aspect and
 * FR-M04 holds by construction rather than by validation.
 */
export const kvRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().min(1 / KV_MOTION_MAX_SCALE).max(1),
});

/** A preset, or the two rectangles the operator drew (Design §3.1). */
export const kvMotionSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('preset'), preset: z.enum(KV_MOTION_PRESETS)}),
  z.object({kind: z.literal('custom'), from: kvRectSchema, to: kvRectSchema}),
]);

const ZOOM_IN_MOTION = {kind: 'preset', preset: 'zoomIn'} as const;
const STILL_MOTION = {kind: 'preset', preset: 'still'} as const;

/**
 * kv-motion-effects Design Ref: §3.2 — `motion` replaces the `kenBurns` boolean,
 * and a stored document has to keep opening to the same result.
 *
 * `.default()` cannot express this: the value depends on a sibling field, which
 * is why the end-card-video precedent does not apply here. `z.preprocess` reads
 * the legacy boolean once, on the way in, and nothing downstream ever sees two
 * fields that could disagree about whether a key visual moves.
 *
 * `kenBurns: true` becomes `zoomIn`, which Design §2.3 shows is frame-for-frame
 * what the old code drew.
 */
export const kvSlotSchema = z.preprocess((input) => {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    (input as {motion?: unknown}).motion !== undefined
  ) {
    return input;
  }

  return {
    ...input,
    motion:
      (input as {kenBurns?: unknown}).kenBurns === false
        ? STILL_MOTION
        : ZOOM_IN_MOTION,
  };
}, z.object({
  transform: mediaTransformSchema,
  /** Null follows the loop-wide default (D-04). */
  motion: kvMotionSchema.nullable(),
}));

export const kvLoopSettingsSchema = z.object({
  template: z.literal('kv-loop'),
  /** Length === `sections.length`. Design D-02 — the KV count has one source. */
  slots: z.array(kvSlotSchema).min(MIN_SECTION_COUNT).max(MAX_SECTION_COUNT),
  /**
   * Per-locale key visual pixels. Sparse on purpose: a half-filled set is a
   * project mid-upload, not an invalid one, which is the same policy Day1 panels
   * follow. Resolution and the `en` fallback live in `domain/kvloop/assets.ts`.
   */
  images: z.partialRecord(
    localeSchema,
    z.array(mediaReferenceSchema.nullable()).max(MAX_SECTION_COUNT),
  ),
  /** Plan L1 — the cycle is what the timeline edits; this is how often it plays. */
  loopCount: z.number().int().min(KV_LOOP_MIN_LOOPS).max(KV_LOOP_MAX_LOOPS),
  /**
   * 0-1, where 1 means `KV_MOTION_MAX_PRESET_SCALE`. The name is kept because
   * renaming a persisted field would force a migration and buy nothing; the
   * inspector labels it as motion strength.
   */
  kenBurnsIntensity: z.number().min(0).max(1),
  /**
   * D-04 — the preset the whole loop follows, which a slot may override. Stored
   * documents have none, and never consult it either: the preprocess above gives
   * every one of their slots an explicit motion.
   */
  motion: kvMotionSchema.default(ZOOM_IN_MOTION),
  /**
   * kv-loop-reference-motion R-1 — from → to → from with the peak at the
   * hold's centre. Stored documents predate the field and were one-way, which
   * is what the default preserves (FR-R12).
   */
  roundTrip: z.boolean().default(false),
  /**
   * kv-loop-reference-motion R-3 — zero is a hard cut. The floor is lowered
   * here only; MIN_TRANSITION_MS still governs the three-scene template.
   */
  transitionMs: z.number().min(0).max(MAX_TRANSITION_MS),
  /** Plan L5 — every field here may be empty and the render still runs. */
  title: z.object({
    images: z.partialRecord(localeSchema, mediaReferenceSchema),
    transform: mediaTransformSchema,
  }),
  /** Wording lives in `copy.kvLoopDisclaimer`; only the styling is here. */
  disclaimer: z.object({
    fontSize: z.number().min(MIN_SUBTITLE_FONT_SIZE).max(MAX_SUBTITLE_FONT_SIZE),
    textColor: hexColorSchema,
  }),
  /** FR-L17 — closing fade to black. Zero is off. */
  fadeOutMs: z.number().min(0).max(MAX_TRANSITION_MS),
  /**
   * kv-loop-reference-motion R-4/R-5 — the gaussian bookends. Either value at
   * zero turns both ends off, which is also what stored documents parse to.
   * `durationMs` is fps-independent (D-07); `amountPx` is CSS px on the one
   * canvas size this template renders (D-08).
   */
  blur: z
    .object({
      durationMs: z.number().min(0).max(MAX_TRANSITION_MS),
      amountPx: z.number().min(0).max(MAX_KV_BLUR_PX),
    })
    .default({durationMs: 0, amountPx: 0}),
});

export const templateSettingsSchema = z.discriminatedUnion('template', [
  threeSceneSettingsSchema,
  day1SettingsSchema,
  day1QuadSettingsSchema,
  kvLoopSettingsSchema,
]);

/**
 * How many times the section axis plays. key-visual-looping Design Ref: §3.4
 * D-01 — the looping template stores one cycle, so the total duration invariant
 * multiplies by this. Every other template returns 1, which leaves their
 * invariant character for character the same.
 */
export const cyclesOf = (settings: TemplateSettings): number =>
  settings.template === 'kv-loop' ? settings.loopCount : 1;

/**
 * The section ids a template expects, in order. Day1 Design Ref: §3.5. A
 * function rather than the constant map it used to be, because a template whose
 * section count varies derives its ids from that count — key-visual-looping
 * Design Ref: §3.1.
 */
export const expectedSectionIds = (
  settings: TemplateSettings,
  sectionCount: number,
): readonly string[] =>
  settings.template === 'three-scene'
    ? SCENE_ORDER
    : settings.template === 'day1'
      ? DAY1_SECTION_ORDER
      : settings.template === 'day1-quad'
        ? DAY1_QUAD_SECTION_ORDER
        : Array.from({length: sectionCount}, (_, index) => kvSectionId(index));

interface SectionedProject {
  sections: z.infer<typeof sectionsSchema>;
}

/** A trim window that reaches past its own source is unplayable. */
const refineTrimInSource = (
  trim: z.infer<typeof mediaTrimSchema>,
  source: z.infer<typeof mediaReferenceSchema> | null,
  path: PropertyKey[],
  context: z.RefinementCtx,
) => {
  if (source && trim.outMs > (source.durationMs ?? 0)) {
    context.addIssue({
      code: 'custom',
      path: [...path, 'outMs'],
      message: 'Trim out must stay inside the source duration.',
    });
  }
};

const refineThreeScene = (
  project: SectionedProject,
  settings: z.infer<typeof threeSceneSettingsSchema>,
  context: z.RefinementCtx,
) => {
  const base: PropertyKey[] = ['templateSettings', 'scenes'];

  settings.scenes.forEach((scene, index) => {
    if (scene.kind !== SCENE_ORDER[index]) {
      context.addIssue({
        code: 'custom',
        path: [...base, index, 'kind'],
        message: `Scene ${index} must be ${SCENE_ORDER[index]}.`,
      });
    }
  });

  if (!settings.scenes[0].hook) {
    context.addIssue({
      code: 'custom',
      path: [...base, 0, 'hook'],
      message: 'The Hook scene must carry Hook settings.',
    });
  }

  if (!settings.scenes[2].cta) {
    context.addIssue({
      code: 'custom',
      path: [...base, 2, 'cta'],
      message: 'The CTA scene must carry CTA settings.',
    });
  }

  if (settings.source && !settings.source.durationMs) {
    context.addIssue({
      code: 'custom',
      path: ['templateSettings', 'source', 'durationMs'],
      message: 'The project source must be a video with a duration.',
    });
  }

  settings.scenes.forEach((scene, index) => {
    refineTrimInSource(
      scene.trim,
      settings.source,
      [...base, index, 'trim'],
      context,
    );

    // Design Ref: §3.5 — a transition may not exceed half of its own section.
    if (scene.transitionOut.kind !== 'cut') {
      const limit = (project.sections[index]?.durationMs ?? 0) / 2;

      if (scene.transitionOut.durationMs > limit) {
        context.addIssue({
          code: 'custom',
          path: [...base, index, 'transitionOut', 'durationMs'],
          message: `Transition must not exceed half of the scene (${limit}ms).`,
        });
      }
    }
  });
};

/**
 * Day1 Design Ref: §3.5. A missing panel source is *not* a schema error — the
 * user must be able to save mid-upload — so FR-D03 is a render preflight gate
 * instead. Only the trim window is bounded here.
 */
const refineDay1 = (
  _project: SectionedProject,
  settings: z.infer<typeof day1SettingsSchema>,
  context: z.RefinementCtx,
) => {
  (['panelA', 'panelB'] as const).forEach((key) => {
    const panel = settings[key];

    if (panel.source && !panel.source.durationMs) {
      context.addIssue({
        code: 'custom',
        path: ['templateSettings', key, 'source', 'durationMs'],
        message: 'A Day1 panel source must be a video with a duration.',
      });
    }

    refineTrimInSource(
      panel.trim,
      panel.source,
      ['templateSettings', key, 'trim'],
      context,
    );
  });

  // Endcard-Video Design §3.1 — the 3s window must stay inside its source,
  // same rule the panels enforce above.
  refineTrimInSource(
    settings.endCard.videoTrim,
    settings.endCard.video,
    ['templateSettings', 'endCard', 'videoTrim'],
    context,
  );
};

/**
 * day1-quad Design §5.2 — the Day1 refinement over four panels, plus the one
 * rule Day1 does not have: the preset is narrowed (Plan Q8a).
 *
 * Missing panel sources stay a render preflight gate, not a schema error, for
 * the same reason as Day1: saving mid-upload has to work (FR-Q02).
 */
const refineDay1Quad = (
  project: SectionedProject & {durationPreset: number},
  settings: z.infer<typeof day1QuadSettingsSchema>,
  context: z.RefinementCtx,
) => {
  (['panelA', 'panelB', 'panelC', 'panelD'] as const).forEach((key) => {
    const panel = settings[key];

    if (panel.source && !panel.source.durationMs) {
      context.addIssue({
        code: 'custom',
        path: ['templateSettings', key, 'source', 'durationMs'],
        message: 'A Day1 panel source must be a video with a duration.',
      });
    }

    refineTrimInSource(
      panel.trim,
      panel.source,
      ['templateSettings', key, 'trim'],
      context,
    );
  });

  refineTrimInSource(
    settings.endCard.videoTrim,
    settings.endCard.video,
    ['templateSettings', 'endCard', 'videoTrim'],
    context,
  );

  // Plan Q8a / Design D-4 — narrowed here rather than in `durationPresetSchema`,
  // so the other templates keep all three presets. `switchTemplate` coerces on
  // the way in, so the editor never reaches this; an imported JSON can.
  if (
    !(DAY1_QUAD_DURATION_PRESETS as readonly number[]).includes(
      project.durationPreset,
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['durationPreset'],
      message: `A day1-quad project runs ${DAY1_QUAD_DURATION_PRESETS.join('s or ')}s only.`,
    });
  }
};

/**
 * key-visual-looping Design Ref: §3.4. Missing key visuals are *not* a schema
 * error, for the same reason a missing Day1 panel is not: saving mid-upload has
 * to work. FR-L13 is a render preflight gate instead (`kvLoopMissingImages`),
 * and FR-L07 (an impossible count/repeat combination) is a domain guard that the
 * UI consults before offering the choice, because it has to name the way out.
 */
const refineKvLoop = (
  project: SectionedProject & {
    render: {selectedRatios: readonly AspectRatio[]};
    selectedRatio: AspectRatio;
  },
  settings: z.infer<typeof kvLoopSettingsSchema>,
  context: z.RefinementCtx,
) => {
  // Design D-02 — two arrays indexed by the same KV would drift silently, and
  // the render would quietly frame the wrong image.
  if (settings.slots.length !== project.sections.length) {
    context.addIssue({
      code: 'custom',
      path: ['templateSettings', 'slots'],
      message: `A looping project needs one slot per section: ${project.sections.length} sections, received ${settings.slots.length} slots.`,
    });
  }

  // FR-L14 / D-06 — narrowed here rather than in `renderSettingsSchema`, so the
  // other templates keep their full choice of ratios.
  if (
    project.render.selectedRatios.length !== 1 ||
    project.render.selectedRatios[0] !== KV_LOOP_RATIO
  ) {
    context.addIssue({
      code: 'custom',
      path: ['render', 'selectedRatios'],
      message: `A looping project renders ${KV_LOOP_RATIO} only.`,
    });
  }

  if (project.selectedRatio !== KV_LOOP_RATIO) {
    context.addIssue({
      code: 'custom',
      path: ['selectedRatio'],
      message: `A looping project previews ${KV_LOOP_RATIO} only.`,
    });
  }
};

export const editorProjectSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    id: z.string().min(1),
    name: z.string().max(MAX_PROJECT_NAME_LENGTH),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    durationPreset: durationPresetSchema,
    fps: z.union([z.literal(FRAME_RATES[0]), z.literal(FRAME_RATES[1])]),
    sections: sectionsSchema,
    templateSettings: templateSettingsSchema,
    copy: z.record(localeSchema, localizedCopySchema),
    audio: audioMixSchema,
    render: renderSettingsSchema,
    selectedLocale: localeSchema,
    selectedRatio: aspectRatioSchema,
  })
  .superRefine((project, context) => {
    const settings = project.templateSettings;

    // Day1 Design Ref: §3.5 — common invariants first, template ones after.
    const totalMs = project.sections.reduce(
      (sum, section) => sum + section.durationMs,
      0,
    );

    // key-visual-looping Design Ref: §3.4 D-01 — `sections` holds one cycle, so
    // the axis times the cycle count is what must match the preset. `cyclesOf`
    // is 1 for every other template, leaving their check unchanged.
    const cycles = cyclesOf(settings);

    if (totalMs * cycles !== project.durationPreset * 1000) {
      context.addIssue({
        code: 'custom',
        path: ['sections'],
        message:
          cycles === 1
            ? `Section durations must total ${project.durationPreset} seconds, received ${totalMs / 1000}.`
            : `A cycle of ${totalMs / 1000} seconds repeated ${cycles} times is ${(totalMs * cycles) / 1000} seconds, which must equal the ${project.durationPreset} second preset.`,
      });
    }

    const expectedIds = expectedSectionIds(settings, project.sections.length);

    // The axis is a variable length array now, so the count is checked here
    // rather than by the schema shape. key-visual-looping Design Ref: §3.1.
    if (project.sections.length !== expectedIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['sections'],
        message: `A ${settings.template} project must have exactly ${expectedIds.length} sections, received ${project.sections.length}.`,
      });
    } else {
      project.sections.forEach((section, index) => {
        if (section.id !== expectedIds[index]) {
          context.addIssue({
            code: 'custom',
            path: ['sections', index, 'id'],
            message: `Section ${index} of a ${settings.template} project must be ${expectedIds[index]}.`,
          });
        }
      });
    }

    if (settings.template === 'three-scene') {
      refineThreeScene(project, settings, context);
    } else if (settings.template === 'day1') {
      refineDay1(project, settings, context);
    } else if (settings.template === 'day1-quad') {
      refineDay1Quad(project, settings, context);
    } else {
      refineKvLoop(project, settings, context);
    }

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

  });

export type SceneKind = z.infer<typeof sceneKindSchema>;
export type TemplateKind = z.infer<typeof templateKindSchema>;
export type Locale = z.infer<typeof localeSchema>;
export type AspectRatio = z.infer<typeof aspectRatioSchema>;
export type TransitionKind = z.infer<typeof transitionKindSchema>;
export type HookMotionPreset = z.infer<typeof hookMotionPresetSchema>;
export type DurationPreset = z.infer<typeof durationPresetSchema>;
export type MediaTrim = z.infer<typeof mediaTrimSchema>;
export type MediaTransform = z.infer<typeof mediaTransformSchema>;
export type MediaFit = MediaTransform['fit'];
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
export type EditorScene = z.infer<typeof sceneSettingsSchema>;
export type EditorProject = z.infer<typeof editorProjectSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Sections = z.infer<typeof sectionsSchema>;
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;
export type ThreeSceneSettings = z.infer<typeof threeSceneSettingsSchema>;
export type Day1Settings = z.infer<typeof day1SettingsSchema>;
export type Day1QuadSettings = z.infer<typeof day1QuadSettingsSchema>;
export type Day1Panel = z.infer<typeof day1PanelSchema>;
export type KvLoopSettings = z.infer<typeof kvLoopSettingsSchema>;
export type KvSlot = z.infer<typeof kvSlotSchema>;
export type KvRect = z.infer<typeof kvRectSchema>;
export type KvMotion = z.infer<typeof kvMotionSchema>;
export type KvMotionPreset = (typeof KV_MOTION_PRESETS)[number];
export type EditorScenes = ThreeSceneSettings['scenes'];
