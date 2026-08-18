// Day1 render speed — one entry point to the panel proxies, for every render.
//
// This exists because the first attempt wired the proxies into the batch queue
// only, and the single render button builds its own snapshot and calls the
// renderer directly. The optimisation shipped, deployed, and did nothing, with
// no error anywhere. Both paths now go through `run`, so a third one cannot
// quietly miss it either.
//
// The proxies themselves live as long as the workspace. Building them cost 4.67s
// against a 4.72s saving when measured, so releasing them after each render made
// a single render break even; held across renders, the second one onwards is 27%
// shorter. `panelProxies.ts` bounds the store to one proxy per panel per ratio.
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {MediaReference} from '../../domain/editor/types';
import type {SourceProxyBuilder} from '../../domain/ports';
import {createPanelProxies, type PanelProxies} from './panelProxies';

export interface PanelProxySession {
  /** What the last run did, per panel, for the ?debug report header. */
  notes: readonly string[];
  /**
   * Runs `body` with the session's panel proxies. A batch shares them across its
   * jobs, and so does the next render, so a transcode happens only when the crop
   * it was built for no longer applies.
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
  // `resolveUrl` is rebuilt whenever the media session gains a URL, and the
  // proxies must not be. Reading it through a ref is what lets them outlive it.
  const resolveRef = useRef(resolveUrl);

  resolveRef.current = resolveUrl;

  const proxies = useMemo(
    () =>
      createPanelProxies({
        builder,
        resolveUrl: (reference) => resolveRef.current(reference),
        release: releaseUrl,
      }),
    [builder, releaseUrl],
  );

  // Leaving the page releases what the session held, like `useMediaSession`.
  useEffect(() => () => proxies.release(), [proxies]);

  const run = useCallback(
    async <TResult,>(body: (proxies: PanelProxies) => Promise<TResult>) => {
      proxies.clearNotes();
      setNotes([]);

      try {
        return await body(proxies);
      } finally {
        // Reported even when the render threw: a failed render is exactly when
        // the report gets copied.
        setNotes(proxies.notes());
      }
    },
    [proxies],
  );

  return {notes, run};
};
