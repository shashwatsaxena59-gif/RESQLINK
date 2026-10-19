import * as fs from 'fs';
import * as path from 'path';

export interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
}

const DATA_DIR = path.join(__dirname, 'data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-events.json');

export function readAuditEvents(limit: number = 100): AuditEvent[] {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, 'utf8');
      const events: AuditEvent[] = JSON.parse(raw);
      return events.slice(-limit).reverse(); // Newest first
    }
  } catch (err) {
    console.error('[AuditEvents] Read error:', err);
  }
  return [];
}

export function recordAuditEvent(event: {
  action: string;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  ipAddress?: string;
}): AuditEvent {
  let allEvents: AuditEvent[] = [];
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      allEvents = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
    }
  } catch {
    allEvents = [];
  }

  const record: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...event,
    timestamp: new Date().toISOString(),
  };

  allEvents.push(record);

  // Keep last 1,000 audit records
  if (allEvents.length > 1000) {
    allEvents = allEvents.slice(-1000);
  }

  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(allEvents, null, 2), 'utf8');
  } catch (err) {
    console.error('[AuditEvents] Write error:', err);
  }

  return record;
}
