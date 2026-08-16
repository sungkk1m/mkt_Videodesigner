// Day1 Trim UX Design Ref: §5.1 — the source laid out as a thumbnail track with
// the trim window sitting on it. Replaces "type a number and render to find out"
// with looking at the footage (Plan §1.1).
//
// Design Ref: §1.3 — `reconcileTrim` slides a fixed-length window, so the window
// here has a fixed width and only moves. When the source cannot fill the section
// it covers the whole track and stops moving (FR-S05).
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import {
  maxTrimInMs,
  nearestSampleIndex,
  trimInFromRatio,
  windowBoundsRatio,
} from '../../domain/timeline/trimWindow';
import type {FrameSampler} from '../../domain/ports';
import {formatSeconds} from './inspectorFields';
import {STRIP_CELL_COUNT, useTrimThumbnails} from './useTrimThumbnails';

/** Large enough to judge framing on, unlike the strip cells (D-D06). */
const PREVIEW_MAX_EDGE = 480;

const KEY_STEP_MS = 100;
const KEY_STEP_LARGE_MS = 1000;

export interface TrimStripProps {
  disabled: boolean;
  inMs: number;
  sampler: FrameSampler;
  sectionDurationMs: number;
  sourceDurationMs: number;
  /** Cache key for the thumbnails. Null while the source is unresolved. */
  sourceId: string | null;
  testIdPrefix: string;
  url: string | null;
  onCommit: (inMs: number) => void;
}

export const TrimStrip = ({
  disabled,
  inMs,
  sampler,
  sectionDurationMs,
  sourceDurationMs,
  sourceId,
  testIdPrefix,
  url,
  onCommit,
}: TrimStripProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragInMs, setDragInMs] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const {thumbnails, failed} = useTrimThumbnails(
    sampler,
    url,
    sourceId,
    sourceDurationMs,
    !disabled,
  );

  const maxInMs = maxTrimInMs(sourceDurationMs, sectionDurationMs);
  // Nothing to choose means nothing to drag (FR-S05).
  const locked = maxInMs <= 0;
  const activeInMs = dragInMs ?? inMs;
  const {startRatio, widthRatio} = windowBoundsRatio(
    activeInMs,
    sourceDurationMs,
    sectionDurationMs,
  );

  // Design Ref: §5.1 — while dragging, the nearest strip cell stands in for the
  // exact frame; the real one is fetched once the pointer is released.
  const approximate = thumbnails[
    nearestSampleIndex(activeInMs, sourceDurationMs, STRIP_CELL_COUNT)
  ];

  useEffect(() => {
    if (disabled || !url || sourceDurationMs <= 0) {
      return;
    }

    const controller = new AbortController();

    void sampler.sample({
      url,
      timesMs: [Math.min(inMs, Math.max(0, sourceDurationMs - 1))],
      maxEdge: PREVIEW_MAX_EDGE,
      needsPixels: false,
      signal: controller.signal,
      onFrame: (frame) => setPreview(frame.thumbnail),
    });

    return () => controller.abort();
  }, [disabled, inMs, sampler, sourceDurationMs, url]);

  const msFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;

      if (!track) {
        return inMs;
      }

      const bounds = track.getBoundingClientRect();
      // The pointer grabs the window's centre, so the window stays under the
      // cursor instead of starting where the cursor is.
      const ratio =
        (clientX - bounds.left - (bounds.width * widthRatio) / 2) /
        bounds.width;

      return trimInFromRatio(ratio, sourceDurationMs, sectionDurationMs);
    },
    [inMs, sectionDurationMs, sourceDurationMs, widthRatio],
  );

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (locked || disabled) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setDragInMs(msFromClientX(event.clientX));
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) {
      return;
    }

    setDragInMs(msFromClientX(event.clientX));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    draggingRef.current = false;

    const next = msFromClientX(event.clientX);

    setDragInMs(null);
    // Design Ref: §2.2 — one commit per gesture, so the store and autosave are
    // not driven by every pointer event.
    onCommit(next);
  };

  // Day1 Trim UX FR-T08 — the strip is reachable without a pointer, following the
  // timeline boundary handles' arrow-key convention.
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (locked || disabled) {
      return;
    }

    const direction =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (direction === 0) {
      return;
    }

    event.preventDefault();

    const step = event.shiftKey ? KEY_STEP_LARGE_MS : KEY_STEP_MS;

    onCommit(Math.min(Math.max(inMs + step * direction, 0), maxInMs));
  };

  // Design Ref: §6 — a strip that produced nothing degrades to the number field
  // rather than showing an empty frame (FR-T09).
  if (failed || !url || sourceDurationMs <= 0) {
    return null;
  }

  return (
    <div className="trim" data-testid={`${testIdPrefix}-trim-strip`}>
      {preview || approximate ? (
        <img
          alt=""
          className="trim__preview"
          data-testid={`${testIdPrefix}-trim-preview`}
          src={(dragInMs === null ? preview : approximate) ?? undefined}
        />
      ) : null}

      <div className="trim__track" ref={trackRef}>
        {Array.from({length: STRIP_CELL_COUNT}, (_, index) => (
          <span className="trim__cell" key={index}>
            {thumbnails[index] ? <img alt="" src={thumbnails[index]} /> : null}
          </span>
        ))}

        <button
          aria-label="트림 구간"
          aria-valuemax={maxInMs}
          aria-valuemin={0}
          aria-valuenow={activeInMs}
          aria-valuetext={`${formatSeconds(activeInMs)}초`}
          className={`trim__window${locked ? ' trim__window--locked' : ''}`}
          data-testid={`${testIdPrefix}-trim-window`}
          disabled={disabled || locked}
          onKeyDown={handleKeyDown}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="slider"
          style={{
            left: `${startRatio * 100}%`,
            width: `${widthRatio * 100}%`,
          }}
          type="button"
        />
      </div>
    </div>
  );
};
