// Reads the four cell crops that verify-quad-ui.mjs wrote and reports each
// cell's mean saturation. Plan Q2 / SC3: at frame 0 panel A is live and in
// colour, the other three are frozen and desaturated.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const fails = [];
for (const slot of ['a', 'b', 'c', 'd']) {
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-i', `artifacts/m1/cell-${slot}.png`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', `/tmp/cell-${slot}.raw`,
  ]);
  const raw = readFileSync(`/tmp/cell-${slot}.raw`);
  let total = 0;
  let count = 0;
  for (let i = 0; i + 2 < raw.length; i += 3) {
    const [r, g, b] = [raw[i], raw[i + 1], raw[i + 2]];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    total += max === 0 ? 0 : (max - min) / max;
    count += 1;
  }
  const saturation = total / count;
  const live = slot === 'a';
  const ok = live ? saturation > 0.25 : saturation < 0.05;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  panel ${slot.toUpperCase()} ` +
      `${live ? 'is live and in colour' : 'is frozen and greyscale'} ` +
      `— mean saturation ${saturation.toFixed(3)}`,
  );
  if (!ok) fails.push(slot);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nQ2/SC3 holds in the preview');
process.exit(fails.length ? 1 : 0);
