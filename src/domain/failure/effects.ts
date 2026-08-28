// failure-video Design §5.3, §6.2 — the FAIL beat and the punch transition, as
// pure functions of `(frame, …)`.
//
// Design Goal 3: the composition holds no formulas. Scrubbing, the Player, a
// single render, and a batch job all derive the same pixel from the same frame
// number, which is the only way those four can be expected to agree.
//
// Design Goal 4: a frame outside an effect gets `null` back, and the composition
// turns that into `style: undefined`. The quad measurement is why — an
// always-on `filter` cost 2.13x the render time there (`BlurBookend`'s rule,
// `KvLoopComposition.tsx`).
//
// Nothing here is random. The shake is a fixed damped oscillation, so unlike the
// kv particles it needs no stored seed: there is nothing to reproduce.
import {msToFrames} from '../timeline/timeline';

/** Plan §1.2 — the punch zoom runs ~0.6s; 0.5s of it leads the stamp. */
export const FAIL_LEAD_MS = 500;
/** The user's "last one second": how long the stamp is on screen. */
export const FAIL_STAMP_MS = 1000;
export const FAIL_WINDOW_MS = FAIL_LEAD_MS + FAIL_STAMP_MS;
/** Measured ~1 → 2.2 over the lead. R-3 caps it here: 2.2x is where a 1080p
    source stops holding up, and the beat is too short to notice more. */
export const FAIL_ZOOM_SCALE = 2.2;
/** Measured: the stamp arrives ~4x oversized and settles by ~4.1s. */
export const FAIL_STAMP_ENTER_MS = 250;
export const FAIL_STAMP_ENTER_SCALE = 4;
export const FAIL_STAMP_ENTER_OPACITY = 0.6;
export const FAIL_STAMP_ROTATE_DEG = -8;
/**
 * Peak motion blur on the incoming stamp, as a fraction of the frame width
 * (≈13px at 1080). A ratio rather than the px the Design names, because this
 * module cannot know the canvas size and 9:16 and 16:9 do not share one —
 * `zoomPunchAt` returns its blur the same way for the same reason.
 */
export const FAIL_STAMP_BLUR_RATIO = 0.012;
/** Measured: a few frames of it, right after the stamp lands. */
export const FAIL_SHAKE_MS = 300;
/** Fraction of the frame — ≈11px on a 1080-wide frame, matching the reference. */
export const FAIL_SHAKE_AMPLITUDE = 0.01;

/**
 * Two frequencies rather than one so the frame does not travel a straight
 * diagonal, kept low enough to survive 30fps sampling: 11Hz over the 300ms tail
 * is about three oscillations in nine frames, which is what a hand-held jolt
 * looks like at that frame rate.
 */
const SHAKE_FREQUENCY_X = 11;
const SHAKE_FREQUENCY_Y = 7;
const SHAKE_PHASE_Y = Math.PI / 3;
/** e^(-9 * 0.3) ≈ 0.07 — all but gone by the end of the window. */
const SHAKE_DAMPING = 9;

/** Plan §1.3 — measured aggressive zoom out, then a settle into the next level. */
export const FAILURE_TRANSITION_OUT_MS = 250;
export const FAILURE_TRANSITION_IN_MS = 300;
export const FAILURE_TRANSITION_SCALE = 2;
/** Fraction of the frame width, at the transition's peak. */
export const FAILURE_TRANSITION_BLUR_RATIO = 0.02;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const easeOut = (progress: number) => 1 - (1 - progress) ** 2;
const easeIn = (progress: number) => progress ** 2;

export interface FailWindow {
  /** First frame of the lead-in zoom, relative to the section. */
  startFrame: number;
  /** First frame the stamp is on screen — and the SFX trigger (§6.6). */
  stampFrame: number;
  leadFrames: number;
  stampFrames: number;
}

/**
 * The FAIL beat is anchored to the END of its section (Plan D-3), so dragging
 * the level-1 boundary moves the beat with it — no stored position to keep in
 * sync.
 *
 * A section shorter than the beat compresses it rather than overflowing, and the
 * lead is what gives way: the stamp's second is what the user asked for, so it
 * is the part that survives down to a section of one frame.
 *
 * Design D-11 deliberately replaces Plan R-6's "reject a short section 1" with
 * this. `moveTimelineBoundary` clamps at `MIN_SCENE_MS` for every template, so a
 * schema floor above that would let a legal drag produce a document that cannot
 * be parsed back — and autosave restore would fail on it.
 */
