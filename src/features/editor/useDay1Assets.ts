// Day1 Design Ref: §6.2 left panel, §6.3 end card section. Owns every path that
// turns a Day1 file into playable media, mirroring `useEditorSource` for the
// three-scene template. Kept separate rather than widening that hook because the
// two templates hold their media in different places, but the restore policy is
// deliberately the same: a stored File System Access handle first, then the
// permission prompt, and only then a relink.
//
// failure-video Design §4.1-2 — the slots are injected rather than read off the
// payload, so a template whose panels are not `Day1PanelKey`s uses the same
// restore, relink, and permission policy. `slots` drives the restore sweep, so a
// caller that hands over every slot it owns gets its inactive ones restored too
// (Design §7.3).
import {useCallback, useEffect, useRef, useState} from 'react';

import type {Day1PanelKey} from '../../domain/editor/project';
import type {
  Day1Panel,
  MediaReference,
  MediaStatus,
} from '../../domain/editor/types';
import {compareForRelink, type RelinkVerdict} from '../../domain/media/relink';
import type {MediaHandleStore, MediaResolver} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';
import type {MediaSession} from './useMediaSession';
import {VIDEO_PICKER_OPTIONS} from './useEditorSource';

export type Day1EndCardSlot = 'banner' | 'appIcon' | 'video';

export interface Day1AssetCommands<TSlot extends string = Day1PanelKey> {
  setPanelSource: (panel: TSlot, source: MediaReference | null) => void;
  relinkPanel: (panel: TSlot, source: MediaReference) => void;
  setPanelStatus: (panel: TSlot, status: MediaStatus) => void;
  setEndCardAsset: (
    slot: Day1EndCardSlot,
    reference: MediaReference | null,
  ) => void;
}

export interface Day1AssetsApi<TSlot extends string = Day1PanelKey> {
  /** Object URL for a panel, or null when it needs a relink. */
  panelUrl: (panel: TSlot) => string | null;
  busy: boolean;
  uploadError: AppError | null;
  /** Populated after a relink so the panel can report a mismatch. */
  relinkVerdict: RelinkVerdict | null;
  supportsFilePicker: boolean;
  /** Panels whose stored handle only needs a permission grant to come back. */
  canGrantPermission: (panel: TSlot) => boolean;
  uploadPanel: (
    panel: TSlot,
    file: File,
    handle?: FileSystemFileHandle,
  ) => Promise<void>;
  pickAndUploadPanel: (panel: TSlot) => Promise<void>;
  relinkPanel: (panel: TSlot, file: File) => Promise<void>;
  grantPanelPermission: (panel: TSlot) => Promise<void>;
  setEndCardAsset: (slot: Day1EndCardSlot, file: File | null) => Promise<void>;
}

export const useDay1Assets = <TSlot extends string = Day1PanelKey>({
  resolver,
  handleStore,
  session,
  slots,
  panelOf,
  commands,
}: {
  resolver: MediaResolver;
  handleStore: MediaHandleStore | null;
  session: MediaSession;
  /** Every slot the template owns, in order. Empty for a template with none. */
  slots: readonly TSlot[];
  /** Resolves a slot off the project, so this hook never indexes the payload. */
  panelOf: (panel: TSlot) => Day1Panel | null;
  commands: Day1AssetCommands<TSlot>;
}): Day1AssetsApi<TSlot> => {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<AppError | null>(null);
  const [relinkVerdict, setRelinkVerdict] = useState<RelinkVerdict | null>(null);

  const commandsRef = useRef(commands);
  // Read through a ref for the same reason `commands` is: both close over the
  // current project, and the callbacks below must not be rebuilt for that.
  const panelOfRef = useRef(panelOf);
  const restoreAttempts = useRef(new Set<string>());

  commandsRef.current = commands;
  panelOfRef.current = panelOf;

  const panelUrl = useCallback(
    (panel: TSlot) => session.urlFor(panelOfRef.current(panel)?.source?.id),
    [session],
  );

  const supportsFilePicker =
    typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  const canGrantPermission = useCallback(
    (panel: TSlot) =>
      handleStore !== null &&
      panelOfRef.current(panel)?.source?.status === 'permission-required',
    [handleStore],
  );

  /**
   * Brings a panel back from its stored handle. Mirrors `useEditorSource`:
   * permission is only requested when the user asks, so the silent first attempt
   * degrades to `permission-required` instead of a prompt on load.
   */
  const resolveStoredHandle = useCallback(
    async (
      panel: TSlot,
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
    for (const panel of slots) {
      const source = panelOfRef.current(panel)?.source;

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
  }, [resolveStoredHandle, session, slots]);

  const uploadPanel = useCallback(
    async (panel: TSlot, file: File, handle?: FileSystemFileHandle) => {
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
    async (panel: TSlot) => {
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
    async (panel: TSlot, file: File) => {
      const source = panelOfRef.current(panel)?.source;

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
    [resolver, session],
  );

  const grantPanelPermission = useCallback(
    async (panel: TSlot) => {
      const source = panelOfRef.current(panel)?.source;

      if (!source) {
        return;
      }

      setBusy(true);
      await resolveStoredHandle(panel, source, true);
      setBusy(false);
    },
    [resolveStoredHandle],
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
