/**
 * Sync Metadata Repository
 * Tracks entity-level version numbers, last synchronization timestamps,
 * and unsynced changes to detect and prevent conflicts.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type { EntitySyncMetadata, SyncEntityType } from '../../domain/models/sync-metadata';

export interface StoredSyncMetadata extends EntitySyncMetadata {
  id: string; // identifier mapped to entityId for store compatibility
}

export class SyncMetadataRepository extends BaseRepository<StoredSyncMetadata> {
  constructor() {
    super(STORES.SYNC_METADATA);
  }

  public async findByEntityType(entityType: SyncEntityType): Promise<StoredSyncMetadata[]> {
    const all = await this.findAll();
    return all.filter((item) => item.entityType === entityType);
  }

  public async getMetadata(entityId: string): Promise<StoredSyncMetadata | null> {
    return this.findById(entityId);
  }

  public async recordLocalEdit(
    entityId: string,
    entityType: SyncEntityType
  ): Promise<StoredSyncMetadata> {
    const existing = (await this.findById(entityId)) || {
      id: entityId,
      entityId,
      entityType,
      localVersion: 0,
      serverVersion: 0,
      lastSyncedAt: null,
      hasUnsyncedChanges: false,
    };

    const updated: StoredSyncMetadata = {
      ...existing,
      id: entityId,
      entityId,
      entityType,
      localVersion: existing.localVersion + 1,
      hasUnsyncedChanges: true,
    };

    return this.save(updated);
  }

  public async recordServerAck(
    entityId: string,
    entityType: SyncEntityType,
    serverVersion: number,
    ackTimestamp: string
  ): Promise<StoredSyncMetadata> {
    const existing = (await this.findById(entityId)) || {
      id: entityId,
      entityId,
      entityType,
      localVersion: serverVersion,
      serverVersion,
      lastSyncedAt: ackTimestamp,
      hasUnsyncedChanges: false,
    };

    const updated: StoredSyncMetadata = {
      ...existing,
      id: entityId,
      entityId,
      entityType,
      serverVersion,
      localVersion: Math.max(existing.localVersion, serverVersion),
      lastSyncedAt: ackTimestamp,
      hasUnsyncedChanges: false,
    };

    return this.save(updated);
  }
}

export const syncMetadataRepo = new SyncMetadataRepository();
