// Design Ref: §4.1 MediaResolver + §6.2 MEDIA_PROBE_FAILED / CODEC_UNSUPPORTED —
// verify name, MIME, duration, dimensions, and decodability before editing.
import type {ResolvedMedia} from '../../domain/editor/types';
import {
  createAppError,
  fail,
  ok,
  type Result,
} from '../../shared/errors/appError';
import {fingerprintBlob} from './fingerprint';

export type MediaProbeResult = Result<ResolvedMedia>;

export interface MediaMetadata {
  durationMs: number;
  width: number;
  height: number;
}

export interface ProbeMediaDependencies {
  createObjectUrl: (file: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  loadMetadata: (url: string) => Promise<MediaMetadata>;
  loadImageSize: (url: string) => Promise<{width: number; height: number}>;
  createId: () => string;
  fingerprint: (file: Blob) => Promise<string>;
}

const METADATA_TIMEOUT_MS = 15_000;

const loadMetadataFromVideoElement = (url: string): Promise<MediaMetadata> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let timeout = 0;

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
    };

    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('metadata-timeout'));
    }, METADATA_TIMEOUT_MS);

    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const metadata: MediaMetadata = {
        durationMs: Math.round(video.duration * 1000),
        width: video.videoWidth,
        height: video.videoHeight,
      };
      cleanup();
      resolve(metadata);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('decode-failed'));
    };
    video.src = url;
  });

const createBrowserDependencies = (): ProbeMediaDependencies => ({
  createObjectUrl: (file) => URL.createObjectURL(file),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  loadMetadata: loadMetadataFromVideoElement,
  loadImageSize,
  createId: () => `media_${crypto.randomUUID()}`,
  fingerprint: (file) => fingerprintBlob(file),
});

const loadImageSize = (url: string): Promise<{width: number; height: number}> =>
  new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () =>
      resolve({width: image.naturalWidth, height: image.naturalHeight});
    image.onerror = () => reject(new Error('decode-failed'));
    image.src = url;
  });

/**
 * CTA app icons, logos, and store badges. Images have no duration, so the
 * reference stores dimensions only. Design Ref: §3.1 MediaReference.
 */
export const probeImageFile = async (
  file: File,
  dependencies: ProbeMediaDependencies = createBrowserDependencies(),
): Promise<MediaProbeResult> => {
  if (!file.type.startsWith('image/')) {
    return fail(
      createAppError(
        'CODEC_UNSUPPORTED',
        `이미지 파일이 아닙니다. 현재 형식: ${file.type || '알 수 없음'}`,
        {
          details: {mimeType: file.type},
          action: {label: '다른 파일 선택', target: 'source'},
        },
      ),
    );
  }

  const url = dependencies.createObjectUrl(file);

  try {
    const {width, height} = await dependencies.loadImageSize(url);

    if (width <= 0 || height <= 0) {
      dependencies.revokeObjectUrl(url);

      return fail(
        createAppError(
          'MEDIA_PROBE_FAILED',
          '이미지 크기를 확인할 수 없습니다. 다른 파일을 선택하세요.',
          {action: {label: '다른 파일 선택', target: 'source'}, retryable: true},
        ),
      );
    }

    return ok({
      reference: {
        id: dependencies.createId(),
        kind: 'image',
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        lastModified: file.lastModified,
        width,
        height,
        fingerprint: await dependencies.fingerprint(file),
        status: 'available',
      },
      url,
    });
  } catch (cause) {
    dependencies.revokeObjectUrl(url);

    return fail(
      createAppError(
        'CODEC_UNSUPPORTED',
        'Chrome이 이 이미지를 열지 못했습니다. PNG 또는 JPEG로 변환한 뒤 다시 업로드하세요.',
        {action: {label: '다른 파일 선택', target: 'source'}, cause},
      ),
    );
  }
};

