/**
 * Offline Synchronization Queue Manager
 * Coordinates outbox processing, bounded exponential backoff retries,
 * truthful connectivity probing, conflict detection, and Background Sync lifecycle.
 *
 * Strict Invariants:
 * 1. An emergency request must NEVER appear remotely acknowledged without a verified backend response.
 * 2. Never assume the network is usable just because navigator.onLine is true.
 * 3. Prevent stale offline edits from silently overwriting newer data.
 */

import type {
  SyncQueueItem,
  SyncEntityType,
  SyncOperationAction,
  SyncQueueItemStatus,
  TruthfulSyncStatus,
} from '../domain/models/sync-metadata';
import { syncQueueRepo } from '../storage/repositories/sync-queue-repository';
import { syncMetadataRepo } from '../storage/repositories/sync-metadata-repository';
import { emergencyRequestRepo } from '../storage/repositories/emergency-request-repository';
import {
  type RemoteBackendAdapter,
  ExpressApiAdapter,
} from './sync-adapter';
import { pwaManager } from '../pwa/pwa-manager';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatusEvent {
  state: SyncState;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type SyncStatusListener = (event: SyncStatusEvent) => void;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Calculates bounded exponential backoff delay in milliseconds.
 * Delay formula: baseMs * 2^(attemptCount - 1) + 10% jitter, clamped to maxMs.
 */
export function calculateNextBackoffMs(
  attemptCount: number,
  baseMs: number = 1000,
  maxMs: number = 30000
): number {
  if (attemptCount <= 0) return 0;
  const exp = Math.min(maxMs, baseMs * Math.pow(2, attemptCount - 1));
  const jitter = Math.floor(Math.random() * (exp * 0.1));
  return Math.min(maxMs, exp + jitter);
}

export interface EnqueueOptions {
  idempotencyKey?: string;
  baseVersion?: number;
  maxAttempts?: number;
}

export class SyncQueueManager {
  private adapter: RemoteBackendAdapter;
  private isProcessing: boolean = false;
  private maxRetries: number = 5;
  private state: SyncState = 'idle';
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncStatusListener> = new Set();
  private foregroundPollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(adapter?: RemoteBackendAdapter) {
    this.adapter = adapter || new ExpressApiAdapter();
    this.initNetworkListeners();
  }

  public setAdapter(adapter: RemoteBackendAdapter): void {
    this.adapter = adapter;
  }

  public getAdapter(): RemoteBackendAdapter {
    return this.adapter;
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  public getStatus(): SyncStatusEvent {
    return {
      state: this.state,
      pendingCount: 0,
      failedCount: 0,
      conflictCount: 0,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  private async notify(): Promise<void> {
    const pending = await syncQueueRepo.findPending();
    const failed = await syncQueueRepo.findFailed();
    const conflicts = await syncQueueRepo.findConflicts();

    const event: SyncStatusEvent = {
      state: this.state,
      pendingCount: pending.length,
      failedCount: failed.length,
      conflictCount: conflicts.length,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in sync status listener:', err);
      }
    }
  }

  private initNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      // Online event: trigger probe & flush
      window.addEventListener('online', () => {
        this.processQueue().catch(console.error);
      });

      // Offline event: truthfully mark state as offline
      window.addEventListener('offline', () => {
        this.state = 'offline';
        this.notify().catch(() => {});
      });

      // Visibility change fallback: when app is brought back to foreground
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.processQueue().catch(() => {});
        }
      });

      // Window focus fallback
      window.addEventListener('focus', () => {
        this.processQueue().catch(() => {});
      });

      // Background polling timer for active retries and periodic synchronization
      this.foregroundPollTimer = setInterval(() => {
        if (!this.isProcessing) {
          syncQueueRepo.findPending().then((items) => {
            if (items.length > 0) {
              this.processQueue().catch(() => {});
            }
          });
        }
      }, 15000);
      if (this.foregroundPollTimer && typeof (this.foregroundPollTimer as any).unref === 'function') {
        (this.foregroundPollTimer as any).unref();
      }
    }
  }

  /**
   * Enqueues an outgoing operation into the persistent offline outbox.
   * Handles duplicate prevention and updates local sync metadata.
   */
  public async enqueue(
    entityType: SyncEntityType,
    entityId: string,
    action: SyncOperationAction,
    payload: Record<string, unknown>,
    optionsOrKey: string | EnqueueOptions = {}
  ): Promise<SyncQueueItem> {
    const options: EnqueueOptions =
      typeof optionsOrKey === 'string'
        ? { idempotencyKey: optionsOrKey }
        : optionsOrKey || {};

    const now = new Date().toISOString();
    const idempotencyKey =
      options.idempotencyKey || `${entityId}-${action}-${Date.now()}`;

    // Duplicate prevention: check if identical operation is already queued
    const existing = await syncQueueRepo.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    // Check if a pending edit for the same entity already exists; if so, update payload
    const existingForEntity = await syncQueueRepo.findByEntity(entityType, entityId);
    const activeItem = existingForEntity.find(
      (i) => i.status === 'pending' || i.status === 'waiting_to_sync'
    );

    if (activeItem && action === 'update') {
      activeItem.payload = { ...activeItem.payload, ...payload };
      activeItem.updatedAt = now;
      activeItem.baseVersion = options.baseVersion ?? activeItem.baseVersion;
      await syncQueueRepo.save(activeItem);
      await this.notify();
      return activeItem;
    }

    const item: SyncQueueItem = {
      id: generateId(),
      operationId: generateId(),
      entityType,
      entityId,
      action,
      operationType: action,
      payload,
      idempotencyKey,
      clientTimestamp: now,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      attemptCount: 0,
      retryCount: 0,
      maxAttempts: options.maxAttempts ?? this.maxRetries,
      nextAttemptAt: null,
      baseVersion: options.baseVersion ?? 1,
      permanentError: false,
      lastAttemptAt: null,
      lastError: null,
      serverAckTimestamp: null,
    };

    await syncQueueRepo.save(item);

    // Record local unsynced edit in metadata
    await syncMetadataRepo.recordLocalEdit(entityId, entityType);

    // If emergency request, record truthful status 'pending' (never remotely acknowledged without server ack)
    if (entityType === 'emergency_request') {
      const req = await emergencyRequestRepo.findById(entityId);
      if (req) {
        req.syncStatus = 'pending';
        req.acknowledged = false; // INVARIANT: Never remotely acknowledged without verified server response
        req.updatedAt = now;
        await emergencyRequestRepo.save(req);
      }
    }

    await this.notify();

    // Register Background Sync if supported in browser environment
    if (typeof window !== 'undefined') {
      pwaManager.requestBackgroundSync('resqlink-sync').catch(() => {});

      // Opportunistically attempt to flush foreground queue in browser if network is online
      if (typeof navigator === 'undefined' || navigator.onLine) {
        this.processQueue().catch((err) => {
          console.warn('[SyncQueue] Immediate queue flush notice:', err);
        });
      }
    }

    return item;
  }

  /**
   * Processes the outbox queue in FIFO order with bounded exponential backoff.
   * Strictly probes real network availability before attempting transmissions.
   */
  public async processQueue(): Promise<{
    processed: number;
    errors: number;
    conflicts: number;
  }> {
    if (this.isProcessing) {
      return { processed: 0, errors: 0, conflicts: 0 };
    }

    this.isProcessing = true;
    this.state = 'syncing';
    this.lastError = null;

    let processed = 0;
    let errors = 0;
    let conflicts = 0;

    try {
      // Truthful network verification: DO NOT assume network is usable just because navigator.onLine === true
      const isOnline = await this.adapter.isAvailable();
      if (!isOnline) {
        this.state = 'offline';
        this.isProcessing = false;
        await this.notify();
        return { processed: 0, errors: 0, conflicts: 0 };
      }

      const pendingItems = await syncQueueRepo.findPending();

      for (const item of pendingItems) {
        // Enforce bounded exponential backoff delay if prior attempts failed
        if (item.retryCount > 0 && item.lastAttemptAt) {
          const backoffMs = calculateNextBackoffMs(item.retryCount);
          const elapsed = Date.now() - new Date(item.lastAttemptAt).getTime();
          if (elapsed < backoffMs) {
            continue; // Skip item until backoff period passes
          }
        }

        // Transition to synchronizing
        item.status = 'synchronizing';
        item.lastAttemptAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
        await syncQueueRepo.save(item);

        if (item.entityType === 'emergency_request') {
          const req = await emergencyRequestRepo.findById(item.entityId);
          if (req) {
            req.syncStatus = 'synchronizing';
            await emergencyRequestRepo.save(req);
          }
        }

        const result = await this.adapter.pushQueueItem(item);

        if (result.success) {
          item.status = 'confirmed_by_server';
          item.serverAckTimestamp = result.serverAckTimestamp || new Date().toISOString();
          item.serverVersion = result.serverVersion;
          await syncQueueRepo.save(item);
          processed++;

          // Update sync metadata with server acknowledgment
          if (result.serverVersion) {
            await syncMetadataRepo.recordServerAck(
              item.entityId,
              item.entityType,
              result.serverVersion,
              item.serverAckTimestamp
            );
          }

          // Update EmergencyRequest entity state
          if (item.entityType === 'emergency_request') {
            const req = await emergencyRequestRepo.findById(item.entityId);
            if (req) {
              req.syncStatus = 'synced';
              req.acknowledged = true;
              req.acknowledgedAt = item.serverAckTimestamp;
              req.serverAckTimestamp = item.serverAckTimestamp;
              if (result.serverVersion) {
                req.version = result.serverVersion;
              }
              await emergencyRequestRepo.save(req);
            }
          }

          // Remove completed item from queue to keep outbox lean
          await syncQueueRepo.delete(item.id);
        } else if (result.conflict) {
          // Conflict detected: remote state has evolved; requires review
          conflicts++;
          item.status = 'conflict';
          item.serverVersion = result.serverVersion;
          item.lastError = result.error || 'Conflict: Remote entity is newer than local edit.';
          item.updatedAt = new Date().toISOString();
          await syncQueueRepo.save(item);

          if (item.entityType === 'emergency_request') {
            const req = await emergencyRequestRepo.findById(item.entityId);
            if (req) {
              req.syncStatus = 'conflict';
              await emergencyRequestRepo.save(req);
            }
          }
        } else {
          // Transmission failure
          errors++;
          item.attemptCount += 1;
          item.retryCount = item.attemptCount;
          item.lastError = result.error || 'Unknown sync error';
          item.updatedAt = new Date().toISOString();

          // Non-retryable permanent error detection (e.g. 400 Bad Request or max retries exceeded)
          const isClientPermanent =
            result.statusCode !== undefined &&
            result.statusCode >= 400 &&
            result.statusCode < 500 &&
            result.statusCode !== 408 &&
            result.statusCode !== 429;

          if (item.attemptCount >= item.maxAttempts || isClientPermanent) {
            item.status = 'failed';
            item.permanentError = true;
            item.nextAttemptAt = null;
          } else {
            item.status = 'waiting_to_sync';
            const backoffMs = calculateNextBackoffMs(item.attemptCount);
            item.nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();
          }

          await syncQueueRepo.save(item);

          if (item.entityType === 'emergency_request') {
            const req = await emergencyRequestRepo.findById(item.entityId);
            if (req) {
              req.syncStatus = 'failed';
              await emergencyRequestRepo.save(req);
            }
          }
        }
      }

      this.lastSyncedAt = new Date().toISOString();
      this.state = errors > 0 || conflicts > 0 ? 'error' : 'idle';
    } catch (err: unknown) {
      this.state = 'error';
      this.lastError = err instanceof Error ? err.message : String(err);
      errors++;
    } finally {
      this.isProcessing = false;
      await this.notify();
    }

    return { processed, errors, conflicts };
  }

  /**
   * User-controlled retry for a specific failed queue operation.
   */
  public async retryOperation(id: string): Promise<boolean> {
    const item = await syncQueueRepo.findById(id);
    if (!item) return false;

    item.attemptCount = 0;
    item.retryCount = 0;
    item.permanentError = false;
    item.status = 'pending';
    item.nextAttemptAt = null;
    item.lastError = null;
    item.updatedAt = new Date().toISOString();
    await syncQueueRepo.save(item);

    if (item.entityType === 'emergency_request') {
      const req = await emergencyRequestRepo.findById(item.entityId);
      if (req) {
        req.syncStatus = 'pending';
        await emergencyRequestRepo.save(req);
      }
    }

    await this.notify();
    await this.processQueue();
    return true;
  }

  /**
   * User-controlled retry for all failed queue operations.
   */
  public async retryAllFailed(): Promise<number> {
    const failedItems = await syncQueueRepo.findFailed();
    for (const item of failedItems) {
      item.attemptCount = 0;
      item.retryCount = 0;
      item.permanentError = false;
      item.status = 'pending';
      item.nextAttemptAt = null;
      item.lastError = null;
      item.updatedAt = new Date().toISOString();
      await syncQueueRepo.save(item);

      if (item.entityType === 'emergency_request') {
        const req = await emergencyRequestRepo.findById(item.entityId);
        if (req) {
          req.syncStatus = 'pending';
          await emergencyRequestRepo.save(req);
        }
      }
    }

    await this.notify();
    await this.processQueue();
    return failedItems.length;
  }

  /**
   * Resolves a conflict on a queued entity.
   * - 'keep_local': Re-bases the local edit onto the remote version and forces re-sync.
   * - 'accept_server': Discards the local pending change and accepts remote server state.
   */
  public async resolveConflict(
    id: string,
    resolution: 'keep_local' | 'accept_server'
  ): Promise<boolean> {
    const item = await syncQueueRepo.findById(id);
    if (!item || item.status !== 'conflict') return false;

    if (resolution === 'keep_local') {
      // Rebase local edit to match current server version
      item.baseVersion = item.serverVersion ?? (item.baseVersion ? item.baseVersion + 1 : 2);
      item.status = 'pending';
      item.attemptCount = 0;
      item.nextAttemptAt = null;
      item.lastError = null;
      item.updatedAt = new Date().toISOString();
      await syncQueueRepo.save(item);
      await this.processQueue();
      return true;
    }

    if (resolution === 'accept_server') {
      // Discard local operation
      await syncQueueRepo.delete(id);
      // Fetch latest remote version if possible
      if (item.entityType === 'emergency_request') {
        const remoteRequests = await this.adapter.fetchRemoteRequests();
        const matching = remoteRequests.find((r) => r.id === item.entityId);
        if (matching) {
          matching.syncStatus = 'confirmed_by_server';
          matching.acknowledged = true;
          await emergencyRequestRepo.save(matching);
        }
      }
      await this.notify();
      return true;
    }

    return false;
  }

  public destroy(): void {
    if (this.foregroundPollTimer) {
      clearInterval(this.foregroundPollTimer);
      this.foregroundPollTimer = null;
    }
  }
}

export const syncQueueManager = new SyncQueueManager();
