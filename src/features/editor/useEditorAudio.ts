// Design Ref: §2.2 TTS flow and §4.2 — the cache is consulted before the
// provider, generated audio is stored once per cache key, and every locale keeps
// the uploaded-audio route as its supported fallback.
import {useCallback, useState} from 'react';

import type {
  EditorProject,
  Locale,
  MediaReference,
  NarrationTrack,
  SceneKind,
} from '../../domain/editor/types';
import type {MediaResolver} from '../../domain/ports';
import {
  synthesizeWithCache,
  type NarrationCache,
} from '../../domain/tts/synthesize';
import type {
  TtsCapabilities,
  TtsProvider,
  TtsRequest,
} from '../../domain/tts/types';
import type {AppError} from '../../shared/errors/appError';
import type {MediaSession} from './useMediaSession';

export type TtsCacheGateway = NarrationCache;

export type NarrationJob =
  | {status: 'idle'}
  | {status: 'working'; kind: SceneKind; progress: number}
  | {status: 'failed'; kind: SceneKind; error: AppError};

export interface EditorAudioApi {
  job: NarrationJob;
  capabilities: TtsCapabilities | null;
  uploadBgm: (file: File) => Promise<void>;
  uploadNarration: (kind: SceneKind, file: File) => Promise<void>;
  generateNarration: (kind: SceneKind, text: string) => Promise<void>;
  refreshCapabilities: () => Promise<void>;
}

export interface EditorAudioCommands {
  setBgmTrack: (reference: MediaReference | null) => void;
  setNarrationTrack: (kind: SceneKind, track: NarrationTrack | null) => void;
}

const DEFAULT_SPEED = 1;
const DEFAULT_VOICE = 'default';

export const useEditorAudio = ({
  resolver,
  provider,
  cache,
  session,
  project,
  commands,
}: {
  resolver: MediaResolver;
  provider: TtsProvider;
  cache: TtsCacheGateway;
  session: MediaSession;
  project: EditorProject;
  commands: EditorAudioCommands;
}): EditorAudioApi => {
  const [job, setJob] = useState<NarrationJob>({status: 'idle'});
  const [capabilities, setCapabilities] = useState<TtsCapabilities | null>(null);

  const locale: Locale = project.selectedLocale;

  const refreshCapabilities = useCallback(async () => {
    setCapabilities(await provider.getCapabilities());
  }, [provider]);

  const uploadBgm = useCallback(
    async (file: File) => {
      const result = await resolver.probeAudio(file);

      if (!result.ok) {
        setJob({status: 'failed', kind: 'gameplay', error: result.error});
        return;
      }

      session.adopt(result.value);
      commands.setBgmTrack(result.value.reference);
      setJob({status: 'idle'});
    },
    [commands, resolver, session],
  );

  const uploadNarration = useCallback(
    async (kind: SceneKind, file: File) => {
      const result = await resolver.probeAudio(file);

      if (!result.ok) {
        setJob({status: 'failed', kind, error: result.error});
        return;
      }

      session.adopt(result.value);
      commands.setNarrationTrack(kind, {
        mode: 'uploaded',
        providerId: 'uploaded-audio',
        source: result.value.reference,
        durationMs: result.value.reference.durationMs ?? 0,
        volume: 1,
      });
      setJob({status: 'idle'});
    },
    [commands, resolver, session],
  );

  const generateNarration = useCallback(
    async (kind: SceneKind, text: string) => {
      const current = capabilities ?? (await provider.getCapabilities());

      setCapabilities(current);

      const request: TtsRequest = {
        locale,
        text,
        voiceId: DEFAULT_VOICE,
        speed: DEFAULT_SPEED,
      };
      setJob({status: 'working', kind, progress: 0});

      const adopt = (cacheKey: string, blob: Blob, durationMs: number) => {
        const url = URL.createObjectURL(blob);
        const reference: MediaReference = {
          id: cacheKey,
          kind: 'audio',
          name: `${locale}-${kind}-narration.wav`,
          mimeType: blob.type || 'audio/wav',
          sizeBytes: blob.size,
          lastModified: 0,
          durationMs,
          fingerprint: cacheKey,
          status: 'available',
        };

        session.adopt({reference, url});
        commands.setNarrationTrack(kind, {
          mode: 'generated',
          providerId: provider.id,
          source: reference,
          durationMs,
          volume: 1,
          voiceId: request.voiceId,
          speed: request.speed,
          requestHash: cacheKey,
        });
        setJob({status: 'idle'});
      };

      // Design Ref: §8.2 scenario 9 — an identical request never calls the
      // provider twice.
      const result = await synthesizeWithCache({
        provider,
        cache,
        request,
        ...(current.modelRevision === undefined
          ? {}
          : {modelRevision: current.modelRevision}),
        signal: new AbortController().signal,
        onProgress: (progress) => setJob({status: 'working', kind, progress}),
      });

      if (!result.ok) {
        setJob({status: 'failed', kind, error: result.error});
        return;
      }

      adopt(result.value.cacheKey, result.value.blob, result.value.durationMs);
    },
    [cache, capabilities, commands, locale, provider, session],
  );

  return {
    job,
    capabilities,
    uploadBgm,
    uploadNarration,
    generateNarration,
    refreshCapabilities,
  };
};
