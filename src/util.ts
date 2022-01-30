import { EntryOption, CapturedObjectResult, IndexedDBStore } from './types';

function createTransaction(
  db: IDBDatabase,
  objectStoreName: string,
  mode?: IDBTransactionMode
) {
  return promisify<IDBObjectStore>(({ resolve }) => {
    const request = db.transaction(objectStoreName, mode);
    resolve(request.objectStore(objectStoreName));
  });
}

export function _createDbConnection(
  dbName: string,
  version: number,
  updateDbOnUpgrade?: (
    db: IDBDatabase,
    name: string,
    version: { old: number; new: number }
  ) => void
): Promise<IDBDatabase> {
  const request = indexedDB.open(dbName, version);

  request.onupgradeneeded = (e) => {
    if (updateDbOnUpgrade) {
      updateDbOnUpgrade(request.result, dbName, {
        old: e.oldVersion,
        new: e.newVersion ?? e.oldVersion,
      });
    }
  };

  return promisify<IDBDatabase>(({ resolve, reject }) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

interface StatePromisifier<State> {
  resolve(value: State): void;
  reject(reason?: any): void;
}

type StatePromisifierFn<T> = (option: StatePromisifier<T>) => void;
export function promisify<T>(fn: StatePromisifierFn<T>) {
  return new Promise<T>((resolve, reject) => {
    fn({ resolve, reject });
  });
}

export function validateStore(db: IDBDatabase, name: string) {
  return db.objectStoreNames.contains(name);
}

interface StoreOption<T = any> {
  db: IDBDatabase;
  storeName: string;
  mode: IDBTransactionMode;
  replacer?: { value: T };
}

export function getDbAction<RequestConfig, State, R>(
  requester: (
    store: IDBObjectStore,
    config: RequestConfig
  ) => IDBRequest | [IDBRequest, (e: any) => void],
  options: StoreOption<R>
): <R>(config: RequestConfig) => Promise<R>;

export function getDbAction<RequestConfig, State>(
  requester: (
    store: IDBObjectStore,
    config: RequestConfig
  ) => IDBRequest | [IDBRequest, (e: any) => void],
  options: StoreOption
): (config: RequestConfig) => Promise<State>;

export function getDbAction<RequestConfig, State>(
  requester: (
    store: IDBObjectStore,
    config: RequestConfig
  ) => IDBRequest | [IDBRequest, (e: any) => void],
  options: StoreOption
) {
  return function crud(config: RequestConfig) {
    return promisify<State>(async ({ resolve, reject }) => {
      const { db, storeName, mode } = options;
      const store = await createTransaction(db, storeName, mode);
      const [request, navigator] = [requester(store, config)].flat(1) as [
        IDBRequest,
        ((e: any) => void) | undefined
      ];

      request.onsuccess = () => {
        if (options.replacer) {
          const { value } = options.replacer;
          resolve(value);

          if (navigator) {
            navigator(request.result);
          }
        } else {
          resolve(request.result);
        }
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  };
}

export function getStoreNames(stores: Array<IndexedDBStore>) {
  return stores.map((store) => ({
    name: store.name,
    keyPath: store.id.keyPath!,
  }));
}

export function captureObjectStoreOption(
  actionOption: EntryOption,
  mode: IDBTransactionMode
): CapturedObjectResult;
export function captureObjectStoreOption<R>(
  actionOption: EntryOption,
  mode: IDBTransactionMode,
  replace: R
): CapturedObjectResult & { replace: R };
export function captureObjectStoreOption<R>(
  actionOption: EntryOption,
  mode: IDBTransactionMode,
  replace?: R
): CapturedObjectResult {
  const captureObject = { ...actionOption, mode };
  if (replace === undefined) {
    return captureObject;
  } else {
    return Object.assign(captureObject, { replace });
  }
}
