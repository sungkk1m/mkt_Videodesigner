import {describe, expect, it, vi} from 'vitest';

import {createPocRenderRequest, runPocRender} from './renderPoc';
import type {PocRenderConfig, RenderMediaAdapter} from './types';

const STANDARD_CONFIG: PocRenderConfig = {
  durationSeconds: 15,
  fps: 60,
  width: 1080,
  height: 1920,
  outputTarget: 'web-fs',
};

describe('createPocRenderRequest', () => {
  it('creates the confirmed 15-second 9:16 1080p60 MP4 request', () => {
    const request = createPocRenderRequest(STANDARD_CONFIG, '/poc-tone.wav');

    expect(request.composition.durationInFrames).toBe(900);
    expect(request.composition.fps).toBe(60);
    expect(request.composition.width).toBe(1080);
    expect(request.composition.height).toBe(1920);
    expect(request.container).toBe('mp4');
    expect(request.videoCodec).toBe('h264');
    expect(request.audioCodec).toBe('aac');
    expect(request.muted).toBe(false);
    expect(request.outputTarget).toBe('web-fs');
    expect(request.hardwareAcceleration).toBe('prefer-hardware');
    expect(request.pageResponsiveness).toBe('medium');
  });
});

describe('runPocRender', () => {
  it('returns render and Blob-read metrics while forwarding progress', async () => {
    const onProgress = vi.fn();
    const blob = new Blob(['video'], {type: 'video/mp4'});
    const renderMedia: RenderMediaAdapter = vi.fn(async (request) => {
      request.onProgress?.({
        encodedFrames: 900,
        progress: 1,
        renderEstimatedTime: 0,
        doneIn: 1200,
      });
      return {
        getBlob: async () => blob,
      };
    });
    let now = 0;

    const result = await runPocRender({
      config: STANDARD_CONFIG,
      audioSrc: '/poc-tone.wav',
      renderMedia,
      onProgress,
      now: () => {
        now += 100;
        return now;
      },
      readHeapBytes: () => 42_000_000,
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({progress: 1, encodedFrames: 900}),
    );
    expect(result.blob).toBe(blob);
    expect(result.metrics.renderMs).toBe(100);
    expect(result.metrics.blobReadMs).toBe(100);
    expect(result.metrics.outputBytes).toBe(blob.size);
    expect(result.metrics.peakJsHeapBytes).toBe(42_000_000);
  });

  it('passes the caller AbortSignal to the renderer', async () => {
    const controller = new AbortController();
    const renderMedia: RenderMediaAdapter = vi.fn(async (request) => {
      expect(request.signal).toBe(controller.signal);
      throw new DOMException('Aborted', 'AbortError');
    });

    await expect(
      runPocRender({
        config: STANDARD_CONFIG,
        audioSrc: '/poc-tone.wav',
        renderMedia,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({name: 'AbortError'});
  });
});
