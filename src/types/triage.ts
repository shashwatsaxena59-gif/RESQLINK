/**
 * Triage types — shared between frontend and backend
 */

export type TriagePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TriageDisasterType =
  | 'Flood'
  | 'Fire'
  | 'Earthquake'
  | 'Landslide'
  | 'Medical Emergency'
  | 'Trapped'
  | 'Building Collapse'
  | 'Unknown';

export interface TriageResult {
  incidentType: TriageDisasterType;
  location: string | null;         // extracted location, or null if unclear
  locationConfidence: 'high' | 'medium' | 'low';
  people: number | null;           // total number of people affected
  vulnerable: VulnerableDetails;
  dangerIndicators: string[];      // e.g. "Water level: first floor", "Fire spreading"
  medicalEmergency: boolean;
  requiredResources: string[];     // e.g. ["Evacuation", "Rescue Boat", "Medical Assistance"]
  priority: TriagePriority;
  priorityReasons: string[];       // human-readable reasons for the priority level
  rawMessage: string;              // the original message from the user
  parsedBy: 'gemini' | 'fallback'; // which parser produced this result
}

export interface VulnerableDetails {
  elderly: number;
  children: number;
  pregnant: number;
  disabled: number;
  injured: number;
}

export interface MatchedResource {
  id: string;
  name: string;
  address: string;
  type: string;
  distanceMiles: number;
  phone: string;
  status: string;
  tags: string[];
  relevanceReason: string; // why this resource was matched
}

export interface TriageResponse {
  triage: TriageResult;
  matchedResources: MatchedResource[];
  // If true, location needs clarification before we can reliably match resources
  needsLocationClarification: boolean;
}
