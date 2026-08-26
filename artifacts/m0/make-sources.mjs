// M0 spike sources. Playwright's Chromium has no H.264 decoder in this container,
// so the repo's H.264 fixtures cannot be panel sources here. VP9/WebM instead.
//
// Four DISTINCT files, not one file used four times: Remotion's video cache keys
// on src, so reusing one would share a decoder and understate the 4-panel cost.
//
// 1920x1080 landscape on purpose — under `contain` a landscape source in a 9:16
// cell letterboxes hard, which is the blurred-backdrop worst case Q4 asks about.
import {execFile} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {promisify} from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);
const OUT = 'artifacts/m0/sources';
await mkdir(OUT, {recursive: true});

// Distinct hues so a sampled frame says which panel it came from.
const SOURCES = [
  {name: 'm0-a', hue: 'red'},
  {name: 'm0-b', hue: 'blue'},
  {name: 'm0-c', hue: 'green'},
  {name: 'm0-d', hue: 'magenta'},
];

for (const {name, hue} of SOURCES) {
  // testsrc2 gives moving detail so decode is not trivially cheap, and the
  // colour overlay keeps the four files visually separable.
  const args = [
    '-y',
    '-f', 'lavfi', '-i', `testsrc2=size=1920x1080:rate=30:duration=8`,
    '-f', 'lavfi', '-i', `color=c=${hue}:size=1920x1080:duration=8:rate=30`,
    '-filter_complex', '[0:v][1:v]blend=all_mode=overlay:all_opacity=0.35[v]',
    '-map', '[v]',
    '-c:v', 'libvpx-vp9', '-b:v', '4M', '-deadline', 'good', '-cpu-used', '4',
    '-pix_fmt', 'yuv420p', '-an',
    `${OUT}/${name}.webm`,
  ];
  const started = Date.now();
  await run(ffmpegPath, args, {maxBuffer: 32 * 1024 * 1024});
  console.log(`${name}.webm  ${Date.now() - started}ms`);
}
