// Design Ref: §3.6 IndexedDB `tts-cache` and §4.2 — a repeated request with the
// same cache key must reuse the stored audio instead of calling the provider.
import {DB_NAME, TTS_CACHE_STORE, idbDelete, idbGet, idbGetAll, idbPut} from '../persistence/idb';

export interface CachedTtsEntry {
  cacheKey: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  byteLength: number;
  providerId: string;
  createdAt: string;
}

export interface TtsCache {
  get(cacheKey: string): Promise<CachedTtsEntry | null>;
  put(entry: CachedTtsEntry): Promise<void>;
  clear(): Promise<void>;
  usageBytes(): Promise<number>;
}

export const createTtsCache = (): TtsCache => ({
  get: async (cacheKey) =>
    (await idbGet<CachedTtsEntry>(TTS_CACHE_STORE, cacheKey)) ?? null,

  put: (entry) => idbPut(TTS_CACHE_STORE, entry),

  clear: async () => {
    for (const entry of await idbGetAll<CachedTtsEntry>(TTS_CACHE_STORE)) {
      await idbDelete(TTS_CACHE_STORE, entry.cacheKey);
    }
  },

  usageBytes: async () =>
    (await idbGetAll<CachedTtsEntry>(TTS_CACHE_STORE)).reduce(
      (total, entry) => total + entry.byteLength,
      0,
    ),
});

export const TTS_CACHE_DATABASE = DB_NAME;
