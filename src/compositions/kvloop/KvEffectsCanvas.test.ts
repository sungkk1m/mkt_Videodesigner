// kv-object-animation M2 — the drawing seam between the domain's states and
// the canvas. jsdom has no 2D context, so a recording stand-in receives the
// calls; what the pixels look like is M0-harness and real-device territory,
// what is *asked* of the context — where, how big, how opaque — is judged here.
import {describe, expect, it} from 'vitest';

import type {
  KvGlowEffect,
  KvParticlesEffect,
} from '../../domain/editor/types';
import {kvGlowOpacityAt, kvParticlesAt} from '../../domain/kvloop/effects';
import {drawKvEffects} from './KvEffectsCanvas';

const PARTICLES: KvParticlesEffect = {
  kind: 'particles',
  id: 'effect_p',
  seed: 42,
  region: {x: 0.3, y: 0.55, width: 0.4, height: 0.2},
  color: '#ffb14a',
  density: 0.5,
  speed: 0.5,
  sizePx: 6,
};

const GLOW: KvGlowEffect = {
  kind: 'glow',
  id: 'effect_g',
  center: {x: 0.5, y: 0.62},
  radius: 0.18,
  color: '#ff9a3c',
  intensity: 0.6,
  periodMs: 1500,
};

const W = 1080;
const H = 1920;
const FPS = 30;

/** Records every drawing call, with the alpha each arc was filled at. */
const recordingCanvas = () => {
  const log: unknown[][] = [];
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '' as unknown,
    clearRect: (...args: number[]) => log.push(['clearRect', ...args]),
    createRadialGradient: (...args: number[]) => {
      log.push(['gradient', ...args]);

      return {
        addColorStop: (offset: number, color: string) =>
          log.push(['stop', offset, color]),
      };
    },
    beginPath: () => {},
    arc: (x: number, y: number, r: number) =>
      log.push(['arc', x, y, r, ctx.globalAlpha]),
    fill: () => {},
  };
  const canvas = {
    width: W,
    height: H,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;

  return {canvas, ctx, log};
};

describe('drawKvEffects', () => {
  it('draws every particle exactly where the domain put it (FR-O02)', () => {
    const {canvas, log} = recordingCanvas();
    drawKvEffects(canvas, [PARTICLES], 20, FPS);

    const arcs = log.filter(([name]) => name === 'arc');
    const states = kvParticlesAt(PARTICLES, 20, FPS);

    expect(arcs).toHaveLength(states.length);
    states.forEach((state, index) => {
      expect(arcs[index]).toEqual([
        'arc',
        state.x * W,
        state.y * H,
        state.sizePx / 2,
        state.opacity,
      ]);
    });
  });

  it('centres the glow gradient and ends it at alpha 0 (SC1 boundary)', () => {
    const {canvas, log} = recordingCanvas();
    drawKvEffects(canvas, [GLOW], 20, FPS);

    // Radius is a fraction of frame width (§2.1), both on the gradient and on
    // the arc that fills it.
    expect(log).toContainEqual([
      'gradient',
      0.5 * W,
      0.62 * H,
      0,
      0.5 * W,
      0.62 * H,
      0.18 * W,
    ]);
    expect(log).toContainEqual(['arc', 0.5 * W, 0.62 * H, 0.18 * W, 1]);

    const stops = log.filter(([name]) => name === 'stop');
    const opacity = kvGlowOpacityAt(GLOW, 20, FPS);

    expect(stops).toEqual([
      ['stop', 0, `rgba(255, 154, 60, ${opacity})`],
      ['stop', 1, 'rgba(255, 154, 60, 0)'],
    ]);
  });

  it('asks the same drawing twice for the same frame (FR-O04)', () => {
    const first = recordingCanvas();
    const second = recordingCanvas();
    drawKvEffects(first.canvas, [PARTICLES, GLOW], 37, FPS);
    drawKvEffects(second.canvas, [PARTICLES, GLOW], 37, FPS);

    expect(first.log).toEqual(second.log);
  });

  it('clears before drawing and hands the context back neutral', () => {
    const {canvas, ctx, log} = recordingCanvas();
    drawKvEffects(canvas, [PARTICLES, GLOW], 5, FPS);

    expect(log[0]).toEqual(['clearRect', 0, 0, W, H]);
    // Additive while compositing light, restored so a reused context cannot
    // leak 'lighter' into whoever draws next.
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });
});
