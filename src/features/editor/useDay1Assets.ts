// Day1 Design Ref: §6.2 left panel, §6.3 end card section. Owns every path that
// turns a Day1 file into playable media, mirroring `useEditorSource` for the
// three-scene template. Kept separate rather than widening that hook because the
// two templates hold their media in different places, but the restore policy is
// deliberately the same: a stored File System Access handle first, then the
// permission prompt, and only then a relink.
import {useCallback, useEffect, useRef, useState} from 'react';

import {day1Of, type Day1PanelKey} from '../../domain/editor/project';
import type {
  Day1Panel,
  EditorProject,
  MediaReference,
  MediaStatus,
} from '../../domain/editor/types';
import {compareForRelink, type RelinkVerdict} from '../../domain/media/relink';
import type {MediaHandleStore, MediaResolver} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';
import type {MediaSession} from './useMediaSession';
import {VIDEO_PICKER_OPTIONS} from './useEditorSource';

export type Day1EndCardSlot = 'banner' | 'appIcon' | 'video';

export interface Day1AssetCommands {
  setPanelSource: (panel: Day1PanelKey, source: MediaReference | null) => void;
  relinkPanel: (panel: Day1PanelKey, source: MediaReference) => void;
  setPanelStatus: (panel: Day1PanelKey, status: MediaStatus) => void;
  setEndCardAsset: (
    slot: Day1EndCardSlot,
    reference: MediaReference | null,
  ) => void;
}

export interface Day1AssetsApi {
  /** Object URL for a panel, or null when it needs a relink. */
  panelUrl: (panel: Day1PanelKey) => string | null;
  busy: boolean;
  uploadError: AppError | null;
  /** Populated after a relink so the panel can report a mismatch. */
  relinkVerdict: RelinkVerdict | null;
  supportsFilePicker: boolean;
  /** Panels whose stored handle only needs a permission grant to come back. */
  canGrantPermission: (panel: Day1PanelKey) => boolean;
  uploadPanel: (
    panel: Day1PanelKey,
    file: File,
    handle?: FileSystemFileHandle,
  ) => Promise<void>;
  pickAndUploadPanel: (panel: Day1PanelKey) => Promise<void>;
  relinkPanel: (panel: Day1PanelKey, file: File) => Promise<void>;
  grantPanelPermission: (panel: Day1PanelKey) => Promise<void>;
  setEndCardAsset: (slot: Day1EndCardSlot, file: File | null) => Promise<void>;
}

