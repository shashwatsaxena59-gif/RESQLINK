/**
 * Resource Offer Repository
 * Tracks neighborhood resource offers, inventory counts, and allocation status.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type {
  ResourceOffer,
  OfferAvailabilityStatus,
} from '../../domain/models/resource-offer';

export class ResourceOfferRepository extends BaseRepository<ResourceOffer> {
  constructor() {
    super(STORES.RESOURCE_OFFERS);
  }

  public async findByResourceType(resourceType: string): Promise<ResourceOffer[]> {
    const lower = resourceType.toLowerCase();
    const all = await this.findAll();
    return all.filter((o) => o.resourceType.toLowerCase().includes(lower));
  }

  public async findByStatus(status: OfferAvailabilityStatus): Promise<ResourceOffer[]> {
    const all = await this.findAll();
    return all.filter((o) => o.availabilityStatus === status);
  }

  public async findByProvider(providerId: string): Promise<ResourceOffer[]> {
    const all = await this.findAll();
    return all.filter((o) => o.providerId === providerId);
  }

  /**
   * Retrieves offers that still have unallocated capacity.
   */
  public async findAvailableForAllocation(): Promise<ResourceOffer[]> {
    const all = await this.findAll();
    return all.filter(
      (o) =>
        (o.availabilityStatus === 'available' || o.availabilityStatus === 'partially_allocated') &&
        o.quantityAvailable - o.quantityAllocated > 0
    );
  }
}

export const resourceOfferRepo = new ResourceOfferRepository();
