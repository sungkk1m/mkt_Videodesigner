// Design Ref: §4.2 and §8.2 scenario 9 — "Same request/model revision → provider
// called once". The cache is always consulted first, and a successful synthesis
// is stored before it is handed back.
import {ok, type Result} from '../../shared/errors/appError';
import {ttsCacheKey, type TtsProvider, type TtsRequest} from './types';

export interface CachedNarration {
  blob: Blob;
  durationMs: number;
}

export interface NarrationCache {
  get(cacheKey: string): Promise<CachedNarration | null>;
  put(entry: {
    cacheKey: string;
    blob: Blob;
    mimeType: string;
    durationMs: number;
    byteLength: number;
    providerId: string;
    createdAt: string;
  }): Promise<void>;
}

export interface SynthesisOutcome extends CachedNarration {
  cacheKey: string;
  fromCache: boolean;
}

export const synthesizeWithCache = async ({
  provider,
  cache,
  request,
  modelRevision,
  signal,
  onProgress,
  now = () => new Date().toISOString(),
}: {
  provider: TtsProvider;
  cache: NarrationCache;
  request: TtsRequest;
  modelRevision?: string;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
  now?: () => string;
}): Promise<Result<SynthesisOutcome>> => {
  const cacheKey = ttsCacheKey(request, provider.id, modelRevision);
  const cached = await cache.get(cacheKey);

  if (cached) {
    onProgress(1);

    return ok({...cached, cacheKey, fromCache: true});
  }

  const result = await provider.synthesize(request, {signal, onProgress});

  if (!result.ok) {
    return result;
  }

  await cache.put({
    cacheKey,
    blob: result.value.blob,
    mimeType: result.value.blob.type || 'audio/wav',
    durationMs: result.value.durationMs,
    byteLength: result.value.blob.size,
    providerId: provider.id,
    createdAt: now(),
  });

  return ok({
    blob: result.value.blob,
    durationMs: result.value.durationMs,
    cacheKey,
    fromCache: false,
  });
};
