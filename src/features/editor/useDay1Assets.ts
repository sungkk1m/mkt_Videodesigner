// Day1 Design Ref: §6.2 left panel, §6.3 end card section. Owns every path that
// turns a Day1 file into playable media, mirroring `useEditorSource` for the
// three-scene template. Kept separate rather than widening that hook: the panels
// have no File System Access handles, so their restore story is a relink prompt
// and nothing else.
import {useCallback, useEffect, useRef, useState} from 'react';

import {day1Of, type Day1PanelKey} from '../../domain/editor/project';
import type {
  Day1Panel,
  EditorProject,
  MediaReference,
  MediaStatus,
} from '../../domain/editor/types';
import {compareForRelink, type RelinkVerdict} from '../../domain/media/relink';
import type {MediaResolver} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';
import type {MediaSession} from './useMediaSession';

export type Day1EndCardSlot = 'banner' | 'appIcon';

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
  uploadPanel: (panel: Day1PanelKey, file: File) => Promise<void>;
  relinkPanel: (panel: Day1PanelKey, file: File) => Promise<void>;
  setEndCardAsset: (slot: Day1EndCardSlot, file: File | null) => Promise<void>;
}

export const useDay1Assets = ({
  resolver,
  session,
  project,
  commands,
}: {
  resolver: MediaResolver;
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

  // A restored project carries panel references with no session URL. There are no
  // stored handles for panels, so the only honest state is "missing" — which turns
  // the panel dropzone into a relink prompt.
  useEffect(() => {
    if (!settings) {
      return;
    }

    for (const panel of ['panelA', 'panelB'] as Day1PanelKey[]) {
      const source = settings[panel].source;

      if (
        !source ||
        source.status !== 'available' ||
        session.urlFor(source.id) ||
        restoreAttempts.current.has(source.id)
      ) {
        continue;
      }

      restoreAttempts.current.add(source.id);
      commandsRef.current.setPanelStatus(panel, 'missing');
    }
  }, [session, settings]);

  const uploadPanel = useCallback(
    async (panel: Day1PanelKey, file: File) => {
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
    },
    [resolver, session],
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

  const setEndCardAsset = useCallback(
    async (slot: Day1EndCardSlot, file: File | null) => {
      if (!file) {
        commandsRef.current.setEndCardAsset(slot, null);
        return;
      }

      setBusy(true);
      setUploadError(null);

      const result = await resolver.probeImage(file);

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
    uploadPanel,
    relinkPanel,
    setEndCardAsset,
  };
};
