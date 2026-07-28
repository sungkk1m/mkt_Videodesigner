import {describe, expect, it, vi} from 'vitest';

import {
  applySourceToAllScenes,
  buildCompositionProps,
  createProject,
} from '../../domain/editor/project';
import type {ThreeSceneProps} from '../../domain/editor/types';
import {testMediaReference, testUrlResolver} from '../../test/fixtures/media';
import type {EditorRenderConfig} from '../../domain/render/types';
import {createEditorRenderRequest, runEditorRender} from './renderEditor';
import type {RenderMediaAdapter} from './types';

const CONFIG: EditorRenderConfig = {
  durationPreset: 15,
  fps: 60,
  ratio: '9:16',
  locale: 'ko',
  outputTarget: 'web-fs',
};

const snapshot = buildCompositionProps(
  applySourceToAllScenes(createProject(15), testMediaReference()),
  testUrlResolver(),
);

describe('createEditorRenderRequest', () => {
  it('requests a 1080x1920 H.264/AAC MP4 at the project frame rate', () => {
    const request = createEditorRenderRequest(snapshot, CONFIG);

    expect(request.composition.width).toBe(1080);
    expect(request.composition.height).toBe(1920);
    expect(request.composition.durationInFrames).toBe(900);
    expect(request.composition.fps).toBe(60);
    expect(request.container).toBe('mp4');
    expect(request.videoCodec).toBe('h264');
    expect(request.audioCodec).toBe('aac');
    expect(request.muted).toBe(false);
    expect(request.outputTarget).toBe('web-fs');
  });

  it('passes the frozen snapshot straight through as input props', () => {
    const request = createEditorRenderRequest(snapshot, CONFIG);

    expect(request.inputProps).toBe(snapshot);
    expect(request.inputProps.scenes[0]?.durationInFrames).toBe(120);
  });

  it('keeps the ArrayBuffer fallback available', () => {
    expect(
      createEditorRenderRequest(snapshot, {...CONFIG, outputTarget: 'arraybuffer'})
        .outputTarget,
    ).toBe('arraybuffer');
  });
});

describe('runEditorRender', () => {
  it('forwards progress and reports output metrics', async () => {
    const blob = new Blob(['mp4'], {type: 'video/mp4'});
    const onProgress = vi.fn();
    const renderMedia: RenderMediaAdapter<ThreeSceneProps> = vi.fn(
      async (request) => {
        request.onProgress?.({
          encodedFrames: 900,
          progress: 1,
          renderEstimatedTime: 0,
          doneIn: 900,
        });
        return {getBlob: async () => blob};
      },
    );
    let now = 0;

    const result = await runEditorRender({
      snapshot,
      config: CONFIG,
      renderMedia,
      onProgress,
      now: () => {
        now += 250;
        return now;
      },
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({progress: 1}),
    );
    expect(result.blob).toBe(blob);
    expect(result.metrics).toMatchObject({
      durationSeconds: 15,
      fps: 60,
      width: 1080,
      height: 1920,
      outputBytes: blob.size,
      renderMs: 250,
    });
  });

  it('propagates cancellation through the caller AbortSignal', async () => {
    const controller = new AbortController();
    const renderMedia: RenderMediaAdapter<ThreeSceneProps> = vi.fn(
      async (request) => {
        expect(request.signal).toBe(controller.signal);
        throw new DOMException('Aborted', 'AbortError');
      },
    );

    await expect(
      runEditorRender({
        snapshot,
        config: CONFIG,
        renderMedia,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({name: 'AbortError'});
  });
});
