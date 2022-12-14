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
  let hasPerformStoreRefresh = false;
  let failedWhilePerformingRefresh = false;

  const onUpgradeDb: UpdateDbOnUpgradeHandler = (db, _, retrievedVersion) => {
    if (hasPerformStoreRefresh && !failedWhilePerformingRefresh) return;
    let eligibleForRefresh = !hasPerformStoreRefresh && forceStoreRefresh;
    stores.forEach((storeConfig) => {
      if (
        eligibleForRefresh &&
        !(config.storeRefreshWhitelist ?? []).includes(storeConfig.name) &&
        db.objectStoreNames.contains(storeConfig.name)
      ) {
        try {
          db.deleteObjectStore(storeConfig.name);
          hasPerformStoreRefresh = true;
        } catch {
          failedWhilePerformingRefresh = true;
        }
      }

      if (
        eligibleForRefresh ||
        retrievedVersion.old !== retrievedVersion.new ||
        !validateStore(db, storeConfig.name)
      ) {
        const store = db.createObjectStore(storeConfig.name, storeConfig.id);
        storeConfig.indices.forEach(({ name, keyPath, options }) => {
          store.createIndex(name, keyPath, options);
        });
      }
    });
  };

  if (forceStoreRefresh) {
    await _createDbConnection(
      databaseName,
      Math.trunc(version * Math.random() * 100),
      onUpgradeDb
    );
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
