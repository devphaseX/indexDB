import {
  AddProps,
  DbConnectionResult,
  DeleteByIdProps,
  GetByIDProps,
  GetOneByIndexProps,
  IndexedDBConfig,
  ObjectCursorProps,
  UpdateDbOnUpgradeHandler,
} from './types';
import {
  captureObjectStoreOption,
  getDbAction,
  getStoreNames,
  validateStore,
  _createDbConnection,
} from './util.js';

export async function openDbConnection(
  config: IndexedDBConfig
): Promise<DbConnectionResult> {
  const { databaseName, version, stores, forceStoreRefresh } = config;

  const onUpgradeDb: UpdateDbOnUpgradeHandler = (db, _, retrievedVersion) => {
    stores.forEach((storeConfig) => {
      const { name: storeName, id: storeId } = storeConfig;
      if (
        !(config.storeRefreshWhitelist ?? []).includes(storeName) &&
        db.objectStoreNames.contains(storeName)
      ) {
        try {
          db.deleteObjectStore(storeName);
        } catch {}
      }

      if (
        retrievedVersion.old !== retrievedVersion.new ||
        !validateStore(db, storeName)
      ) {
        const store = db.createObjectStore(storeName, storeId);
        storeConfig.indices.forEach(({ name, keyPath, options }) => {
          store.createIndex(name, keyPath, options);
        });
      }
    });
  };

  refreshDb: if (forceStoreRefresh) {
    const retrievedDataInfo = (await indexedDB.databases()).find(
      ({ name }) => name === databaseName
    );
    if (!retrievedDataInfo || !retrievedDataInfo.name) break refreshDb;
    const _dbName = retrievedDataInfo.name;

    await new Promise((res, rej) => {
      const result = indexedDB.deleteDatabase(_dbName);
      result.onerror = (error) =>
        rej(
          new Error(`Failed to delete the database on forceRefresh Request`, {
            cause: (error as any).error,
          })
        );
      result.onsuccess = res;
    });
  }

  const db = await _createDbConnection(databaseName, version, onUpgradeDb);
  return { db, storeConfig: getStoreNames(stores) };
}

export function getActions<T>(entryOption: {
  db: IDBDatabase;
  storeName: string;
}) {
  const getByID = getDbAction<GetByIDProps, T>((store, { id }) => {
    return store.get(id);
  }, captureObjectStoreOption(entryOption, 'readonly'));

  const getOneByIndex = getDbAction<GetOneByIndexProps, T>(
    (store, { keyPath, value }) => {
      return store.index(keyPath).get(value);
    },
    captureObjectStoreOption(entryOption, 'readonly')
  );

  const getManyByIndex = getDbAction<GetOneByIndexProps, T>(
    (store, { keyPath, value }) => {
      return store.index(keyPath).getAll(value);
    },
    captureObjectStoreOption(entryOption, 'readonly')
  );

  const getAll = getDbAction<void, T>((store) => {
    return store.getAll();
  }, captureObjectStoreOption(entryOption, 'readonly'));

  const add = getDbAction<AddProps<T>, T>((store, config) => {
    return store.add(config.value);
  }, captureObjectStoreOption(entryOption, 'readwrite'));

  const update = getDbAction<AddProps<T>, T>((store, config) => {
    return store.put(config.value);
  }, captureObjectStoreOption(entryOption, 'readwrite'));

  const deleteByID = getDbAction<DeleteByIdProps, true>((store, { id }) => {
    return store.delete(id);
  }, captureObjectStoreOption(entryOption, 'readwrite', true));

  const deleteAll = getDbAction<void, true>((store) => {
    return store.clear();
  }, captureObjectStoreOption(entryOption, 'readwrite', true));

  const openCursor = getDbAction<ObjectCursorProps, IDBCursor>(
    (store, { keyRange, navigator }) => {
      const cursorRequest = store.openKeyCursor(keyRange);
      return [cursorRequest, navigator];
    },
    captureObjectStoreOption(entryOption, 'readwrite')
  );

  return {
    getByID,
    getOneByIndex,
    getManyByIndex,
    getAll,
    add,
    update,
    deleteByID,
    deleteAll,
    openCursor,
  };
}
