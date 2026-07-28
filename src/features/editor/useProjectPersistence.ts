// Design Ref: §2.2 "debounced IndexedDB metadata save" and §6.2 AUTOSAVE_FAILED.
// Restore never assumes the media is still reachable: the project comes back
// first, the source is repaired second.
import {useEffect, useRef, useState} from 'react';

import {touchProject} from '../../domain/editor/project';
import type {EditorProject} from '../../domain/editor/types';
import type {ProjectRepository} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';

export const AUTOSAVE_DEBOUNCE_MS = 800;

export type SaveState =
  | {status: 'idle'}
  | {status: 'saving'}
  | {status: 'saved'; savedAt: string}
  | {status: 'failed'; error: AppError};

export interface ProjectPersistence {
  restoring: boolean;
  saveState: SaveState;
  /** Forces an immediate save, used before destructive actions. */
  saveNow: () => Promise<void>;
}

export interface UseProjectPersistenceOptions {
  repository: ProjectRepository;
  project: EditorProject;
  onRestore: (project: EditorProject) => void;
  loadInitial: (
    repository: ProjectRepository,
  ) => Promise<EditorProject | null | undefined>;
  /** Suspends autosave while a render owns the project snapshot. */
  paused?: boolean;
}

export const useProjectPersistence = ({
  repository,
  project,
  onRestore,
  loadInitial,
  paused = false,
}: UseProjectPersistenceOptions): ProjectPersistence => {
  const [restoring, setRestoring] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>({status: 'idle'});
  const projectRef = useRef(project);
  const skipNextSave = useRef(true);

  projectRef.current = project;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const restored = await loadInitial(repository);

      if (cancelled) {
        return;
      }

      if (restored) {
        skipNextSave.current = true;
        onRestore(restored);
      }

      setRestoring(false);
    })();

    return () => {
      cancelled = true;
    };
    // Restore runs once per repository; later project changes are autosaves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  const save = async (candidate: EditorProject) => {
    setSaveState({status: 'saving'});

    const saved = touchProject(candidate);
    const result = await repository.save(saved);

    setSaveState(
      result.ok
        ? {status: 'saved', savedAt: saved.updatedAt}
        : {status: 'failed', error: result.error},
    );
  };

  useEffect(() => {
    if (restoring || paused) {
      return;
    }

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      void save(project);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, restoring, paused]);

  return {
    restoring,
    saveState,
    saveNow: () => save(projectRef.current),
  };
};
