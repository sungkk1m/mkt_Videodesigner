// failure-video SC7 / NFR-01 — what the FAIL beat and the punch transitions
// actually cost, measured on the shipped composition.
//
// The comparison is failure-with-effects against failure-with-every-effect-off,
// not against another template: that isolates the effects themselves. A
// comparison against Day1 would fold in the panel count (Day1 draws two video
// elements per frame, a failure segment draws one) and answer a different
// question than the one NFR-01 asks.
//
// VP9/WebM, because this container's Chromium has no H.264 encoder. Design §8.3
// and the quad's M0 spike both say the same thing about that: the encode bucket
// is not comparable to a hardware-H.264 machine, and the composite bucket —
// which is the one an added `filter` or `transform` lands in — is
// codec-independent. Wall clock, not the renderer's own buckets (M0's lesson).
import {renderMediaOnWeb} from '@remotion/web-renderer';

import {FailureComposition} from '../../src/compositions/FailureComposition';
import {failureLayout} from '../../src/domain/failure/layout';
import type {
  Day1PanelRenderProps,
  FailureProps,
} from '../../src/domain/editor/types';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
/** The 30s preset's own split, in ms (Design §6.1). */
const SECTION_MS = [5400, 2700, 18_900, 3000];

const SOURCES = [
  './sources/m0-a.webm',
  './sources/m0-b.webm',
  './sources/m0-c.webm',
].map((path) => new URL(path, document.baseURI).href);

const panel = (url: string, sectionMs: number): Day1PanelRenderProps => ({
  url,
  trimBeforeFrames: 0,
  trimAfterFrames: Math.round((sectionMs / 1000) * FPS),
  fit: 'cover',
  scale: 1,
  x: 0,
  y: 0,
  label: '',
});

const buildProps = (effectsOn: boolean): FailureProps => {
  let cursor = 0;
  const sections = SECTION_MS.map((durationMs, index) => {
    const durationInFrames = Math.round((durationMs / 1000) * FPS);
    const section = {
      id: ['panel-a', 'panel-b', 'panel-c', 'endcard'][index] as string,
      fromFrame: cursor,
      durationInFrames,
      activePanel: (['a', 'b', 'c', null] as const)[index] ?? null,
    };

    cursor += durationInFrames;

    return section;
  });

  return {
    layout: failureLayout('9:16'),
    panels: [
      panel(SOURCES[0] as string, SECTION_MS[0] as number),
      panel(SOURCES[1] as string, SECTION_MS[1] as number),
      panel(SOURCES[2] as string, SECTION_MS[2] as number),
    ],
    captions: ['LEVEL 1', 'LEVEL 20', 'LEVEL 99'],
    captionStyle: {fontSize: 100, textColor: '#ffffff', barColor: '#000000'},
    fail: {
      stampEnabled: effectsOn,
      zoomEnabled: effectsOn,
      desaturateEnabled: effectsOn,
      shakeEnabled: effectsOn,
      // Off in both runs: an audio track would move the mixing bucket and this
      // is about frames.
      sfxEnabled: false,
      focusX: 0,
      focusY: 0,
    },
    orientation: 'vertical',
    endCard: {
      mode: 'banner',
      bannerUrl: null,
      iconUrl: null,
      iconRect: {x: 0.5, y: 0.5, w: 0.2, h: 0.2, radius: 0.04},
      iconAnimation: 'none',
      cardMotion: 'none',
      videoUrl: null,
      videoTrimBeforeFrames: 0,
      videoTrimAfterFrames: 1,
      videoAudioEnabled: false,
      videoAudioVolume: 0,
    },
    sections,
    audio: {
      originalVolume: 0,
      bgm: null,
      narration: [],
      ducking: {
        enabled: false,
        targetGain: 1,
        attackInFrames: 0,
        releaseInFrames: 0,
      },
    },
  } as FailureProps;
};

const totalFrames = SECTION_MS.reduce(
  (sum, ms) => sum + Math.round((ms / 1000) * FPS),
  0,
);

declare global {
  interface Window {
    __failureBench: (config: {
      effects: boolean;
      /** Frames to render; the whole 30s is slow and the ratio is what matters. */
      frames?: number;
      /**
       * Where to start. The default covers the FAIL beat and the first punch,
       * which is where every effect frame in the video lives.
       */
      from?: number;
    }) => Promise<Record<string, unknown>>;
  }
}

window.__failureBench = async ({effects, frames = 180, from = 60}) => {
  const startedAt = performance.now();

  const result = await renderMediaOnWeb({
    composition: {
      id: 'failure-bench',
      component: FailureComposition,
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      durationInFrames: totalFrames,
      defaultProps: buildProps(effects),
    },
    inputProps: buildProps(effects),
    frameRange: [from, from + frames - 1],
    container: 'webm',
    videoCodec: 'vp8',
    muted: true,
    outputTarget: 'arraybuffer',
    hardwareAcceleration: 'no-preference',
    logLevel: 'error',
  } as never);

  const blob = await (result as {getBlob: () => Promise<Blob>}).getBlob();
  const elapsedMs = performance.now() - startedAt;

  return {
    effects,
    frames,
    from,
    elapsedMs: Math.round(elapsedMs),
    msPerFrame: Number((elapsedMs / frames).toFixed(2)),
    outputBytes: blob.size,
  };
};

document.getElementById('status')!.textContent = 'ready';
