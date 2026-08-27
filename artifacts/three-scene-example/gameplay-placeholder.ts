// Draws a stand-in "mobile game capture" frame, deterministically from t.
//
// The repository ships no game footage (`tests/fixtures/*.mp4` is gitignored and
// is colour bars anyway), and colour bars say nothing to a reader who wants to
// see what the 3장면 template looks like. So the example's source clip is drawn
// here: a portrait battle scene with a HUD, so trim points, cover framing, and
// the CTA freeze frame are all legible in the finished video.
//
// Every value is a function of `t` alone — no Math.random at draw time — so the
// same clip comes out of every run.

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const SECONDS = 14;

const KO = '"Noto Sans KR", system-ui, sans-serif';

/** Deterministic 0..1 sequence, so the star field is identical every run. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const STARS = Array.from({length: 70}, (_, index) => {
  const r1 = mulberry32(index * 3 + 1)();
  const r2 = mulberry32(index * 3 + 2)();
  const r3 = mulberry32(index * 3 + 3)();

  return {x: r1 * WIDTH, y: r2 * HEIGHT * 0.6, size: 1.5 + r3 * 3.5, phase: r1 * 6.28};
});

/** One attack every 1.5s; the third of every four lands as a critical. */
const ATTACK_PERIOD = 1.5;
const attackAt = (t: number) => {
  const index = Math.floor(t / ATTACK_PERIOD);
  const local = t - index * ATTACK_PERIOD;

  return {index, local, critical: index % 4 === 2};
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

const mountains = (
  ctx: CanvasRenderingContext2D,
  baseY: number,
  offset: number,
  peaks: number,
  height: number,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-200, baseY);

  for (let i = 0; i <= peaks; i += 1) {
    const step = (WIDTH + 400) / peaks;
    const x = -200 + i * step - (offset % step);
    const h = height * (0.6 + 0.4 * Math.sin(i * 2.1));
    ctx.lineTo(x, baseY - h);
    ctx.lineTo(x + step / 2, baseY);
  }

  ctx.lineTo(WIDTH + 200, baseY);
  ctx.closePath();
  ctx.fill();
};

const hero = (ctx: CanvasRenderingContext2D, t: number) => {
  const {local, critical} = attackAt(t);
  const swinging = local < 0.42;
  const swing = swinging ? local / 0.42 : 0;
  const x = WIDTH * 0.33;
  const groundY = HEIGHT * 0.70;
  const bob = Math.sin(t * 3.4) * 9;
  const y = groundY + bob;

  // Shadow on the platform.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(x, groundY + 14, 120, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cape.
  ctx.fillStyle = '#7b2a4d';
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 250);
  ctx.quadraticCurveTo(x - 130 - swing * 40, y - 120, x - 60, y - 10);
  ctx.lineTo(x + 10, y - 20);
  ctx.closePath();
  ctx.fill();

  // Legs and torso.
  ctx.fillStyle = '#22304f';
  roundRect(ctx, x - 46, y - 130, 40, 130, 16);
  ctx.fill();
  roundRect(ctx, x + 8, y - 130, 40, 130, 16);
  ctx.fill();

  const torso = ctx.createLinearGradient(x - 60, y - 260, x + 60, y - 100);
  torso.addColorStop(0, '#5b8cff');
  torso.addColorStop(1, '#2b4fb5');
  ctx.fillStyle = torso;
  roundRect(ctx, x - 62, y - 262, 124, 150, 34);
  ctx.fill();

  // Shoulder trim.
  ctx.fillStyle = '#cfd8ff';
  roundRect(ctx, x - 66, y - 258, 132, 22, 11);
  ctx.fill();

  // Head.
  ctx.fillStyle = '#f2c9a4';
  ctx.beginPath();
  ctx.arc(x, y - 306, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20222e';
  ctx.beginPath();
  ctx.arc(x, y - 320, 46, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();

  // Sword: rests low, swings on the attack beat.
  const angle = swinging
    ? -1.9 + Math.sin(swing * Math.PI) * 2.6
    : -0.5 + Math.sin(t * 3.4) * 0.05;
  ctx.save();
  ctx.translate(x + 44, y - 190);
  ctx.rotate(angle);
  ctx.fillStyle = '#8b6b3d';
  roundRect(ctx, -12, -18, 40, 26, 8);
  ctx.fill();
  const blade = ctx.createLinearGradient(0, 0, 250, 0);
  blade.addColorStop(0, '#e7ecff');
  blade.addColorStop(1, '#9fb3ff');
  ctx.fillStyle = blade;
  roundRect(ctx, 26, -11, 240, 22, 10);
  ctx.fill();
  ctx.restore();

  // Slash arc, only while the blade is travelling.
  if (swinging && swing > 0.15 && swing < 0.85) {
    const alpha = Math.sin(((swing - 0.15) / 0.7) * Math.PI);
    ctx.strokeStyle = critical
      ? `rgba(255, 214, 92, ${alpha})`
      : `rgba(233, 240, 255, ${alpha * 0.9})`;
    ctx.lineWidth = 22 + alpha * 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x + 90, y - 200, 250, -1.3 + swing * 1.6, 0.5 + swing * 1.6);
    ctx.stroke();
  }
};

