// kv-ai-designation P0 — fetches everything the spike serves, into out/.
//
// Kept apart from run.mjs so the download happens once and the measurement can
// be repeated without touching the network. Every asset is pinned: the runtime
// by npm version, the models by the versioned MediaPipe storage path.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const VENDOR = join(OUT, 'vendor');
const MODELS = join(OUT, 'models');

const RUNTIME = '@mediapipe/tasks-vision@1.0.1';
const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models';
const MODEL_PATHS = [
  'interactive_segmenter/magic_touch/float32/1/magic_touch.tflite',
  'interactive_segmenter_v2/magic_touch/int8/1/interactive_segmentation.task',
  'object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite',
];

mkdirSync(VENDOR, {recursive: true});
mkdirSync(MODELS, {recursive: true});

if (!existsSync(join(VENDOR, 'package/vision_bundle.mjs'))) {
  const tgz = execFileSync('npm', ['pack', RUNTIME], {cwd: VENDOR})
    .toString()
    .trim()
    .split('\n')
    .pop();

  execFileSync('tar', ['xzf', tgz], {cwd: VENDOR});
  console.log(`runtime  ${RUNTIME}`);
}

for (const path of MODEL_PATHS) {
  const name = path.split('/').pop();
  const file = join(MODELS, name);

  if (!existsSync(file)) {
    execFileSync('curl', ['-sSf', '-o', file, `${MODEL_BASE}/${path}`]);
  }

  console.log(`model    ${name}  ${statSync(file).size} bytes`);
}

for (const name of [
  'package/wasm/vision_wasm_internal.wasm',
  'package/wasm/vision_wasm_internal.js',
]) {
  console.log(`runtime  ${name}  ${statSync(join(VENDOR, name)).size} bytes`);
}
