// kv-object-animation Design Ref: §5.2 — the selected effect's designation,
// drawn on the preview instead of typed as numbers.
//
// Follows KvMotionOverlay's structure (pointer capture, local draft, commit on
// release) but draws ONE effect — the list can be long, and only the one being
// edited should be visible. Coordinates are frame fractions (0-1), the same
// space the schema stores, and the overlay ignores the camera transform — the
// same convention the camera rectangles set.
import {useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';

import type {KvEffectPatch} from '../../domain/editor/project';
import {
  MIN_KV_EFFECT_SPAN,
  type KvEffect,
  type KvEffectRegion,
} from '../../domain/editor/types';
import {clampKvEffectRegion} from '../../domain/kvloop/effects';

type Mode = 'move' | 'resize';

/** The two shapes a designation takes — a particles rect, a glow disc. */
type Draft =
  | {kind: 'particles'; region: KvEffectRegion}
  | {kind: 'glow'; center: {x: number; y: number}; radius: number};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface KvEffectOverlayProps {
  effect: KvEffect;
  disabled: boolean;
  onChange: (patch: KvEffectPatch) => void;
}

export const KvEffectOverlay = ({
  effect,
  disabled,
  onChange,
}: KvEffectOverlayProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: Mode;
    pointerX: number;
    pointerY: number;
    draft: Draft;
  } | null>(null);
  // Held locally until release, like the camera overlay: committing every move
  // would debounce autosave for the whole gesture and re-render the Player.
  const [draft, setDraft] = useState<Draft | null>(null);

  const current: Draft =
    draft ??
    (effect.kind === 'particles'
      ? {kind: 'particles', region: effect.region}
      : {kind: 'glow', center: effect.center, radius: effect.radius});

  const normalise = (event: ReactPointerEvent) => {
    const box = frameRef.current?.getBoundingClientRect();

    if (!box || box.width === 0 || box.height === 0) {
      return null;
    }

    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  };

  const start = (mode: Mode) => (event: ReactPointerEvent) => {
    if (disabled) {
      return;
    }

    const point = normalise(event);

    if (!point) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      pointerX: point.x,
      pointerY: point.y,
      draft: current,
    };
    setDraft(current);
  };

  const move = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    const point = drag ? normalise(event) : null;

    if (!drag || !point) {
      return;
    }

    const dx = point.x - drag.pointerX;
    const dy = point.y - drag.pointerY;
    const from = drag.draft;

    if (from.kind === 'particles') {
      // Free aspect (§2.1) — the emission area has no square constraint, so
      // the handle resizes both axes, unlike the camera's single-axis rule.
      setDraft({
        kind: 'particles',
        region: clampKvEffectRegion(
          drag.mode === 'move'
            ? {...from.region, x: from.region.x + dx, y: from.region.y + dy}
            : {
                ...from.region,
                width: from.region.width + dx,
                height: from.region.height + dy,
              },
        ),
      });
    } else {
      setDraft(
        drag.mode === 'move'
          ? {
              ...from,
              center: {
                x: clamp01(from.center.x + dx),
                y: clamp01(from.center.y + dy),
              },
            }
          : // Radius is a fraction of frame width, so the handle's horizontal
            // distance from the centre IS the value.
            {
              ...from,
              radius: Math.min(
                1,
                Math.max(MIN_KV_EFFECT_SPAN, from.radius + dx),
              ),
            },
      );
    }
  };

  const end = (event: ReactPointerEvent) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;

    if (draft) {
      onChange(
        draft.kind === 'particles'
          ? {region: draft.region}
          : drag.mode === 'move'
            ? {center: draft.center}
            : {radius: draft.radius},
      );
    }

    setDraft(null);
  };

  return (
    <div className="kv-effect" data-testid="kv-effect-overlay" ref={frameRef}>
      {current.kind === 'particles' ? (
        <div
          className="kv-effect__region"
          data-testid="kv-effect-region"
          onPointerCancel={end}
          onPointerDown={start('move')}
          onPointerMove={move}
          onPointerUp={end}
          style={{
            left: `${current.region.x * 100}%`,
            top: `${current.region.y * 100}%`,
            width: `${current.region.width * 100}%`,
            height: `${current.region.height * 100}%`,
          }}
        >
          <span className="kv-effect__label">파티클 영역</span>
          <span
            className="kv-effect__handle"
            data-testid="kv-effect-region-handle"
            onPointerCancel={end}
            onPointerDown={start('resize')}
            onPointerMove={move}
            onPointerUp={end}
          />
        </div>
      ) : (
        <div
          className="kv-effect__glow"
          data-testid="kv-effect-center"
          onPointerCancel={end}
          onPointerDown={start('move')}
          onPointerMove={move}
          onPointerUp={end}
          style={{
            left: `${(current.center.x - current.radius) * 100}%`,
            top: `${current.center.y * 100}%`,
            width: `${current.radius * 2 * 100}%`,
          }}
        >
          <span className="kv-effect__label">글로우</span>
          <span className="kv-effect__dot" />
          <span
            className="kv-effect__handle kv-effect__handle--radius"
            data-testid="kv-effect-radius-handle"
            onPointerCancel={end}
            onPointerDown={start('resize')}
            onPointerMove={move}
            onPointerUp={end}
          />
        </div>
      )}
    </div>
  );
};
