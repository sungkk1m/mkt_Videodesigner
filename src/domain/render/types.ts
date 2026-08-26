// Design Ref: §3.4 RenderSettings — render configuration is project data, so it
// lives in the domain and the adapter consumes it.
import type {
  AspectRatio,
  DurationPreset,
  Locale,
  TemplateKind,
} from '../editor/types';
import type {RenderProfile} from './profile';

export type OutputTarget = 'arraybuffer' | 'web-fs';

export interface EditorRenderConfig {
  durationPreset: DurationPreset;
  fps: number;
  ratio: AspectRatio;
  locale: Locale;
  /** day1-quad Design §4.2 — the output filename's template segment. */
  template: TemplateKind;
  outputTarget: OutputTarget;
  /** Design Ref: §1.3 Output — bitrate tier. Defaults to Standard. */
  profile?: RenderProfile;
}

export interface EditorRenderMetrics {
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  outputTarget: OutputTarget;
  renderMs: number;
  outputBytes: number;
  completedAt: string;
}
