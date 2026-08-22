// Public barrel for the editor domain. Data shapes come from the Zod schema so
// there is a single runtime source of truth. Design Ref: §10.2.
import type {DuckingEnvelope} from '../audio/ducking';
// Type-only, so the value-level cycle through `domain/day1` never forms.
import type {IconAdjust, NormalizedRect} from '../day1/endCard';
import type {SplitLayout} from '../day1/layout';
import type {ActivePanel} from '../day1/playback';
// Type-only for the same reason as the Day1 imports above.
import type {KvSegment} from '../kvloop/cycle';
import type {
  DAY1_CARD_MOTIONS,
  DAY1_END_CARD_MODES,
  DAY1_ICON_ANIMATIONS,
} from './constants';
import type {
  HookMotionPreset,
  MediaTransform,
  SceneKind,
  SubtitleStyle,
  TransitionKind,
} from './schema';

export * from './constants';
export type {ActivePanel} from '../day1/playback';
export type {KvSegment} from '../kvloop/cycle';
export type {IconAdjust, NormalizedRect} from '../day1/endCard';
export type {
  PanelRect,
  SplitLayout,
  SplitOrientation,
} from '../day1/layout';
export type {DuckingEnvelope, NarrationWindow} from '../audio/ducking';
export type {
  MediaKind,
  MediaReference,
  MediaStatus,
  ResolvedMedia,
} from '../media/reference';
export type {
  AspectRatio,
  AudioMix,
  AudioTrack,
  CtaSceneSettings,
  Day1Panel,
  Day1Settings,
  DurationPreset,
  EditorProject,
  EditorScene,
  EditorScenes,
  HookMotionPreset,
  HookSceneSettings,
  KvLoopSettings,
  KvSlot,
  Locale,
  LocalizedCopy,
  MediaFit,
  MediaTransform,
  MediaTrim,
  NarrationTrack,
  RatioTransforms,
  SceneKind,
  SceneTransition,
  Section,
  Sections,
  SubtitleStyle,
  TemplateKind,
  TemplateSettings,
  ThreeSceneSettings,
  TransitionKind,
} from './schema';

export const SCENE_LABELS: Record<SceneKind, string> = {
  hook: 'Hook',
  gameplay: 'Gameplay',
  cta: 'CTA',
};

/**
 * key-visual-looping Design Ref: §3.1 — a looping clip is named by its position,
 * because the section ids are generated from the key visual count.
 */
export const kvSectionLabel = (index: number) => `KV ${index + 1}`;

/** Timeline clip names per Day1 section. Day1 Design Ref: §3.1. */
export const DAY1_SECTION_LABELS = {
  'panel-a': '패널 A',
  'panel-b': '패널 B',
  endcard: '엔드카드',
} as const;

export const DEFAULT_TRANSFORM: MediaTransform = {
  fit: 'cover',
  scale: 1,
  x: 0,
  y: 0,
};

/**
 * day1-video — a Day1 panel starts lossless, unlike a scene.
 *
 * A scene fills the whole output frame, so `cover` costs a portrait source only
 * its edges. A panel is half of one, which is landscape, and `cover` there
 * throws away half a portrait capture's height before the operator has seen it.
 * Uploading footage must never silently discard it, so a panel opens on
 * `contain` — the whole source, over the blurred backdrop `SplitFrame` draws —
 * and cropping is something the operator turns on.
 *
 * `DEFAULT_TRANSFORM` stays `cover` for scenes: `SceneVideo` draws with `cover`
 * unconditionally, so a scene storing anything else would be a lie.
 */
export const DEFAULT_DAY1_PANEL_TRANSFORM: MediaTransform = {
  fit: 'contain',
  scale: 1,
  x: 0,
  y: 0,
};

export const DEFAULT_SUBTITLE: SubtitleStyle = {
  position: 'bottom',
  align: 'center',
  fontSize: 48,
  textColor: '#ffffff',
  emphasisColor: '#ffd54a',
  showBackground: true,
  backgroundColor: '#000000',
  backgroundOpacity: 0.5,
};

/**
 * Frozen render contract shared by the Player preview and the browser render so
 * both consume identical framing, copy, and motion. Design Ref: §1.1 goal 2.
 *
 * These are render inputs, not persisted project data, so they stay plain types
 * and carry resolved URLs rather than media references.
 */
export interface SubtitleRenderProps {
  text: string;
  emphasizedText: string;
  style: SubtitleStyle;
}

export interface TransitionRenderProps {
  kind: TransitionKind;
  durationInFrames: number;
}

export interface HookRenderProps {
  motionPreset: HookMotionPreset;
  headline: string;
  subcopy: string;
  dimBackground: boolean;
}

export interface CtaRenderProps {
  text: string;
  subcopy: string;
  appIconUrl: string | null;
  logoUrl: string | null;
  storeBadgeUrl: string | null;
  /** Dedicated CTA footage; null uses the frozen gameplay frame instead. */
  mediaUrl: string | null;
  /** Source frame to freeze when no dedicated CTA media exists. */
  freezeSourceFrame: number | null;
  backgroundBlur: number;
  backgroundDim: number;
}

export interface SceneRenderProps {
  kind: SceneKind;
  fromFrame: number;
  durationInFrames: number;
  trimBeforeFrames: number;
  trimAfterFrames: number;
  scale: number;
  x: number;
  y: number;
  subtitle: SubtitleRenderProps | null;
  transitionIn: TransitionRenderProps;
  transitionOut: TransitionRenderProps;
  hook?: HookRenderProps;
  cta?: CtaRenderProps;
}

export interface NarrationRenderProps {
  kind: SceneKind;
  url: string;
  volume: number;
  fromFrame: number;
  durationInFrames: number;
}

