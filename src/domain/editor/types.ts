// Public barrel for the editor domain. Data shapes come from the Zod schema so
// there is a single runtime source of truth. Design Ref: §10.2.
import type {DuckingEnvelope} from '../audio/ducking';
// Type-only, so the value-level cycle through `domain/day1` never forms.
import type {IconAdjust, NormalizedRect} from '../day1/endCard';
import type {QuadLayout, SplitLayout} from '../day1/layout';
import type {ActivePanel} from '../day1/playback';
// Type-only for the same reason as the Day1 imports above.
import type {KvSegment} from '../kvloop/cycle';
import type {
  DAY1_CARD_MOTIONS,
  DAY1_PANEL_SLOTS,
  DAY1_END_CARD_MODES,
  DAY1_ICON_ANIMATIONS,
  FAILURE_ORIENTATIONS,
  FAILURE_PANEL_SLOTS,
} from './constants';
import type {
  HookMotionPreset,
  KvEffect,
  KvMotionPreset,
  KvRect,
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
  QuadLayout,
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
  Day1QuadSettings,
  Day1Settings,
  DurationPreset,
  EditorProject,
  EditorScene,
  EditorScenes,
  FailurePanels,
  FailureSettings,
  HookMotionPreset,
  HookSceneSettings,
  KvEffect,
  KvEffectRegion,
  KvGlowEffect,
  KvLoopSettings,
  KvMotion,
  KvMotionPreset,
  KvParticlesEffect,
  KvRect,
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

/** kv-object-animation §5.1 — the two designated-object types, spelled out. */
export const KV_EFFECT_LABELS: Record<KvEffect['kind'], string> = {
  particles: '파티클',
  glow: '글로우',
};

/** kv-motion-effects §6.1 — direction is spelled out, never implied. */
export const KV_MOTION_LABELS: Record<KvMotionPreset, string> = {
  still: '정지',
  zoomIn: '줌 인',
  zoomOut: '줌 아웃',
  panLeftToRight: '팬 좌→우',
  panRightToLeft: '팬 우→좌',
  panTopToBottom: '팬 상→하',
  panBottomToTop: '팬 하→상',
};

/** Timeline clip names per Day1 section. Day1 Design Ref: §3.1. */
export const DAY1_SECTION_LABELS = {
  'panel-a': '패널 A',
  'panel-b': '패널 B',
  endcard: '엔드카드',
} as const;

/** day1-quad Design §5.2 — the same names over four panels. */
export const DAY1_QUAD_SECTION_LABELS = {
  'panel-a': '패널 A',
  'panel-b': '패널 B',
  'panel-c': '패널 C',
  'panel-d': '패널 D',
  endcard: '엔드카드',
} as const;

/**
 * failure-video Design §5.1 — the failure sections share the quad's `panel-*`
 * ids, so the timeline clip names are where the story shows: three levels, then
 * the end card. The wording is the reference format's, not the default caption
 * text, which the operator edits per locale.
 */
export const FAILURE_SECTION_LABELS = {
  'panel-a': '레벨 1',
  'panel-b': '레벨 20',
  'panel-c': '레벨 99',
  endcard: '엔드카드',
} as const;

/** failure-video Design §5.7 — a level segment's letter. */
export type FailureSlot = (typeof FAILURE_PANEL_SLOTS)[number];

/** failure-video Plan Q2 — which of the two source groups a render reads. */
export type FailureOrientation = (typeof FAILURE_ORIENTATIONS)[number];

/**
 * day1-quad Design §5.3 — a panel letter. `ActivePanel` stays the Day1-only
 * `'a' | 'b'`, because `SplitFrame` must not be handed a `'c'`.
 */
export type Day1PanelSlot = (typeof DAY1_PANEL_SLOTS)[number];

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
  /** day1-label-effects FR-01/FR-02 — the fill plate behind the text. */
  showBackground: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  /** FR-03/FR-04 — the halo around the glyph and its outline. */
  glowEnabled: boolean;
  glowColor: string;
  glowStrengthPx: number;
  /** FR-07/FR-08 — the halo around the plate, independent of the glyph's. */
  boxGlowEnabled: boolean;
  boxGlowColor: string;
  boxGlowStrengthPx: number;
}

/**
 * Day1 Design Ref: §1.2 — one entry per section of the shared time axis.
 *
 * day1-quad Design §5.6 — generic over the slot type, because there are two
 * consumers now: Day1 sections are live on `'a' | 'b'`, quad sections on
 * `'a' | 'b' | 'c' | 'd'`. The default keeps `Day1Props` written exactly as it
 * was, and stops `SplitFrame` from ever being handed a `'c'`.
 */
export interface Day1SectionRenderProps<TPanel = ActivePanel> {
  id: string;
  fromFrame: number;
  durationInFrames: number;
  /** null on the end card, which has no video panel. */
  activePanel: TPanel | null;
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
 * day1-quad Design §5.6 — the four-panel render contract. Same shape as
 * `Day1Props` with the two named panels replaced by a fixed four-tuple and the
 * split geometry replaced by the grid.
 */
export type Day1QuadProps = {
  layout: QuadLayout;
  lineColor: string;
  panels: readonly [
    Day1PanelRenderProps,
    Day1PanelRenderProps,
    Day1PanelRenderProps,
    Day1PanelRenderProps,
  ];
  labelStyle: Day1LabelStyle;
  endCard: Day1EndCardRenderProps;
  sections: Day1SectionRenderProps<Day1PanelSlot>[];
  audio: AudioRenderProps;
};

/**
 * key-visual-looping Design Ref: §5.2 — one key visual's resolved pixels and the
 * framing to draw them with. Flattened like `Day1PanelRenderProps` rather than
 * carrying the stored `transform`, so the composition reads render inputs only.
 */
/**
 * kv-motion-effects Design Ref: §2.1 — the curve is named rather than passed as
 * a function, because `domain` may not import Remotion and the easing belongs to
 * whoever draws frames.
 */
export type KvEasing = 'linear' | 'easeOut' | 'easeInOut';

/** The two camera positions a hold travels between, and how. */
export interface KvMotionKeyframes {
  from: KvRect;
  to: KvRect;
  easing: KvEasing;
  /**
   * kv-loop-reference-motion R-1 — true runs from → to → from with the peak at
   * the hold's exact centre, so the hold's last frame is back at `from` and a
   * cut into the next hold cannot jump (FR-R03).
   */
  roundTrip: boolean;
}

export interface KvSlotRenderProps {
  url: string | null;
  fit: MediaTransform['fit'];
  scale: number;
  x: number;
  y: number;
  motion: KvMotionKeyframes;
  /**
   * kv-object-animation §2.3 — schema values verbatim: self-contained (no URL,
   * no frame conversion), so the builder passes them through untouched and the
   * one consumer (`KvScene`) derives every frame from them (D-03).
   */
  effects: readonly KvEffect[];
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
  /**
   * kv-loop-reference-motion R-4/R-5 — the gaussian bookends, already in
   * frames. Either being zero turns both ends off.
   */
  blurInFrames: number;
  blurAmountPx: number;
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
  | {template: 'day1'; props: Day1Props}
  | {template: 'day1-quad'; props: Day1QuadProps}
  | {template: 'kv-loop'; props: KvLoopProps};
