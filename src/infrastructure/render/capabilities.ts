// Design Ref: §2.4 Performance Gate — block unsupported H.264/AAC renders before work starts.
import {
  canRenderMediaOnWeb,
  getEncodableAudioCodecs,
  getEncodableVideoCodecs,
} from '@remotion/web-renderer';

import type {
  CapabilityDependencies,
  OutputTarget,
  RenderCapabilitySummary,
} from './types';

const OPFS_FALLBACK_WARNING =
  'OPFS를 사용할 수 없어 메모리 출력으로 전환합니다.';

const createBrowserDependencies = (): CapabilityDependencies => {
  const userAgent = navigator.userAgent;

  return {
    isChrome:
      userAgent.includes('Chrome/') &&
      !userAgent.includes('Edg/') &&
      !userAgent.includes('OPR/'),
    isSecureContext: window.isSecureContext,
    hasWebCodecs:
      typeof window.VideoEncoder !== 'undefined' &&
      typeof window.AudioEncoder !== 'undefined',
    hasOpfs:
      typeof navigator.storage?.getDirectory === 'function',
    hasFileSystemAccess: 'showDirectoryPicker' in window,
    getVideoCodecs: async () => getEncodableVideoCodecs('mp4'),
    getAudioCodecs: async () => getEncodableAudioCodecs('mp4'),
    canRender: async (outputTarget) =>
      canRenderMediaOnWeb({
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1080,
        height: 1920,
        outputTarget,
      }),
  };
};

export const probeRenderCapabilities = async (
  dependencies: CapabilityDependencies = createBrowserDependencies(),
): Promise<RenderCapabilitySummary> => {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!dependencies.isChrome) {
    blockers.push('최신 데스크톱 Chrome이 필요합니다.');
  }
  if (!dependencies.isSecureContext) {
    blockers.push('HTTPS 또는 localhost 보안 컨텍스트가 필요합니다.');
  }
  if (!dependencies.hasWebCodecs) {
    blockers.push('WebCodecs를 사용할 수 없습니다.');
  }

  const [videoCodecs, audioCodecs]: [string[], string[]] = await Promise.all([
    dependencies.getVideoCodecs().catch((): string[] => []),
    dependencies.getAudioCodecs().catch((): string[] => []),
  ]);

  if (!videoCodecs.includes('h264')) {
    blockers.push('H.264 인코더를 사용할 수 없습니다.');
  }
  if (!audioCodecs.includes('aac')) {
    blockers.push('AAC 인코더를 사용할 수 없습니다.');
  }

  let preferredOutputTarget: OutputTarget = dependencies.hasOpfs
    ? 'web-fs'
    : 'arraybuffer';
  if (!dependencies.hasOpfs) {
    warnings.push(OPFS_FALLBACK_WARNING);
  }

  let renderCheck = await dependencies.canRender(preferredOutputTarget);
  const outputTargetFailed = renderCheck.issues.some(
    (issue) =>
      issue.type === 'output-target-unsupported' && issue.severity === 'error',
  );

  if (preferredOutputTarget === 'web-fs' && outputTargetFailed) {
    preferredOutputTarget = 'arraybuffer';
    warnings.push(OPFS_FALLBACK_WARNING);
    renderCheck = await dependencies.canRender(preferredOutputTarget);
  }

  for (const issue of renderCheck.issues) {
    if (issue.severity === 'error') {
      blockers.push(issue.message);
    } else {
      warnings.push(issue.message);
    }
  }

  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];

  return {
    ready: uniqueBlockers.length === 0 && renderCheck.canRender,
    isChrome: dependencies.isChrome,
    isSecureContext: dependencies.isSecureContext,
    hasWebCodecs: dependencies.hasWebCodecs,
    hasOpfs: dependencies.hasOpfs,
    hasFileSystemAccess: dependencies.hasFileSystemAccess,
    videoCodecs,
    audioCodecs,
    preferredOutputTarget,
    resolvedOutputTarget: renderCheck.resolvedOutputTarget,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    issues: renderCheck.issues,
  };
};
