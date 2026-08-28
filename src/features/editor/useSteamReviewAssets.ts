// steam-review Design Ref: §9 — every path that turns a file into playable
// media for the store page: the shared gameplay video, the per-locale
// replacements (Plan Q4), the key art, and the four thumbnails. The restore
// policy is the shared one (`useDay1Assets` / `useKvLoopAssets`): a stored File
// System Access handle first, the permission prompt only when asked for, and a
// re-upload as the last resort.
import {useCallback, useEffect, useRef, useState} from 'react';

import {steamReviewOf} from '../../domain/editor/project';
import type {
  EditorProject,
  Locale,
  MediaReference,
} from '../../domain/editor/types';
import {
  steamReviewRestoreTargets,
  type SteamReviewRestoreTarget,
} from '../../domain/steamreview/assets';
import {withStatus} from '../../domain/media/reference';
import type {MediaHandleStore, MediaResolver} from '../../domain/ports';
import {createAppError, type AppError} from '../../shared/errors/appError';
import type {MediaSession} from './useMediaSession';
import {VIDEO_PICKER_OPTIONS} from './useEditorSource';

const IMAGE_PICKER_OPTIONS = {
  types: [
    {
      description: '이미지 파일',
      accept: {'image/*': ['.png', '.jpg', '.jpeg', '.webp']},
    },
  ],
  multiple: false,
} as const;

export interface SteamReviewAssetCommands {
  setSource: (reference: MediaReference | null) => void;
  relinkSource: (reference: MediaReference) => void;
  setLocaleSource: (locale: Locale, reference: MediaReference | null) => void;
  relinkLocaleSource: (locale: Locale, reference: MediaReference) => void;
  setKeyArt: (reference: MediaReference | null) => void;
  relinkKeyArt: (reference: MediaReference) => void;
  setThumbnail: (index: number, reference: MediaReference | null) => void;
}

export interface SteamReviewAssetsApi {
  urlFor: (reference: MediaReference | null | undefined) => string | null;
  busy: boolean;
  uploadError: AppError | null;
  supportsFilePicker: boolean;
  canGrantPermission: (reference: MediaReference | null) => boolean;
  uploadSource: (
    file: File | null,
    handle?: FileSystemFileHandle,
  ) => Promise<void>;
  uploadLocaleSource: (
    locale: Locale,
    file: File | null,
    handle?: FileSystemFileHandle,
  ) => Promise<void>;
  uploadKeyArt: (
    file: File | null,
    handle?: FileSystemFileHandle,
  ) => Promise<void>;
  uploadThumbnail: (
    index: number,
    file: File | null,
    handle?: FileSystemFileHandle,
  ) => Promise<void>;
  /** Upload through the OS picker, which is the only source of a handle. */
  pickSource: () => Promise<void>;
  pickLocaleSource: (locale: Locale) => Promise<void>;
  pickKeyArt: () => Promise<void>;
  pickThumbnail: (index: number) => Promise<void>;
  grantPermission: (mediaId: string) => Promise<void>;
}

