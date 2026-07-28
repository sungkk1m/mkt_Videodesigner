// Design Ref: §3.6 — object URLs are session state, never project data, and §7 —
// "Object URLs revoked when source/project changes". This hook is the single
// owner of that lifecycle for the editor.
import {useCallback, useEffect, useRef, useState} from 'react';

import type {ResolvedMedia} from '../../domain/editor/types';
import type {MediaResolver} from '../../domain/ports';

export interface MediaSession {
  /** Playable URL for a persisted media id, or null when unresolved. */
  urlFor: (mediaId: string | null | undefined) => string | null;
  adopt: (media: ResolvedMedia) => void;
  /** Revokes every URL whose media id is no longer referenced. */
  retain: (activeIds: readonly string[]) => void;
}

export const useMediaSession = (resolver: MediaResolver): MediaSession => {
  const urlsRef = useRef<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});

  const commit = useCallback((next: Record<string, string>) => {
    urlsRef.current = next;
    setUrls(next);
  }, []);

  const adopt = useCallback(
    ({reference, url}: ResolvedMedia) => {
      const previous = urlsRef.current[reference.id];

      if (previous === url) {
        return;
      }

      if (previous) {
        resolver.release(previous);
      }

      commit({...urlsRef.current, [reference.id]: url});
    },
    [commit, resolver],
  );

  const retain = useCallback(
    (activeIds: readonly string[]) => {
      const stale = Object.keys(urlsRef.current).filter(
        (id) => !activeIds.includes(id),
      );

      if (stale.length === 0) {
        return;
      }

      const next = {...urlsRef.current};

      for (const id of stale) {
        const url = next[id];

        if (url) {
          resolver.release(url);
        }

        delete next[id];
      }

      commit(next);
    },
    [commit, resolver],
  );

  // Leaving the page must release everything still held.
  useEffect(
    () => () => {
      for (const url of Object.values(urlsRef.current)) {
        resolver.release(url);
      }

      urlsRef.current = {};
    },
    [resolver],
  );

  const urlFor = useCallback(
    (mediaId: string | null | undefined) =>
      mediaId ? (urls[mediaId] ?? null) : null,
    [urls],
  );

  return {urlFor, adopt, retain};
};
