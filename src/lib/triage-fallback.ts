/**
 * Offline triage fallback parser
 * Extracts structured emergency information from natural-language messages
 * using regex + keyword matching. Works without any API or internet.
 *
 * Supports English, Hindi, and Hinglish.
 */

import type {
  TriageResult,
  TriagePriority,
  TriageDisasterType,
  VulnerableDetails,
} from '@/types/triage';

// ─────────────────────────────────────────────────────────────────────────────
// Keyword dictionaries
// ─────────────────────────────────────────────────────────────────────────────

const DISASTER_KEYWORDS: Record<TriageDisasterType, string[]> = {
  Flood: [
    'flood', 'flooding', 'pani', 'paani', 'baarish', 'barsh', 'yamuna', 'river',
    'water rising', 'waterlogged', 'submerged', 'bah', 'baadh', 'barha', 'overflowing',
    'flash flood', 'inundation', 'water level', 'pani chada', 'paani bhar gaya',
  ],
  Fire: [
    'fire', 'aag', 'jal raha', 'burning', 'smoke', 'dhuan', 'flames', 'inferno',
    'blast', 'explosion', 'gas leak',
  ],
  Earthquake: [
    'earthquake', 'bhukamp', 'quake', 'tremor', 'shaking', 'building collapsed',
    'ground shaking', 'after shock', 'seismic',
  ],
  Landslide: [
    'landslide', 'mudslide', 'bhuskhalan', 'rockfall', 'debris', 'pahad', 'slope',
    'road blocked', 'mountain', 'hill', 'avalanche',
  ],
  'Medical Emergency': [
    'heart attack', 'dil', 'hospital', 'doctor', 'medicine', 'oxygen', 'breathing',
    'unconscious', 'behosh', 'diabetic', 'sugar', 'blood pressure', 'bp', 'dialysis',
    'pregnant', 'delivery', 'prasav', 'injury', 'chot', 'wound', 'bleeding',
    'ambulance', 'ems', 'medical', 'sick', 'bimar', 'ill',
  ],
  Trapped: [
    'trapped', 'phas gaye', 'phas gaya', 'phas gayi', 'stuck', 'cannot move',
    'cannot escape', 'nikalna nahi', 'bahar nahi nikal', 'trapped inside',
    'basement', 'rubble', 'debris', 'under', 'stuck under',
  ],
  'Building Collapse': [
    'building collapsed', 'imarat giri', 'collapse', 'caved in', 'fallen',
    'wall collapsed', 'roof collapsed', 'deewar giri', 'structure',
  ],
  Unknown: [],
};

const NCR_LOCATIONS = [
  'yamuna', 'yamuna bank', 'delhi', 'ncr', 'noida', 'gurgaon', 'gurugram',
  'faridabad', 'ghaziabad', 'mayur vihar', 'laxmi nagar', 'shakarpur',
  'seelampur', 'geeta colony', 'wazirabad', 'chandni chowk', 'ito',
  'nizamuddin', 'okhla', 'badarpur', 'shahdara', 'preet vihar',
];

const CHAMOLI_LOCATIONS = [
  'joshimath', 'chamoli', 'badrinath', 'govindghat', 'tapovan', 'helang',
  'auli', 'pandukeshwar', 'ghangaria', 'hemkund', 'selang', 'mana',
  'pipalkoti', 'uttarakhand', 'garhwal', 'himalaya', 'pahad',
];

// ─────────────────────────────────────────────────────────────────────────────
// Number extraction — handles digits and common words
// ─────────────────────────────────────────────────────────────────────────────
const NUMBER_WORDS: Record<string, number> = {
  'ek': 1, 'ek hi': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
};

