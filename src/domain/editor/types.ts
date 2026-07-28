// Public barrel for the editor domain. Data shapes come from the Zod schema so
// there is a single runtime source of truth. Design Ref: §10.2.
import type {DuckingEnvelope} from '../audio/ducking';
import type {
  HookMotionPreset,
  MediaTransform,
  SceneKind,
  SubtitleStyle,
  TransitionKind,
} from './schema';

export * from './constants';
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
  Locale,
  LocalizedCopy,
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
