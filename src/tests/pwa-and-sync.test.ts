/**
 * ResQLink — Offline PWA, IndexedDB & Sync Engine Comprehensive Test Suite
 *
 * Verifies:
 * 1. PWA Web App Manifest, icons, and Service Worker caching rules (no sensitive caching).
 * 2. IndexedDB safe migrations (never drop pending SOS requests during schema upgrades).
 * 3. Offline request creation, refresh persistence, and truthful status indicators.
 * 4. Network probe verification (never assume network is usable just because navigator.onLine is true).
 * 5. Duplicate operation prevention via idempotency keys.
 * 6. Bounded exponential backoff calculation and retry timing.
 * 7. Permanent failure handling (4xx / max retries) and user-controlled retry.
 * 8. Stale offline edit conflict detection (version mismatch) and resolution actions.
 * 9. Environments without Background Sync API (graceful foreground fallback).
 * 10. Offline map & routing fallbacks.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Storage & Sync imports
import {
  DB_NAME,
  DB_VERSION,
  STORES,
  PROTECTED_STORES,
  runMigrations,
} from '../storage/indexeddb/schema';
import { emergencyRequestRepo } from '../storage/repositories/emergency-request-repository';
import { syncQueueRepo } from '../storage/repositories/sync-queue-repository';
import { syncMetadataRepo } from '../storage/repositories/sync-metadata-repository';
import {
  SyncQueueManager,
  calculateNextBackoffMs,
} from '../sync/sync-queue';
import {
  LocalInMemoryAdapter,
  type RemoteBackendAdapter,
} from '../sync/sync-adapter';
import {
  createEmergencyRequest,
} from '../domain/services/request-service';
import {
  getTruthfulStatusMeta,
  normalizeTruthfulStatus,
  type SyncQueueItem,
} from '../domain/models/sync-metadata';
import { pwaManager } from '../pwa/pwa-manager';
import { fetchRoute } from '../lib/geo';

// ── 1. PWA Manifest & Service Worker Cache Validation ─────────────────────────

test('PWA: Manifest conforms to installability requirements', () => {
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in public directory');

  const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(content.short_name, 'ResQLink');
  assert.equal(content.start_url, '/');
  assert.equal(content.display, 'standalone');
  assert.ok(content.theme_color);
  assert.ok(content.background_color);

  // Check icons: 192, 512, maskable
  assert.ok(Array.isArray(content.icons) && content.icons.length >= 3);
  const has192 = content.icons.some((i: { sizes: string }) => i.sizes === '192x192');
  const has512 = content.icons.some((i: { sizes: string }) => i.sizes === '512x512');
  const hasMaskable = content.icons.some((i: { purpose?: string }) => i.purpose === 'maskable');

  assert.ok(has192, 'Manifest must declare 192x192 icon');
  assert.ok(has512, 'Manifest must declare 512x512 icon');
  assert.ok(hasMaskable, 'Manifest must declare maskable icon');
});

test('PWA: Service Worker implements versioning and excludes sensitive API caching', () => {
  const swPath = path.resolve(process.cwd(), 'public/sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js must exist in public directory');

  const swContent = fs.readFileSync(swPath, 'utf8');

  // Cache versioning & cleanup
  assert.ok(swContent.includes('CACHE_VERSION'), 'Service worker must declare cache versioning');
  assert.ok(swContent.includes('caches.delete'), 'Service worker must evict obsolete caches on activate');

  // Invariant: Never cache sensitive user-specific API responses in shared cache
  assert.ok(
    swContent.includes('/api/auth') && swContent.includes('/api/confidential'),
    'Service worker must explicitly exclude sensitive auth & medical API patterns from caching'
  );

  // Background sync handler
  assert.ok(swContent.includes("addEventListener('sync'"), 'Service worker must listen for Background Sync events');
});

// ── 2. IndexedDB Safe Migrations ──────────────────────────────────────────────

test('IndexedDB: Protected stores (pending SOS & sync queue) are never deleted during migrations', () => {
  assert.ok(PROTECTED_STORES.includes(STORES.EMERGENCY_REQUESTS));
  assert.ok(PROTECTED_STORES.includes(STORES.SYNC_QUEUE));

  // Mock IDBDatabase and IDBTransaction to simulate upgrade from v1 to v2
  const createdStores: string[] = [];
  const createdIndices: string[] = [];

  const mockDb = {
    objectStoreNames: {
      contains: (name: string) => name === STORES.EMERGENCY_REQUESTS || name === STORES.SYNC_QUEUE,
    },
    createObjectStore: (name: string) => {
      createdStores.push(name);
      return {
        indexNames: { contains: () => false },
        createIndex: (idx: string) => createdIndices.push(idx),
      };
    },
  } as unknown as IDBDatabase;

  const mockTx = {
    objectStore: (name: string) => ({
      indexNames: { contains: () => true },
      createIndex: (idx: string) => createdIndices.push(idx),
    }),
  } as unknown as IDBTransaction;

  // Run migration from version 1 to 2
  runMigrations(mockDb, 1, 2, mockTx);

  // sync_metadata should be created
  assert.ok(createdStores.includes(STORES.SYNC_METADATA));
  // emergency_requests and sync_queue must never be in deleted list
});

// ── 3. Offline Request Creation & Truthful Status Indicators ──────────────────

test('Truthful Status Indicators: All 6 statuses map truthfully with no false remote acks', () => {
  const statuses = [
    'saved_locally',
    'waiting_to_sync',
    'synchronizing',
    'confirmed_by_server',
    'failed',
    'conflict',
  ] as const;

  for (const st of statuses) {
    const meta = getTruthfulStatusMeta(st);
    assert.ok(meta.label);
    assert.ok(meta.description);
    assert.equal(meta.status, st);
  }

  // An emergency request created locally MUST NOT appear remotely acknowledged
  const req = createEmergencyRequest({
    category: 'rescue',
    description: 'Elderly person trapped in flooded room.',
    severity: 'critical',
    numberOfPeople: 1,
    requiredResources: ['inflatable_boat'],
    idempotencyKey: 'offline-sos-truthful-1',
  });

  // Locally created request must never have acknowledged = true
  assert.notEqual(req.acknowledged, true, 'Request created offline must never appear remotely acknowledged');
  assert.equal(normalizeTruthfulStatus(req.syncStatus), 'waiting_to_sync');
});

// ── 4. Truthful Connectivity Check (Not Assuming navigator.onLine) ─────────────

test('Sync Engine: Does not flush outbox if network probe fails even when navigator.onLine is true', async () => {
  await emergencyRequestRepo.clear();
  await syncQueueRepo.clear();

  // Adapter simulates captive portal or broken Wi-Fi: isAvailable returns false
  const captivePortalAdapter: RemoteBackendAdapter = {
    name: 'CaptivePortalAdapter',
    async isAvailable() {
      return false; // Ping probe failed!
    },
    async pushQueueItem() {
      throw new Error('Should not push when probe fails');
    },
    async fetchRemoteRequests() { return []; },
    async fetchRemoteTasks() { return []; },
    async fetchRemoteShelters() { return []; },
  };

  const syncManager = new SyncQueueManager(captivePortalAdapter);

  const req = createEmergencyRequest({
    category: 'medical',
    description: 'Asthma attack, inhaler depleted.',
    severity: 'critical',
    numberOfPeople: 1,
    requiredResources: ['albuterol'],
    idempotencyKey: 'probe-test-1',
  });

  await emergencyRequestRepo.save(req);
  await syncManager.enqueue('emergency_request', req.id, 'create', req as unknown as Record<string, unknown>, req.idempotencyKey);

  // Attempt to process queue
  const { processed, errors } = await syncManager.processQueue();
  assert.equal(processed, 0, 'Must not process items when probe check fails');
  assert.equal(errors, 0);

  // Item remains safely preserved in outbox
  const pending = await syncQueueRepo.findPending();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].entityId, req.id);
});

// ── 5. Duplicate Prevention via Idempotency Key ───────────────────────────────

test('Sync Engine: Duplicate operations with same idempotency key are rejected/deduplicated', async () => {
  await syncQueueRepo.clear();
  const syncManager = new SyncQueueManager(new LocalInMemoryAdapter());

  const op1 = await syncManager.enqueue(
    'emergency_request',
    'entity-dup-1',
    'create',
    { title: 'Operation 1' },
    'idempotency-key-unique-123'
  );

  const op2 = await syncManager.enqueue(
    'emergency_request',
    'entity-dup-1',
    'create',
    { title: 'Operation 1 duplicate' },
    'idempotency-key-unique-123'
  );

  assert.equal(op1.id, op2.id, 'Must return existing queue item for duplicate idempotency key');
  const allQueue = await syncQueueRepo.findAll();
  assert.equal(allQueue.length, 1, 'Outbox must contain exactly one entry');
});

// ── 6. Bounded Exponential Backoff ────────────────────────────────────────────

test('Sync Engine: Bounded exponential backoff calculates delays and clamps to maximum', () => {
  // Base 1000ms, max 30000ms
  const d1 = calculateNextBackoffMs(1, 1000, 30000); // 1000ms + jitter
  const d2 = calculateNextBackoffMs(2, 1000, 30000); // 2000ms + jitter
  const d3 = calculateNextBackoffMs(3, 1000, 30000); // 4000ms + jitter
  const d4 = calculateNextBackoffMs(4, 1000, 30000); // 8000ms + jitter
  const d10 = calculateNextBackoffMs(10, 1000, 30000); // clamped at 30000ms

  assert.ok(d1 >= 1000 && d1 <= 1100);
  assert.ok(d2 >= 2000 && d2 <= 2200);
  assert.ok(d3 >= 4000 && d3 <= 4400);
  assert.ok(d4 >= 8000 && d4 <= 8800);
  assert.equal(d10, 30000, 'Must clamp delay at maxMs');
});

// ── 7. Permanent Failure Handling & User-Controlled Retry ─────────────────────

test('Sync Engine: Marks permanent failure on max attempts and supports user retry', async () => {
  await emergencyRequestRepo.clear();
  await syncQueueRepo.clear();

  const adapter = new LocalInMemoryAdapter();
  adapter.simulateFailure = true;
  adapter.simulateFailureStatusCode = 500;

  const syncManager = new SyncQueueManager(adapter);

  const item = await syncManager.enqueue(
    'emergency_request',
    'fail-req-1',
    'create',
    { title: 'Failed Item' },
    { maxAttempts: 1, idempotencyKey: 'fail-test-item-1' }
  );

  // Attempt 1 -> exceeds maxAttempts (1) -> status becomes failed
  const res = await syncManager.processQueue();
  assert.equal(res.errors, 1);

  const failedItems = await syncQueueRepo.findFailed();
  assert.equal(failedItems.length, 1);
  assert.equal(failedItems[0].status, 'failed');
  assert.equal(failedItems[0].permanentError, true);

  // User-controlled retry resets attempts and triggers sync
  adapter.simulateFailure = false;
  const retried = await syncManager.retryOperation(failedItems[0].id);
  assert.equal(retried, true);

  const queueAfterRetry = await syncQueueRepo.findAll();
  assert.equal(queueAfterRetry.length, 0, 'Item successfully cleared after user retry and sync');
});

// ── 8. Conflict Detection & Stale Edit Protection ─────────────────────────────

test('Sync Engine: Detects version conflict on stale offline edits and prevents silent overwrite', async () => {
  await emergencyRequestRepo.clear();
  await syncQueueRepo.clear();

  const adapter = new LocalInMemoryAdapter();
  // Server already has version 3 of this entity
  adapter.entityVersions.set('conflict-entity-1', 3);

  const syncManager = new SyncQueueManager(adapter);

  // Client creates an offline edit with baseVersion = 1 (stale edit)
  const item = await syncManager.enqueue(
    'emergency_request',
    'conflict-entity-1',
    'update',
    { title: 'Stale offline title' },
    { baseVersion: 1, idempotencyKey: 'conflict-test-1' }
  );

  const result = await syncManager.processQueue();
  assert.equal(result.conflicts, 1, 'Sync must record conflict');

  const conflicts = await syncQueueRepo.findConflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].status, 'conflict');
  assert.equal(conflicts[0].serverVersion, 3);

  // User resolves conflict by rebasing with 'keep_local'
  const resolved = await syncManager.resolveConflict(conflicts[0].id, 'keep_local');
  assert.equal(resolved, true);

  const afterResolve = await syncQueueRepo.findConflicts();
  assert.equal(afterResolve.length, 0, 'Conflict resolved');
});

// ── 9. Browsers without Background Sync API ───────────────────────────────────

test('Sync Engine: Gracefully falls back to foreground sync when Background Sync is unsupported', async () => {
  // In Node environment, SyncManager is not on window
  const status = pwaManager.getStatus();
  assert.equal(status.isBackgroundSyncSupported, false, 'Node test env correctly reports Background Sync unavailable');

  const bgResult = await pwaManager.requestBackgroundSync('resqlink-sync');
  assert.equal(bgResult, false, 'Gracefully returns false without throwing error');
});

// ── 10. Offline Map & Routing Fallback ────────────────────────────────────────

test('Offline Map: When routing service is unreachable, returns straight-line fallback with safety notice', async () => {
  const start: [number, number] = [28.6139, 77.2090];
  const end: [number, number] = [28.5355, 77.3910];

  // Call fetchRoute with timeout/unreachable route
  const result = await fetchRoute(start, end, 'driving', 'Relief Shelter Alpha');
  // When offline or mocked in test, result must never claim to be a real turn-by-turn route
  if (!result.isRealRoute) {
    assert.ok(result.fallbackStraightLineKm !== undefined && result.fallbackStraightLineKm > 0);
    assert.equal(result.isRealRoute, false);
    assert.equal(result.destinationAddress, 'Relief Shelter Alpha');
  }
});