/** BGM and uploaded narration. Design Ref: §3.3 Audio. */
export const probeAudioFile = async (
  file: File,
  dependencies: ProbeMediaDependencies = createBrowserDependencies(),
): Promise<MediaProbeResult> => {
  if (!file.type.startsWith('audio/')) {
    return fail(
      createAppError(
        'CODEC_UNSUPPORTED',
        `음성 파일이 아닙니다. 현재 형식: ${file.type || '알 수 없음'}`,
        {
          details: {mimeType: file.type},
          action: {label: '다른 파일 선택', target: 'audio'},
        },
      ),
    );
  }

  const url = dependencies.createObjectUrl(file);

  try {
    const {durationMs} = await dependencies.loadMetadata(url);

    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      dependencies.revokeObjectUrl(url);

      return fail(
        createAppError(
          'MEDIA_PROBE_FAILED',
          '음성 길이를 확인할 수 없습니다. 다른 파일을 선택하세요.',
          {action: {label: '다른 파일 선택', target: 'audio'}, retryable: true},
        ),
      );
    }

    return ok({
      reference: {
        id: dependencies.createId(),
        kind: 'audio',
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        lastModified: file.lastModified,
        durationMs,
        fingerprint: await dependencies.fingerprint(file),
        status: 'available',
      },
      url,
    });
  } catch (cause) {
    dependencies.revokeObjectUrl(url);

    return fail(
      createAppError(
        'CODEC_UNSUPPORTED',
        'Chrome이 이 음성을 디코딩하지 못했습니다. WAV 또는 MP3로 변환한 뒤 다시 업로드하세요.',
        {action: {label: '다른 파일 선택', target: 'audio'}, cause},
      ),
    );
  }
};

export const probeVideoFile = async (
  file: File,
  dependencies: ProbeMediaDependencies = createBrowserDependencies(),
): Promise<MediaProbeResult> => {
  if (!file.type.startsWith('video/')) {
    return fail(
      createAppError(
        'CODEC_UNSUPPORTED',
        `영상 파일이 아닙니다. 현재 형식: ${file.type || '알 수 없음'}`,
        {
          details: {mimeType: file.type},
          action: {label: '다른 파일 선택', target: 'source'},
        },
      ),
    );
  }

  const url = dependencies.createObjectUrl(file);

  try {
    const metadata = await dependencies.loadMetadata(url);

    if (!Number.isFinite(metadata.durationMs) || metadata.durationMs <= 0) {
      dependencies.revokeObjectUrl(url);
      return fail(
        createAppError(
          'MEDIA_PROBE_FAILED',
          '영상 길이를 확인할 수 없습니다. 다른 파일을 선택하세요.',
          {
            action: {label: '다른 파일 선택', target: 'source'},
            retryable: true,
          },
        ),
      );
    }

    if (metadata.width <= 0 || metadata.height <= 0) {
      dependencies.revokeObjectUrl(url);
      return fail(
        createAppError(
          'MEDIA_PROBE_FAILED',
          '영상 해상도를 확인할 수 없습니다. 영상 트랙이 있는 파일을 선택하세요.',
          {
            action: {label: '다른 파일 선택', target: 'source'},
            retryable: true,
          },
        ),
      );
    }

    return ok({
      reference: {
        id: dependencies.createId(),
        kind: 'video',
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        lastModified: file.lastModified,
        durationMs: metadata.durationMs,
        width: metadata.width,
        height: metadata.height,
        fingerprint: await dependencies.fingerprint(file),
        status: 'available',
      },
      url,
    });
  } catch (cause) {
    dependencies.revokeObjectUrl(url);
    return fail(
      createAppError(
        'CODEC_UNSUPPORTED',
        'Chrome이 이 영상을 디코딩하지 못했습니다. H.264 MP4로 변환한 뒤 다시 업로드하세요.',
        {
          action: {label: '다른 파일 선택', target: 'source'},
          cause,
        },
      ),
    );
  }
};
