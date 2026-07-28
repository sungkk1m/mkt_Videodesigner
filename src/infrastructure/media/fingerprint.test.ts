import {describe, expect, it} from 'vitest';

import {fingerprintBlob} from './fingerprint';

const bytes = (length: number, fill: number) =>
  new Blob([new Uint8Array(length).fill(fill)]);

describe('fingerprintBlob', () => {
  it('produces a stable hash for identical content', async () => {
    const [left, right] = await Promise.all([
      fingerprintBlob(bytes(512, 7)),
      fingerprintBlob(bytes(512, 7)),
    ]);

    expect(left).toBe(right);
    expect(left).toMatch(/^sha256-[0-9a-f]{64}$/);
  });

  it('separates files that differ only in content', async () => {
    expect(await fingerprintBlob(bytes(512, 7))).not.toBe(
      await fingerprintBlob(bytes(512, 8)),
    );
  });

  it('separates files that differ only in size', async () => {
    expect(await fingerprintBlob(bytes(512, 0))).not.toBe(
      await fingerprintBlob(bytes(1024, 0)),
    );
  });
});
