// kv-motion-effects Design Ref: §6.2 — the camera's start and end, drawn on the
// preview instead of typed as numbers.
//
// The rectangles are in frame coordinates (0-1), so this never needs to know the
// output resolution and a stored pair stays valid at any size. Every edit passes
// through `clampKvRect`, which is what keeps a drag at the edge from producing a
// camera that looks past the picture.
import {useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';

import type {KvRect} from '../../domain/editor/types';
import {clampKvRect} from '../../domain/kvloop/motion';

type Which = 'from' | 'to';

interface Drag {
  which: Which;
  mode: 'move' | 'resize';
  pointerX: number;
  pointerY: number;
  rect: KvRect;
}

const LABELS: Record<Which, string> = {from: '시작', to: '끝'};

export interface KvMotionOverlayProps {
  from: KvRect;
  to: KvRect;
  disabled: boolean;
  onChange: (which: Which, rect: KvRect) => void;
}

export const KvMotionOverlay = ({
  from,
  to,
  disabled,
  onChange,
}: KvMotionOverlayProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  /**
   * The rectangle being dragged, held locally until the pointer is released.
   * Writing to the project on every move would run the autosave debounce for the
   * whole gesture and re-render the Player each frame of it.
   */
  const [draft, setDraft] = useState<{which: Which; rect: KvRect} | null>(null);

  const rects: Record<Which, KvRect> = {
    from: draft?.which === 'from' ? draft.rect : from,
    to: draft?.which === 'to' ? draft.rect : to,
  };

  /** Pointer position as a fraction of the frame, which is the rects' own unit. */
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

  const start =
    (which: Which, mode: Drag['mode']) => (event: ReactPointerEvent) => {
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
        which,
        mode,
        pointerX: point.x,
        pointerY: point.y,
        rect: rects[which],
      };
      setDraft({which, rect: rects[which]});
    };

  const move = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    const point = drag ? normalise(event) : null;

    if (!drag || !point) {
      return;
    }

    const dx = point.x - drag.pointerX;
    const dy = point.y - drag.pointerY;

    setDraft({
      which: drag.which,
      rect: clampKvRect(
        drag.mode === 'move'
          ? {...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy}
          : // One axis drives the size: the region is always the frame's own
            // aspect (§2.3), so reading both would fight itself.
            {...drag.rect, size: drag.rect.size + dx},
      ),
    });
  };

  const end = (event: ReactPointerEvent) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;

    if (draft) {
      onChange(draft.which, draft.rect);
    }

    setDraft(null);
  };

  return (
    <div className="kv-motion" data-testid="kv-motion-overlay" ref={frameRef}>
      {(['from', 'to'] as Which[]).map((which) => {
        const rect = rects[which];

        return (
          <div
            className={`kv-motion__rect kv-motion__rect--${which}`}
            data-testid={`kv-motion-${which}`}
            key={which}
            onPointerCancel={end}
            onPointerDown={start(which, 'move')}
            onPointerMove={move}
            onPointerUp={end}
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.size * 100}%`,
              height: `${rect.size * 100}%`,
            }}
          >
            <span className="kv-motion__label">{LABELS[which]}</span>
            <span
              className="kv-motion__handle"
              data-testid={`kv-motion-${which}-handle`}
              onPointerCancel={end}
              onPointerDown={start(which, 'resize')}
              onPointerMove={move}
              onPointerUp={end}
            />
          </div>
        );
      })}
    </div>
  );
};
