/**
 * Shelter Domain Model
 * Represents an evacuation facility, community shelter, or designated safe zone.
 */

export type ShelterOperatingStatus = 'open' | 'full' | 'evacuating' | 'closed';

export interface ShelterInventoryItem {
  quantity: number;
  unit: string;
  minThreshold?: number; // Minimum safe reserve threshold before warning
  lastRestockedAt?: string;
}

export interface IncomingDelivery {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  expectedAt: string;
  source: string;
  status: 'scheduled' | 'in_transit' | 'delivered';
  notes?: string;
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalCapacity: number; // Maximum bed / person capacity
  occupiedBeds: number;  // Currently occupied beds (occupied + reserved <= totalCapacity)
  reservedBeds: number;  // Beds reserved for en-route evacuees
  inventory: Record<string, ShelterInventoryItem>; // Keyed by item type (e.g. 'water_liters', 'meals', 'blankets')
  operatingStatus: ShelterOperatingStatus;
  lastUpdatedAt: string; // ISO 8601 UTC timestamp
  contactPhone?: string;
  amenities?: string[];
  accessibilityFeatures?: string[];
  region?: string;
  incomingDeliveries?: IncomingDelivery[];
  resourceShortages?: string[];
  // Compatibility fields for legacy map-view
  capacity?: number;
  occupied?: number;
  coords?: { x: number; y: number };
  status?: ShelterOperatingStatus;
}

export type CreateShelterInput = Omit<Shelter, 'id' | 'occupiedBeds' | 'reservedBeds' | 'lastUpdatedAt'> & {
  id?: string;
  occupiedBeds?: number;
  reservedBeds?: number;
};

