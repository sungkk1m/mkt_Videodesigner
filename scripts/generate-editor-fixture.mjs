// Creates the real H.264/AAC footage used by the module-3a editor E2E and by the
// Day1 module-6 E2E.
//
// Every source second is a distinct solid color, so a sampled output frame
// identifies exactly which part of the source was used. That makes trim offsets
// and scene boundaries verifiable from the rendered MP4 alone.
//
// Day1 Design Ref: §8.2 — Day1 needs a *second*, visibly different source, and
// both panels have to be measurably saturated for the SC2 grayscale check. The
// second fixture is portrait with its own palette so a sampled panel identifies
// which source it came from as well as whether it was desaturated.
import {execFile} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDirectory = resolve(projectRoot, 'tests/fixtures');

/** One color per source second. Chosen to stay separable after 4:2:0 encoding. */
const SECOND_COLORS = [
  '#e6194b',
  '#3cb44b',
  '#ffe119',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#46f0f0',
  '#f032e6',
  '#008080',
  '#9a6324',
  '#800000',
  '#000075',
];

/**
 * Panel B's palette. Disjoint from `SECOND_COLORS` so a sampled pixel says which
 * source it came from, and saturated throughout so "grayscale" is a real signal.
 */
const PANEL_B_COLORS = [
  '#ff7f00',
  '#00b3ff',
  '#c1ff00',
  '#ff00a0',
  '#00ff9b',
  '#7b00ff',
  '#ffd000',
  '#0044ff',
  '#ff2e00',
  '#00e0c0',
  '#b000ff',
  '#5cff00',
];

const FIXTURES = [
  {
    name: 'gameplay-sample',
    colors: SECOND_COLORS,
    size: '1920x1080',
    tone: 440,
  },
  {
    name: 'day1-panel-b',
    colors: PANEL_B_COLORS,
    size: '1080x1920',
    // A different tone, so an audio check can tell the two panels apart too.
    tone: 660,
  },
];

await mkdir(fixtureDirectory, {recursive: true});

for (const {name, colors, size, tone} of FIXTURES) {
  const outputPath = resolve(fixtureDirectory, `${name}.mp4`);
  const manifestPath = resolve(fixtureDirectory, `${name}.colors.json`);
  const inputArgs = colors.flatMap((color) => [
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=${size}:r=30:d=1`,
  ]);
  const concatInputs = colors.map((_, index) => `[${index}:v]`).join('');

  await execFileAsync('ffmpeg', [
    '-y',
    ...inputArgs,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=${tone}:sample_rate=48000:duration=${colors.length}`,
    '-filter_complex',
    `${concatInputs}concat=n=${colors.length}:v=1:a=0[v]`,
    '-map',
    '[v]',
    '-map',
    `${colors.length}:a`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    outputPath,
  ]);

  await writeFile(manifestPath, `${JSON.stringify(colors, null, 2)}\n`);

  process.stdout.write(`${outputPath}\n`);
}

/**
 * End card stills for the SC5 overlay-alignment check. Flat, unambiguous colors
 * on purpose: the test measures the *bounding box* of the icon overlay in the
 * rendered frame, so the icon's colour has to be unique in the frame and the
 * banner underneath has to be uniform.
 */
const STILLS = [
  {name: 'day1-endcard-banner', color: '#101820', size: '1080x1920'},
  {name: 'day1-app-icon', color: '#ff00ff', size: '512x512'},
];

for (const {name, color, size} of STILLS) {
  const stillPath = resolve(fixtureDirectory, `${name}.png`);

  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=${size}:d=1`,
    '-frames:v',
    '1',
    stillPath,
  ]);

  process.stdout.write(`${stillPath}\n`);
}
