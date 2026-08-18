// Day1 render speed — one entry point to the panel proxies, for every render.
//
// This exists because the first attempt wired the proxies into the batch queue
// only, and the single render button builds its own snapshot and calls the
// renderer directly. The optimisation shipped, deployed, and did nothing, with
// no error anywhere. Both paths now go through `run`, so a third one cannot
// quietly miss it either.
import {useCallback, useState} from 'react';

import type {MediaReference} from '../../domain/editor/types';
import type {SourceProxyBuilder} from '../../domain/ports';
import {createPanelProxies, type PanelProxies} from './panelProxies';

export interface PanelProxySession {
  /** What the last run did, per panel, for the ?debug report header. */
  notes: readonly string[];
  /**
   * Runs `body` with a fresh set of panel proxies and releases them afterwards.
   * A batch shares one set across its jobs, so the transcode happens once.
   */
  run: <TResult>(
    body: (proxies: PanelProxies) => Promise<TResult>,
  ) => Promise<TResult>;
}

export const usePanelProxies = ({
  builder,
  resolveUrl,
  releaseUrl,
}: {
  builder: SourceProxyBuilder;
  resolveUrl: (reference: MediaReference | null | undefined) => string | null;
  releaseUrl: (url: string) => void;
}): PanelProxySession => {
  const [notes, setNotes] = useState<readonly string[]>([]);

  const run = useCallback(
    async <TResult,>(body: (proxies: PanelProxies) => Promise<TResult>) => {
      const proxies = createPanelProxies({
        builder,
        resolveUrl,
        release: releaseUrl,
      });

      setNotes([]);

      try {
        return await body(proxies);
      } finally {
        // Reported even when the render threw: a failed render is exactly when
        // the report gets copied.
        setNotes(proxies.notes());
        proxies.release();
      }
    },
    [builder, releaseUrl, resolveUrl],
  );

  return {notes, run};
};
