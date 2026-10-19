/**
 * Comprehensive Domain Rules and Architectural Invariant Tests
 * Executes using Node native test runner (node:test) with tsx.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Validators
import {
  validateCoordinates,
  validateSeverity,
  validateShelterCapacity,
  validateResourceAllocation,
  isValidRequestTransition,
  isValidTaskTransition,
} from '../domain/validation/validators';

// Services
import {
  createEmergencyRequest,
  transitionRequestStatus,
} from '../domain/services/request-service';
import {
  reserveBeds,
  recordBedIntake,
  releaseReservedBeds,
  updateShelterInventory,
} from '../domain/services/shelter-service';
import {
  allocateResource,
  deallocateResource,
  fulfillAllocatedResource,
} from '../domain/services/resource-service';
import {
  canAssignVolunteer,
  createVolunteerTask,
  transitionTaskStatus,
} from '../domain/services/task-service';
import {
  canAccessMedicalData as privacyCanAccessMedical,
  sanitizeRequestForActor,
  obfuscateCoordinates,
} from '../domain/services/privacy-service';

// Repositories
import { emergencyRequestRepo } from '../storage/repositories/emergency-request-repository';
import { shelterRepo } from '../storage/repositories/shelter-repository';
import { volunteerRepo } from '../storage/repositories/volunteer-repository';

// Sync
import { SyncQueueManager } from '../sync/sync-queue';
import { LocalInMemoryAdapter } from '../sync/sync-adapter';

// Permissions
import {
  canAccessMedicalData,
  canAssignVolunteerTask,
  canUpdateShelter,
  canCancelEmergencyRequest,
} from '../auth/permissions';

// ── 1. Coordinate Validation Tests ──────────────────────────────────────────

test('Coordinates: missing GPS data is valid and explicitly flagged as missing', () => {
  const result = validateCoordinates(null, null);
  assert.equal(result.valid, true);
  assert.equal(result.isMissing, true);

  const undefResult = validateCoordinates(undefined, undefined);
  assert.equal(undefResult.valid, true);
  assert.equal(undefResult.isMissing, true);
});

test('Coordinates: valid latitude and longitude pass verification', () => {
  const result = validateCoordinates(28.6139, 77.2090); // New Delhi
  assert.equal(result.valid, true);
  assert.equal(result.isMissing, false);
});

test('Coordinates: partial coordinates or out-of-bounds coordinates fail', () => {
  const partial = validateCoordinates(28.6139, null);
  assert.equal(partial.valid, false);

  const outOfLat = validateCoordinates(95.0, 77.2090);
  assert.equal(outOfLat.valid, false);

  const outOfLng = validateCoordinates(28.6139, 195.0);
  assert.equal(outOfLng.valid, false);
});

// ── 2. Shelter Capacity Invariant Tests ─────────────────────────────────────

test('Shelter Invariant: occupiedBeds + reservedBeds <= totalCapacity', () => {
  // Exactly at capacity
  const atCapacity = validateShelterCapacity(100, 80, 20);
  assert.equal(atCapacity.valid, true);

  // Exceeds capacity by 1 bed
  const overCapacity = validateShelterCapacity(100, 80, 21);
  assert.equal(overCapacity.valid, false);
  assert.ok(overCapacity.errors.length > 0);

  // Negative numbers rejected
  const negativeBeds = validateShelterCapacity(100, -5, 0);
  assert.equal(negativeBeds.valid, false);
});

test('Shelter Service: reserveBeds and intake maintain capacity invariant', () => {
  const shelter = {
    id: 'sh-1',
    name: 'Sector 15 Safe Haven',
    address: 'Sector 15 Community Center',
    latitude: 28.58,
    longitude: 77.31,
    totalCapacity: 50,
    occupiedBeds: 30,
    reservedBeds: 10,
    inventory: {},
    operatingStatus: 'open' as const,
    lastUpdatedAt: new Date().toISOString(),
  };

  // Remaining available beds: 50 - 40 = 10
  // Reserving 10 beds succeeds and sets shelter to 'full'
  const reserved = reserveBeds(shelter, 10);
  assert.equal(reserved.reservedBeds, 20);
  assert.equal(reserved.operatingStatus, 'full');

  // Attempting to reserve even 1 more bed must throw
  assert.throws(() => {
    reserveBeds(reserved, 1);
  }, /exceeds total capacity/);

  // Release 5 reserved beds with convertedToOccupied = true (30 occupied + 5 = 35, 20 reserved - 5 = 15)
  const converted = releaseReservedBeds(reserved, 5, true);
  assert.equal(converted.occupiedBeds, 35);
  assert.equal(converted.reservedBeds, 15);

  // Release remaining 15 reserved beds without conversion (35 occupied, 0 reserved)
  const released = releaseReservedBeds(converted, 15, false);
  assert.equal(released.reservedBeds, 0);
  assert.equal(released.occupiedBeds, 35);
  assert.equal(released.operatingStatus, 'open');
});

// ── 3. Resource Allocation Invariant Tests ───────────────────────────────────

test('Resource Allocation: quantityAllocated <= quantityAvailable', () => {
  const valid = validateResourceAllocation(100, 60, 40);
  assert.equal(valid.valid, true);

  const overflow = validateResourceAllocation(100, 60, 41);
  assert.equal(overflow.valid, false);

  const offer = {
    id: 'ro-1',
    providerId: 'p-1',
    resourceType: 'drinking_water',
    quantityAvailable: 100,
    quantityAllocated: 50,
    unit: 'liters',
    location: 'Warehouse A',
    availabilityStatus: 'partially_allocated' as const,
    availabilityWindow: { start: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const allocated = allocateResource(offer, 50);
  assert.equal(allocated.quantityAllocated, 100);
  assert.equal(allocated.availabilityStatus, 'fully_allocated');

  assert.throws(() => {
    allocateResource(allocated, 1);
  }, /exceed available quantity/);

  const deallocated = deallocateResource(allocated, 20);
  assert.equal(deallocated.quantityAllocated, 80);
  assert.equal(deallocated.availabilityStatus, 'partially_allocated');
});

// ── 4. Emergency Request Lifecycle & Service Tests ──────────────────────────

test('Request Lifecycle: legal state transitions pass, terminal states prevent transitions', () => {
  assert.equal(isValidRequestTransition('active', 'assigned'), true);
  assert.equal(isValidRequestTransition('assigned', 'in-progress'), true);
  assert.equal(isValidRequestTransition('in-progress', 'fulfilled'), true);

  // Terminal state: fulfilled cannot transition back to active
  assert.equal(isValidRequestTransition('fulfilled', 'active'), false);
  assert.equal(isValidRequestTransition('cancelled', 'assigned'), false);
});

test('Request Service: createEmergencyRequest produces ISO timestamps and respects idempotency', () => {
  const request = createEmergencyRequest({
    category: 'rescue',
    description: 'Elderly couple trapped on first floor.',
    severity: 'critical',
    numberOfPeople: 2,
    requiredResources: ['boat', 'life_jackets'],
    latitude: 28.61,
    longitude: 77.21,
    idempotencyKey: 'idemp-test-key-1',
  });

  assert.ok(request.id);
  assert.equal(request.idempotencyKey, 'idemp-test-key-1');
  assert.equal(request.status, 'active');
  assert.ok(request.createdAt.includes('T')); // ISO 8601 UTC
  assert.equal(request.syncStatus, 'pending');

  const assigned = transitionRequestStatus(request, 'assigned');
  assert.equal(assigned.status, 'assigned');

  const inProgress = transitionRequestStatus(assigned, 'in-progress');
  assert.equal(inProgress.status, 'in-progress');

  const fulfilled = transitionRequestStatus(inProgress, 'fulfilled');
  assert.equal(fulfilled.status, 'fulfilled');

  assert.throws(() => {
    transitionRequestStatus(fulfilled, 'active');
  }, /Illegal status transition|Illegal request state transition/);
});

// ── 5. Volunteer Task Assignment & Prevention of Duplicate Missions ─────────

test('Task Service: prevents assigning volunteer to multiple concurrent tasks', () => {
  const existingTasks = [
    {
      id: 'task-1',
      emergencyRequestId: 'req-1',
      volunteerId: 'vol-1',
      allocatedResources: [],
      status: 'in_transit' as const,
      createdAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      completedAt: null,
      deliveryNotes: null,
    },
  ];

  // Request 1 is already assigned to task 1
  const check1 = canAssignVolunteer(existingTasks, 'vol-2', 'req-1');
  assert.equal(check1.allowed, false);
  assert.ok(check1.reason?.includes('already assigned'));

  // Volunteer 1 is already in transit on task 1
  const check2 = canAssignVolunteer(existingTasks, 'vol-1', 'req-2');
  assert.equal(check2.allowed, false);
  assert.ok(check2.reason?.includes('in-flight mission'));

  // New volunteer on new request is allowed
  const check3 = canAssignVolunteer(existingTasks, 'vol-3', 'req-2');
  assert.equal(check3.allowed, true);
});

test('Task Lifecycle: task creation and valid state transitions', () => {
  const { task } = createVolunteerTask({
    emergencyRequestId: 'req-10',
    volunteerId: 'vol-10',
    volunteerName: 'Aarav Sharma',
  });

  assert.equal(task.status, 'proposed');
  assert.equal(task.acceptedAt, null);

  const accepted = transitionTaskStatus(task, 'accepted');
  assert.equal(accepted.status, 'accepted');
  assert.ok(accepted.acceptedAt);

  const inTransit = transitionTaskStatus(accepted, 'in_transit');
  assert.equal(inTransit.status, 'in_transit');

  const atScene = transitionTaskStatus(inTransit, 'at_scene');
  assert.equal(atScene.status, 'at_scene');

  const completed = transitionTaskStatus(atScene, 'completed', {
    deliveryNotes: 'Delivered food parcels and verified safe shelter.',
  });
  assert.equal(completed.status, 'completed');
  assert.ok(completed.completedAt);
  assert.equal(completed.deliveryNotes, 'Delivered food parcels and verified safe shelter.');
});

// ── 6. Privacy and Confidential Medical Data Isolation ──────────────────────

test('Privacy Service: confidential medical info is restricted to authorized roles', () => {
  const req = { requesterId: 'user-1', assignedVolunteerId: 'vol-assigned' };

  // Coordinator has full access
  assert.equal(privacyCanAccessMedical({ actorId: 'coord-1', role: 'coordinator' }, req), true);

  // Requester has access to their own request
  assert.equal(privacyCanAccessMedical({ actorId: 'user-1', role: 'citizen' }, req), true);

  // Assigned volunteer has access
  assert.equal(privacyCanAccessMedical({ actorId: 'vol-assigned', role: 'volunteer' }, req), true);

  // Unassigned volunteer is BLOCKED
  assert.equal(privacyCanAccessMedical({ actorId: 'vol-other', role: 'volunteer' }, req), false);

  // Public/guest is BLOCKED
  assert.equal(privacyCanAccessMedical({ actorId: 'stranger', role: 'citizen' }, req), false);
});

test('Privacy Service: sanitizes medical condition and obfuscates coordinates', () => {
  const sensitiveRequest = {
    id: 'req-secret',
    incidentId: 'inc-1',
    requesterId: 'user-1',
    category: 'medical' as const,
    description: 'Requires insulin refrigeration kit.',
    severity: 'urgent' as const,
    medicalPriority: 'immediate' as const,
    confidentialMedicalDetails: 'Type 1 Diabetic with coronary artery disease and pacemaker.',
    numberOfPeople: 1,
    requiredResources: ['insulin', 'ice_pack'],
    latitude: 28.613912,
    longitude: 77.209043,
    locationAccuracy: 10,
    locationDescription: 'Apartment 4B, Tower 9',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active' as const,
    assignedVolunteerId: 'vol-assigned',
    syncStatus: 'pending' as const,
    idempotencyKey: 'idemp-sec-1',
  };

  // Sanitized view for unassigned volunteer or public
  const sanitized = sanitizeRequestForActor(sensitiveRequest, {
    actorId: 'vol-other',
    role: 'volunteer',
  });
  assert.equal(sanitized.confidentialMedicalDetails, undefined);
  assert.equal(sanitized.description, 'Requires insulin refrigeration kit.');

  // Authorized view for assigned volunteer
  const authorized = sanitizeRequestForActor(sensitiveRequest, {
    actorId: 'vol-assigned',
    role: 'volunteer',
  });
  assert.equal(
    authorized.confidentialMedicalDetails,
    'Type 1 Diabetic with coronary artery disease and pacemaker.'
  );

  // Obfuscated coordinates for public broadcasts (3 decimal places)
  const obf = obfuscateCoordinates(28.613912, 77.209043);
  assert.equal(obf.latitude, 28.614);
  assert.equal(obf.longitude, 77.209);
});

// ── 7. Role-Based Permissions Tests ──────────────────────────────────────────

test('Auth Permissions: verifies role permissions accurately', () => {
  const coordinatorUser = { id: 'u-1', displayName: 'Ops Lead', role: 'coordinator' as const };
  const volunteerUser = { id: 'v-1', displayName: 'Ravi', role: 'volunteer' as const };
  const shelterOfficer = {
    id: 's-1',
    displayName: 'Officer Maya',
    role: 'shelter_manager' as const,
    assignedShelterId: 'sh-100',
  };

  // Medical access
  assert.equal(canAccessMedicalData(coordinatorUser), true);
  assert.equal(canAccessMedicalData(volunteerUser, 'v-1'), true);
  assert.equal(canAccessMedicalData(volunteerUser, 'other-vol'), false);

  // Volunteer assignment
  assert.equal(canAssignVolunteerTask(coordinatorUser), true);
  assert.equal(canAssignVolunteerTask(volunteerUser), false);

  // Shelter updates
  assert.equal(canUpdateShelter(shelterOfficer, 'sh-100'), true);
  assert.equal(canUpdateShelter(shelterOfficer, 'sh-200'), false);
  assert.equal(canUpdateShelter(coordinatorUser, 'sh-200'), true);

  // Cancellation
  assert.equal(canCancelEmergencyRequest(coordinatorUser), true);
  const requester = { id: 'req-user', displayName: 'Anita', role: 'requester' as const };
  assert.equal(canCancelEmergencyRequest(requester, 'req-user'), true);
  assert.equal(canCancelEmergencyRequest(requester, 'someone-else'), false);
});

// ── 8. Repositories and Offline Sync Queue Tests ─────────────────────────────

test('Repositories: save, query, and filter in-memory store', async () => {
  await emergencyRequestRepo.clear();

  const request = createEmergencyRequest({
    category: 'food',
    description: 'Baby formula needed.',
    severity: 'urgent',
    numberOfPeople: 3,
    requiredResources: ['baby_formula', 'purified_water'],
    idempotencyKey: 'repo-test-1',
  });

  await emergencyRequestRepo.save(request);

  const retrieved = await emergencyRequestRepo.findById(request.id);
  assert.ok(retrieved);
  assert.equal(retrieved.description, 'Baby formula needed.');

  const byIdemp = await emergencyRequestRepo.findByIdempotencyKey('repo-test-1');
  assert.ok(byIdemp);
  assert.equal(byIdemp.id, request.id);

  const unsynced = await emergencyRequestRepo.findUnsynced();
  assert.equal(unsynced.length, 1);
});

test('Sync Queue: outbox processes and updates sync status using adapter', async () => {
  const adapter = new LocalInMemoryAdapter();
  adapter.simulatedLatencyMs = 0;
  const queue = new SyncQueueManager(adapter);

  const item = await queue.enqueue(
    'emergency_request',
    'test-req-sync-1',
    'create',
    { id: 'test-req-sync-1', title: 'Flash flood alert', status: 'active' }
  );

  assert.equal(item.status, 'pending');

  const { processed, errors } = await queue.processQueue();
  assert.equal(processed, 1);
  assert.equal(errors, 0);

  const remoteReqs = await adapter.fetchRemoteRequests();
  assert.equal(remoteReqs.length, 1);
  assert.equal(remoteReqs[0].id, 'test-req-sync-1');
});
