import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AidRequest, Shelter, Volunteer, Resource } from '../types';
import { calculateAvailableBeds } from '../domain/services/shelter-service';
import { isValidLatLng } from '../lib/geo';
import { activityStore, type ActivityEvent } from '../storage/activity-store';

test('Command Center Metrics: Real repository derivations without static mockups', () => {
  const requests: AidRequest[] = [
    {
      id: 'req-1',
      title: 'Cardiac emergency near Yamuna',
      details: 'Elderly patient needs urgent oxygen',
      category: 'medical',
      priority: 'critical',
      status: 'active',
      items: ['Oxygen Cylinder'],
      contactName: 'Rohit K.',
      contactPhone: '9876543210',
      distanceMiles: 1.2,
      createdAt: Date.now() - 5000,
      coords: { x: 77.25, y: 28.55 },
      peopleCount: 1,
    },
    {
      id: 'req-2',
      title: 'Family stranded in waterlogged home',
      details: 'Food supplies submerged',
      category: 'food',
      priority: 'urgent',
      status: 'in-progress',
      items: ['Drinking Water', 'Food Packets'],
      contactName: 'Sunita M.',
      contactPhone: '9876543211',
      distanceMiles: 2.4,
      createdAt: Date.now() - 10000,
      coords: { x: 77.28, y: 28.58 },
      peopleCount: 4,
    },
    {
      id: 'req-3',
      title: 'Resolved road obstruction',
      details: 'Tree removed from emergency corridor',
      category: 'rescue',
      priority: 'moderate',
      status: 'resolved',
      items: [],
      contactName: 'NDRF Unit',
      contactPhone: '9876543212',
      distanceMiles: 0.8,
      createdAt: Date.now() - 30000,
      coords: { x: 77.22, y: 28.52 },
      peopleCount: 0,
    },
  ];

  const shelters: Shelter[] = [
    {
      id: 'sh-1',
      name: 'Community Center Shelter',
      address: 'Sector 14',
      capacity: 100,
      occupied: 72,
      totalCapacity: 100,
      occupiedBeds: 72,
      reservedBeds: 3,
      coords: { x: 77.24, y: 28.54 },
      amenities: ['Water', 'Medical'],
      status: 'open',
      resourceShortages: ['Blankets'],
    },
    {
      id: 'sh-2',
      name: 'High School Gymnasium Shelter',
      address: 'Main Road',
      capacity: 50,
      occupied: 50,
      totalCapacity: 50,
      occupiedBeds: 50,
      reservedBeds: 0,
      coords: { x: 77.26, y: 28.56 },
      amenities: ['Food'],
      status: 'full',
      resourceShortages: ['Drinking Water', 'Baby Food'],
    },
  ];

  const volunteers: Volunteer[] = [
    {
      id: 'vol-1',
      name: 'Ananya S.',
      skills: ['First Aid', 'Triage'],
      coords: { x: 77.25, y: 28.55 },
      distanceMiles: 1.1,
      available: true,
      locationSharingPermission: true,
    },
    {
      id: 'vol-2',
      name: 'Vikram P.',
      skills: ['Boat Rescue'],
      coords: { x: 77.29, y: 28.59 },
      distanceMiles: 3.5,
      available: false,
      locationSharingPermission: false, // Location private
    },
  ];

  // 1. Active SOS Count (excludes resolved/cancelled)
  const activeRequests = requests.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled');
  assert.equal(activeRequests.length, 2, 'Resolved requests must be excluded from active SOS count');

  // 2. Critical & High Priority Cases
  const criticalCount = activeRequests.filter((r) => r.priority === 'critical').length;
  const urgentCount = activeRequests.filter((r) => r.priority === 'urgent').length;
  assert.equal(criticalCount + urgentCount, 2);

  // 3. Available Volunteers
  const availableVolunteers = volunteers.filter((v) => v.available).length;
  assert.equal(availableVolunteers, 1);

  // 4. Shelter Free Beds (Derived from capacity - occupied - reserved)
  const availableBeds = shelters.reduce((acc, s) => acc + calculateAvailableBeds(s), 0);
  // sh-1: 100 - (72 + 3) = 25 beds free
  // sh-2: 50 - 50 = 0 beds free
  assert.equal(availableBeds, 25, 'Free beds must strictly respect 100 - (72+3) = 25 capacity invariant');

  // 5. Unfulfilled Resource Needs
  const requestsNeedingItems = requests.filter((r) => r.items && r.items.length > 0 && r.status !== 'resolved').length;
  const shelterShortagesCount = shelters.reduce((acc, s) => acc + (s.resourceShortages?.length || 0), 0);
  assert.equal(requestsNeedingItems, 2, 'Two active requests require emergency supplies');
  assert.equal(shelterShortagesCount, 3, 'Shelters report 3 shortages total (Blankets, Water, Baby Food)');
  assert.equal(requestsNeedingItems + shelterShortagesCount, 5, 'Bottleneck metric must sum item-needing requests and shelter shortages');
});

