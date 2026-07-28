import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createAppError, fail, ok} from '../../shared/errors/appError';
import {synthesizeWithCache, type NarrationCache} from './synthesize';
import type {TtsProvider, TtsRequest, TtsResult} from './types';

const request: TtsRequest = {
  locale: 'ko',
  text: '지금 다운로드',
  voiceId: 'default',
  speed: 1,
};

const audio = () => new Blob([new Uint8Array(64)], {type: 'audio/wav'});

const createCache = (): NarrationCache & {entries: Map<string, unknown>} => {
  const entries = new Map<string, {blob: Blob; durationMs: number}>();

  return {
    entries,
    get: async (cacheKey) => entries.get(cacheKey) ?? null,
    put: async (entry) => {
      entries.set(entry.cacheKey, {
        blob: entry.blob,
        durationMs: entry.durationMs,
      });
    },
  };
};

const synthesize = vi.fn();

const provider: TtsProvider = {
  id: 'test-provider',
  getCapabilities: async () => ({
    providerId: 'test-provider',
    available: true,
    supportedLocales: ['ko', 'en', 'ja'],
    modelRevision: 'r1',
  }),
  listVoices: async () => [],
  synthesize,
  dispose: async () => {},
};

const run = (cache: NarrationCache, override: Partial<TtsRequest> = {}) =>
  synthesizeWithCache({
    provider,
    cache,
    request: {...request, ...override},
    modelRevision: 'r1',
    signal: new AbortController().signal,
    onProgress: () => {},
    now: () => '2026-07-28T00:00:00.000Z',
  });

beforeEach(() => {
  synthesize.mockReset();
  synthesize.mockResolvedValue(
    ok<TtsResult>({
      blob: audio(),
      durationMs: 1500,
      sampleRate: 24_000,
      providerId: 'test-provider',
    }),
  );
});

describe('synthesizeWithCache', () => {
  it('calls the provider once and stores the result', async () => {
    const cache = createCache();
    const first = await run(cache);

    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.fromCache).toBe(false);
      expect(first.value.durationMs).toBe(1500);
    }
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(cache.entries.size).toBe(1);
  });

  it('serves the second identical request from the cache', async () => {
    const cache = createCache();
    await run(cache);
    const second = await run(cache);

    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.fromCache).toBe(true);
    }
  });

  it('calls the provider again when any request dimension changes', async () => {
    const cache = createCache();
    await run(cache);
    await run(cache, {speed: 1.5});
    await run(cache, {locale: 'en'});

    expect(synthesize).toHaveBeenCalledTimes(3);
  });

  it('caches nothing when the provider fails', async () => {
    const cache = createCache();
    synthesize.mockResolvedValue(
      fail(createAppError('TTS_GENERATION_FAILED', '실패')),
    );

    const result = await run(cache);

    expect(result).toMatchObject({
      ok: false,
      error: {code: 'TTS_GENERATION_FAILED'},
    });
    expect(cache.entries.size).toBe(0);
  });
});
