// Day1 render speed — the proxy swap has to be invisible to everything except the
// decoder. These cover the parts `sourceProxy.test.ts` cannot: the trim rebasing
// onto the proxy's timeline, the per-run cache, and the fallback that keeps a
// failed transcode from failing a render.
import {describe, expect, it, vi} from 'vitest';

import {
  buildDay1Props,
  buildDay1QuadProps,
  buildFailureProps,
  day1Of,
} from '../../domain/editor/project';
import type {
  Day1QuadSettings,
  Day1Settings,
  EditorProject,
  MediaReference,
} from '../../domain/editor/types';
import type {SourceProxy, SourceProxyBuilder} from '../../domain/ports';
import {fail, ok} from '../../shared/errors/appError';
import {createAppError} from '../../shared/errors/appError';
import {
  day1ProjectFixture,
  day1QuadProjectFixture,
  failureProjectFixture,
  failureSettingsOf,
} from '../../test/fixtures/project';
import {testMediaReference} from '../../test/fixtures/media';
import {createPanelProxies} from './panelProxies';

/** The gameplay source of the 2026-08-18 measurements: half of it is off-panel. */
const portraitSource = (id: string): MediaReference =>
  testMediaReference({id, width: 1242, height: 2208, durationMs: 324_000});

const projectWithPanels = (): EditorProject => {
  const panels: Partial<Day1Settings> = {
    panelA: {
      source: portraitSource('media_a'),
      trim: {inMs: 2000, outMs: 8000},
      transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
    },
    panelB: {
      source: portraitSource('media_b'),
      trim: {inMs: 0, outMs: 6000},
      transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
    },
  };

  return day1ProjectFixture(panels);
};

/**
 * A builder that reports the timeline rebasing of its choice, so both
 * transcoder behaviours are covered: `rebase` returns a file starting at zero,
 * and `keep` one that preserves the source timestamps.
 */
const fakeBuilder = (mode: 'rebase' | 'keep' = 'rebase') => {
  const build = vi.fn(
    async ({fromSeconds}: {fromSeconds: number}) =>
      ok<SourceProxy>({
        url: `blob:proxy-${build.mock.calls.length}`,
        sourceTimeOffsetSeconds: mode === 'rebase' ? fromSeconds : 0,
        sizeBytes: 1024,
        elapsedMs: 1200,
      }),
  );

  return {build} as unknown as SourceProxyBuilder & {
    build: ReturnType<typeof vi.fn>;
  };
};

const signal = () => new AbortController().signal;

