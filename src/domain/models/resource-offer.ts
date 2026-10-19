/**
 * ResourceOffer Domain Model
 * Represents tangible goods, equipment, or supplies offered by neighborhood residents or organizations.
 */

export type OfferAvailabilityStatus =
  | 'available'
  | 'partially_allocated'
  | 'fully_allocated'
  | 'fulfilled'
  | 'withdrawn';

export interface AvailabilityWindow {
  start: string; // ISO 8601 UTC timestamp
  end?: string;  // ISO 8601 UTC timestamp (optional)
}

export interface ResourceOffer {
  id: string;
  providerId: string;
  providerName?: string;
  providerPhone?: string;
  resourceType: string; // e.g., 'drinking_water', 'prepared_meals', 'blankets', 'medical_kits', 'generator'
  quantityAvailable: number; // Total quantity originally made available
  quantityAllocated: number; // Quantity allocated to active tasks (cannot exceed quantityAvailable)
  unit: string; // e.g., 'liters', 'meals', 'pieces', 'kits', 'hours'
  location: string; // Address or landmark description
  latitude?: number | null;
  longitude?: number | null;
  availabilityStatus: OfferAvailabilityStatus;
  availabilityWindow: AvailabilityWindow;
  createdAt: string; // ISO 8601 UTC timestamp
  updatedAt: string; // ISO 8601 UTC timestamp
  notes?: string;
}

export type CreateResourceOfferInput = Omit<
  ResourceOffer,
  'id' | 'quantityAllocated' | 'availabilityStatus' | 'createdAt' | 'updatedAt'
> & {
  id?: string;
  quantityAllocated?: number;
  availabilityStatus?: OfferAvailabilityStatus;
};
