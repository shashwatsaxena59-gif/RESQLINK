/**
 * Task Domain Service
 * Encapsulates mission creation, atomic assignment checks, and lifecycle progression.
 */

import type {
  VolunteerTask,
  TaskLifecycleStatus,
  CreateVolunteerTaskInput,
} from '../models/volunteer-task';
import { isValidTaskTransition } from '../validation/validators';

function getUtcIsoString(): string {
  return new Date().toISOString();
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Checks whether a volunteer can be assigned to an emergency request.
 * Enforces prevention of duplicate active tasks for the same request,
 * and ensures a volunteer isn't double-booked on multiple concurrent in-flight missions.
 */
export function canAssignVolunteer(
  existingTasks: VolunteerTask[],
  volunteerId: string,
  emergencyRequestId: string
): { allowed: boolean; reason?: string } {
  // Check if request already has an active task
  const requestActiveTask = existingTasks.find(
    (t) =>
      t.emergencyRequestId === emergencyRequestId &&
      t.status !== 'completed' &&
      t.status !== 'cancelled'
  );

  if (requestActiveTask) {
    return {
      allowed: false,
      reason: `Emergency request ${emergencyRequestId} is already assigned to active task ${requestActiveTask.id} (status: ${requestActiveTask.status}).`,
    };
  }

  // Check if volunteer is already committed to an active in-flight task
  const volunteerActiveTask = existingTasks.find(
    (t) =>
      t.volunteerId === volunteerId &&
      (t.status === 'accepted' || t.status === 'in_transit' || t.status === 'at_scene')
  );

  if (volunteerActiveTask) {
    return {
      allowed: false,
      reason: `Volunteer ${volunteerId} currently has an in-flight mission ${volunteerActiveTask.id} (status: ${volunteerActiveTask.status}). Complete or reassign prior task before dispatching new one.`,
    };
  }

  return { allowed: true };
}

/**
 * Creates and proposes or dispatches a new volunteer task.
 */
export function createVolunteerTask(
  input: CreateVolunteerTaskInput,
  existingTasks: VolunteerTask[] = []
): { task: VolunteerTask; error?: string } {
  const check = canAssignVolunteer(existingTasks, input.volunteerId, input.emergencyRequestId);
  if (!check.allowed) {
    throw new Error(check.reason || 'Assignment constraint violated.');
  }

  const now = getUtcIsoString();
  const initialStatus: TaskLifecycleStatus = input.status || 'proposed';

  const task: VolunteerTask = {
    id: input.id || generateId(),
    emergencyRequestId: input.emergencyRequestId,
    volunteerId: input.volunteerId,
    volunteerName: input.volunteerName || 'Volunteer Responder',
    allocatedResources: input.allocatedResources || [],
    status: initialStatus,
    createdAt: now,
    acceptedAt: initialStatus === 'accepted' ? now : (input.acceptedAt ?? null),
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    deliveryNotes: input.deliveryNotes ?? null,
    etaMinutes: input.etaMinutes ?? null,
  };

  return { task };
}

/**
 * Transitions a volunteer task to a new lifecycle status.
 * Enforces valid state machine transitions and logs appropriate timestamps.
 */
export function transitionTaskStatus(
  task: VolunteerTask,
  targetStatus: TaskLifecycleStatus,
  options?: {
    cancelReason?: string;
    deliveryNotes?: string;
    etaMinutes?: number;
  }
): VolunteerTask {
  if (!isValidTaskTransition(task.status, targetStatus)) {
    throw new Error(
      `Illegal task transition: Cannot change task ${task.id} from status '${task.status}' to '${targetStatus}'.`
    );
  }

  const now = getUtcIsoString();
  const updated: VolunteerTask = {
    ...task,
    status: targetStatus,
  };

  if (targetStatus === 'accepted' && !updated.acceptedAt) {
    updated.acceptedAt = now;
  }

  if (targetStatus === 'completed') {
    updated.completedAt = now;
    if (options?.deliveryNotes) {
      updated.deliveryNotes = options.deliveryNotes;
    }
  }

  if (targetStatus === 'cancelled') {
    updated.cancelledAt = now;
    updated.cancelReason = options?.cancelReason || 'Cancelled by coordinator or volunteer';
  }

  if (options?.etaMinutes !== undefined) {
    updated.etaMinutes = options.etaMinutes;
  }

  return updated;
}
