// Design Ref: §4.3 Render Contract — a render job is built from a frozen snapshot,
// reports progress, and can be cancelled through the caller's AbortSignal.
import {renderMediaOnWeb} from '@remotion/web-renderer';

import {ThreeSceneComposition} from '../../compositions/ThreeSceneComposition';
import {outputDimensions} from '../../domain/editor/project';
import type {ThreeSceneProps} from '../../domain/editor/types';
import {DEFAULT_PROFILE, PROFILE_SPECS} from '../../domain/render/profile';
import type {
  EditorRenderConfig,
  EditorRenderMetrics,
} from '../../domain/render/types';
import type {
  RenderMediaAdapter,
  RenderProgress,
  WebRenderRequest,
} from './types';

export type {EditorRenderConfig, EditorRenderMetrics};

const defaultRenderMedia =
  renderMediaOnWeb as unknown as RenderMediaAdapter<ThreeSceneProps>;

export const createEditorRenderRequest = (
  snapshot: ThreeSceneProps,
  config: EditorRenderConfig,
  signal?: AbortSignal,
  onProgress?: (progress: RenderProgress) => void,
): WebRenderRequest<ThreeSceneProps> => ({
  composition: {
    id: 'three-scene-editor',
    component: ThreeSceneComposition,
    durationInFrames: config.durationPreset * config.fps,
    fps: config.fps,
    ...outputDimensions(config.ratio),
    defaultProps: snapshot,
  },
  inputProps: snapshot,
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  audioBitrate: PROFILE_SPECS[config.profile ?? DEFAULT_PROFILE].audioBitrate,
  videoBitrate: PROFILE_SPECS[config.profile ?? DEFAULT_PROFILE].videoBitrate,
  muted: false,
  outputTarget: config.outputTarget,
  hardwareAcceleration: 'prefer-hardware',
  pageResponsiveness: 'medium',
  signal,
  onProgress,
});

export const runEditorRender = async ({
  snapshot,
  config,
  renderMedia = defaultRenderMedia,
  signal,
  onProgress,
  now = () => performance.now(),
}: {
  snapshot: ThreeSceneProps;
  config: EditorRenderConfig;
  renderMedia?: RenderMediaAdapter<ThreeSceneProps>;
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
  now?: () => number;
}): Promise<{blob: Blob; metrics: EditorRenderMetrics}> => {
  const startedAt = now();
  const result = await renderMedia(
    createEditorRenderRequest(snapshot, config, signal, onProgress),
  );
  const blob = await result.getBlob();
  const {width, height} = outputDimensions(config.ratio);

  return {
    blob,
    metrics: {
      durationSeconds: config.durationPreset,
      fps: config.fps,
      width,
      height,
      outputTarget: config.outputTarget,
      renderMs: now() - startedAt,
      outputBytes: blob.size,
      completedAt: new Date().toISOString(),
    },
  };
};
