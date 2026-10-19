/**
 * Promise-based IndexedDB Engine for ResQLink
 * Provides safe transactions, connection caching, and graceful fallback.
 */

import {
  DB_NAME,
  DB_VERSION,
  SCHEMA_DEFINITIONS,
  runMigrations,
  type StoreName,
} from './schema';

class IndexedDbClient {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  public async getDb(): Promise<IDBDatabase> {
    if (!this.isSupported()) {
      throw new Error('IndexedDB is not supported in this runtime environment.');
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = request.transaction;
        if (tx) {
          runMigrations(db, event.oldVersion, event.newVersion || DB_VERSION, tx);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(new Error(`Failed to open IndexedDB '${DB_NAME}': ${request.error?.message}`));
      };

      request.onblocked = () => {
        console.warn(`IndexedDB database ${DB_NAME} upgrade blocked by open connections.`);
      };
    });

    return this.dbPromise;
  }

  public async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
    const db = await this.getDb();
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);

      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.getDb();
    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllByIndex<T>(
    storeName: StoreName,
    indexName: string,
    query: IDBValidKey | IDBKeyRange
  ): Promise<T[]> {
    const db = await this.getDb();
    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(query);

      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async put<T>(storeName: StoreName, value: T): Promise<T> {
    const db = await this.getDb();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);

      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }

  public async putMany<T>(storeName: StoreName, values: T[]): Promise<void> {
    if (values.length === 0) return;
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted during putMany batch.'));

      for (const val of values) {
        store.put(val);
      }
    });
  }

  public async delete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async clear(storeName: StoreName): Promise<void> {
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async count(storeName: StoreName): Promise<number> {
    const db = await this.getDb();
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  public close(): void {
    if (this.dbPromise) {
      this.dbPromise.then((db) => db.close()).catch(() => {});
      this.dbPromise = null;
    }
  }
}

export const idb = new IndexedDbClient();
