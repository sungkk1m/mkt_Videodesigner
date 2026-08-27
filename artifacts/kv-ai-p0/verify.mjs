// kv-ai-designation P0 — turns out/results.json into the tables the Plan quotes.
//
// Reads only; run.mjs owns the measuring. Two served configurations are
// reported side by side because GitHub Pages can only serve the first one.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const runs = JSON.parse(readFileSync(join(HERE, 'out/results.json'), 'utf8'));

const pad = (value, width) => String(value ?? '—').padEnd(width);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
const kb = (bytes) => `${(bytes / 1000).toFixed(1)}KB`;

for (const [label, run] of Object.entries(runs)) {
  console.log(
    `\n=== ${label}  (crossOriginIsolated=${run.environment.crossOriginIsolated}, ` +
      `SharedArrayBuffer=${run.environment.sharedArrayBuffer}, wall ${run.wallMs}ms)`,
  );
  console.log(
    `    webgl2=${run.environment.webgl2}  webgpu=${run.environment.webgpu}  ` +
      `cores=${run.environment.hardwareConcurrency}`,
  );

  if (run.fatal) {
    console.log(`    FATAL ${run.fatal}`);
    continue;
  }

  console.log('\n  runtime setup');

  for (const [key, value] of Object.entries(run.runtime)) {
    console.log(`    ${pad(key, 26)} ${value}`);
  }

  console.log('\n  click → mask  (IoU against the drawn ground truth)');
  console.log(
    `    ${pad('fixture', 11)}${pad('candidate', 14)}${pad('IoU', 7)}` +
      `${pad('first ms', 10)}${pad('warm ms', 10)}${pad('encode', 9)}` +
      `${pad('decode', 9)}${pad('refine', 9)}${pad('mask', 11)}`,
  );

  for (const fixture of run.fixtures) {
    for (const [id, value] of Object.entries(fixture.segmenters ?? {})) {
      if (!value) {
        continue;
      }

      console.log(
        `    ${pad(fixture.name, 11)}${pad(`mediapipe ${id}`, 14)}` +
          `${pad(value.iou, 7)}${pad(value.firstMs, 10)}${pad(value.warmMs, 10)}` +
          `${pad(value.warmEncodeMs, 9)}${pad(value.warmDecodeMs, 9)}` +
          `${pad(value.refineMs, 9)}${pad(value.maskSize, 11)}`,
      );
    }

    const fill = fixture.floodFill.best;
    console.log(
      `    ${pad(fixture.name, 11)}${pad('flood fill', 14)}${pad(fill.iou, 7)}` +
        `${pad(fill.ms, 10)}${pad(fill.ms, 10)}${pad('—', 9)}${pad('—', 9)}` +
        `${pad('—', 9)}${pad(`tol ${fill.tolerance}`, 11)}`,
    );
  }

  console.log('\n  automatic proposal  (box IoU against the object drawn)');
  console.log(
    `    ${pad('fixture', 11)}${pad('candidate', 16)}${pad('box IoU', 9)}` +
      `${pad('ms', 8)}detail`,
  );

  for (const fixture of run.fixtures) {
    if (fixture.detector) {
      const found = fixture.detector.detections
        .map((d) => `${d.label}:${d.score}`)
        .join(' ');
      console.log(
        `    ${pad(fixture.name, 11)}${pad('efficientdet0', 16)}` +
          `${pad(fixture.detector.bestBoxIou, 9)}${pad(fixture.detector.ms, 8)}` +
          `${found || 'nothing above 0.2'}`,
      );
    }

    console.log(
      `    ${pad(fixture.name, 11)}${pad('bright regions', 16)}` +
        `${pad(fixture.bright.bestBoxIou, 9)}${pad(fixture.bright.ms, 8)}` +
        `${fixture.bright.count} region(s), luma ≥ ${fixture.bright.threshold}`,
    );
  }

  console.log('\n  mask storage  (the project file cap is 1,000,000 bytes)');
  console.log(
    `    ${pad('fixture', 11)}${pad('resolution', 12)}${pad('IoU', 7)}` +
      `${pad('vs full', 9)}${pad('runs', 8)}${pad('RLE', 10)}${pad('PNG', 10)}` +
      `${pad('RLE b64', 10)}`,
  );

  for (const fixture of run.fixtures) {
    for (const row of fixture.storage ?? []) {
      console.log(
        `    ${pad(fixture.name, 11)}${pad(row.resolution, 12)}${pad(row.iou, 7)}` +
          `${pad(row.roundTripIou ?? '1.000', 9)}${pad(row.runs, 8)}` +
          `${pad(kb(row.bytes), 10)}${pad(kb(row.pngBytes), 10)}` +
          `${pad(kb(Math.ceil(row.bytes * 1.37)), 10)}`,
      );
    }
  }
}

const first = Object.values(runs)[0];
console.log('\n=== delivery weight (first use, uncached)');
console.log(`    mediapipe vision wasm (simd)      ${mb(11756954)}`);
console.log(`    magic_touch v1 tflite             ${mb(6227884)}`);
console.log(`    interactive_segmentation v2 task  ${mb(30525312)}`);
console.log(`    efficientdet_lite0 tflite         ${mb(13836895)}`);
console.log(
  `    → v1 click→mask total            ${mb(11756954 + 6227884)}` +
    `   v2 total ${mb(11756954 + 30525312)}`,
);
console.log(
  `\n    fixtures: ${first.fixtures.map((f) => f.name).join(', ')} ` +
    `(1080×1920, drawn — see fixtures.js for why)`,
);
