export interface IndexedDBColumn {
  name: string;
  keyPath: string;
  options?: IDBIndexParameters;
}

export interface IndexedDBStore {
  name: string;
  id: IDBObjectStoreParameters;
  indices: IndexedDBColumn[];
}

export interface IndexedDBConfig {
  databaseName: string;
  version: number;
  stores: IndexedDBStore[];
}

export interface TransactionOptions {
  storeName: string;
  dbMode: IDBTransactionMode;
  error: (e: Event) => any;
  complete: (e: Event) => any;
  abort?: any;
}

interface DbVersion {
  old: number;
  new: number;
}

export type UpdateDbOnUpgradeHandler = (
  db: IDBDatabase,
  name: string,
  version: DbVersion
) => void;

interface IdRecognise {
  id: string | number;
}

export interface GetByIDProps extends IdRecognise {}

export interface DeleteByIdProps extends IdRecognise {}

export interface ObjectCursorProps {
  navigator: (e: IDBCursor) => void;
  keyRange?: IDBKeyRange;
}

export interface GetOneByIndexProps {
  keyPath: string;
  value: string | number;
}

interface CreateOrUpdate<State> {
  value: State;
}

export type AddProps<State> =
  | CreateOrUpdate<State>
  | (CreateOrUpdate<State> & { keyPath: string });

export interface DbConnectionResult {
  storeConfig: Array<{ name: string; keyPath: string | string[] }>;
  db: IDBDatabase;
}

export interface CapturedObjectResult extends EntryOption {
  mode: IDBTransactionMode;
}

export interface EntryOption {
  db: IDBDatabase;
  storeName: string;
}
