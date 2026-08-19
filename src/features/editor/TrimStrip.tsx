// Day1 Trim UX Design Ref: §5.1 — the source laid out as a thumbnail track with
// the trim window sitting on it. Replaces "type a number and render to find out"
// with looking at the footage (Plan §1.1).
//
// Design Ref: §1.3 — `reconcileTrim` slides a fixed-length window, so the window
// here has a fixed width and only moves. When the source cannot fill the section
// it covers the whole track and stops moving (FR-S05).
//
// day1-trim-preview FR-01..FR-07 — the window is drawn with a minimum visual
// width so a long source still reads as a range, a commit plays the chosen
// interval once in the preview (click toggles play/pause), and an optional
// out-handle makes the window length itself adjustable (end card).
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import {
  maxTrimInMs,
  nearestSampleIndex,
  trimInFromRatio,
  trimWindowMs,
  windowBoundsRatio,
} from '../../domain/timeline/trimWindow';
import type {MediaTransform} from '../../domain/editor/types';
import type {FrameSampler} from '../../domain/ports';
import {formatSeconds} from './inspectorFields';
import {STRIP_CELL_COUNT, useTrimThumbnails} from './useTrimThumbnails';

/** Large enough to judge framing on, unlike the strip cells (D-D06). */
const PREVIEW_MAX_EDGE = 480;

const KEY_STEP_MS = 100;
const KEY_STEP_LARGE_MS = 1000;

/** FR-01 — a 6s window on a 400s source is ~1% of the track; never thinner. */
const MIN_WINDOW_PX = 34;

/** Playing is compared a frame early so the loop seam never shows a stray frame. */
const PLAYBACK_EPSILON_MS = 20;

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
  /** FR-05 — present only when the window length itself is adjustable. */
  onCommitLength?: (lengthMs: number) => void;
  minLengthMs?: number;
  maxLengthMs?: number;
  /** FR-07 — playback runs this long, looping the window to fill it. Defaults
      to the window itself (play once, no loop). */
  playbackSlotMs?: number;
  /** day1-video — the shape and framing the source will actually be rendered
      into. Given it, the stage takes that shape and the media is cropped the way
      the composition crops it, so the preview answers "what will this look
      like". Absent, the whole source is letterboxed at 16:9. */
  framing?: {
    /** width / height of the slot the source lands in. */
    aspectRatio: number;
    transform: MediaTransform;
  };
  /** day1-video — mirrors the composition's blurred backdrop, so a `contain`
      framing previews against the same fill it will render against. */
  backdrop?: boolean;
}

type PlaybackState = 'idle' | 'playing' | 'paused';

/**
 * FR-02/FR-03/FR-07 — plays [inMs, inMs+windowMs] once per commit, looping the
 * window until `slotMs` is covered, then parks back on the start frame. The
 * resting frame stays the sampled <img>, so the strip's existing contract (the
 * enlarged-frame preview) is untouched.
 */
