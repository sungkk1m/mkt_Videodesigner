// Design Ref: §1.3 "Batch save: directory picker first, normal per-file download
// fallback", §4.1 OutputWriter, and §6.2 OUTPUT_PERMISSION_DENIED /
// OUTPUT_WRITE_FAILED.
import type {OutputWriter} from '../../domain/ports';
import {createAppError, fail, ok} from '../../shared/errors/appError';

export const supportsDirectoryPicker = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const downloadBlob = (fileName: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const createBrowserOutputWriter = (): OutputWriter => {
  let directory: FileSystemDirectoryHandle | null = null;
  const written = new Set<string>();

  return {
    get destination() {
      return directory ? 'directory' : 'download';
    },

    chooseDirectory: async () => {
      if (!supportsDirectoryPicker()) {
        return fail<boolean>(
          createAppError(
            'OUTPUT_PERMISSION_DENIED',
            '이 브라우저는 폴더 저장을 지원하지 않습니다. 파일은 브라우저 다운로드로 저장됩니다.',
            {action: {label: '다운로드로 계속', target: 'retry'}},
          ),
        );
      }

      try {
        directory = await window.showDirectoryPicker({mode: 'readwrite'});
        written.clear();

        return ok(true);
      } catch {
        // AbortError means the user closed the picker; downloads still work.
        directory = null;

        return ok(false);
      }
    },

    useDownloads: () => {
      directory = null;
      written.clear();
    },

    /**
     * A timestamp suffix is added only on a real collision. Design Ref: §4.5.
     */
    write: async (fileName, blob) => {
      const unique = written.has(fileName)
        ? fileName.replace(/\.mp4$/, `_${Date.now()}.mp4`)
        : fileName;

      if (!directory) {
        downloadBlob(unique, blob);
        written.add(fileName);

        return ok(unique);
      }

      try {
        const handle = await directory.getFileHandle(unique, {create: true});
        const stream = await handle.createWritable();

        await stream.write(blob);
        await stream.close();
        written.add(fileName);

        return ok(unique);
      } catch (cause) {
        // Design Ref: §6.3 — a write failure falls back to a browser download so
        // a finished render is never lost.
        downloadBlob(unique, blob);
        written.add(fileName);

        return fail<string>(
          createAppError(
            'OUTPUT_WRITE_FAILED',
            `${unique}을(를) 폴더에 저장하지 못해 브라우저 다운로드로 내보냈습니다. 폴더를 다시 선택하세요.`,
            {
              action: {label: '폴더 다시 선택', target: 'retry'},
              retryable: true,
              cause,
            },
          ),
        );
      }
    },
  };
};
