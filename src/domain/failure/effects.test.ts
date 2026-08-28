// failure-video Design §8.1 — the effect functions' boundaries, their
// compression, and the invariants the proxy path depends on (§7.4 / D-10).
import {describe, expect, it} from 'vitest';

import {
  FAILURE_TRANSITION_SCALE,
  FAIL_LEAD_MS,
  FAIL_SHAKE_MS,
  FAIL_STAMP_ENTER_MS,
  FAIL_STAMP_ENTER_SCALE,
  FAIL_STAMP_MS,
  FAIL_STAMP_ROTATE_DEG,
  FAIL_ZOOM_SCALE,
  failShakeAt,
  failStampStyleAt,
  failVideoStyleAt,
  failWindow,
  failureEdgesAt,
  zoomPunchAt,
} from './effects';
import {msToFrames} from '../timeline/timeline';

const FPS = 30;
const ALL_ON = {
  stampEnabled: true,
  zoomEnabled: true,
  desaturateEnabled: true,
  shakeEnabled: true,
  focusX: 0,
  focusY: 0,
};

/** A 5.4s level-1 section, which is what the 30s preset opens on. */
const SECTION_FRAMES = msToFrames(5400, FPS);

describe('failWindow', () => {
  it('anchors the beat to the end of the section', () => {
    const window = failWindow(SECTION_FRAMES, FPS);

    expect(window.stampFrames).toBe(msToFrames(FAIL_STAMP_MS, FPS));
    expect(window.leadFrames).toBe(msToFrames(FAIL_LEAD_MS, FPS));
    expect(window.stampFrame + window.stampFrames).toBe(SECTION_FRAMES);
    expect(window.startFrame).toBe(
      SECTION_FRAMES - window.stampFrames - window.leadFrames,
    );
  });

  // Design D-11 — a short section compresses the beat rather than making the
  // document unparseable. The lead is what gives way; the stamp's second is
  // what the user actually asked for.
  it('compresses the lead first when the section is shorter than the beat', () => {
    const window = failWindow(msToFrames(1200, FPS), FPS);

    expect(window.stampFrames).toBe(msToFrames(FAIL_STAMP_MS, FPS));
    expect(window.leadFrames).toBe(msToFrames(1200, FPS) - window.stampFrames);
    expect(window.startFrame).toBe(0);
  });

  it('keeps the stamp to the end when the section is shorter than the stamp', () => {
    const window = failWindow(10, FPS);

    expect(window).toEqual({
      startFrame: 0,
      stampFrame: 0,
      leadFrames: 0,
      stampFrames: 10,
    });
  });

  it('degrades to an empty beat on a zero-length section', () => {
    expect(failWindow(0, FPS)).toEqual({
      startFrame: 0,
      stampFrame: 0,
      leadFrames: 0,
      stampFrames: 0,
    });
  });
});

describe('failVideoStyleAt', () => {
  const window = failWindow(SECTION_FRAMES, FPS);

  it('draws nothing before the beat opens', () => {
    expect(failVideoStyleAt(window.startFrame - 1, window, ALL_ON)).toBeNull();
    expect(failVideoStyleAt(0, window, ALL_ON)).toBeNull();
  });

  it('eases the zoom and the drain across the lead, then holds them', () => {
    const first = failVideoStyleAt(window.startFrame, window, ALL_ON);
    const last = failVideoStyleAt(window.stampFrame - 1, window, ALL_ON);
    const held = failVideoStyleAt(SECTION_FRAMES - 1, window, ALL_ON);

    expect(first?.scale).toBeGreaterThan(1);
    expect(first?.scale).toBeLessThan(FAIL_ZOOM_SCALE);
    expect(last?.scale).toBeCloseTo(FAIL_ZOOM_SCALE, 5);
    expect(last?.grayscale).toBeCloseTo(1, 5);
    expect(held).toEqual(last);
  });

  it('never scales below 1, which is what makes the source proxy safe (D-10)', () => {
    for (let frame = 0; frame < SECTION_FRAMES; frame += 1) {
      const style = failVideoStyleAt(frame, window, ALL_ON);

      if (style) {
        expect(style.scale).toBeGreaterThanOrEqual(1);
        expect(style.grayscale).toBeGreaterThanOrEqual(0);
        expect(style.grayscale).toBeLessThanOrEqual(1);
      }
    }
  });

  it('leaves a switched-off axis at identity', () => {
    const noZoom = failVideoStyleAt(SECTION_FRAMES - 1, window, {
      ...ALL_ON,
      zoomEnabled: false,
    });
    const noDrain = failVideoStyleAt(SECTION_FRAMES - 1, window, {
      ...ALL_ON,
      desaturateEnabled: false,
    });

    expect(noZoom?.scale).toBe(1);
    expect(noZoom?.grayscale).toBeCloseTo(1, 5);
    expect(noDrain?.grayscale).toBe(0);
    expect(noDrain?.scale).toBeCloseTo(FAIL_ZOOM_SCALE, 5);
  });

  it('returns null when both axes are off, so the frame costs nothing', () => {
    expect(
      failVideoStyleAt(SECTION_FRAMES - 1, window, {
        ...ALL_ON,
        zoomEnabled: false,
        desaturateEnabled: false,
      }),
    ).toBeNull();
  });

  // FR-12 — the dying character is not always centre frame.
  it('folds the focus offset into the transform origin', () => {
    const style = failVideoStyleAt(SECTION_FRAMES - 1, window, {
      ...ALL_ON,
      focusX: -20,
      focusY: 15,
    });

    expect(style).toMatchObject({originX: 30, originY: 65});
    expect(
      failVideoStyleAt(SECTION_FRAMES - 1, window, ALL_ON),
    ).toMatchObject({originX: 50, originY: 50});
  });

  it('lands on the full value immediately when the lead was compressed away', () => {
    const compressed = failWindow(msToFrames(FAIL_STAMP_MS, FPS), FPS);
    const style = failVideoStyleAt(0, compressed, ALL_ON);

    expect(style?.scale).toBeCloseTo(FAIL_ZOOM_SCALE, 5);
    expect(style?.grayscale).toBeCloseTo(1, 5);
  });
});

