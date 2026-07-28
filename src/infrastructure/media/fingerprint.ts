// Design Ref: §3.6 — a project stores a fingerprint so a moved or renamed file
// can still be recognised on relink. Hashing the size plus the file header is
// enough to identify the same encode without reading gigabytes of video.
export type DigestFunction = (data: Uint8Array) => Promise<ArrayBuffer>;

const HEAD_BYTES = 262_144;

const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const webCryptoDigest: DigestFunction = (data) =>
  // A fresh copy keeps the ArrayBuffer type stable across Uint8Array views.
  crypto.subtle.digest('SHA-256', data.slice().buffer as ArrayBuffer);

export const fingerprintBlob = async (
  blob: Blob,
  digest: DigestFunction = webCryptoDigest,
): Promise<string> => {
  const head = new Uint8Array(await blob.slice(0, HEAD_BYTES).arrayBuffer());
  const payload = new Uint8Array(8 + head.byteLength);

  new DataView(payload.buffer).setFloat64(0, blob.size);
  payload.set(head, 8);

  return `sha256-${toHex(await digest(payload))}`;
};
