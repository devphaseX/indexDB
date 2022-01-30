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
  const { databaseName, version, stores } = config;

  const onUpgradeDb: UpdateDbOnUpgradeHandler = (db) => {
    stores.forEach((storeConfig) => {
      if (!validateStore(db, storeConfig.name)) {
        const store = db.createObjectStore(storeConfig.name, storeConfig.id);
        storeConfig.indices.forEach(({ name, keyPath, options }) => {
          store.createIndex(name, keyPath, options);
        });
      }
    });
  };
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
