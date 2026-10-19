/**
 * Emergency Request Service
 * Core business rules for creating, updating, and transitioning emergency requests.
 */

import type {
  EmergencyRequest,
  CreateEmergencyRequestInput,
  RequestLifecycleStatus,
} from '../models/emergency-request';
import {
  validateCoordinates,
  validateSeverity,
  isValidRequestTransition,
} from '../validation/validators';

export class RequestDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestDomainError';
  }
}

/**
 * Creates a validated EmergencyRequest with guaranteed unique ID, UTC timestamps,
 * and checked coordinates.
 */
export function createEmergencyRequest(
  input: CreateEmergencyRequestInput,
  existingRequests: EmergencyRequest[] = []
): EmergencyRequest {
  // 1. Idempotency check: prevent duplicate submissions with identical idempotencyKey
  if (input.idempotencyKey) {
    const existing = existingRequests.find(
      (r) => r.idempotencyKey === input.idempotencyKey
    );
    if (existing) {
      return existing; // Idempotent return without duplicate creation
    }
  }

  // 2. Validate description
  if (!input.description || !input.description.trim()) {
    throw new RequestDomainError('Emergency description must not be empty.');
  }

  // 3. Validate coordinates (missing is valid, out-of-bounds is rejected)
  const coordCheck = validateCoordinates(input.latitude, input.longitude);
  if (!coordCheck.valid) {
    throw new RequestDomainError(coordCheck.error || 'Invalid coordinates.');
  }

  // 3. Validate severity
  if (!validateSeverity(input.severity)) {
    throw new RequestDomainError(
      `Invalid severity '${input.severity}'. Must be critical, urgent, moderate, or low.`
    );
  }

  // 4. Validate people count
  if (typeof input.numberOfPeople !== 'number' || input.numberOfPeople < 1) {
    throw new RequestDomainError('Number of people must be at least 1.');
  }

  // 5. Build entity with unique ID and UTC timestamps
  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();

  return {
    id,
    incidentId: input.incidentId || null,
    requesterId: input.requesterId || 'anonymous-citizen',
    category: input.category || 'rescue',
    description: input.description.trim(),
    severity: input.severity,
    medicalPriority: input.medicalPriority || 'none',
    numberOfPeople: Math.floor(input.numberOfPeople),
    requiredResources: Array.isArray(input.requiredResources) ? input.requiredResources : [],
    latitude: coordCheck.isMissing ? null : (input.latitude as number),
    longitude: coordCheck.isMissing ? null : (input.longitude as number),
    locationAccuracy: input.locationAccuracy ?? null,
    locationDescription: (input.locationDescription || '').trim(),
    createdAt: now,
    updatedAt: now,
    status: input.status || 'active',
    assignedVolunteerId: input.assignedVolunteerId ?? null,
    syncStatus: input.syncStatus || 'pending',
    idempotencyKey: input.idempotencyKey || `${input.requesterId}-${Date.now()}`,
    confidentialMedicalDetails: input.confidentialMedicalDetails || null,
    contactName: input.contactName?.trim(),
    contactPhone: input.contactPhone?.trim(),
  };
}

/**
 * Transitions an EmergencyRequest to a new lifecycle status with state machine enforcement.
 */
export function transitionRequestStatus(
  request: EmergencyRequest,
  newStatus: RequestLifecycleStatus,
  assignedVolunteerId?: string | null
): EmergencyRequest {
  if (!isValidRequestTransition(request.status, newStatus)) {
    throw new RequestDomainError(
      `Illegal request state transition from '${request.status}' to '${newStatus}'.`
    );
  }

  const now = new Date().toISOString();

  return {
    ...request,
    status: newStatus,
    assignedVolunteerId:
      assignedVolunteerId !== undefined
        ? assignedVolunteerId
        : newStatus === 'active'
        ? null
        : request.assignedVolunteerId,
    updatedAt: now,
    syncStatus: 'pending',
  };
}
