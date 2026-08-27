// kv-object-animation Design Ref: §7.1 — the closed form, judged as one.
// Determinism, reach, the meaning of zero, periodicity, and the fps contract
// are all properties of the same arithmetic, so they live in one file.
import {describe, expect, it} from 'vitest';

import type {KvGlowEffect, KvParticlesEffect} from '../editor/types';
import {
  clampKvEffectRegion,
  kvGlowOpacityAt,
  kvHash01,
  kvParticlesAt,
  kvParticlesReach,
} from './effects';

const particles = (
  overrides: Partial<KvParticlesEffect> = {},
): KvParticlesEffect => ({
  kind: 'particles',
  id: 'effect_test',
  seed: 0xc0ffee,
  region: {x: 0.3, y: 0.55, width: 0.4, height: 0.2},
  color: '#ffb14a',
  density: 0.5,
  speed: 0.5,
  sizePx: 6,
  ...overrides,
});

const glow = (overrides: Partial<KvGlowEffect> = {}): KvGlowEffect => ({
  kind: 'glow',
  id: 'effect_test',
  center: {x: 0.5, y: 0.62},
  radius: 0.18,
  color: '#ff9a3c',
  intensity: 0.6,
  periodMs: 1500,
  ...overrides,
});

describe('kvHash01', () => {
  it('is a pure function of its lanes, inside [0, 1)', () => {
    expect(kvHash01(1, 2, 3)).toBe(kvHash01(1, 2, 3));
    expect(kvHash01(1, 2, 3)).not.toBe(kvHash01(2, 2, 3));
    expect(kvHash01(1, 2, 3)).not.toBe(kvHash01(1, 3, 2));

    for (let lane = 0; lane < 200; lane += 1) {
      const value = kvHash01(0xc0ffee, lane);

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('kvParticlesAt', () => {
  it('returns the identical state for the identical inputs — FR-O04', () => {
    expect(kvParticlesAt(particles(), 123, 60)).toEqual(
      kvParticlesAt(particles(), 123, 60),
    );
  });

  it('moves every particle when the seed changes', () => {
    const a = kvParticlesAt(particles(), 123, 60);
    const b = kvParticlesAt(particles({seed: 0xdecaf}), 123, 60);

    expect(a.length).toBe(b.length);
    expect(a).not.toEqual(b);
  });

  it('keeps every particle of every frame inside the reach — SC1', () => {
    const effect = particles({speed: 1});
    const reach = kvParticlesReach(effect);

    for (const frame of [0, 7, 60, 149, 450, 899]) {
      for (const state of kvParticlesAt(effect, frame, 60)) {
        expect(state.x).toBeGreaterThanOrEqual(reach.x);
        expect(state.x).toBeLessThanOrEqual(reach.x + reach.width);
        expect(state.y).toBeGreaterThanOrEqual(reach.y);
        expect(state.y).toBeLessThanOrEqual(reach.y + reach.height);
        expect(state.opacity).toBeGreaterThanOrEqual(0);
        expect(state.opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('means off at density zero', () => {
    expect(kvParticlesAt(particles({density: 0}), 123, 60)).toEqual([]);
  });

  it('holds the same real-time state across 30 and 60fps — §3.4', () => {
    // Frame 45 at 30fps and frame 90 at 60fps are the same 1.5 seconds.
    expect(kvParticlesAt(particles(), 45, 30)).toEqual(
      kvParticlesAt(particles(), 90, 60),
    );
  });
});

describe('kvGlowOpacityAt', () => {
  it('repeats exactly one period later — FR-O03', () => {
    // 1500ms at 60fps is 90 frames.
    expect(kvGlowOpacityAt(glow(), 17, 60)).toBeCloseTo(
      kvGlowOpacityAt(glow(), 17 + 90, 60),
      12,
    );
  });

  it('means off at intensity zero and stays within [0, intensity]', () => {
    expect(kvGlowOpacityAt(glow({intensity: 0}), 30, 60)).toBe(0);

    for (let frame = 0; frame < 120; frame += 7) {
      const opacity = kvGlowOpacityAt(glow(), frame, 60);

      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(0.6);
    }
  });
});

describe('clampKvEffectRegion', () => {
  it('folds an out-of-bounds drag back inside the frame', () => {
    expect(clampKvEffectRegion({x: 0.9, y: -2, width: 0.5, height: 9})).toEqual(
      {x: 0.5, y: 0, width: 0.5, height: 1},
    );
    expect(
      clampKvEffectRegion({x: 0.2, y: 0.2, width: 0, height: 0}).width,
    ).toBeGreaterThan(0);
  });
});
