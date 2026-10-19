/**
 * Base Repository supporting IndexedDB with transparent In-Memory fallback.
 * Guarantees zero crashing in test/SSR environments while ensuring persistent IndexedDB in browser.
 */

import { idb } from '../indexeddb/indexed-db';
import type { StoreName } from '../indexeddb/schema';

export abstract class BaseRepository<T extends { id: string }> {
  protected inMemoryStore: Map<string, T> = new Map();

  constructor(protected readonly storeName: StoreName) {}

  protected get useIdb(): boolean {
    return idb.isSupported();
  }

  public async findById(id: string): Promise<T | null> {
    if (this.useIdb) {
      try {
        return await idb.get<T>(this.storeName, id);
      } catch (err) {
        console.warn(`[${this.storeName}] IDB read error, falling back to memory:`, err);
      }
    }
    return this.inMemoryStore.get(id) ?? null;
  }

  public async findAll(): Promise<T[]> {
    if (this.useIdb) {
      try {
        return await idb.getAll<T>(this.storeName);
      } catch (err) {
        console.warn(`[${this.storeName}] IDB getAll error, falling back to memory:`, err);
      }
    }
    return Array.from(this.inMemoryStore.values());
  }

  public async save(entity: T): Promise<T> {
    this.inMemoryStore.set(entity.id, entity);
    if (this.useIdb) {
      try {
        await idb.put<T>(this.storeName, entity);
      } catch (err) {
        console.warn(`[${this.storeName}] IDB save error:`, err);
      }
    }
    return entity;
  }

  public async saveBatch(entities: T[]): Promise<void> {
    for (const ent of entities) {
      this.inMemoryStore.set(ent.id, ent);
    }
    if (this.useIdb) {
      try {
        await idb.putMany<T>(this.storeName, entities);
      } catch (err) {
        console.warn(`[${this.storeName}] IDB saveBatch error:`, err);
      }
    }
  }

  public async delete(id: string): Promise<void> {
    this.inMemoryStore.delete(id);
    if (this.useIdb) {
      try {
        await idb.delete(this.storeName, id);
      } catch (err) {
        console.warn(`[${this.storeName}] IDB delete error:`, err);
      }
    }
  }

  public async clear(): Promise<void> {
    this.inMemoryStore.clear();
    if (this.useIdb) {
      try {
        await idb.clear(this.storeName);
      } catch (err) {
        console.warn(`[${this.storeName}] IDB clear error:`, err);
      }
    }
  }

  public async count(): Promise<number> {
    if (this.useIdb) {
      try {
        return await idb.count(this.storeName);
      } catch (err) {
        console.warn(`[${this.storeName}] IDB count error:`, err);
      }
    }
    return this.inMemoryStore.size;
  }
}