export const failWindow = (
  sectionDurationInFrames: number,
  fps: number,
): FailWindow => {
  const duration = Math.max(0, sectionDurationInFrames);
  const stampFrames = Math.min(msToFrames(FAIL_STAMP_MS, fps), duration);
  const leadFrames = Math.min(
    msToFrames(FAIL_LEAD_MS, fps),
    duration - stampFrames,
  );

  return {
    startFrame: duration - stampFrames - leadFrames,
    stampFrame: duration - stampFrames,
    leadFrames,
    stampFrames,
  };
};

/** Which parts of the beat are switched on. Plan D-5 — all of them can be off. */
export interface FailToggles {
  stampEnabled: boolean;
  zoomEnabled: boolean;
  desaturateEnabled: boolean;
  shakeEnabled: boolean;
  focusX: number;
  focusY: number;
}

export interface FailVideoStyle {
  scale: number;
  /** 0..1, straight into `filter: grayscale()`. */
  grayscale: number;
  /** `transform-origin` in %, with the focus offset folded in (FR-12). */
  originX: number;
  originY: number;
}

/**
 * The footage's own part of the beat: punch in on the dying character while the
 * colour drains out, then hold both through the stamp.
 *
 * Applies to the video band only — the caption bar does not move here (Plan
 * §1.2-4 puts the whole-frame motion in the shake and the transition instead).
 * Design D-9 is that layering.
 *
 * Null means nothing to draw: outside the window, or with both axes switched
 * off because the source game already stages its own death zoom.
 */
export const failVideoStyleAt = (
  frame: number,
  window: FailWindow,
  fail: FailToggles,
): FailVideoStyle | null => {
  if (frame < window.startFrame || (!fail.zoomEnabled && !fail.desaturateEnabled)) {
    return null;
  }

  // Held at full through the stamp; eased across the lead. A zero-length lead
  // (a compressed window) lands on the full value immediately.
  const progress =
    frame >= window.stampFrame || window.leadFrames <= 0
      ? 1
      : easeOut(clamp01((frame - window.startFrame + 1) / window.leadFrames));

  return {
    scale: fail.zoomEnabled ? 1 + (FAIL_ZOOM_SCALE - 1) * progress : 1,
    grayscale: fail.desaturateEnabled ? progress : 0,
    originX: 50 + fail.focusX,
    originY: 50 + fail.focusY,
  };
};

export interface FailStampStyle {
  scale: number;
  opacity: number;
  rotateDeg: number;
  /** Fraction of the frame width; 0 once the stamp has landed. */
  blurRatio: number;
}

/**
 * The rubber stamp slamming down: oversized and translucent at first, then
 * driven onto the frame.
 *
 * `easeIn` is what makes it read as a slam rather than a fade — it accelerates
 * into the impact instead of gliding to a stop.
 *
 * The blur follows how far the stamp still has to travel, so it peaks on the
 * oversized entry frame and is exactly zero once it lands. (The Design says
 * "proportional to the scale's speed"; taken literally against `easeIn` that
 * peaks at impact and smears the settled stamp, which is the opposite of the
 * reference's translucent incoming streak. Same intent — blur during the entry
 * only — measured from the remaining distance instead.)
 */
export const failStampStyleAt = (
  frame: number,
  window: FailWindow,
  fps: number,
): FailStampStyle | null => {
  if (frame < window.stampFrame || frame >= window.stampFrame + window.stampFrames) {
    return null;
  }

  const enterFrames = Math.min(
    msToFrames(FAIL_STAMP_ENTER_MS, fps),
    window.stampFrames,
  );
  const progress =
    enterFrames <= 0
      ? 1
      : easeIn(clamp01((frame - window.stampFrame + 1) / enterFrames));

  return {
    scale: FAIL_STAMP_ENTER_SCALE + (1 - FAIL_STAMP_ENTER_SCALE) * progress,
    opacity: FAIL_STAMP_ENTER_OPACITY + (1 - FAIL_STAMP_ENTER_OPACITY) * progress,
    rotateDeg: FAIL_STAMP_ROTATE_DEG,
    blurRatio: FAIL_STAMP_BLUR_RATIO * (1 - progress),
  };
};

export interface FailShake {
  /** Fractions of the frame's width and height. */
  dx: number;
  dy: number;
}

/**
 * The jolt the impact puts through the whole frame, caption bar included
 * (Plan §1.2-4). It starts on the frame the stamp lands and damps out.
 *
 * Deterministic by construction, so it needs no stored seed the way the kv
 * particles do: there is no randomness here to reproduce.
 */
