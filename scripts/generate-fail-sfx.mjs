// failure-video Design §6.6 / Plan FR-11 — the stamp's impact hit, synthesised
// rather than sampled so there is no clip to licence and the file can be
// rebuilt from this script.
//
// Plan §1.2 measured a +8dB RMS spike at the slam against a -17.5dB programme
// average. What produces that shape is three layers over ~300ms:
//
//   - a body: a sine sweeping 150Hz -> 45Hz, which is the "thud" itself. The
//     downward sweep is what makes it read as weight landing rather than a beep.
//   - a click: a short burst of high noise on the first 12ms, so the attack has
//     an edge and survives a phone speaker with no low end at all.
//   - a tail: filtered noise under an exponential decay, the room the impact
//     happened in.
//
//   node scripts/generate-fail-sfx.mjs
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SAMPLE_RATE = 48_000;
const DURATION_SECONDS = 0.32;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const SAMPLE_COUNT = Math.round(SAMPLE_RATE * DURATION_SECONDS);
const DATA_SIZE = SAMPLE_COUNT * CHANNELS * BYTES_PER_SAMPLE;

const BODY_START_HZ = 150;
const BODY_END_HZ = 45;
const BODY_DECAY = 14;
const CLICK_SECONDS = 0.012;
const TAIL_DECAY = 22;
/** Headroom: the mix already carries game audio, and this sits on top of it. */
const PEAK = 0.82;

const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/compositions/failure/assets/fail-thud.wav',
);

const buffer = Buffer.alloc(44 + DATA_SIZE);
const writeString = (offset, value) => buffer.write(value, offset, 'ascii');

writeString(0, 'RIFF');
buffer.writeUInt32LE(36 + DATA_SIZE, 4);
writeString(8, 'WAVE');
writeString(12, 'fmt ');
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28);
buffer.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32);
buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
writeString(36, 'data');
buffer.writeUInt32LE(DATA_SIZE, 40);

/**
 * A fixed 32-bit PRNG rather than `Math.random`, so re-running this script
 * reproduces the same wav byte for byte — the noise layers are the only random
 * thing here and a regenerable asset must not drift.
 */
let seed = 0x9e3779b9;
const noise = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;

  return (seed / 0xffffffff) * 2 - 1;
};

// One-pole low-pass state for the tail, so it is a rumble and not a hiss.
let lowPassed = 0;
const samples = new Float64Array(SAMPLE_COUNT);
let phase = 0;

for (let index = 0; index < SAMPLE_COUNT; index += 1) {
  const seconds = index / SAMPLE_RATE;
  const sweep = seconds / DURATION_SECONDS;
  const frequency = BODY_START_HZ + (BODY_END_HZ - BODY_START_HZ) * sweep;

  // Integrating the frequency keeps the phase continuous through the sweep;
  // computing `sin(2*pi*f(t)*t)` directly would jump every sample.
  phase += (2 * Math.PI * frequency) / SAMPLE_RATE;

  const body = Math.sin(phase) * Math.exp(-BODY_DECAY * seconds);
  const click =
    seconds < CLICK_SECONDS
      ? noise() * (1 - seconds / CLICK_SECONDS) ** 2 * 0.7
      : 0;

  lowPassed += (noise() - lowPassed) * 0.06;
  const tail = lowPassed * Math.exp(-TAIL_DECAY * seconds) * 1.6;

  samples[index] = body + click + tail;
}

const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
const gain = peak > 0 ? PEAK / peak : 0;

for (let index = 0; index < SAMPLE_COUNT; index += 1) {
  // A 2ms fade at each end so the clip cannot click on its own boundaries.
  const fadeSamples = Math.round(SAMPLE_RATE * 0.002);
  const fade = Math.min(
    1,
    index / fadeSamples,
    (SAMPLE_COUNT - 1 - index) / fadeSamples,
  );
  const value = Math.max(-1, Math.min(1, samples[index] * gain * fade));

  buffer.writeInt16LE(Math.round(value * 0x7fff), 44 + index * BYTES_PER_SAMPLE);
}

await mkdir(dirname(outputPath), {recursive: true});
await writeFile(outputPath, buffer);

console.log(
  `fail-thud.wav  ${(DURATION_SECONDS * 1000).toFixed(0)}ms  ${(buffer.length / 1024).toFixed(1)}KB`,
);
