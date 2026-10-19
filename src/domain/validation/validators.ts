/**
 * Domain Validators
 * Pure functional validation rules enforcing core business invariants.
 */

import type {
  RequestSeverity,
  RequestLifecycleStatus,
} from '../models/emergency-request';
import type { TaskLifecycleStatus } from '../models/volunteer-task';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates geographic coordinates.
 * Missing GPS data (null or undefined) is explicitly VALID per emergency requirements.
 * Coordinates must never be fabricated to (0, 0) or arbitrary placeholders.
 */
export function validateCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): { valid: boolean; isMissing: boolean; error?: string } {
  const isLatEmpty = latitude === null || latitude === undefined || isNaN(latitude);
  const isLngEmpty = longitude === null || longitude === undefined || isNaN(longitude);

  if (isLatEmpty && isLngEmpty) {
    return { valid: true, isMissing: true };
  }

  if (isLatEmpty !== isLngEmpty) {
    return {
      valid: false,
      isMissing: false,
      error: 'Both latitude and longitude must be provided together or omitted entirely.',
    };
  }

  const lat = latitude as number;
  const lng = longitude as number;

  if (lat < -90 || lat > 90) {
    return {
      valid: false,
      isMissing: false,
      error: `Latitude ${lat} is out of valid bounds [-90, 90].`,
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      valid: false,
      isMissing: false,
      error: `Longitude ${lng} is out of valid bounds [-180, 180].`,
    };
  }

  return { valid: true, isMissing: false };
}

/**
 * Validates request severity classification.
 */
export function validateSeverity(severity: string): boolean {
  return ['critical', 'urgent', 'moderate', 'low'].includes(severity);
}

/**
 * Validates shelter bed capacity invariant:
 * occupiedBeds + reservedBeds must NEVER exceed totalCapacity.
 */
export function validateShelterCapacity(
  totalCapacity: number,
  occupiedBeds: number,
  reservedBeds: number = 0
): ValidationResult {
  const errors: string[] = [];

  if (typeof totalCapacity !== 'number' || isNaN(totalCapacity) || totalCapacity < 0) {
    errors.push('Total shelter capacity must be a non-negative number.');
  }

  if (typeof occupiedBeds !== 'number' || isNaN(occupiedBeds) || occupiedBeds < 0) {
    errors.push('Occupied beds count must be a non-negative number.');
  }

  if (typeof reservedBeds !== 'number' || isNaN(reservedBeds) || reservedBeds < 0) {
    errors.push('Reserved beds count must be a non-negative number.');
  }

  if (errors.length === 0) {
    if (occupiedBeds + reservedBeds > totalCapacity) {
      errors.push(
        `Total occupied (${occupiedBeds}) + reserved (${reservedBeds}) = ${
          occupiedBeds + reservedBeds
        } exceeds total capacity (${totalCapacity}).`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates resource allocation quantities:
 * quantityAllocated must NEVER exceed quantityAvailable.
 */
export function validateResourceAllocation(
  quantityAvailable: number,
  quantityAllocated: number,
  additionalAllocation: number = 0
): ValidationResult {
  const errors: string[] = [];

  if (quantityAvailable < 0) {
    errors.push('Available resource quantity cannot be negative.');
  }

  if (quantityAllocated < 0) {
    errors.push('Allocated resource quantity cannot be negative.');
  }

  if (additionalAllocation < 0) {
    errors.push('Additional allocation cannot be negative.');
  }

  const projectedAllocated = quantityAllocated + additionalAllocation;
  if (projectedAllocated > quantityAvailable) {
    errors.push(
      `Total allocated quantity (${projectedAllocated}) would exceed available quantity (${quantityAvailable}).`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates EmergencyRequest lifecycle state transitions.
 * Permitted transitions:
 * - active -> assigned
 * - active -> cancelled
 * - assigned -> in-progress
 * - assigned -> active (volunteer unassigned)
 * - assigned -> cancelled
 * - in-progress -> fulfilled
 * - in-progress -> assigned (mission aborted, needs reassignment)
 * - in-progress -> cancelled
 * Terminal states: fulfilled, cancelled (cannot transition out).
 */
export function isValidRequestTransition(
  from: RequestLifecycleStatus,
  to: RequestLifecycleStatus
): boolean {
  if (from === to) return true;

  const allowed: Record<RequestLifecycleStatus, RequestLifecycleStatus[]> = {
    active: ['assigned', 'cancelled'],
    assigned: ['in-progress', 'active', 'cancelled'],
    'in-progress': ['fulfilled', 'assigned', 'cancelled'],
    fulfilled: [],
    cancelled: [],
  };

  return (allowed[from] ?? []).includes(to);
}

/**
 * Validates VolunteerTask lifecycle state transitions.
 * Permitted transitions:
 * - proposed -> accepted
 * - proposed -> cancelled
 * - accepted -> in_transit
 * - accepted -> cancelled
 * - in_transit -> at_scene
 * - in_transit -> cancelled
 * - at_scene -> completed
 * - at_scene -> cancelled
 * Terminal states: completed, cancelled.
 */
export function isValidTaskTransition(
  from: TaskLifecycleStatus,
  to: TaskLifecycleStatus
): boolean {
  if (from === to) return true;

  const allowed: Record<TaskLifecycleStatus, TaskLifecycleStatus[]> = {
    proposed: ['accepted', 'cancelled'],
    accepted: ['in_transit', 'cancelled'],
    in_transit: ['at_scene', 'cancelled'],
    at_scene: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  return (allowed[from] ?? []).includes(to);
}
