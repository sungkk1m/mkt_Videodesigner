// Creates the real H.264/AAC footage used by the module-3a editor E2E.
//
// Every source second is a distinct solid color, so a sampled output frame
// identifies exactly which part of the source was used. That makes trim offsets
// and scene boundaries verifiable from the rendered MP4 alone.
import {execFile} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDirectory = resolve(projectRoot, 'tests/fixtures');
const outputPath = resolve(fixtureDirectory, 'gameplay-sample.mp4');
const manifestPath = resolve(fixtureDirectory, 'gameplay-sample.colors.json');

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

const inputArgs = SECOND_COLORS.flatMap((color) => [
  '-f',
  'lavfi',
  '-i',
  `color=c=${color}:s=1920x1080:r=30:d=1`,
]);

const concatInputs = SECOND_COLORS.map((_, index) => `[${index}:v]`).join('');

await mkdir(fixtureDirectory, {recursive: true});

await execFileAsync('ffmpeg', [
  '-y',
  ...inputArgs,
  '-f',
  'lavfi',
  '-i',
  `sine=frequency=440:sample_rate=48000:duration=${SECOND_COLORS.length}`,
  '-filter_complex',
  `${concatInputs}concat=n=${SECOND_COLORS.length}:v=1:a=0[v]`,
  '-map',
  '[v]',
  '-map',
  `${SECOND_COLORS.length}:a`,
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

await writeFile(manifestPath, `${JSON.stringify(SECOND_COLORS, null, 2)}\n`);

process.stdout.write(`${outputPath}\n`);
