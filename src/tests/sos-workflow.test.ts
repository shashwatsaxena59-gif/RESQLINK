/**
 * Comprehensive Emergency SOS Workflow & Offline Persistence Tests
 * Verifies online/offline submission, validation, location fallbacks,
 * failed API retries, idempotency, and lifecycle state machines.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Domain Services & Models
import {
  createEmergencyRequest,
  transitionRequestStatus,
  RequestDomainError,
} from '../domain/services/request-service';
import type { EmergencyRequest } from '../domain/models/emergency-request';
import { validateCoordinates } from '../domain/validation/validators';

// Storage Repositories
import { emergencyRequestRepo } from '../storage/repositories/emergency-request-repository';
import { syncQueueRepo } from '../storage/repositories/sync-queue-repository';

// Sync System
import { SyncQueueManager } from '../sync/sync-queue';
import { LocalInMemoryAdapter, type RemoteBackendAdapter, type SyncPushResult } from '../sync/sync-adapter';
import type { SyncQueueItem } from '../domain/models/sync-metadata';

// ── 1. Invalid Form Validation Tests ────────────────────────────────────────

test('SOS Validation: rejects empty description or invalid people count', () => {
  // Empty description throws
  assert.throws(() => {
    createEmergencyRequest({
      category: 'medical',
      description: '   ',
      severity: 'critical',
      numberOfPeople: 1,
      requiredResources: ['insulin'],
      idempotencyKey: 'inv-1',
    });
  }, /description must not be empty/i);

  // Negative / zero people count throws
  assert.throws(() => {
    createEmergencyRequest({
      category: 'medical',
      description: 'Trapped in flooding basement',
      severity: 'critical',
      numberOfPeople: 0,
      requiredResources: ['boat'],
      idempotencyKey: 'inv-2',
    });
  }, /number of people must be at least 1/i);
});

// ── 2. Denied Location Permission & Manual Fallback ─────────────────────────

test('SOS Location: GPS denied/missing with manual location description is valid', () => {
  // When browser GPS is denied (null, null)
  const coordCheck = validateCoordinates(null, null);
  assert.equal(coordCheck.valid, true);
  assert.equal(coordCheck.isMissing, true);

  const request = createEmergencyRequest({
    category: 'rescue',
    description: 'Elderly resident trapped on roof due to rising water.',
    severity: 'critical',
    numberOfPeople: 2,
    requiredResources: ['inflatable_boat'],
    latitude: null,
    longitude: null,
    locationAccuracy: null,
    locationDescription: 'Tower 4, Flat 302, Sector 15 Community Center, Delhi NCR',
    idempotencyKey: 'manual-loc-test-1',
  });

  assert.equal(request.latitude, null);
  assert.equal(request.longitude, null);
  assert.equal(request.locationDescription, 'Tower 4, Flat 302, Sector 15 Community Center, Delhi NCR');
  // Coordinates are never fabricated to (0, 0)
  assert.notEqual(request.latitude, 0);
  assert.notEqual(request.longitude, 0);
});

test('SOS Location: detected GPS with accuracy is recorded properly', () => {
  const request = createEmergencyRequest({
    category: 'medical',
    description: 'Severe injury requiring immediate ambulance.',
    severity: 'critical',
    numberOfPeople: 1,
    requiredResources: ['stretcher'],
    latitude: 28.6139,
    longitude: 77.2090,
    locationAccuracy: 12, // ±12 meters
    locationDescription: 'Connaught Place Outer Circle',
    idempotencyKey: 'gps-acc-test-1',
  });

  assert.equal(request.latitude, 28.6139);
  assert.equal(request.longitude, 77.2090);
  assert.equal(request.locationAccuracy, 12);
});

// ── 3. Online Submission Flow ───────────────────────────────────────────────

test('SOS Workflow: online submission saves locally first, then marks synced on server ack', async () => {
  await emergencyRequestRepo.clear();
  await syncQueueRepo.clear();

  const adapter = new LocalInMemoryAdapter();
  adapter.simulatedLatencyMs = 0;
  const syncManager = new SyncQueueManager(adapter);

  const request = createEmergencyRequest({
    category: 'food',
    description: 'Clean drinking water urgently needed for 20 displaced residents.',
    severity: 'urgent',
    numberOfPeople: 20,
    requiredResources: ['drinking_water', 'water_purification_tablets'],
    latitude: 28.58,
    longitude: 77.31,
    locationDescription: 'Sector 16 Relief Camp',
    idempotencyKey: 'online-flow-1',
  });

  // Step 1: Save to local IndexedDB repository (synchronous local guarantee)
  await emergencyRequestRepo.save(request);
  const initialLocal = await emergencyRequestRepo.findById(request.id);
  assert.ok(initialLocal);
  assert.equal(initialLocal.syncStatus, 'pending');

  // Step 2: Enqueue in outbox sync queue
  await syncManager.enqueue(
    'emergency_request',
    request.id,
    'create',
    request as unknown as Record<string, unknown>,
    request.idempotencyKey
  );

  // Step 3: Flush queue with online adapter
  const { processed, errors } = await syncManager.processQueue();
  assert.equal(processed, 1);
  assert.equal(errors, 0);

  // Step 4: Verify entity is marked as 'synced' in repository
  const syncedLocal = await emergencyRequestRepo.findById(request.id);
  assert.ok(syncedLocal);
  assert.equal(syncedLocal.syncStatus, 'synced');

  // Step 5: Verify remote backend adapter received the request
  const remoteReqs = await adapter.fetchRemoteRequests();
  assert.equal(remoteReqs.length, 1);
  assert.equal(remoteReqs[0].id, request.id);
});

// ── 4. Offline Submission Flow & Device Preservation ────────────────────────

test('SOS Workflow: offline submission preserves request on device with pending status', async () => {
  await emergencyRequestRepo.clear();
  await syncQueueRepo.clear();

  // Create an offline mock adapter where isAvailable() returns false
  const offlineAdapter: RemoteBackendAdapter = {
    name: 'MockOfflineAdapter',
    async isAvailable() {
      return false; // Server unreachable / airplane mode
    },
    async pushQueueItem() {
      return { success: false, error: 'Network unavailable (offline)' };
    },
    async fetchRemoteRequests() {
      return [];
    },
    async fetchRemoteTasks() {
      return [];
    },
    async fetchRemoteShelters() {
      return [];
    },
  };

  const syncManager = new SyncQueueManager(offlineAdapter);

  const request = createEmergencyRequest({
    category: 'shelter',
    description: 'Family of 4 without shelter after roof damage.',
    severity: 'urgent',
    numberOfPeople: 4,
    requiredResources: ['shelter_bed', 'blankets'],
    locationDescription: 'Vill. Tapovan, Near Joshimath',
    idempotencyKey: 'offline-device-1',
  });

  // Save to device IndexedDB
  await emergencyRequestRepo.save(request);

  // Enqueue to outbox
  await syncManager.enqueue(
    'emergency_request',
    request.id,
    'create',
    request as unknown as Record<string, unknown>,
    request.idempotencyKey
  );

  // Process queue while offline
  const { processed } = await syncManager.processQueue();
  assert.equal(processed, 0); // No items sent

  // Request MUST be preserved on device
  const savedOnDevice = await emergencyRequestRepo.findById(request.id);
  assert.ok(savedOnDevice);
  assert.equal(savedOnDevice.syncStatus, 'pending');

  // Outbox MUST retain the pending operation
  const pendingOutbox = await syncQueueRepo.findPending();
  assert.equal(pendingOutbox.length, 1);
  assert.equal(pendingOutbox[0].entityId, request.id);
});

// ── 5. Refresh Persistence ──────────────────────────────────────────────────

test('SOS Workflow: record survives simulated browser refresh', async () => {
  const request = createEmergencyRequest({
    category: 'medical',
    description: 'Patient in shock, needs epinephrine.',
    severity: 'critical',
    numberOfPeople: 1,
    requiredResources: ['epinephrine', 'first_aid'],
    confidentialMedicalDetails: 'Anaphylactic reaction to wasp sting.',
    locationDescription: 'Sector 62 Park',
    idempotencyKey: 'refresh-persist-1',
  });

  await emergencyRequestRepo.save(request);

  // Simulate refresh by reading fresh from repository instance
  const reloaded = await emergencyRequestRepo.findById(request.id);
  assert.ok(reloaded);
  assert.equal(reloaded.id, request.id);
  assert.equal(reloaded.description, 'Patient in shock, needs epinephrine.');
  assert.equal(reloaded.confidentialMedicalDetails, 'Anaphylactic reaction to wasp sting.');
  assert.equal(reloaded.idempotencyKey, 'refresh-persist-1');
  assert.ok(reloaded.createdAt);
});

// ── 6. Failed API Calls & Exponential Backoff Retry ─────────────────────────

test('SOS Workflow: handles server 500 failure and retries upon reconnection', async () => {
  await emergencyRequestRepo.clear();
  await syncQueueRepo.clear();

  let shouldFail = true;

  const flakyAdapter = {
    name: 'FlakyAdapter',
    async isAvailable() {
      return true;
    },
    async pushQueueItem(item: SyncQueueItem): Promise<SyncPushResult> {
      if (shouldFail) {
        return { success: false, statusCode: 500, error: 'Internal Server Error' };
      }
      return { success: true, serverAckTimestamp: new Date().toISOString() };
    },
    async fetchRemoteRequests() {
      return [];
    },
    async fetchRemoteTasks() {
      return [];
    },
    async fetchRemoteShelters() {
      return [];
    },
  };

  const syncManager = new SyncQueueManager(flakyAdapter);

  const request = createEmergencyRequest({
    category: 'evacuation',
    description: 'Road washed away, 6 tourists trapped.',
    severity: 'critical',
    numberOfPeople: 6,
    requiredResources: ['rope_bridge', 'harness'],
    idempotencyKey: 'retry-test-1',
  });

  await emergencyRequestRepo.save(request);
  await syncManager.enqueue(
    'emergency_request',
    request.id,
    'create',
    request as unknown as Record<string, unknown>,
    request.idempotencyKey
  );

  // Attempt 1: Server errors with 500
  const attempt1 = await syncManager.processQueue();
  assert.equal(attempt1.processed, 0);
  assert.equal(attempt1.errors, 1);

  // Entity stays retained locally with failed/pending status
  const localAfterFail = await emergencyRequestRepo.findById(request.id);
  assert.ok(localAfterFail);
  assert.equal(localAfterFail.syncStatus, 'failed');

  // Verify outbox recorded the attempt
  const outboxItems = await syncQueueRepo.findAll();
  assert.equal(outboxItems[0].retryCount, 1);
  assert.equal(outboxItems[0].lastError, 'Internal Server Error');

  // Reset lastAttemptAt to simulate elapsed backoff window
  outboxItems[0].lastAttemptAt = new Date(Date.now() - 5000).toISOString();
  await syncQueueRepo.save(outboxItems[0]);

  // Attempt 2: Server recovers
  shouldFail = false;
  const attempt2 = await syncManager.processQueue();
  assert.equal(attempt2.processed, 1);
  assert.equal(attempt2.errors, 0);

  // Entity now marked synced!
  const localAfterSuccess = await emergencyRequestRepo.findById(request.id);
  assert.ok(localAfterSuccess);
  assert.equal(localAfterSuccess.syncStatus, 'synced');
});

// ── 7. Duplicate Submission Prevention (Idempotency) ────────────────────────

test('SOS Workflow: duplicate submission with same idempotencyKey returns existing record', () => {
  const existingRecords: EmergencyRequest[] = [];

  const req1 = createEmergencyRequest(
    {
      category: 'medical',
      description: 'First submission of emergency signal.',
      severity: 'urgent',
      numberOfPeople: 1,
      requiredResources: ['first_aid'],
      idempotencyKey: 'idemp-duplicate-token-999',
    },
    existingRecords
  );
  existingRecords.push(req1);

  // User double-taps button or network retries with identical idempotencyKey
  const req2 = createEmergencyRequest(
    {
      category: 'medical',
      description: 'Second accidental submission with identical token.',
      severity: 'urgent',
      numberOfPeople: 1,
      requiredResources: ['first_aid'],
      idempotencyKey: 'idemp-duplicate-token-999',
    },
    existingRecords
  );

  // Must return the exact same request without generating a duplicate!
  assert.equal(req1.id, req2.id);
  assert.equal(req1.createdAt, req2.createdAt);
  assert.equal(req2.description, 'First submission of emergency signal.');
});

// ── 8. Request Details Lifecycle State Machine ──────────────────────────────

test('Request Details: valid transitions update state; illegal transitions throw', async () => {
  const request = createEmergencyRequest({
    category: 'rescue',
    description: 'Basement flood rescue operation.',
    severity: 'critical',
    numberOfPeople: 3,
    requiredResources: ['submersible_pump', 'generator'],
    idempotencyKey: 'lifecycle-details-1',
  });

  assert.equal(request.status, 'active');

  // Transition 1: active -> assigned
  const assigned = transitionRequestStatus(request, 'assigned');
  assert.equal(assigned.status, 'assigned');

  // Transition 2: assigned -> in-progress
  const inProgress = transitionRequestStatus(assigned, 'in-progress');
  assert.equal(inProgress.status, 'in-progress');

  // Transition 3: in-progress -> fulfilled (Terminal)
  const fulfilled = transitionRequestStatus(inProgress, 'fulfilled');
  assert.equal(fulfilled.status, 'fulfilled');

  // Cannot transition out of terminal state
  assert.throws(() => {
    transitionRequestStatus(fulfilled, 'active');
  }, /Illegal request state transition/);

  // Cancellation path from active -> cancelled
  const reqToCancel = createEmergencyRequest({
    category: 'food',
    description: 'Food needed',
    severity: 'moderate',
    numberOfPeople: 1,
    requiredResources: ['food_packets'],
    idempotencyKey: 'cancel-test-1',
  });

  const cancelled = transitionRequestStatus(reqToCancel, 'cancelled');
  assert.equal(cancelled.status, 'cancelled');

  assert.throws(() => {
    transitionRequestStatus(cancelled, 'assigned');
  }, /Illegal request state transition/);
});
