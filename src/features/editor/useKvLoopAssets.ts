// key-visual-looping Design Ref: §6.2 — turns a dropped image into playable
// media for one key visual slot or for the title overlay, and brings both back
// from a stored File System Access handle after a reload.
//
// Smaller than `useDay1Assets` still: a key visual carries no trim and no
// relink verdict, and Design D-04 keeps the framing in `slots` rather than on
// the reference. What it does share is the restore policy — a stored handle
// first, the permission prompt only when the operator asks for it, and a
// re-upload as the last resort.
import {useCallback, useEffect, useRef, useState} from 'react';

import {kvLoopOf} from '../../domain/editor/project';
import type {
  EditorProject,
  Locale,
  MediaReference,
} from '../../domain/editor/types';
import {
  kvLoopRestoreTargets,
  type KvRestoreTarget,
} from '../../domain/kvloop/assets';
import {withStatus} from '../../domain/media/reference';
import type {MediaHandleStore, MediaResolver} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';
import type {MediaSession} from './useMediaSession';

/** Mirrors `VIDEO_PICKER_OPTIONS`, for the formats `probeImage` accepts. */
const IMAGE_PICKER_OPTIONS = {
  types: [
    {
      description: '이미지 파일',
      accept: {'image/*': ['.png', '.jpg', '.jpeg', '.webp']},
    },
  ],
  multiple: false,
} as const;

export interface KvLoopAssetCommands {
  setImage: (
    locale: Locale,
    index: number,
    reference: MediaReference | null,
  ) => void;
  setTitle: (locale: Locale, reference: MediaReference | null) => void;
}

export interface KvLoopAssetsApi {
  /** Session URL for one key visual of the current locale's resolved set. */
  imageUrl: (index: number) => string | null;
  titleUrl: () => string | null;
  busy: boolean;
  uploadError: AppError | null;
  supportsFilePicker: boolean;
  /** True for a reference whose stored handle only needs a permission grant. */
  canGrantPermission: (reference: MediaReference | null) => boolean;
  uploadImage: (
    index: number,
    file: File | null,
    handle?: FileSystemFileHandle,
  ) => Promise<void>;
  uploadTitle: (
    file: File | null,
    handle?: FileSystemFileHandle,
  ) => Promise<void>;
  /** Upload through the OS picker, which is the only source of a handle. */
  pickAndUploadImage: (index: number) => Promise<void>;
  pickAndUploadTitle: () => Promise<void>;
  grantPermission: (mediaId: string) => Promise<void>;
}

export const useKvLoopAssets = ({
  resolver,
  handleStore,
  session,
  project,
  references,
  titleReference,
  commands,
}: {
  resolver: MediaResolver;
  handleStore: MediaHandleStore | null;
  session: MediaSession;
  project: EditorProject;
  /** The locale's resolved set, so an inherited image previews too (FR-L04). */
  references: readonly (MediaReference | null)[];
  titleReference: MediaReference | null;
  commands: KvLoopAssetCommands;
}): KvLoopAssetsApi => {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<AppError | null>(null);
  const commandsRef = useRef(commands);
  const restoreAttempts = useRef(new Set<string>());

  commandsRef.current = commands;

  const locale = project.selectedLocale;

  const supportsFilePicker =
    typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  const imageUrl = useCallback(
    (index: number) => session.urlFor(references[index]?.id),
    [references, session],
  );

  const titleUrl = useCallback(
    () => session.urlFor(titleReference?.id),
    [session, titleReference],
  );

  const canGrantPermission = useCallback(
    (reference: MediaReference | null) =>
      handleStore !== null && reference?.status === 'permission-required',
    [handleStore],
  );

  const adopt = useCallback(
    async (
      file: File,
      handle?: FileSystemFileHandle,
    ): Promise<MediaReference | null> => {
      setBusy(true);
      setUploadError(null);

      const result = await resolver.probeImage(file);

      setBusy(false);

      if (!result.ok) {
        setUploadError(result.error);

        return null;
      }

      session.adopt(result.value);

      // Only the picker yields a handle. Storing it under the media id is the
      // whole difference between an image that comes back next session and one
      // the operator has to find again.
      if (handle && handleStore) {
        await handleStore.put(result.value.reference.id, handle);
      }

      return result.value.reference;
    },
    [handleStore, resolver, session],
  );

  const uploadImage = useCallback(
    async (index: number, file: File | null, handle?: FileSystemFileHandle) => {
      if (!kvLoopOf(project)) {
        return;
      }

      if (!file) {
        commands.setImage(locale, index, null);

        return;
      }

      const reference = await adopt(file, handle);

      if (reference) {
        commands.setImage(locale, index, reference);
      }
    },
    [adopt, commands, locale, project],
  );

  const uploadTitle = useCallback(
    async (file: File | null, handle?: FileSystemFileHandle) => {
      if (!kvLoopOf(project)) {
        return;
      }

      if (!file) {
        commands.setTitle(locale, null);

        return;
      }

      const reference = await adopt(file, handle);

      if (reference) {
        commands.setTitle(locale, reference);
      }
    },
    [adopt, commands, locale, project],
  );

  const pickHandle = useCallback(async () => {
    if (!supportsFilePicker) {
      return null;
    }

    try {
      const [handle] = await window.showOpenFilePicker(IMAGE_PICKER_OPTIONS);

      return handle ?? null;
    } catch {
      // AbortError: the user closed the picker. Nothing to report.
      return null;
    }
  }, [supportsFilePicker]);

  const pickAndUploadImage = useCallback(
    async (index: number) => {
      const handle = await pickHandle();

      if (handle) {
        await uploadImage(index, await handle.getFile(), handle);
      }
    },
    [pickHandle, uploadImage],
  );

  const pickAndUploadTitle = useCallback(async () => {
    const handle = await pickHandle();

    if (handle) {
      await uploadTitle(await handle.getFile(), handle);
    }
  }, [pickHandle, uploadTitle]);

  /**
   * Brings one key visual — or the title — back from its stored handle. The
   * write always targets `target.locale`, never the selected one, so recovering
   * an inherited set cannot turn it into a set of its own.
   */
  const restore = useCallback(
    async (target: KvRestoreTarget, requestPermission: boolean) => {
      const {locale: owner, slot, reference} = target;
      const write = (next: MediaReference) =>
        slot === 'title'
          ? commandsRef.current.setTitle(owner, next)
          : commandsRef.current.setImage(owner, slot, next);

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

      const probed = await resolver.probeImage(resolved.value);

      if (!probed.ok) {
        write(withStatus(reference, 'unsupported'));

        return;
      }

      // Keeping the project's media id is what keeps the handle findable next
      // session, and what keeps this slot's framing pointed at this image.
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
  // handle silently, so an image the picker put there comes back without a
  // prompt; one that arrived through the dropzone has no handle and lands on
  // `missing`, where the panel asks for the file again.
  useEffect(() => {
    const settings = kvLoopOf(project);

    if (!settings) {
      return;
    }

    const targets = kvLoopRestoreTargets(
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
      const settings = kvLoopOf(project);

      if (!settings) {
        return;
      }

      // `() => false` asks for every stored reference rather than the unresolved
      // ones, because this runs to find the target's owning locale by id.
      const target = kvLoopRestoreTargets(settings, () => false).find(
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
    imageUrl,
    titleUrl,
    busy,
    uploadError,
    supportsFilePicker,
    canGrantPermission,
    uploadImage,
    uploadTitle,
    pickAndUploadImage,
    pickAndUploadTitle,
    grantPermission,
  };
};
