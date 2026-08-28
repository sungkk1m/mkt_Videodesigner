import {describe, expect, it, vi} from 'vitest';

import {Day1Composition} from '../../compositions/Day1Composition';
import {KvLoopComposition} from '../../compositions/KvLoopComposition';
import {SteamReviewComposition} from '../../compositions/SteamReviewComposition';
import {ThreeSceneComposition} from '../../compositions/ThreeSceneComposition';
import {
  applySourceToAllScenes,
  buildEditorSnapshot,
  createProject,
  setDay1PanelSource,
  switchTemplate,
} from '../../domain/editor/project';
import type {EditorSnapshot, ThreeSceneProps} from '../../domain/editor/types';
import {testMediaReference, testUrlResolver} from '../../test/fixtures/media';
import {
  kvLoopProjectFixture,
  steamReviewProjectFixture,
} from '../../test/fixtures/project';
import type {EditorRenderConfig} from '../../domain/render/types';
import {
  createEditorRenderRequest,
  runEditorRender,
  type EditorRenderMediaAdapter,
} from './renderEditor';

const CONFIG: EditorRenderConfig = {
  durationPreset: 15,
  fps: 60,
  ratio: '9:16',
  locale: 'ko',
  template: 'three-scene',
  outputTarget: 'web-fs',
};

const snapshot = buildEditorSnapshot(
  applySourceToAllScenes(createProject(15), testMediaReference()),
  testUrlResolver(),
);

/** A Day1 project with both panels filled, so the snapshot is renderable. */
const day1Snapshot = (ratio: EditorRenderConfig['ratio'] = '9:16') => {
  let project = switchTemplate(createProject(15), 'day1');

  project = setDay1PanelSource(
    project,
    'panelA',
    testMediaReference({id: 'media_panel_a'}),
  );
  project = setDay1PanelSource(
    project,
    'panelB',
    testMediaReference({id: 'media_panel_b'}),
  );

  return buildEditorSnapshot(
    {...project, selectedRatio: ratio},
    testUrlResolver(),
  );
};

/** A looping project with its key visuals filled. */
const kvLoopSnapshot = () =>
  buildEditorSnapshot(
    kvLoopProjectFixture({
      images: {
        ko: [1, 2, 3, 4].map((index) =>
          testMediaReference({
            id: `media_kv_${index}`,
            kind: 'image',
            mimeType: 'image/png',
            durationMs: undefined,
          }),
        ),
      },
    }),
    testUrlResolver(),
  );

