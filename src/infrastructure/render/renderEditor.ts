// Design Ref: §4.3 Render Contract — a render job is built from a frozen snapshot,
// reports progress, and can be cancelled through the caller's AbortSignal.
import {renderMediaOnWeb} from '@remotion/web-renderer';

import {Day1Composition} from '../../compositions/Day1Composition';
import {ThreeSceneComposition} from '../../compositions/ThreeSceneComposition';
import {outputDimensions} from '../../domain/editor/project';
import type {
  Day1Props,
  EditorSnapshot,
  ThreeSceneProps,
} from '../../domain/editor/types';
import {DEFAULT_PROFILE, PROFILE_SPECS} from '../../domain/render/profile';
import {renderLogLevel} from './logLevel';
import {withSoftwareVideoDecoding} from './softwareVideoDecode';
import type {
  EditorRenderConfig,
  EditorRenderMetrics,
} from '../../domain/render/types';
import type {RenderProgress, WebRenderRequest} from './types';

export type {EditorRenderConfig, EditorRenderMetrics};

/**
 * Day1 Design Ref: §2.1 — the render path's template branch. Adding a template is
 * one arm here plus one arm in `buildEditorSnapshot`.
 */
export type EditorRenderRequest =
  | WebRenderRequest<ThreeSceneProps>
  | WebRenderRequest<Day1Props>;

export type EditorRenderMediaAdapter = (
  request: EditorRenderRequest,
) => Promise<{getBlob: () => Promise<Blob>}>;

const defaultRenderMedia =
  renderMediaOnWeb as unknown as EditorRenderMediaAdapter;

export const createEditorRenderRequest = (
  snapshot: EditorSnapshot,
  config: EditorRenderConfig,
  signal?: AbortSignal,
  onProgress?: (progress: RenderProgress) => void,
): EditorRenderRequest => {
  const profile = PROFILE_SPECS[config.profile ?? DEFAULT_PROFILE];
  // Identical for both templates: the container, codecs, and output target are
  // properties of the browser renderer, not of the composition.
  const encoding = {
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: profile.audioBitrate,
    videoBitrate: profile.videoBitrate,
    muted: false,
    outputTarget: config.outputTarget,
    hardwareAcceleration: 'no-preference',
    pageResponsiveness: 'medium',
    logLevel: renderLogLevel(),
    signal,
    onProgress,
  } as const;
  const timing = {
    durationInFrames: config.durationPreset * config.fps,
    fps: config.fps,
    ...outputDimensions(config.ratio),
  };

  if (snapshot.template === 'day1') {
    return {
      composition: {
        id: 'day1-editor',
        component: Day1Composition,
        ...timing,
        defaultProps: snapshot.props,
      },
      inputProps: snapshot.props,
      ...encoding,
    };
  }

  return {
    composition: {
      id: 'three-scene-editor',
      component: ThreeSceneComposition,
      ...timing,
      defaultProps: snapshot.props,
    },
    inputProps: snapshot.props,
    ...encoding,
  };
};

export const runEditorRender = async ({
  snapshot,
  config,
  renderMedia = defaultRenderMedia,
  signal,
  onProgress,
  now = () => performance.now(),
}: {
  snapshot: EditorSnapshot;
  config: EditorRenderConfig;
  renderMedia?: EditorRenderMediaAdapter;
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
  now?: () => number;
}): Promise<{blob: Blob; metrics: EditorRenderMetrics}> => {
  const startedAt = now();
  // The whole render runs under software video decoding — see
  // softwareVideoDecode.ts for the measured hardware-pool wedge this avoids.
  const blob = await withSoftwareVideoDecoding(async () => {
    const result = await renderMedia(
      createEditorRenderRequest(snapshot, config, signal, onProgress),
    );

    return result.getBlob();
  });
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
