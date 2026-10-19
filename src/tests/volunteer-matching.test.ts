import test from 'node:test';
import assert from 'node:assert/strict';

import type { EmergencyRequest } from '../domain/models/emergency-request';
import type { Volunteer } from '../domain/models/volunteer';
import type { ResourceOffer } from '../domain/models/resource-offer';
import type { VolunteerTask } from '../domain/models/volunteer-task';

import {
  evaluateRequestVolunteerMatch,
  evaluateRequestResourceMatch,
  findRecommendedVolunteersForRequest,
  findRecommendedRequestsForVolunteer,
  findRecommendedResourcesForRequest,
  DEFAULT_MATCHING_RADIUS_MILES,
  ADVISORY_DISCLAIMER,
} from '../domain/services/matching-engine';

import {
  allocateResource,
  deallocateResource,
  fulfillAllocatedResource,
  computeOfferStatus,
  ResourceDomainError,
} from '../domain/services/resource-service';

import {
  canAssignVolunteer,
  createVolunteerTask,
  transitionTaskStatus,
} from '../domain/services/task-service';

// ── Fixture Helpers ────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<EmergencyRequest> = {}): EmergencyRequest {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    incidentId: 'inc-01',
    requesterId: 'user-01',
    category: 'water',
    description: 'Clean drinking water urgently required for 8 trapped residents.',
    severity: 'critical',
    medicalPriority: 'none',
    numberOfPeople: 8,
    requiredResources: ['drinking_water', 'water_purification'],
    latitude: 28.6139,
    longitude: 77.2090,
    locationAccuracy: 15,
    locationDescription: 'Connaught Place, Central Delhi',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    updatedAt: new Date().toISOString(),
    status: 'active',
    assignedVolunteerId: null,
    syncStatus: 'synced',
    idempotencyKey: `idem-${Math.random()}`,
    ...overrides,
  };
}

