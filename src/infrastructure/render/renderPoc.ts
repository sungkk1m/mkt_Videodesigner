// Design Ref: §4.3 Render Contract — immutable request, progress, cancellation, and measured output.
import {renderMediaOnWeb} from '@remotion/web-renderer';

import {RenderPocComposition} from '../../compositions/RenderPocComposition';
import type {
  PocRenderConfig,
  PocRenderMetrics,
  PocRenderRequest,
  RenderMediaAdapter,
  RenderProgress,
} from './types';

const getDefaultHeapBytes = (): number | null => {
  const performanceWithMemory = performance as Performance & {
    memory?: {usedJSHeapSize: number};
  };

  return performanceWithMemory.memory?.usedJSHeapSize ?? null;
};

// The SDK generic also models optional Zod schemas. This PoC narrows it to the
// schema-free request shape at the infrastructure boundary.
const defaultRenderMedia =
  renderMediaOnWeb as unknown as RenderMediaAdapter;

export const createPocRenderRequest = (
  config: PocRenderConfig,
  audioSrc: string,
  signal?: AbortSignal,
  onProgress?: (progress: RenderProgress) => void,
): PocRenderRequest => {
  const props = {
    audioSrc,
    label: `${config.durationSeconds}s · ${config.width}×${config.height} · ${config.fps}fps`,
  };

  return {
    composition: {
      id: 'browser-render-poc',
      component: RenderPocComposition,
      durationInFrames: config.durationSeconds * config.fps,
      fps: config.fps,
      width: config.width,
      height: config.height,
      defaultProps: props,
    },
    inputProps: props,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: 'medium',
    videoBitrate: config.width === 1080 ? 'high' : 'medium',
    muted: false,
    outputTarget: config.outputTarget,
    hardwareAcceleration: 'prefer-hardware',
    pageResponsiveness: 'medium',
    signal,
    onProgress,
  };
};

export const runPocRender = async ({
  config,
  audioSrc,
  renderMedia = defaultRenderMedia,
  signal,
  onProgress,
  now = () => performance.now(),
  readHeapBytes = getDefaultHeapBytes,
}: {
  config: PocRenderConfig;
  audioSrc: string;
  renderMedia?: RenderMediaAdapter;
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
  now?: () => number;
  readHeapBytes?: () => number | null;
}): Promise<{blob: Blob; metrics: PocRenderMetrics}> => {
  let peakJsHeapBytes = readHeapBytes();
  const sampleHeap = () => {
    const current = readHeapBytes();
    if (current !== null) {
      peakJsHeapBytes =
        peakJsHeapBytes === null ? current : Math.max(peakJsHeapBytes, current);
    }
  };
  const interval = window.setInterval(sampleHeap, 250);
  const renderStartedAt = now();

  try {
    // Plan SC: Generate a browser MP4 with H.264/AAC at the selected 30/60fps.
    const result = await renderMedia(
      createPocRenderRequest(config, audioSrc, signal, onProgress),
    );
    const renderFinishedAt = now();
    sampleHeap();

    const blobReadStartedAt = now();
    const blob = await result.getBlob();
    const blobReadFinishedAt = now();
    sampleHeap();

    return {
      blob,
      metrics: {
        ...config,
        renderMs: renderFinishedAt - renderStartedAt,
        blobReadMs: blobReadFinishedAt - blobReadStartedAt,
        outputBytes: blob.size,
        peakJsHeapBytes,
        completedAt: new Date().toISOString(),
      },
    };
  } finally {
    window.clearInterval(interval);
  }
};
