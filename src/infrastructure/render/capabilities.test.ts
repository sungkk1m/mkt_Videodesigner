import {describe, expect, it} from 'vitest';

import {probeRenderCapabilities} from './capabilities';
import type {CapabilityDependencies} from './types';

const createDependencies = (
  overrides: Partial<CapabilityDependencies> = {},
): CapabilityDependencies => ({
  isChrome: true,
  isSecureContext: true,
  hasWebCodecs: true,
  hasOpfs: true,
  hasFileSystemAccess: true,
  getVideoCodecs: async () => ['h264'],
  getAudioCodecs: async () => ['aac'],
  canRender: async (outputTarget) => ({
    canRender: true,
    issues: [],
    resolvedVideoCodec: 'h264',
    resolvedAudioCodec: 'aac',
    resolvedOutputTarget: outputTarget,
  }),
  ...overrides,
});

describe('probeRenderCapabilities', () => {
  it('reports a ready H.264/AAC web-fs environment', async () => {
    const result = await probeRenderCapabilities(createDependencies());

    expect(result.ready).toBe(true);
    expect(result.preferredOutputTarget).toBe('web-fs');
    expect(result.videoCodecs).toContain('h264');
    expect(result.audioCodecs).toContain('aac');
    expect(result.blockers).toEqual([]);
  });

  it('falls back to arraybuffer when OPFS is unavailable', async () => {
    const result = await probeRenderCapabilities(
      createDependencies({
        hasOpfs: false,
        canRender: async () => ({
          canRender: true,
          issues: [],
          resolvedVideoCodec: 'h264',
          resolvedAudioCodec: 'aac',
          resolvedOutputTarget: 'arraybuffer',
        }),
      }),
    );

    expect(result.ready).toBe(true);
    expect(result.preferredOutputTarget).toBe('arraybuffer');
    expect(result.warnings).toContain('OPFS를 사용할 수 없어 메모리 출력으로 전환합니다.');
  });

  it('blocks rendering when H.264 or AAC is unavailable', async () => {
    const result = await probeRenderCapabilities(
      createDependencies({
        getVideoCodecs: async () => ['vp9'],
        getAudioCodecs: async () => ['opus'],
        canRender: async () => ({
          canRender: false,
          issues: [
            {
              type: 'video-codec-unsupported',
              severity: 'error',
              message: 'H.264 unsupported',
            },
          ],
          resolvedVideoCodec: 'h264',
          resolvedAudioCodec: 'aac',
          resolvedOutputTarget: 'arraybuffer',
        }),
      }),
    );

    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('H.264 인코더를 사용할 수 없습니다.');
    expect(result.blockers).toContain('AAC 인코더를 사용할 수 없습니다.');
  });
});
