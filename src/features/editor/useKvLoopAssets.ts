// key-visual-looping Design Ref: §6.2 — turns a dropped image into playable
// media for one key visual slot or for the title overlay.
//
// Much smaller than `useDay1Assets` on purpose. A key visual carries no trim and
// no duration, and Design D-04 keeps the framing in `slots` rather than on the
// reference — so re-uploading an image after a reload loses nothing, and there is
// no id to preserve and no relink verdict to report. That is the same policy the
// Day1 end-card image slots already follow.
import {useCallback, useState} from 'react';

import {kvLoopOf} from '../../domain/editor/project';
import type {
  EditorProject,
  Locale,
  MediaReference,
} from '../../domain/editor/types';
import type {MediaResolver} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';
import type {MediaSession} from './useMediaSession';

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
  uploadImage: (index: number, file: File | null) => Promise<void>;
  uploadTitle: (file: File | null) => Promise<void>;
}

export const useKvLoopAssets = ({
  resolver,
  session,
  project,
  references,
  titleReference,
  commands,
}: {
  resolver: MediaResolver;
  session: MediaSession;
  project: EditorProject;
  /** The locale's resolved set, so an inherited image previews too (FR-L04). */
  references: readonly (MediaReference | null)[];
  titleReference: MediaReference | null;
  commands: KvLoopAssetCommands;
}): KvLoopAssetsApi => {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<AppError | null>(null);

  const locale = project.selectedLocale;

  const imageUrl = useCallback(
    (index: number) => session.urlFor(references[index]?.id),
    [references, session],
  );

  const titleUrl = useCallback(
    () => session.urlFor(titleReference?.id),
    [session, titleReference],
  );

  const adopt = useCallback(
    async (file: File): Promise<MediaReference | null> => {
      setBusy(true);
      setUploadError(null);

      const result = await resolver.probeImage(file);

      setBusy(false);

      if (!result.ok) {
        setUploadError(result.error);

        return null;
      }

      session.adopt(result.value);

      return result.value.reference;
    },
    [resolver, session],
  );

  const uploadImage = useCallback(
    async (index: number, file: File | null) => {
      if (!kvLoopOf(project)) {
        return;
      }

      if (!file) {
        commands.setImage(locale, index, null);

        return;
      }

      const reference = await adopt(file);

      if (reference) {
        commands.setImage(locale, index, reference);
      }
    },
    [adopt, commands, locale, project],
  );

  const uploadTitle = useCallback(
    async (file: File | null) => {
      if (!kvLoopOf(project)) {
        return;
      }

      if (!file) {
        commands.setTitle(locale, null);

        return;
      }

      const reference = await adopt(file);

      if (reference) {
        commands.setTitle(locale, reference);
      }
    },
    [adopt, commands, locale, project],
  );

  return {imageUrl, titleUrl, busy, uploadError, uploadImage, uploadTitle};
};
