/**
 * Offline Help Bot Knowledge Base
 * Bundled locally — works 100% without internet.
 *
 * Two-layer matching:
 *  1. Static KB entries (disaster safety, app help)
 *  2. Dynamic data answers built at runtime from region data (shelters, resources, requests)
 */

import type { Shelter, Resource, AidRequest } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// STATIC KB
// ─────────────────────────────────────────────────────────────────────────────
export interface KbEntry {
  id: string;
  keywords: string[];
  question: string;
  answer: string;
}

export const OFFLINE_KB: KbEntry[] = [

  // ── APP HELP ────────────────────────────────────────────────────────────────
  {
    id: 'app-what',
    keywords: ['what','app','does','application','resqlink','purpose','about'],
    question: 'What does this app do?',
    answer: `**ResQLink** is an offline-first disaster-management app. It helps you:
• 🗺️ View disaster maps for Yamuna Bank (Delhi NCR) and Chamoli (Uttarakhand)
• 🏠 Find emergency shelters and check available beds
• 🍽️ Locate food, water, and medical assistance points
• 🚨 Submit SOS help requests even without internet
• 🤝 Offer help or resources to people in your area
• 🤖 Get disaster safety guidance from this assistant

Switch regions using the **"Map Region"** button in the header.`,
  },
  {
    id: 'app-map',
    keywords: ['map','use','navigate','how','zoom','legend','layers','marker'],
    question: 'How do I use the map?',
    answer: `**Using the map:**
1. The map loads automatically for your selected region.
2. Use **+/−** buttons on the right to zoom in and out.
3. Tap the **crosshair** icon to re-centre on the region.
4. Tap the **GPS/Locate** button to show your current position.
5. Tap the **Layers** icon to toggle flood zones, landslides, shelters, roads.
6. Tap any pin/marker to see full details — capacity, phone, amenities.
7. The map works fully **offline** — no internet needed.`,
  },
  {
    id: 'app-switch',
    keywords: ['switch','region','change','yamuna','chamoli','ncr','delhi','uttarakhand','select','badrinath'],
    question: 'How do I switch regions?',
    answer: `**Switching between regions:**
1. Look at the **header area** below the top navigation bar.
2. Find the **"Map Region"** button on the right side of the header.
3. Click it to open the region selector dropdown.
4. Choose **"Delhi NCR"** (Yamuna Bank/Faridabad area) or **"Badrinath / Joshimath"** (Chamoli, Uttarakhand).
5. The map, shelters, resources, aid requests, and all data update instantly.`,
  },
  {
    id: 'app-shelter-how',
    keywords: ['find','shelter','beds','available','sleep','stay','night','capacity','housing','where shelter'],
    question: 'How do I find a shelter?',
    answer: `**Finding a shelter:**
1. Tap the **"Shelter"** button in the top navigation bar.
2. A panel opens showing all shelters for your current region.
3. Each shelter shows name, address, available beds, and amenities.
4. Shelters marked **FULL** have no free beds right now.
5. Tap **"Get Directions"** to navigate there via Google Maps.

You can also ask me: *"How many shelter beds are available?"* and I'll tell you the current count from the app data.`,
  },
  {
    id: 'app-food-water',
    keywords: ['food','water','eat','drink','hungry','thirsty','ration','meal','clean water','where food'],
    question: 'How do I find food or water?',
    answer: `**Finding food and water:**
1. Tap **"Find Help"** in the top navigation bar.
2. Select the **Food** filter chip at the top of the panel.
3. All food distribution and water points for your region are listed.
4. Each entry shows location, phone, and what is available (hot meals, ORS, water cans, etc.).
5. Tap **"Directions"** to navigate there.`,
  },
  {
    id: 'app-medical',
    keywords: ['medical','hospital','doctor','medicine','ambulance','health','injury','hurt','sick','ill','clinic','health centre'],
    question: 'How do I find medical help?',
    answer: `**Finding medical help:**
1. Tap **"Find Help"** in the top navigation bar.
2. Select the **Hospital** filter chip.
3. Hospitals, clinics, and first-aid posts for your region are shown.
4. Each entry shows address, phone, and whether it is open 24 hours.
5. For life-threatening emergencies — **call 112 immediately**.`,
  },
  {
    id: 'app-sos',
    keywords: ['sos','request','help','submit','need','send','create','ask','emergency request','report'],
    question: 'How do I submit an SOS / help request?',
    answer: `**Submitting a help request:**
1. Tap the red **SOS** button in the top navigation bar.
2. Select the type of help needed: Medical, Food & Water, Shelter, Volunteers, or Rescue.
3. Describe your situation clearly in the text box.
4. List specific items needed (optional but helpful).
5. Add your contact name and phone number.
6. Tap the **GPS** button to auto-detect your location.
7. Tap **Submit** — your request appears live on the feed for nearby responders.
8. **Offline?** The request is saved locally and sent automatically when you reconnect.`,
  },
  {
    id: 'app-offer',
    keywords: ['offer','volunteer','provide','give','donate','help others','i have','offer help'],
    question: 'How do I offer help?',
    answer: `**Offering help to others:**
1. Tap **"Offer Help"** in the top navigation bar.
2. Select the category: Food, Water, Shelter space, Medical, Transport, Rescue, or Other.
3. Write a short title and description of what you can offer.
4. Add quantity, your area/location, and contact details.
5. Tap **Post Offer** — it becomes visible to others in your region.`,
  },
  {
    id: 'app-offline',
    keywords: ['offline','no internet','no wifi','no network','without internet','works offline'],
    question: 'Does this app work without internet?',
    answer: `**Yes — ResQLink is built offline-first:**
• The map works completely without internet (all map data is bundled locally).
• All shelter, resource, and aid request data loads offline.
• SOS requests are saved locally and sync automatically when you reconnect.
• This Help Bot answers safety questions without internet.
• **Only Gemini AI** (advanced answers) requires internet — the offline assistant always works.`,
  },

  // ── DISASTER SAFETY ─────────────────────────────────────────────────────────
  {
    id: 'earthquake',
    keywords: ['earthquake','tremor','shaking','quake','seismic','bhukamp','bhucamp'],
    question: 'What should I do during an earthquake?',
    answer: `**Earthquake — DROP, COVER, HOLD ON:**
1. **DROP** to your hands and knees immediately.
2. **COVER** your head and neck under a sturdy table, or against an interior wall away from windows.
3. **HOLD ON** until shaking completely stops — do not run.
4. Stay away from windows, heavy shelves, and objects that can fall.
5. Do NOT run outside during shaking — falling debris is most dangerous near exits.
6. After shaking stops — check for injuries, then carefully move to open ground.
7. Expect aftershocks. Follow official instructions from authorities.`,
  },
  {
    id: 'flood',
    keywords: ['flood','flooding','water rising','submerge','baarish','barsat','rain','overflow','yamuna','river','flash flood','flood water'],
    question: 'What should I do during a flood?',
    answer: `**During a flood:**
1. **Move to higher ground immediately** if told to — do not wait to see how bad it gets.
2. **Never walk through moving floodwater** — even ankle-deep water can knock you down.
3. **Never drive through flooded roads** — turn around, don't drown.
4. Stay away from electrical equipment, power lines, and damaged infrastructure.
5. Avoid drains, manholes, and gutters — fast water pulls people under.
6. If trapped on a lower floor — move to the highest floor and signal for help from a window.
7. Follow evacuation orders from NDRF, SDRF, or local authorities immediately.`,
  },
  {
    id: 'landslide',
    keywords: ['landslide','mudslide','rockfall','slope','debris','chamoli','pahad','mountain','hill','bhuskhalan','slide'],
    question: 'What should I do during a landslide?',
    answer: `**During a landslide:**
1. **Move away from the slope immediately** — get to flat, open ground perpendicular to the slide.
2. Do NOT go back toward the slope even after it stops — more material can follow.
3. Avoid roads near affected slopes — they may be blocked or structurally unsafe.
4. Stay away from cracked buildings near the slide area.
5. If you cannot escape — curl tightly and protect your head with your arms.
6. After the slide: stay at a safe distance, check for injuries, alert rescuers.
7. Follow SDRF, NDRF, or local authority evacuation instructions.`,
  },
  {
    id: 'fire',
    keywords: ['fire','aag','smoke','burning','extinguisher','flames','blaze','fire safety'],
    question: 'What should I do during a fire?',
    answer: `**During a fire:**
1. **Raise the alarm** — shout and alert everyone nearby immediately.
2. **Evacuate first** — your life is more important than property.
3. Crawl low under smoke — cleaner air stays near the floor.
4. Touch doors before opening: if hot, do NOT open. Find another exit.
5. Close doors behind you to slow the fire's spread.
6. **Fire extinguisher** — only for a **small, contained** fire:
   • Use the correct type (check the label on the extinguisher).
   • Stand with an exit behind you.
   • **PASS**: Pull pin → Aim low at the base → Squeeze handle → Sweep side to side.
   • If the fire grows or smoke increases — evacuate immediately.
7. Call **101** (Fire) or **112** (Emergency) once safely outside.`,
  },
  {
    id: 'evacuation',
    keywords: ['evacuate','evacuation','leave','escape','route','exit','safe zone','how to evacuate'],
    question: 'How do I evacuate safely?',
    answer: `**Safe evacuation:**
1. Follow instructions from NDRF, SDRF, police, or local authorities.
2. Take your emergency kit if safe to grab quickly (30 seconds max).
3. Use **designated safe routes** — avoid unknown shortcuts.
4. Do NOT use elevators during earthquakes or fires — use stairs.
5. Help elderly, children, and people with disabilities near you if safe to do so.
6. Move to the designated **assembly point** or safe zone.
7. Do NOT return to the area until authorities officially declare it safe.`,
  },
  {
    id: 'kit',
    keywords: ['kit','bag','emergency','supplies','pack','prepare','ready','essentials','stock','emergency bag'],
    question: 'What should I keep in an emergency kit?',
    answer: `**Basic Emergency Kit — keep these ready:**
• 💧 **Water** — 3+ litres per person per day (3-day supply minimum)
• 🍱 **Non-perishable food** — biscuits, dry fruits, canned food (3-day supply)
• 🩹 **First-aid kit** — bandages, antiseptic, pain relievers, scissors, gloves
• 🔦 **Flashlight + batteries** or a hand-crank torch
• 🔋 **Power bank** — keep it fully charged for your phone
• 💊 **Essential medicines** — 1-week supply of any daily medication
• 📄 **Important documents** — Aadhaar, ID, insurance, bank details (waterproof bag or phone photos)
• 📻 **Battery-powered radio** — for official news during power cuts
• 🧥 **Warm clothing and blanket** — especially critical in Chamoli/mountain regions
• 💰 **Some cash** — digital payments may not work during disasters`,
  },
  {
    id: 'first-aid',
    keywords: ['first aid','firstaid','wound','bleeding','cut','fracture','broken bone','burn','cpr','unconscious','injury'],
    question: 'Basic first-aid guidance',
    answer: `**Basic First Aid (always get professional help as soon as possible):**

**Bleeding wound:**
Apply firm, steady pressure with a clean cloth. Do not remove it. Keep pressing for 10+ minutes.

**Fracture / broken bone:**
Do NOT try to straighten it. Immobilise with a splint or padding. Get medical help immediately.

**Burns:**
Cool with running water for 10–20 minutes. Do NOT use ice, butter, or toothpaste. Cover loosely with a clean cloth.

**Unconscious person not breathing:**
Call 112 immediately. Start CPR if you are trained.

**Altitude sickness (Chamoli/mountain regions):**
Descend immediately to a lower altitude. Give oxygen if available. This can be life-threatening — get medical help urgently.

⚠️ These are basic tips only. Always seek professional medical care as soon as it is accessible.`,
  },
  {
    id: 'glof',
    keywords: ['glof','glacier','glacier lake','outburst','cloudburst','cloud burst','flash flood','tapovan','rishiganga','glacial'],
    question: 'What is a GLOF (Glacier Lake Outburst Flood)?',
    answer: `**GLOF — Glacier Lake Outburst Flood:**
A sudden, massive release of water from a glacial lake. It creates a devastating flash flood with very little warning (sometimes under 30 minutes).

**If you are in Chamoli / Joshimath:**
1. If you hear a **loud roaring sound from upriver** — move to HIGH GROUND immediately. Do not wait.
2. Move **away from the river valley** — perpendicular to the water flow.
3. Alert everyone around you as you move.
4. Do not try to collect belongings.
5. Stay on high ground until NDRF/SDRF give the official all-clear.
6. Listen to official warnings on radio or government channels.

The February 2021 Chamoli disaster was caused by a GLOF that destroyed the Tapovan-Vishnugad Power Plant.`,
  },
  {
    id: 'altitude',
    keywords: ['altitude','ams','hace','hape','mountain sickness','breathless','headache','oxygen','high altitude','altitude sick'],
    question: 'What are the signs of altitude sickness?',
    answer: `**Altitude Sickness — Signs and Action:**

**Mild AMS (Acute Mountain Sickness):**
Headache, nausea, fatigue, dizziness, poor sleep.
→ Stop ascending. Rest at current altitude. Drink water.

**Severe HACE — brain swelling (EMERGENCY):**
Confusion, loss of coordination, cannot walk straight, loss of consciousness.
→ **Descend immediately.** Give oxygen. Call for helicopter evacuation.

**Severe HAPE — fluid in lungs (EMERGENCY):**
Extreme breathlessness at rest, bluish lips, coughing frothy/pink mucus.
→ **Descend immediately.** Give oxygen. Call 112. This is life-threatening.

⚠️ The only reliable treatment for severe altitude sickness is **immediate descent to a lower altitude**.`,
  },
  {
    id: 'subsidence',
    keywords: ['subsidence','crack','cracked building','joshimath','sinking','ground crack','building crack'],
    question: 'What should I do about land subsidence (cracked buildings)?',
    answer: `**Land Subsidence / Cracked Buildings (Joshimath area):**
1. If your building has visible cracks — **vacate immediately** and do not re-enter.
2. Report cracks to the local SDM office or SDRF: **01389-222030**.
3. Move to an official relief camp — ITBP Camp or Govt Inter College, Joshimath.
4. Do not enter buildings marked with red/orange tags by authorities.
5. Keep your important documents and medicines with you at all times.
6. Follow evacuation orders from the District Administration without delay.

The Joshimath subsidence (ongoing since 2023) has affected 800+ structures. Do not take risks with cracked buildings.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUGGESTED QUESTIONS (shown as chips in the chat UI)
// ─────────────────────────────────────────────────────────────────────────────
export const SUGGESTED_QUESTIONS = [
  'What does this app do?',
  'How many shelter beds are available?',
  'What should I do during a flood?',
  'What should I do during an earthquake?',
  'Where can I find medical help?',
  'How do I submit an SOS request?',
  'What should I keep in an emergency kit?',
  'How do I switch regions?',
];

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC DATA ANSWER BUILDER
// Uses actual region data to answer resource questions at runtime
// ─────────────────────────────────────────────────────────────────────────────
export interface RegionContext {
  locationLabel: string;
  shelters: Shelter[];
  resources: Resource[];
  requests: AidRequest[];
}

function isAskingAboutShelters(q: string) {
  return /shelter|bed|sleep|stay|night|capacity|housing|beds available|how many bed/i.test(q);
}
function isAskingAboutFood(q: string) {
  return /food|water|eat|drink|hungry|thirsty|ration|meal|where.*food|where.*water|langar/i.test(q);
}
function isAskingAboutMedical(q: string) {
  return /hospital|doctor|medical|clinic|health|medicine|ambulance|pharmacy|first.?aid|sick|hurt|injured/i.test(q);
}
function isAskingAboutRescue(q: string) {
  return /rescue|ndrf|sdrf|emergency.*team|search.*rescue|evacuat|helipad|helicopter/i.test(q);
}
function isAskingAboutRequests(q: string) {
  return /request|sos.*list|active.*request|who needs|help request|pending request/i.test(q);
}

function shelterAnswer(ctx: RegionContext): string {
  const { shelters, locationLabel } = ctx;
  if (!shelters.length) return `No shelter data is currently loaded for **${locationLabel}**.`;

  const open   = shelters.filter(s => s.status !== 'full');
  const total  = shelters.reduce((n, s) => n + s.capacity, 0);
  const occ    = shelters.reduce((n, s) => n + s.occupied, 0);
  const avail  = total - occ;

  const lines = shelters.map(s => {
    const free = s.capacity - s.occupied;
    const pct  = Math.round((s.occupied / s.capacity) * 100);
    const tag  = s.status === 'full' ? '🔴 FULL' : free <= 10 ? '🟡 LIMITED' : '🟢 OPEN';
    return `  • **${s.name}** — ${tag} · ${free} beds free (${pct}% occupied)\n    📍 ${s.address}`;
  }).join('\n');

  return `**Shelters in ${locationLabel}** (${open.length} open / ${shelters.length} total):

${lines}

**Total available beds: ${avail} / ${total}**

To navigate to a shelter, tap **"Shelter"** in the top navigation bar and use "Get Directions".`;
}

function foodAnswer(ctx: RegionContext): string {
  const { resources, locationLabel } = ctx;
  const foodPoints = resources.filter(r => r.type === 'food');
  if (!foodPoints.length) return `No food/water distribution points found for **${locationLabel}** in the current data. Check the "Find Help" panel for the latest information.`;

  const lines = foodPoints.map(r =>
    `  • **${r.name}** (${r.status.toUpperCase()})\n    📍 ${r.address}\n    ☎ ${r.phone}\n    🏷️ ${r.tags.join(' · ')}`
  ).join('\n');

  return `**Food & Water points in ${locationLabel}:**

${lines}

Tap **"Find Help"** → select the **Food** filter for full details and directions.`;
}

function medicalAnswer(ctx: RegionContext): string {
  const { resources, locationLabel } = ctx;
  const medPoints = resources.filter(r => r.type === 'hospital' || r.type === 'pharmacy');
  if (!medPoints.length) return `No medical facilities found for **${locationLabel}** in the current data. For emergencies call **112**.`;

  const lines = medPoints.map(r =>
    `  • **${r.name}** — ${r.open24h ? '🕐 24/7' : 'Limited hours'} · ${r.status.toUpperCase()}\n    📍 ${r.address}\n    ☎ ${r.phone}\n    🏷️ ${r.tags.join(' · ')}`
  ).join('\n');

  return `**Medical facilities in ${locationLabel}:**

${lines}

🚨 For life-threatening emergencies call **112** immediately.

Tap **"Find Help"** → select the **Hospital** filter for directions.`;
}

function rescueAnswer(ctx: RegionContext): string {
  const { resources, locationLabel } = ctx;
  const rescuePoints = resources.filter(r => r.type === 'rescue');
  if (!rescuePoints.length) return `No rescue posts found for **${locationLabel}** in the current data. Call **112** for emergency rescue.`;

  const lines = rescuePoints.map(r =>
    `  • **${r.name}**\n    📍 ${r.address}\n    ☎ ${r.phone}\n    🏷️ ${r.tags.join(' · ')}`
  ).join('\n');

  return `**Rescue & Emergency Response in ${locationLabel}:**

${lines}

🚨 For immediate rescue — call **112**.`;
}

function requestsAnswer(ctx: RegionContext): string {
  const { requests, locationLabel } = ctx;
  if (!requests.length) return `No active aid requests found for **${locationLabel}** right now.`;

  const critical = requests.filter(r => r.priority === 'critical');
  const urgent   = requests.filter(r => r.priority === 'urgent');
  const moderate = requests.filter(r => r.priority === 'moderate');

  const fmt = (list: AidRequest[]) =>
    list.map(r => `  • **${r.title}**${r.peopleCount > 0 ? ` (${r.peopleCount} people)` : ''}`).join('\n');

  let out = `**Active aid requests in ${locationLabel}** (${requests.length} total):\n`;
  if (critical.length) out += `\n🔴 **Critical (${critical.length}):**\n${fmt(critical)}`;
  if (urgent.length)   out += `\n🟡 **Urgent (${urgent.length}):**\n${fmt(urgent)}`;
  if (moderate.length) out += `\n🟢 **Moderate (${moderate.length}):**\n${fmt(moderate)}`;
  out += `\n\nSee the live feed panel for full details and to offer help.`;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN OFFLINE ANSWER FUNCTION
// First checks for dynamic data questions, then falls back to static KB
// ─────────────────────────────────────────────────────────────────────────────
export function findOfflineAnswer(question: string, ctx?: RegionContext): string | null {
  const q = question.toLowerCase().trim();

  // Dynamic data answers (need region context)
  if (ctx) {
    if (isAskingAboutShelters(q))  return shelterAnswer(ctx);
    if (isAskingAboutFood(q))      return foodAnswer(ctx);
    if (isAskingAboutMedical(q))   return medicalAnswer(ctx);
    if (isAskingAboutRescue(q))    return rescueAnswer(ctx);
    if (isAskingAboutRequests(q))  return requestsAnswer(ctx);
  }

  // Static KB matching — score by keyword hits
  let bestScore = 0;
  let bestEntry: KbEntry | null = null;

  for (const entry of OFFLINE_KB) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore >= 1) return bestEntry.answer;

  // Generic fallback
  return `I'm currently in **offline mode** and don't have a specific answer for that.

Here's what I can help with right now:
• 🏠 **Shelters** — *"How many shelter beds are available?"*
• 🍽️ **Food & Water** — *"Where can I find food?"*
• 🏥 **Medical** — *"Where is the nearest hospital?"*
• 🚨 **Rescue** — *"Where are the rescue teams?"*
• 🌊 **Flood safety** — what to do during a flood
• 🏔️ **Earthquake safety** — Drop, Cover, Hold On
• 🔥 **Fire safety** — evacuation and extinguisher use
• 🏔️ **Landslide / GLOF** — Chamoli-specific guidance
• ⛑️ **First aid** — basic wound, burn, fracture care
• 🎒 **Emergency kit** — what to pack
• 🗺️ **How to use this app** — maps, SOS, regions

Just ask me any of these!`;
}
