import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SAMPLE_RATE = 48_000;
const DURATION_SECONDS = 15;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const SAMPLE_COUNT = SAMPLE_RATE * DURATION_SECONDS;
const DATA_SIZE = SAMPLE_COUNT * CHANNELS * BYTES_PER_SAMPLE;
const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/poc-tone.wav',
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

for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
  const secondPosition = sampleIndex / SAMPLE_RATE;
  const envelope = secondPosition % 1 < 0.18 ? 1 : 0;
  const sample =
    Math.sin(2 * Math.PI * 440 * secondPosition) * 0.08 * envelope;
  buffer.writeInt16LE(
    Math.round(sample * 0x7fff),
    44 + sampleIndex * BYTES_PER_SAMPLE,
  );
}

await mkdir(dirname(outputPath), {recursive: true});
await writeFile(outputPath, buffer);
