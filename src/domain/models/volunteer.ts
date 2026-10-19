/**
 * Volunteer Domain Model
 * Represents a registered community responder or organized relief team member.
 */

export type VolunteerAvailability = 'available' | 'on_mission' | 'offline' | 'unavailable';

export interface VolunteerCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export interface Volunteer {
  id: string;
  displayName: string;
  skills: string[];
  offeredResources: string[];
  availabilityStatus: VolunteerAvailability;
  locationSharingPermission: boolean;
  coordinates: VolunteerCoordinates | null; // ONLY present if locationSharingPermission === true
  serviceRadius: number; // Radius in kilometers within which the volunteer operates
  lastSeenAt: string; // ISO 8601 UTC timestamp
  phone?: string;
  email?: string;
  ngoAffiliationId?: string | null;
  ngoAffiliationName?: string | null;
}

export type CreateVolunteerInput = Omit<Volunteer, 'id' | 'lastSeenAt' | 'availabilityStatus'> & {
  id?: string;
  availabilityStatus?: VolunteerAvailability;
};
