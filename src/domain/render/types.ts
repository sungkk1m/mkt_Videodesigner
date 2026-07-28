// Design Ref: §3.4 RenderSettings — render configuration is project data, so it
// lives in the domain and the adapter consumes it.
import type {AspectRatio, DurationPreset, Locale} from '../editor/types';
import type {RenderProfile} from './profile';

export type OutputTarget = 'arraybuffer' | 'web-fs';

export interface EditorRenderConfig {
  durationPreset: DurationPreset;
  fps: number;
  ratio: AspectRatio;
  locale: Locale;
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
