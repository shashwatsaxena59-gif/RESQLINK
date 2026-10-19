/**
 * Domain Geolocation Service
 * Integrates spatial calculations with domain entities (EmergencyRequest, Shelter, Volunteer, ResourceOffer).
 * Enforces privacy rules and coordinate invariants.
 */

import type { EmergencyRequest } from '../models/emergency-request';
import type { Shelter } from '../models/shelter';
import type { Volunteer } from '../models/volunteer';
import type { ResourceOffer } from '../models/resource-offer';
import {
  isValidLatLng,
  filterNearby,
  formatDistance,
} from '../../lib/geo';

export interface NearbyResult<T> {
  entity: T;
  distanceKm: number;
  distanceMiles: number;
  isApproximate: boolean;
  formattedDistance: string;
}

/**
 * Finds emergency requests within a given radius (default 2 miles) from coordinates.
 * Excludes requests with missing or invalid coordinates.
 */
export function findNearbyRequests(
  requests: EmergencyRequest[],
  userLat: number,
  userLng: number,
  radiusMiles = 2
): NearbyResult<EmergencyRequest>[] {
  if (!isValidLatLng(userLat, userLng)) return [];

  const matched = filterNearby(
    requests,
    [userLat, userLng],
    radiusMiles,
    (req) => (isValidLatLng(req.latitude, req.longitude) ? [req.latitude!, req.longitude!] : null)
  );

  return matched.map((m) => ({
    entity: m,
    distanceKm: m.distanceKm,
    distanceMiles: m.distanceMiles,
    isApproximate: (m.locationAccuracy ?? 0) > 100,
    formattedDistance: formatDistance(m.distanceKm, 'mi', (m.locationAccuracy ?? 0) > 100),
  }));
}

/**
 * Finds shelters with available beds within radius.
 * Only includes shelters that are open and have unoccupied/unreserved bed capacity.
 */
export function findNearbySheltersWithBeds(
  shelters: Shelter[],
  userLat: number,
  userLng: number,
  radiusMiles = 10
): NearbyResult<Shelter>[] {
  if (!isValidLatLng(userLat, userLng)) return [];

  const openSheltersWithBeds = shelters.filter(
    (s) => s.operatingStatus === 'open' && s.totalCapacity - (s.occupiedBeds + s.reservedBeds) > 0
  );

  const matched = filterNearby(
    openSheltersWithBeds,
    [userLat, userLng],
    radiusMiles,
    (s) => (isValidLatLng(s.latitude, s.longitude) ? [s.latitude, s.longitude] : null)
  );

  return matched.map((m) => ({
    entity: m,
    distanceKm: m.distanceKm,
    distanceMiles: m.distanceMiles,
    isApproximate: false,
    formattedDistance: formatDistance(m.distanceKm, 'mi'),
  }));
}

/**
 * Finds available volunteers within radius who have explicitly enabled location sharing.
 * Strictly ignores volunteers who have not granted location-sharing consent.
 */
export function findNearbyConsentingVolunteers(
  volunteers: Volunteer[],
  userLat: number,
  userLng: number,
  radiusMiles = 5
): NearbyResult<Volunteer>[] {
  if (!isValidLatLng(userLat, userLng)) return [];

  // Privacy invariant: only volunteers with explicit consent and valid coordinates
  const consentingVolunteers = volunteers.filter(
    (v) =>
      v.locationSharingPermission === true &&
      v.availabilityStatus === 'available' &&
      v.coordinates !== null &&
      isValidLatLng(v.coordinates?.latitude, v.coordinates?.longitude)
  );

  const matched = filterNearby(
    consentingVolunteers,
    [userLat, userLng],
    radiusMiles,
    (v) => (v.coordinates ? [v.coordinates.latitude, v.coordinates.longitude] : null)
  );

  return matched.map((m) => ({
    entity: m,
    distanceKm: m.distanceKm,
    distanceMiles: m.distanceMiles,
    isApproximate: false,
    formattedDistance: formatDistance(m.distanceKm, 'mi'),
  }));
}

/**
 * Finds available resource offers within radius.
 */
export function findNearbyResourceOffers(
  offers: ResourceOffer[],
  userLat: number,
  userLng: number,
  radiusMiles = 5
): NearbyResult<ResourceOffer>[] {
  if (!isValidLatLng(userLat, userLng)) return [];

  const availableOffers = offers.filter(
    (o) =>
      o.availabilityStatus === 'available' &&
      isValidLatLng(o.latitude, o.longitude) &&
      o.quantityAvailable - o.quantityAllocated > 0
  );

  const matched = filterNearby(
    availableOffers,
    [userLat, userLng],
    radiusMiles,
    (o) => (isValidLatLng(o.latitude, o.longitude) ? [o.latitude!, o.longitude!] : null)
  );

  return matched.map((m) => ({
    entity: m,
    distanceKm: m.distanceKm,
    distanceMiles: m.distanceMiles,
    isApproximate: false,
    formattedDistance: formatDistance(m.distanceKm, 'mi'),
  }));
}
