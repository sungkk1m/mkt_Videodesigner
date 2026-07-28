// Design Ref: §3.6 Persistence — a thin promise wrapper over the two stores the
// MVP needs. Small enough that pulling in an IndexedDB library would add a
// dependency without removing work.
export const DB_NAME = 'mkt-videodesigner';
export const DB_VERSION = 2;

export const PROJECT_STORE = 'projects';
export const FILE_HANDLE_STORE = 'file-handles';
export const TTS_CACHE_STORE = 'tts-cache';

let connection: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, {keyPath: 'id'});
      }

      if (!db.objectStoreNames.contains(FILE_HANDLE_STORE)) {
        db.createObjectStore(FILE_HANDLE_STORE);
      }

      if (!db.objectStoreNames.contains(TTS_CACHE_STORE)) {
        db.createObjectStore(TTS_CACHE_STORE, {keyPath: 'cacheKey'});
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('idb-open-failed'));
    request.onblocked = () => reject(new Error('idb-blocked'));
  });

export const getDatabase = () => {
  connection ??= openDatabase();

  return connection;
};

/** Test seam: drops the memoised connection so a fake can replace it. */
export const resetDatabase = () => {
  connection = null;
};

const runRequest = <TResult>(request: IDBRequest<TResult>): Promise<TResult> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('idb-request-failed'));
  });

export const idbPut = async (
  store: string,
  value: unknown,
  key?: IDBValidKey,
) => {
  const db = await getDatabase();
  const transaction = db.transaction(store, 'readwrite');

  await runRequest(
    key === undefined
      ? transaction.objectStore(store).put(value)
      : transaction.objectStore(store).put(value, key),
  );
};

export const idbGet = async <TValue>(store: string, key: IDBValidKey) => {
  const db = await getDatabase();

  return (await runRequest(
    db.transaction(store, 'readonly').objectStore(store).get(key),
  )) as TValue | undefined;
};

export const idbGetAll = async <TValue>(store: string) => {
  const db = await getDatabase();

  return (await runRequest(
    db.transaction(store, 'readonly').objectStore(store).getAll(),
  )) as TValue[];
};

export const idbDelete = async (store: string, key: IDBValidKey) => {
  const db = await getDatabase();

  await runRequest(
    db.transaction(store, 'readwrite').objectStore(store).delete(key),
  );
};