export interface BgmRenderProps {
  url: string;
  volume: number;
  startInFrames: number;
  loop: boolean;
}

export interface AudioRenderProps {
  originalVolume: number;
  bgm: BgmRenderProps | null;
  narration: NarrationRenderProps[];
  ducking: DuckingEnvelope;
}

// A type alias (not an interface) so Remotion's `Record<string, unknown>` props
// constraint is satisfied without a manual index signature.
export type ThreeSceneProps = {
  src: string | null;
  scenes: SceneRenderProps[];
  audio: AudioRenderProps;
};

/** Day1 Design Ref: §5.2 — one half of the split frame, with a resolved URL. */
export interface Day1PanelRenderProps {
  url: string | null;
  trimBeforeFrames: number;
  trimAfterFrames: number;
  /** day1-video — `contain` keeps the whole source over a blurred backdrop. */
  fit: MediaTransform['fit'];
  scale: number;
  x: number;
  y: number;
  /** Locale-resolved label; empty hides the overlay. */
  label: string;
}

/**
 * Day1 Design Ref: §3.2 `labelStyle` — the reference GIF look, bold white text
 * over a heavy black outline. The wording itself lives in `copy.day1Labels`.
 */
export interface Day1LabelStyle {
  fontSize: number;
  textColor: string;
  outlineColor: string;
  outlineWidthPx: number;
  position: SubtitleStyle['position'];
}

/** Day1 Design Ref: §1.2 — one entry per section of the shared time axis. */
export interface Day1SectionRenderProps {
  id: string;
  fromFrame: number;
  durationInFrames: number;
  /** null on the end card, which has no video panel. */
  activePanel: ActivePanel | null;
}

export type Day1IconAnimation = (typeof DAY1_ICON_ANIMATIONS)[number];
export type Day1CardMotion = (typeof DAY1_CARD_MOTIONS)[number];
export type Day1EndCardMode = (typeof DAY1_END_CARD_MODES)[number];

/**
 * Day1 Design Ref: §5.3 — the two end card layers, banner under icon.
 * Endcard-Video Design D-03 — extended flat rather than as a union: `mode` is
 * the single truth the composition branches on, and the other side's fields
 * are simply inactive, so the banner path stays untouched.
 */
export interface Day1EndCardRenderProps {
  mode: Day1EndCardMode;
  bannerUrl: string | null;
  iconUrl: string | null;
  /**
   * Where the icon sits, as fractions of the frame, with `iconAdjust` already
   * folded in. Resolved here rather than in the composition so SC5 (overlay
   * within 2px of the baked-in icon) is testable without rendering.
   */
  iconRect: NormalizedRect;
  iconAnimation: Day1IconAnimation;
  cardMotion: Day1CardMotion;
  videoUrl: string | null;
  /** Window into the source in frames, already converted at project fps. */
  videoTrimBeforeFrames: number;
  videoTrimAfterFrames: number;
  /** day1-endcard-audio FR-01 — the video's own audio and its gain. */
  videoAudioEnabled: boolean;
  videoAudioVolume: number;
}

export type Day1Props = {
  /**
   * Resolved split geometry. Day1 Design Ref: §2.2 — the layout is computed once
   * in the prop builder so the composition stays presentational and the geometry
   * itself stays unit-testable in the domain.
   */
  layout: SplitLayout;
  lineColor: string;
  panelA: Day1PanelRenderProps;
  panelB: Day1PanelRenderProps;
  labelStyle: Day1LabelStyle;
  endCard: Day1EndCardRenderProps;
  sections: Day1SectionRenderProps[];
  audio: AudioRenderProps;
};

/**
 * key-visual-looping Design Ref: §5.2 — one key visual's resolved pixels and the
 * framing to draw them with. Flattened like `Day1PanelRenderProps` rather than
 * carrying the stored `transform`, so the composition reads render inputs only.
 */
export interface KvSlotRenderProps {
  url: string | null;
  fit: MediaTransform['fit'];
  scale: number;
  x: number;
  y: number;
  kenBurns: boolean;
}

/** key-visual-looping Design Ref: §5.3 — absent is a normal state (Plan L5). */
export interface KvOverlayRenderProps {
  url: string | null;
  fit: MediaTransform['fit'];
  scale: number;
  x: number;
  y: number;
}

export interface KvDisclaimerRenderProps {
  /** Empty hides the bar entirely — Plan L5 / SC5. */
  text: string;
  fontSize: number;
  textColor: string;
}

export type KvLoopProps = {
  /** The cycle flattened across repeats. key-visual-looping Design Ref: §4.1. */
  segments: KvSegment[];
  /** Indexed by `KvSegment.kvIndex`, so one entry per key visual in a cycle. */
  slots: KvSlotRenderProps[];
  kenBurnsIntensity: number;
  /**
   * Crossfade length in frames, already clamped so an overlap can never outrun
   * the segment it fades into. Resolved here rather than in the composition so
   * the clamp is unit-testable.
   */
  transitionInFrames: number;
  /** FR-L17 — zero means no closing fade. */
  fadeOutFrames: number;
  totalFrames: number;
  title: KvOverlayRenderProps;
  disclaimer: KvDisclaimerRenderProps;
  audio: AudioRenderProps;
};

/**
 * One render job's frozen input, tagged with the template that produced it.
 * Day1 Design Ref: §2.1 — the render path branches on the template exactly once,
 * where this tag is read. The tag mirrors `templateSettings.template` rather than
 * being inferred from the prop shape, so a third template adds one arm instead of
 * a structural guess.
 */
export type EditorSnapshot =
  | {template: 'three-scene'; props: ThreeSceneProps}
  | {template: 'day1'; props: Day1Props};