function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const raw = m[1]?.toLowerCase().trim();
      if (!raw) continue;
      const n = parseInt(raw, 10);
      if (!isNaN(n)) return n;
      if (NUMBER_WORDS[raw] !== undefined) return NUMBER_WORDS[raw];
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────
export function parseEmergencyMessage(
  message: string,
  region: 'ncr' | 'badrinath' | string = 'ncr',
): Omit<TriageResult, 'rawMessage' | 'parsedBy'> {
  const text   = message.toLowerCase();

  // ── 1. Incident type ──────────────────────────────────────────────────────
  let incidentType: TriageDisasterType = 'Unknown';
  let bestScore = 0;

  for (const [type, kws] of Object.entries(DISASTER_KEYWORDS) as [TriageDisasterType, string[]][]) {
    if (type === 'Unknown') continue;
    const score = kws.filter(kw => text.includes(kw)).length;
    if (score > bestScore) { bestScore = score; incidentType = type; }
  }

  // Prefer Trapped over Flood when both match (trapped is more urgent)
  if (incidentType === 'Flood') {
    const trappedScore = DISASTER_KEYWORDS['Trapped'].filter(kw => text.includes(kw)).length;
    if (trappedScore >= 1) incidentType = 'Trapped';
  }

  // ── 2. Location ───────────────────────────────────────────────────────────
  let location: string | null = null;
  let locationConfidence: 'high' | 'medium' | 'low' = 'low';

  const locationList = region === 'ncr' ? NCR_LOCATIONS : CHAMOLI_LOCATIONS;
  for (const loc of locationList) {
    if (text.includes(loc)) {
      // Capitalise properly
      location = loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      locationConfidence = 'high';
      break;
    }
  }

  // If no known location found, try to extract near/paas/at patterns
  if (!location) {
    const locPatterns = [
      /(?:near|paas|at|in|ke paas|ke nazdeek)\s+([\w\s]{3,30}?)(?:\s+mein|\s+par|\s+pe|,|\.)/i,
      /(?:location|jagah|sthan)[:\s]+([\w\s]{3,30}?)(?:,|\.|\s+mein)/i,
    ];
    for (const re of locPatterns) {
      const m = message.match(re);
      if (m?.[1]) {
        location = m[1].trim();
        locationConfidence = 'medium';
        break;
      }
    }
  }

  // Fall back to region label if nothing found
  if (!location) {
    location = region === 'ncr' ? 'Delhi NCR (unspecified)' : 'Chamoli Region (unspecified)';
    locationConfidence = 'low';
  }

  // ── 3. People count ───────────────────────────────────────────────────────
  const people = extractNumber(text, [
    /(\d+)\s*(?:log|logo|logon|people|persons?|family members?|members?)/i,
    /(?:hum|we are|total)\s+(\w+)\s+(?:log|people|persons?)/i,
    /(\w+)\s+(?:log|people|persons?)\s+(?:hain|hai|are|here)/i,
    /(\d+)\s+(?:of us|individuals?)/i,
  ]);

  // ── 4. Vulnerable people ──────────────────────────────────────────────────
  const vulnerable: VulnerableDetails = { elderly: 0, children: 0, pregnant: 0, disabled: 0, injured: 0 };

  // Elderly
  const elderlyKws = /(?:elderly|bujurg|old person|aged|senior citizen|budhaa|budhi)/i;
  if (elderlyKws.test(text)) {
    const n = extractNumber(text, [/(\d+|\w+)\s*(?:elderly|bujurg|old person)/i]) ?? 1;
    vulnerable.elderly = n;
  }

  // Children
  const childKws = /(?:children|child|kids?|bachcha|bacche|bacchi|bachchi|minor|infant|baby|bacha)/i;
  if (childKws.test(text)) {
    const n = extractNumber(text, [/(\d+|\w+)\s*(?:children|kids?|bacche)/i]) ?? 1;
    vulnerable.children = n;
  }

  // Pregnant
  if (/(?:pregnant|garbhwati|pregnancy)/i.test(text)) {
    vulnerable.pregnant = 1;
  }

  // Disabled
  if (/(?:disabled|handicapped|divyang|wheelchair|viklang)/i.test(text)) {
    vulnerable.disabled = 1;
  }

  // Injured
  const injuryKws = /(?:injured|injury|hurt|chot|wound|bleeding|fracture|broken bone|unconscious|behosh)/i;
  if (injuryKws.test(text)) {
    const n = extractNumber(text, [/(\d+|\w+)\s*(?:injured|hurt|chot)/i]) ?? 1;
    vulnerable.injured = n;
  }

  // ── 5. Danger indicators ─────────────────────────────────────────────────
  const dangerIndicators: string[] = [];

  // Water level indicators
  if (/water.{0,20}(?:first floor|ground floor|basement|neck|knee|waist)/i.test(text)) {
    const m = text.match(/water.{0,20}(first floor|ground floor|basement|neck|knee|waist)/i);
    if (m) dangerIndicators.push(`Water level: ${m[1]}`);
  }
  if (/pani.{0,20}(?:pehli manzil|first floor|bhoom|basement)/i.test(text)) {
    dangerIndicators.push('Water level rising — first floor');
  }
  if (/(?:rising|badh raha|tez|rapidly|fast)/i.test(text) && incidentType === 'Flood') {
    dangerIndicators.push('Water rising rapidly');
  }
  if (/no (?:boat|rescue|access|road)/i.test(text)) {
    dangerIndicators.push('No rescue/boat access currently');
  }
  if (/road blocked|rasta band/i.test(text)) {
    dangerIndicators.push('Road blocked');
  }
  if (/power out|bijli nahi|no electricity/i.test(text)) {
    dangerIndicators.push('Power outage');
  }
  if (/building collapsed|imarat giri|structure collapsed/i.test(text)) {
    dangerIndicators.push('Structural collapse');
  }
  if (/smoke|dhuan/i.test(text)) {
    dangerIndicators.push('Heavy smoke present');
  }

  // ── 6. Medical emergency ─────────────────────────────────────────────────
  const medicalEmergency =
    incidentType === 'Medical Emergency' ||
    vulnerable.injured > 0 ||
    /(?:hospital|ambulance|oxygen|unconscious|behosh|dialysis|heart|dil dard|bleeding|prasav|delivery)/i.test(text);

  // ── 7. Required resources ────────────────────────────────────────────────
  const requiredResources: string[] = [];

  if (/(?:trapped|phas gaye|stuck|cannot escape)/i.test(text)) requiredResources.push('Evacuation');
  if (/(?:flood|water|pani|paani|boat|naav)/i.test(text)) requiredResources.push('Rescue Boat');
  if (medicalEmergency || vulnerable.injured > 0) requiredResources.push('Medical Assistance');
  if (/(?:food|khana|roti|bhojan|hungry|bhookha)/i.test(text)) requiredResources.push('Food');
  if (/(?:water|paani|thirsty|pyaas|clean water)/i.test(text) && incidentType !== 'Flood') requiredResources.push('Drinking Water');
  if (/(?:shelter|ghar|raat|overnight|tent)/i.test(text)) requiredResources.push('Emergency Shelter');
  if (/(?:fire|aag|flames)/i.test(text)) requiredResources.push('Fire Brigade');
  if (/(?:volunteer|help|madad|sahayak)/i.test(text)) requiredResources.push('Volunteers');
  if (/(?:landslide|debris|road blocked)/i.test(text)) requiredResources.push('Road Clearance');
  if (vulnerable.elderly > 0 || vulnerable.children > 0 || vulnerable.disabled > 0) {
    if (!requiredResources.includes('Medical Assistance')) requiredResources.push('Medical Assistance');
  }
  // Ensure at least one resource
  if (requiredResources.length === 0) requiredResources.push('Emergency Assistance');

  // ── 8. Priority ──────────────────────────────────────────────────────────
  const priorityReasons: string[] = [];
  let priority: TriagePriority = 'LOW';
  let score = 0;

  if (people !== null && people >= 3) { score += 2; priorityReasons.push(`${people} people affected`); }
  else if (people !== null && people >= 1) { score += 1; priorityReasons.push(`${people} person(s) affected`); }

  if (vulnerable.elderly > 0)  { score += 3; priorityReasons.push(`${vulnerable.elderly} elderly person(s) present`); }
  if (vulnerable.children > 0) { score += 3; priorityReasons.push(`${vulnerable.children} child/children present`); }
  if (vulnerable.pregnant > 0) { score += 3; priorityReasons.push('Pregnant person present'); }
  if (vulnerable.disabled > 0) { score += 2; priorityReasons.push('Person with disability present'); }
  if (vulnerable.injured > 0)  { score += 3; priorityReasons.push(`${vulnerable.injured} injured person(s)`); }

  if (incidentType === 'Trapped' || /trapped|phas gaye/i.test(text)) {
    score += 4; priorityReasons.push('Person(s) trapped — immediate evacuation required');
  }
  if (dangerIndicators.some(d => d.toLowerCase().includes('floor') || d.toLowerCase().includes('rising'))) {
    score += 3; priorityReasons.push('Flood water at dangerous level');
  }
  if (dangerIndicators.some(d => d.toLowerCase().includes('collapse'))) {
    score += 4; priorityReasons.push('Structural collapse present');
  }
  if (incidentType === 'Fire') { score += 3; priorityReasons.push('Active fire'); }
  if (incidentType === 'Earthquake') { score += 3; priorityReasons.push('Earthquake reported'); }
  if (medicalEmergency && incidentType !== 'Medical Emergency') {
    score += 2; priorityReasons.push('Medical emergency indicators present');
  }
  if (requiredResources.includes('Evacuation')) { score += 2; }

  if (score >= 8)      priority = 'CRITICAL';
  else if (score >= 5) priority = 'HIGH';
  else if (score >= 2) priority = 'MEDIUM';
  else                 priority = 'LOW';

  if (priorityReasons.length === 0) priorityReasons.push('Assistance requested');

  return {
    incidentType,
    location,
    locationConfidence,
    people,
    vulnerable,
    dangerIndicators,
    medicalEmergency,
    requiredResources,
    priority,
    priorityReasons,
  };
}
