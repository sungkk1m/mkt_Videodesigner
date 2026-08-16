import {describe, expect, it, vi} from 'vitest';

import {
  probeAudioFile,
  probeVideoFile,
  type ProbeMediaDependencies,
} from './probeMedia';

const createFile = (type = 'video/mp4') =>
  new File([new Uint8Array(64)], 'gameplay.mp4', {type});

const createDependencies = (
  loadMetadata: ProbeMediaDependencies['loadMetadata'],
  codecTag: string | null = 'mp4v',
): ProbeMediaDependencies => ({
  createObjectUrl: vi.fn(() => 'blob:mock-url'),
  revokeObjectUrl: vi.fn(),
  loadMetadata,
  createId: () => 'media_test',
  fingerprint: async () => 'sha256-test',
  loadImageSize: async () => ({width: 512, height: 512}),
  readCodecTag: vi.fn(async () => codecTag),
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

  // Plan FR-M03. Chrome parses an mp4v container fine and reports 0x0 instead of
  // erroring, so this is the path a DivX/Xvid upload actually takes.
  it('names the codec when the container parses but the track cannot decode', async () => {
    const dependencies = createDependencies(
      async () => ({durationMs: 8000, width: 0, height: 0}),
      'mp4v',
    );

    const result = await probeVideoFile(createFile(), dependencies);

    expect(result).toMatchObject({
      ok: false,
      error: {code: 'CODEC_UNSUPPORTED', details: {codecTag: 'mp4v'}},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('MPEG-4 Part 2');
      expect(result.error.message).toContain('mp4v');
      // The old copy claimed the file had no video track. It does.
      expect(result.error.message).not.toContain('영상 트랙이 있는 파일');
    }
    expect(dependencies.revokeObjectUrl).toHaveBeenCalledWith('blob:mock-url');
  });

  it('stays truthful when the codec cannot be identified', async () => {
    const dependencies = createDependencies(
      async () => ({durationMs: 8000, width: 0, height: 0}),
      null,
    );

    const result = await probeVideoFile(createFile(), dependencies);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('알 수 없는 코덱');
    }
  });

  it('asks for the video track, not whichever track comes first', async () => {
    const dependencies = createDependencies(async () => {
      throw new Error('decode-failed');
    });

    await probeVideoFile(createFile(), dependencies);

    expect(dependencies.readCodecTag).toHaveBeenCalledWith(
      expect.anything(),
      'video',
    );
  });
});

// Plan FR-M06. The audio path used to say only "WAV 또는 MP3로 변환하세요",
// which leaves the user guessing which of their files is the problem.
describe('probeAudioFile', () => {
  const createAudioFile = (type = 'audio/mp4') =>
    new File([new Uint8Array(64)], 'narration.m4a', {type});

  it('names the codec when Chrome cannot decode the audio', async () => {
    const dependencies = createDependencies(async () => {
      throw new Error('decode-failed');
    }, 'alac');

    const result = await probeAudioFile(createAudioFile(), dependencies);

    expect(result).toMatchObject({
      ok: false,
      error: {code: 'CODEC_UNSUPPORTED', details: {codecTag: 'alac'}},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('ALAC (Apple Lossless)');
      expect(result.error.message).toContain('alac');
    }
    expect(dependencies.readCodecTag).toHaveBeenCalledWith(
      expect.anything(),
      'audio',
    );
    expect(dependencies.revokeObjectUrl).toHaveBeenCalledWith('blob:mock-url');
  });

  it('stays truthful when the codec cannot be identified', async () => {
    const dependencies = createDependencies(async () => {
      throw new Error('decode-failed');
    }, null);

    const result = await probeAudioFile(createAudioFile(), dependencies);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('알 수 없는 코덱');
    }
  });

  it('leaves a decodable file alone', async () => {
    const dependencies = createDependencies(async () => ({
      durationMs: 30_000,
      width: 0,
      height: 0,
    }));

    const result = await probeAudioFile(createAudioFile(), dependencies);

    expect(result).toMatchObject({
      ok: true,
      value: {reference: {kind: 'audio', durationMs: 30_000}},
    });
    expect(dependencies.readCodecTag).not.toHaveBeenCalled();
  });
});
