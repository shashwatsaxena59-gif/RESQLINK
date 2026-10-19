import type { Shelter, ShelterInventoryItem, IncomingDelivery, ShelterOperatingStatus } from '../models/shelter';
import { validateShelterCapacity } from '../validation/validators';

export class ShelterDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShelterDomainError';
  }
}

/**
 * Calculates available beds strictly adhering to capacity rules:
 * totalCapacity - (occupiedBeds + reservedBeds).
 * For example: 100 capacity, 72 occupied, 3 reserved -> 25 available beds.
 */
export function calculateAvailableBeds(
  shelter: Pick<Shelter, 'totalCapacity' | 'occupiedBeds' | 'reservedBeds'> | { capacity?: number; occupied?: number; reservedBeds?: number; totalCapacity?: number; occupiedBeds?: number }
): number {
  const total = (shelter as any).totalCapacity ?? (shelter as any).capacity ?? 0;
  const occupied = (shelter as any).occupiedBeds ?? (shelter as any).occupied ?? 0;
  const reserved = (shelter as any).reservedBeds ?? 0;
  return Math.max(0, total - (occupied + reserved));
}

/**
 * Updates shelter occupied bed count with strict capacity check.
 * Throws ShelterDomainError if occupied + reserved exceeds totalCapacity.
 */
