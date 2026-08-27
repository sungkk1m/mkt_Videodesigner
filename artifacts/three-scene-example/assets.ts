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
  background.addColorStop(0, '#3b2b7a');
  background.addColorStop(1, '#c2417c');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 512);

  // A moon and a blade, so the icon reads as the same game as the clip.
  ctx.fillStyle = 'rgba(255, 233, 189, 0.95)';
  ctx.beginPath();
  ctx.arc(330, 170, 96, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b2b7a';
  ctx.beginPath();
  ctx.arc(288, 140, 88, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(200, 330);
  ctx.rotate(-0.6);
  const blade = ctx.createLinearGradient(0, 0, 0, -240);
  blade.addColorStop(0, '#9fb3ff');
  blade.addColorStop(1, '#ffffff');
  ctx.fillStyle = blade;
  roundRect(ctx, -22, -250, 44, 250, 22);
  ctx.fill();
  ctx.fillStyle = '#f0c56a';
  roundRect(ctx, -80, -10, 160, 30, 15);
  ctx.fill();
  ctx.restore();

  return canvas.toDataURL('image/png');
};

const logo = () => {
  const {canvas, ctx} = canvasOf(1000, 260);
  ctx.textAlign = 'center';
  ctx.font = `900 132px ${KO}`;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 24;
  const fill = ctx.createLinearGradient(0, 40, 0, 200);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(1, '#ffd76a');
  ctx.fillStyle = fill;
  ctx.fillText('달빛 원정대', 500, 150);
  ctx.shadowBlur = 0;
  ctx.font = `700 44px ${KO}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('MOONLIGHT EXPEDITION', 500, 215);

  return canvas.toDataURL('image/png');
};

const storeBadge = () => {
  const {canvas, ctx} = canvasOf(900, 240);
  ctx.fillStyle = '#0d0f16';
  roundRect(ctx, 10, 10, 880, 220, 40);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
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

  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.font = `700 38px ${KO}`;
  ctx.textAlign = 'left';
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
  await document.fonts.ready;

  return {
    gameplay: await encodeGameplay(),
    appIconPng: appIcon(),
    logoPng: logo(),
    storeBadgePng: storeBadge(),
  };
};

document.getElementById('status')!.textContent = 'ready';
