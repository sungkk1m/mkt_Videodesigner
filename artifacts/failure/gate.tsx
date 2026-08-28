// failure-video M4 gate — mounts the REAL `FailureComposition` at a chosen
// frame so the beat can be photographed and measured against Plan §1.2.
//
// It is the shipped composition and the shipped prop shape, not a mock: the
// whole point of the gate is that what is measured here is what renders.
//
// VP9/WebM sources rather than the repo's H.264 fixtures because this
// container's Chromium has no H.264 decoder (handoff §"이 환경에서 막히는 것").
// Nothing about the effects depends on the codec.
import {Player, type PlayerRef} from '@remotion/player';
import {createRef} from 'react';
import {createRoot} from 'react-dom/client';

import {FailureComposition} from '../../src/compositions/FailureComposition';
import {failureLayout} from '../../src/domain/failure/layout';
import type {
  AspectRatio,
  Day1PanelRenderProps,
  FailureProps,
} from '../../src/domain/editor/types';

const FPS = 30;
/** The 30s preset's own split: 5.4s / 2.7s / 18.9s / 3s (Design §6.1). */
const SECTION_MS = [5400, 2700, 18_900, 3000];

const SOURCES = ['./sources/m0-a.webm', './sources/m0-b.webm', './sources/m0-c.webm'].map(
  (path) => new URL(path, document.baseURI).href,
);

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

const buildProps = (ratio: AspectRatio): FailureProps => {
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
    layout: failureLayout(ratio),
    panels: [
      panel(SOURCES[0] as string, SECTION_MS[0] as number),
      panel(SOURCES[1] as string, SECTION_MS[1] as number),
      panel(SOURCES[2] as string, SECTION_MS[2] as number),
    ],
    captions: ['LEVEL 1', 'LEVEL 20', 'LEVEL 99'],
    captionStyle: {fontSize: 100, textColor: '#ffffff', barColor: '#000000'},
    fail: {
      stampEnabled: true,
      zoomEnabled: true,
      desaturateEnabled: true,
      shakeEnabled: true,
      sfxEnabled: true,
      focusX: 0,
      focusY: 0,
    },
    orientation: ratio === '16:9' ? 'horizontal' : 'vertical',
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

const playerRef = createRef<PlayerRef>();
const total = SECTION_MS.reduce(
  (sum, ms) => sum + Math.round((ms / 1000) * FPS),
  0,
);

declare global {
  interface Window {
    __failureGate: (ratio: AspectRatio, frame: number) => Promise<void>;
    __failureTotalFrames: number;
  }
}

const mount = (ratio: AspectRatio) => {
  const size = ratio === '16:9' ? {w: 1920, h: 1080} : {w: 1080, h: 1920};
  const host = document.getElementById('frame') as HTMLDivElement;

  host.style.width = `${size.w}px`;
  host.style.height = `${size.h}px`;

  createRoot(host).render(
    <Player
      acknowledgeRemotionLicense
      component={FailureComposition}
      compositionHeight={size.h}
      compositionWidth={size.w}
      durationInFrames={total}
      fps={FPS}
      inputProps={buildProps(ratio)}
      ref={playerRef}
      style={{height: '100%', width: '100%'}}
    />,
  );
};

let mounted: AspectRatio | null = null;

window.__failureTotalFrames = total;
window.__failureGate = async (ratio, frame) => {
  if (mounted !== ratio) {
    document.getElementById('frame')!.replaceChildren();
    mount(ratio);
    mounted = ratio;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  playerRef.current?.seekTo(frame);
  // The seek has to actually decode before a screenshot means anything.
  await new Promise((resolve) => setTimeout(resolve, 900));
};

mount('9:16');
mounted = '9:16';
document.getElementById('status')!.textContent = 'ready';