describe('createPanelProxies', () => {
  it('crops both panels and renders them from the proxy at frame zero', async () => {
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });
    const project = projectWithPanels();

    const prepared = await proxies.prepare({project, ratio: '9:16', fps: 60, signal: signal()});

    // Panel A's trim starts 2s in, so its proxy covers 2s-8s of the source and
    // the crop is the band a 9:16 panel shows.
    expect(builder.build).toHaveBeenCalledTimes(2);
    expect(builder.build.mock.calls[0]?.[0]).toMatchObject({
      url: 'blob:media_a',
      crop: {left: 0, top: 554, width: 1242, height: 1100},
      fromSeconds: 2,
      toSeconds: 8,
    });

    const props = buildDay1Props(
      {...prepared.project, fps: 60, selectedRatio: '9:16'},
      prepared.resolveUrl,
    );

    // Rebased to the proxy's own timeline: the same six seconds, from frame 0.
    expect(props?.panelA.url).toBe('blob:proxy-1');
    expect(props?.panelA.trimBeforeFrames).toBe(0);
    expect(props?.panelA.trimAfterFrames).toBe(360);
    expect(props?.panelA.scale).toBeCloseTo(1, 2);
    // The original project is untouched — nothing here can reach persistence.
    expect(day1Of(project)?.panelA.trim).toEqual({inMs: 2000, outMs: 8000});
    expect(day1Of(project)?.panelA.source?.id).toBe('media_a');
  });

  it('keeps the original trim when the transcoder preserves timestamps', async () => {
    const proxies = createPanelProxies({
      builder: fakeBuilder('keep'),
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });

    const prepared = await proxies.prepare({project: projectWithPanels(), ratio: '9:16', fps: 60, signal: signal()});
    const props = buildDay1Props(
      {...prepared.project, fps: 60, selectedRatio: '9:16'},
      prepared.resolveUrl,
    );

    expect(props?.panelA.trimBeforeFrames).toBe(120);
    expect(props?.panelA.trimAfterFrames).toBe(480);
  });

  it('transcodes once per crop, so a locale batch shares one proxy', async () => {
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });
    const project = projectWithPanels();

    await proxies.prepare({project, ratio: '9:16', fps: 60, signal: signal()});
    await proxies.prepare({project, ratio: '9:16', fps: 60, signal: signal()});
    expect(builder.build).toHaveBeenCalledTimes(2);

    // A different ratio shows a different band, so it needs its own crop.
    await proxies.prepare({project, ratio: '16:9', fps: 60, signal: signal()});
    expect(builder.build).toHaveBeenCalledTimes(4);
  });

  it('renders the original source when the transcode fails', async () => {
    const builder = {
      build: vi.fn(async () =>
        fail(createAppError('MEDIA_PROBE_FAILED', 'nope', {retryable: true})),
      ),
    } as unknown as SourceProxyBuilder;
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });
    const project = projectWithPanels();

    const prepared = await proxies.prepare({project, ratio: '9:16', fps: 60, signal: signal()});

    expect(prepared.project).toBe(project);

    const props = buildDay1Props(
      {...prepared.project, fps: 60, selectedRatio: '9:16'},
      prepared.resolveUrl,
    );

    expect(props?.panelA.url).toBe('blob:media_a');
    expect(props?.panelA.trimBeforeFrames).toBe(120);
  });

  it('leaves a source the panel already fits alone', async () => {
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });
    // Already panel-shaped: a crop would save 0.6%, which no transcode repays.
    // (A 1920x1080 source would *not* land here — a vertical panel crops it
    //  horizontally instead, saving 36%.)
    const panelShaped = {width: 1100, height: 980};
    const project = day1ProjectFixture({
      panelA: {
        source: testMediaReference({id: 'media_fit', ...panelShaped}),
        trim: {inMs: 0, outMs: 6000},
        transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
      },
      panelB: {
        source: testMediaReference({id: 'media_fit_b', ...panelShaped}),
        trim: {inMs: 0, outMs: 6000},
        transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
      },
    });

    const prepared = await proxies.prepare({project, ratio: '9:16', fps: 60, signal: signal()});

    expect(builder.build).not.toHaveBeenCalled();
    expect(prepared.project).toBe(project);
  });

  it('reports what it did per panel, which is the whole diagnostic', async () => {
    const proxies = createPanelProxies({
      builder: fakeBuilder(),
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });

    await proxies.prepare({project: projectWithPanels(), ratio: '9:16', fps: 60, signal: signal()});

    expect(proxies.notes()).toEqual([
      'panelA: 1242x1100 at 0,554 (-50% pixels) 0.0MB in 1200ms',
      'panelB: 1242x1100 at 0,554 (-50% pixels) 0.0MB in 1200ms',
    ]);
  });

  it('reports why it skipped, and why it failed', async () => {
    const landscape = createPanelProxies({
      builder: fakeBuilder(),
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });
    const panned = {
      source: testMediaReference({id: 'media_wide', width: 1920, height: 1080}),
      trim: {inMs: 0, outMs: 6000},
      transforms: {
        base: {fit: 'cover' as const, scale: 1, x: 0, y: 10},
        overrides: {},
      },
    };

    await landscape.prepare({
      project: day1ProjectFixture({panelA: panned, panelB: panned}),
      ratio: '9:16',
      fps: 60,
      signal: signal(),
    });

    expect(landscape.notes()).toEqual([
      'panelA: skipped, framing reaches outside the 1920x1080 source',
      'panelB: skipped, framing reaches outside the 1920x1080 source',
    ]);

    const broken = createPanelProxies({
      builder: {
        build: vi.fn(async () =>
          fail(
            createAppError('MEDIA_PROBE_FAILED', 'nope', {
              retryable: true,
              cause: new Error('audio track: no encoder'),
            }),
          ),
        ),
      } as unknown as SourceProxyBuilder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });

    await broken.prepare({project: projectWithPanels(), ratio: '9:16', fps: 60, signal: signal()});

    expect(broken.notes()).toEqual([
      'panelA: failed, audio track: no encoder',
      'panelB: failed, audio track: no encoder',
    ]);
  });

  it('reuses a proxy on the next render instead of transcoding again', async () => {
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });
    const project = projectWithPanels();

    await proxies.prepare({project, ratio: '9:16', fps: 60, signal: signal()});
    proxies.clearNotes();
    const second = await proxies.prepare({
      project,
      ratio: '9:16',
      fps: 60,
      signal: signal(),
    });

    expect(builder.build).toHaveBeenCalledTimes(2);
    expect(proxies.notes()).toEqual([
      'panelA: reused 1242x1100 at 0,554',
      'panelB: reused 1242x1100 at 0,554',
    ]);
    // Still the same proxies, so the render is identical to the first one's.
    expect(
      buildDay1Props({...second.project, fps: 60, selectedRatio: '9:16'}, second.resolveUrl)
        ?.panelA.url,
    ).toBe('blob:proxy-1');
  });

  it('frees the proxy a framing change invalidated, and builds the new one', async () => {
    const released: string[] = [];
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: (url) => released.push(url),
    });

    await proxies.prepare({
      project: projectWithPanels(),
      ratio: '9:16',
      fps: 60,
      signal: signal(),
    });

    const reframed = projectWithPanels();
    const day1 = day1Of(reframed) as Day1Settings;

    await proxies.prepare({
      project: {
        ...reframed,
        templateSettings: {
          ...day1,
          panelA: {
            ...day1.panelA,
            transforms: {
              base: {fit: 'cover', scale: 1, x: 0, y: 10},
              overrides: {},
            },
          },
        },
      },
      ratio: '9:16',
      fps: 60,
      signal: signal(),
    });

    // Panel A's crop moved, so its proxy went; panel B's did not, so its stayed.
    expect(released).toEqual(['blob:proxy-1']);
    expect(builder.build).toHaveBeenCalledTimes(3);
  });

  it('keeps one proxy per ratio, so a multi-ratio batch does not thrash', async () => {
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => undefined,
    });
    const project = projectWithPanels();

    await proxies.prepare({project, ratio: '9:16', fps: 60, signal: signal()});
    await proxies.prepare({project, ratio: '16:9', fps: 60, signal: signal()});
    // The second locale of the batch comes back to 9:16 and finds it still there.
    await proxies.prepare({project, ratio: '9:16', fps: 60, signal: signal()});

    expect(builder.build).toHaveBeenCalledTimes(4);
  });

  it('releases every proxy it built', async () => {
    const released: string[] = [];
    const proxies = createPanelProxies({
      builder: fakeBuilder(),
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: (url) => released.push(url),
    });

    await proxies.prepare({project: projectWithPanels(), ratio: '9:16', fps: 60, signal: signal()});
    proxies.release();

    expect(released).toEqual(['blob:proxy-1', 'blob:proxy-2']);
  });
});