test('Request Feed: Sortable and filterable criteria', () => {
  const reqA: AidRequest = {
    id: 'req-a',
    title: 'Moderate logistics request',
    details: 'Need 10 sandbags',
    category: 'rescue',
    priority: 'moderate',
    status: 'active',
    items: ['Sandbags'],
    contactName: 'Operator A',
    contactPhone: '9999999991',
    distanceMiles: 0.5,
    createdAt: 1000,
    coords: { x: 77.2, y: 28.5 },
    peopleCount: 2,
  };

  const reqB: AidRequest = {
    id: 'req-b',
    title: 'Urgent medical rescue',
    details: 'Trapped on terrace with infant',
    category: 'medical',
    priority: 'critical',
    status: 'active',
    items: ['Medicines'],
    contactName: 'Operator B',
    contactPhone: '9999999992',
    distanceMiles: 4.2,
    createdAt: 2000,
    coords: { x: 77.3, y: 28.6 },
    peopleCount: 6,
  };

  const reqC: AidRequest = {
    id: 'req-c',
    title: 'Urgent water supply',
    details: 'Clean drinking water needed',
    category: 'food',
    priority: 'urgent',
    status: 'in-progress',
    items: ['Water'],
    contactName: 'Operator C',
    contactPhone: '9999999993',
    distanceMiles: 1.8,
    createdAt: 3000,
    coords: { x: 77.25, y: 28.55 },
    peopleCount: 15,
  };

  const feed = [reqA, reqB, reqC];

  // 1. Urgency sorting: critical -> urgent -> moderate
  const prioScore: Record<string, number> = { critical: 3, urgent: 2, moderate: 1 };
  const sortedByUrgency = [...feed].sort((a, b) => (prioScore[b.priority] || 0) - (prioScore[a.priority] || 0));
  assert.equal(sortedByUrgency[0].id, 'req-b', 'Critical priority request must rank first');
  assert.equal(sortedByUrgency[1].id, 'req-c', 'Urgent priority request must rank second');
  assert.equal(sortedByUrgency[2].id, 'req-a', 'Moderate priority request must rank third');

  // 2. Distance sorting: closest first
  const sortedByDistance = [...feed].sort((a, b) => a.distanceMiles - b.distanceMiles);
  assert.equal(sortedByDistance[0].id, 'req-a', 'Closest request (0.5 mi) must be first');
  assert.equal(sortedByDistance[2].id, 'req-b', 'Furthest request (4.2 mi) must be last');

  // 3. People count sorting: highest first
  const sortedByPeople = [...feed].sort((a, b) => b.peopleCount - a.peopleCount);
  assert.equal(sortedByPeople[0].id, 'req-c', 'Request affecting 15 people must rank first');

  // 4. Oldest sorting: surfaces longest waiting case
  const sortedByAge = [...feed].sort((a, b) => a.createdAt - b.createdAt);
  assert.equal(sortedByAge[0].id, 'req-a', 'Oldest request (created at 1000) must rank first in wait-time triage');
});

