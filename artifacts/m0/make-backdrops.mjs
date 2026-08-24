// Pre-blurred backdrop stills for the M0 degradation variant.
//
// The real backdrop is already a still — `<Freeze frame={0}>` over the source —
// drawn with objectFit:cover, scale(1.2) overscan, and CSS blur(0.05 * cellW).
// The renderer re-rasterises that blur on EVERY frame. Baking it into a bitmap
// removes the per-frame blur and the per-frame video draw both.
//
// The blur kernel here (ffmpeg gblur) is not pixel-identical to CSS blur(); this
// is a PERFORMANCE probe. Visual equivalence is an M4 question.
import {execFile} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {promisify} from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);
const OUT = 'artifacts/m0/backdrops';
await mkdir(OUT, {recursive: true});

// Two cell geometries, because the backdrop is baked at the size it is drawn at.
// Quad cell and Day1 panel at 1080x1920 with a 6px divider.
const CELLS = [
  {tag: 'quad', w: 537, h: 957},
  {tag: 'day1', w: 1080, h: 957},
];
const OVERSCAN = 1.2;

for (const {tag, w, h} of CELLS) {
  // The same ratio SplitFrame uses: blur(0.05 * cellWidth).
  const sigma = 0.05 * w;
  const W = Math.round(w * OVERSCAN);
  const H = Math.round(h * OVERSCAN);

  for (const name of ['m0-a', 'm0-b', 'm0-c', 'm0-d']) {
    for (const [suffix, grey] of [['color', false], ['grey', true]]) {
      const chain = [
        // cover the overscanned cell then crop to it — the geometry the
        // element's objectFit:cover + scale(1.2) produces
        `scale=${W}:${H}:force_original_aspect_ratio=increase`,
        `crop=${W}:${H}`,
        grey ? 'format=gray,format=rgb24' : null,
        `gblur=sigma=${sigma.toFixed(2)}`,
      ].filter(Boolean).join(',');

      await run(ffmpegPath, [
        '-y', '-i', `artifacts/m0/sources/${name}.webm`,
        '-vf', chain, '-frames:v', '1',
        `${OUT}/${tag}-${name}-${suffix}.png`,
      ], {maxBuffer: 32 * 1024 * 1024});
    }
  }
  console.log(`${tag} backdrops done (cell ${w}x${h}, sigma ${sigma.toFixed(2)})`);
}
