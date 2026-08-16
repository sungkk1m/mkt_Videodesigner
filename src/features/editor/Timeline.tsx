// Design Ref: §5.5 Timeline — three fixed clips, draggable boundaries that keep the
// total duration invariant, playhead, and click-to-seek.
//
// The timeline also owns the transport (play, skip, timecode) and a zoom control.
// Clipchamp puts both on the timeline rather than under the preview, and at 60s
// the unzoomed track gives ~20px per second, which is too coarse to place a
// boundary at 0.1s precision.
import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import type {Sections} from '../../domain/editor/types';
import {
  boundaryPositionsMs,
  sectionDurationsOf,
  sceneStartsMs,
  sumDurationsMs,
  type BoundaryIndex,
} from '../../domain/timeline/timeline';

const KEYBOARD_STEP_MS = 100;
const KEYBOARD_COARSE_STEP_MS = 1000;
const SKIP_MS = 5000;
const ZOOM_LEVELS = [1, 2, 4, 8] as const;

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

const formatTimecode = (ms: number) => {
  const totalSeconds = Math.max(ms, 0) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
};

/** Keeps roughly one label per 80px so the ruler never crowds at any zoom. */
const tickIntervalMs = (totalMs: number, zoom: number) => {
  const candidates = [500, 1000, 2000, 5000, 10_000];
  const target = totalMs / (zoom * 12);

  return candidates.find((candidate) => candidate >= target) ?? 10_000;
};

const Ruler = ({totalMs, zoom}: {totalMs: number; zoom: number}) => {
  const interval = tickIntervalMs(totalMs, zoom);
  const ticks: ReactNode[] = [];

  for (let ms = 0; ms <= totalMs; ms += interval) {
    const major = ms % (interval * 2) === 0;

    ticks.push(
      <div
        className={`timeline__tick timeline__tick--${major ? 'major' : 'minor'}`}
        key={ms}
        style={{left: `${(ms / totalMs) * 100}%`}}
      >
        {major ? (
          <span className="timeline__tick-label">{(ms / 1000).toFixed(0)}s</span>
        ) : null}
      </div>,
    );
  }

  return (
    <div aria-hidden="true" className="timeline__ruler">
      {ticks}
    </div>
  );
};

export interface TimelineProps {
  /** Day1 Design Ref: §2.1 — the track reads the shared section axis, so it
      works unchanged for any template. */
  sections: Sections;
  selectedId: string;
  currentMs: number;
  totalDurationMs: number;
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  disabled: boolean;
  onSelect: (sectionId: string) => void;
  onSeek: (ms: number) => void;
  onSeekFrame: (frame: number) => void;
  onTogglePlay: () => void;
  onMoveBoundary: (boundary: BoundaryIndex, positionMs: number) => void;
}

