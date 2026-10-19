/**
 * ResQLink Authorization and Role-Based Permissions
 * Enforces security policies, medical data isolation, and operational privileges.
 */

export type UserRole =
  | 'coordinator'
  | 'volunteer'
  | 'shelter_manager'
  | 'shelter_officer'
  | 'requester'
  | 'citizen'
  | 'guest';

export interface AuthUser {
  id: string;
  displayName: string;
  role: UserRole;
  organizationId?: string | null;
  organizationName?: string | null;
  assignedShelterId?: string | null;
  activeTaskId?: string | null;
}

/**
 * Checks whether an actor can view confidential emergency medical notes.
 * Strictly limited to coordinators and assigned volunteers on scene/en route.
 */
export function canAccessMedicalData(
  user: AuthUser | null | undefined,
  requestAssignedVolunteerId?: string | null
): boolean {
  if (!user) return false;
  if (user.role === 'coordinator') return true;

  if (user.role === 'volunteer' && requestAssignedVolunteerId) {
    return user.id === requestAssignedVolunteerId;
  }

  return false;
}

/**
 * Checks whether an actor can assign volunteers or modify mission allocations.
 */
export function canAssignVolunteerTask(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'coordinator';
}

/**
 * Checks whether an actor can modify shelter capacity or inventory records.
 */
export function canUpdateShelter(
  user: AuthUser | null | undefined,
  targetShelterId?: string
): boolean {
  if (!user) return false;
  if (user.role === 'coordinator') return true;

  if (user.role === 'shelter_manager' || user.role === 'shelter_officer') {
    if (!targetShelterId || !user.assignedShelterId) return true;
    return user.assignedShelterId === targetShelterId;
  }

  return false;
}

/**
 * Checks whether an actor can declare, escalate, or resolve disaster incidents.
 */
export function canModifyIncident(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'coordinator';
}

/**
 * Checks whether an actor can cancel an emergency request.
 * Either a coordinator or the original requester who filed the ticket.
 */
export function canCancelEmergencyRequest(
  user: AuthUser | null | undefined,
  requestOwnerId?: string
): boolean {
  if (!user) return false;
  if (user.role === 'coordinator') return true;
  if (user.role === 'requester' && requestOwnerId && user.id === requestOwnerId) {
    return true;
  }
  return false;
}

/**
 * Checks whether an actor can allocate or redistribute neighborhood resources.
 */
export function canAllocateResources(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'coordinator' || user.role === 'shelter_manager' || user.role === 'shelter_officer';
}
