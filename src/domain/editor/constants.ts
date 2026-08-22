// Design Ref: §3.5 Invariants and Defaults — the numbers the schema and the
// timeline commands both validate against.

export const SCENE_ORDER = ['hook', 'gameplay', 'cta'] as const;
export const DURATION_PRESETS = [15, 30, 60] as const;

/**
 * key-visual-looping Design Ref: §3.1 — the section axis is a variable length
 * list now. The bounds are the schema's, not a template's: the existing two
 * templates still pin themselves to three section ids, and the looping template
 * takes one section per key visual (Plan L8).
 */
export const MIN_SECTION_COUNT = 2;
export const MAX_SECTION_COUNT = 8;

export const TEMPLATE_KINDS = ['three-scene', 'day1', 'kv-loop'] as const;
export const DEFAULT_TEMPLATE = 'three-scene';

/** Day1 Design Ref: §1.2 — `[panel A active, panel B active, end card]`. */
export const DAY1_SECTION_ORDER = ['panel-a', 'panel-b', 'endcard'] as const;

/**
 * key-visual-looping Design Ref: §3.1 — the looping template's section ids are
 * derived from the key visual count rather than listed, because the count is
 * what the user chooses. One section per key visual (Plan L1 / Design D-02).
 */
export const kvSectionId = (index: number) => `kv-${index}`;

/** key-visual-looping Plan L8 — 1-4 repeats of the one editable cycle. */
export const KV_LOOP_MIN_LOOPS = 1;
export const KV_LOOP_MAX_LOOPS = 4;

/** Starting values for a new looping payload, taken from the reference videos. */
export const DEFAULT_KV_COUNT = 4;
export const DEFAULT_KV_LOOPS = 2;
export const DEFAULT_KV_TRANSITION_MS = 400;

/**
 * Scale a key visual reaches at Ken Burns intensity 1. key-visual-looping
 * Design Ref: §2.3 — deliberately small, because a still image scaled far
 * enough to notice also resamples every frame.
 */
export const KV_LOOP_MAX_KEN_BURNS_SCALE = 1.08;

/** The only output ratio the looping template renders. Plan L3 / FR-L14. */
export const KV_LOOP_RATIO = '9:16';

export const DAY1_ICON_ANIMATIONS = ['pop', 'pulse', 'glow', 'none'] as const;
export const DAY1_CARD_MOTIONS = ['ken-burns', 'fade', 'none'] as const;
/** The two mutually exclusive end-card treatments. Endcard-Video Design §3.1. */
export const DAY1_END_CARD_MODES = ['banner', 'video'] as const;

/** Design Ref: §3.5 Locales. */
export const LOCALES = ['ko', 'en', 'ja', 'zh-TW'] as const;

/** Design Ref: §3.5 Ratios. */
export const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const;

export const TRANSITION_KINDS = ['cut', 'fade', 'zoom'] as const;

/**
 * How a source fills the box it is drawn into. `cover` fills and crops, which is
 * what every template did originally. `contain` keeps the whole source and lets
 * the panel fill the leftover with a blurred copy of it — a portrait capture in
 * a Day1 panel loses half its height under `cover`, and that is the way out.
 */
export const MEDIA_FITS = ['cover', 'contain'] as const;
export const HOOK_MOTION_PRESETS = ['impact', 'caption', 'focus'] as const;
export const SUBTITLE_POSITIONS = ['top', 'center', 'bottom'] as const;
export const SUBTITLE_ALIGNMENTS = ['left', 'center', 'right'] as const;

// day1-render-fps Design Ref: §3 — new-project default only; stored documents
// keep their own fps (D-07). 30 is the UA-creative default, 60 stays selectable.
export const EDITOR_FPS = 30;

/** Design Ref: §3.5 — 1-12 unique locale/ratio jobs. */
export const MAX_BATCH_JOBS = 12;

/** Output pixel size per ratio. Design Ref: §1.3 Output, Standard is 1080p. */
export const RATIO_DIMENSIONS = {
  '9:16': {width: 1080, height: 1920},
  '1:1': {width: 1080, height: 1080},
  '16:9': {width: 1920, height: 1080},
} as const;

/** Filename segment per ratio. Design Ref: §4.5. */
export const RATIO_FILE_SEGMENT = {
  '9:16': '9x16',
  '1:1': '1x1',
  '16:9': '16x9',
} as const;

export const DEFAULT_RATIO = '9:16';
export const DEFAULT_LOCALE = 'ko';

export const OUTPUT_WIDTH = RATIO_DIMENSIONS[DEFAULT_RATIO].width;
export const OUTPUT_HEIGHT = RATIO_DIMENSIONS[DEFAULT_RATIO].height;

/** Design Ref: §3.5 — minimum scene length is one second. */
export const MIN_SCENE_MS = 1000;

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3;
export const MAX_OFFSET_PERCENT = 50;

/** Design Ref: §3.5 — transition duration 0.1-1.0s. */
export const MIN_TRANSITION_MS = 100;
export const MAX_TRANSITION_MS = 1000;

export const MIN_SUBTITLE_FONT_SIZE = 20;
export const MAX_SUBTITLE_FONT_SIZE = 120;

export const MAX_CTA_BACKGROUND_BLUR = 40;

/** Day1 Design Ref: §3.2 — split line, panel label, and end-card icon bounds. */
export const MAX_SPLIT_LINE_WIDTH_PX = 24;
export const MAX_LABEL_OUTLINE_WIDTH_PX = 16;
/** End-card icon nudge, as a fraction of the frame. Day1 Design Ref: §3.2. */
export const MAX_ICON_ADJUST = 0.5;
export const MIN_ICON_SCALE = 0.5;
export const MAX_ICON_SCALE = 2;

/** Design Ref: §4.2 TtsRequest. */
export const MIN_TTS_SPEED = 0.5;
export const MAX_TTS_SPEED = 2;

/** Locales the Supertonic Beta provider can synthesise. Design Ref: §4.2. */
export const TTS_SUPPORTED_LOCALES = ['ko', 'en', 'ja'] as const;

/**
 * v2 split the project into a template-agnostic `sections` time axis and a
 * `templateSettings` payload. Day1 Design Ref: §3.4. v1 documents are upgraded
 * on read by `migrateProject`.
 */
export const PROJECT_SCHEMA_VERSION = 2;
export const MAX_PROJECT_NAME_LENGTH = 80;
export const MAX_COPY_LENGTH = 200;
