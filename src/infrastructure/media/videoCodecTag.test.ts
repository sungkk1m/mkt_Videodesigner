import {describe, expect, it} from 'vitest';

import {describeVideoCodecTag, readVideoCodecTag} from './videoCodecTag';

/** Blob only accepts views backed by a plain ArrayBuffer. */
type Bytes = Uint8Array<ArrayBuffer>;

const ascii = (text: string): Bytes => {
  const bytes = new Uint8Array(text.length);

  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }

  return bytes;
};

const concat = (parts: Bytes[]): Bytes => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
};

/** A 32-bit-size ISO-BMFF box. */
const box = (type: string, ...children: Bytes[]): Bytes => {
  const body = concat(children);
  const header = new Uint8Array(8);

  new DataView(header.buffer).setUint32(0, body.length + 8);
  header.set(ascii(type), 4);

  return concat([header, body]);
};

/** A box carrying a 64-bit largesize, which sets the 32-bit size field to 1. */
const largeBox = (type: string, ...children: Bytes[]): Bytes => {
  const body = concat(children);
  const header = new Uint8Array(16);
  const view = new DataView(header.buffer);

  view.setUint32(0, 1);
  header.set(ascii(type), 4);
  view.setBigUint64(8, BigInt(body.length + 16));

  return concat([header, body]);
};

/** stsd content: version+flags, entry_count, then the sample entry itself. */
const stsd = (codecTag: string, entryPayloadBytes = 70) =>
  box(
    'stsd',
    new Uint8Array([0, 0, 0, 0]),
    new Uint8Array([0, 0, 0, 1]),
    box(codecTag, new Uint8Array(entryPayloadBytes)),
  );

const isobmff = (
  codecTag: string,
  options: {boxFactory?: typeof box; leadingBoxes?: Bytes[]} = {},
) => {
  const make = options.boxFactory ?? box;

  return new Blob([
    ...(options.leadingBoxes ?? [box('ftyp', ascii('isom'))]),
    make(
      'moov',
      box('mvhd', new Uint8Array(100)),
      make('trak', make('mdia', make('minf', make('stbl', stsd(codecTag))))),
    ),
  ]);
};

describe('readVideoCodecTag', () => {
  it.each([
    ['avc1', 'H.264'],
    ['hvc1', 'HEVC'],
    ['mp4v', 'MPEG-4 Part 2'],
    ['av01', 'AV1'],
  ])('reads the %s sample entry', async (tag) => {
    await expect(readVideoCodecTag(isobmff(tag))).resolves.toBe(tag);
  });

  it('skips sibling boxes on the way to moov', async () => {
    const file = new Blob([
      box('ftyp', ascii('isom')),
      box('free', new Uint8Array(512)),
      box('mdat', new Uint8Array(4096)),
      box(
        'moov',
        box('mvhd', new Uint8Array(100)),
        box('trak', box('mdia', box('minf', box('stbl', stsd('hvc1'))))),
      ),
    ]);

    await expect(readVideoCodecTag(file)).resolves.toBe('hvc1');
  });

  it('handles 64-bit largesize headers', async () => {
    await expect(
      readVideoCodecTag(isobmff('avc1', {boxFactory: largeBox})),
    ).resolves.toBe('avc1');
  });

  it('returns null for a non-ISO-BMFF container', async () => {
    // WebM/Matroska EBML magic. These decode fine, so we never need the tag.
    const webm = new Blob([
      new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
      new Uint8Array(256),
    ]);

    await expect(readVideoCodecTag(webm)).resolves.toBeNull();
  });

  it.each([
    ['an empty file', new Blob([])],
    ['a truncated header', new Blob([new Uint8Array([0, 0, 0, 32, 109])])],
    ['a box whose size overruns the file', new Blob([ascii('\x00\x00\xff\xffmoov')])],
    ['a file with no stsd', new Blob([box('ftyp', ascii('isom')), box('moov', box('mvhd'))])],
  ])('returns null for %s rather than throwing', async (_label, file) => {
    await expect(readVideoCodecTag(file)).resolves.toBeNull();
  });
});

describe('describeVideoCodecTag', () => {
  it('names codecs a marketer actually runs into', () => {
    expect(describeVideoCodecTag('mp4v')).toBe(
      'MPEG-4 Part 2 (DivX·Xvid) (mp4v)',
    );
    expect(describeVideoCodecTag('hvc1')).toBe('HEVC (H.265) (hvc1)');
  });

  it('quotes an unknown tag instead of guessing', () => {
    expect(describeVideoCodecTag('zzzz')).toBe("코덱 'zzzz'");
  });

  it('admits when there is no tag at all', () => {
    expect(describeVideoCodecTag(null)).toBe('알 수 없는 코덱');
  });
});
