/**
 * VolunteerTask Domain Model
 * Represents an operational mission linking an emergency request to an assigned responder.
 */

export type TaskLifecycleStatus =
  | 'proposed'
  | 'accepted'
  | 'in_transit'
  | 'at_scene'
  | 'completed'
  | 'cancelled';

export interface AllocatedResourceItem {
  resourceOfferId?: string; // Optional reference to a specific ResourceOffer
  type: string;
  quantity: number;
  unit: string;
}

export interface VolunteerTask {
  id: string;
  emergencyRequestId: string;
  volunteerId: string;
  volunteerName?: string;
  allocatedResources: AllocatedResourceItem[];
  status: TaskLifecycleStatus;
  createdAt: string;    // ISO 8601 UTC timestamp
  acceptedAt: string | null;  // ISO 8601 UTC timestamp
  completedAt: string | null; // ISO 8601 UTC timestamp
  cancelledAt?: string | null;
  cancelReason?: string | null;
  deliveryNotes: string | null;
  etaMinutes?: number | null;
}

export type CreateVolunteerTaskInput = Omit<
  VolunteerTask,
  'id' | 'createdAt' | 'status' | 'acceptedAt' | 'completedAt' | 'allocatedResources' | 'deliveryNotes'
> & {
  id?: string;
  status?: TaskLifecycleStatus;
  allocatedResources?: AllocatedResourceItem[];
  deliveryNotes?: string | null;
  acceptedAt?: string | null;
  completedAt?: string | null;
};
