// Day1 render speed — the proxy swap has to be invisible to everything except the
// decoder. These cover the parts `sourceProxy.test.ts` cannot: the trim rebasing
// onto the proxy's timeline, the per-run cache, and the fallback that keeps a
// failed transcode from failing a render.
import {describe, expect, it, vi} from 'vitest';

import {buildDay1Props, day1Of} from '../../domain/editor/project';
import type {
  Day1Settings,
  EditorProject,
  MediaReference,
} from '../../domain/editor/types';
import type {SourceProxy, SourceProxyBuilder} from '../../domain/ports';
import {fail, ok} from '../../shared/errors/appError';
import {createAppError} from '../../shared/errors/appError';
import {day1ProjectFixture} from '../../test/fixtures/project';
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
