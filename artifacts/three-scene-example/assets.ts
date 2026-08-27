// Browser half of `make-assets.mjs`: encodes the stand-in source clip with
// mediabunny (the same encoder library the app depends on) and draws the three
// CTA stills the template accepts — app icon, logo, store badge.
//
// VP9/WebM rather than H.264/MP4 because this container's Chromium has neither an
// H.264 encoder nor a decoder (see docs/03-analysis/day1-quad.m0-perf-gate.md §6).
// On a real machine the same clip would be an MP4 and nothing else would change.
import {
  BufferTarget,
  CanvasSource,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
} from 'mediabunny';

import {drawFrame, FPS, HEIGHT, SECONDS, WIDTH} from './gameplay-placeholder';

const KO = '"Noto Sans KR", system-ui, sans-serif';

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  return {canvas, ctx: canvas.getContext('2d') as CanvasRenderingContext2D};
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const appIcon = () => {
  const {canvas, ctx} = canvasOf(512, 512);
  const background = ctx.createLinearGradient(0, 0, 512, 512);
  background.addColorStop(0, '#e9f4fb');
  background.addColorStop(0.55, '#5c9ad0');
  background.addColorStop(1, '#1d3f6e');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 512);

  // A six-armed snowflake behind a blade: the clip's two motifs.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(256, 256);
    ctx.lineTo(256 + Math.cos(a) * 170, 256 + Math.sin(a) * 170);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * 110, 256 + Math.sin(a) * 110);
    ctx.lineTo(256 + Math.cos(a + 0.5) * 158, 256 + Math.sin(a + 0.5) * 158);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(240, 350);
  ctx.rotate(-0.5);
  const blade = ctx.createLinearGradient(0, 0, 0, -260);
  blade.addColorStop(0, '#a8cfe8');
  blade.addColorStop(1, '#ffffff');
  ctx.fillStyle = blade;
  roundRect(ctx, -24, -270, 48, 270, 24);
  ctx.fill();
  ctx.fillStyle = '#7fd8d0';
  roundRect(ctx, -86, -12, 172, 32, 16);
  ctx.fill();
  ctx.restore();

  return canvas.toDataURL('image/png');
};

const logo = () => {
  const {canvas, ctx} = canvasOf(1100, 300);
  ctx.textAlign = 'center';

  // Cinzel stands in for the key visual's ornate display face.
  ctx.font = '700 128px Cinzel, "Noto Sans KR", serif';
  ctx.shadowColor = 'rgba(24, 52, 84, 0.55)';
  ctx.shadowBlur = 26;
  const fill = ctx.createLinearGradient(0, 30, 0, 190);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(1, '#cfe6f5');
  ctx.fillStyle = fill;
  ctx.fillText('SODA LEGEND', 550, 150);
  ctx.shadowBlur = 0;

  // A thin rule with a snowflake, the way the key visual splits title and band.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(230, 196);
  ctx.lineTo(500, 196);
  ctx.moveTo(600, 196);
  ctx.lineTo(870, 196);
  ctx.stroke();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(550, 196);
    ctx.lineTo(550 + Math.cos(a) * 20, 196 + Math.sin(a) * 20);
    ctx.stroke();
  }

  ctx.font = `700 46px ${KO}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText('소다 레전드', 550, 262);

  return canvas.toDataURL('image/png');
};

const storeBadge = () => {
  const {canvas, ctx} = canvasOf(900, 240);
  ctx.fillStyle = 'rgba(23, 48, 78, 0.92)';
  roundRect(ctx, 10, 10, 880, 220, 40);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 5;
  roundRect(ctx, 10, 10, 880, 220, 40);
  ctx.stroke();

  // A neutral play glyph: this is a placeholder badge, not a store's artwork.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(100, 70);
  ctx.lineTo(190, 120);
  ctx.lineTo(100, 170);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `700 38px ${KO}`;
  ctx.fillText('지금 스토어에서', 240, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 66px ${KO}`;
  ctx.fillText('무료 다운로드', 240, 178);

  return canvas.toDataURL('image/png');
};

const encodeGameplay = async () => {
  const {canvas, ctx} = canvasOf(WIDTH, HEIGHT);
  const output = new Output({
    format: new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {codec: 'vp9', bitrate: QUALITY_HIGH});
  output.addVideoTrack(source, {frameRate: FPS});
  await output.start();

  const totalFrames = SECONDS * FPS;

  for (let frame = 0; frame < totalFrames; frame += 1) {
    drawFrame(ctx, frame / FPS);
    await source.add(frame / FPS, 1 / FPS);
  }

  await output.finalize();
  const buffer = (output.target as BufferTarget).buffer as ArrayBuffer;
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }

  return {base64: btoa(binary), bytes: bytes.length, frames: totalFrames};
};

declare global {
  interface Window {
    __makeAssets: () => Promise<{
      gameplay: {base64: string; bytes: number; frames: number};
      appIconPng: string;
      logoPng: string;
      storeBadgePng: string;
    }>;
  }
}

window.__makeAssets = async () => {
  // Wait for the Korean face so the HUD text is not drawn in a fallback.
  await document.fonts.load(`900 132px ${KO}`);
  await document.fonts.load('700 128px Cinzel');
  await document.fonts.ready;

  return {
    gameplay: await encodeGameplay(),
    appIconPng: appIcon(),
    logoPng: logo(),
    storeBadgePng: storeBadge(),
  };
};

document.getElementById('status')!.textContent = 'ready';
