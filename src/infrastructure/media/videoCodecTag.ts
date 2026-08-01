// Plan FR-M03: a rejected upload must name the codec it actually contains.
//
// Chrome tells us nothing useful when it cannot decode a track: `<video>` fires
// `loadedmetadata` with a 0x0 size, WebCodecs only answers yes/no about a codec
// string we do not have yet, and mediabunny throws while parsing because it only
// models codecs it supports. So we read the sample-entry fourcc ourselves.
//
// This runs ONLY on the failure path — a successful upload never pays for it.

/** ISO-BMFF container boxes we descend through to reach the codec fourcc. */
const CODEC_TAG_PATH = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd'] as const;

/** stsd content: 4 bytes version+flags, 4 bytes entry_count, then sample entries. */
const STSD_ENTRY_OFFSET = 8;

/** A box header is 8 bytes, or 16 when it carries a 64-bit largesize. */
const MAX_HEADER_BYTES = 16;

interface BoxHeader {
  type: string;
  /** Offset of the box content, i.e. just past the header. */
  contentStart: number;
  /** Offset just past the whole box. */
  end: number;
}

const readBoxHeader = async (
  file: Blob,
  offset: number,
  limit: number,
): Promise<BoxHeader | null> => {
  if (offset + 8 > limit) {
    return null;
  }

  const buffer = await file
    .slice(offset, Math.min(offset + MAX_HEADER_BYTES, limit))
    .arrayBuffer();

  if (buffer.byteLength < 8) {
    return null;
  }

  const view = new DataView(buffer);
  const type = String.fromCharCode(
    view.getUint8(4),
    view.getUint8(5),
    view.getUint8(6),
    view.getUint8(7),
  );

  let size = view.getUint32(0);
  let headerBytes = 8;

  if (size === 1) {
    if (buffer.byteLength < 16) {
      return null;
    }

    size = Number(view.getBigUint64(8));
    headerBytes = 16;
  } else if (size === 0) {
    // A zero size means the box runs to the end of the file.
    size = limit - offset;
  }

  if (size < headerBytes || offset + size > limit) {
    return null;
  }

  return {type, contentStart: offset + headerBytes, end: offset + size};
};

const findBox = async (
  file: Blob,
  start: number,
  limit: number,
  type: string,
): Promise<BoxHeader | null> => {
  let offset = start;

  while (offset < limit) {
    const box = await readBoxHeader(file, offset, limit);

    if (!box) {
      return null;
    }

    if (box.type === type) {
      return box;
    }

    offset = box.end;
  }

  return null;
};

/**
 * Reads the first video sample-entry fourcc from an ISO-BMFF file
 * (`mp4` / `mov` / `m4v`) — `'avc1'`, `'hvc1'`, `'mp4v'`, and so on.
 *
 * Returns null for non-ISO-BMFF containers (WebM/Matroska) and for anything
 * malformed. Callers must treat null as "unknown", never as "no video track":
 * a truthful "알 수 없음" beats a confident wrong answer.
 *
 * Only descends the container chain, so it reads box headers plus `moov`
 * rather than the whole file.
 */
export const readVideoCodecTag = async (file: Blob): Promise<string | null> => {
  try {
    let searchStart = 0;
    let searchLimit = file.size;

    for (const boxType of CODEC_TAG_PATH) {
      const box = await findBox(file, searchStart, searchLimit, boxType);

      if (!box) {
        return null;
      }

      searchStart = box.contentStart;
      searchLimit = box.end;
    }

    // The first sample entry's own box header carries the codec as its type.
    const entry = await readBoxHeader(
      file,
      searchStart + STSD_ENTRY_OFFSET,
      searchLimit,
    );

    return entry?.type ?? null;
  } catch {
    // A probe helper must never turn a decode failure into a crash.
    return null;
  }
};

/** Human-readable names for the codecs a UA marketer actually runs into. */
const CODEC_LABELS: Record<string, string> = {
  avc1: 'H.264',
  avc3: 'H.264',
  hvc1: 'HEVC (H.265)',
  hev1: 'HEVC (H.265)',
  vp08: 'VP8',
  vp09: 'VP9',
  av01: 'AV1',
  mp4v: 'MPEG-4 Part 2 (DivX·Xvid)',
  's263': 'H.263',
  h263: 'H.263',
  jpeg: 'Motion JPEG',
  mjpa: 'Motion JPEG',
  ap4h: 'Apple ProRes 4444',
  apch: 'Apple ProRes 422 HQ',
  apcn: 'Apple ProRes 422',
  dvh1: 'DVCPRO HD',
};

/** `'mp4v'` → `'MPEG-4 Part 2 (DivX·Xvid) (mp4v)'`; null → `'알 수 없는 코덱'`. */
export const describeVideoCodecTag = (tag: string | null): string => {
  if (!tag) {
    return '알 수 없는 코덱';
  }

  const label = CODEC_LABELS[tag.toLowerCase()];

  return label ? `${label} (${tag})` : `코덱 '${tag}'`;
};