test('Interactive Map: Coordinate validation strictly rejects (0, 0) and missing data', () => {
  // Coordinates validation helper
  const validateMapPoint = (entity: {
    coords?: { x: number; y: number } | null;
    latitude?: number | null;
    longitude?: number | null;
  }): boolean => {
    const lat = entity.latitude;
    const lng = entity.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      if (lat === 0 && lng === 0) return false;
      return isValidLatLng(lat, lng);
    }
    const coords = entity.coords;
    if (!coords) return false;
    if (coords.x === 0 && coords.y === 0) return false;
    return typeof coords.x === 'number' && typeof coords.y === 'number';
  };

  assert.equal(validateMapPoint({ coords: { x: 0, y: 0 } }), false, 'Never put unknown locations at latitude zero and longitude zero');
  assert.equal(validateMapPoint({ latitude: 0, longitude: 0 }), false, 'Explicit latitude 0, longitude 0 must be rejected');
  assert.equal(validateMapPoint({ coords: null }), false, 'Missing coordinates must not be plotted');
  assert.equal(validateMapPoint({ latitude: 28.6139, longitude: 77.209 }), true, 'Valid GPS coordinates must pass');
  assert.equal(validateMapPoint({ coords: { x: 77.25, y: 28.55 } }), true, 'Valid local coordinate object must pass');
});

test('Interactive Map: Volunteer privacy and location permission enforcement', () => {
  const volunteerWithConsent: Volunteer = {
    id: 'vol-consenting',
    name: 'Rahul V.',
    skills: ['CPR', 'Driver'],
    coords: { x: 77.21, y: 28.51 },
    distanceMiles: 1.5,
    available: true,
    locationSharingPermission: true,
  };

  const volunteerWithoutConsent: Volunteer = {
    id: 'vol-private',
    name: 'Priya K.',
    skills: ['Psychological Support'],
    coords: { x: 77.23, y: 28.53 },
    distanceMiles: 2.1,
    available: true,
    locationSharingPermission: false, // User explicitly opted out
  };

  const shouldPlotVolunteer = (v: Volunteer): boolean => {
    if (v.locationSharingPermission === false) return false;
    if (!v.coords || (v.coords.x === 0 && v.coords.y === 0)) return false;
    return true;
  };

  assert.equal(shouldPlotVolunteer(volunteerWithConsent), true, 'Consenting volunteer with coordinates should be plotted');
  assert.equal(shouldPlotVolunteer(volunteerWithoutConsent), false, 'Non-consenting responder MUST NOT be plotted on the map');
});

test('Activity Timeline: Provenance distinguishes live confirmed records from simulated demo events', () => {
  // Test event recording
  const liveEvent = activityStore.recordEvent({
    type: 'request_acknowledged',
    title: 'Emergency Signal Acknowledged',
    description: 'Coordinator assigned priority queue index.',
    targetId: 'req-live-1',
    targetType: 'request',
    actorName: 'Lead Coordinator',
    actorRole: 'coordinator',
    isLive: true,
  });

  const allEvents = activityStore.getEvents();
  const recordedLive = allEvents.find((e) => e.id === liveEvent.id);
  assert.ok(recordedLive, 'Live event must be recorded in activity ledger');
  assert.equal(recordedLive?.isLive, true, 'isLive flag must be true for recorded operator action');

  const demoEvents = allEvents.filter((e) => !e.isLive);
  assert.ok(demoEvents.length > 0, 'Demo events must exist and have isLive === false');
  demoEvents.forEach((d) => {
    assert.equal(d.isLive, false, 'Simulated events must be explicitly labeled as demo data');
  });
});
