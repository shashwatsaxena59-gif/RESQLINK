/**
 * Sync Queue Repository
 * Manages outbox items waiting to be synchronized with the remote backend.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type { SyncQueueItem, SyncQueueItemStatus } from '../../domain/models/sync-metadata';

export class SyncQueueRepository extends BaseRepository<SyncQueueItem> {
  constructor() {
    super(STORES.SYNC_QUEUE);
  }

  public async findByStatus(status: SyncQueueItemStatus): Promise<SyncQueueItem[]> {
    const all = await this.findAll();
    return all.filter((item) => item.status === status);
  }

  public async findPending(): Promise<SyncQueueItem[]> {
    const all = await this.findAll();
    return all
      .filter(
        (item) =>
          item.status === 'pending' ||
          item.status === 'waiting_to_sync' ||
          (item.status === 'failed' && !item.permanentError)
      )
      .sort((a, b) => new Date(a.createdAt || a.clientTimestamp).getTime() - new Date(b.createdAt || b.clientTimestamp).getTime());
  }

  public async findFailed(): Promise<SyncQueueItem[]> {
    const all = await this.findAll();
    return all.filter((item) => item.status === 'failed');
  }

  public async findConflicts(): Promise<SyncQueueItem[]> {
    const all = await this.findAll();
    return all.filter((item) => item.status === 'conflict');
  }

  public async findByEntity(entityType: string, entityId: string): Promise<SyncQueueItem[]> {
    const all = await this.findAll();
    return all.filter((item) => item.entityType === entityType && item.entityId === entityId);
  }

  public async findByIdempotencyKey(key: string): Promise<SyncQueueItem | null> {
    const all = await this.findAll();
    return all.find((item) => item.idempotencyKey === key) ?? null;
  }
}

export const syncQueueRepo = new SyncQueueRepository();
