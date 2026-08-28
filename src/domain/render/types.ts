// Design Ref: §3.4 RenderSettings — render configuration is project data, so it
// lives in the domain and the adapter consumes it.
import type {AspectRatio, Locale, TemplateKind} from '../editor/types';
import type {RenderProfile} from './profile';

export type OutputTarget = 'arraybuffer' | 'web-fs';

export interface EditorRenderConfig {
  /**
   * Output length in seconds, and the `_{n}s_` segment of the file name. A
   * preset for four of the five templates; steam-review fits it to its
   * gameplay source, so the type is the second count rather than the tuple.
   */
  durationPreset: number;
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
