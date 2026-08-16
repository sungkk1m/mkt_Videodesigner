// Design Ref: §3.5 Invariants and Defaults — the numbers the schema and the
// timeline commands both validate against.

export const SCENE_ORDER = ['hook', 'gameplay', 'cta'] as const;
export const DURATION_PRESETS = [15, 30, 60] as const;

/**
 * Day1 Design Ref: §3.1 — every template shares a three-section time axis, so
 * the timeline commands stay template-agnostic. Day1 Design Ref: §1.3 D10 keeps
 * this fixed at three until a template actually needs a different count.
 */
export const SECTION_COUNT = 3;

export const TEMPLATE_KINDS = ['three-scene', 'day1'] as const;
export const DEFAULT_TEMPLATE = 'three-scene';

/** Day1 Design Ref: §1.2 — `[panel A active, panel B active, end card]`. */
export const DAY1_SECTION_ORDER = ['panel-a', 'panel-b', 'endcard'] as const;

export const DAY1_ICON_ANIMATIONS = ['pop', 'pulse', 'glow', 'none'] as const;
export const DAY1_CARD_MOTIONS = ['ken-burns', 'fade', 'none'] as const;

/** Design Ref: §3.5 Locales. */
export const LOCALES = ['ko', 'en', 'ja', 'zh-TW'] as const;

/** Design Ref: §3.5 Ratios. */
export const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const;

export const TRANSITION_KINDS = ['cut', 'fade', 'zoom'] as const;
export const HOOK_MOTION_PRESETS = ['impact', 'caption', 'focus'] as const;
export const SUBTITLE_POSITIONS = ['top', 'center', 'bottom'] as const;
export const SUBTITLE_ALIGNMENTS = ['left', 'center', 'right'] as const;

export const EDITOR_FPS = 60;

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
