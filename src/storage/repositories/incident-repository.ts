/**
 * Incident Repository
 * Manages disaster incident records, severity ratings, and containment statuses.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type { Incident, IncidentStatus } from '../../domain/models/incident';

export class IncidentRepository extends BaseRepository<Incident> {
  constructor() {
    super(STORES.INCIDENTS);
  }

  public async findByStatus(status: IncidentStatus): Promise<Incident[]> {
    const all = await this.findAll();
    return all.filter((i) => i.status === status);
  }

  public async findActive(): Promise<Incident[]> {
    const all = await this.findAll();
    return all.filter((i) => i.status === 'active' || i.status === 'monitoring');
  }

  public async findByHazard(hazardType: string): Promise<Incident[]> {
    const all = await this.findAll();
    return all.filter((i) => i.hazardType === hazardType);
  }
}

export const incidentRepo = new IncidentRepository();
