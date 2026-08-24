// M0 SPIKE — day1-quad perf gate. Discarded after the measurement.
//
// Renders 450 frames (15s @ 30fps) of PURE panel time at 1080x1920 — no end
// card, so the only difference between the two variants is the panel count.
// The 2-panel case uses the REAL `SplitFrame`; the 4-panel case uses the spike
// `QuadFrame` next door.
//
// vp9/webm rather than h264/mp4 because this container's Chromium has neither an
// H.264 encoder nor decoder. The encode bucket is therefore not comparable to a
// hardware-H.264 machine; the composite bucket is codec-independent, which is
// the bucket R1 is about.
import {AbsoluteFill, Sequence} from 'remotion';
import {renderMediaOnWeb} from '@remotion/web-renderer';

import {splitLayout} from '../../src/domain/day1/layout';
import type {
  AudioRenderProps,
  Day1LabelStyle,
  Day1PanelRenderProps,
  PanelRect,
} from '../../src/domain/editor/types';
import {SplitFrame} from '../../src/compositions/day1/SplitFrame';
import {CANVAS_COLOR} from '../../src/compositions/shared/SceneVideo';
import {
  QuadFrame,
  type QuadActive,
  type QuadLayout,
} from './quadFrame.spike';
import {
  PanelBaked,
  QuadFrameBaked,
  type BakedPanel,
} from './quadBaked.spike';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const TOTAL_FRAMES = 450;
const LINE_WIDTH_PX = 6;

const SOURCES = [
  './sources/m0-a.webm',
  './sources/m0-b.webm',
  './sources/m0-c.webm',
  './sources/m0-d.webm',
].map((path) => new URL(path, document.baseURI).href);

/** Plan §2.1 — the same "remainder to the far cell" rule `splitLayout` uses. */
const quadLayout = (lineWidthPx: number): QuadLayout => {
  const line = Math.min(Math.max(Math.round(lineWidthPx), 0), Math.min(WIDTH, HEIGHT) - 2);
  const col0 = Math.floor((WIDTH - line) / 2);
  const col1Start = col0 + line;
  const col1 = WIDTH - col1Start;
  const row0 = Math.floor((HEIGHT - line) / 2);
  const row1Start = row0 + line;
  const row1 = HEIGHT - row1Start;

  return {
    cells: [
      {x: 0, y: 0, width: col0, height: row0},
      {x: col1Start, y: 0, width: col1, height: row0},
      {x: 0, y: row1Start, width: col0, height: row1},
      {x: col1Start, y: row1Start, width: col1, height: row1},
    ],
    lines: [
      {x: col0, y: 0, width: line, height: HEIGHT},
      {x: 0, y: row0, width: WIDTH, height: line},
    ],
  };
};

const LABEL_STYLE_DAY1: Day1LabelStyle = {
  fontSize: 72,
  textColor: '#ffffff',
  outlineColor: '#000000',
  outlineWidthPx: 8,
  position: 'top',
};
// Plan §2.4 — the quad default drops to 44 because the cell is half as wide.
const LABEL_STYLE_QUAD: Day1LabelStyle = {...LABEL_STYLE_DAY1, fontSize: 44};

const AUDIO: AudioRenderProps = {
  originalVolume: 1,
  bgm: null,
  narration: [],
  ducking: {
    enabled: false,
    targetGain: 0.3,
    attackInFrames: 6,
    releaseInFrames: 6,
  },
};

const panel = (
  index: number,
  fit: 'cover' | 'contain',
  label: string,
): Day1PanelRenderProps => ({
  url: SOURCES[index] as string,
  trimBeforeFrames: 0,
  // 8s source at 30fps = 240 frames, longer than any section here.
  trimAfterFrames: 240,
  fit,
  scale: 1,
  x: 0,
  y: 0,
  label,
});

/** Baked backdrop stills, per cell geometry. See make-backdrops.mjs. */
const backdrop = (tag: 'day1' | 'quad', index: number, kind: 'color' | 'grey') =>
  new URL(
    `./backdrops/${tag}-m0-${'abcd'[index]}-${kind}.png`,
    document.baseURI,
  ).href;

const bakedPanel = (
  tag: 'day1' | 'quad',
  index: number,
  label: string,
): BakedPanel => ({
  ...panel(index, 'contain', label),
  backdropColorUrl: backdrop(tag, index, 'color'),
  backdropGreyUrl: backdrop(tag, index, 'grey'),
});

type Variant = 'day1' | 'quad' | 'day1-baked' | 'quad-baked';

const SECTIONS: Record<Variant, number[]> = {
  day1: [225, 225],
  quad: [113, 113, 112, 112],
  'day1-baked': [225, 225],
  'quad-baked': [113, 113, 112, 112],
};

