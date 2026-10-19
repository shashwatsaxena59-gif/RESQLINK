/**
 * AuditEvent Domain Model
 * Immutable audit trail capturing operations, allocations, task assignments, and medical access.
 */

export type AuditActionType =
  | 'request_created'
  | 'request_updated'
  | 'request_cancelled'
  | 'request_assigned'
  | 'request_fulfilled'
  | 'task_accepted'
  | 'task_status_changed'
  | 'task_completed'
  | 'shelter_capacity_updated'
  | 'shelter_inventory_updated'
  | 'resource_allocated'
  | 'resource_deallocated'
  | 'medical_data_accessed';

export interface AuditEvent {
  id: string;
  action: AuditActionType;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: string; // e.g. 'citizen', 'volunteer', 'shelter_officer', 'coordinator'
  timestamp: string; // ISO 8601 UTC timestamp
  details: Record<string, unknown>;
  ipOrDeviceInfo?: string;
}

export type CreateAuditEventInput = Omit<AuditEvent, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};
