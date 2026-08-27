// Draws a stand-in "mobile game capture" frame, deterministically from t.
//
// The repository ships no game footage (`tests/fixtures/*.mp4` is gitignored and
// is colour bars anyway), and colour bars say nothing to a reader who wants to
// see what the 3장면 template looks like. So the example's source clip is drawn
// here.
//
// The art direction follows the operator's own key visuals — a snowy forest, a
// hooded traveller with a trailing scarf, a fox companion, pale blue on white —
// so the example reads as the kind of footage the template will actually carry.
// It is a placeholder, not the game: the on-screen label says so in every frame.
//
// Every value is a function of `t` alone — no Math.random at draw time — so the
// same clip comes out of every run.

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 60;
/** Long enough for the 30s preset's 24s gameplay window plus a trim offset. */
export const SECONDS = 26;

const KO = '"Noto Sans KR", system-ui, sans-serif';

/** Winter palette, sampled from the key visuals. */
const SKY_TOP = '#e8f2fa';
const SKY_MID = '#c3ddf0';
const SKY_LOW = '#9dc3e0';
const PINE_FAR = '#b6d2e6';
const PINE_MID = '#8fb4d2';
const PINE_NEAR = '#5c85ab';
const SNOW = '#f4fafe';
const SNOW_SHADE = '#d5e7f4';
const COAT = '#2f5f9e';
const COAT_DARK = '#1d3f6e';
const SCARF = '#4a3d6e';
const HAIR = '#f0ead8';
const MINT = '#7fd8d0';
const FOX = '#ef8c3c';

