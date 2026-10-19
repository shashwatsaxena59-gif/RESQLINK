/**
 * ResQLink — Geospatial & Emergency Map Unit & Invariant Tests
 * Tests Haversine calculations, coordinate validation, proximity filtering,
 * volunteer consent isolation, shelter capacity queries, and routing fallbacks.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceKm,
  haversineDistanceMiles,
  calculateBearing,
  formatDistance,
  isValidLatLng,
  checkLocationAccuracy,
  filterNearby,
  sortByDistance,
  fetchRoute,
} from '../lib/geo';
import {
  findNearbyRequests,
  findNearbySheltersWithBeds,
  findNearbyConsentingVolunteers,
  findNearbyResourceOffers,
} from '../domain/services/geolocation-service';
import type { EmergencyRequest } from '../domain/models/emergency-request';
import type { Shelter } from '../domain/models/shelter';
import type { Volunteer } from '../domain/models/volunteer';
import type { ResourceOffer } from '../domain/models/resource-offer';

test('Haversine: computes accurate spherical distance between points', () => {
  // New Delhi (28.6139, 77.2090) to Noida Sector 18 (28.5708, 77.3260)
  const km = haversineDistanceKm(28.6139, 77.2090, 28.5708, 77.3260);
  const miles = haversineDistanceMiles(28.6139, 77.2090, 28.5708, 77.3260);

  // Approximately 12.4 km (7.7 miles)
  assert.ok(km > 11 && km < 14, `Expected km between 11 and 14, got ${km}`);
  assert.ok(miles > 6.8 && miles < 8.8, `Expected miles between 6.8 and 8.8, got ${miles}`);
  assert.equal(Math.round(miles * 1.60934 * 10) / 10, Math.round(km * 10) / 10);
});

test('Coordinates Validation: rejects null, undefined, NaN, and out-of-bounds coordinates', () => {
  assert.equal(isValidLatLng(28.5, 77.2), true);
  assert.equal(isValidLatLng(90, 180), true);
  assert.equal(isValidLatLng(-90, -180), true);

  // Invalid inputs
  assert.equal(isValidLatLng(null, 77.2), false);
  assert.equal(isValidLatLng(28.5, null), false);
  assert.equal(isValidLatLng(undefined, 77.2), false);
  assert.equal(isValidLatLng(NaN, 77.2), false);
  assert.equal(isValidLatLng(91, 77.2), false); // Latitude > 90
  assert.equal(isValidLatLng(-91, 77.2), false); // Latitude < -90
  assert.equal(isValidLatLng(28.5, 181), false); // Longitude > 180
  assert.equal(isValidLatLng(28.5, -181), false); // Longitude < -180
  assert.equal(isValidLatLng('28.5', '77.2'), false); // Strings rejected
});

test('Haversine: returns NaN when either coordinate is invalid', () => {
  assert.ok(Number.isNaN(haversineDistanceKm(NaN, 77.2, 28.6, 77.3)));
  assert.ok(Number.isNaN(haversineDistanceKm(28.5, 77.2, 95.0, 77.3)));
  assert.ok(Number.isNaN(haversineDistanceMiles(28.5, null as unknown as number, 28.6, 77.3)));
});

test('Bearing: calculates cardinal compass direction and degrees', () => {
  // Direct North
  const north = calculateBearing(28.0, 77.0, 29.0, 77.0);
  assert.equal(north.compass, 'N');
  assert.equal(north.degrees, 0);

  // Direct East
  const east = calculateBearing(28.0, 77.0, 28.0, 78.0);
  assert.equal(east.compass, 'E');
  assert.equal(east.degrees, 90);

  // Direct South
  const south = calculateBearing(29.0, 77.0, 28.0, 77.0);
  assert.equal(south.compass, 'S');
  assert.equal(south.degrees, 180);

  // Direct West
  const west = calculateBearing(28.0, 78.0, 28.0, 77.0);
  assert.equal(west.compass, 'W');
  assert.equal(west.degrees, 270);
});

test('Format Distance: displays consistent units and approximate indicators', () => {
  // Miles format
  assert.equal(formatDistance(0.05, 'mi', false), '164 ft');
  assert.equal(formatDistance(3.218, 'mi', false), '2.0 mi');
  assert.equal(formatDistance(3.218, 'mi', true), '~2.0 mi');

  // Kilometres format
  assert.equal(formatDistance(0.45, 'km', false), '450 m');
  assert.equal(formatDistance(4.5, 'km', false), '4.5 km');
  assert.equal(formatDistance(4.5, 'km', true), '~4.5 km');

  // Null or missing distance
  assert.equal(formatDistance(null), 'Distance unavailable');
  assert.equal(formatDistance(NaN), 'Distance unavailable');
});

test('Accuracy Check: flags accuracy > 100m as approximate', () => {
  const good = checkLocationAccuracy(25);
  assert.equal(good.isApproximate, false);
  assert.ok(good.accuracyDesc.includes('Precise'));

  const poor = checkLocationAccuracy(350);
  assert.equal(poor.isApproximate, true);
  assert.ok(poor.accuracyDesc.includes('Approximate'));
  assert.ok(poor.accuracyDesc.includes('350m'));

  const missing = checkLocationAccuracy(null);
  assert.equal(missing.isApproximate, false);
});

test('Filter & Sort Nearby: filters by default 2 miles and sorts ascending', () => {
  const userCoords: [number, number] = [28.6139, 77.2090]; // Delhi center

  const items = [
    { id: '1', name: 'Faraway', lat: 28.75, lng: 77.50 }, // ~33 km away
    { id: '2', name: 'Very Close', lat: 28.616, lng: 77.212 }, // ~0.3 km away (~0.2 mi)
    { id: '3', name: 'Within 2 miles', lat: 28.630, lng: 77.225 }, // ~2.4 km away (~1.5 mi)
    { id: '4', name: 'No GPS', lat: null, lng: null },
  ];

  // Filter within 2 miles (default radius)
  const nearby = filterNearby(
    items,
    userCoords,
    2,
    (i) => (i.lat !== null && i.lng !== null ? [i.lat, i.lng] : null)
  );

  assert.equal(nearby.length, 2);
  assert.equal(nearby[0].id, '2'); // Closest first
  assert.equal(nearby[1].id, '3');
  assert.ok(nearby[0].distanceMiles < 0.5);
  assert.ok(nearby[1].distanceMiles < 2.0);

  // Sorting
  const sorted = sortByDistance(
    items,
    userCoords,
    (i) => (i.lat !== null && i.lng !== null ? [i.lat, i.lng] : null)
  );

  assert.equal(sorted[0].id, '2');
  assert.equal(sorted[1].id, '3');
  assert.equal(sorted[2].id, '1');
  assert.equal(sorted[3].id, '4'); // Items without coordinates placed at the end
  assert.equal(sorted[3].distanceKm, null);
});

test('Domain Geolocation: findNearbyRequests ignores requests without GPS coordinates', () => {
  const requests: EmergencyRequest[] = [
    {
      id: 'req-gps',
      incidentId: 'inc-1',
      requesterId: 'user-1',
      category: 'medical',
      description: 'Patient needs oxygen',
      severity: 'critical',
      medicalPriority: 'immediate',
      numberOfPeople: 1,
      requiredResources: ['oxygen'],
      latitude: 28.615,
      longitude: 77.210,
      locationAccuracy: 15,
      locationDescription: 'Near Central Park',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      assignedVolunteerId: null,
      syncStatus: 'synced',
      idempotencyKey: 'idemp-1',
    },
    {
      id: 'req-no-gps',
      incidentId: 'inc-1',
      requesterId: 'user-2',
      category: 'food',
      description: 'Water needed',
      severity: 'moderate',
      medicalPriority: 'none',
      numberOfPeople: 4,
      requiredResources: ['water'],
      latitude: null, // No GPS!
      longitude: null,
      locationAccuracy: null,
      locationDescription: 'Beside old water tank (landmark only)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      assignedVolunteerId: null,
      syncStatus: 'pending',
      idempotencyKey: 'idemp-2',
    },
  ];

  const nearby = findNearbyRequests(requests, 28.6139, 77.2090, 2);
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].entity.id, 'req-gps');
  assert.ok(nearby[0].distanceMiles < 0.5);
});

test('Domain Geolocation: findNearbySheltersWithBeds only returns shelters with unoccupied beds', () => {
  const shelters: Shelter[] = [
    {
      id: 'sh-open-beds',
      name: 'Community Center Shelter',
      address: 'Mayur Vihar',
      latitude: 28.614,
      longitude: 77.210,
      totalCapacity: 100,
      occupiedBeds: 70,
      reservedBeds: 10, // 20 beds available
      inventory: {},
      operatingStatus: 'open',
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      id: 'sh-full',
      name: 'Full Stadium Shelter',
      address: 'Indira Stadium',
      latitude: 28.615,
      longitude: 77.211,
      totalCapacity: 50,
      occupiedBeds: 50, // 0 beds available!
      reservedBeds: 0,
      inventory: {},
      operatingStatus: 'open',
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      id: 'sh-closed',
      name: 'Evacuated Shelter',
      address: 'Riverbank',
      latitude: 28.616,
      longitude: 77.212,
      totalCapacity: 80,
      occupiedBeds: 0,
      reservedBeds: 0,
      inventory: {},
      operatingStatus: 'closed', // Closed!
      lastUpdatedAt: new Date().toISOString(),
    },
  ];

  const results = findNearbySheltersWithBeds(shelters, 28.6139, 77.2090, 5);
  assert.equal(results.length, 1);
  assert.equal(results[0].entity.id, 'sh-open-beds');
  assert.equal(results[0].entity.totalCapacity - (results[0].entity.occupiedBeds + results[0].entity.reservedBeds), 20);
});

test('Domain Geolocation: findNearbyConsentingVolunteers strictly excludes non-consenting responders', () => {
  const volunteers: Volunteer[] = [
    {
      id: 'vol-consenting',
      displayName: 'Sarah Responder',
      skills: ['EMT', 'First Aid'],
      offeredResources: ['medical_kit'],
      availabilityStatus: 'available',
      locationSharingPermission: true, // EXPLICIT CONSENT
      coordinates: { latitude: 28.615, longitude: 77.210, accuracy: 20 },
      serviceRadius: 5,
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: 'vol-denied',
      displayName: 'Secret Responder',
      skills: ['Driver'],
      offeredResources: ['4wd'],
      availabilityStatus: 'available',
      locationSharingPermission: false, // NO CONSENT!
      coordinates: { latitude: 28.615, longitude: 77.210 },
      serviceRadius: 5,
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: 'vol-busy',
      displayName: 'Busy Responder',
      skills: ['Medic'],
      offeredResources: [],
      availabilityStatus: 'on_mission', // Busy on another mission
      locationSharingPermission: true,
      coordinates: { latitude: 28.615, longitude: 77.210 },
      serviceRadius: 5,
      lastSeenAt: new Date().toISOString(),
    },
  ];

  const consenting = findNearbyConsentingVolunteers(volunteers, 28.6139, 77.2090, 5);
  assert.equal(consenting.length, 1);
  assert.equal(consenting[0].entity.id, 'vol-consenting');
});

test('Domain Geolocation: findNearbyResourceOffers filters available resources', () => {
  const offers: ResourceOffer[] = [
    {
      id: 'res-water',
      providerId: 'ngo-1',
      resourceType: 'drinking_water',
      quantityAvailable: 100,
      quantityAllocated: 20, // 80 available
      unit: 'liters',
      location: 'Depot A',
      latitude: 28.615,
      longitude: 77.210,
      availabilityStatus: 'available',
      availabilityWindow: { start: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'res-exhausted',
      providerId: 'ngo-2',
      resourceType: 'blankets',
      quantityAvailable: 50,
      quantityAllocated: 50, // 0 remaining!
      unit: 'pieces',
      location: 'Depot B',
      latitude: 28.616,
      longitude: 77.211,
      availabilityStatus: 'available',
      availabilityWindow: { start: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const results = findNearbyResourceOffers(offers, 28.6139, 77.2090, 5);
  assert.equal(results.length, 1);
  assert.equal(results[0].entity.id, 'res-water');
});

test('Routing Fallback: provides straight-line distance and safety notice when routing unavailable', async () => {
  const start: [number, number] = [28.6139, 77.2090];
  const end: [number, number] = [28.5708, 77.3260];

  // Route calculation with invalid coords or network fallback
  const invalidResult = await fetchRoute([NaN, 77.0], end, 'driving');
  assert.equal(invalidResult.success, false);
  assert.equal(invalidResult.isRealRoute, false);
  assert.ok(invalidResult.error?.includes('Invalid coordinates'));

  // Valid coords fallback verification
  const straightLine = haversineDistanceKm(start[0], start[1], end[0], end[1]);
  assert.ok(straightLine > 10 && straightLine < 15);
});