export const Timeline = ({
  sections,
  selectedId,
  currentMs,
  totalDurationMs,
  currentFrame,
  totalFrames,
  isPlaying,
  disabled,
  onSelect,
  onSeek,
  onSeekFrame,
  onTogglePlay,
  onMoveBoundary,
}: TimelineProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<BoundaryIndex | null>(null);
  const scrubbingRef = useRef(false);
  const [dragging, setDragging] = useState<BoundaryIndex | null>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1);

  const durations = sectionDurationsOf(sections);
  const totalMs = sumDurationsMs(durations);
  const starts = sceneStartsMs(durations);
  const boundaries = boundaryPositionsMs(durations);

  const msFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return 0;
    }

    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(Math.max(ratio, 0), 1) * totalMs;
  };

  const handleBoundaryPointerDown =
    (boundary: BoundaryIndex) => (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = boundary;
      setDragging(boundary);
    };

  const handleBoundaryPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (draggingRef.current === null) {
      return;
    }
    onMoveBoundary(draggingRef.current, msFromClientX(event.clientX));
  };

  const handleBoundaryPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (draggingRef.current === null) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    draggingRef.current = null;
    setDragging(null);
  };

  const handleBoundaryKeyDown =
    (boundary: BoundaryIndex) => (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) {
        return;
      }

      const step = event.shiftKey ? KEYBOARD_COARSE_STEP_MS : KEYBOARD_STEP_MS;
      const direction =
        event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;

      if (direction === 0) {
        return;
      }

      event.preventDefault();
      onMoveBoundary(boundary, (boundaries[boundary] as number) + step * direction);
    };

  // Scrubbing lives on the ruler strip so it never competes with clip selection
  // or the boundary handles.
  const handleScrubDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubbingRef.current = true;
    onSeek(msFromClientX(event.clientX));
  };

  const handleScrubMove = (event: PointerEvent<HTMLDivElement>) => {
    setHoverMs(msFromClientX(event.clientX));

    if (scrubbingRef.current) {
      onSeek(msFromClientX(event.clientX));
    }
  };

  const handleScrubUp = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    scrubbingRef.current = false;
  };

  const zoomIndex = ZOOM_LEVELS.indexOf(zoom as (typeof ZOOM_LEVELS)[number]);

  return (
    <section
      aria-label="장면 타임라인"
      className={`timeline${collapsed ? ' timeline--collapsed' : ''}`}
    >
      <div className="timeline__bar">
        <div className="timeline__transport">
          <button
            aria-label="5초 뒤로"
            className="timeline__icon"
            onClick={() => onSeek(currentMs - SKIP_MS)}
            title="5초 뒤로"
            type="button"
          >
            ⏪
          </button>
          <button
            aria-label={isPlaying ? '일시정지' : '재생'}
            className="timeline__icon timeline__icon--play"
            data-testid="transport-play"
            onClick={onTogglePlay}
            title={isPlaying ? '일시정지 (Space)' : '재생 (Space)'}
            type="button"
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button
            aria-label="5초 앞으로"
            className="timeline__icon"
            onClick={() => onSeek(currentMs + SKIP_MS)}
            title="5초 앞으로"
            type="button"
          >
            ⏩
          </button>
        </div>

        <span className="timeline__time" data-testid="transport-time">
          {formatTimecode(currentMs)}{' '}
          <span>/ {formatTimecode(totalDurationMs)}</span>
        </span>

        {/* Ruler scrubbing is mouse-only, so this stays as the keyboard and
            screen-reader path to the playhead. */}
        <input
          aria-label="재생 위치"
          className="timeline__seek"
          max={totalFrames - 1}
          min={0}
          onChange={(event) => onSeekFrame(Number(event.target.value))}
          step={1}
          type="range"
          value={Math.min(currentFrame, totalFrames - 1)}
        />

        <span className="timeline__scene">
          {sections.find((section) => section.id === selectedId)?.label ??
            selectedId}{' '}
          선택됨
        </span>

        <div className="timeline__zoom">
          <button
            aria-label="타임라인 축소"
            className="timeline__icon"
            disabled={zoomIndex <= 0}
            onClick={() => setZoom(ZOOM_LEVELS[zoomIndex - 1] ?? 1)}
            title="축소"
            type="button"
          >
            −
          </button>
          <span className="timeline__zoom-level">{zoom}×</span>
          <button
            aria-label="타임라인 확대"
            className="timeline__icon"
            data-testid="timeline-zoom-in"
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            onClick={() =>
              setZoom(ZOOM_LEVELS[zoomIndex + 1] ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 1)
            }
            title="확대"
            type="button"
          >
            ＋
          </button>
          <button
            aria-label="타임라인 맞춤"
            className="timeline__icon"
            onClick={() => setZoom(1)}
            title="전체 맞춤"
            type="button"
          >
            ⤢
          </button>
          <button
            aria-label={collapsed ? '타임라인 펼치기' : '타임라인 접기'}
            className="timeline__icon"
            data-testid="timeline-collapse"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? '펼치기' : '접기'}
            type="button"
          >
            {collapsed ? '⌃' : '⌄'}
          </button>
        </div>
      </div>

      <div className="timeline__scroll">
        <div className="timeline__lane" style={{width: `${zoom * 100}%`}}>
          <div
            onPointerDown={handleScrubDown}
            onPointerLeave={() => setHoverMs(null)}
            onPointerMove={handleScrubMove}
            onPointerUp={handleScrubUp}
          >
            <Ruler totalMs={totalMs} zoom={zoom} />
            {hoverMs === null ? null : (
              <div
                className="timeline__hover"
                style={{left: `${(hoverMs / totalMs) * 100}%`}}
              >
                {formatTimecode(hoverMs)}
              </div>
            )}
          </div>

          <div
            className="timeline__track"
            data-testid="timeline-track"
            ref={trackRef}
          >
            {sections.map((section, index) => (
              <button
                className={`timeline__clip${
                  section.id === selectedId ? ' timeline__clip--active' : ''
                }`}
                data-testid={`timeline-clip-${section.id}`}
                key={section.id}
                onClick={(event) => {
                  onSelect(section.id);
                  onSeek(msFromClientX(event.clientX));
                }}
                // Exact time proportions so clip edges line up with the boundary
                // handles, which are positioned by percentage.
                style={{
                  flex: `0 0 ${(section.durationMs / totalMs) * 100}%`,
                }}
                type="button"
              >
                <span className="timeline__clip-name">{section.label}</span>
                <span
                  className="timeline__clip-duration"
                  data-testid={`timeline-duration-${section.id}`}
                >
                  {formatSeconds(section.durationMs)}
                </span>
                <span className="timeline__clip-range">
                  {(starts[index] as number) / 1000}s –{' '}
                  {((starts[index] as number) + section.durationMs) / 1000}s
                </span>
              </button>
            ))}

            {boundaries.map((positionMs, index) => {
              const boundary = index as BoundaryIndex;

              return (
                <button
                  aria-label={`${sections[boundary].label} 경계`}
                  aria-valuemax={totalMs}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(positionMs)}
                  aria-valuetext={formatSeconds(positionMs)}
                  className={`timeline__boundary${
                    dragging === boundary ? ' timeline__boundary--dragging' : ''
                  }`}
                  data-testid={`timeline-boundary-${boundary}`}
                  disabled={disabled}
                  key={boundary}
                  onKeyDown={handleBoundaryKeyDown(boundary)}
                  onPointerDown={handleBoundaryPointerDown(boundary)}
                  onPointerMove={handleBoundaryPointerMove}
                  onPointerUp={handleBoundaryPointerUp}
                  role="slider"
                  style={{left: `${(positionMs / totalMs) * 100}%`}}
                  tabIndex={disabled ? -1 : 0}
                  type="button"
                >
                  {dragging === boundary ? (
                    <span className="timeline__boundary-chip">
                      {formatSeconds(durations[boundary] as number)} ·{' '}
                      {formatSeconds(durations[boundary + 1] as number)}
                    </span>
                  ) : null}
                </button>
              );
            })}

            <div
              className="timeline__playhead"
              style={{
                left: `${(Math.min(currentMs, totalMs) / totalMs) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