const Day1SpikeComposition = ({fit}: {fit: 'cover' | 'contain'}) => {
  const layout = splitLayout('9:16', LINE_WIDTH_PX);
  const panelA = panel(0, fit, 'Day1');
  const panelB = panel(1, fit, 'Day2');
  let cursor = 0;

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {(SECTIONS.day1 as number[]).map((durationInFrames, index) => {
        const from = cursor;
        cursor += durationInFrames;

        return (
          <Sequence
            durationInFrames={durationInFrames}
            from={from}
            key={index}
            name={`panel-${index}`}
          >
            <SplitFrame
              active={index === 0 ? 'a' : 'b'}
              audio={AUDIO}
              labelStyle={LABEL_STYLE_DAY1}
              layout={layout}
              lineColor="#9ca3af"
              panelA={panelA}
              panelB={panelB}
              sectionFromFrame={from}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const QuadSpikeComposition = ({fit}: {fit: 'cover' | 'contain'}) => {
  const layout = quadLayout(LINE_WIDTH_PX);
  const panels = [
    panel(0, fit, 'Day1'),
    panel(1, fit, 'Day2'),
    panel(2, fit, 'Day3'),
    panel(3, fit, 'Day7'),
  ] as [
    Day1PanelRenderProps,
    Day1PanelRenderProps,
    Day1PanelRenderProps,
    Day1PanelRenderProps,
  ];
  let cursor = 0;

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {(SECTIONS.quad as number[]).map((durationInFrames, index) => {
        const from = cursor;
        cursor += durationInFrames;

        return (
          <Sequence
            durationInFrames={durationInFrames}
            from={from}
            key={index}
            name={`panel-${index}`}
          >
            <QuadFrame
              active={index as QuadActive}
              audio={AUDIO}
              labelStyle={LABEL_STYLE_QUAD}
              layout={layout}
              lineColor="#9ca3af"
              panels={panels}
              sectionFromFrame={from}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * The degradation variant, Day1 shape: the same two panels, but the `contain`
 * backdrop is a pre-blurred still instead of a live-blurred video element.
 * Always `contain` — there is no backdrop under `cover` to bake.
 */
const Day1BakedComposition = () => {
  const layout = splitLayout('9:16', LINE_WIDTH_PX);
  const panels = [
    bakedPanel('day1', 0, 'Day1'),
    bakedPanel('day1', 1, 'Day2'),
  ];
  let cursor = 0;

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {(SECTIONS['day1-baked'] as number[]).map((durationInFrames, index) => {
        const from = cursor;
        cursor += durationInFrames;

        return (
          <Sequence
            durationInFrames={durationInFrames}
            from={from}
            key={index}
            name={`panel-${index}`}
          >
            <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
              {panels.map((p, i) => (
                <PanelBaked
                  key={i}
                  labelStyle={LABEL_STYLE_DAY1}
                  live={index === i}
                  liveVolume={() => 1}
                  panel={p as BakedPanel}
                  rect={(i === 0 ? layout.a : layout.b) as PanelRect}
                />
              ))}
              <div
                style={{
                  backgroundColor: '#9ca3af',
                  height: layout.line.height,
                  left: layout.line.x,
                  position: 'absolute',
                  top: layout.line.y,
                  width: layout.line.width,
                }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const QuadBakedComposition = () => {
  const layout = quadLayout(LINE_WIDTH_PX);
  const panels = [
    bakedPanel('quad', 0, 'Day1'),
    bakedPanel('quad', 1, 'Day2'),
    bakedPanel('quad', 2, 'Day3'),
    bakedPanel('quad', 3, 'Day7'),
  ] as [BakedPanel, BakedPanel, BakedPanel, BakedPanel];
  let cursor = 0;

  return (
    <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
      {(SECTIONS['quad-baked'] as number[]).map((durationInFrames, index) => {
        const from = cursor;
        cursor += durationInFrames;

        return (
          <Sequence
            durationInFrames={durationInFrames}
            from={from}
            key={index}
            name={`panel-${index}`}
          >
            <QuadFrameBaked
              active={index as QuadActive}
              audio={AUDIO}
              labelStyle={LABEL_STYLE_QUAD}
              layout={layout}
              lineColor="#9ca3af"
              panels={panels}
              sectionFromFrame={from}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const TIMINGS = /Render timings: waitForReady=([\d.]+)ms, createFrame=([\d.]+)ms, addSample=([\d.]+)ms, audioMixing=([\d.]+)ms/;

const captured: string[] = [];
for (const method of ['debug', 'log', 'info'] as const) {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    captured.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
    original(...args);
  };
}

declare global {
  interface Window {
    __m0Render: (input: {
      variant: Variant;
      fit: 'cover' | 'contain';
      frames?: number;
    }) => Promise<unknown>;
  }
}

window.__m0Render = async ({variant, fit, frames = TOTAL_FRAMES}) => {
  captured.length = 0;
  const component =
    variant === 'day1'
      ? Day1SpikeComposition
      : variant === 'quad'
        ? QuadSpikeComposition
        : variant === 'day1-baked'
          ? Day1BakedComposition
          : QuadBakedComposition;
  const props = {fit};
  const startedAt = performance.now();

  await (renderMediaOnWeb as unknown as (r: unknown) => Promise<unknown>)({
    composition: {
      id: `m0-${variant}-${fit}`,
      component,
      durationInFrames: frames,
      fps: FPS,
      width: WIDTH,
      height: HEIGHT,
      defaultProps: props,
    },
    inputProps: props,
    container: 'webm',
    videoCodec: 'vp9',
    audioCodec: null,
    videoBitrate: 'high',
    muted: true,
    outputTarget: 'arraybuffer',
    hardwareAcceleration: 'no-preference',
    pageResponsiveness: 'medium',
    logLevel: 'verbose',
  });

  const totalMs = performance.now() - startedAt;
  const line = captured.find((l) => TIMINGS.test(l));
  const match = line ? TIMINGS.exec(line) : null;

  return {
    variant,
    fit,
    frames,
    totalMs: Math.round(totalMs),
    waitForReadyMs: match ? Number(match[1]) : null,
    createFrameMs: match ? Number(match[2]) : null,
    addSampleMs: match ? Number(match[3]) : null,
    audioMixingMs: match ? Number(match[4]) : null,
    rawTimingLine: line ?? null,
  };
};

document.getElementById('status')!.textContent = 'ready';