export const useSteamReviewAssets = ({
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
  commands: SteamReviewAssetCommands;
}): SteamReviewAssetsApi => {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<AppError | null>(null);
  const commandsRef = useRef(commands);
  const restoreAttempts = useRef(new Set<string>());

  commandsRef.current = commands;

  const supportsFilePicker =
    typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  const urlFor = useCallback(
    (reference: MediaReference | null | undefined) =>
      session.urlFor(reference?.id),
    [session],
  );

  const canGrantPermission = useCallback(
    (reference: MediaReference | null) =>
      handleStore !== null && reference?.status === 'permission-required',
    [handleStore],
  );

  /**
   * Probes and registers a file. When `keepId` names an existing reference,
   * the probe result takes that id — the Day1 relink rule: keeping the
   * project's media id is what keeps the trim, the crop, and a stored handle
   * pointed at this slot.
   */
  const adopt = useCallback(
    async (
      file: File,
      kind: 'video' | 'image',
      handle?: FileSystemFileHandle,
      keepId?: string,
    ): Promise<MediaReference | null> => {
      setBusy(true);
      setUploadError(null);

      const result =
        kind === 'video'
          ? await resolver.probe(file)
          : await resolver.probeImage(file);

      setBusy(false);

      if (!result.ok) {
        setUploadError(result.error);

        return null;
      }

      const reference: MediaReference = keepId
        ? {...result.value.reference, id: keepId, status: 'available'}
        : result.value.reference;

      session.adopt({reference, url: result.value.url});

      if (handle && handleStore) {
        await handleStore.put(reference.id, handle);
      }

      return reference;
    },
    [handleStore, resolver, session],
  );

  /** An unresolved slot getting a new file is a recovery, not a new edit. */
  const relinkIdFor = useCallback(
    (reference: MediaReference | null) =>
      reference && session.urlFor(reference.id) === null
        ? reference.id
        : undefined,
    [session],
  );

  const uploadSource = useCallback(
    async (file: File | null, handle?: FileSystemFileHandle) => {
      const settings = steamReviewOf(project);

      if (!settings) {
        return;
      }

      if (!file) {
        commands.setSource(null);

        return;
      }

      const keepId = relinkIdFor(settings.source);
      const reference = await adopt(file, 'video', handle, keepId);

      if (!reference) {
        return;
      }

      if (keepId) {
        commands.relinkSource(reference);
      } else {
        commands.setSource(reference);
      }
    },
    [adopt, commands, project, relinkIdFor],
  );

  const uploadLocaleSource = useCallback(
    async (
      locale: Locale,
      file: File | null,
      handle?: FileSystemFileHandle,
    ) => {
      const settings = steamReviewOf(project);

      if (!settings) {
        return;
      }

      if (!file) {
        commands.setLocaleSource(locale, null);

        return;
      }

      const keepId = relinkIdFor(settings.localeSources[locale] ?? null);
      const reference = await adopt(file, 'video', handle, keepId);

      if (!reference) {
        return;
      }

      // D-5 — the command refuses a source shorter than the shared window, so
      // the refusal is worded here, where the panel can show it. The relink
      // path reconciles the window instead, mirroring the shared source.
      if (!keepId && (reference.durationMs ?? 0) < settings.trim.outMs) {
        setUploadError(
          createAppError(
            'MEDIA_PROBE_FAILED',
            `영상이 공통 트림 창(${(settings.trim.outMs / 1000).toFixed(1)}초)보다 짧습니다. 더 긴 영상을 올리거나 트림을 앞으로 옮겨주세요.`,
          ),
        );

        return;
      }

      if (keepId) {
        commands.relinkLocaleSource(locale, reference);
      } else {
        commands.setLocaleSource(locale, reference);
      }
    },
    [adopt, commands, project, relinkIdFor],
  );

  const uploadKeyArt = useCallback(
    async (file: File | null, handle?: FileSystemFileHandle) => {
      const settings = steamReviewOf(project);

      if (!settings) {
        return;
      }

      if (!file) {
        commands.setKeyArt(null);

        return;
      }

      const keepId = relinkIdFor(settings.keyArt.image);
      const reference = await adopt(file, 'image', handle, keepId);

      if (!reference) {
        return;
      }

      if (keepId) {
        commands.relinkKeyArt(reference);
      } else {
        commands.setKeyArt(reference);
      }
    },
    [adopt, commands, project, relinkIdFor],
  );

  const uploadThumbnail = useCallback(
    async (
      index: number,
      file: File | null,
      handle?: FileSystemFileHandle,
    ) => {
      const settings = steamReviewOf(project);

      if (!settings) {
        return;
      }

      if (!file) {
        commands.setThumbnail(index, null);

        return;
      }

      // A thumbnail carries no edit to preserve, so recovery and replacement
      // are the same write — but the id is still kept so a stored handle
      // stays findable.
      const reference = await adopt(
        file,
        'image',
        handle,
        relinkIdFor(settings.thumbnails[index] ?? null),
      );

      if (reference) {
        commands.setThumbnail(index, reference);
      }
    },
    [adopt, commands, project, relinkIdFor],
  );

  const pickHandle = useCallback(
    async (options: typeof VIDEO_PICKER_OPTIONS | typeof IMAGE_PICKER_OPTIONS) => {
      if (!supportsFilePicker) {
        return null;
      }

      try {
        const [handle] = await window.showOpenFilePicker(options);

        return handle ?? null;
      } catch {
        // AbortError: the user closed the picker. Nothing to report.
        return null;
      }
    },
    [supportsFilePicker],
  );

  const pickSource = useCallback(async () => {
    const handle = await pickHandle(VIDEO_PICKER_OPTIONS);

    if (handle) {
      await uploadSource(await handle.getFile(), handle);
    }
  }, [pickHandle, uploadSource]);

  const pickLocaleSource = useCallback(
    async (locale: Locale) => {
      const handle = await pickHandle(VIDEO_PICKER_OPTIONS);

      if (handle) {
        await uploadLocaleSource(locale, await handle.getFile(), handle);
      }
    },
    [pickHandle, uploadLocaleSource],
  );

  const pickKeyArt = useCallback(async () => {
    const handle = await pickHandle(IMAGE_PICKER_OPTIONS);

    if (handle) {
      await uploadKeyArt(await handle.getFile(), handle);
    }
  }, [pickHandle, uploadKeyArt]);

  const pickThumbnail = useCallback(
    async (index: number) => {
      const handle = await pickHandle(IMAGE_PICKER_OPTIONS);

      if (handle) {
        await uploadThumbnail(index, await handle.getFile(), handle);
      }
    },
    [pickHandle, uploadThumbnail],
  );

  /**
   * Brings one slot back from its stored handle. The write goes through the
   * relink commands, so the trim and the key art crop survive the reload —
   * only `setThumbnail` is reused directly, because a thumbnail carries no
   * edit to preserve.
   */
  const restore = useCallback(
    async (target: SteamReviewRestoreTarget, requestPermission: boolean) => {
      const {reference} = target;
      const isVideo =
        target.slot === 'source' || target.slot === 'locale-source';
      const write = (next: MediaReference) => {
        if (target.slot === 'source') {
          commandsRef.current.relinkSource(next);
        } else if (target.slot === 'locale-source') {
          commandsRef.current.relinkLocaleSource(target.locale, next);
        } else if (target.slot === 'key-art') {
          commandsRef.current.relinkKeyArt(next);
        } else {
          commandsRef.current.setThumbnail(target.index, next);
        }
      };

      if (!handleStore) {
        write(withStatus(reference, 'missing'));

        return;
      }

      const resolved = await handleStore.resolve(reference.id, {
        requestPermission,
      });

      if (!resolved.ok) {
        write(
          withStatus(
            reference,
            resolved.error.code === 'MEDIA_PERMISSION_REQUIRED'
              ? 'permission-required'
              : 'missing',
          ),
        );

        return;
      }

      const probed = isVideo
        ? await resolver.probe(resolved.value)
        : await resolver.probeImage(resolved.value);

      if (!probed.ok) {
        write(withStatus(reference, 'unsupported'));

        return;
      }

      // Keeping the project's media id keeps the handle findable next session
      // and keeps the trim and framing pointed at this file.
      const restored: MediaReference = {
        ...probed.value.reference,
        id: reference.id,
        status: 'available',
      };

      session.adopt({reference: restored, url: probed.value.url});
      write(restored);
    },
    [handleStore, resolver, session],
  );

  // A restored project carries references with no session URL. Try each stored
  // handle silently; a dropzone upload has no handle and lands on `missing`,
  // where the panel asks for the file again.
  useEffect(() => {
    const settings = steamReviewOf(project);

    if (!settings) {
      return;
    }

    const targets = steamReviewRestoreTargets(
      settings,
      (mediaId) => session.urlFor(mediaId) !== null,
    );

    for (const target of targets) {
      if (restoreAttempts.current.has(target.reference.id)) {
        continue;
      }

      restoreAttempts.current.add(target.reference.id);
      void restore(target, false);
    }
  }, [project, restore, session]);

  const grantPermission = useCallback(
    async (mediaId: string) => {
      const settings = steamReviewOf(project);

      if (!settings) {
        return;
      }

      // `() => false` lists every stored reference, because this runs to find
      // the target's slot by id, resolved or not.
      const target = steamReviewRestoreTargets(settings, () => false).find(
        (candidate) => candidate.reference.id === mediaId,
      );

      if (!target) {
        return;
      }

      setBusy(true);
      await restore(target, true);
      setBusy(false);
    },
    [project, restore],
  );

  return {
    urlFor,
    busy,
    uploadError,
    supportsFilePicker,
    canGrantPermission,
    uploadSource,
    uploadLocaleSource,
    uploadKeyArt,
    uploadThumbnail,
    pickSource,
    pickLocaleSource,
    pickKeyArt,
    pickThumbnail,
    grantPermission,
  };
};
