// Design Ref: §3.6 restore policy, §4.1 MediaResolver, §7 "File-system
// permissions requested only after an explicit user action". Owns every path
// that turns a persisted MediaReference back into playable media.
import {useCallback, useEffect, useRef, useState} from 'react';

import type {
  EditorProject,
  MediaReference,
  MediaStatus,
} from '../../domain/editor/types';
import {threeSceneOf} from '../../domain/editor/project';
import {compareForRelink, type RelinkVerdict} from '../../domain/media/relink';
import type {MediaHandleStore, MediaResolver} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';
import type {CtaAssetSlot} from './SceneInspector';
import type {MediaSession} from './useMediaSession';

export interface EditorSourceCommands {
  applySource: (source: MediaReference) => void;
  relink: (source: MediaReference) => void;
  setSourceStatus: (status: MediaStatus) => void;
  setCtaAsset: (slot: CtaAssetSlot, reference: MediaReference | null) => void;
}

export interface EditorSourceApi {
  sourceUrl: string | null;
  busy: boolean;
  uploadError: AppError | null;
  relinkError: AppError | null;
  relinkVerdict: RelinkVerdict | null;
  supportsFilePicker: boolean;
  canGrantPermission: boolean;
  upload: (file: File, handle?: FileSystemFileHandle) => Promise<void>;
  pickAndUpload: () => Promise<void>;
  relinkFromFile: (file: File) => Promise<void>;
  grantPermission: () => Promise<void>;
  setCtaAsset: (slot: CtaAssetSlot, file: File | null) => Promise<void>;
}

const VIDEO_PICKER_OPTIONS = {
  types: [
    {
      description: '영상 파일',
      accept: {'video/*': ['.mp4', '.mov', '.webm', '.m4v']},
    },
  ],
  multiple: false,
} as const;

export const useEditorSource = ({
  resolver,
  handleStore,
  session,
  project,
  commands,
}: {
  resolver: MediaResolver;
  handleStore: MediaHandleStore | null;
  session: MediaSession;
  project: EditorProject;
  commands: EditorSourceCommands;
}): EditorSourceApi => {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<AppError | null>(null);
  const [relinkError, setRelinkError] = useState<AppError | null>(null);
  const [relinkVerdict, setRelinkVerdict] = useState<RelinkVerdict | null>(null);

  const source = threeSceneOf(project)?.source ?? null;
  const sourceUrl = session.urlFor(source?.id);
  const commandsRef = useRef(commands);
  const restoreAttempts = useRef(new Set<string>());

  commandsRef.current = commands;

  const supportsFilePicker =
    typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  const upload = useCallback(
    async (file: File, handle?: FileSystemFileHandle) => {
      setBusy(true);
      setUploadError(null);

      const result = await resolver.probe(file);

      setBusy(false);

      if (!result.ok) {
        setUploadError(result.error);
        return;
      }

      session.adopt(result.value);
      commandsRef.current.applySource(result.value.reference);
      setRelinkError(null);
      setRelinkVerdict(null);

      if (handle && handleStore) {
        await handleStore.put(result.value.reference.id, handle);
      }
    },
    [handleStore, resolver, session],
  );

  const pickAndUpload = useCallback(async () => {
    if (!supportsFilePicker) {
      return;
    }

    let handle: FileSystemFileHandle | undefined;

    try {
      [handle] = await window.showOpenFilePicker(VIDEO_PICKER_OPTIONS);
    } catch {
      // AbortError: the user closed the picker. Nothing to report.
      return;
    }

    if (!handle) {
      return;
    }

    await upload(await handle.getFile(), handle);
  }, [supportsFilePicker, upload]);

  const relinkFromFile = useCallback(
    async (file: File) => {
      if (!source) {
        return;
      }

      setBusy(true);
      setRelinkError(null);

      const result = await resolver.probe(file);

      setBusy(false);

      if (!result.ok) {
        setRelinkError(result.error);
        return;
      }

      const verdict = compareForRelink(source, {
        fingerprint: result.value.reference.fingerprint,
        name: result.value.reference.name,
        sizeBytes: result.value.reference.sizeBytes,
        durationMs: result.value.reference.durationMs ?? 0,
      });

      // The relinked file keeps the project's media id so scene references and
      // any stored handle stay valid.
      const reference: MediaReference = {
        ...result.value.reference,
        id: source.id,
        status: 'available',
      };

      session.adopt({reference, url: result.value.url});
      commandsRef.current.relink(reference);
      setRelinkVerdict(verdict);
    },
    [resolver, session, source],
  );

  const resolveStoredHandle = useCallback(
    async (reference: MediaReference, requestPermission: boolean) => {
      if (!handleStore) {
        commandsRef.current.setSourceStatus('missing');
        return;
      }

      const resolved = await handleStore.resolve(reference.id, {
        requestPermission,
      });

      if (!resolved.ok) {
        commandsRef.current.setSourceStatus(
          resolved.error.code === 'MEDIA_PERMISSION_REQUIRED'
            ? 'permission-required'
            : 'missing',
        );
        return;
      }

      const probed = await resolver.probe(resolved.value);

      if (!probed.ok) {
        commandsRef.current.setSourceStatus('unsupported');
        return;
      }

      const restored: MediaReference = {
        ...probed.value.reference,
        id: reference.id,
        status: 'available',
      };

      session.adopt({reference: restored, url: probed.value.url});
      commandsRef.current.relink(restored);
    },
    [handleStore, resolver, session],
  );

  // Restoring a saved project: try the stored handle silently, then let the user
  // grant permission or pick the file.
  useEffect(() => {
    if (!source || sourceUrl || source.status === 'unsupported') {
      return;
    }

    if (restoreAttempts.current.has(source.id)) {
      return;
    }

    restoreAttempts.current.add(source.id);
    void resolveStoredHandle(source, false);
  }, [resolveStoredHandle, source, sourceUrl]);

  const grantPermission = useCallback(async () => {
    if (!source) {
      return;
    }

    setBusy(true);
    await resolveStoredHandle(source, true);
    setBusy(false);
  }, [resolveStoredHandle, source]);

  const setCtaAsset = useCallback(
    async (slot: CtaAssetSlot, file: File | null) => {
      if (!file) {
        commandsRef.current.setCtaAsset(slot, null);
        return;
      }

      setBusy(true);
      setUploadError(null);

      const result =
        slot === 'media'
          ? await resolver.probe(file)
          : await resolver.probeImage(file);

      setBusy(false);

      if (!result.ok) {
        setUploadError(result.error);
        return;
      }

      session.adopt(result.value);
      commandsRef.current.setCtaAsset(slot, result.value.reference);
    },
    [resolver, session],
  );

  return {
    sourceUrl,
    busy,
    setCtaAsset,
    uploadError,
    relinkError,
    relinkVerdict,
    supportsFilePicker,
    canGrantPermission:
      handleStore !== null && source?.status === 'permission-required',
    upload,
    pickAndUpload,
    relinkFromFile,
    grantPermission,
  };
};
