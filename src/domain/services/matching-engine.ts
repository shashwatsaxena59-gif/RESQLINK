/**
 * ResQLink Intelligent Matching Engine
 *
 * Evaluates compatibility between emergency aid requests, volunteer responders,
 * and community resource offers.
 *
 * Evaluation Criteria:
 * 1. Compatibility between requested and available resources/skills.
 * 2. Emergency severity and medical urgency.
 * 3. Geographic distance when reliable coordinates exist (shared Haversine, default 2-mile radius).
 * 4. Available quantity and current allocation bounds.
 * 5. Request age and outstanding status (preventing aid starvation).
 * 6. Volunteer availability and relevant skill certifications.
 *
 * Invariant: Never invent coordinates or distances when missing. Non-geographic
 * workflows are explicitly flagged with `isGeographicMatch: false`.
 * Matches are presented as advisory recommendations, not guaranteed rescue outcomes.
 */

import type { EmergencyRequest, RequestCategoryType, RequestSeverity, MedicalPriority } from '../models/emergency-request';
import type { Volunteer, VolunteerAvailability } from '../models/volunteer';
import type { ResourceOffer, OfferAvailabilityStatus } from '../models/resource-offer';
import { haversineDistanceMiles, isValidLatLng } from '../../lib/geo';

export const DEFAULT_MATCHING_RADIUS_MILES = 2.0;

export const ADVISORY_DISCLAIMER =
  'Advisory recommendation only. Volunteer matching and field dispatches are subject to on-the-ground conditions, dynamic hazards, and responder readiness. Rescue outcomes are not guaranteed.';

export type RecommendationConfidence = 'high' | 'medium' | 'low';

export interface CompatibilityFactor {
  factor: string;
  score: number;
  maxScore: number;
  details: string;
}

export interface MatchRecommendation {
  requestId: string;
  targetId: string; // volunteerId or resourceOfferId
  targetType: 'volunteer' | 'resource_offer';
  targetName: string;
  score: number; // 0 - 100
  confidence: RecommendationConfidence;
  isEligible: boolean;
  ineligibilityReason?: string;
  isGeographicMatch: boolean;
  distanceMiles: number | null;
  isWithinRadius: boolean;
  factors: CompatibilityFactor[];
  advisoryDisclaimer: string;
  timestamp: string;
}

export interface MatchingOptions {
  maxDistanceMiles?: number;
  requireGeographicMatch?: boolean;
  minScoreThreshold?: number;
}

// Category to Skill semantic relationships
const CATEGORY_SKILL_MAP: Record<RequestCategoryType, string[]> = {
  medical: ['first_aid', 'cpr', 'paramedic', 'nurse', 'doctor', 'triage', 'emt', 'medical'],
  rescue: ['search_and_rescue', 'water_rescue', 'boat_operator', 'firefighter', 'climbing', 'rescue'],
  evacuation: ['driver', '4x4_vehicle', 'transport', 'boat_operator', 'logistics', 'evacuation'],
  shelter: ['shelter_management', 'logistics', 'security', 'crowd_management', 'childcare', 'shelter'],
  food: ['food_distribution', 'cooking', 'logistics', 'packing', 'food'],
  water: ['water_purification', 'water_distribution', 'plumbing', 'logistics', 'water'],
  volunteers: ['coordination', 'crowd_management', 'communications', 'team_lead'],
  other: ['general_aid', 'translation', 'communications', 'supplies'],
};

