// kv-ai-designation P0 — the test art, drawn instead of downloaded.
//
// Why synthetic: the accuracy question is "does a click on a game-art object
// return that object", and answering it needs a mask that is exactly known.
// Drawing the art gives ground truth for free. What it cannot give is real
// game-art texture, so the three fixtures are built around the three ways game
// key visuals are actually hard for a segmenter trained on photographs:
//   bonfire   — a light source with no boundary at all (bloom fades to black)
//   character — a hard-edged subject over a busy, similar-valued background
//   orb       — a small bright object embedded in decoration of the same hue
// Deterministic throughout (a hash, never Math.random) so a rerun measures the
// same pixels.

export const FIXTURE_WIDTH = 1080;
export const FIXTURE_HEIGHT = 1920;

const hash01 = (a, b) => {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Grain, so nothing is a flat fill a flood fill could trivially win on. */
const grain = (ctx, w, h, amount) => {
  const cell = 6;

  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = `rgba(255,255,255,${(hash01(x, y) * amount).toFixed(4)})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }
};

const flamePath = (ctx, cx, cy, w, h) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.bezierCurveTo(cx + w * 0.9, cy - h * 0.45, cx + w, cy + h * 0.1, cx, cy);
  ctx.bezierCurveTo(cx - w, cy + h * 0.1, cx - w * 0.9, cy - h * 0.45, cx, cy - h);
  ctx.closePath();
};

const bonfire = {
  name: 'bonfire',
  note: '광원 — 경계가 없는 대상 (bloom이 배경으로 연속적으로 사라진다)',
  click: {x: 0.5, y: 0.68},
  background(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a0710');
    sky.addColorStop(0.6, '#150d14');
    sky.addColorStop(1, '#241410');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Cave wall slabs — value variation the flood fill has to cross.
    for (let i = 0; i < 14; i += 1) {
      const x = hash01(i, 1) * w;
      const y = hash01(i, 2) * h * 0.8;
      ctx.fillStyle = `rgba(60,40,50,${0.05 + hash01(i, 3) * 0.12})`;
      ctx.fillRect(x, y, 120 + hash01(i, 4) * 300, 80 + hash01(i, 5) * 260);
    }

    ctx.fillStyle = '#0d0a0c';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.82, w * 0.72, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const [dx, angle] of [
      [-0.09, -0.35],
      [0.08, 0.3],
      [0, 0.05],
    ]) {
      ctx.save();
      ctx.translate(w * (0.5 + dx), h * 0.735);
      ctx.rotate(angle);
      ctx.fillStyle = '#2b1c14';
      ctx.fillRect(-w * 0.13, -14, w * 0.26, 28);
      ctx.restore();
    }

    grain(ctx, w, h, 0.05);
  },
  /** The designation a human would draw: the flame body, not its light. */
  object(ctx, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.72;
    const core = ctx.createLinearGradient(0, cy - h * 0.1, 0, cy);
    core.addColorStop(0, '#fff3c4');
    core.addColorStop(0.45, '#ffb02e');
    core.addColorStop(1, '#e2521a');
    ctx.fillStyle = core;
    flamePath(ctx, cx, cy, w * 0.1, h * 0.1);
    ctx.fill();
  },
  /** Bloom, drawn over everything — the part that has no edge. */
  after(ctx, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.685;
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.46);
    halo.addColorStop(0, 'rgba(255,168,64,0.55)');
    halo.addColorStop(0.35, 'rgba(255,120,40,0.18)');
    halo.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  },
};

const character = {
  name: 'character',
  note: '캐릭터 — 요청자가 "클릭 한 번으로" 지정하고 싶다고 한 대상',
  click: {x: 0.5, y: 0.45},
  background(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, '#1b2340');
    sky.addColorStop(0.5, '#3a2b4a');
    sky.addColorStop(1, '#20182c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Ruin pillars behind the subject: same value range as the silhouette.
    for (let i = 0; i < 7; i += 1) {
      const x = (i / 7) * w + hash01(i, 9) * 60;
      ctx.fillStyle = `rgba(28,22,38,${0.35 + hash01(i, 10) * 0.35})`;
      ctx.fillRect(x, h * (0.18 + hash01(i, 11) * 0.2), 90, h * 0.7);
    }

    const moon = ctx.createRadialGradient(
      w * 0.72,
      h * 0.2,
      0,
      w * 0.72,
      h * 0.2,
      w * 0.5,
    );
    moon.addColorStop(0, 'rgba(180,200,255,0.35)');
    moon.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 0.06);
  },
  object(ctx, w, h) {
    const cx = w * 0.5;
    ctx.fillStyle = '#241a30';

    ctx.beginPath();
    ctx.arc(cx, h * 0.3, w * 0.062, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - w * 0.11, h * 0.37);
    ctx.lineTo(cx + w * 0.11, h * 0.37);
    ctx.lineTo(cx + w * 0.085, h * 0.56);
    ctx.lineTo(cx - w * 0.085, h * 0.56);
    ctx.closePath();
    ctx.fill();

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + side * w * 0.1, h * 0.39);
      ctx.rotate(side * 0.32);
      ctx.fillRect(-w * 0.028, 0, w * 0.056, h * 0.17);
      ctx.restore();

      ctx.fillRect(cx + side * 0.012 * w - w * 0.038, h * 0.55, w * 0.062, h * 0.16);
    }

    // Rim light: the illustration convention that separates a subject from a
    // dark background, and the cue a photo-trained model has never seen much of.
    ctx.strokeStyle = 'rgba(150,205,255,0.85)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, h * 0.3, w * 0.062, Math.PI * 0.75, Math.PI * 1.65);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.11, h * 0.37);
    ctx.lineTo(cx - w * 0.085, h * 0.56);
    ctx.stroke();
  },
  after() {},
};

const orb = {
  name: 'orb',
  note: '작은 광원 — 같은 색조의 장식(마법진) 안에 박혀 있다',
  click: {x: 0.5, y: 0.42},
  background(ctx, w, h) {
    ctx.fillStyle = '#07131a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(90,220,255,0.30)';
    for (let i = 1; i <= 4; i += 1) {
      ctx.lineWidth = 3 + i;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.66, w * 0.12 * i, h * 0.028 * i, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < 40; i += 1) {
      ctx.fillStyle = `rgba(120,230,255,${0.1 + hash01(i, 21) * 0.35})`;
      ctx.beginPath();
      ctx.arc(hash01(i, 22) * w, hash01(i, 23) * h, 2 + hash01(i, 24) * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    grain(ctx, w, h, 0.04);
  },
  object(ctx, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.42;
    const r = w * 0.085;
    const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.4, '#8fe9ff');
    body.addColorStop(1, '#1f7fa8');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  },
  after(ctx, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.42;
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.3);
    halo.addColorStop(0, 'rgba(140,235,255,0.4)');
    halo.addColorStop(1, 'rgba(140,235,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  },
};

export const FIXTURES = [bonfire, character, orb];

const make = () => {
  const canvas = document.createElement('canvas');
  canvas.width = FIXTURE_WIDTH;
  canvas.height = FIXTURE_HEIGHT;

  return canvas;
};

/** The key visual as the operator would see it. */
export const drawArt = (fixture) => {
  const canvas = make();
  const ctx = canvas.getContext('2d');
  fixture.background(ctx, canvas.width, canvas.height);
  fixture.object(ctx, canvas.width, canvas.height);
  fixture.after(ctx, canvas.width, canvas.height);

  return canvas;
};

/** The designation a human would draw, as an exact binary mask. */
export const drawGroundTruth = (fixture) => {
  const canvas = make();
  const ctx = canvas.getContext('2d');
  fixture.object(ctx, canvas.width, canvas.height);
  const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(canvas.width * canvas.height);

  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  }

  return mask;
};