function makeVolunteer(overrides: Partial<Volunteer> = {}): Volunteer {
  return {
    id: `vol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    displayName: 'Priya Sharma',
    skills: ['water_distribution', 'first_aid', 'logistics'],
    offeredResources: ['drinking_water', 'water_bottles'],
    availabilityStatus: 'available',
    locationSharingPermission: true,
    coordinates: {
      latitude: 28.6200, // ~0.5 miles from CP
      longitude: 77.2150,
      accuracy: 10,
    },
    serviceRadius: 5,
    lastSeenAt: new Date().toISOString(),
    phone: '+91 98765 43210',
    email: 'priya.s@example.org',
    ...overrides,
  };
}

function makeOffer(overrides: Partial<ResourceOffer> = {}): ResourceOffer {
  return {
    id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    providerId: 'provider-01',
    providerName: 'Community Relief Hub',
    resourceType: 'drinking_water',
    quantityAvailable: 100,
    quantityAllocated: 0,
    unit: 'liters',
    location: 'Barakhamba Road Staging Point',
    latitude: 28.6250,
    longitude: 77.2200,
    availabilityStatus: 'available',
    availabilityWindow: {
      start: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── 1. Resource & Skill Compatibility Tests ────────────────────────────────────

test('Matching Engine: High score for strong skill & resource alignment', () => {
  const req = makeRequest({ category: 'medical', requiredResources: ['first_aid_kit', 'bandage'] });
  const vol = makeVolunteer({ skills: ['first_aid', 'paramedic', 'cpr'], offeredResources: ['first_aid_kit'] });

  const match = evaluateRequestVolunteerMatch(req, vol);

  assert.ok(match.score >= 70, `Expected score >= 70, got ${match.score}`);
  assert.equal(match.isEligible, true);
  assert.equal(match.confidence, 'high');
  assert.ok(match.advisoryDisclaimer.includes('Advisory recommendation only'));

  const skillFactor = match.factors.find((f) => f.factor === 'Skills & Resources');
  assert.ok(skillFactor && skillFactor.score > 15, 'Expected substantial skill/resource points');
});

test('Matching Engine: Lower compatibility score when skills do not align with emergency category', () => {
  const req = makeRequest({ category: 'medical', requiredResources: ['stretcher', 'trauma_kit'] });
  const vol = makeVolunteer({ skills: ['cooking'], offeredResources: ['prepared_meals'] });

  const match = evaluateRequestVolunteerMatch(req, vol);

  const skillFactor = match.factors.find((f) => f.factor === 'Skills & Resources');
  assert.equal(skillFactor?.score, 0);
  assert.ok(match.score < 60);
});

// ── 2. Severity and Medical Urgency Ranking ─────────────────────────────────────

test('Matching Engine: Critical medical emergencies rank significantly higher than low severity requests', () => {
  const vol = makeVolunteer({ skills: ['first_aid', 'paramedic'] });

  const criticalMedicalReq = makeRequest({
    category: 'medical',
    severity: 'critical',
    medicalPriority: 'immediate',
    requiredResources: ['first_aid_kit'],
  });

  const lowGeneralReq = makeRequest({
    category: 'medical',
    severity: 'low',
    medicalPriority: 'none',
    requiredResources: ['first_aid_kit'],
  });

  const matchCrit = evaluateRequestVolunteerMatch(criticalMedicalReq, vol);
  const matchLow = evaluateRequestVolunteerMatch(lowGeneralReq, vol);

  assert.ok(
    matchCrit.score > matchLow.score + 15,
    `Expected critical medical score (${matchCrit.score}) to exceed low score (${matchLow.score}) by > 15`
  );
});

// ── 3. Proximity and Distance Radius Thresholds ────────────────────────────────

test('Matching Engine: Respects default 2-mile matching radius and penalizes distant responders', () => {
  const req = makeRequest({ latitude: 28.6139, longitude: 77.2090 });

  // Responder 1: ~0.5 miles away
  const closeVol = makeVolunteer({
    id: 'vol-close',
    coordinates: { latitude: 28.6170, longitude: 77.2120 },
  });

  // Responder 2: ~15 miles away (Noida Sector 62)
  const farVol = makeVolunteer({
    id: 'vol-far',
    coordinates: { latitude: 28.6280, longitude: 77.3649 },
  });

  const matchClose = evaluateRequestVolunteerMatch(req, closeVol);
  const matchFar = evaluateRequestVolunteerMatch(req, farVol);

  assert.ok(matchClose.isWithinRadius, 'Close volunteer should be within radius');
  assert.ok(matchClose.distanceMiles !== null && matchClose.distanceMiles < 1.0);
  assert.equal(matchClose.isEligible, true);

  assert.equal(matchFar.isWithinRadius, false, 'Distant volunteer should be outside 2-mile radius');
  assert.equal(matchFar.isEligible, false, 'Distant volunteer must be flagged ineligible for default radius');
  assert.ok(matchFar.ineligibilityReason?.includes('exceeds permitted matching radius'));
});

// ── 4. Non-Geographic Fallback (Missing Location) ──────────────────────────────

test('Matching Engine: NEVER fabricates coordinates or distances when location is missing', () => {
  const reqWithNoCoords = makeRequest({
    latitude: null,
    longitude: null,
    locationDescription: 'Phone call triage - location unknown',
  });

  const vol = makeVolunteer();

  const match = evaluateRequestVolunteerMatch(reqWithNoCoords, vol);

  // Invariant validation:
  assert.equal(match.distanceMiles, null, 'Must NOT invent a distance when coords are missing');
  assert.equal(match.isGeographicMatch, false, 'Must flag isGeographicMatch as false');
  assert.equal(match.isEligible, true, 'Non-geographic requests can still be processed in general queue');
  assert.ok(
    match.factors.some((f) => f.factor === 'Proximity' && f.details.includes('Non-geographic match')),
    'Proximity factor must explicitly state non-geographic assessment'
  );
});

test('Matching Engine: Strict geographic option rejects records with missing coordinates', () => {
  const reqWithNoCoords = makeRequest({ latitude: null, longitude: null });
  const vol = makeVolunteer();

  const match = evaluateRequestVolunteerMatch(reqWithNoCoords, vol, { requireGeographicMatch: true });

  assert.equal(match.isEligible, false);
  assert.ok(match.ineligibilityReason?.includes('Strict geographic matching required'));
});

// ── 5. Resource Offer Allocation & Invariant Checks ─────────────────────────────

test('Resource Service: Enforces allocation bounds and availability status transitions', () => {
  const initialOffer = makeOffer({ quantityAvailable: 50, quantityAllocated: 0 });
  assert.equal(initialOffer.availabilityStatus, 'available');

  // Allocate 20 units
  const afterAlloc1 = allocateResource(initialOffer, 20);
  assert.equal(afterAlloc1.quantityAllocated, 20);
  assert.equal(afterAlloc1.availabilityStatus, 'partially_allocated');

  // Allocate remaining 30 units
  const afterAlloc2 = allocateResource(afterAlloc1, 30);
  assert.equal(afterAlloc2.quantityAllocated, 50);
  assert.equal(afterAlloc2.availabilityStatus, 'fully_allocated');

  // Attempt to over-allocate: must throw ResourceDomainError
  assert.throws(
    () => allocateResource(afterAlloc2, 1),
    /ResourceDomainError|exceeds available/
  );

  // Deallocate 10 units
  const afterDealloc = deallocateResource(afterAlloc2, 10);
  assert.equal(afterDealloc.quantityAllocated, 40);
  assert.equal(afterDealloc.availabilityStatus, 'partially_allocated');

  // Fulfill 40 units upon delivery
  const afterFulfill = fulfillAllocatedResource(afterDealloc, 40);
  assert.equal(afterFulfill.quantityAllocated, 0);
  assert.equal(afterFulfill.quantityAvailable, 10);
  assert.equal(afterFulfill.availabilityStatus, 'available');
});

test('Matching Engine: Evaluates ResourceOffer remaining balance and rejects depleted offers', () => {
  const req = makeRequest({ requiredResources: ['drinking_water'] });
  const availableOffer = makeOffer({ quantityAvailable: 100, quantityAllocated: 10 });
  const depletedOffer = makeOffer({ quantityAvailable: 50, quantityAllocated: 50 });

  const matchAvail = evaluateRequestResourceMatch(req, availableOffer);
  const matchDepleted = evaluateRequestResourceMatch(req, depletedOffer);

  assert.equal(matchAvail.isEligible, true);
  assert.ok(matchAvail.score > 60);

  assert.equal(matchDepleted.isEligible, false);
  assert.ok(matchDepleted.ineligibilityReason?.includes('no remaining balance available'));
});

// ── 6. Task Double-Booking and Atomic Assignment Prevention ────────────────────

test('Task Service: Prevents duplicate active tasks for the same emergency request', () => {
  const existingTask: VolunteerTask = {
    id: 'task-101',
    emergencyRequestId: 'req-target-99',
    volunteerId: 'vol-alice',
    status: 'accepted',
    allocatedResources: [],
    createdAt: new Date().toISOString(),
    acceptedAt: new Date().toISOString(),
    completedAt: null,
    deliveryNotes: null,
  };

  const check1 = canAssignVolunteer([existingTask], 'vol-bob', 'req-target-99');
  assert.equal(check1.allowed, false);
  assert.ok(check1.reason?.includes('already assigned to active task'));

  // Attempting to create duplicate task must throw
  assert.throws(() => {
    createVolunteerTask(
      {
        emergencyRequestId: 'req-target-99',
        volunteerId: 'vol-bob',
      },
      [existingTask]
    );
  }, /already assigned/);
});

test('Task Service: Prevents volunteer from accepting multiple concurrent in-flight missions', () => {
  const activeVolunteerTask: VolunteerTask = {
    id: 'task-102',
    emergencyRequestId: 'req-other-1',
    volunteerId: 'vol-charlie',
    status: 'in_transit',
    allocatedResources: [],
    createdAt: new Date().toISOString(),
    acceptedAt: new Date().toISOString(),
    completedAt: null,
    deliveryNotes: null,
  };

  const check = canAssignVolunteer([activeVolunteerTask], 'vol-charlie', 'req-new-2');
  assert.equal(check.allowed, false);
  assert.ok(check.reason?.includes('currently has an in-flight mission'));
});

// ── 7. Ranking Functions (Recommendations) ─────────────────────────────────────

test('Matching Engine: findRecommendedVolunteers ranks closest qualified available responder first', () => {
  const req = makeRequest({
    category: 'water',
    requiredResources: ['drinking_water'],
    latitude: 28.6139,
    longitude: 77.2090,
  });

  const volA = makeVolunteer({
    id: 'vol-A',
    displayName: 'Priya A (Close, Qualified)',
    skills: ['water_distribution'],
    coordinates: { latitude: 28.6150, longitude: 77.2100 }, // very close ~0.1 mi
    availabilityStatus: 'available',
  });

  const volB = makeVolunteer({
    id: 'vol-B',
    displayName: 'Rohan B (Close, Unskilled)',
    skills: ['translation'],
    coordinates: { latitude: 28.6150, longitude: 77.2100 },
    availabilityStatus: 'available',
  });

  const volC = makeVolunteer({
    id: 'vol-C',
    displayName: 'Vikram C (Qualified, Busy On Mission)',
    skills: ['water_distribution'],
    coordinates: { latitude: 28.6150, longitude: 77.2100 },
    availabilityStatus: 'on_mission',
  });

  const recommendations = findRecommendedVolunteersForRequest(req, [volB, volC, volA]);

  assert.equal(recommendations.length, 3);
  // Eligible responders come first, ranked by score
  assert.equal(recommendations[0].targetId, 'vol-A');
  assert.equal(recommendations[0].isEligible, true);
  assert.ok(recommendations[0].score > recommendations[1].score);

  // Ineligible busy volunteer is flagged and ranked lower
  const recC = recommendations.find((r) => r.targetId === 'vol-C');
  assert.equal(recC?.isEligible, false);
});

// ── 8. End-to-End Request-to-Fulfillment Workflow Simulation ───────────────────

test('E2E Lifecycle: Complete request-to-fulfillment workflow preserves all domain invariants', () => {
  // 1. Citizen registers emergency request
  const request = makeRequest({
    id: 'req-e2e-001',
    category: 'water',
    description: 'Senior citizens center cut off from drinking water',
    severity: 'critical',
    numberOfPeople: 12,
    requiredResources: ['drinking_water'],
    latitude: 28.6139,
    longitude: 77.2090,
    status: 'active',
  });

  // 2. Neighborhood depot posts resource offer
  let waterOffer = makeOffer({
    id: 'offer-e2e-001',
    resourceType: 'drinking_water',
    quantityAvailable: 200,
    quantityAllocated: 0,
    unit: 'liters',
    latitude: 28.6180,
    longitude: 77.2110,
  });

  // 3. Registered Volunteer responder
  const volunteer = makeVolunteer({
    id: 'vol-e2e-001',
    displayName: 'Karan Mehra',
    skills: ['water_distribution', 'driver', '4x4_vehicle'],
    offeredResources: ['drinking_water'],
    coordinates: { latitude: 28.6160, longitude: 77.2100 },
    availabilityStatus: 'available',
  });

  // 4. Matching Engine produces advisory recommendation
  const volunteerRec = evaluateRequestVolunteerMatch(request, volunteer);
  assert.equal(volunteerRec.isEligible, true);
  assert.ok(volunteerRec.score >= 70, `Expected score >= 70, got ${volunteerRec.score}`);
  assert.equal(volunteerRec.confidence, 'high');
  assert.equal(volunteerRec.isWithinRadius, true);

  // 5. Accept Task atomically
  const { task: createdTask } = createVolunteerTask({
    emergencyRequestId: request.id,
    volunteerId: volunteer.id,
    volunteerName: volunteer.displayName,
    status: 'accepted',
    allocatedResources: [
      {
        resourceOfferId: waterOffer.id,
        type: 'drinking_water',
        quantity: 50,
        unit: 'liters',
      },
    ],
  });

  assert.equal(createdTask.status, 'accepted');
  assert.ok(createdTask.acceptedAt !== null);

  // 6. Allocate resource inventory
  waterOffer = allocateResource(waterOffer, 50);
  assert.equal(waterOffer.quantityAllocated, 50);
  assert.equal(waterOffer.availabilityStatus, 'partially_allocated');
  assert.equal(waterOffer.quantityAvailable - waterOffer.quantityAllocated, 150);

  // 7. Transition to in_transit
  let inProgressTask = transitionTaskStatus(createdTask, 'in_transit', { etaMinutes: 12 });
  assert.equal(inProgressTask.status, 'in_transit');
  assert.equal(inProgressTask.etaMinutes, 12);

  // 8. Arrive at scene
  inProgressTask = transitionTaskStatus(inProgressTask, 'at_scene');
  assert.equal(inProgressTask.status, 'at_scene');

  // 9. Complete task with fulfillment notes
  const completedTask = transitionTaskStatus(inProgressTask, 'completed', {
    deliveryNotes: 'Delivered 50L potable water to Caretaker Verma at senior shelter. Verified safe receipt.',
  });

  assert.equal(completedTask.status, 'completed');
  assert.ok(completedTask.completedAt !== null);
  assert.equal(
    completedTask.deliveryNotes,
    'Delivered 50L potable water to Caretaker Verma at senior shelter. Verified safe receipt.'
  );

  // 10. Fulfill allocated resource from inventory
  waterOffer = fulfillAllocatedResource(waterOffer, 50);
  assert.equal(waterOffer.quantityAvailable, 150);
  assert.equal(waterOffer.quantityAllocated, 0);
  assert.equal(waterOffer.availabilityStatus, 'available');

  // 11. Verify completed task allows volunteer to accept future dispatches
  const nextCheck = canAssignVolunteer([completedTask], volunteer.id, 'req-future-999');
  assert.equal(nextCheck.allowed, true, 'Volunteer should be free for new dispatches after prior task is completed');
});
