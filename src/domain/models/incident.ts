/**
 * Incident Domain Model
 * Represents a broader disaster or localized emergency event (e.g. "Yamuna Flood - Sector 15").
 */

export type IncidentStatus = 'active' | 'contained' | 'resolved' | 'monitoring';

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface AffectedArea {
  regionName: string; // e.g. "Delhi NCR", "Joshimath"
  locality?: string;  // e.g. "Mayur Vihar Phase 1"
  bounds?: GeoBounds;
  estimatedAffectedPopulation?: number;
}

export interface Incident {
  id: string;
  name: string;
  description: string;
  hazardType: 'flood' | 'landslide' | 'fire' | 'earthquake' | 'storm' | 'industrial' | 'medical' | 'other';
  severityLevel: 'critical' | 'high' | 'medium' | 'low';
  affectedArea: AffectedArea;
  status: IncidentStatus;
  startedAt: string;    // ISO 8601 UTC timestamp
  updatedAt: string;    // ISO 8601 UTC timestamp
  resolvedAt: string | null; // ISO 8601 UTC timestamp
  activeRequestsCount?: number;
  activeRespondersCount?: number;
}

export type CreateIncidentInput = Omit<Incident, 'id' | 'startedAt' | 'updatedAt' | 'resolvedAt'> & {
  id?: string;
  startedAt?: string;
  resolvedAt?: string | null;
};
