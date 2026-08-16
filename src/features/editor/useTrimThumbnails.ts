// Day1 Trim UX Design Ref: §5.2 — thumbnails for the trim strip, sampled lazily
// when a panel section opens and cached for the session (FR-T03, FR-T04).
import {useEffect, useRef, useState} from 'react';

import {stripSampleTimesMs} from '../../domain/timeline/trimWindow';
import type {FrameSampler} from '../../domain/ports';

/** Design Ref: §2.3 — fixed, so a 300s source costs the same as a 30s one. */
export const STRIP_CELL_COUNT = 16;

/** Strip cells render a few dozen px wide, so they do not need more than this. */
export const STRIP_MAX_EDGE = 160;

/**
 * Session cache, keyed by source id. Outlives the component so collapsing and
 * reopening a panel is free (FR-T04). Section length is deliberately not part of
 * the key: changing it moves the window, not the thumbnails.
 */
const CACHE = new Map<string, (string | null)[]>();

export interface TrimThumbnails {
  thumbnails: (string | null)[];
  /** True once sampling gave up entirely, so the strip can hide (FR-T09). */
  failed: boolean;
}

export const useTrimThumbnails = (
  sampler: FrameSampler,
  url: string | null,
  sourceId: string | null,
  sourceDurationMs: number,
  enabled: boolean,
): TrimThumbnails => {
  const [thumbnails, setThumbnails] = useState<(string | null)[]>([]);
  const [failed, setFailed] = useState(false);

  // Sampling writes into this on every frame, so the effect does not re-run per
  // frame and the array identity stays stable until we publish it.
  const bufferRef = useRef<(string | null)[]>([]);

  useEffect(() => {
    if (!enabled || !url || !sourceId || sourceDurationMs <= 0) {
      return;
    }

    const cached = CACHE.get(sourceId);

    if (cached) {
      setThumbnails(cached);
      setFailed(false);

      return;
    }

    // Day1 Trim UX FR-T10 — sampling runs off the main thread's critical path, so
    // the rest of the inspector stays operable while the track fills in.
    const controller = new AbortController();
    const timesMs = stripSampleTimesMs(sourceDurationMs, STRIP_CELL_COUNT);

    bufferRef.current = Array.from({length: timesMs.length}, () => null);
    setThumbnails(bufferRef.current);
    setFailed(false);

    let filled = 0;

    void sampler
      .sample({
        url,
        timesMs,
        maxEdge: STRIP_MAX_EDGE,
        needsPixels: false,
        signal: controller.signal,
        onFrame: (frame) => {
          const index = timesMs.indexOf(frame.timeMs);

          if (index < 0) {
            return;
          }

          // A fresh array each frame so React sees the change (FR-T03).
          const next = [...bufferRef.current];

          next[index] = frame.thumbnail;
          bufferRef.current = next;
          filled += 1;
          setThumbnails(next);
        },
      })
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }

        if (result.ok) {
          CACHE.set(sourceId, bufferRef.current);

          return;
        }

        // Partial results are still useful, so only a run that produced nothing
        // counts as a failure worth hiding the strip for (§6).
        if (filled === 0) {
          setFailed(true);
        }
      });

    return () => controller.abort();
  }, [enabled, sampler, sourceDurationMs, sourceId, url]);

  return {thumbnails, failed};
};