export const useDay1Assets = ({
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
  commands: Day1AssetCommands;
}): Day1AssetsApi => {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<AppError | null>(null);
  const [relinkVerdict, setRelinkVerdict] = useState<RelinkVerdict | null>(null);

  const settings = day1Of(project);
  const commandsRef = useRef(commands);
  const restoreAttempts = useRef(new Set<string>());

  commandsRef.current = commands;

  const panelOf = (panel: Day1PanelKey): Day1Panel | null =>
    settings ? settings[panel] : null;

  const panelUrl = useCallback(
    (panel: Day1PanelKey) =>
      session.urlFor(day1Of(project)?.[panel].source?.id),
    [project, session],
  );

  const supportsFilePicker =
    typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  const canGrantPermission = useCallback(
    (panel: Day1PanelKey) =>
      handleStore !== null &&
      day1Of(project)?.[panel].source?.status === 'permission-required',
    [handleStore, project],
  );

  /**
   * Brings a panel back from its stored handle. Mirrors `useEditorSource`:
   * permission is only requested when the user asks, so the silent first attempt
   * degrades to `permission-required` instead of a prompt on load.
   */
  const resolveStoredHandle = useCallback(
    async (
      panel: Day1PanelKey,
      reference: MediaReference,
      requestPermission: boolean,
    ) => {
      if (!handleStore) {
        commandsRef.current.setPanelStatus(panel, 'missing');
        return;
      }

      const resolved = await handleStore.resolve(reference.id, {
        requestPermission,
      });

      if (!resolved.ok) {
        commandsRef.current.setPanelStatus(
          panel,
          resolved.error.code === 'MEDIA_PERMISSION_REQUIRED'
            ? 'permission-required'
            : 'missing',
        );
        return;
      }

      const probed = await resolver.probe(resolved.value);

      if (!probed.ok) {
        commandsRef.current.setPanelStatus(panel, 'unsupported');
        return;
      }

      // Keeping the project's media id is what lets trim and framing survive.
      const restored: MediaReference = {
        ...probed.value.reference,
        id: reference.id,
        status: 'available',
      };

      session.adopt({reference: restored, url: probed.value.url});
      commandsRef.current.relinkPanel(panel, restored);
    },
    [handleStore, resolver, session],
  );

  // A restored project carries panel references with no session URL. Try the
  // stored handle silently; a panel uploaded through the dropzone has none, so it
  // lands on `missing` and the dropzone becomes a relink prompt.
  useEffect(() => {
    if (!settings) {
      return;
    }

    for (const panel of ['panelA', 'panelB'] as Day1PanelKey[]) {
      const source = settings[panel].source;

      if (
        !source ||
        source.status === 'unsupported' ||
        session.urlFor(source.id) ||
        restoreAttempts.current.has(source.id)
      ) {
        continue;
      }

      restoreAttempts.current.add(source.id);
      void resolveStoredHandle(panel, source, false);
    }
  }, [resolveStoredHandle, session, settings]);

  const uploadPanel = useCallback(
    async (panel: Day1PanelKey, file: File, handle?: FileSystemFileHandle) => {
      setBusy(true);
      setUploadError(null);

      const result = await resolver.probe(file);

      setBusy(false);

      if (!result.ok) {
        setUploadError(result.error);
        return;
      }

      session.adopt(result.value);
      commandsRef.current.setPanelSource(panel, result.value.reference);
      setRelinkVerdict(null);

      if (handle && handleStore) {
        await handleStore.put(result.value.reference.id, handle);
      }
    },
    [handleStore, resolver, session],
  );

  const pickAndUploadPanel = useCallback(
    async (panel: Day1PanelKey) => {
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

      await uploadPanel(panel, await handle.getFile(), handle);
    },
    [supportsFilePicker, uploadPanel],
  );

  const relinkPanel = useCallback(
    async (panel: Day1PanelKey, file: File) => {
      const source = panelOf(panel)?.source;

      if (!source) {
        return;
      }

      setBusy(true);
      setUploadError(null);

      const result = await resolver.probe(file);

      setBusy(false);

      if (!result.ok) {
        setUploadError(result.error);
        return;
      }

      const verdict = compareForRelink(source, {
        fingerprint: result.value.reference.fingerprint,
        name: result.value.reference.name,
        sizeBytes: result.value.reference.sizeBytes,
        durationMs: result.value.reference.durationMs ?? 0,
      });
      // Keeping the project's media id means the panel's trim and framing survive.
      const reference: MediaReference = {
        ...result.value.reference,
        id: source.id,
        status: 'available',
      };

      session.adopt({reference, url: result.value.url});
      commandsRef.current.relinkPanel(panel, reference);
      setRelinkVerdict(verdict);
    },
    // `panelOf` reads the current project through the closure below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolver, session, settings],
  );

  const grantPanelPermission = useCallback(
    async (panel: Day1PanelKey) => {
      const source = day1Of(project)?.[panel].source;

      if (!source) {
        return;
      }

      setBusy(true);
      await resolveStoredHandle(panel, source, true);
      setBusy(false);
    },
    [project, resolveStoredHandle],
  );

  const setEndCardAsset = useCallback(
    async (slot: Day1EndCardSlot, file: File | null) => {
      if (!file) {
        commandsRef.current.setEndCardAsset(slot, null);
        return;
      }

      setBusy(true);
      setUploadError(null);

      // Endcard-Video FR-03 — the video slot needs the video probe (duration,
      // decodability); the two image slots keep the image probe.
      const result =
        slot === 'video'
          ? await resolver.probe(file)
          : await resolver.probeImage(file);

      setBusy(false);

      if (!result.ok) {
        setUploadError(result.error);
        return;
      }

      session.adopt(result.value);
      commandsRef.current.setEndCardAsset(slot, result.value.reference);
    },
    [resolver, session],
  );

  return {
    panelUrl,
    busy,
    uploadError,
    relinkVerdict,
    supportsFilePicker,
    canGrantPermission,
    uploadPanel,
    pickAndUploadPanel,
    relinkPanel,
    grantPanelPermission,
    setEndCardAsset,
  };
};