const useSegmentPlayback = (disabled: boolean) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlaybackState>('idle');
  const rafRef = useRef(0);
  const targetRef = useRef({inMs: 0, windowMs: 0, slotMs: 0, loops: 0});

  const stop = useCallback((parkAtStart: boolean) => {
    cancelAnimationFrame(rafRef.current);

    const video = videoRef.current;

    if (video) {
      video.pause();

      if (parkAtStart) {
        video.currentTime = targetRef.current.inMs / 1000;
      }
    }

    setState('idle');
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const {inMs, windowMs, slotMs} = targetRef.current;
    const positionMs = video.currentTime * 1000 - inMs;
    const playedMs = targetRef.current.loops * windowMs + positionMs;

    if (playedMs >= slotMs - PLAYBACK_EPSILON_MS) {
      stop(true);

      return;
    }

    if (positionMs >= windowMs - PLAYBACK_EPSILON_MS || video.ended) {
      targetRef.current.loops += 1;
      video.currentTime = inMs / 1000;

      if (video.paused) {
        void video.play();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [stop]);

  const play = useCallback(
    (inMs: number, windowMs: number, slotMs: number) => {
      const video = videoRef.current;

      if (!video || disabled || windowMs <= 0) {
        return;
      }

      cancelAnimationFrame(rafRef.current);
      targetRef.current = {inMs, windowMs, slotMs, loops: 0};
      video.currentTime = inMs / 1000;
      void video.play().then(
        () => {
          setState('playing');
          rafRef.current = requestAnimationFrame(tick);
        },
        // Autoplay rejection just leaves the sampled frame in place.
        () => setState('idle'),
      );
    },
    [disabled, tick],
  );

  const toggle = useCallback(
    (inMs: number, windowMs: number, slotMs: number) => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      if (state === 'playing') {
        cancelAnimationFrame(rafRef.current);
        video.pause();
        setState('paused');

        return;
      }

      if (state === 'paused') {
        void video.play().then(() => {
          setState('playing');
          rafRef.current = requestAnimationFrame(tick);
        });

        return;
      }

      play(inMs, windowMs, slotMs);
    },
    [play, state, tick],
  );

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return {videoRef, state, play, toggle, stop};
};

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
  onCommitLength,
  minLengthMs = KEY_STEP_LARGE_MS / 2,
  maxLengthMs,
  playbackSlotMs,
  framing,
  backdrop = false,
}: TrimStripProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const [dragInMs, setDragInMs] = useState<number | null>(null);
  const [dragLenMs, setDragLenMs] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const {thumbnails, failed} = useTrimThumbnails(
    sampler,
    url,
    sourceId,
    sourceDurationMs,
    !disabled,
  );

  const activeSectionMs = dragLenMs ?? sectionDurationMs;
  const maxInMs = maxTrimInMs(sourceDurationMs, activeSectionMs);
  // Nothing to choose means nothing to drag (FR-S05).
  const locked = maxInMs <= 0;
  const activeInMs = dragInMs ?? inMs;
  const windowMs = trimWindowMs(sourceDurationMs, activeSectionMs);
  const {startRatio, widthRatio} = windowBoundsRatio(
    activeInMs,
    sourceDurationMs,
    activeSectionMs,
  );
  const slotMs = playbackSlotMs ?? windowMs;

  const {videoRef, state, play, toggle, stop} = useSegmentPlayback(disabled);

  // A trim changed by anything other than our own commit (the number field,
  // relinking) invalidates a run in flight — park it silently.
  const playbackKeyRef = useRef({inMs: -1, windowMs: -1});

  useEffect(() => {
    const key = playbackKeyRef.current;

    if (
      state !== 'idle' &&
      (key.inMs !== inMs || key.windowMs !== windowMs)
    ) {
      stop(true);
    }
  }, [inMs, state, stop, windowMs]);

  const playCommitted = useCallback(
    (nextInMs: number, nextWindowMs: number) => {
      playbackKeyRef.current = {inMs: nextInMs, windowMs: nextWindowMs};
      play(
        nextInMs,
        nextWindowMs,
        Math.max(playbackSlotMs ?? nextWindowMs, nextWindowMs),
      );
    },
    [play, playbackSlotMs],
  );

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

  // Design Ref: §5.1 — while dragging, the nearest strip cell stands in for the
  // exact frame; the real one is fetched once the pointer is released.
  const approximate = thumbnails[
    nearestSampleIndex(activeInMs, sourceDurationMs, STRIP_CELL_COUNT)
  ];

  /** The window's on-screen width, which FR-01 keeps from collapsing. */
  const visualWindowPx = useCallback(() => {
    const track = trackRef.current;

    if (!track) {
      return MIN_WINDOW_PX;
    }

    return Math.max(
      track.getBoundingClientRect().width * widthRatio,
      MIN_WINDOW_PX,
    );
  }, [widthRatio]);

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
        (clientX - bounds.left - visualWindowPx() / 2) / bounds.width;

      return trimInFromRatio(ratio, sourceDurationMs, activeSectionMs);
    },
    [activeSectionMs, inMs, sourceDurationMs, visualWindowPx],
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
    // FR-02 — the release is the moment the chosen interval plays once.
    playCommitted(next, windowMs);
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

  /** FR-05 — the out-handle's length from a pointer position, clamped. */
  const lengthFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;

      if (!track || sourceDurationMs <= 0) {
        return sectionDurationMs;
      }

      const bounds = track.getBoundingClientRect();
      const pointMs =
        ((clientX - bounds.left) / bounds.width) * sourceDurationMs;
      const cap = Math.min(
        maxLengthMs ?? sectionDurationMs,
        sourceDurationMs - inMs,
      );

      return Math.round(
        Math.min(Math.max(pointMs - inMs, minLengthMs), Math.max(cap, minLengthMs)),
      );
    },
    [inMs, maxLengthMs, minLengthMs, sectionDurationMs, sourceDurationMs],
  );

  const handleLengthPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizingRef.current = true;
    setDragLenMs(lengthFromClientX(event.clientX));
  };

  const handleLengthPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizingRef.current) {
      return;
    }

    setDragLenMs(lengthFromClientX(event.clientX));
  };

  const handleLengthPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizingRef.current) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    resizingRef.current = false;

    const next = lengthFromClientX(event.clientX);

    setDragLenMs(null);
    onCommitLength?.(next);
    // FR-07 — a length commit also demos the slot, loop included.
    playCommitted(inMs, trimWindowMs(sourceDurationMs, next));
  };

  const handleLengthKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    const direction =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (direction === 0) {
      return;
    }

    event.preventDefault();

    const step = event.shiftKey ? KEY_STEP_LARGE_MS : KEY_STEP_MS;
    const cap = Math.min(
      maxLengthMs ?? sectionDurationMs,
      Math.max(sourceDurationMs - inMs, minLengthMs),
    );

    onCommitLength?.(
      Math.min(Math.max(sectionDurationMs + step * direction, minLengthMs), cap),
    );
  };

  // Design Ref: §6 — a strip that produced nothing degrades to the number field
  // rather than showing an empty frame (FR-T09).
  if (failed || !url || sourceDurationMs <= 0) {
    return null;
  }

  const restingFrame = dragInMs === null ? preview : approximate;
  const videoActive = state !== 'idle';
  // day1-video — the same declaration `SplitFrame`'s `Panel` builds (Day1 Design
  // Ref §5.2), so the preview and the render crop identically. `cover` overrides
  // the stylesheet's `contain`, which is what letterboxed the whole source.
  const mediaStyle: CSSProperties | undefined = framing
    ? {
        objectFit: framing.transform.fit,
        transform:
          `translate(${framing.transform.x}%, ${framing.transform.y}%)` +
          ` scale(${framing.transform.scale})`,
      }
    : undefined;
  // CSS min()/max() keep the window inside the track when the minimum width
  // engages near the right edge (FR-01).
  const windowWidthCss = `max(${widthRatio * 100}%, ${MIN_WINDOW_PX}px)`;
  const windowLeftCss = `min(${startRatio * 100}%, calc(100% - ${windowWidthCss}))`;

  return (
    <div className="trim" data-testid={`${testIdPrefix}-trim-strip`}>
      <button
        aria-label={videoActive && state === 'playing' ? '일시정지' : '구간 재생'}
        className="trim__stage"
        data-testid={`${testIdPrefix}-trim-playtoggle`}
        disabled={disabled}
        onClick={() => toggle(inMs, windowMs, Math.max(slotMs, windowMs))}
        style={framing ? {aspectRatio: framing.aspectRatio} : undefined}
        type="button"
      >
        {/* The composition holds one frame behind the source, so the backdrop
            here is the resting frame — the same frame, blurred (SplitFrame). */}
        {backdrop && restingFrame ? (
          <img
            alt=""
            className="trim__backdrop"
            data-testid={`${testIdPrefix}-trim-backdrop`}
            src={restingFrame}
          />
        ) : null}

        {/* Muted by design — the project audio track owns the mix. */}
        <video
          className={`trim__video${videoActive ? '' : ' trim__video--hidden'}`}
          data-testid={`${testIdPrefix}-trim-video`}
          muted
          playsInline
          preload="metadata"
          ref={videoRef}
          src={url}
          style={mediaStyle}
        />
        {restingFrame ? (
          <img
            alt=""
            className={`trim__preview${videoActive ? ' trim__preview--under' : ''}`}
            data-testid={`${testIdPrefix}-trim-preview`}
            src={restingFrame}
            style={mediaStyle}
          />
        ) : null}
      </button>

      <div className="trim__track" ref={trackRef}>
        <div className="trim__cells">
          {Array.from({length: STRIP_CELL_COUNT}, (_, index) => (
            <span className="trim__cell" key={index}>
              {thumbnails[index] ? <img alt="" src={thumbnails[index]} /> : null}
            </span>
          ))}
        </div>

        <div
          className="trim__windowbox"
          style={{left: windowLeftCss, width: windowWidthCss}}
        >
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
            type="button"
          >
            <span aria-hidden className="trim__grip trim__grip--l" />
            {onCommitLength ? null : (
              <span aria-hidden className="trim__grip trim__grip--r" />
            )}
            {/* FR-01 — the range names its own length. */}
            <span aria-hidden className="trim__len">
              {formatSeconds(windowMs).replace(/0$/, '')}s
            </span>
          </button>

          {onCommitLength ? (
            <button
              aria-label="구간 길이"
              aria-valuemax={Math.min(
                maxLengthMs ?? sectionDurationMs,
                Math.max(sourceDurationMs, minLengthMs),
              )}
              aria-valuemin={minLengthMs}
              aria-valuenow={windowMs}
              aria-valuetext={`${formatSeconds(windowMs)}초`}
              className="trim__lenhandle"
              data-testid={`${testIdPrefix}-trim-length`}
              disabled={disabled}
              onKeyDown={handleLengthKeyDown}
              onPointerCancel={handleLengthPointerUp}
              onPointerDown={handleLengthPointerDown}
              onPointerMove={handleLengthPointerMove}
              onPointerUp={handleLengthPointerUp}
              role="slider"
              type="button"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
