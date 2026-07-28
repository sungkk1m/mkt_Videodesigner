import {describe, expect, it, vi} from 'vitest';

import {probeVideoFile, type ProbeMediaDependencies} from './probeMedia';

const createFile = (type = 'video/mp4') =>
  new File([new Uint8Array(64)], 'gameplay.mp4', {type});

const createDependencies = (
  loadMetadata: ProbeMediaDependencies['loadMetadata'],
): ProbeMediaDependencies => ({
  createObjectUrl: vi.fn(() => 'blob:mock-url'),
  revokeObjectUrl: vi.fn(),
  loadMetadata,
  createId: () => 'media_test',
  fingerprint: async () => 'sha256-test',
  loadImageSize: async () => ({width: 512, height: 512}),
});

describe('probeVideoFile', () => {
  it('returns name, MIME, duration, and dimensions for a playable file', async () => {
    const dependencies = createDependencies(async () => ({
      durationMs: 10_500,
      width: 1080,
      height: 1920,
    }));

    const result = await probeVideoFile(createFile(), dependencies);

    expect(result).toMatchObject({
      ok: true,
      value: {
        reference: {
          id: 'media_test',
          kind: 'video',
          name: 'gameplay.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 64,
          durationMs: 10_500,
          width: 1080,
          height: 1920,
          fingerprint: 'sha256-test',
          status: 'available',
        },
        url: 'blob:mock-url',
      },
    });
    expect(dependencies.revokeObjectUrl).not.toHaveBeenCalled();
  });

  it('rejects a non-video file before creating an object URL', async () => {
    const dependencies = createDependencies(async () => {
      throw new Error('should not be called');
    });

    const result = await probeVideoFile(
      createFile('application/pdf'),
      dependencies,
    );

    expect(result).toMatchObject({ok: false, error: {code: 'CODEC_UNSUPPORTED'}});
    expect(dependencies.createObjectUrl).not.toHaveBeenCalled();
  });

  it('reports an actionable codec error and releases the object URL', async () => {
    const dependencies = createDependencies(async () => {
      throw new Error('decode-failed');
    });

    const result = await probeVideoFile(createFile(), dependencies);

    expect(result).toMatchObject({ok: false, error: {code: 'CODEC_UNSUPPORTED'}});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('H.264');
    }
    expect(dependencies.revokeObjectUrl).toHaveBeenCalledWith('blob:mock-url');
  });

  it('rejects a file without a usable duration', async () => {
    const dependencies = createDependencies(async () => ({
      durationMs: Number.NaN,
      width: 1080,
      height: 1920,
    }));

    const result = await probeVideoFile(createFile(), dependencies);

    expect(result).toMatchObject({
      ok: false,
      error: {code: 'MEDIA_PROBE_FAILED'},
    });
    expect(dependencies.revokeObjectUrl).toHaveBeenCalledWith('blob:mock-url');
  });

  it('rejects a file without a video track', async () => {
    const dependencies = createDependencies(async () => ({
      durationMs: 8000,
      width: 0,
      height: 0,
    }));

    const result = await probeVideoFile(createFile(), dependencies);

    expect(result).toMatchObject({
      ok: false,
      error: {code: 'MEDIA_PROBE_FAILED'},
    });
    expect(dependencies.revokeObjectUrl).toHaveBeenCalledWith('blob:mock-url');
  });
});
