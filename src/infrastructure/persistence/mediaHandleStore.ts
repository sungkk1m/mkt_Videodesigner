// Design Ref: §3.6 IndexedDB `file-handles` — Chrome can persist a File System
// Access handle across sessions, but reading it again may need renewed
// permission, which must only be requested after an explicit user action (§7).
import type {MediaHandleStore} from '../../domain/ports';
import {createAppError, fail, ok} from '../../shared/errors/appError';
import {FILE_HANDLE_STORE, idbDelete, idbGet, idbPut} from './idb';

export const supportsFileHandles = () =>
  typeof window !== 'undefined' && 'showOpenFilePicker' in window;

const permissionRequired = (cause?: unknown) =>
  createAppError(
    'MEDIA_PERMISSION_REQUIRED',
    '저장된 영상 파일에 다시 접근하려면 권한을 허용해야 합니다.',
    {
      action: {label: '파일 다시 연결', target: 'relink'},
      retryable: true,
      ...(cause === undefined ? {} : {cause}),
    },
  );

const missing = (cause?: unknown) =>
  createAppError(
    'MEDIA_MISSING',
    '원본 영상을 찾을 수 없습니다. 파일을 다시 선택해 연결하세요.',
    {
      action: {label: '파일 다시 연결', target: 'relink'},
      retryable: true,
      ...(cause === undefined ? {} : {cause}),
    },
  );

export const createMediaHandleStore = (): MediaHandleStore => ({
  put: (mediaId, handle) => idbPut(FILE_HANDLE_STORE, handle, mediaId),

  get: async (mediaId) =>
    (await idbGet<FileSystemFileHandle>(FILE_HANDLE_STORE, mediaId)) ?? null,

  delete: (mediaId) => idbDelete(FILE_HANDLE_STORE, mediaId),

  resolve: async (mediaId, {requestPermission}) => {
    let handle: FileSystemFileHandle | null = null;

    try {
      handle =
        (await idbGet<FileSystemFileHandle>(FILE_HANDLE_STORE, mediaId)) ?? null;
    } catch (cause) {
      return fail<File>(missing(cause));
    }

    if (!handle) {
      return fail<File>(missing());
    }

    const descriptor: FileSystemHandlePermissionDescriptor = {mode: 'read'};
    let state = await handle.queryPermission(descriptor);

    if (state !== 'granted') {
      if (!requestPermission) {
        return fail<File>(permissionRequired());
      }

      state = await handle.requestPermission(descriptor);
    }

    if (state !== 'granted') {
      return fail<File>(permissionRequired());
    }

    try {
      return ok(await handle.getFile());
    } catch (cause) {
      return fail<File>(missing(cause));
    }
  },
});