// day1-quad Design §7.4 — the proxy loop is driven by the template's panel keys.
// It used to be a two-element constant, which left half of a quad render on its
// original, uncropped sources.
describe('createPanelProxies — four panels', () => {
  const quadProject = (source: (id: string) => MediaReference): EditorProject => {
    const panel = (id: string) => ({
      source: source(id),
      trim: {inMs: 0, outMs: 3000},
      transforms: {
        base: {fit: 'cover' as const, scale: 1, x: 0, y: 0},
        overrides: {},
      },
    });
    const panels: Partial<Day1QuadSettings> = {
      panelA: panel('media_a'),
      panelB: panel('media_b'),
      panelC: panel('media_c'),
      panelD: panel('media_d'),
    };

    return day1QuadProjectFixture(panels);
  };

  const prepareQuad = async (source: (id: string) => MediaReference) => {
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => {},
    });
    const prepared = await proxies.prepare({
      project: quadProject(source),
      ratio: '9:16',
      fps: 30,
      signal: signal(),
    });

    return {builder, proxies, prepared};
  };

  /** A landscape capture in a 9:16 cell: `cover` throws away 68% of its width. */
  const landscapeSource = (id: string): MediaReference =>
    testMediaReference({id, width: 1920, height: 1080, durationMs: 324_000});

  it('crops all four panels, not just the first two', async () => {
    const {builder, proxies, prepared} = await prepareQuad(landscapeSource);

    expect(builder.build).toHaveBeenCalledTimes(4);

    const props = buildDay1QuadProps(prepared.project, prepared.resolveUrl);

    props?.panels.forEach((panel) => {
      expect(panel.url).toMatch(/^blob:proxy-/);
    });
    // One note per panel, which is the whole diagnostic surface.
    expect(proxies.notes()).toHaveLength(4);
  });

  /**
   * The geometric consequence of Design §5.1, and a pleasant one: a quad cell
   * carries the output frame's own aspect ratio, so a source shaped like the
   * output is already a near-perfect fit and there is nothing worth cropping.
   * `planPanelProxy` declines below `MIN_PROXY_SAVINGS` and the render uses the
   * original file.
   *
   * The two-panel split could never offer this — its 9:16 panel is landscape, so
   * a portrait source lost half its height (day1-render-speed §3, 49.8%).
   */
  it('leaves a source already shaped like the cell alone', async () => {
    const {builder, proxies} = await prepareQuad(portraitSource);

    expect(builder.build).not.toHaveBeenCalled();
    expect(proxies.notes().join(' ')).toMatch(/skipped|already/i);
  });
});

