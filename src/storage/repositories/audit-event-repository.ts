/**
 * Audit Event Repository
 * Persists immutable operational logs for regulatory, medical, and security oversight.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type { AuditEvent } from '../../domain/models/audit-event';

export class AuditEventRepository extends BaseRepository<AuditEvent> {
  constructor() {
    super(STORES.AUDIT_EVENTS);
  }

  public async findByEntity(entityType: string, entityId: string): Promise<AuditEvent[]> {
    const all = await this.findAll();
    return all
      .filter((e) => e.entityType === entityType && e.entityId === entityId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  public async findByActor(actorId: string): Promise<AuditEvent[]> {
    const all = await this.findAll();
    return all.filter((e) => e.actorId === actorId);
  }

  public async findByAction(action: string): Promise<AuditEvent[]> {
    const all = await this.findAll();
    return all.filter((e) => e.action === action);
  }
}

export const auditEventRepo = new AuditEventRepository();