const slime = (
  ctx: CanvasRenderingContext2D,
  t: number,
  cx: number,
  cy: number,
  scale: number,
  hue: string,
  phase: number,
) => {
  const {local, critical} = attackAt(t + phase);
  const hit = local > 0.30 && local < 0.52;
  const squash = 1 + Math.sin((t + phase) * 5) * 0.06 + (hit ? 0.14 : 0);
  const w = 150 * scale * squash;
  const h = 130 * scale * (2 - squash);
  const x = cx + Math.sin((t + phase) * 1.1) * 26;
  const y = cy - Math.abs(Math.sin((t + phase) * 2.4)) * 24;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x, cy + 22, w * 0.7, 18 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(x - w * 0.3, y - h * 0.6, 10, x, y, w);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.25, hue);
  body.addColorStop(1, '#0d1b2a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x - w, y + h * 0.6);
  ctx.quadraticCurveTo(x - w, y - h, x, y - h);
  ctx.quadraticCurveTo(x + w, y - h, x + w, y + h * 0.6);
  ctx.closePath();
  ctx.fill();

  // Eyes.
  ctx.fillStyle = '#0b0d10';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.32, y - h * 0.15, 13 * scale, 20 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.28, y - h * 0.15, 13 * scale, 20 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (hit) {
    ctx.fillStyle = `rgba(255, 255, 255, ${critical ? 0.75 : 0.5})`;
    ctx.beginPath();
    ctx.moveTo(x - w, y + h * 0.6);
    ctx.quadraticCurveTo(x - w, y - h, x, y - h);
    ctx.quadraticCurveTo(x + w, y - h, x + w, y + h * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  return {x, y, hit};
};

/** Damage numbers rise and fade from the beat they were struck on. */
const damageNumbers = (ctx: CanvasRenderingContext2D, t: number) => {
  ctx.textAlign = 'center';

  for (let back = 0; back < 3; back += 1) {
    const index = Math.floor(t / ATTACK_PERIOD) - back;

    if (index < 0) {
      continue;
    }

    const struckAt = index * ATTACK_PERIOD + 0.32;
    const age = t - struckAt;

    if (age < 0 || age > 0.9) {
      continue;
    }

    const critical = index % 4 === 2;
    const alpha = 1 - age / 0.9;
    const rise = age * 190;
    const x = WIDTH * (0.66 + ((index % 3) - 1) * 0.09);
    const y = HEIGHT * 0.60 - rise;
    const pop = 1 + Math.max(0, 0.25 - age) * 1.6;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.font = `900 ${critical ? 84 : 64}px ${KO}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
    ctx.fillStyle = critical
      ? `rgba(255, 212, 74, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`;
    const label = critical ? '-9,120' : '-2,480';
    ctx.strokeText(label, 0, 0);
    ctx.fillText(label, 0, 0);

    if (critical) {
      ctx.font = `900 40px ${KO}`;
      ctx.fillStyle = `rgba(255, 120, 90, ${alpha})`;
      ctx.strokeText('치명타!', 0, 48);
      ctx.fillText('치명타!', 0, 48);
    }

    ctx.restore();
  }
};

const hud = (ctx: CanvasRenderingContext2D, t: number) => {
  // Health drains and recovers so the bar is visibly live.
  const hp = 0.42 + 0.28 * (0.5 + 0.5 * Math.sin(t * 0.7));
  const mp = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3 + 1));

  ctx.textAlign = 'left';

  // Level badge.
  const badge = ctx.createLinearGradient(40, 70, 150, 180);
  badge.addColorStop(0, '#ffd76a');
  badge.addColorStop(1, '#c2831c');
  ctx.fillStyle = badge;
  ctx.beginPath();
  ctx.arc(100, 128, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1c05';
  ctx.font = `900 44px ${KO}`;
  ctx.textAlign = 'center';
  ctx.fillText('42', 100, 144);
  ctx.font = `700 20px ${KO}`;
  ctx.fillText('Lv', 100, 100);

  // HP / MP bars.
  ctx.textAlign = 'left';
  const barX = 176;
  const barW = 470;

  const bar = (y: number, value: number, from: string, to: string, label: string) => {
    ctx.fillStyle = 'rgba(10, 12, 20, 0.72)';
    roundRect(ctx, barX, y, barW, 30, 15);
    ctx.fill();
    const fill = ctx.createLinearGradient(barX, y, barX + barW, y);
    fill.addColorStop(0, from);
    fill.addColorStop(1, to);
    ctx.fillStyle = fill;
    roundRect(ctx, barX + 3, y + 3, Math.max(24, (barW - 6) * value), 24, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.font = `700 22px ${KO}`;
    ctx.fillText(label, barX + 14, y + 22);
  };

  bar(90, hp, '#ff4f63', '#ff9a6a', '체력');
  bar(132, mp, '#4d9bff', '#7ee8ff', '마나');

  // Currency counters.
  ctx.textAlign = 'right';
  ctx.font = `700 34px ${KO}`;
  ctx.fillStyle = 'rgba(10, 12, 20, 0.6)';
  roundRect(ctx, WIDTH - 380, 84, 300, 46, 23);
  ctx.fill();
  roundRect(ctx, WIDTH - 380, 140, 300, 46, 23);
  ctx.fill();

  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(WIDTH - 352, 107, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8be0ff';
  ctx.beginPath();
  ctx.moveTo(WIDTH - 352, 146);
  ctx.lineTo(WIDTH - 335, 163);
  ctx.lineTo(WIDTH - 352, 180);
  ctx.lineTo(WIDTH - 369, 163);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText('1,284,300', WIDTH - 104, 119);
  ctx.fillText('9,820', WIDTH - 104, 175);

  // Stage name.
  ctx.textAlign = 'center';
  ctx.font = `700 34px ${KO}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fillText('3-7  마왕의 성', WIDTH / 2, 250);

  // Combo counter, pulsing on the attack beat.
  const {local, index} = attackAt(t);
  if (index > 0) {
    const pop = 1 + Math.max(0, 0.3 - local) * 1.2;
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT * 0.30);
    ctx.scale(pop, pop);
    ctx.font = `900 62px ${KO}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillStyle = '#ffe08a';
    ctx.strokeText(`COMBO x${index}`, 0, 0);
    ctx.fillText(`COMBO x${index}`, 0, 0);
    ctx.restore();
  }

  // Virtual stick.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(200, HEIGHT - 260, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.arc(200 + Math.sin(t * 1.7) * 54, HEIGHT - 260 + Math.cos(t * 1.3) * 42, 52, 0, Math.PI * 2);
  ctx.fill();

  // Skill buttons with cooldown sweeps.
  const skills = [
    {glyph: '⚔', cooldown: 1.5, color: '#ff6b6b'},
    {glyph: '✦', cooldown: 2.4, color: '#6bb8ff'},
    {glyph: '❖', cooldown: 3.6, color: '#c48bff'},
    {glyph: '✚', cooldown: 5.0, color: '#7ee88a'},
  ];

  skills.forEach((skill, i) => {
    const cx = WIDTH - 150 - i * 168;
    const cy = HEIGHT - 250 + (i % 2 === 0 ? 0 : -110);
    const r = 74;

    ctx.fillStyle = 'rgba(12, 16, 28, 0.78)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skill.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `700 52px ${KO}`;
    ctx.textAlign = 'center';
    ctx.fillText(skill.glyph, cx, cy + 18);

    const phase = (t % skill.cooldown) / skill.cooldown;
    if (phase < 0.75) {
      ctx.fillStyle = 'rgba(4, 6, 12, 0.6)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (1 - phase / 0.75) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Source timecode, so a trim point is readable in the finished video.
  const seconds = Math.floor(t);
  ctx.textAlign = 'center';
  ctx.font = `700 30px ${KO}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText(
    `예시용 대체 소재 · 원본 00:${String(seconds).padStart(2, '0')}`,
    WIDTH / 2,
    HEIGHT - 60,
  );
};

export const drawFrame = (ctx: CanvasRenderingContext2D, t: number) => {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#0b0f22');
  sky.addColorStop(0.45, '#231a41');
  sky.addColorStop(1, '#46264d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Moon and its glow.
  const glow = ctx.createRadialGradient(WIDTH * 0.72, HEIGHT * 0.20, 20, WIDTH * 0.72, HEIGHT * 0.20, 420);
  glow.addColorStop(0, 'rgba(255, 226, 168, 0.55)');
  glow.addColorStop(1, 'rgba(255, 226, 168, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.6);
  ctx.fillStyle = '#ffe9bd';
  ctx.beginPath();
  ctx.arc(WIDTH * 0.72, HEIGHT * 0.20, 96, 0, Math.PI * 2);
  ctx.fill();

  // Embers drifting up.
  STARS.forEach((star) => {
    const y = (star.y - t * 26) % (HEIGHT * 0.72);
    const alpha = 0.35 + 0.45 * Math.sin(t * 2 + star.phase);
    ctx.fillStyle = `rgba(255, 214, 170, ${Math.max(0.08, alpha)})`;
    ctx.beginPath();
    ctx.arc(star.x, y < 0 ? y + HEIGHT * 0.72 : y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Two mountain layers, parallax.
  mountains(ctx, HEIGHT * 0.62, t * 9, 5, 420, '#1a1c3a');
  mountains(ctx, HEIGHT * 0.68, t * 20, 8, 240, '#121527');

  // Ground.
  const ground = ctx.createLinearGradient(0, HEIGHT * 0.66, 0, HEIGHT);
  ground.addColorStop(0, '#1d1729');
  ground.addColorStop(1, '#0a0810');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HEIGHT * 0.68, WIDTH, HEIGHT * 0.32);
  ctx.strokeStyle = 'rgba(190, 150, 255, 0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT * 0.68);
  ctx.lineTo(WIDTH, HEIGHT * 0.68);
  ctx.stroke();

  // Scrolling floor tiles, to make the movement obvious.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i += 1) {
    const x = ((i * 160 - t * 150) % (WIDTH + 320)) - 160;
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT * 0.69);
    ctx.lineTo(x - 120, HEIGHT);
    ctx.stroke();
  }

  slime(ctx, t, WIDTH * 0.72, HEIGHT * 0.66, 0.8, '#7ce3a1', 0);
  slime(ctx, t, WIDTH * 0.88, HEIGHT * 0.72, 1.0, '#8ab6ff', 0.4);
  hero(ctx, t);
  slime(ctx, t, WIDTH * 0.60, HEIGHT * 0.76, 1.15, '#ff9f7c', 0.8);
  damageNumbers(ctx, t);
  hud(ctx, t);
};