// Category to Resource semantic keywords
const CATEGORY_RESOURCE_MAP: Record<RequestCategoryType, string[]> = {
  medical: ['first_aid_kit', 'bandage', 'antiseptic', 'medical_supplies', 'medicine', 'stretcher'],
  rescue: ['rope', 'life_jacket', 'boat', 'flashlight', 'harness', 'flotation'],
  evacuation: ['vehicle', 'truck', 'bus', 'fuel', 'transport', 'car'],
  shelter: ['blanket', 'sleeping_bag', 'tent', 'tarp', 'cot', 'mattress'],
  food: ['ready_to_eat_meals', 'canned_food', 'ration_pack', 'bread', 'rice', 'meals', 'baby_food'],
  water: ['bottled_water', 'drinking_water', 'purification_tablets', 'water_filter', 'water_gallon'],
  volunteers: ['safety_vest', 'gloves', 'radio', 'flashlight'],
  other: ['tools', 'batteries', 'power_bank', 'generator'],
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Calculates resource / skill compatibility score (0 - 30 points)
 */
function calculateSkillAndResourceCompatibility(
  request: EmergencyRequest,
  volunteerSkills: string[],
  volunteerOfferedResources: string[]
): { score: number; details: string } {
  let matchedPoints = 0;
  const matchedElements: string[] = [];
  const reqCategory = request.category;
  const relevantSkills = CATEGORY_SKILL_MAP[reqCategory] || [];
  const relevantResourceKeywords = CATEGORY_RESOURCE_MAP[reqCategory] || [];

  const normalizedVolunteerSkills = volunteerSkills.map(normalizeText);
  const normalizedVolunteerResources = volunteerOfferedResources.map(normalizeText);

  // 1. Check direct skill match for request category
  const skillMatches = normalizedVolunteerSkills.filter((skill) =>
    relevantSkills.some((rel) => skill.includes(rel) || rel.includes(skill))
  );

  if (skillMatches.length > 0) {
    matchedPoints += Math.min(18, skillMatches.length * 9);
    matchedElements.push(`Skills (${skillMatches.slice(0, 2).join(', ')})`);
  }

  // 2. Check requested resources against volunteer offered resources
  if (request.requiredResources && request.requiredResources.length > 0) {
    const matchedResources = request.requiredResources.filter((reqRes) => {
      const normReq = normalizeText(reqRes);
      return normalizedVolunteerResources.some(
        (off) =>
          off.includes(normReq) ||
          normReq.includes(off) ||
          (relevantResourceKeywords.some((keyword) => off.includes(keyword)) &&
            relevantResourceKeywords.some((keyword) => normReq.includes(keyword)))
      );
    });

    if (matchedResources.length > 0) {
      matchedPoints += Math.min(12, matchedResources.length * 6);
      matchedElements.push(`Resources (${matchedResources.slice(0, 2).join(', ')})`);
    }
  } else {
    // If no specific requiredResources listed, give general category alignment credit
    if (skillMatches.length > 0) {
      matchedPoints += 8;
    }
  }

  const finalScore = Math.min(30, matchedPoints);
  const details =
    matchedElements.length > 0
      ? `Matches found in: ${matchedElements.join('; ')} (+${finalScore} pts)`
      : 'General volunteer capability (+0 pts)';

  return { score: finalScore, details };
}

/**
 * Calculates severity and medical urgency score (0 - 25 points)
 */
function calculateUrgencyScore(
  severity: RequestSeverity,
  medicalPriority: MedicalPriority
): { score: number; details: string } {
  let severityScore = 0;
  switch (severity) {
    case 'critical':
      severityScore = 18;
      break;
    case 'urgent':
      severityScore = 12;
      break;
    case 'moderate':
      severityScore = 6;
      break;
    case 'low':
      severityScore = 2;
      break;
  }

  let medicalBonus = 0;
  switch (medicalPriority) {
    case 'immediate':
      medicalBonus = 7;
      break;
    case 'delayed':
      medicalBonus = 4;
      break;
    case 'minor':
      medicalBonus = 1;
      break;
    default:
      medicalBonus = 0;
      break;
  }

  const total = Math.min(25, severityScore + medicalBonus);
  const details = `Severity: ${severity} (${severityScore} pts) + Medical: ${medicalPriority} (${medicalBonus} pts)`;

  return { score: total, details };
}

/**
 * Calculates geographic distance score (0 - 25 points)
 * NEVER invents coordinates when missing.
 */
function calculateDistanceScore(
  reqLat: number | null,
  reqLng: number | null,
  targetLat: number | null,
  targetLng: number | null,
  maxRadiusMiles: number
): {
  score: number;
  distanceMiles: number | null;
  isGeographicMatch: boolean;
  isWithinRadius: boolean;
  details: string;
} {
  const hasReqCoords = isValidLatLng(reqLat, reqLng);
  const hasTargetCoords = isValidLatLng(targetLat, targetLng);

  if (!hasReqCoords || !hasTargetCoords) {
    // Missing location: do NOT invent distance!
    // Provide baseline non-geographic points so records are still considered in non-geographic queue.
    return {
      score: 10,
      distanceMiles: null,
      isGeographicMatch: false,
      isWithinRadius: true, // Non-geographic items pass through
      details: 'Non-geographic match: coordinates absent on request or responder (+10 pts baseline)',
    };
  }

  const distance = haversineDistanceMiles(reqLat as number, reqLng as number, targetLat as number, targetLng as number);
  const isWithinRadius = distance <= maxRadiusMiles;

  let score = 0;
  if (distance <= 0.5) {
    score = 25;
  } else if (distance <= 1.0) {
    score = 20;
  } else if (distance <= 2.0) {
    score = 15;
  } else if (distance <= 5.0) {
    score = 8;
  } else {
    score = 2;
  }

  const details = `Proximity: ${distance.toFixed(2)} mi (${score} pts, radius limit: ${maxRadiusMiles} mi)`;
  return {
    score,
    distanceMiles: Number(distance.toFixed(2)),
    isGeographicMatch: true,
    isWithinRadius,
    details,
  };
}

/**
 * Calculates request age / starvation prevention score (0 - 10 points)
 */
function calculateAgeScore(createdAt: string): { score: number; details: string } {
  const createdMs = new Date(createdAt).getTime();
  const nowMs = Date.now();
  const ageMinutes = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60)));

  let score = 0;
  if (ageMinutes >= 360) {
    // 6+ hours outstanding
    score = 10;
  } else if (ageMinutes >= 60) {
    // 1-6 hours
    score = 8;
  } else if (ageMinutes >= 15) {
    score = 5;
  } else {
    score = 2;
  }

  return {
    score,
    details: `Wait time: ${ageMinutes} min since broadcast (+${score} pts priority)`,
  };
}