export const failShakeAt = (
  frame: number,
  window: FailWindow,
  fps: number,
): FailShake | null => {
  const enterFrames = Math.min(
    msToFrames(FAIL_STAMP_ENTER_MS, fps),
    window.stampFrames,
  );
  const settleFrame = window.stampFrame + enterFrames;
  const shakeFrames = Math.min(
    msToFrames(FAIL_SHAKE_MS, fps),
    window.stampFrame + window.stampFrames - settleFrame,
  );

  if (frame < settleFrame || frame >= settleFrame + shakeFrames) {
    return null;
  }

  const seconds = (frame - settleFrame) / fps;
  const decay = Math.exp(-SHAKE_DAMPING * seconds);

  return {
    dx: FAIL_SHAKE_AMPLITUDE * Math.sin(2 * Math.PI * SHAKE_FREQUENCY_X * seconds) * decay,
    dy:
      FAIL_SHAKE_AMPLITUDE *
      0.7 *
      Math.sin(2 * Math.PI * SHAKE_FREQUENCY_Y * seconds + SHAKE_PHASE_Y) *
      decay,
  };
};

export interface ZoomPunch {
  scale: number;
  /** Fraction of the frame width. */
  blurRatio: number;
}

/** Which of a section's two edges carry the punch. The end card gets a cut. */
export interface FailureEdges {
  in: boolean;
  out: boolean;
}

/**
 * Plan §1.3 — the level-to-level transition: the outgoing frame rushes in and
 * blurs, the cut lands, and the incoming frame settles back out of the zoom.
 *
 * Like `transitionStyleAt`, it runs entirely inside its own section's frame
 * range rather than overlapping two of them, which is what keeps
 * "sum of section frames equals preset x fps" exactly true.
 *
 * Each half is capped at half the section, so the two can never meet even if a
 * section is dragged near `MIN_SCENE_MS`.
 */
export const zoomPunchAt = (
  frameInSection: number,
  durationInFrames: number,
  fps: number,
  edges: FailureEdges,
): ZoomPunch | null => {
  const half = Math.floor(durationInFrames / 2);
  const inFrames = edges.in
    ? Math.min(msToFrames(FAILURE_TRANSITION_IN_MS, fps), half)
    : 0;
  const outFrames = edges.out
    ? Math.min(msToFrames(FAILURE_TRANSITION_OUT_MS, fps), half)
    : 0;

  if (inFrames > 0 && frameInSection < inFrames) {
    // Settling: full zoom on the first frame after the cut, resting by the last.
    const progress = easeOut(clamp01((frameInSection + 1) / inFrames));

    return {
      scale: FAILURE_TRANSITION_SCALE + (1 - FAILURE_TRANSITION_SCALE) * progress,
      blurRatio: FAILURE_TRANSITION_BLUR_RATIO * (1 - progress),
    };
  }

  const outStart = durationInFrames - outFrames;

  if (outFrames > 0 && frameInSection >= outStart) {
    // Rushing in: at rest on the first frame of the window, full zoom on the last.
    const progress = easeIn(clamp01((frameInSection - outStart + 1) / outFrames));

    return {
      scale: 1 + (FAILURE_TRANSITION_SCALE - 1) * progress,
      blurRatio: FAILURE_TRANSITION_BLUR_RATIO * progress,
    };
  }

  return null;
};

/**
 * The punch edges for a section index. Three boundaries, and only the middle one
 * punches:
 *
 * - The video opens on level 1, so there is nothing to settle in from.
 * - **Level 1 does not punch out** (user decision, 2026-08-28). The FAIL beat is
 *   anchored to the end of that section (D-3), so the punch used to land on top
 *   of it: at the 30s preset the last 8 frames of level 1 carried both, and the
 *   footage was scaled 2.2x by the beat and 2.0x again by the punch. The
 *   reference never shows that — there the FAIL sits mid-segment and the
 *   transition is seconds later — so the two are separated by cutting here
 *   instead. The stamp gets the frame to itself and the cut does the work.
 * - The end card's boundary is a cut too, as in Day1: the reference has no end
 *   card to measure a transition from.
 *
 * That leaves the level 20 -> level 99 boundary as the one punch in the video,
 * which is also the one the reference's own second transition corresponds to.
 */
export const failureEdgesAt = (
  index: number,
  sectionCount: number,
): FailureEdges => ({
  in: index > 1 && index < sectionCount - 1,
  out: index > 0 && index < sectionCount - 2,
});
