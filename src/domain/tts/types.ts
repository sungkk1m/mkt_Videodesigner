// Design Ref: §4.2 TTS Contract. Kept in the domain so the editor depends on the
// contract, never on Transformers.js or any specific model runtime.
import type {Locale} from '../editor/types';
import type {Result} from '../../shared/errors/appError';

export interface TtsVoice {
  id: string;
  label: string;
  locale: Locale;
}

export interface TtsCapabilities {
  providerId: string;
  /** False when the runtime, the model, or the platform is unavailable. */
  available: boolean;
  supportedLocales: readonly Locale[];
  /** Korean explanation shown when `available` is false. */
  unavailableReason?: string;
  modelRevision?: string;
}

export interface TtsRequest {
  locale: Locale;
  text: string;
  voiceId: string;
  speed: number;
}

export interface TtsResult {
  blob: Blob;
  durationMs: number;
  sampleRate: number;
  providerId: string;
  modelRevision?: string;
}

export interface TtsProvider {
  readonly id: string;
  getCapabilities(): Promise<TtsCapabilities>;
  listVoices(locale: Locale): Promise<TtsVoice[]>;
  synthesize(
    request: TtsRequest,
    context: {signal: AbortSignal; onProgress: (progress: number) => void},
  ): Promise<Result<TtsResult>>;
  dispose(): Promise<void>;
}

/**
 * Design Ref: §4.2 — "Text, locale, voice, speed, provider, and model revision
 * form the cache key." Same request plus same revision must never call a provider
 * twice.
 */
export const ttsCacheKey = (
  request: TtsRequest,
  providerId: string,
  modelRevision = 'unknown',
) =>
  [
    providerId,
    modelRevision,
    request.locale,
    request.voiceId,
    request.speed.toFixed(2),
    request.text.trim(),
  ].join('|');
