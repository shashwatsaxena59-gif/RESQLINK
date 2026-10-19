import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Shelter } from '../domain/models/shelter';
import {
  calculateAvailableBeds,
  recordBedIntake,
  updateShelterCapacity,
  reserveBeds,
  releaseReservedBeds,
  updateShelterOperatingStatus,
  updateShelterInventory,
  addIncomingDelivery,
  receiveIncomingDelivery,
  reportResourceShortage,
  resolveResourceShortage,
  detectShelterShortages,
  ShelterDomainError,
} from '../domain/services/shelter-service';
import {
  canUpdateShelter,
  canAllocateResources,
  type AuthUser,
} from '../auth/permissions';
import { validateShelterCapacity } from '../domain/validation/validators';

// ── 1. Shelter Capacity Calculations & Strict Rules ──────────────────────────

test('Capacity Math: 100 capacity, 72 occupied, 3 reserved produces exactly 25 available beds', () => {
  const shelter: Shelter = {
    id: 'sh-redfort',
    name: 'Ramleela Ground Shelter',
    address: 'Chandni Chowk, Old Delhi',
    latitude: 28.652,
    longitude: 77.234,
    totalCapacity: 100,
    occupiedBeds: 72,
    reservedBeds: 3,
    inventory: {},
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  const available = calculateAvailableBeds(shelter);
  assert.equal(available, 25, '100 - (72 + 3) must equal 25 available beds');
});

test('Capacity Math: Prevents overbooking beyond total capacity', () => {
  const shelter: Shelter = {
    id: 'sh-test',
    name: 'Community Center',
    address: 'Civil Lines',
    latitude: 28.67,
    longitude: 77.22,
    totalCapacity: 50,
    occupiedBeds: 35,
    reservedBeds: 10, // 45 committed, 5 free
    inventory: {},
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  // Attempting to reserve 6 beds (total 51) must throw ShelterDomainError
  assert.throws(
    () => reserveBeds(shelter, 6),
    /exceeds total capacity/,
    'Reserving beyond totalCapacity must be rejected'
  );

  // Attempting to record intake of 42 occupied (42 + 10 = 52) must throw
  assert.throws(
    () => recordBedIntake(shelter, 42),
    /exceeds total capacity/,
    'Intake exceeding capacity must be rejected'
  );
});

test('Capacity Math: Prevents negative values for capacity, occupied, or reserved beds', () => {
  const shelter: Shelter = {
    id: 'sh-test-neg',
    name: 'Test Shelter',
    address: 'Model Town',
    latitude: 28.7,
    longitude: 77.19,
    totalCapacity: 40,
    occupiedBeds: 20,
    reservedBeds: 5,
    inventory: {},
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  // Negative capacity reduction
  assert.throws(() => updateShelterCapacity(shelter, -10), /non-negative/);

  // Negative intake
  assert.throws(() => recordBedIntake(shelter, -5), /non-negative/);

  // Negative bed reservation
  assert.throws(() => reserveBeds(shelter, -2), /greater than zero/);

  // Negative release
  assert.throws(() => releaseReservedBeds(shelter, 0), /greater than zero/);
});

test('Capacity Reduction: Prevents reducing total capacity below current committed (occupied + reserved)', () => {
  const shelter: Shelter = {
    id: 'sh-capacity-reduction',
    name: 'Stadium Shelter',
    address: 'Patparganj',
    latitude: 28.61,
    longitude: 77.30,
    totalCapacity: 100,
    occupiedBeds: 60,
    reservedBeds: 15, // 75 committed
    inventory: {},
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  // Reducing to 70 beds when 75 are committed MUST be rejected
  assert.throws(
    () => updateShelterCapacity(shelter, 70),
    /exceeds proposed capacity/,
    'Capacity reduction below occupied + reserved must be prevented'
  );

  // Reducing to 80 beds (above 75 committed) succeeds
  const updated = updateShelterCapacity(shelter, 80);
  assert.equal(updated.totalCapacity, 80);
  assert.equal(calculateAvailableBeds(updated), 5); // 80 - 75 = 5
});

test('Operating Status: Auto-transitions to full when available beds reach 0 and back to open when beds free up', () => {
  const shelter: Shelter = {
    id: 'sh-status-trans',
    name: 'Transit Shelter',
    address: 'Wazirabad',
    latitude: 28.71,
    longitude: 77.21,
    totalCapacity: 50,
    occupiedBeds: 40,
    reservedBeds: 0,
    inventory: {},
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  // Reserving 10 beds fills the shelter (40 + 10 = 50) -> status becomes 'full'
  const filled = reserveBeds(shelter, 10);
  assert.equal(filled.operatingStatus, 'full');
  assert.equal(calculateAvailableBeds(filled), 0);

  // Attempting to force status to 'open' while 100% full must throw
  assert.throws(
    () => updateShelterOperatingStatus(filled, 'open'),
    /Cannot set status to open when shelter is at 100% capacity/
  );

  // Releasing 5 reserved beds frees up capacity -> status returns to 'open'
  const freed = releaseReservedBeds(filled, 5);
  assert.equal(freed.operatingStatus, 'open');
  assert.equal(calculateAvailableBeds(freed), 5);
});

test('Reserved Beds: Releasing with conversion increments occupied count while preserving invariants', () => {
  const shelter: Shelter = {
    id: 'sh-conversion',
    name: 'Convoy Receiving Shelter',
    address: 'Mayur Vihar',
    latitude: 28.60,
    longitude: 77.29,
    totalCapacity: 100,
    occupiedBeds: 60,
    reservedBeds: 20, // 80 committed
    inventory: {},
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  // 15 evacuees arrived on scene and check in: convertedToOccupied = true
  const checkedIn = releaseReservedBeds(shelter, 15, true);
  assert.equal(checkedIn.occupiedBeds, 75, 'Occupied beds must increase by 15');
  assert.equal(checkedIn.reservedBeds, 5, 'Reserved beds must decrease by 15');
  assert.equal(checkedIn.totalCapacity, 100);
  assert.equal(calculateAvailableBeds(checkedIn), 20); // 100 - (75 + 5) = 20
});

// ── 2. Inventory Adjustments, Deliveries & Shortages ──────────────────────────

test('Inventory: Updates stock and rejects negative quantities', () => {
  const shelter: Shelter = {
    id: 'sh-inv',
    name: 'Stock Shelter',
    address: 'Geeta Colony',
    latitude: 28.65,
    longitude: 77.27,
    totalCapacity: 50,
    occupiedBeds: 20,
    reservedBeds: 0,
    inventory: {
      water_liters: { quantity: 500, unit: 'liters', minThreshold: 200 },
    },
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  // Valid update
  const updated = updateShelterInventory(shelter, 'water_liters', 1200, 'liters', 300);
  assert.equal(updated.inventory['water_liters'].quantity, 1200);
  assert.equal(updated.inventory['water_liters'].minThreshold, 300);

  // Negative quantity must throw
  assert.throws(
    () => updateShelterInventory(shelter, 'blankets', -10, 'units'),
    /cannot be negative/
  );
});

test('Incoming Deliveries: Scheduling and receiving restocks inventory automatically', () => {
  let shelter: Shelter = {
    id: 'sh-delivery',
    name: 'Relief Hub',
    address: 'Shahdara',
    latitude: 28.67,
    longitude: 77.29,
    totalCapacity: 80,
    occupiedBeds: 30,
    reservedBeds: 0,
    inventory: {
      blankets: { quantity: 40, unit: 'units', minThreshold: 50 },
    },
    incomingDeliveries: [],
    resourceShortages: ['blankets'], // Currently low
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  // Schedule a shipment of 60 blankets
  shelter = addIncomingDelivery(shelter, {
    item: 'blankets',
    quantity: 60,
    unit: 'units',
    source: 'State Disaster Storage',
    expectedAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'scheduled',
  });

  assert.equal(shelter.incomingDeliveries?.length, 1);
  const deliveryId = shelter.incomingDeliveries![0].id;
  assert.equal(shelter.incomingDeliveries![0].status, 'scheduled');

  // Receive the delivery
  shelter = receiveIncomingDelivery(shelter, deliveryId);

  // Quantity should be 40 + 60 = 100 units
  assert.equal(shelter.inventory['blankets'].quantity, 100);
  assert.equal(shelter.incomingDeliveries![0].status, 'delivered');

  // Shortage should be resolved since 100 > minThreshold (50)
  assert.ok(!shelter.resourceShortages?.includes('blankets'), 'Shortage should auto-resolve');
});

test('Resource Shortages: Explicit reporting and resolution', () => {
  let shelter: Shelter = {
    id: 'sh-shortages',
    name: 'Medical Aid Shelter',
    address: 'Ansari Nagar',
    latitude: 28.56,
    longitude: 77.21,
    totalCapacity: 60,
    occupiedBeds: 10,
    reservedBeds: 0,
    inventory: {},
    resourceShortages: [],
    operatingStatus: 'open',
    lastUpdatedAt: new Date().toISOString(),
  };

  shelter = reportResourceShortage(shelter, 'oxygen_cylinders');
  assert.deepEqual(shelter.resourceShortages, ['oxygen_cylinders']);

  shelter = reportResourceShortage(shelter, 'infant_formula');
  assert.equal(shelter.resourceShortages?.length, 2);

  shelter = resolveResourceShortage(shelter, 'oxygen_cylinders');
  assert.deepEqual(shelter.resourceShortages, ['infant_formula']);
});

// ── 3. Access Restrictions & Authorization ────────────────────────────────────

test('Authorization: Coordinator and shelter_officer allowed; citizen and volunteer restricted', () => {
  const coordinator: AuthUser = {
    id: 'usr-coord',
    displayName: 'Chief Coordinator',
    role: 'coordinator',
  };

  const shelterOfficer: AuthUser = {
    id: 'usr-officer',
    displayName: 'Facility Manager',
    role: 'shelter_officer',
  };

  const volunteer: AuthUser = {
    id: 'usr-vol',
    displayName: 'ResQ Volunteer',
    role: 'volunteer',
  };

  const citizen: AuthUser = {
    id: 'usr-citizen',
    displayName: 'Local Citizen',
    role: 'citizen',
  };

  // Coordinator can update shelter & allocate resources
  assert.equal(canUpdateShelter(coordinator, 'sh-1'), true);
  assert.equal(canAllocateResources(coordinator), true);

  // Shelter Officer can update shelter & allocate resources
  assert.equal(canUpdateShelter(shelterOfficer, 'sh-1'), true);
  assert.equal(canAllocateResources(shelterOfficer), true);

  // Volunteer cannot update shelter or allocate resources
  assert.equal(canUpdateShelter(volunteer, 'sh-1'), false);
  assert.equal(canAllocateResources(volunteer), false);

  // Citizen cannot update shelter
  assert.equal(canUpdateShelter(citizen, 'sh-1'), false);
  assert.equal(canAllocateResources(citizen), false);

  // Unauthenticated user is denied
  assert.equal(canUpdateShelter(null, 'sh-1'), false);
});

// ── 4. Dashboard Metrics Derivation (No Hardcoded Substitutes) ────────────────

test('Dashboard Metrics: Accurate derivation from actual state records', () => {
  const testShelters: Shelter[] = [
    {
      id: 'sh-a',
      name: 'Shelter Alpha',
      address: 'North Camp',
      latitude: 28.6,
      longitude: 77.2,
      totalCapacity: 100,
      occupiedBeds: 72,
      reservedBeds: 3, // Available = 25
      inventory: {},
      resourceShortages: ['water_liters'],
      operatingStatus: 'open',
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      id: 'sh-b',
      name: 'Shelter Beta',
      address: 'South Camp',
      latitude: 28.5,
      longitude: 77.1,
      totalCapacity: 50,
      occupiedBeds: 50,
      reservedBeds: 0, // Available = 0
      inventory: {},
      resourceShortages: [],
      operatingStatus: 'full',
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      id: 'sh-c',
      name: 'Shelter Gamma',
      address: 'East Camp',
      latitude: 28.7,
      longitude: 77.3,
      totalCapacity: 60,
      occupiedBeds: 20,
      reservedBeds: 10, // Available = 30
      inventory: {},
      resourceShortages: ['blankets', 'first_aid_kits'],
      operatingStatus: 'open',
      lastUpdatedAt: new Date().toISOString(),
    },
  ];

  // Total free beds calculation: 25 + 0 + 30 = 55
  const totalFreeBeds = testShelters.reduce(
    (acc, s) => acc + calculateAvailableBeds(s),
    0
  );
  assert.equal(totalFreeBeds, 55, 'Total free beds must equal 55');

  // Declared shortages calculation: 1 + 0 + 2 = 3
  const totalShortages = testShelters.reduce(
    (acc, s) => acc + (s.resourceShortages?.length || 0),
    0
  );
  assert.equal(totalShortages, 3, 'Total declared shortages must equal 3');
});
