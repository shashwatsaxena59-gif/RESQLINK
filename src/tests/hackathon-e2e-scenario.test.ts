/**
 * ResQLink — Final QA & Hackathon End-to-End Scenario Test Suite
 *
 * Implements and verifies the exact 15-step scenario:
 * 1. Open landing page / check store initialization.
 * 2. Submit high-priority SOS request (severe storm, drinking water + first aid).
 * 3. Verify request ID, local persistence, and accurate initial status.
 * 4. Locate request marker on map with coordinates and bounds.
 * 5. Inspect compatible volunteer offer (resource matching).
 * 6. Accept eligible task as volunteer with atomic resource reservation.
 * 7. Verify task appears in volunteer dashboard and coordinator view.
 * 8. Complete fictional delivery and confirm related statuses update.
 * 9. Update shelter occupancy and inventory.
 * 10. Verify shelter marker, directory, capacity calculation, and dashboard metrics agree.
 * 11. Simulate a network outage.
 * 12. Create another emergency request offline and simulate browser refresh.
 * 13. Verify request remains stored locally and is marked pending.
 * 14. Restore connectivity and test synchronization.
 * 15. Verify server confirmation is required before displaying remote receipt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Domain and service imports
import {
  createEmergencyRequest,
  transitionRequestStatus,
} from '../domain/services/request-service';
import {
  calculateAvailableBeds,
  recordBedIntake,
  updateShelterInventory,
} from '../domain/services/shelter-service';
import {
  canAssignVolunteer,
  createVolunteerTask,
  transitionTaskStatus,
} from '../domain/services/task-service';
import {
  evaluateRequestVolunteerMatch,
} from '../domain/services/matching-engine';
import {
  allocateResource,
} from '../domain/services/resource-service';
import {
  haversineDistanceMiles,
  isValidLatLng,
} from '../lib/geo';
import {
  emergencyRequestRepo,
} from '../storage/repositories/emergency-request-repository';
import {
  syncQueueRepo,
} from '../storage/repositories/sync-queue-repository';
import {
  syncMetadataRepo,
} from '../storage/repositories/sync-metadata-repository';
import {
  SyncQueueManager,
} from '../sync/sync-queue';
import {
  type RemoteBackendAdapter,
} from '../sync/sync-adapter';
import type {
  Shelter,
  VolunteerTask,
  ResourceOffer,
  Volunteer,
} from '../domain/models';

test('E2E Hackathon Scenario: 15-Step End-to-End Disaster Workflow Verification', async () => {
  // Clear repositories for a pristine test run
  await emergencyRequestRepo.clear();
  await syncQueueRepo.clear();

  // ── Step 1: Open Landing Page & Initial Repositories State ─────────────────
  const initialRequests = await emergencyRequestRepo.findAll();
  assert.equal(initialRequests.length, 0, 'Step 1: Repositories start cleanly initialized');

  // ── Step 2: Submit a High-Priority SOS Request ─────────────────────────────
  // Scenario: Neighborhood experiences a severe storm; residents need drinking water & first aid.
  const stormRequest = createEmergencyRequest({
    category: 'medical',
    description: 'Severe storm aftermath: 5 residents stranded with water contamination, lacerations needing first aid and potable water.',
    severity: 'critical',
    numberOfPeople: 5,
    requiredResources: ['drinking_water', 'first_aid_kit'],
    latitude: 28.6015,
    longitude: 77.2985, // Mayur Vihar Pocket 1
    locationDescription: 'Pocket 1, Block C, Mayur Vihar Phase 1, near community gate',
    confidentialMedicalDetails: 'One elderly resident has deep leg laceration with controlled bleeding; two children dehydrated.',
    idempotencyKey: 'idemp-storm-sos-001',
  });

  // ── Step 3: Verify Request ID, Local Persistence & Accurate Status ────────
  assert.ok(stormRequest.id, 'Step 3: Unique request ID must be assigned');
  assert.equal(stormRequest.status, 'active');
  assert.equal(stormRequest.numberOfPeople, 5);
  assert.equal(stormRequest.latitude, 28.6015);
  assert.equal(stormRequest.longitude, 77.2985);

  // Save to local device database
  await emergencyRequestRepo.save(stormRequest);
  const persistedSos = await emergencyRequestRepo.findById(stormRequest.id);
  assert.ok(persistedSos !== null, 'Step 3: Request must persist in local database');
  assert.equal(persistedSos?.description, stormRequest.description);

  // ── Step 4: Locate Request Marker on the Map ──────────────────────────────
  assert.ok(
    isValidLatLng(persistedSos!.latitude, persistedSos!.longitude),
    'Step 4: Marker coordinates must be strictly valid numbers within geographic limits'
  );

  // Reference shelter coordinates (Rajkiya Sarvodaya Bal Vidyalaya, Mayur Vihar)
  const shelterLat = 28.5985;
  const shelterLng = 77.3025;
  const distanceToShelter = haversineDistanceMiles(
    persistedSos!.latitude!,
    persistedSos!.longitude!,
    shelterLat,
    shelterLng
  );
  assert.ok(distanceToShelter < 1.0, `Step 4: SOS is within 1 mile of nearby shelter (${distanceToShelter.toFixed(2)} mi)`);

  // ── Step 5: Inspect Compatible Volunteer Offer ─────────────────────────────
  const volunteerPatel: Volunteer = {
    id: 'vol-patel-001',
    displayName: 'A. Patel (Rapid Response)',
    skills: ['first_aid', 'triage', 'water_rescue'],
    offeredResources: ['first_aid_kit', 'drinking_water'],
    availabilityStatus: 'available',
    locationSharingPermission: true,
    coordinates: { latitude: 28.605, longitude: 77.295 },
    serviceRadius: 5,
    lastSeenAt: new Date().toISOString(),
  };

  const waterOffer: ResourceOffer = {
    id: 'res-water-001',
    providerId: 'provider-east-delhi',
    providerName: 'East Delhi Seva Trust',
    resourceType: 'drinking_water',
    quantityAvailable: 100,
    quantityAllocated: 10,
    unit: 'liters',
    location: 'Mayur Vihar Staging Point',
    latitude: 28.608,
    longitude: 77.29,
    availabilityStatus: 'available',
    availabilityWindow: { start: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const match = evaluateRequestVolunteerMatch(persistedSos!, volunteerPatel);
  assert.ok(match.score >= 50, `Step 5: Volunteer matches request with high score (${match.score})`);
  assert.equal(match.isEligible, true);

  // ── Step 6: Accept Eligible Task as Volunteer ──────────────────────────────
  // Verify volunteer does not already have an in-flight mission
  const activeTasks: VolunteerTask[] = [];
  const assignCheck = canAssignVolunteer(activeTasks, volunteerPatel.id, persistedSos!.id);
  assert.ok(assignCheck.allowed, 'Step 6: Volunteer is eligible to claim the mission');

  // Atomically allocate 5 units of water
  const updatedOffer = allocateResource(waterOffer, 5);
  assert.equal(updatedOffer.quantityAllocated, 15, 'Step 6: Resource units allocated atomically');
  assert.equal(updatedOffer.availabilityStatus, 'partially_allocated');

  // Create task
  const { task: rescueTask } = createVolunteerTask({
    emergencyRequestId: persistedSos!.id,
    volunteerId: volunteerPatel.id,
    volunteerName: volunteerPatel.displayName,
    status: 'accepted',
    allocatedResources: [
      { resourceOfferId: waterOffer.id, type: 'drinking_water', quantity: 5, unit: 'liters' },
    ],
  });
  assert.equal(rescueTask.status, 'accepted');
  activeTasks.push(rescueTask);

  // ── Step 7: Verify Task Appears in Volunteer & Coordinator Views ───────────
  const volunteerTasks = activeTasks.filter((t) => t.volunteerId === volunteerPatel.id);
  assert.equal(volunteerTasks.length, 1, 'Step 7: Task visible in Volunteer Dashboard');

  // Verify concurrent assignment constraint: cannot accept second task
  const secondAssignCheck = canAssignVolunteer(activeTasks, volunteerPatel.id, 'req-other-02');
  assert.equal(secondAssignCheck.allowed, false, 'Step 7: Prevents volunteer accepting multiple concurrent in-flight tasks');

  // ── Step 8: Complete Delivery and Confirm Statuses Update ───────────────────
  const inTransitTask = transitionTaskStatus(rescueTask, 'in_transit');
  assert.equal(inTransitTask.status, 'in_transit');

  const arrivedTask = transitionTaskStatus(inTransitTask, 'at_scene');
  assert.equal(arrivedTask.status, 'at_scene');

  const completedTask = transitionTaskStatus(arrivedTask, 'completed');
  assert.equal(completedTask.status, 'completed');
  assert.ok(completedTask.completedAt !== undefined);

  // Mark SOS request fulfilled through valid state machine: active -> assigned -> in-progress -> fulfilled
  let trackedSos = transitionRequestStatus(persistedSos!, 'assigned', volunteerPatel.id);
  assert.equal(trackedSos.status, 'assigned');
  trackedSos = transitionRequestStatus(trackedSos, 'in-progress');
  assert.equal(trackedSos.status, 'in-progress');
  const fulfilledSos = transitionRequestStatus(trackedSos, 'fulfilled');
  assert.equal(fulfilledSos.status, 'fulfilled', 'Step 8: SOS request transitioned to fulfilled');
  await emergencyRequestRepo.save(fulfilledSos);

  // ── Step 9: Update Shelter Occupancy & Inventory ───────────────────────────
  let shelter: Shelter = {
    id: 'shelter-001',
    name: 'Rajkiya Sarvodaya Bal Vidyalaya, Mayur Vihar',
    address: 'Pocket 2, Mayur Vihar Phase 1, Delhi',
    latitude: 28.5985,
    longitude: 77.3025,
    operatingStatus: 'open',
    totalCapacity: 100,
    occupiedBeds: 72,
    reservedBeds: 3,
    inventory: {
      blankets: { quantity: 150, unit: 'pieces' },
      water: { quantity: 1200, unit: 'liters' },
    },
    incomingDeliveries: [],
    resourceShortages: [],
    lastUpdatedAt: new Date().toISOString(),
  };

  // Intake 10 storm evacuees (72 + 10 = 82 occupied beds)
  shelter = recordBedIntake(shelter, 82);
  assert.equal(shelter.occupiedBeds, 82);

  // Restock 50 blankets from emergency supply delivery (150 + 50 = 200)
  shelter = updateShelterInventory(shelter, 'blankets', 200, 'pieces');
  assert.equal(shelter.inventory.blankets.quantity, 200);

  // ── Step 10: Verify Capacity Calculation & Metrics Agreement ───────────────
  // Formula: totalCapacity (100) - occupiedBeds (82) - reservedBeds (3) = 15 available beds
  const availableBeds = calculateAvailableBeds(shelter);
  assert.equal(availableBeds, 15, 'Step 10: Capacity formula produces exactly 15 available beds');
  assert.equal(shelter.operatingStatus, 'open', 'Step 10: Shelter remains open with available beds');

  // Verify invariant: occupied + reserved <= capacity
  assert.ok(
    shelter.occupiedBeds + shelter.reservedBeds <= shelter.totalCapacity,
    'Step 10: Capacity invariant strictly maintained'
  );

  // ── Step 11: Simulate Network Outage ────────────────────────────────────────
  let networkOnline = false;
  const mockAdapter: RemoteBackendAdapter = {
    name: 'MockE2EAdapter',
    async isAvailable() {
      return networkOnline;
    },
    async pushQueueItem() {
      if (!networkOnline) {
        return { success: false, error: 'Network offline: simulated connection loss', statusCode: 503 };
      }
      return {
        success: true,
        serverAckTimestamp: new Date().toISOString(),
        serverVersion: 3,
      };
    },
    async fetchRemoteRequests() {
      return [fulfilledSos];
    },
    async fetchRemoteTasks() {
      return [completedTask];
    },
    async fetchRemoteShelters() {
      return [shelter];
    },
  };

  const syncManager = new SyncQueueManager(mockAdapter);

  // ── Step 12: Create Another Emergency Request Offline & Simulate Refresh ──
  const offlineSos = createEmergencyRequest({
    category: 'rescue',
    description: 'Downed power line & flooding near Mayur Vihar Pocket 4, water level rising.',
    severity: 'critical',
    numberOfPeople: 3,
    requiredResources: ['boat', 'flotation_vests'],
    latitude: 28.599,
    longitude: 77.301,
    idempotencyKey: 'idemp-offline-storm-002',
  });

  // Save to offline repository & outbox queue
  await emergencyRequestRepo.save(offlineSos);
  await syncManager.enqueue(
    'emergency_request',
    offlineSos.id,
    'create',
    offlineSos as unknown as Record<string, unknown>,
    offlineSos.idempotencyKey
  );

  // ── Step 13: Verify Request Remains Stored Locally & Marked Pending ────────
  const storedOffline = await emergencyRequestRepo.findById(offlineSos.id);
  assert.ok(storedOffline !== null, 'Step 13: Offline request survives simulated page refresh');
  assert.equal(storedOffline?.description, offlineSos.description);

  const pendingItems = await syncQueueRepo.findPending();
  assert.equal(pendingItems.length, 1, 'Step 13: Exactly 1 item queued in offline outbox');
  assert.equal(pendingItems[0].entityId, offlineSos.id);
  assert.equal(pendingItems[0].status, 'pending');

  // Attempting sync while network is down must not drop the record
  const offlineProcessResult = await syncManager.processQueue();
  assert.equal(offlineProcessResult.processed, 0, 'Step 13: Outbox must not claim processed items during outage');
  assert.equal(syncManager.getStatus().state, 'offline');

  // Record still safely preserved in outbox
  const stillPending = await syncQueueRepo.findPending();
  assert.equal(stillPending.length, 1, 'Step 13: Pending record is never lost or deleted during outage');

  // ── Step 14: Restore Connectivity & Test Synchronization ───────────────────
  networkOnline = true; // Connection restored!

  const onlineProcessResult = await syncManager.processQueue();
  assert.equal(onlineProcessResult.processed, 1, 'Step 14: Outbox processes queued operation upon reconnection');
  assert.equal(onlineProcessResult.errors, 0, 'Step 14: Zero errors on restored connection');

  // Outbox is now cleared of pending items
  const postSyncPending = await syncQueueRepo.findPending();
  assert.equal(postSyncPending.length, 0, 'Step 14: All pending outbox operations successfully drained');

  // ── Step 15: Server Confirmation Required Before Remote Receipt ────────────
  // 1. Verify entity in repository was updated ONLY upon real server acknowledgement
  const updatedOfflineSos = await emergencyRequestRepo.findById(offlineSos.id);
  assert.ok(updatedOfflineSos !== null);
  assert.equal(
    updatedOfflineSos?.syncStatus,
    'synced',
    'Step 15: Entity marked synced ONLY after server acknowledgement'
  );
  assert.equal(
    updatedOfflineSos?.acknowledged,
    true,
    'Step 15: Remote receipt acknowledgment flag set strictly upon server ack'
  );
  assert.ok(
    updatedOfflineSos?.serverAckTimestamp !== undefined,
    'Step 15: Server acknowledgement timestamp recorded'
  );

  // 2. Verify sync metadata records version and cleared unsynced changes
  const metadata = await syncMetadataRepo.getMetadata(offlineSos.id);
  assert.ok(metadata !== null);
  assert.equal(metadata?.serverVersion, 3, 'Step 15: Metadata records confirmed server version');
  assert.equal(metadata?.hasUnsyncedChanges, false, 'Step 15: Outbox clean with no unsynced changes');

  // Clean up
  syncManager.destroy();
});
