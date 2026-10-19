/**
 * Resource matching — given a triage result and region resources,
 * returns the most relevant resources sorted by relevance + distance.
 * Uses only bundled mock data — no external API.
 */

import type { Resource } from '@/types';
import type { TriageResult, MatchedResource } from '@/types/triage';

// Maps a required resource label to Resource types/tags
const RESOURCE_REQUIREMENT_MAP: Record<string, { types: string[]; tags: string[] }> = {
  'Evacuation':            { types: ['rescue'],                 tags: ['evacuation', 'boat rescue', 'swift-water', 'rope rescue'] },
  'Rescue Boat':           { types: ['rescue'],                 tags: ['boat rescue', 'swift-water', 'rescue boats'] },
  'Medical Assistance':    { types: ['hospital'],               tags: ['emergency', 'trauma', 'ambulance', 'medical', 'ems'] },
  'Food':                  { types: ['food'],                   tags: ['hot meals', 'langar', 'ration', 'meals'] },
  'Drinking Water':        { types: ['food'],                   tags: ['water', 'ors', 'clean water'] },
  'Emergency Shelter':     { types: ['shelter'],                tags: ['beds', 'shelter', 'accessible'] },
  'Fire Brigade':          { types: ['rescue'],                 tags: ['fire', 'noc', 'fire brigade'] },
  'Volunteers':            { types: ['rescue', 'shelter'],      tags: ['volunteers', 'transport', 'sandbagging'] },
  'Road Clearance':        { types: ['rescue'],                 tags: ['road clearing', 'heavy machinery', 'bro'] },
  'Emergency Assistance':  { types: ['rescue', 'hospital'],     tags: ['emergency'] },
  'Oxygen':                { types: ['hospital', 'pharmacy'],   tags: ['oxygen', 'medical'] },
};

export function matchResources(
  triage: TriageResult,
  resources: Resource[],
): MatchedResource[] {
  const scored: Array<{ resource: Resource; score: number; reason: string }> = [];
  const seen = new Set<string>();

  for (const req of triage.requiredResources) {
    const matcher = RESOURCE_REQUIREMENT_MAP[req] ?? { types: [], tags: [] };

    for (const resource of resources) {
      if (resource.status === 'closed') continue;

      let score = 0;
      let reason = '';

      // Type match
      if (matcher.types.includes(resource.type)) {
        score += 3;
        reason = `Provides ${req.toLowerCase()}`;
      }

      // Tag match
      const resourceTagsLower = resource.tags.map(t => t.toLowerCase());
      for (const tag of matcher.tags) {
        if (resourceTagsLower.some(rt => rt.includes(tag))) {
          score += 2;
          if (!reason) reason = `Has: ${resource.tags.find(t => t.toLowerCase().includes(tag))}`;
        }
      }

      // Open 24h bonus for critical/high priority
      if (resource.open24h && (triage.priority === 'CRITICAL' || triage.priority === 'HIGH')) {
        score += 1;
      }

      // Status bonus
      if (resource.status === 'open') score += 1;

      // Proximity bonus (closer is better)
      if (resource.distanceMiles <= 0.5) score += 3;
      else if (resource.distanceMiles <= 1.0) score += 2;
      else if (resource.distanceMiles <= 2.0) score += 1;

      if (score >= 3 && !seen.has(resource.id)) {
        seen.add(resource.id);
        scored.push({ resource, score, reason: reason || `Relevant for ${req}` });
      }
    }
  }

  // Also add hospitals if medical emergency
  if (triage.medicalEmergency) {
    for (const resource of resources) {
      if (resource.type === 'hospital' && resource.status !== 'closed' && !seen.has(resource.id)) {
        seen.add(resource.id);
        scored.push({ resource, score: 5, reason: 'Medical facility — emergency care available' });
      }
    }
  }

  // Sort: score desc, then distance asc
  scored.sort((a, b) => b.score - a.score || a.resource.distanceMiles - b.resource.distanceMiles);

  // Return top 6, formatted
  return scored.slice(0, 6).map(({ resource, reason }) => ({
    id: resource.id,
    name: resource.name,
    address: resource.address,
    type: resource.type,
    distanceMiles: resource.distanceMiles,
    phone: resource.phone,
    status: resource.status,
    tags: resource.tags,
    relevanceReason: reason,
  }));
}
