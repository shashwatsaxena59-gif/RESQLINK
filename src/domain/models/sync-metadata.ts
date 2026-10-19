/**
 * Synchronization Metadata Domain Model
 * Tracks local vs remote operational state, change queues, and conflict resolutions.
 */

export type SyncOperationAction = 'create' | 'update' | 'delete';

export type TruthfulSyncStatus =
  | 'saved_locally'
  | 'waiting_to_sync'
  | 'synchronizing'
  | 'confirmed_by_server'
  | 'failed'
  | 'conflict';

export type SyncQueueItemStatus =
  | TruthfulSyncStatus
  | 'pending'    // alias for waiting_to_sync
  | 'in_flight'  // alias for synchronizing
  | 'synced';    // alias for confirmed_by_server

export type SyncEntityType =
  | 'emergency_request'
  | 'volunteer'
  | 'resource_offer'
  | 'shelter'
  | 'volunteer_task'
  | 'incident';

export interface SyncQueueItem {
  id: string; // Unique operation ID
  operationId?: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncOperationAction;
  operationType?: SyncOperationAction;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  clientTimestamp: string; // ISO 8601 UTC timestamp
  createdAt: string; // ISO 8601 UTC creation timestamp
  updatedAt: string; // ISO 8601 UTC update timestamp
  status: SyncQueueItemStatus;
  attemptCount: number; // Execution attempt count
  retryCount: number; // Backward-compatible alias
  maxAttempts: number;
  nextAttemptAt?: string | null; // ISO 8601 timestamp for bounded exponential backoff
  baseVersion?: number; // Client entity version at creation time
  serverVersion?: number; // Latest known server version
  permanentError?: boolean;
  lastAttemptAt?: string | null;
  lastError?: string | null;
  serverAckTimestamp?: string | null;
}

export interface EntitySyncMetadata {
  entityId: string;
  entityType: SyncEntityType;
  localVersion: number;
  serverVersion: number;
  lastSyncedAt: string | null; // ISO 8601 UTC timestamp
  hasUnsyncedChanges: boolean;
}

export interface TruthfulStatusDisplay {
  status: TruthfulSyncStatus;
  label: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  colorClass: string;
  description: string;
}

export function normalizeTruthfulStatus(status: SyncQueueItemStatus | undefined): TruthfulSyncStatus {
  if (!status) return 'saved_locally';
  if (status === 'synced' || status === 'confirmed_by_server') return 'confirmed_by_server';
  if (status === 'in_flight' || status === 'synchronizing') return 'synchronizing';
  if (status === 'pending' || status === 'waiting_to_sync') return 'waiting_to_sync';
  if (status === 'failed') return 'failed';
  if (status === 'conflict') return 'conflict';
  return 'saved_locally';
}

export function getTruthfulStatusMeta(status: SyncQueueItemStatus | undefined): TruthfulStatusDisplay {
  const normalized = normalizeTruthfulStatus(status);
  switch (normalized) {
    case 'saved_locally':
      return {
        status: 'saved_locally',
        label: 'Saved locally',
        badgeVariant: 'secondary',
        colorClass: 'text-slate-400 bg-slate-800/60 border-slate-700',
        description: 'Persisted in local device storage. Not yet enqueued for transmission.',
      };
    case 'waiting_to_sync':
      return {
        status: 'waiting_to_sync',
        label: 'Waiting to sync',
        badgeVariant: 'outline',
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        description: 'Enqueued in offline outbox. Awaiting verified network connection or backoff timer.',
      };
    case 'synchronizing':
      return {
        status: 'synchronizing',
        label: 'Synchronizing',
        badgeVariant: 'outline',
        colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        description: 'Operation currently in-flight to emergency dispatch endpoints.',
      };
    case 'confirmed_by_server':
      return {
        status: 'confirmed_by_server',
        label: 'Confirmed by server',
        badgeVariant: 'default',
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        description: 'Verified remote acknowledgment received with server timestamp.',
      };
    case 'failed':
      return {
        status: 'failed',
        label: 'Failed',
        badgeVariant: 'destructive',
        colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        description: 'Permanent failure or retries exhausted. User review and retry required.',
      };
    case 'conflict':
      return {
        status: 'conflict',
        label: 'Conflict requires review',
        badgeVariant: 'destructive',
        colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        description: 'Stale offline edit detected against newer remote state. Resolution required.',
      };
  }
}
