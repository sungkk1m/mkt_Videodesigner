import {describe, expect, it, vi} from 'vitest';

import {
  withSoftwareVideoDecoding,
  type DecoderScope,
} from './softwareVideoDecode';

interface Config {
  codec: string;
  hardwareAcceleration?: string;
}

const makeScope = ({supported = true} = {}) => {
  const configured: Config[] = [];
  const original = function (this: unknown, config: Config) {
    configured.push(config);
  };
  const VideoDecoder = {
    prototype: {configure: original},
    isConfigSupported: vi.fn().mockResolvedValue({supported}),
  };

  return {
    scope: {VideoDecoder} as unknown as DecoderScope,
    configured,
    original,
    configure: (config: Config) =>
      VideoDecoder.prototype.configure.call({}, config),
  };
};

describe('withSoftwareVideoDecoding', () => {
  it('rewrites H.264 configures to prefer-software during the run', async () => {
    const {scope, configured, configure} = makeScope();

    await withSoftwareVideoDecoding(async () => {
      configure({codec: 'avc1.42E01E'});
      configure({codec: 'vp09.00.10.08'});
    }, scope);

    expect(configured[0]?.hardwareAcceleration).toBe('prefer-software');
    expect(configured[1]?.hardwareAcceleration).toBe('prefer-software');
  });

  it('leaves HEVC alone — software HEVC is not a safe assumption', async () => {
    const {scope, configured, configure} = makeScope();

    await withSoftwareVideoDecoding(async () => {
      configure({codec: 'hev1.1.6.L93.B0'});
    }, scope);

    expect(configured[0]?.hardwareAcceleration).toBeUndefined();
  });

  it('respects an explicit prefer-hardware from the caller', async () => {
    const {scope, configured, configure} = makeScope();

    await withSoftwareVideoDecoding(async () => {
      configure({codec: 'avc1.42E01E', hardwareAcceleration: 'prefer-hardware'});
    }, scope);

    expect(configured[0]?.hardwareAcceleration).toBe('prefer-hardware');
  });

  it('restores the original configure after the run, even on failure', async () => {
    const {scope, original} = makeScope();

    await expect(
      withSoftwareVideoDecoding(async () => {
        throw new Error('render died');
      }, scope),
    ).rejects.toThrow('render died');

    expect(scope.VideoDecoder?.prototype.configure).toBe(original);
  });

  it('runs unpatched when software H.264 is unsupported', async () => {
    const {scope, original} = makeScope({supported: false});

    await withSoftwareVideoDecoding(async () => {
      expect(scope.VideoDecoder?.prototype.configure).toBe(original);
    }, scope);
  });

  it('runs unpatched when the scope has no VideoDecoder at all', async () => {
    await expect(
      withSoftwareVideoDecoding(async () => 'ok', {} as DecoderScope),
    ).resolves.toBe('ok');
  });
});