describe('failStampStyleAt', () => {
  const window = failWindow(SECTION_FRAMES, FPS);

  it('draws nothing outside the stamp window', () => {
    expect(failStampStyleAt(window.stampFrame - 1, window, FPS)).toBeNull();
    expect(
      failStampStyleAt(window.stampFrame + window.stampFrames, window, FPS),
    ).toBeNull();
  });

  it('slams in oversized and translucent, then settles', () => {
    const first = failStampStyleAt(window.stampFrame, window, FPS);
    const enterFrames = msToFrames(FAIL_STAMP_ENTER_MS, FPS);
    const settled = failStampStyleAt(
      window.stampFrame + enterFrames,
      window,
      FPS,
    );

    expect(first?.scale).toBeGreaterThan(1);
    expect(first?.scale).toBeLessThanOrEqual(FAIL_STAMP_ENTER_SCALE);
    expect(first?.opacity).toBeLessThan(1);
    expect(first?.blurRatio).toBeGreaterThan(0);

    expect(settled?.scale).toBeCloseTo(1, 5);
    expect(settled?.opacity).toBeCloseTo(1, 5);
    // Goal 4 — no blur left on a stamp that has landed.
    expect(settled?.blurRatio).toBeCloseTo(0, 5);
  });

  it('holds the measured tilt for every frame it is on screen', () => {
    for (
      let frame = window.stampFrame;
      frame < window.stampFrame + window.stampFrames;
      frame += 1
    ) {
      const style = failStampStyleAt(frame, window, FPS);

      expect(style?.rotateDeg).toBe(FAIL_STAMP_ROTATE_DEG);
      expect(style?.scale).toBeGreaterThanOrEqual(1);
      expect(style?.blurRatio).toBeGreaterThanOrEqual(0);
    }
  });

  it('shrinks the entry to fit a compressed window', () => {
    const compressed = failWindow(4, FPS);
    const landed = failStampStyleAt(3, compressed, FPS);

    expect(landed?.scale).toBeCloseTo(1, 5);
    expect(landed?.opacity).toBeCloseTo(1, 5);
  });
});

describe('failShakeAt', () => {
  const window = failWindow(SECTION_FRAMES, FPS);
  const settleFrame = window.stampFrame + msToFrames(FAIL_STAMP_ENTER_MS, FPS);

  it('starts on the frame the stamp lands, not before', () => {
    expect(failShakeAt(settleFrame - 1, window, FPS)).toBeNull();
    expect(failShakeAt(settleFrame, window, FPS)).not.toBeNull();
  });

  it('ends once the tail has run', () => {
    const shakeFrames = msToFrames(FAIL_SHAKE_MS, FPS);

    expect(failShakeAt(settleFrame + shakeFrames, window, FPS)).toBeNull();
  });

  it('damps out and stays inside the measured amplitude', () => {
    const first = failShakeAt(settleFrame, window, FPS);
    const later = failShakeAt(settleFrame + 7, window, FPS);

    for (const shake of [first, later]) {
      expect(Math.abs(shake?.dx ?? 0)).toBeLessThanOrEqual(0.011);
      expect(Math.abs(shake?.dy ?? 0)).toBeLessThanOrEqual(0.011);
    }

    const energy = (shake: {dx: number; dy: number} | null) =>
      Math.hypot(shake?.dx ?? 0, shake?.dy ?? 0);

    expect(energy(later)).toBeLessThan(energy(first));
  });

  // NFR-02 — the Player, a single render, and every batch job must agree.
  it('is a pure function of the frame, with no stored seed', () => {
    for (let frame = settleFrame; frame < settleFrame + 9; frame += 1) {
      expect(failShakeAt(frame, window, FPS)).toEqual(
        failShakeAt(frame, window, FPS),
      );
    }
  });

  it('never fires when the whole window was compressed into the entry', () => {
    const compressed = failWindow(3, FPS);

    for (let frame = 0; frame < 3; frame += 1) {
      expect(failShakeAt(frame, compressed, FPS)).toBeNull();
    }
  });
});

