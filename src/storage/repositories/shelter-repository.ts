/**
 * Shelter Repository
 * Manages evacuation shelter records, bed availability, and emergency supplies.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type { Shelter, ShelterOperatingStatus } from '../../domain/models/shelter';

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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

export class ShelterRepository extends BaseRepository<Shelter> {
  constructor() {
    super(STORES.SHELTERS);
  }

  public async findByStatus(status: ShelterOperatingStatus): Promise<Shelter[]> {
    const all = await this.findAll();
    return all.filter((s) => s.operatingStatus === status);
  }

  /**
   * Finds open shelters that have at least one unreserved, unoccupied bed.
   */
  public async findWithAvailableBeds(): Promise<Shelter[]> {
    const all = await this.findAll();
    return all.filter(
      (s) =>
        s.operatingStatus === 'open' &&
        s.totalCapacity - (s.occupiedBeds + s.reservedBeds) > 0
    );
  }

  /**
   * Finds open shelters near a location sorted by proximity.
   */
  public async findNearCoordinates(
    targetLat: number,
    targetLng: number,
    maxDistanceKm: number = 50
  ): Promise<Array<{ shelter: Shelter; distanceKm: number; availableBeds: number }>> {
    const all = await this.findAll();
    const results: Array<{ shelter: Shelter; distanceKm: number; availableBeds: number }> = [];

    for (const shelter of all) {
      if (shelter.operatingStatus !== 'open') continue;
      const dist = haversineDistanceKm(targetLat, targetLng, shelter.latitude, shelter.longitude);
      if (dist <= maxDistanceKm) {
        const availableBeds = Math.max(0, shelter.totalCapacity - (shelter.occupiedBeds + shelter.reservedBeds));
        results.push({
          shelter,
          distanceKm: Math.round(dist * 10) / 10,
          availableBeds,
        });
      }
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  }
}

export const shelterRepo = new ShelterRepository();