/**
 * Calculates responder availability & status score (0 - 10 points)
 */
function calculateVolunteerAvailabilityScore(
  status: VolunteerAvailability
): { score: number; isEligible: boolean; details: string; reason?: string } {
  switch (status) {
    case 'available':
      return { score: 10, isEligible: true, details: 'Responder currently available (+10 pts)' };
    case 'on_mission':
      return {
        score: 3,
        isEligible: false,
        details: 'Responder is actively deployed on another mission',
        reason: 'Volunteer is currently engaged in an active mission.',
      };
    case 'offline':
      return {
        score: 1,
        isEligible: false,
        details: 'Responder is offline',
        reason: 'Volunteer is marked offline.',
      };
    case 'unavailable':
    default:
      return {
        score: 0,
        isEligible: false,
        details: 'Responder is unavailable',
        reason: 'Volunteer has marked their status as unavailable.',
      };
  }
}

/**
 * Evaluates match recommendation between an EmergencyRequest and a Volunteer responder.
 */
export function evaluateRequestVolunteerMatch(
  request: EmergencyRequest,
  volunteer: Volunteer,
  options: MatchingOptions = {}
): MatchRecommendation {
  const maxRadius = options.maxDistanceMiles ?? DEFAULT_MATCHING_RADIUS_MILES;

  // 1. Skill & Resource Compatibility (up to 30)
  const compat = calculateSkillAndResourceCompatibility(
    request,
    volunteer.skills || [],
    volunteer.offeredResources || []
  );

  // 2. Emergency Severity & Medical Urgency (up to 25)
  const urgency = calculateUrgencyScore(request.severity, request.medicalPriority);

  // 3. Geographic Distance (up to 25)
  const volLat = volunteer.locationSharingPermission && volunteer.coordinates ? volunteer.coordinates.latitude : null;
  const volLng = volunteer.locationSharingPermission && volunteer.coordinates ? volunteer.coordinates.longitude : null;
  const distanceInfo = calculateDistanceScore(request.latitude, request.longitude, volLat, volLng, maxRadius);

  // 4. Request Age (up to 10)
  const ageInfo = calculateAgeScore(request.createdAt);

  // 5. Volunteer Availability (up to 10)
  const availInfo = calculateVolunteerAvailabilityScore(volunteer.availabilityStatus);

  // Check overall eligibility
  let isEligible = availInfo.isEligible;
  let ineligibilityReason = availInfo.reason;

  if (request.status !== 'active') {
    isEligible = false;
    ineligibilityReason = `Emergency request is in status '${request.status}' and not open for new assignment.`;
  }

  if (options.requireGeographicMatch && !distanceInfo.isGeographicMatch) {
    isEligible = false;
    ineligibilityReason = 'Strict geographic matching required, but coordinates are unavailable.';
  }

  if (distanceInfo.isGeographicMatch && !distanceInfo.isWithinRadius) {
    isEligible = false;
    ineligibilityReason = `Distance (${distanceInfo.distanceMiles} mi) exceeds permitted matching radius of ${maxRadius} mi.`;
  }

  const rawScore = compat.score + urgency.score + distanceInfo.score + ageInfo.score + availInfo.score;
  const finalScore = Math.min(100, Math.max(0, rawScore));

  let confidence: RecommendationConfidence = 'low';
  if (finalScore >= 70 && distanceInfo.isWithinRadius && compat.score >= 12) {
    confidence = 'high';
  } else if (finalScore >= 45) {
    confidence = 'medium';
  }

  const factors: CompatibilityFactor[] = [
    { factor: 'Skills & Resources', score: compat.score, maxScore: 30, details: compat.details },
    { factor: 'Emergency Urgency', score: urgency.score, maxScore: 25, details: urgency.details },
    { factor: 'Proximity', score: distanceInfo.score, maxScore: 25, details: distanceInfo.details },
    { factor: 'Wait Time', score: ageInfo.score, maxScore: 10, details: ageInfo.details },
    { factor: 'Availability', score: availInfo.score, maxScore: 10, details: availInfo.details },
  ];

  return {
    requestId: request.id,
    targetId: volunteer.id,
    targetType: 'volunteer',
    targetName: volunteer.displayName || 'Volunteer Responder',
    score: finalScore,
    confidence,
    isEligible,
    ineligibilityReason,
    isGeographicMatch: distanceInfo.isGeographicMatch,
    distanceMiles: distanceInfo.distanceMiles,
    isWithinRadius: distanceInfo.isWithinRadius,
    factors,
    advisoryDisclaimer: ADVISORY_DISCLAIMER,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Evaluates match recommendation between an EmergencyRequest and a tangible ResourceOffer.
 */
export function evaluateRequestResourceMatch(
  request: EmergencyRequest,
  offer: ResourceOffer,
  options: MatchingOptions = {}
): MatchRecommendation {
  const maxRadius = options.maxDistanceMiles ?? DEFAULT_MATCHING_RADIUS_MILES;

  // 1. Resource Compatibility (up to 30)
  const normOfferType = normalizeText(offer.resourceType);
  const relevantKeywords = CATEGORY_RESOURCE_MAP[request.category] || [];
  let compatScore = 0;
  let compatDetails = '';

  const directReqMatch = (request.requiredResources || []).some((r) => {
    const norm = normalizeText(r);
    return normOfferType.includes(norm) || norm.includes(normOfferType);
  });

  const categoryKeywordMatch = relevantKeywords.some((k) => normOfferType.includes(k) || k.includes(normOfferType));

  if (directReqMatch) {
    compatScore = 30;
    compatDetails = `Direct match for requested resource '${offer.resourceType}' (+30 pts)`;
  } else if (categoryKeywordMatch) {
    compatScore = 20;
    compatDetails = `Category-aligned supply '${offer.resourceType}' (+20 pts)`;
  } else {
    compatScore = 5;
    compatDetails = `General emergency supply item (+5 pts)`;
  }

  // 2. Emergency Urgency (up to 25)
  const urgency = calculateUrgencyScore(request.severity, request.medicalPriority);

  // 3. Proximity (up to 25)
  const distanceInfo = calculateDistanceScore(
    request.latitude,
    request.longitude,
    offer.latitude ?? null,
    offer.longitude ?? null,
    maxRadius
  );

  // 4. Quantity and Allocation Balance (up to 10)
  const remaining = Math.max(0, offer.quantityAvailable - offer.quantityAllocated);
  let allocScore = 0;
  let isEligible = true;
  let ineligibilityReason: string | undefined;

  if (offer.availabilityStatus === 'fulfilled' || offer.availabilityStatus === 'withdrawn' || remaining <= 0) {
    allocScore = 0;
    isEligible = false;
    ineligibilityReason = `Resource offer has no remaining balance available (${remaining} ${offer.unit} remaining).`;
  } else if (remaining >= 10) {
    allocScore = 10;
  } else {
    allocScore = 6;
  }

  // 5. Request Age (up to 10)
  const ageInfo = calculateAgeScore(request.createdAt);

  if (request.status !== 'active') {
    isEligible = false;
    ineligibilityReason = `Request ${request.id} is already in status '${request.status}'.`;
  }

  if (options.requireGeographicMatch && !distanceInfo.isGeographicMatch) {
    isEligible = false;
    ineligibilityReason = 'Strict geographic matching required, but coordinates are unavailable.';
  }

  if (distanceInfo.isGeographicMatch && !distanceInfo.isWithinRadius) {
    isEligible = false;
    ineligibilityReason = `Resource location is ${distanceInfo.distanceMiles} mi away, exceeding radius limit of ${maxRadius} mi.`;
  }

  const rawScore = compatScore + urgency.score + distanceInfo.score + allocScore + ageInfo.score;
  const finalScore = Math.min(100, Math.max(0, rawScore));

  let confidence: RecommendationConfidence = 'low';
  if (finalScore >= 70 && isEligible) {
    confidence = 'high';
  } else if (finalScore >= 45) {
    confidence = 'medium';
  }

  const factors: CompatibilityFactor[] = [
    { factor: 'Resource Compatibility', score: compatScore, maxScore: 30, details: compatDetails },
    { factor: 'Emergency Urgency', score: urgency.score, maxScore: 25, details: urgency.details },
    { factor: 'Proximity', score: distanceInfo.score, maxScore: 25, details: distanceInfo.details },
    {
      factor: 'Remaining Balance',
      score: allocScore,
      maxScore: 10,
      details: `${remaining} ${offer.unit} available for allocation (+${allocScore} pts)`,
    },
    { factor: 'Wait Time', score: ageInfo.score, maxScore: 10, details: ageInfo.details },
  ];

  return {
    requestId: request.id,
    targetId: offer.id,
    targetType: 'resource_offer',
    targetName: `${offer.resourceType} (${remaining} ${offer.unit})`,
    score: finalScore,
    confidence,
    isEligible,
    ineligibilityReason,
    isGeographicMatch: distanceInfo.isGeographicMatch,
    distanceMiles: distanceInfo.distanceMiles,
    isWithinRadius: distanceInfo.isWithinRadius,
    factors,
    advisoryDisclaimer: ADVISORY_DISCLAIMER,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Finds top recommended volunteers for an emergency request, ranked by match score.
 */
export function findRecommendedVolunteersForRequest(
  request: EmergencyRequest,
  volunteers: Volunteer[],
  options: MatchingOptions = {}
): MatchRecommendation[] {
  const minScore = options.minScoreThreshold ?? 0;

  return volunteers
    .map((v) => evaluateRequestVolunteerMatch(request, v, options))
    .filter((rec) => rec.score >= minScore)
    .sort((a, b) => {
      // Prioritize eligible first, then higher score, then closer distance
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.distanceMiles !== null && b.distanceMiles !== null) {
        return a.distanceMiles - b.distanceMiles;
      }
      return 0;
    });
}

/**
 * Finds top recommended requests for a specific volunteer responder.
 */
export function findRecommendedRequestsForVolunteer(
  volunteer: Volunteer,
  requests: EmergencyRequest[],
  options: MatchingOptions = {}
): MatchRecommendation[] {
  const minScore = options.minScoreThreshold ?? 0;

  return requests
    .map((req) => evaluateRequestVolunteerMatch(req, volunteer, options))
    .filter((rec) => rec.score >= minScore)
    .sort((a, b) => {
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.distanceMiles !== null && b.distanceMiles !== null) {
        return a.distanceMiles - b.distanceMiles;
      }
      return 0;
    });
}

/**
 * Finds top recommended resource offers for an emergency request.
 */
export function findRecommendedResourcesForRequest(
  request: EmergencyRequest,
  offers: ResourceOffer[],
  options: MatchingOptions = {}
): MatchRecommendation[] {
  const minScore = options.minScoreThreshold ?? 0;

  return offers
    .map((offer) => evaluateRequestResourceMatch(request, offer, options))
    .filter((rec) => rec.score >= minScore)
    .sort((a, b) => {
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return 0;
    });
}
