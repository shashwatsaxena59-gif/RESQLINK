/**
 * Resource Service
 * Pure business logic for resource offers, preventing over-allocation and managing availability statuses.
 */

import type { ResourceOffer, OfferAvailabilityStatus } from '../models/resource-offer';
import { validateResourceAllocation } from '../validation/validators';

export class ResourceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceDomainError';
  }
}

/**
 * Computes the availability status based on available vs allocated quantities.
 */
export function computeOfferStatus(
  available: number,
  allocated: number
): OfferAvailabilityStatus {
  if (allocated === 0) return 'available';
  if (allocated >= available) return 'fully_allocated';
  return 'partially_allocated';
}

/**
 * Allocates a quantity of resources to an active task.
 * Throws ResourceDomainError if requested quantity exceeds available balance.
 */
export function allocateResource(
  offer: ResourceOffer,
  quantityToAllocate: number
): ResourceOffer {
  if (quantityToAllocate <= 0) {
    throw new ResourceDomainError('Quantity to allocate must be strictly greater than zero.');
  }

  const validation = validateResourceAllocation(
    offer.quantityAvailable,
    offer.quantityAllocated,
    quantityToAllocate
  );

  if (!validation.valid) {
    throw new ResourceDomainError(validation.errors.join(' '));
  }

  const newAllocated = offer.quantityAllocated + quantityToAllocate;

  return {
    ...offer,
    quantityAllocated: newAllocated,
    availabilityStatus: computeOfferStatus(offer.quantityAvailable, newAllocated),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Releases/deallocates resources previously allocated to a task (e.g. if task was cancelled).
 */
export function deallocateResource(
  offer: ResourceOffer,
  quantityToDeallocate: number
): ResourceOffer {
  if (quantityToDeallocate <= 0) {
    throw new ResourceDomainError('Quantity to deallocate must be strictly greater than zero.');
  }

  const newAllocated = Math.max(0, offer.quantityAllocated - quantityToDeallocate);

  return {
    ...offer,
    quantityAllocated: newAllocated,
    availabilityStatus: computeOfferStatus(offer.quantityAvailable, newAllocated),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Marks resources as fulfilled / consumed upon successful mission completion.
 */
export function fulfillAllocatedResource(
  offer: ResourceOffer,
  quantityFulfilled: number
): ResourceOffer {
  if (quantityFulfilled <= 0) {
    throw new ResourceDomainError('Fulfilled quantity must be greater than zero.');
  }

  const newAvailable = Math.max(0, offer.quantityAvailable - quantityFulfilled);
  const newAllocated = Math.max(0, offer.quantityAllocated - quantityFulfilled);

  return {
    ...offer,
    quantityAvailable: newAvailable,
    quantityAllocated: newAllocated,
    availabilityStatus: newAvailable === 0 ? 'fulfilled' : computeOfferStatus(newAvailable, newAllocated),
    updatedAt: new Date().toISOString(),
  };
}
