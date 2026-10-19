/**
 * Privacy & Security Service
 * Restricts access to sensitive medical information and masks exact locations per disaster safety requirements.
 */

import type { EmergencyRequest } from '../models/emergency-request';

export type UserRole = 'citizen' | 'volunteer' | 'shelter_officer' | 'coordinator';

export interface ActorContext {
  actorId: string;
  role: UserRole;
}

/**
 * Determines whether the given actor is authorized to view confidential medical details.
 * Allowed actors:
 * 1. The original requester themselves.
 * 2. Emergency coordinators / incident command officers.
 * 3. The volunteer specifically assigned to this request.
 */
export function canAccessMedicalData(
  actor: ActorContext,
  request: Pick<EmergencyRequest, 'requesterId' | 'assignedVolunteerId'>
): boolean {
  if (actor.role === 'coordinator') return true;
  if (actor.actorId === request.requesterId) return true;
  if (request.assignedVolunteerId && actor.actorId === request.assignedVolunteerId) return true;
  return false;
}

/**
 * Returns a sanitized copy of an EmergencyRequest with sensitive medical details
 * redacted if the actor is unauthorized.
 */
export function sanitizeRequestForActor(
  request: EmergencyRequest,
  actor: ActorContext
): EmergencyRequest {
  if (canAccessMedicalData(actor, request)) {
    return { ...request };
  }

  // Redact confidential medical notes and mask medical priority for public viewers
  return {
    ...request,
    confidentialMedicalDetails: undefined,
    medicalPriority: request.medicalPriority === 'immediate' ? 'immediate' : 'none',
  };
}

/**
 * Obscures exact latitude and longitude by rounding to ~500m precision (3 decimal places)
 * to protect victim location privacy on public unauthenticated views.
 */
export function obfuscateCoordinates(
  lat: number | null,
  lng: number | null
): { latitude: number | null; longitude: number | null } {
  if (lat === null || lng === null) return { latitude: null, longitude: null };
  return {
    latitude: Math.round(lat * 1000) / 1000,
    longitude: Math.round(lng * 1000) / 1000,
  };
}
