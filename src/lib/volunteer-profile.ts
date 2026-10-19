/**
 * Volunteer Profile Store
 *
 * Persists local volunteer responder profile, skills, offered supplies,
 * availability state, and privacy permissions.
 */

const VOLUNTEER_PROFILE_KEY = 'resqlink-volunteer-profile-v2';
const LEGACY_KEY = 'resqlink-volunteer-profile-v1';

export interface OfferedSupplyItem {
  id?: string;
  type: string;
  quantity: number;
  unit: string;
}

export interface VolunteerProfile {
  id: string;
  displayName: string;
  fullName?: string; // backwards compatibility alias
  gender?: string;
  phone?: string;
  email?: string;
  skills: string[];
  offeredSupplies: OfferedSupplyItem[];
  preferredCategories: string[];
  availabilityStatus: 'available' | 'on_mission' | 'offline' | 'unavailable';
  serviceArea: string;
  serviceRadiusMiles: number;
  locationPermission: boolean;
  coordinates: {
    lat: number;
    lng: number;
    accuracy?: number | null;
  } | null;
  registeredAt: number;
}

export function getVolunteerProfile(): VolunteerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(VOLUNTEER_PROFILE_KEY);
    if (saved) {
      return JSON.parse(saved) as VolunteerProfile;
    }
    // Check legacy key
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated: VolunteerProfile = {
        id: `vol-${Date.now()}`,
        displayName: parsed.fullName || 'Community Volunteer',
        fullName: parsed.fullName,
        gender: parsed.gender,
        phone: parsed.phone,
        email: parsed.email,
        skills: ['general_aid', 'first_aid'],
        offeredSupplies: [],
        preferredCategories: ['medical', 'food', 'water'],
        availabilityStatus: 'available',
        serviceArea: 'Local Neighborhood (Within 2 miles)',
        serviceRadiusMiles: 2,
        locationPermission: Boolean(parsed.locationPermission),
        coordinates: null,
        registeredAt: parsed.registeredAt || Date.now(),
      };
      saveVolunteerProfile(migrated);
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveVolunteerProfile(profile: VolunteerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOLUNTEER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to persist volunteer profile', e);
  }
}

export function hasVolunteerProfile(): boolean {
  return getVolunteerProfile() !== null;
}

export function updateVolunteerAvailability(
  status: 'available' | 'on_mission' | 'offline' | 'unavailable'
): VolunteerProfile | null {
  const current = getVolunteerProfile();
  if (!current) return null;
  const updated: VolunteerProfile = {
    ...current,
    availabilityStatus: status,
  };
  saveVolunteerProfile(updated);
  return updated;
}

export function clearVolunteerProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(VOLUNTEER_PROFILE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch (e) {
    console.error('Failed to clear volunteer profile', e);
  }
}
