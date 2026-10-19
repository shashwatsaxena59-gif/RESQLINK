/**
 * Volunteer Repository
 * Manages responders, availability state, and geographical proximity lookups.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type { Volunteer, VolunteerAvailability } from '../../domain/models/volunteer';

/**
 * Calculates Great Circle Haversine distance between two coordinates in kilometers.
 */
function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class VolunteerRepository extends BaseRepository<Volunteer> {
  constructor() {
    super(STORES.VOLUNTEERS);
  }

  public async findByAvailability(status: VolunteerAvailability): Promise<Volunteer[]> {
    const all = await this.findAll();
    return all.filter((v) => v.availabilityStatus === status);
  }

  public async findAvailable(): Promise<Volunteer[]> {
    return this.findByAvailability('available');
  }

  public async findBySkill(skill: string): Promise<Volunteer[]> {
    const lowerSkill = skill.toLowerCase();
    const all = await this.findAll();
    return all.filter((v) =>
      v.skills.some((s) => s.toLowerCase().includes(lowerSkill))
    );
  }

  public async findByNgo(ngoId: string): Promise<Volunteer[]> {
    const all = await this.findAll();
    return all.filter((v) => v.ngoAffiliationId === ngoId);
  }

  /**
   * Finds available volunteers whose location is within their operational radius of the target coordinates.
   * Only considers volunteers who have enabled location-sharing permissions and have valid coordinates.
   */
  public async findNearCoordinates(
    targetLat: number,
    targetLng: number,
    maxRadiusKm: number = 25
  ): Promise<Array<{ volunteer: Volunteer; distanceKm: number }>> {
    const available = await this.findAvailable();
    const matches: Array<{ volunteer: Volunteer; distanceKm: number }> = [];

    for (const v of available) {
      if (v.locationSharingPermission && v.coordinates) {
        const dist = haversineDistanceKm(
          targetLat,
          targetLng,
          v.coordinates.latitude,
          v.coordinates.longitude
        );
        const effectiveRadius = Math.min(v.serviceRadius, maxRadiusKm);
        if (dist <= effectiveRadius) {
          matches.push({ volunteer: v, distanceKm: Math.round(dist * 10) / 10 });
        }
      }
    }

    return matches.sort((a, b) => a.distanceKm - b.distanceKm);
  }
}

export const volunteerRepo = new VolunteerRepository();