describe('zoomPunchAt', () => {
  const DURATION = msToFrames(5400, FPS);
  const BOTH = {in: true, out: true};

  it('draws nothing in the middle of a section', () => {
    expect(zoomPunchAt(Math.floor(DURATION / 2), DURATION, FPS, BOTH)).toBeNull();
  });

  it('settles the incoming frame out of the zoom', () => {
    const first = zoomPunchAt(0, DURATION, FPS, BOTH);
    const last = zoomPunchAt(
      msToFrames(300, FPS) - 1,
      DURATION,
      FPS,
      BOTH,
    );

    expect(first?.scale).toBeGreaterThan(1);
    expect(first?.scale).toBeLessThanOrEqual(FAILURE_TRANSITION_SCALE);
    expect(first?.blurRatio).toBeGreaterThan(0);
    expect(last?.scale).toBeCloseTo(1, 5);
    expect(last?.blurRatio).toBeCloseTo(0, 5);
  });

  it('rushes the outgoing frame in, ending at the full zoom', () => {
    const outFrames = msToFrames(250, FPS);
    const first = zoomPunchAt(DURATION - outFrames, DURATION, FPS, BOTH);
    const last = zoomPunchAt(DURATION - 1, DURATION, FPS, BOTH);

    expect(first?.scale).toBeGreaterThanOrEqual(1);
    expect(first?.scale).toBeLessThan(FAILURE_TRANSITION_SCALE);
    expect(last?.scale).toBeCloseTo(FAILURE_TRANSITION_SCALE, 5);
    expect(last?.blurRatio).toBeCloseTo(0.02, 5);
  });

  it('honours an edge that carries no punch', () => {
    expect(zoomPunchAt(0, DURATION, FPS, {in: false, out: true})).toBeNull();
    expect(
      zoomPunchAt(DURATION - 1, DURATION, FPS, {in: true, out: false}),
    ).toBeNull();
    expect(zoomPunchAt(0, DURATION, FPS, {in: false, out: false})).toBeNull();
  });

  it('never scales below 1, so the source proxy crop stays safe (D-10)', () => {
    for (let frame = 0; frame < DURATION; frame += 1) {
      const punch = zoomPunchAt(frame, DURATION, FPS, BOTH);

      if (punch) {
        expect(punch.scale).toBeGreaterThanOrEqual(1);
        expect(punch.blurRatio).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // The two halves must never meet, even at the section floor.
  it('caps each half at half the section', () => {
    const tiny = msToFrames(1000, FPS);
    const frames = Array.from({length: tiny}, (_, frame) =>
      zoomPunchAt(frame, tiny, FPS, BOTH),
    );

    expect(frames.filter((punch) => punch !== null).length).toBeLessThanOrEqual(
      tiny,
    );
    // Whatever the section length, frame 0 is an in-punch and the last is an out.
    expect(frames[0]?.scale).toBeGreaterThan(1);
    expect(frames[tiny - 1]?.scale).toBeGreaterThan(1);
  });
});

describe('failureEdgesAt', () => {
  /**
   * FR-05, as amended by the user on 2026-08-28: only the level 20 -> level 99
   * boundary punches.
   *
   * Level 1 does not punch out because the FAIL beat is anchored to the end of
   * that section, and the two used to land on the same frames. The end card's
   * boundary is a cut for the Day1 reason.
   */
  it('punches only the middle boundary', () => {
    expect(failureEdgesAt(0, 4)).toEqual({in: false, out: false});
    expect(failureEdgesAt(1, 4)).toEqual({in: false, out: true});
    expect(failureEdgesAt(2, 4)).toEqual({in: true, out: false});
    expect(failureEdgesAt(3, 4)).toEqual({in: false, out: false});
  });

  /**
   * The point of the change, stated as an invariant rather than as a constant:
   * no frame of level 1 carries a punch, so nothing multiplies the FAIL zoom.
   */
  it('leaves every frame of the FAIL section free of the punch', () => {
    const edges = failureEdgesAt(0, 4);

    for (let frame = 0; frame < SECTION_FRAMES; frame += 1) {
      expect(zoomPunchAt(frame, SECTION_FRAMES, FPS, edges)).toBeNull();
    }
  });
});
