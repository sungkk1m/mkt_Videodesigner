import type {WebRendererQuality} from '@remotion/web-renderer';
import type {ComponentType} from 'react';

import type {PocCompositionProps} from '../../compositions/RenderPocComposition';
import type {OutputTarget} from '../../domain/render/types';

export type {OutputTarget, PocCompositionProps};

export interface CapabilityIssue {
  type: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface CanRenderResult {
  canRender: boolean;
  issues: CapabilityIssue[];
  resolvedVideoCodec: string | null;
  resolvedAudioCodec: string | null;
  resolvedOutputTarget: OutputTarget;
}

export interface CapabilityDependencies {
  isChrome: boolean;
  isSecureContext: boolean;
  hasWebCodecs: boolean;
  hasOpfs: boolean;
  hasFileSystemAccess: boolean;
  getVideoCodecs: () => Promise<string[]>;
  getAudioCodecs: () => Promise<string[]>;
  canRender: (outputTarget: OutputTarget) => Promise<CanRenderResult>;
}

export interface RenderCapabilitySummary {
  ready: boolean;
  isChrome: boolean;
  isSecureContext: boolean;
  hasWebCodecs: boolean;
  hasOpfs: boolean;
  hasFileSystemAccess: boolean;
  videoCodecs: string[];
  audioCodecs: string[];
  preferredOutputTarget: OutputTarget;
  resolvedOutputTarget: OutputTarget;
  blockers: string[];
  warnings: string[];
  issues: CapabilityIssue[];
}

export interface PocRenderConfig {
  durationSeconds: 1 | 15 | 60;
  fps: 30 | 60;
  width: 360 | 1080;
  height: 640 | 1920;
  outputTarget: OutputTarget;
}

export interface RenderProgress {
  encodedFrames: number;
  progress: number;
  renderEstimatedTime: number;
  doneIn: number | null;
}

export interface WebRenderRequest<TProps> {
  composition: {
    id: string;
    component: ComponentType<TProps>;
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
    defaultProps: TProps;
  };
  inputProps: TProps;
  container: 'mp4';
  videoCodec: 'h264';
  audioCodec: 'aac';
  // Extract ties these to the library union: a tier the web renderer does not
  // accept (e.g. the old 'highest') resolves to never and fails compilation
  // instead of throwing "Unsupported quality" at render time.
  audioBitrate: Extract<WebRendererQuality, 'medium' | 'high'>;
  videoBitrate: Extract<WebRendererQuality, 'medium' | 'high' | 'very-high'>;
  muted: false;
  outputTarget: OutputTarget;
  // Never 'prefer-hardware'. Chrome treats it as a requirement, not a hint: if
  // no H.264 hardware encoder is exposed, VideoEncoder.isConfigSupported returns
  // false and mediabunny throws before the first frame. Measured on Windows
  // Chrome 151, where 'prefer-hardware' failed for every codec/level/bitrate/
  // orientation while 'no-preference' passed all of them. 'no-preference' still
  // uses hardware wherever the browser has it.
  hardwareAcceleration: 'no-preference';
  pageResponsiveness: 'medium';
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
}

export type PocRenderRequest = WebRenderRequest<PocCompositionProps>;

export type RenderMediaAdapter<TProps = PocCompositionProps> = (
  request: WebRenderRequest<TProps>,
) => Promise<{getBlob: () => Promise<Blob>}>;

export interface PocRenderMetrics {
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  outputTarget: OutputTarget;
  renderMs: number;
  blobReadMs: number;
  outputBytes: number;
  peakJsHeapBytes: number | null;
  completedAt: string;
}