/** Deterministic 0..1 sequence, so the snow field is identical every run. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FLAKES = Array.from({length: 120}, (_, index) => {
  const a = mulberry32(index * 5 + 1)();
  const b = mulberry32(index * 5 + 2)();
  const c = mulberry32(index * 5 + 3)();

  return {
    x: a * WIDTH,
    y: b * HEIGHT,
    size: 2 + c * 6,
    speed: 26 + c * 70,
    sway: 18 + a * 44,
    phase: b * 6.28,
  };
});

/** One attack every 1.6s; every third lands as a critical. */
const ATTACK_PERIOD = 1.6;
const attackAt = (t: number) => {
  const index = Math.floor(t / ATTACK_PERIOD);

  return {index, local: t - index * ATTACK_PERIOD, critical: index % 3 === 1};
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

/** A row of conifer silhouettes, drifting for parallax. */
const pines = (
  ctx: CanvasRenderingContext2D,
  baseY: number,
  offset: number,
  spacing: number,
  height: number,
  color: string,
) => {
  ctx.fillStyle = color;

  for (let i = -1; i < WIDTH / spacing + 2; i += 1) {
    const x = i * spacing - (offset % spacing);
    const h = height * (0.72 + 0.28 * Math.sin(i * 1.7));
    const w = h * 0.34;

    // Three stacked tiers, the way a stylised pine reads at a glance.
    for (let tier = 0; tier < 3; tier += 1) {
      const tierY = baseY - h * (0.22 + tier * 0.26);
      const tierW = w * (1 - tier * 0.22);
      ctx.beginPath();
      ctx.moveTo(x, tierY - h * 0.34);
      ctx.lineTo(x + tierW, tierY);
      ctx.lineTo(x - tierW, tierY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillRect(x - w * 0.07, baseY - h * 0.24, w * 0.14, h * 0.24);
  }
};

const traveller = (ctx: CanvasRenderingContext2D, t: number) => {
  const {local, critical} = attackAt(t);
  const swinging = local < 0.45;
  const swing = swinging ? local / 0.45 : 0;
  const x = WIDTH * 0.34;
  const groundY = HEIGHT * 0.74;
  const bob = Math.sin(t * 3.1) * 8;
  const y = groundY + bob;

  ctx.fillStyle = 'rgba(70, 110, 150, 0.22)';
  ctx.beginPath();
  ctx.ellipse(x, groundY + 16, 132, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Scarf, trailing behind on the wind.
  ctx.fillStyle = SCARF;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 268);
  ctx.quadraticCurveTo(
    x - 150 - Math.sin(t * 1.9) * 40,
    y - 210 + Math.cos(t * 2.3) * 30,
    x - 250 - Math.sin(t * 1.3) * 50,
    y - 130 + Math.sin(t * 2.1) * 26,
  );
  ctx.quadraticCurveTo(x - 130, y - 176, x + 6, y - 216);
  ctx.closePath();
  ctx.fill();

  // Coat: a long silhouette that flares at the hem.
  const coat = ctx.createLinearGradient(x - 90, y - 280, x + 90, y);
  coat.addColorStop(0, COAT);
  coat.addColorStop(1, COAT_DARK);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(x - 58, y - 270);
  ctx.lineTo(x + 58, y - 270);
  ctx.quadraticCurveTo(x + 104, y - 90, x + 88, y);
  ctx.lineTo(x - 88, y);
  ctx.quadraticCurveTo(x - 104, y - 90, x - 58, y - 270);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = MINT;
  roundRect(ctx, x - 60, y - 214, 120, 14, 7);
  ctx.fill();

  // Head, mask, hair.
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.arc(x, y - 312, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37455e';
  ctx.beginPath();
  ctx.ellipse(x + 6, y - 300, 34, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.arc(x, y - 326, 48, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();

  // Ponytail, swinging with the walk cycle.
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 336);
  ctx.quadraticCurveTo(
    x - 150 - Math.sin(t * 2.6) * 26,
    y - 300,
    x - 176 - Math.sin(t * 2.2) * 30,
    y - 170,
  );
  ctx.quadraticCurveTo(x - 108, y - 250, x - 26, y - 306);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = MINT;
  roundRect(ctx, x - 62, y - 342, 34, 16, 8);
  ctx.fill();

  // Sword.
  const angle = swinging
    ? -2.0 + Math.sin(swing * Math.PI) * 2.7
    : -0.42 + Math.sin(t * 3.1) * 0.06;
  ctx.save();
  ctx.translate(x + 46, y - 196);
  ctx.rotate(angle);
  ctx.fillStyle = '#8a6a44';
  roundRect(ctx, -14, -18, 42, 26, 8);
  ctx.fill();
  const blade = ctx.createLinearGradient(0, 0, 260, 0);
  blade.addColorStop(0, '#ffffff');
  blade.addColorStop(1, '#a8cfe8');
  ctx.fillStyle = blade;
  roundRect(ctx, 26, -12, 250, 24, 12);
  ctx.fill();
  ctx.restore();

  // Slash arc: a cold, bright sweep.
  if (swinging && swing > 0.15 && swing < 0.85) {
    const alpha = Math.sin(((swing - 0.15) / 0.7) * Math.PI);
    ctx.strokeStyle = critical
      ? `rgba(127, 216, 208, ${alpha})`
      : `rgba(255, 255, 255, ${alpha * 0.92})`;
    ctx.lineWidth = 20 + alpha * 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x + 96, y - 206, 260, -1.35 + swing * 1.6, 0.45 + swing * 1.6);
    ctx.stroke();
  }
};

/** The fox companion, trotting a little behind and below. */
const fox = (ctx: CanvasRenderingContext2D, t: number) => {
  const x = WIDTH * 0.66 + Math.sin(t * 1.15) * 34;
  const groundY = HEIGHT * 0.81;
  const hop = Math.abs(Math.sin(t * 3.6)) * 22;
  const y = groundY - hop;

  ctx.fillStyle = 'rgba(70, 110, 150, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, groundY + 14, 74, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = FOX;
  // Tail.
  ctx.beginPath();
  ctx.moveTo(x + 46, y - 40);
  ctx.quadraticCurveTo(x + 132 + Math.sin(t * 3.4) * 18, y - 96, x + 92, y - 6);
  ctx.quadraticCurveTo(x + 74, y - 42, x + 40, y - 22);
  ctx.closePath();
  ctx.fill();
  // Body and legs.
  ctx.beginPath();
  ctx.ellipse(x, y - 40, 60, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 40, y - 20, 16, 26);
  ctx.fillRect(x + 22, y - 20, 16, 26);
  // Head and ears.
  ctx.beginPath();
  ctx.arc(x - 54, y - 62, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 74, y - 84);
  ctx.lineTo(x - 62, y - 122);
  ctx.lineTo(x - 46, y - 86);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fdf3e6';
  ctx.beginPath();
  ctx.ellipse(x - 78, y - 56, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#33455c';
  ctx.beginPath();
  ctx.arc(x - 62, y - 64, 5, 0, Math.PI * 2);
  ctx.fill();
};

/** A frost sprite: the thing being fought, drawn as a snow wisp. */
const sprite = (
  ctx: CanvasRenderingContext2D,
  t: number,
  cx: number,
  cy: number,
  scale: number,
  phase: number,
) => {
  const {local, critical} = attackAt(t + phase);
  const hit = local > 0.3 && local < 0.52;
  const float = Math.sin((t + phase) * 2.2) * 26;
  const x = cx + Math.sin((t + phase) * 0.9) * 30;
  const y = cy + float;
  const r = 62 * scale * (hit ? 1.12 : 1);

  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 6, x, y, r * 1.5);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.5, hit && critical ? MINT : '#bfe0f2');
  body.addColorStop(1, 'rgba(140, 190, 220, 0.15)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Six frost arms.
  ctx.strokeStyle = hit ? 'rgba(255,255,255,0.95)' : 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 5 * scale;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + t * 0.6;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    ctx.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
    ctx.stroke();
  }

  ctx.fillStyle = '#3a5878';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.1, 8 * scale, 13 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.3, y - r * 0.1, 8 * scale, 13 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** Damage numbers rise and fade from the beat they were struck on. */
const damageNumbers = (ctx: CanvasRenderingContext2D, t: number) => {
  ctx.textAlign = 'center';

  for (let back = 0; back < 3; back += 1) {
    const index = Math.floor(t / ATTACK_PERIOD) - back;

    if (index < 0) {
      continue;
    }

    const age = t - (index * ATTACK_PERIOD + 0.34);

    if (age < 0 || age > 0.95) {
      continue;
    }

    const critical = index % 3 === 1;
    const alpha = 1 - age / 0.95;
    const x = WIDTH * (0.63 + ((index % 3) - 1) * 0.1);
    const y = HEIGHT * 0.56 - age * 200;
    const pop = 1 + Math.max(0, 0.25 - age) * 1.6;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.font = `900 ${critical ? 82 : 62}px ${KO}`;
    ctx.lineWidth = 11;
    ctx.strokeStyle = `rgba(28, 52, 80, ${alpha * 0.85})`;
    ctx.fillStyle = critical
      ? `rgba(127, 232, 220, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`;
    const label = critical ? '-12,480' : '-3,260';
    ctx.strokeText(label, 0, 0);
    ctx.fillText(label, 0, 0);

    if (critical) {
      ctx.font = `900 38px ${KO}`;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.strokeText('치명타!', 0, 46);
      ctx.fillText('치명타!', 0, 46);
    }

    ctx.restore();
  }
};

const hud = (ctx: CanvasRenderingContext2D, t: number) => {
  const hp = 0.46 + 0.26 * (0.5 + 0.5 * Math.sin(t * 0.65));
  const mp = 0.38 + 0.44 * (0.5 + 0.5 * Math.sin(t * 1.2 + 1));

  // Level badge.
  const badge = ctx.createLinearGradient(44, 74, 156, 184);
  badge.addColorStop(0, '#ffffff');
  badge.addColorStop(1, MINT);
  ctx.fillStyle = badge;
  ctx.beginPath();
  ctx.arc(100, 128, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(45, 80, 120, 0.5)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#1d3f6e';
  ctx.textAlign = 'center';
  ctx.font = `900 44px ${KO}`;
  ctx.fillText('37', 100, 144);
  ctx.font = `700 20px ${KO}`;
  ctx.fillText('Lv', 100, 100);

  // HP / MP bars.
  const barX = 176;
  const barW = 470;
  const bar = (y: number, value: number, from: string, to: string, label: string) => {
    ctx.fillStyle = 'rgba(28, 52, 82, 0.55)';
    roundRect(ctx, barX, y, barW, 30, 15);
    ctx.fill();
    const fill = ctx.createLinearGradient(barX, y, barX + barW, y);
    fill.addColorStop(0, from);
    fill.addColorStop(1, to);
    ctx.fillStyle = fill;
    roundRect(ctx, barX + 3, y + 3, Math.max(26, (barW - 6) * value), 24, 12);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = `700 22px ${KO}`;
    ctx.fillText(label, barX + 14, y + 22);
  };

  bar(90, hp, '#5fd0c6', '#b9f0ea', '체력');
  bar(132, mp, '#4d8fd8', '#a9d4f5', '마나');

  // Currency counters.
  ctx.fillStyle = 'rgba(28, 52, 82, 0.45)';
  roundRect(ctx, WIDTH - 380, 84, 300, 46, 23);
  ctx.fill();
  roundRect(ctx, WIDTH - 380, 140, 300, 46, 23);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(WIDTH - 352, 107, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MINT;
  ctx.beginPath();
  ctx.moveTo(WIDTH - 352, 146);
  ctx.lineTo(WIDTH - 335, 163);
  ctx.lineTo(WIDTH - 352, 180);
  ctx.lineTo(WIDTH - 369, 163);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 34px ${KO}`;
  ctx.fillText('1,284,300', WIDTH - 104, 119);
  ctx.fillText('9,820', WIDTH - 104, 175);

  // Stage name.
  ctx.textAlign = 'center';
  ctx.font = `700 34px ${KO}`;
  ctx.fillStyle = 'rgba(32, 58, 88, 0.78)';
  ctx.fillText('2-4  얼어붙은 숲', WIDTH / 2, 250);

  // Combo counter.
  const {local, index} = attackAt(t);
  if (index > 0) {
    const pop = 1 + Math.max(0, 0.3 - local) * 1.1;
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT * 0.30);
    ctx.scale(pop, pop);
    ctx.font = `900 58px ${KO}`;
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillStyle = '#2f6ba8';
    ctx.strokeText(`COMBO x${index}`, 0, 0);
    ctx.fillText(`COMBO x${index}`, 0, 0);
    ctx.restore();
  }

  // Virtual stick.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(200, HEIGHT - 260, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(
    200 + Math.sin(t * 1.6) * 54,
    HEIGHT - 260 + Math.cos(t * 1.25) * 42,
    52,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Skill buttons with cooldown sweeps.
  const skills = [
    {glyph: '⚔', cooldown: 1.6, color: '#2f6ba8'},
    {glyph: '❄', cooldown: 2.6, color: '#5fd0c6'},
    {glyph: '✦', cooldown: 3.8, color: '#8f7fd0'},
    {glyph: '✚', cooldown: 5.2, color: '#63b487'},
  ];

  skills.forEach((skill, i) => {
    const cx = WIDTH - 150 - i * 168;
    const cy = HEIGHT - 250 + (i % 2 === 0 ? 0 : -110);
    const r = 74;

    ctx.fillStyle = 'rgba(244, 250, 254, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skill.color;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = skill.color;
    ctx.font = `700 52px ${KO}`;
    ctx.textAlign = 'center';
    ctx.fillText(skill.glyph, cx, cy + 18);

    const phase = (t % skill.cooldown) / skill.cooldown;
    if (phase < 0.75) {
      ctx.fillStyle = 'rgba(40, 70, 105, 0.45)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (1 - phase / 0.75) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Placeholder notice and source timecode, readable in the finished video.
  const seconds = Math.floor(t);
  ctx.textAlign = 'center';
  ctx.font = `700 30px ${KO}`;
  ctx.fillStyle = 'rgba(36, 62, 92, 0.6)';
  ctx.fillText(
    `예시용 대체 소재 · 원본 00:${String(seconds).padStart(2, '0')}`,
    WIDTH / 2,
    HEIGHT - 60,
  );
};

export const drawFrame = (ctx: CanvasRenderingContext2D, t: number) => {
  // Sky: bright winter overcast.
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.45, SKY_MID);
  sky.addColorStop(1, SKY_LOW);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A pale sun behind the cloud.
  const glow = ctx.createRadialGradient(
    WIDTH * 0.7,
    HEIGHT * 0.17,
    20,
    WIDTH * 0.7,
    HEIGHT * 0.17,
    460,
  );
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.55);

  // Three parallax layers of conifers.
  pines(ctx, HEIGHT * 0.60, t * 7, 190, 460, PINE_FAR);
  pines(ctx, HEIGHT * 0.68, t * 17, 250, 620, PINE_MID);
  pines(ctx, HEIGHT * 0.76, t * 34, 330, 780, PINE_NEAR);

  // Snow ground.
  const ground = ctx.createLinearGradient(0, HEIGHT * 0.72, 0, HEIGHT);
  ground.addColorStop(0, SNOW);
  ground.addColorStop(1, SNOW_SHADE);
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT * 0.78);
  ctx.quadraticCurveTo(WIDTH * 0.3, HEIGHT * 0.74, WIDTH * 0.62, HEIGHT * 0.77);
  ctx.quadraticCurveTo(WIDTH * 0.85, HEIGHT * 0.79, WIDTH, HEIGHT * 0.75);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.lineTo(0, HEIGHT);
  ctx.closePath();
  ctx.fill();

  // Drifting snow mounds, so the ground reads as moving.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (let i = 0; i < 8; i += 1) {
    const x = ((i * 260 - t * 60) % (WIDTH + 520)) - 260;
    ctx.beginPath();
    ctx.ellipse(x, HEIGHT * 0.86 + (i % 3) * 90, 190, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  sprite(ctx, t, WIDTH * 0.74, HEIGHT * 0.52, 1.0, 0);
  sprite(ctx, t, WIDTH * 0.88, HEIGHT * 0.62, 0.75, 0.5);
  traveller(ctx, t);
  fox(ctx, t);
  sprite(ctx, t, WIDTH * 0.60, HEIGHT * 0.66, 1.25, 0.85);
  damageNumbers(ctx, t);

  // Falling snow, in front of everything.
  FLAKES.forEach((flake) => {
    const y = (flake.y + t * flake.speed) % (HEIGHT + 60);
    const x = flake.x + Math.sin(t * 0.9 + flake.phase) * flake.sway;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + 0.4 * Math.sin(t + flake.phase)})`;
    ctx.beginPath();
    ctx.arc(x, y, flake.size, 0, Math.PI * 2);
    ctx.fill();
  });

  hud(ctx, t);
};
