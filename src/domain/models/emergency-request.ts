/**
 * EmergencyRequest Domain Model
 * Represents an urgent request for aid submitted by a citizen, volunteer, or field worker.
 */

export type RequestSeverity = 'critical' | 'urgent' | 'moderate' | 'low';

export type MedicalPriority = 'immediate' | 'delayed' | 'minor' | 'expectant' | 'none';

export type RequestCategoryType =
  | 'medical'
  | 'food'
  | 'shelter'
  | 'volunteers'
  | 'rescue'
  | 'evacuation'
  | 'water'
  | 'other';

export type RequestLifecycleStatus =
  | 'active'
  | 'assigned'
  | 'in-progress'
  | 'fulfilled'
  | 'cancelled';

export type SyncStatus =
  | 'saved_locally'
  | 'waiting_to_sync'
  | 'synchronizing'
  | 'confirmed_by_server'
  | 'failed'
  | 'conflict'
  | 'pending'
  | 'synced';

export interface EmergencyRequest {
  id: string;
  incidentId: string | null;
  requesterId: string;
  category: RequestCategoryType;
  description: string;
  severity: RequestSeverity;
  medicalPriority: MedicalPriority;
  numberOfPeople: number;
  requiredResources: string[];
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null; // Accuracy radius in meters (from Geolocation API)
  locationDescription: string;
  createdAt: string; // ISO 8601 UTC timestamp
  updatedAt: string; // ISO 8601 UTC timestamp
  status: RequestLifecycleStatus;
  assignedVolunteerId: string | null;
  syncStatus: SyncStatus;
  idempotencyKey: string;
  version?: number;
  serverAckTimestamp?: string | null;
  acknowledged?: boolean;
  acknowledgedAt?: string | null;
  // Optional confidential medical note (restricted access)
  confidentialMedicalDetails?: string | null;
  // Contact phone and name
  contactName?: string;
  contactPhone?: string;
}

export type CreateEmergencyRequestInput = Omit<
  EmergencyRequest,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'assignedVolunteerId'
  | 'syncStatus'
  | 'incidentId'
  | 'requesterId'
  | 'medicalPriority'
  | 'locationAccuracy'
  | 'locationDescription'
  | 'latitude'
  | 'longitude'
> & {
  id?: string;
  status?: RequestLifecycleStatus;
  incidentId?: string | null;
  requesterId?: string;
  medicalPriority?: MedicalPriority;
  locationAccuracy?: number | null;
  locationDescription?: string;
  latitude?: number | null;
  longitude?: number | null;
  assignedVolunteerId?: string | null;
  syncStatus?: SyncStatus;
};