/** Narrows the union so a test can assert on three-scene props. */
const threeSceneProps = (input: EditorSnapshot): ThreeSceneProps => {
  if (input.template !== 'three-scene') {
    throw new Error(`expected a three-scene snapshot, got ${input.template}`);
  }

  return input.props;
};

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

    expect(request.inputProps).toBe(snapshot.props);
    // The snapshot was built at the project's default 30fps: the 2s Hook is 60 frames.
    expect(threeSceneProps(snapshot).scenes[0]?.durationInFrames).toBe(60);
  });

  it('maps the profile to its bitrate tier (day1-render-fps FR-05)', () => {
    // The single render used to omit profile entirely and always fell back to
    // Standard; this pins the mapping so the regression cannot come back.
    // 'very-high' is the web renderer's top tier — 'highest' does not exist
    // and makes renderMediaOnWeb throw before rendering starts.
    expect(
      createEditorRenderRequest(snapshot, {...CONFIG, profile: 'high'})
        .videoBitrate,
    ).toBe('very-high');
    expect(
      createEditorRenderRequest(snapshot, {...CONFIG, profile: 'fast'})
        .videoBitrate,
    ).toBe('medium');
    expect(createEditorRenderRequest(snapshot, CONFIG).videoBitrate).toBe('high');
  });

  it('never asks for hardware-only encoding, at any profile', () => {
    // 'prefer-hardware' is a requirement in Chrome, not a hint. On a machine with
    // no H.264 hardware encoder it killed every Day1 render with "This specific
    // encoder configuration (avc1.640028, 6000000 bps, 1080x1920, hardware
    // acceleration: prefer-hardware) is not supported by this browser." Measured
    // on Windows Chrome 151: 'prefer-hardware' failed across every level (4.0-5.1),
    // bitrate (3-12 Mbps), profile, and orientation, while 'no-preference' passed
    // all of them — so the tier was the only cause and the only thing to fix.
    for (const profile of ['fast', 'standard', 'high'] as const) {
      expect(
        createEditorRenderRequest(snapshot, {...CONFIG, profile})
          .hardwareAcceleration,
      ).toBe('no-preference');
    }
  });

  it('keeps the ArrayBuffer fallback available', () => {
    expect(
      createEditorRenderRequest(snapshot, {...CONFIG, outputTarget: 'arraybuffer'})
        .outputTarget,
    ).toBe('arraybuffer');
  });

  // Day1 Design Ref: §2.1 / Plan SC1 — a Day1 job must reach Day1Composition.
  it('routes a three-scene snapshot to ThreeSceneComposition', () => {
    const request = createEditorRenderRequest(snapshot, CONFIG);

    expect(request.composition.id).toBe('three-scene-editor');
    expect(request.composition.component).toBe(ThreeSceneComposition);
  });

  it('routes a Day1 snapshot to Day1Composition', () => {
    const request = createEditorRenderRequest(day1Snapshot(), CONFIG);

    expect(request.composition.id).toBe('day1-editor');
    expect(request.composition.component).toBe(Day1Composition);
    expect(request.composition.defaultProps).toBe(request.inputProps);
  });

  it('routes a looping snapshot to KvLoopComposition', () => {
    const request = createEditorRenderRequest(kvLoopSnapshot(), CONFIG);

    expect(request.composition.id).toBe('kv-loop-editor');
    expect(request.composition.component).toBe(KvLoopComposition);
    expect(request.composition.defaultProps).toBe(request.inputProps);
  });

  // steam-review Design §8 / Plan SC1 counterpart — a store-page job must
  // reach SteamReviewComposition, never a three-scene snapshot.
  it('routes a steam-review snapshot to SteamReviewComposition', () => {
    const request = createEditorRenderRequest(
      buildEditorSnapshot(steamReviewProjectFixture(), testUrlResolver()),
      {...CONFIG, durationPreset: 20, template: 'steam-review'},
    );

    expect(request.composition.id).toBe('steam-review-editor');
    expect(request.composition.component).toBe(SteamReviewComposition);
    expect(request.composition.defaultProps).toBe(request.inputProps);
    // 20s at 60fps — the timing follows the config, not a template constant.
    expect(request.composition.durationInFrames).toBe(1200);
  });

  it('keeps encoding settings identical across templates', () => {
    const {composition: _three, ...threeScene} = createEditorRenderRequest(
      snapshot,
      CONFIG,
    );
    const {composition: _day1, ...day1} = createEditorRenderRequest(
      day1Snapshot(),
      CONFIG,
    );

    const {composition: _kvLoop, ...kvLoop} = createEditorRenderRequest(
      kvLoopSnapshot(),
      CONFIG,
    );

    expect({...day1, inputProps: null}).toEqual({
      ...threeScene,
      inputProps: null,
    });
    expect({...kvLoop, inputProps: null}).toEqual({
      ...threeScene,
      inputProps: null,
    });
  });

  // FR-D04 — the split geometry follows the job's own output size, so a 16:9
  // Day1 job must not carry the 9:16 layout.
  it('carries the ratio-specific split layout for a Day1 job', () => {
    const portrait = createEditorRenderRequest(day1Snapshot('9:16'), CONFIG);
    const landscape = createEditorRenderRequest(day1Snapshot('16:9'), {
      ...CONFIG,
      ratio: '16:9',
    });

    expect(landscape.composition.width).toBe(1920);
    expect(landscape.composition.height).toBe(1080);
    expect(portrait.inputProps).toMatchObject({
      layout: {orientation: 'vertical'},
    });
    expect(landscape.inputProps).toMatchObject({
      layout: {orientation: 'horizontal'},
    });
  });
});

describe('runEditorRender', () => {
  it('forwards progress and reports output metrics', async () => {
    const blob = new Blob(['mp4'], {type: 'video/mp4'});
    const onProgress = vi.fn();
    const renderMedia: EditorRenderMediaAdapter = vi.fn(async (request) => {
      request.onProgress?.({
        encodedFrames: 900,
        progress: 1,
        renderEstimatedTime: 0,
        doneIn: 900,
      });
      return {getBlob: async () => blob};
    });
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

  it('reports the same metric shape for a Day1 render', async () => {
    const blob = new Blob(['day1'], {type: 'video/mp4'});
    const renderMedia: EditorRenderMediaAdapter = vi.fn(async () => ({
      getBlob: async () => blob,
    }));

    const result = await runEditorRender({
      snapshot: day1Snapshot('1:1'),
      config: {...CONFIG, ratio: '1:1'},
      renderMedia,
    });

    expect(result.metrics).toMatchObject({
      durationSeconds: 15,
      fps: 60,
      width: 1080,
      height: 1080,
      outputBytes: blob.size,
    });
  });

  it('propagates cancellation through the caller AbortSignal', async () => {
    const controller = new AbortController();
    const renderMedia: EditorRenderMediaAdapter = vi.fn(async (request) => {
      expect(request.signal).toBe(controller.signal);
      throw new DOMException('Aborted', 'AbortError');
    });

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
