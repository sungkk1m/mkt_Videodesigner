// kv-object-animation Design Ref: §4.2 — the effect layer, redrawn every frame
// from the pure functions. The domain returns states (conventions §1); this is
// the one place they become pixels, shared by the composition and the M0
// harness so the render path and the scrub equivalent draw through one door.
import {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

import type {KvEffect} from '../../domain/editor/types';
import {kvGlowOpacityAt, kvParticlesAt} from '../../domain/kvloop/effects';

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * Draws one frame of every effect on the slot. Additive compositing — embers
 * and halos are light, so overlapping effects brighten rather than occlude.
 * The glow gradient reaches alpha 0 at its radius and contributes nothing
 * beyond it, which is SC1's boundary drawn literally.
 */
export const drawKvEffects = (
  canvas: HTMLCanvasElement,
  effects: readonly KvEffect[],
  frame: number,
  fps: number,
): void => {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';

  for (const effect of effects) {
    if (effect.kind === 'glow') {
      const opacity = kvGlowOpacityAt(effect, frame, fps);
      const [r, g, b] = hexToRgb(effect.color);
      const cx = effect.center.x * w;
      const cy = effect.center.y * h;
      // Fraction of frame width (§2.1) — stable because the canvas is always
      // the composition's own resolution.
      const radiusPx = effect.radius * w;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPx, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.fillStyle = effect.color;
      for (const particle of kvParticlesAt(effect, frame, fps)) {
        ctx.globalAlpha = particle.opacity;
        ctx.beginPath();
        ctx.arc(
          particle.x * w,
          particle.y * h,
          particle.sizePx / 2,
          0,
          2 * Math.PI,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.globalCompositeOperation = 'source-over';
};

export interface KvEffectsCanvasProps {
  effects: readonly KvEffect[];
  /** The key visual's own transform string — sharing it IS the camera follow
   * (D-04): two elements in the same layout box under the same transform are
   * one coordinate space. */
  transform: string;
}

export const KvEffectsCanvas = ({effects, transform}: KvEffectsCanvasProps) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  // Commit-synchronous, before paint — M0 gate ⑤ proved the renderer's
  // snapshot captures this drawing (Design §4.3), so no delayRender is needed.
  useLayoutEffect(() => {
    if (ref.current) {
      drawKvEffects(ref.current, effects, frame, fps);
    }
  }, [effects, frame, fps]);

  return (
    <canvas
      data-testid="kv-effects-canvas"
      height={height}
      ref={ref}
      style={{width: '100%', height: '100%', transform}}
      width={width}
    />
  );
};