// failure-video Design §7.4 — the third slot shape: addressed by
// `(orientation, key)` rather than by a flat panel key, and boxed by the video
// band rather than by a split or a grid.
describe('createPanelProxies — failure segments', () => {
  /** A landscape capture in a 9:16 video band: `cover` throws most of it away. */
  const landscapeSource = (id: string): MediaReference =>
    testMediaReference({id, width: 1920, height: 1080, durationMs: 324_000});

  const failureProject = (
    source: (id: string) => MediaReference = landscapeSource,
  ): EditorProject => {
    const panel = (id: string) => ({
      source: source(id),
      trim: {inMs: 0, outMs: 2000},
      transforms: {
        base: {fit: 'cover' as const, scale: 1, x: 0, y: 0},
        overrides: {},
      },
    });

    return failureProjectFixture({
      vertical: {
        panelA: panel('v_a'),
        panelB: panel('v_b'),
        panelC: panel('v_c'),
      },
      horizontal: {
        panelA: panel('h_a'),
        panelB: panel('h_b'),
        panelC: panel('h_c'),
      },
    });
  };

  const prepareFailure = async (
    ratio: '9:16' | '16:9',
    // A source that is genuinely off-shape for the band being rendered, so the
    // crop is worth making: landscape footage in the tall 9:16 band, portrait
    // footage in the wide 16:9 one.
    source: (id: string) => MediaReference = ratio === '9:16'
      ? landscapeSource
      : portraitSource,
  ) => {
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => {},
    });
    const prepared = await proxies.prepare({
      project: {...failureProject(source), selectedRatio: ratio},
      ratio,
      fps: 30,
      signal: signal(),
    });

    return {builder, proxies, prepared};
  };

  it('crops the three segments of the orientation being rendered', async () => {
    const {builder, proxies, prepared} = await prepareFailure('9:16');

    // Three, not six: the other orientation is not in this render at all.
    expect(builder.build).toHaveBeenCalledTimes(3);
    expect(
      builder.build.mock.calls.map((call) => call[0].url),
    ).toEqual(['blob:v_a', 'blob:v_b', 'blob:v_c']);

    const props = buildFailureProps(prepared.project, prepared.resolveUrl);

    props?.panels.forEach((panel) => {
      expect(panel.url).toMatch(/^blob:proxy-/);
    });
    // The notes name the orientation, so a debug report says which group ran.
    expect(proxies.notes().join(' ')).toMatch(/vertical\.panelA/);
  });

  it('follows the ratio to the other source group', async () => {
    const {builder, prepared} = await prepareFailure('16:9');

    expect(
      builder.build.mock.calls.map((call) => call[0].url),
    ).toEqual(['blob:h_a', 'blob:h_b', 'blob:h_c']);

    const props = buildFailureProps(prepared.project, prepared.resolveUrl);

    expect(props?.orientation).toBe('horizontal');
  });

  it('writes the proxy back without touching the other orientation', async () => {
    const {prepared} = await prepareFailure('9:16');
    const settings = failureSettingsOf(prepared.project);

    expect(settings.vertical.panelA.source?.id).not.toBe('v_a');
    // The group this render does not read is handed back exactly as it was.
    expect(settings.horizontal.panelA.source?.id).toBe('h_a');
    expect(settings.horizontal.panelA.trim).toEqual({inMs: 0, outMs: 2000});
  });

  it('leaves the stored project untouched, as it does for every template', async () => {
    const project = failureProject();
    const builder = fakeBuilder();
    const proxies = createPanelProxies({
      builder,
      resolveUrl: (reference) => (reference ? `blob:${reference.id}` : null),
      release: () => {},
    });

    await proxies.prepare({project, ratio: '9:16', fps: 30, signal: signal()});

    expect(failureSettingsOf(project).vertical.panelA.source?.id).toBe('v_a');
    expect(failureSettingsOf(project).vertical.panelA.trim).toEqual({
      inMs: 0,
      outMs: 2000,
    });
  });
});
