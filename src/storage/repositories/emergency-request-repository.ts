/**
 * Emergency Request Repository
 * Persists and retrieves emergency assistance requests with indexing support.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type {
  EmergencyRequest,
  RequestLifecycleStatus,
  RequestSeverity,
} from '../../domain/models/emergency-request';

export class EmergencyRequestRepository extends BaseRepository<EmergencyRequest> {
  constructor() {
    super(STORES.EMERGENCY_REQUESTS);
  }

  public async findByIdempotencyKey(key: string): Promise<EmergencyRequest | null> {
    const all = await this.findAll();
    return all.find((req) => req.idempotencyKey === key) ?? null;
  }

  public async findByStatus(status: RequestLifecycleStatus): Promise<EmergencyRequest[]> {
    const all = await this.findAll();
    return all.filter((req) => req.status === status);
  }

  public async findBySeverity(severity: RequestSeverity): Promise<EmergencyRequest[]> {
    const all = await this.findAll();
    return all.filter((req) => req.severity === severity);
  }

  public async findByIncidentId(incidentId: string): Promise<EmergencyRequest[]> {
    const all = await this.findAll();
    return all.filter((req) => req.incidentId === incidentId);
  }

  public async findUnsynced(): Promise<EmergencyRequest[]> {
    const all = await this.findAll();
    return all.filter((req) => req.syncStatus === 'pending' || req.syncStatus === 'failed');
  }

  public async findActive(): Promise<EmergencyRequest[]> {
    const all = await this.findAll();
    return all.filter((req) => req.status === 'active' || req.status === 'assigned' || req.status === 'in-progress');
  }
}

export const emergencyRequestRepo = new EmergencyRequestRepository();