export function recordBedIntake(
  shelter: Shelter,
  newOccupiedBeds: number
): Shelter {
  const validation = validateShelterCapacity(
    shelter.totalCapacity,
    newOccupiedBeds,
    shelter.reservedBeds
  );

  if (!validation.valid) {
    throw new ShelterDomainError(validation.errors.join(' '));
  }

  const isFull = newOccupiedBeds + shelter.reservedBeds >= shelter.totalCapacity;

  return {
    ...shelter,
    occupiedBeds: newOccupiedBeds,
    occupied: newOccupiedBeds,
    operatingStatus: isFull && shelter.operatingStatus === 'open' ? 'full' : shelter.operatingStatus,
    status: isFull && shelter.operatingStatus === 'open' ? 'full' : shelter.operatingStatus,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Updates total shelter capacity with strict check against current occupancy + reservations.
 * Prevents invalid capacity reductions below occupied + reserved.
 */
export function updateShelterCapacity(
  shelter: Shelter,
  newTotalCapacity: number
): Shelter {
  if (typeof newTotalCapacity !== 'number' || isNaN(newTotalCapacity) || newTotalCapacity < 0) {
    throw new ShelterDomainError('Total capacity must be a non-negative number.');
  }

  const currentCommitted = (shelter.occupiedBeds ?? 0) + (shelter.reservedBeds ?? 0);
  if (newTotalCapacity < currentCommitted) {
    throw new ShelterDomainError(
      `Cannot reduce capacity to ${newTotalCapacity}: current occupied (${shelter.occupiedBeds}) + reserved (${shelter.reservedBeds}) = ${currentCommitted} beds exceeds proposed capacity.`
    );
  }

  const isFull = currentCommitted >= newTotalCapacity;
  let newStatus = shelter.operatingStatus;
  if (isFull && newStatus === 'open') {
    newStatus = 'full';
  } else if (!isFull && newStatus === 'full') {
    newStatus = 'open';
  }

  return {
    ...shelter,
    totalCapacity: newTotalCapacity,
    capacity: newTotalCapacity,
    operatingStatus: newStatus,
    status: newStatus,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Reserves beds for incoming evacuees with strict capacity validation.
 */
export function reserveBeds(
  shelter: Shelter,
  bedsToReserve: number
): Shelter {
  if (bedsToReserve <= 0) {
    throw new ShelterDomainError('Beds to reserve must be greater than zero.');
  }

  const newReserved = shelter.reservedBeds + bedsToReserve;
  const validation = validateShelterCapacity(
    shelter.totalCapacity,
    shelter.occupiedBeds,
    newReserved
  );

  if (!validation.valid) {
    throw new ShelterDomainError(validation.errors.join(' '));
  }

  const isFull = shelter.occupiedBeds + newReserved >= shelter.totalCapacity;

  return {
    ...shelter,
    reservedBeds: newReserved,
    operatingStatus: isFull && shelter.operatingStatus === 'open' ? 'full' : shelter.operatingStatus,
    status: isFull && shelter.operatingStatus === 'open' ? 'full' : shelter.operatingStatus,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Releases reserved beds (either because evacuees arrived and became occupied, or mission cancelled).
 */
export function releaseReservedBeds(
  shelter: Shelter,
  bedsToRelease: number,
  convertedToOccupied: boolean = false
): Shelter {
  if (bedsToRelease <= 0) {
    throw new ShelterDomainError('Beds to release must be greater than zero.');
  }

  const newReserved = Math.max(0, shelter.reservedBeds - bedsToRelease);
  const newOccupied = convertedToOccupied
    ? shelter.occupiedBeds + bedsToRelease
    : shelter.occupiedBeds;

  const validation = validateShelterCapacity(
    shelter.totalCapacity,
    newOccupied,
    newReserved
  );

  if (!validation.valid) {
    throw new ShelterDomainError(validation.errors.join(' '));
  }

  const isFull = newOccupied + newReserved >= shelter.totalCapacity;

  return {
    ...shelter,
    reservedBeds: newReserved,
    occupiedBeds: newOccupied,
    occupied: newOccupied,
    operatingStatus: !isFull && shelter.operatingStatus === 'full' ? 'open' : shelter.operatingStatus,
    status: !isFull && shelter.operatingStatus === 'full' ? 'open' : shelter.operatingStatus,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Updates shelter operating status ('open', 'full', 'evacuating', 'closed')
 * Enforces rule: Cannot be marked 'open' if occupied + reserved >= totalCapacity.
 */
export function updateShelterOperatingStatus(
  shelter: Shelter,
  newStatus: ShelterOperatingStatus
): Shelter {
  const isFull = shelter.occupiedBeds + shelter.reservedBeds >= shelter.totalCapacity;
  if (newStatus === 'open' && isFull) {
    throw new ShelterDomainError('Cannot set status to open when shelter is at 100% capacity.');
  }

  return {
    ...shelter,
    operatingStatus: newStatus,
    status: newStatus,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Updates or sets an essential supply item in the shelter inventory.
 */
export function updateShelterInventory(
  shelter: Shelter,
  itemKey: string,
  quantity: number,
  unit: string,
  minThreshold?: number
): Shelter {
  if (quantity < 0) {
    throw new ShelterDomainError(`Inventory quantity for ${itemKey} cannot be negative.`);
  }

  const item: ShelterInventoryItem = {
    quantity,
    unit,
    minThreshold: minThreshold !== undefined ? minThreshold : (shelter.inventory?.[itemKey]?.minThreshold ?? 10),
    lastRestockedAt: new Date().toISOString(),
  };

  const updatedInventory = {
    ...(shelter.inventory || {}),
    [itemKey]: item,
  };

  // Auto-manage shortages list
  const existingShortages = new Set(shelter.resourceShortages || []);
  if (quantity <= (item.minThreshold ?? 0)) {
    existingShortages.add(itemKey);
  } else {
    existingShortages.delete(itemKey);
  }

  return {
    ...shelter,
    inventory: updatedInventory,
    resourceShortages: Array.from(existingShortages),
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Adds an incoming scheduled delivery of essentials.
 */
export function addIncomingDelivery(
  shelter: Shelter,
  delivery: Omit<IncomingDelivery, 'id'>
): Shelter {
  if (delivery.quantity <= 0) {
    throw new ShelterDomainError('Delivery quantity must be greater than zero.');
  }

  const newDelivery: IncomingDelivery = {
    ...delivery,
    id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    status: delivery.status || 'scheduled',
  };

  return {
    ...shelter,
    incomingDeliveries: [...(shelter.incomingDeliveries || []), newDelivery],
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Marks incoming delivery as delivered and increments shelter inventory.
 */
export function receiveIncomingDelivery(
  shelter: Shelter,
  deliveryId: string
): Shelter {
  const deliveries = shelter.incomingDeliveries || [];
  const targetIndex = deliveries.findIndex((d) => d.id === deliveryId);
  if (targetIndex === -1) {
    throw new ShelterDomainError(`Delivery ID ${deliveryId} not found.`);
  }

  const delivery = deliveries[targetIndex];
  if (delivery.status === 'delivered') {
    throw new ShelterDomainError(`Delivery ${deliveryId} has already been received.`);
  }

  const updatedDeliveries = [...deliveries];
  updatedDeliveries[targetIndex] = {
    ...delivery,
    status: 'delivered',
  };

  // Restock inventory
  const currentItem = shelter.inventory?.[delivery.item];
  const newQty = (currentItem?.quantity ?? 0) + delivery.quantity;
  const unit = currentItem?.unit ?? delivery.unit;
  const minThreshold = currentItem?.minThreshold ?? 20;

  const shelterWithUpdatedDelivery = {
    ...shelter,
    incomingDeliveries: updatedDeliveries,
  };

  return updateShelterInventory(
    shelterWithUpdatedDelivery,
    delivery.item,
    newQty,
    unit,
    minThreshold
  );
}

/**
 * Explicitly reports a resource shortage for the shelter.
 */
export function reportResourceShortage(
  shelter: Shelter,
  itemKey: string
): Shelter {
  const shortages = new Set(shelter.resourceShortages || []);
  shortages.add(itemKey);

  return {
    ...shelter,
    resourceShortages: Array.from(shortages),
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Resolves a previously reported resource shortage.
 */
export function resolveResourceShortage(
  shelter: Shelter,
  itemKey: string
): Shelter {
  const shortages = new Set(shelter.resourceShortages || []);
  shortages.delete(itemKey);

  return {
    ...shelter,
    resourceShortages: Array.from(shortages),
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Evaluates current shelter supplies against minThresholds and returns all shortages.
 */
export function detectShelterShortages(shelter: Shelter): string[] {
  const result: string[] = [];
  if (shelter.inventory) {
    for (const [key, item] of Object.entries(shelter.inventory)) {
      if (item.minThreshold !== undefined && item.quantity <= item.minThreshold) {
        result.push(key);
      }
    }
  }
  for (const s of shelter.resourceShortages || []) {
    if (!result.includes(s)) result.push(s);
  }
  return result;
}

