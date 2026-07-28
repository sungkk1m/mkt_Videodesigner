// Design Ref: §5.5 Timeline — three fixed clips, draggable boundaries that keep the
// total duration invariant, playhead, and click-to-seek.
import {useRef, type KeyboardEvent, type PointerEvent} from 'react';

import {
  SCENE_LABELS,
  type EditorScenes,
  type SceneKind,
} from '../../domain/editor/types';
import {
  boundaryPositionsMs,
  sceneDurationsOf,
  sceneStartsMs,
  sumDurationsMs,
  type BoundaryIndex,
} from '../../domain/timeline/timeline';

const KEYBOARD_STEP_MS = 100;
const KEYBOARD_COARSE_STEP_MS = 1000;

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

export interface TimelineProps {
  scenes: EditorScenes;
  selectedKind: SceneKind;
  currentMs: number;
  disabled: boolean;
  onSelect: (kind: SceneKind) => void;
  onSeek: (ms: number) => void;
  onMoveBoundary: (boundary: BoundaryIndex, positionMs: number) => void;
}

export const Timeline = ({
  scenes,
  selectedKind,
  currentMs,
  disabled,
  onSelect,
  onSeek,
  onMoveBoundary,
}: TimelineProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<BoundaryIndex | null>(null);

  const durations = sceneDurationsOf(scenes);
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
    (boundary: BoundaryIndex) => (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = boundary;
    };

  const handleBoundaryPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current === null) {
      return;
    }
    onMoveBoundary(draggingRef.current, msFromClientX(event.clientX));
  };

  const handleBoundaryPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current === null) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    draggingRef.current = null;
  };

  const handleBoundaryKeyDown =
    (boundary: BoundaryIndex) => (event: KeyboardEvent<HTMLDivElement>) => {
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

  return (
    <section aria-label="장면 타임라인" className="timeline">
      <div className="timeline__meta">
        <span>타임라인</span>
        <span>
          {SCENE_LABELS[selectedKind]} 선택됨 · 전체 {formatSeconds(totalMs)}
        </span>
      </div>

      <div className="timeline__track" data-testid="timeline-track" ref={trackRef}>
        {scenes.map((scene, index) => (
          <button
            className={`timeline__clip${
              scene.kind === selectedKind ? ' timeline__clip--active' : ''
            }`}
            data-testid={`timeline-clip-${scene.kind}`}
            key={scene.kind}
            onClick={(event) => {
              onSelect(scene.kind);
              onSeek(msFromClientX(event.clientX));
            }}
            // Exact time proportions so clip edges line up with the boundary
            // handles, which are positioned by percentage.
            style={{
              flex: `0 0 ${(scene.durationMs / totalMs) * 100}%`,
            }}
            type="button"
          >
            <span className="timeline__clip-name">{SCENE_LABELS[scene.kind]}</span>
            <span
              className="timeline__clip-duration"
              data-testid={`timeline-duration-${scene.kind}`}
            >
              {formatSeconds(scene.durationMs)}
            </span>
            <span className="timeline__clip-range">
              {(starts[index] as number) / 1000}s –{' '}
              {((starts[index] as number) + scene.durationMs) / 1000}s
            </span>
          </button>
        ))}

        {boundaries.map((positionMs, index) => {
          const boundary = index as BoundaryIndex;

          return (
            <div
              aria-label={`${SCENE_LABELS[scenes[boundary].kind]} 경계`}
              aria-valuemax={totalMs}
              aria-valuemin={0}
              aria-valuenow={Math.round(positionMs)}
              aria-valuetext={formatSeconds(positionMs)}
              className="timeline__boundary"
              data-testid={`timeline-boundary-${boundary}`}
              key={boundary}
              onKeyDown={handleBoundaryKeyDown(boundary)}
              onPointerDown={handleBoundaryPointerDown(boundary)}
              onPointerMove={handleBoundaryPointerMove}
              onPointerUp={handleBoundaryPointerUp}
              role="slider"
              style={{left: `${(positionMs / totalMs) * 100}%`}}
              tabIndex={disabled ? -1 : 0}
            />
          );
        })}

        <div
          className="timeline__playhead"
          style={{
            left: `${(Math.min(currentMs, totalMs) / totalMs) * 100}%`,
          }}
        />
      </div>
    </section>
  );
};
