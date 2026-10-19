/**
 * Offline Disaster Map Data — Joshimath (Jyotirmath), Chamoli District, Uttarakhand
 * Center: 30.5560° N, 79.5640° E
 *
 * All coordinates are [longitude, latitude] per GeoJSON spec.
 * This data is fully bundled — no network requests needed at runtime.
 */

export const MAP_CENTER: [number, number] = [30.556, 79.564]; // [lat, lng]
export const MAP_ZOOM = 13;
export const MAP_ZOOM_MIN = 10;
export const MAP_ZOOM_MAX = 16;

// ─────────────────────────────────────────────────────────────────────────────
// ROADS & MAJOR ROUTES
// ─────────────────────────────────────────────────────────────────────────────
export const ROADS_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    // NH-58 / NH-7 — Main highway Joshimath to Badrinath
    {
      type: 'Feature',
      properties: { name: 'NH-7 (Joshimath–Badrinath Highway)', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.528, 30.541],
          [79.535, 30.545],
          [79.543, 30.549],
          [79.552, 30.553],
          [79.564, 30.556],
          [79.572, 30.558],
          [79.585, 30.561],
          [79.600, 30.565],
          [79.618, 30.570],
          [79.635, 30.575],
          [79.652, 30.578],
          [79.670, 30.582],
          [79.690, 30.588],
          [79.710, 30.593],
          [79.730, 30.597],
          [79.748, 30.601],
        ],
      },
    },
    // Joshimath town internal road — upper market
    {
      type: 'Feature',
      properties: { name: 'Joshimath Upper Market Road', type: 'town_road', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.558, 30.560],
          [79.562, 30.562],
          [79.566, 30.564],
          [79.570, 30.566],
          [79.574, 30.567],
        ],
      },
    },
    // Road to Auli ski resort
    {
      type: 'Feature',
      properties: { name: 'Auli Road (Ropeway / Gondola Route)', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.564, 30.556],
          [79.560, 30.562],
          [79.555, 30.572],
          [79.550, 30.582],
          [79.546, 30.592],
          [79.542, 30.598],
        ],
      },
    },
    // Road to Tapovan / Helang (alternate route)
    {
      type: 'Feature',
      properties: { name: 'Tapovan–Helang Road', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.528, 30.541],
          [79.522, 30.535],
          [79.516, 30.528],
          [79.510, 30.520],
          [79.504, 30.513],
        ],
      },
    },
    // Govindghat road (towards Valley of Flowers / Hemkund)
    {
      type: 'Feature',
      properties: { name: 'Govindghat Road', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.564, 30.556],
          [79.578, 30.548],
          [79.592, 30.540],
          [79.604, 30.532],
          [79.614, 30.524],
          [79.622, 30.517],
        ],
      },
    },
    // Vishnuprayag approach road
    {
      type: 'Feature',
      properties: { name: 'Vishnuprayag Approach', type: 'local', width: 'tertiary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.528, 30.541],
          [79.520, 30.540],
          [79.512, 30.538],
          [79.504, 30.536],
          [79.497, 30.533],
        ],
      },
    },
    // Badrinath Temple road (final stretch)
    {
      type: 'Feature',
      properties: { name: 'Badrinath Temple Access Road', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.748, 30.601],
          [79.762, 30.606],
          [79.774, 30.610],
          [79.782, 30.614],
          [79.792, 30.620],
          [79.800, 30.625],
          [79.808, 30.630],
          [79.815, 30.635],
          [79.820, 30.638],
        ],
      },
    },
    // Joshimath lower bypass
    {
      type: 'Feature',
      properties: { name: 'Joshimath Lower Bypass', type: 'local', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.552, 30.548],
          [79.556, 30.546],
          [79.561, 30.544],
          [79.566, 30.543],
          [79.572, 30.544],
        ],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// RIVERS & WATER BODIES
// ─────────────────────────────────────────────────────────────────────────────
export const RIVERS_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    // Alaknanda River — main river running through valley
    {
      type: 'Feature',
      properties: { name: 'Alaknanda River', type: 'river', risk: 'flash_flood' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.490, 30.528],
          [79.500, 30.530],
          [79.510, 30.533],
          [79.520, 30.537],
          [79.530, 30.540],
          [79.540, 30.543],
          [79.552, 30.546],
          [79.564, 30.550],
          [79.578, 30.553],
          [79.594, 30.556],
          [79.610, 30.558],
          [79.630, 30.561],
          [79.650, 30.563],
          [79.670, 30.566],
          [79.690, 30.570],
          [79.710, 30.574],
          [79.730, 30.578],
          [79.750, 30.582],
          [79.770, 30.586],
          [79.790, 30.590],
          [79.810, 30.595],
          [79.825, 30.600],
        ],
      },
    },
    // Dhauliganga River — tributary joining at Vishnuprayag
    {
      type: 'Feature',
      properties: { name: 'Dhauliganga River', type: 'river', risk: 'flash_flood' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.495, 30.555],
          [79.500, 30.550],
          [79.505, 30.545],
          [79.510, 30.540],
          [79.515, 30.538],
          [79.520, 30.537],
          [79.526, 30.536],
          [79.530, 30.540],
        ],
      },
    },
    // Khiro Gad — seasonal stream through Joshimath
    {
      type: 'Feature',
      properties: { name: 'Khiro Gad (Seasonal Stream)', type: 'stream', risk: 'flash_flood' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.565, 30.574],
          [79.564, 30.570],
          [79.563, 30.566],
          [79.562, 30.562],
          [79.562, 30.558],
          [79.562, 30.554],
          [79.562, 30.550],
        ],
      },
    },
    // Pushpawati River (near Govindghat/Valley of Flowers)
    {
      type: 'Feature',
      properties: { name: 'Pushpawati River', type: 'river', risk: 'flash_flood' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.614, 30.520],
          [79.616, 30.524],
          [79.618, 30.528],
          [79.618, 30.532],
          [79.617, 30.536],
          [79.615, 30.540],
          [79.613, 30.545],
          [79.612, 30.550],
        ],
      },
    },
    // Saraswati River near Mana village / Badrinath
    {
      type: 'Feature',
      properties: { name: 'Saraswati River', type: 'river', risk: 'moderate' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [79.820, 30.644],
          [79.818, 30.638],
          [79.816, 30.632],
          [79.815, 30.626],
          [79.814, 30.620],
          [79.813, 30.614],
          [79.812, 30.608],
        ],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// LANDSLIDE-PRONE ZONES
// ─────────────────────────────────────────────────────────────────────────────
export const LANDSLIDE_ZONES_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    // Critical subsidence zone — Joshimath town (2023 disaster area)
    {
      type: 'Feature',
      properties: {
        name: 'Joshimath Subsidence Zone (Critical)',
        type: 'landslide',
        severity: 'critical',
        description: 'Active land subsidence since 2023. Over 800 structures cracked. Evacuation orders issued.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.555, 30.553],
          [79.562, 30.553],
          [79.568, 30.555],
          [79.572, 30.558],
          [79.573, 30.562],
          [79.570, 30.566],
          [79.565, 30.568],
          [79.558, 30.568],
          [79.553, 30.566],
          [79.551, 30.562],
          [79.552, 30.557],
          [79.555, 30.553],
        ]],
      },
    },
    // Landslide zone — Selang / above NH-7
    {
      type: 'Feature',
      properties: {
        name: 'Selang Landslide Zone',
        type: 'landslide',
        severity: 'high',
        description: 'Repeated road-blocking landslides during monsoon. NH-7 frequently cut off here.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.534, 30.544],
          [79.540, 30.544],
          [79.544, 30.547],
          [79.544, 30.552],
          [79.540, 30.554],
          [79.534, 30.554],
          [79.530, 30.551],
          [79.530, 30.546],
          [79.534, 30.544],
        ]],
      },
    },
    // Landslide zone near Lambagar / Helang
    {
      type: 'Feature',
      properties: {
        name: 'Lambagar–Helang Slide Zone',
        type: 'landslide',
        severity: 'high',
        description: 'Unstable slopes above highway. Rock debris falls on road during heavy rain.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.514, 30.524],
          [79.520, 30.523],
          [79.524, 30.526],
          [79.524, 30.531],
          [79.520, 30.534],
          [79.514, 30.534],
          [79.510, 30.531],
          [79.510, 30.526],
          [79.514, 30.524],
        ]],
      },
    },
    // Landslide zone — Gauchar area
    {
      type: 'Feature',
      properties: {
        name: 'Gauchar Debris Zone',
        type: 'landslide',
        severity: 'moderate',
        description: 'Seasonal landslide activity. Road closures likely June–September.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.600, 30.560],
          [79.607, 30.560],
          [79.611, 30.563],
          [79.611, 30.568],
          [79.607, 30.571],
          [79.600, 30.571],
          [79.596, 30.568],
          [79.596, 30.563],
          [79.600, 30.560],
        ]],
      },
    },
    // Pandukeshwar slope instability
    {
      type: 'Feature',
      properties: {
        name: 'Pandukeshwar Unstable Slope',
        type: 'landslide',
        severity: 'moderate',
        description: 'Loose moraine deposits. Vulnerable to rapid destabilisation post-heavy rain.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.658, 30.574],
          [79.664, 30.573],
          [79.668, 30.576],
          [79.668, 30.581],
          [79.664, 30.583],
          [79.658, 30.583],
          [79.654, 30.580],
          [79.654, 30.576],
          [79.658, 30.574],
        ]],
      },
    },
    // Badrinath approach unstable zone
    {
      type: 'Feature',
      properties: {
        name: 'Badrinath Approach Slide Zone',
        type: 'landslide',
        severity: 'high',
        description: 'Multiple documented landslides block pilgrimage route. GLOF risk from upstream glaciers.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.788, 30.612],
          [79.796, 30.611],
          [79.801, 30.614],
          [79.802, 30.620],
          [79.798, 30.624],
          [79.790, 30.624],
          [79.785, 30.621],
          [79.785, 30.615],
          [79.788, 30.612],
        ]],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FLOOD / FLASH-FLOOD RISK ZONES
// ─────────────────────────────────────────────────────────────────────────────
export const FLOOD_ZONES_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    // Alaknanda floodplain — Vishnuprayag to Joshimath
    {
      type: 'Feature',
      properties: {
        name: 'Alaknanda Floodplain (Vishnuprayag–Joshimath)',
        type: 'flood',
        severity: 'critical',
        description: 'Narrow gorge severely amplifies flood surge. GLOF from upstream glacier lakes can arrive with <30 min warning.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.490, 30.524],
          [79.540, 30.535],
          [79.560, 30.542],
          [79.565, 30.548],
          [79.560, 30.552],
          [79.540, 30.548],
          [79.510, 30.540],
          [79.490, 30.530],
          [79.490, 30.524],
        ]],
      },
    },
    // Alaknanda floodplain — Joshimath to Govindghat
    {
      type: 'Feature',
      properties: {
        name: 'Alaknanda Floodplain (Joshimath–Govindghat)',
        type: 'flood',
        severity: 'high',
        description: 'Flash flood corridor. Infrastructure at river level is at high risk during monsoon.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.564, 30.546],
          [79.620, 30.511],
          [79.626, 30.515],
          [79.620, 30.518],
          [79.565, 30.552],
          [79.564, 30.546],
        ]],
      },
    },
    // Govindghat–Badrinath floodplain
    {
      type: 'Feature',
      properties: {
        name: 'Govindghat–Badrinath River Corridor',
        type: 'flood',
        severity: 'high',
        description: 'Repeatedly flooded during 2013 Kedarnath disaster. Entire valley floor at risk.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.620, 30.514],
          [79.720, 30.568],
          [79.820, 30.594],
          [79.822, 30.600],
          [79.820, 30.602],
          [79.718, 30.574],
          [79.618, 30.520],
          [79.620, 30.514],
        ]],
      },
    },
    // Joshimath town lower drain / gully flash flood
    {
      type: 'Feature',
      properties: {
        name: 'Joshimath Drain Flash Flood Channel',
        type: 'flood',
        severity: 'moderate',
        description: 'Drain overflows during heavy rain causing localised flooding of lower market.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.558, 30.546],
          [79.566, 30.546],
          [79.568, 30.550],
          [79.566, 30.554],
          [79.558, 30.554],
          [79.556, 30.550],
          [79.558, 30.546],
        ]],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SAFE ZONES
// ─────────────────────────────────────────────────────────────────────────────
export const SAFE_ZONES_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Auli Safe Zone',
        type: 'safe_zone',
        description: 'High-altitude meadow, away from river valley and slide zones. ITBP camp nearby.',
        capacity: 500,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.542, 30.592],
          [79.554, 30.592],
          [79.558, 30.598],
          [79.554, 30.604],
          [79.542, 30.604],
          [79.538, 30.598],
          [79.542, 30.592],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Joshimath ITBP Ground (Assembly Point)',
        type: 'safe_zone',
        description: 'ITBP parade ground. Designated government evacuation assembly point. Helicopter accessible.',
        capacity: 800,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.560, 30.568],
          [79.568, 30.568],
          [79.571, 30.572],
          [79.568, 30.576],
          [79.560, 30.576],
          [79.557, 30.572],
          [79.560, 30.568],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Pandukeshwar Upper Plateau',
        type: 'safe_zone',
        description: 'Elevated plateau above flood level. Used as staging ground during 2013 disaster.',
        capacity: 300,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.664, 30.584],
          [79.672, 30.584],
          [79.675, 30.588],
          [79.672, 30.592],
          [79.664, 30.592],
          [79.661, 30.588],
          [79.664, 30.584],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Badrinath Temple Zone (Elevated)',
        type: 'safe_zone',
        description: 'Temple complex at elevated position. Historically safe from direct flood impact.',
        capacity: 400,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.810, 30.632],
          [79.818, 30.632],
          [79.821, 30.637],
          [79.818, 30.642],
          [79.810, 30.642],
          [79.807, 30.637],
          [79.810, 30.632],
        ]],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY SHELTERS
// ─────────────────────────────────────────────────────────────────────────────
export const EMERGENCY_SHELTERS: EmergencyLocation[] = [
  {
    id: 'shelter-01',
    type: 'shelter',
    name: 'ITBP Camp Joshimath',
    coords: [30.5720, 79.5630],
    capacity: 500,
    occupied: 180,
    status: 'open',
    phone: '01389-222001',
    details: 'Indo-Tibetan Border Police camp. Helipad on-site. 24/7 emergency shelter.',
    amenities: ['Helipad', 'Medical unit', 'Rations', 'Blankets', 'Radio comms'],
  },
  {
    id: 'shelter-02',
    type: 'shelter',
    name: 'Govt Inter College, Joshimath',
    coords: [30.5590, 79.5650],
    capacity: 300,
    occupied: 220,
    status: 'open',
    phone: '01389-222050',
    details: 'Primary government evacuation centre. Ground floor accessible. BRO support.',
    amenities: ['Accessible', 'Hot meals (Gurudwara)', 'Toilets', 'Water supply'],
  },
  {
    id: 'shelter-03',
    type: 'shelter',
    name: 'Narsingh Temple Dharamshala',
    coords: [30.5610, 79.5610],
    capacity: 150,
    occupied: 90,
    status: 'open',
    phone: '01389-222088',
    details: 'Temple-run dharamshala. Elevated, away from slide zone. Open to all.',
    amenities: ['Kitchen', 'Blankets', 'Prayers', 'Safe elevation'],
  },
  {
    id: 'shelter-04',
    type: 'shelter',
    name: 'Badrinath Dham Guest House',
    coords: [30.6350, 79.8180],
    capacity: 200,
    occupied: 40,
    status: 'open',
    phone: '01381-222102',
    details: 'Badrinath temple trust guest house. High elevation, safe during valley floods.',
    amenities: ['Pilgrimage support', 'Meals', 'Medical aid station'],
  },
  {
    id: 'shelter-05',
    type: 'shelter',
    name: 'Auli GMVN Tourist Rest House',
    coords: [30.5970, 79.5460],
    capacity: 120,
    occupied: 30,
    status: 'open',
    phone: '01389-223001',
    details: 'GMVN rest house at Auli (2519m). Far from all slide and flood zones.',
    amenities: ['Generator', 'Heating', 'Blankets', 'Meals'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITALS / MEDICAL CENTRES
// ─────────────────────────────────────────────────────────────────────────────
export const HOSPITALS: EmergencyLocation[] = [
  {
    id: 'hosp-01',
    type: 'hospital',
    name: 'Community Health Centre (CHC), Joshimath',
    coords: [30.5570, 79.5660],
    status: 'open',
    phone: '01389-222016',
    details: 'Primary government hospital. Emergency OPD, 20 beds, oxygen available.',
    amenities: ['Emergency OPD', 'Oxygen', 'X-Ray', 'Ambulance', '24/7'],
  },
  {
    id: 'hosp-02',
    type: 'hospital',
    name: 'ITBP Medical Unit, Joshimath',
    coords: [30.5715, 79.5635],
    status: 'open',
    phone: '01389-222001',
    details: 'Military medical unit. Trauma care, altitude sickness treatment.',
    amenities: ['Trauma care', 'AMS treatment', 'Surgery', 'Helicopter evacuation'],
  },
  {
    id: 'hosp-03',
    type: 'hospital',
    name: 'PHC Badrinath',
    coords: [30.6380, 79.8160],
    status: 'open',
    phone: '01381-222108',
    details: 'Primary Health Centre near Badrinath. Staffed during pilgrimage season.',
    amenities: ['First aid', 'Oxygen', 'Stretcher', 'Basic medicines'],
  },
  {
    id: 'hosp-04',
    type: 'hospital',
    name: 'First Aid Post, Govindghat',
    coords: [30.5170, 79.6220],
    status: 'open',
    phone: '01381-222200',
    details: 'Seasonal first aid post. Paramedics on duty during pilgrimage season.',
    amenities: ['First aid', 'AMS first response', 'Stretcher relay to Joshimath'],
  },
  {
    id: 'hosp-05',
    type: 'hospital',
    name: 'Base Hospital Srinagar (Garhwal)',
    coords: [30.2210, 78.7810],
    status: 'open',
    phone: '01346-252323',
    details: 'District referral hospital 90km away. Full surgical and ICU capabilities.',
    amenities: ['ICU', 'Surgery', 'Blood bank', 'MRI', 'Dialysis'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY RESPONSE POINTS
// ─────────────────────────────────────────────────────────────────────────────
export const EMERGENCY_RESPONSE: EmergencyLocation[] = [
  {
    id: 'resp-01',
    type: 'response',
    name: 'SDRF Post, Joshimath',
    coords: [30.5580, 79.5680],
    status: 'open',
    phone: '01389-222030',
    details: 'State Disaster Response Force. Boats, ropes, rescue equipment. Quick deployment.',
    amenities: ['Rescue boats', 'Rope rescue', 'Night ops', '24/7'],
  },
  {
    id: 'resp-02',
    type: 'response',
    name: 'BRO (Border Roads Org) Camp, Joshimath',
    coords: [30.5540, 79.5600],
    status: 'open',
    phone: '01389-222045',
    details: 'Maintains NH-7. Clears landslide debris within 6–24 hours. JCBs and dozers on standby.',
    amenities: ['Heavy machinery', 'Road clearing', 'Engineer support'],
  },
  {
    id: 'resp-03',
    type: 'response',
    name: 'Helipad — Joshimath',
    coords: [30.5730, 79.5625],
    status: 'open',
    phone: '01389-222001',
    details: 'ITBP helipad. Used for casualty evacuation and supply drops when roads are cut.',
    amenities: ['Helicopter ops', 'Casualty evacuation', 'Supply drops'],
  },
  {
    id: 'resp-04',
    type: 'response',
    name: 'Helipad — Badrinath',
    coords: [30.6400, 79.8200],
    status: 'open',
    phone: '01381-222102',
    details: 'Army helipad at Badrinath. Key evacuation point for stranded pilgrims.',
    amenities: ['Helicopter ops', 'Pilgrimage evacuation', 'Army support'],
  },
  {
    id: 'resp-05',
    type: 'response',
    name: 'Police Station, Joshimath',
    coords: [30.5565, 79.5645],
    status: 'open',
    phone: '01389-222020',
    details: 'District police. Coordinates civilian evacuation and curfew enforcement.',
    amenities: ['Law enforcement', 'Evacuation coordination', 'Communications'],
  },
  {
    id: 'resp-06',
    type: 'response',
    name: 'Chamoli District EOC (Gopeshwar)',
    coords: [30.4140, 79.2810],
    status: 'open',
    phone: '01372-252626',
    details: 'District Emergency Operations Centre 55km away. Central command for all disaster response.',
    amenities: ['Command centre', 'Satellite comms', 'NDRF coordination', '24/7'],
  },
  {
    id: 'resp-07',
    type: 'response',
    name: 'NDRF Forward Post, Pipalkoti',
    coords: [30.4720, 79.4880],
    status: 'open',
    phone: '01372-252700',
    details: 'NDRF staging post 30km from Joshimath. Pre-deployed during monsoon season.',
    amenities: ['Rescue teams', 'Medical support', 'Communication equipment'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DISASTER RISK MARKERS (points of interest for hazard awareness)
// ─────────────────────────────────────────────────────────────────────────────
export const DISASTER_MARKERS: EmergencyLocation[] = [
  {
    id: 'risk-01',
    type: 'risk',
    name: 'Joshimath Cracked Buildings Zone',
    coords: [30.5605, 79.5620],
    status: 'danger',
    phone: '01389-222030',
    details: 'Over 800 buildings with structural cracks due to subsidence. Do not enter without assessment.',
    amenities: [],
  },
  {
    id: 'risk-02',
    type: 'risk',
    name: 'Vishnuprayag Confluence (Flood Risk)',
    coords: [30.5380, 79.5000],
    status: 'danger',
    phone: '01389-222030',
    details: 'Alaknanda–Dhauliganga confluence. Extreme flood amplification point.',
    amenities: [],
  },
  {
    id: 'risk-03',
    type: 'risk',
    name: 'Rishiganga–Dhauliganga GLOF Zone',
    coords: [30.5600, 79.4960],
    status: 'danger',
    phone: '01372-252626',
    details: '2021 disaster origin. Glacier lake outburst flood destroyed Tapovan Vishnugad Power Plant.',
    amenities: [],
  },
  {
    id: 'risk-04',
    type: 'risk',
    name: 'Tapovan Power Plant (Damaged)',
    coords: [30.5420, 79.5040],
    status: 'danger',
    phone: '01389-222045',
    details: 'Destroyed in Feb 2021 GLOF. Area remains unstable. Access restricted.',
    amenities: [],
  },
  {
    id: 'risk-05',
    type: 'risk',
    name: 'NH-7 Landslide Hotspot (Selang)',
    coords: [30.5490, 79.5370],
    status: 'warning',
    phone: '01389-222045',
    details: 'Frequent road blockages. Check BRO status before travelling.',
    amenities: [],
  },
  {
    id: 'risk-06',
    type: 'risk',
    name: 'Drone Camera Surveillance Tower',
    coords: [30.5660, 79.5590],
    status: 'open',
    phone: '01389-222030',
    details: 'SDRF drone surveillance post. Real-time monitoring of slide zones.',
    amenities: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROAD NAME LABELS
// Each entry marks a midpoint along a road where its name badge should appear.
// Multiple entries per long road so the name repeats at readable intervals.
// coords: [lat, lng] — Leaflet order
// ─────────────────────────────────────────────────────────────────────────────

export interface RoadLabel {
  id: string;
  name: string;
  short: string;          // short name shown on the badge (e.g. "NH-7")
  type: 'highway' | 'secondary' | 'tertiary';
  coords: [number, number];
  rotation?: number;      // badge rotation in degrees (approx road bearing)
  minZoom?: number;
}

export const ROAD_LABELS: RoadLabel[] = [
  // NH-7 — placed at intervals along the highway
  { id:'rl-nh7-1', name:'NH-7 · Joshimath–Badrinath Highway', short:'NH-7',
    type:'highway', coords:[30.5500, 79.5390], rotation: 12, minZoom: 11 },
  { id:'rl-nh7-2', name:'NH-7 · Joshimath–Badrinath Highway', short:'NH-7',
    type:'highway', coords:[30.5560, 79.5640], rotation: 10, minZoom: 11 },
  { id:'rl-nh7-3', name:'NH-7 · Joshimath–Badrinath Highway', short:'NH-7',
    type:'highway', coords:[30.5700, 79.6200], rotation: 8,  minZoom: 11 },
  { id:'rl-nh7-4', name:'NH-7 · Badrinath Highway', short:'NH-7',
    type:'highway', coords:[30.5850, 79.7000], rotation: 6,  minZoom: 11 },

  // Govindghat Road
  { id:'rl-govind', name:'Govindghat Road', short:'Govindghat Rd',
    type:'highway', coords:[30.5370, 79.5890], rotation:-22, minZoom: 12 },

  // Badrinath Temple Access Road
  { id:'rl-badri-access', name:'Badrinath Temple Access Road', short:'Temple Rd',
    type:'highway', coords:[30.6260, 79.7920], rotation: 14, minZoom: 12 },

  // Joshimath Upper Market Road
  { id:'rl-upper-mkt', name:'Upper Market Road', short:'Upper Mkt Rd',
    type:'secondary', coords:[30.5640, 79.5660], rotation: 12, minZoom: 13 },

  // Auli Road
  { id:'rl-auli', name:'Auli Road — Gondola Route', short:'Auli Rd',
    type:'secondary', coords:[30.5740, 79.5530], rotation:-68, minZoom: 12 },

  // Tapovan–Helang Road
  { id:'rl-tapovan', name:'Tapovan–Helang Road', short:'Tapovan Rd',
    type:'secondary', coords:[30.5290, 79.5150], rotation:-58, minZoom: 12 },

  // Joshimath Lower Bypass
  { id:'rl-bypass', name:'Joshimath Lower Bypass', short:'Lower Bypass',
    type:'secondary', coords:[30.5460, 79.5600], rotation: 5, minZoom: 13 },

  // Vishnuprayag Approach
  { id:'rl-vishnu', name:'Vishnuprayag Approach', short:'Vishnuprayag Rd',
    type:'tertiary', coords:[30.5375, 79.5120], rotation:-8, minZoom: 13 },
];

// ─────────────────────────────────────────────────────────────────────────────
// BUILDING / BLOCK FOOTPRINTS
// Rectangular polygons representing residential blocks, institutional buildings,
// and housing clusters in Joshimath town and nearby settlements.
// GeoJSON coords: [lng, lat] (standard GeoJSON order)
// ─────────────────────────────────────────────────────────────────────────────

export type BuildingType =
  | 'residential'   // housing block / apartment
  | 'government'    // govt office / collectorate
  | 'commercial'    // market / shop block
  | 'religious'     // temple / gurudwara / mosque
  | 'educational'   // school / college
  | 'medical'       // hospital / dispensary
  | 'military'      // army / ITBP / BRO
  | 'utility';      // power station / water tank / helipad

export interface BuildingFeatureProps {
  id: string;
  name: string;
  type: BuildingType;
  floors?: number;
  note?: string;       // extra info shown in tooltip
  cracked?: boolean;   // highlight buildings in subsidence zone
}

export const BUILDINGS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon, BuildingFeatureProps> = {
  type: 'FeatureCollection',
  features: [

    // ── Joshimath: ITBP Campus ──────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-itbp-main', name:'ITBP Joshimath HQ', type:'military', floors:2, note:'Indo-Tibetan Border Police main campus. Helipad, medical unit, EOC.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5618,30.5726],[79.5638,30.5726],[79.5638,30.5714],[79.5618,30.5714],[79.5618,30.5726]
      ]]},
    },
    { type:'Feature', properties:{ id:'bld-itbp-helipad', name:'ITBP Helipad', type:'utility', note:'Active helipad — casualty evacuation & supply drops.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5620,30.5732],[79.5630,30.5732],[79.5630,30.5726],[79.5620,30.5726],[79.5620,30.5732]
      ]]},
    },

    // ── CHC Hospital ────────────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-chc', name:'CHC Joshimath Hospital', type:'medical', floors:2, note:'Community Health Centre. 20 beds, O2, X-Ray, 24/7 emergency.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5654,30.5574],[79.5668,30.5574],[79.5668,30.5564],[79.5654,30.5564],[79.5654,30.5574]
      ]]},
    },

    // ── Govt Inter College ──────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-college', name:'Govt Inter College', type:'educational', floors:2, note:'Primary evacuation centre. Capacity 300. Ground floor accessible.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5643,30.5596],[79.5658,30.5596],[79.5658,30.5584],[79.5643,30.5584],[79.5643,30.5596]
      ]]},
    },

    // ── Narsingh Temple ─────────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-narsingh', name:'Narsingh Temple', type:'religious', note:'Ancient Vishnu temple. Important community shelter. Dharamshala attached.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5602,30.5626],[79.5613,30.5626],[79.5613,30.5616],[79.5602,30.5616],[79.5602,30.5626]
      ]]},
    },

    // ── Shankaracharya Math ─────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-math', name:'Shankaracharya Jyotirmath', type:'religious', floors:2, note:'One of four Mathas established by Adi Shankaracharya. 8th century. Elevated, structurally sound.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5628,30.5660],[79.5642,30.5660],[79.5642,30.5650],[79.5628,30.5650],[79.5628,30.5660]
      ]]},
    },

    // ── Police Station ──────────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-police', name:'Joshimath Police Station', type:'government', floors:1, note:'Coordinates civilian evacuation. 24/7 control room.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5640,30.5570],[79.5652,30.5570],[79.5652,30.5562],[79.5640,30.5562],[79.5640,30.5570]
      ]]},
    },

    // ── SDM / Tehsil Office ─────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-sdm', name:'SDM Office Joshimath', type:'government', floors:2, note:'Sub-Divisional Magistrate. Disaster coordination, relief fund disbursal.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5635,30.5580],[79.5648,30.5580],[79.5648,30.5570],[79.5635,30.5570],[79.5635,30.5580]
      ]]},
    },

    // ── BRO Camp ───────────────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-bro', name:'BRO Camp — Joshimath', type:'military', floors:1, note:'Border Roads Organisation. Clears NH-7 landslides. JCBs and dozers on standby.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5594,30.5546],[79.5610,30.5546],[79.5610,30.5536],[79.5594,30.5536],[79.5594,30.5546]
      ]]},
    },

    // ── Upper Market Block ─────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-upper-mkt-1', name:'Upper Market Block A', type:'commercial', floors:2, note:'Main shopping street — pharmacies, hardware, food.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5634,30.5640],[79.5656,30.5640],[79.5656,30.5633],[79.5634,30.5633],[79.5634,30.5640]
      ]]},
    },
    { type:'Feature', properties:{ id:'bld-upper-mkt-2', name:'Upper Market Block B', type:'commercial', floors:2, cracked:true, note:'CAUTION: Structural cracks reported — subsidence zone.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5656,30.5640],[79.5672,30.5640],[79.5672,30.5633],[79.5656,30.5633],[79.5656,30.5640]
      ]]},
    },

    // ── Lower Market / Bazar ───────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-lower-mkt', name:'Lower Bazar Market', type:'commercial', floors:2, note:'Bus stand area. Provisions, medical supplies, transport hub.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5630,30.5572],[79.5648,30.5572],[79.5648,30.5563],[79.5630,30.5563],[79.5630,30.5572]
      ]]},
    },

    // ── Residential blocks — Manohar Bagh ─────────────────────────────────
    { type:'Feature', properties:{ id:'bld-manohar-1', name:'Manohar Bagh Residences', type:'residential', floors:2, cracked:true, note:'CAUTION: Multiple cracked buildings. Subsidence zone — avoid entering.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5584,30.5620],[79.5602,30.5620],[79.5602,30.5610],[79.5584,30.5610],[79.5584,30.5620]
      ]]},
    },
    { type:'Feature', properties:{ id:'bld-manohar-2', name:'Manohar Bagh Block 2', type:'residential', floors:2, cracked:true, note:'CAUTION: Cracked structures. Evacuation advised.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5575,30.5614],[79.5584,30.5614],[79.5584,30.5606],[79.5575,30.5606],[79.5575,30.5614]
      ]]},
    },

    // ── Residential blocks — Singdhar ─────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-singdhar', name:'Singdhar Residential Block', type:'residential', floors:3, note:'Dense residential area east of Upper Market.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5660,30.5634],[79.5676,30.5634],[79.5676,30.5622],[79.5660,30.5622],[79.5660,30.5634]
      ]]},
    },

    // ── Residential blocks — Sunil Ward ───────────────────────────────────
    { type:'Feature', properties:{ id:'bld-sunil', name:'Sunil Ward Housing', type:'residential', floors:2, cracked:true, note:'Mixed residential. Some structures crack-assessed. Check before entry.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5612,30.5592],[79.5628,30.5592],[79.5628,30.5582],[79.5612,30.5582],[79.5612,30.5592]
      ]]},
    },

    // ── GMVN Joshimath ─────────────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-gmvn', name:'GMVN Tourist Bungalow', type:'government', floors:2, note:'Garhwal Mandal Vikas Nigam. Being used as relief office during disaster.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5648,30.5606],[79.5660,30.5606],[79.5660,30.5596],[79.5648,30.5596],[79.5648,30.5606]
      ]]},
    },

    // ── Water Tank / Reservoir ─────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-water-tank', name:'Joshimath Water Tank', type:'utility', note:'Municipal water supply reservoir. Do not damage — critical for relief operations.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5550,30.5590],[79.5562,30.5590],[79.5562,30.5582],[79.5550,30.5582],[79.5550,30.5590]
      ]]},
    },

    // ── Auli GMVN Rest House ───────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-auli-gmvn', name:'Auli GMVN Rest House', type:'government', floors:2, note:'High-altitude rest house at 2,519m. Generator, heating. Safe zone.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5452,30.5972],[79.5468,30.5972],[79.5468,30.5962],[79.5452,30.5962],[79.5452,30.5972]
      ]]},
    },

    // ── Badrinath Temple Complex ───────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-badrinath-temple', name:'Badrinath Temple', type:'religious', floors:3, note:'Char Dham pilgrimage shrine. Elevated position. Safe evacuation assembly point.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.8195,30.6450],[79.8210,30.6450],[79.8210,30.6438],[79.8195,30.6438],[79.8195,30.6450]
      ]]},
    },
    { type:'Feature', properties:{ id:'bld-badrinath-dharamshala', name:'Badrinath Dharamshala', type:'religious', note:'Large pilgrim dharamshala. Emergency accommodation for 200+ people.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.8180,30.6355],[79.8196,30.6355],[79.8196,30.6343],[79.8180,30.6343],[79.8180,30.6355]
      ]]},
    },

    // ── Govindghat Gurudwara ───────────────────────────────────────────────
    { type:'Feature', properties:{ id:'bld-govindghat-gurdwara', name:'Gurudwara Govindghat', type:'religious', note:'Sikh shrine. Major rest point for Hemkund Sahib pilgrims. Free langar, shelter.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.6205,30.5182],[79.6218,30.5182],[79.6218,30.5170],[79.6205,30.5170],[79.6205,30.5182]
      ]]},
    },

    // ── Tapovan-Vishnugad Power Plant (Damaged) ───────────────────────────
    { type:'Feature', properties:{ id:'bld-tapovan-plant', name:'Tapovan-Vishnugad Power Plant', type:'utility', note:'NTPC 520MW hydro plant. Destroyed in Feb 2021 GLOF. Access restricted. Unstable area.' },
      geometry:{ type:'Polygon', coordinates:[[
        [79.5050,30.5414],[79.5070,30.5414],[79.5070,30.5402],[79.5050,30.5402],[79.5050,30.5414]
      ]]},
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FAMOUS BUILDINGS / KEY POIs
// Shown as small icon markers with labels — distinct from emergency markers
// coords: [lat, lng] — Leaflet order
// ─────────────────────────────────────────────────────────────────────────────

export type PoiCategory =
  | 'temple'        // Hindu temple / pilgrimage site
  | 'gurudwara'     // Sikh shrine
  | 'government'    // office / collectorate
  | 'school'        // educational institution
  | 'market'        // market / commercial hub
  | 'hotel'         // hotel / rest house
  | 'infrastructure'// dam, power plant, water supply
  | 'viewpoint'     // scenic viewpoint / tourist spot
  | 'bus_stand'     // bus / taxi stand
  | 'bank'          // bank / ATM
  | 'post_office';  // post office

export interface FamousPoi {
  id: string;
  name: string;
  category: PoiCategory;
  coords: [number, number];      // [lat, lng]
  address?: string;
  phone?: string;
  note: string;
  minZoom?: number;
}

export const FAMOUS_POIS: FamousPoi[] = [

  // ── Temples & Religious ──────────────────────────────────────────────────
  { id:'poi-narsingh',      category:'temple',    name:'Narsingh Temple',              coords:[30.5621,79.5607], address:'Upper Joshimath',  phone:'—',            note:'Main temple of Joshimath. Lord Narsingh deity. Major community gathering point. Dharamshala for 150.',  minZoom:12 },
  { id:'poi-jyotirmath',    category:'temple',    name:'Shankaracharya Jyotirmath',    coords:[30.5655,79.5635], address:'Upper Joshimath',  phone:'—',            note:'8th century Math established by Adi Shankaracharya. Solidly built stone structure. Elevated and structurally safe.', minZoom:12 },
  { id:'poi-badrinath',     category:'temple',    name:'Badrinath Temple',             coords:[30.6453,79.8205], address:'Badrinath Dham',   phone:'01381-222102', note:'Char Dham pilgrimage temple at 3,133m. Elevated. Key evacuation assembly point. Temple trust runs shelter nearby.', minZoom:11 },
  { id:'poi-vasudeva',      category:'temple',    name:'Vasudeva Temple',              coords:[30.5598,79.5598], address:'Joshimath town',   phone:'—',            note:'Ancient temple inside Joshimath town. Located near subsidence zone — structural assessment ongoing.', minZoom:13 },
  { id:'poi-bhavishya-badri', category:'temple',  name:'Bhavishya Badri Temple',       coords:[30.5380,79.6640], address:'Subain Village',   phone:'—',            note:'Future-form of Badrinath as per Hindu scripture. Trekking access only.',  minZoom:12 },
  { id:'poi-govindghat-gurudwara', category:'gurudwara', name:'Gurudwara Govindghat',  coords:[30.5175,79.6212], address:'Govindghat',       phone:'01381-222200', note:'Major Sikh pilgrimage point. Base camp for Hemkund Sahib. Free meals and shelter (langar). 24/7 open.',  minZoom:12 },
  { id:'poi-hemkund',       category:'gurudwara', name:'Hemkund Sahib',               coords:[30.5913,79.6797], address:'4,329 m altitude', phone:'—',            note:'Sacred Sikh shrine at 4,329m. Seasonal access June–Sept. Rescue helipad nearby for AMS cases.', minZoom:11 },

  // ── Government & Civic ───────────────────────────────────────────────────
  { id:'poi-sdm',           category:'government', name:'SDM Office',                  coords:[30.5574,79.5642], address:'Joshimath town',   phone:'01389-222010', note:'Sub-Divisional Magistrate. Main civilian authority. Relief coordination, emergency orders.', minZoom:13 },
  { id:'poi-tehsil',        category:'government', name:'Tehsil Office Joshimath',      coords:[30.5568,79.5636], address:'Lower Market area', phone:'01389-222015', note:'Revenue & administration. Ration card, relief fund distribution during disasters.', minZoom:13 },
  { id:'poi-block-office',  category:'government', name:'Block Development Office',     coords:[30.5562,79.5648], address:'Joshimath',        phone:'01389-222020', note:'Block-level government office. Manages MGNREGA workers — useful for disaster manual labor.', minZoom:13 },
  { id:'poi-collectorate',  category:'government', name:'Chamoli District Collectorate',coords:[30.4135,79.2808], address:'Gopeshwar',        phone:'01372-252626', note:'District headquarters 55km away. Central command for all Chamoli disaster response.', minZoom:11 },

  // ── Schools & Education ──────────────────────────────────────────────────
  { id:'poi-govt-college',  category:'school',    name:'Govt Inter College',           coords:[30.5590,79.5650], address:'Joshimath',        phone:'01389-222050', note:'Government college. Primary evacuation shelter. 300 capacity. Strong RCC building.', minZoom:13 },
  { id:'poi-primary-school',category:'school',    name:'Primary School Joshimath',     coords:[30.5610,79.5662], address:'Upper Market area', phone:'—',            note:'Government primary school. Used as relief distribution point.', minZoom:13 },
  { id:'poi-kv',            category:'school',    name:'Kendriya Vidyalaya Joshimath', coords:[30.5640,79.5678], address:'Near ITBP',         phone:'01389-222060', note:'Central govt school near ITBP campus. Emergency gathering point.', minZoom:13 },

  // ── Markets ───────────────────────────────────────────────────────────────
  { id:'poi-upper-market',  category:'market',    name:'Upper Market (Main Bazar)',    coords:[30.5636,79.5648], address:'Joshimath Upper Bazar', phone:'—',         note:'Main commercial street. Pharmacies, grocery, hardware. Some shops in subsidence zone — check cracks.', minZoom:13 },
  { id:'poi-lower-market',  category:'market',    name:'Lower Market (Bus Stand Area)',coords:[30.5562,79.5635], address:'Joshimath Lower Bazar', phone:'—',         note:'Bus stand, eateries, provisions. Transport hub for Auli, Badrinath, Govindghat routes.', minZoom:13 },

  // ── Hotels & Lodges ───────────────────────────────────────────────────────
  { id:'poi-auli-clifftop', category:'hotel',     name:'Auli Cliff Top Club (GMVN)',  coords:[30.5968,79.5462], address:'Auli, 2,519 m',    phone:'01389-223001', note:'GMVN hotel at Auli. Generator, heating. Well away from all hazard zones. Emergency accommodation.', minZoom:12 },
  { id:'poi-hotel-kamet',   category:'hotel',     name:'Hotel Kamet',                 coords:[30.5594,79.5644], address:'Joshimath town',   phone:'01389-222100', note:'Mid-range hotel in Joshimath. Structural safety uncertain — check before accommodation.', minZoom:13 },
  { id:'poi-badrinath-guesthouse', category:'hotel', name:'Badrinath Temple Trust Guest House', coords:[30.6352,79.8182], address:'Badrinath', phone:'01381-222102', note:'Operated by Badrinath-Kedarnath Temple Committee. Evacuee shelter during disaster season.', minZoom:12 },

  // ── Infrastructure ────────────────────────────────────────────────────────
  { id:'poi-tapovan-plant', category:'infrastructure', name:'Tapovan-Vishnugad Dam (Destroyed)', coords:[30.5412,79.5058], address:'Tapovan', phone:'01389-222045', note:'NTPC 520MW hydro project destroyed in February 2021 GLOF. Area highly unstable. No access.', minZoom:12 },
  { id:'poi-water-tank',    category:'infrastructure', name:'Joshimath Water Reservoir', coords:[30.5586,79.5556], address:'Upper Joshimath', phone:'—', note:'Municipal water supply for Joshimath. Critical infrastructure during disaster operations.', minZoom:13 },
  { id:'poi-power-substation', category:'infrastructure', name:'Power Sub-station',    coords:[30.5550,79.5622], address:'Lower Joshimath', phone:'—', note:'Electricity distribution substation. Frequently disrupted during landslides — report outages to NDRF.', minZoom:13 },

  // ── Viewpoints & Tourism ─────────────────────────────────────────────────
  { id:'poi-auli-gondola-top', category:'viewpoint', name:'Auli Gondola Top Station', coords:[30.5945,79.5432], address:'Auli, 2,519 m',   phone:'—', note:'Top station of Auli ropeway. Panoramic view. Accessible only by gondola or 7km road when operational.', minZoom:12 },
  { id:'poi-joshimath-viewpoint', category:'viewpoint', name:'Joshimath Viewpoint',   coords:[30.5678,79.5548], address:'Above Joshimath', phone:'—', note:'Best viewpoint above town. Views of Auli, Hathi Parbat, Dunagiri peaks. Safe elevated position.', minZoom:13 },

  // ── Transport ─────────────────────────────────────────────────────────────
  { id:'poi-bus-stand',     category:'bus_stand', name:'Joshimath Bus Stand',          coords:[30.5558,79.5632], address:'Lower Market',    phone:'—', note:'Main bus and shared taxi stand. Routes to Badrinath, Govindghat, Auli, Pipalkoti, Rishikesh.', minZoom:13 },

  // ── Banking ───────────────────────────────────────────────────────────────
  { id:'poi-sbi',           category:'bank',      name:'SBI Joshimath Branch',         coords:[30.5580,79.5654], address:'Lower Market',    phone:'01389-222090', note:'State Bank of India. ATM available. May be operational during disasters for cash withdrawal.', minZoom:13 },
  { id:'poi-post-office',   category:'post_office', name:'Post Office Joshimath',      coords:[30.5572,79.5640], address:'Lower Market',    phone:'01389-222080', note:'India Post. Communication hub. Speed Post and money order services during disaster relief.', minZoom:13 },
];

// ─────────────────────────────────────────────────────────────────────────────
// PLACE LABELS — towns, villages, localities, landmarks, confluences
// Shown as permanent text labels on the map canvas (no external tiles needed)
// ─────────────────────────────────────────────────────────────────────────────

export type PlaceLabelTier =
  | 'city'        // main town — largest text, always visible
  | 'town'        // significant settlement
  | 'village'     // small village or hamlet
  | 'locality'    // neighbourhood / ward within a town
  | 'landmark'    // temple, dam, power plant, resort
  | 'confluence'  // river meeting point
  | 'pass'        // mountain pass
  | 'glacier';    // glacier / glacial lake

export interface PlaceLabel {
  id: string;
  name: string;
  subtext?: string;           // shown below name in smaller text (e.g. "3,415 m")
  coords: [number, number];   // [lat, lng]
  tier: PlaceLabelTier;
  minZoom?: number;           // hide label below this zoom level (default 10)
}

export const PLACE_LABELS: PlaceLabel[] = [

  // ── Major towns ──────────────────────────────────────────────────────────
  {
    id: 'pl-joshimath',
    name: 'Joshimath',
    subtext: 'Jyotirmath · 1,890 m',
    coords: [30.5600, 79.5640],
    tier: 'city',
    minZoom: 10,
  },
  {
    id: 'pl-badrinath',
    name: 'Badrinath',
    subtext: 'Badrinath Dham · 3,133 m',
    coords: [30.6390, 79.8190],
    tier: 'city',
    minZoom: 10,
  },

  // ── Towns / significant settlements ──────────────────────────────────────
  {
    id: 'pl-govindghat',
    name: 'Govindghat',
    subtext: '1,828 m',
    coords: [30.5180, 79.6200],
    tier: 'town',
    minZoom: 11,
  },
  {
    id: 'pl-pandukeshwar',
    name: 'Pandukeshwar',
    subtext: '1,920 m',
    coords: [30.5870, 79.6610],
    tier: 'town',
    minZoom: 11,
  },
  {
    id: 'pl-pipalkoti',
    name: 'Pipalkoti',
    subtext: '1,372 m',
    coords: [30.4730, 79.4870],
    tier: 'town',
    minZoom: 11,
  },
  {
    id: 'pl-helang',
    name: 'Helang',
    subtext: '1,540 m',
    coords: [30.5180, 79.5140],
    tier: 'town',
    minZoom: 11,
  },
  {
    id: 'pl-tapovan',
    name: 'Tapovan',
    subtext: '1,312 m',
    coords: [30.5300, 79.5000],
    tier: 'town',
    minZoom: 11,
  },
  {
    id: 'pl-lambagar',
    name: 'Lambagar',
    subtext: 'Karanprayag–Joshimath',
    coords: [30.5240, 79.5130],
    tier: 'village',
    minZoom: 12,
  },
  {
    id: 'pl-mana',
    name: 'Mana Village',
    subtext: 'Last Indian village · 3,219 m',
    coords: [30.6570, 79.8360],
    tier: 'town',
    minZoom: 11,
  },
  {
    id: 'pl-ghangaria',
    name: 'Ghangaria',
    subtext: 'Valley of Flowers base · 3,048 m',
    coords: [30.5720, 79.6650],
    tier: 'town',
    minZoom: 11,
  },

  // ── Joshimath localities / wards ──────────────────────────────────────────
  {
    id: 'pl-upper-bazar',
    name: 'Upper Bazar',
    subtext: 'Joshimath',
    coords: [30.5640, 79.5640],
    tier: 'locality',
    minZoom: 13,
  },
  {
    id: 'pl-lower-bazar',
    name: 'Lower Bazar',
    subtext: 'Joshimath',
    coords: [30.5570, 79.5640],
    tier: 'locality',
    minZoom: 13,
  },
  {
    id: 'pl-manohar-bagh',
    name: 'Manohar Bagh',
    subtext: 'Ward — Joshimath',
    coords: [30.5615, 79.5590],
    tier: 'locality',
    minZoom: 13,
  },
  {
    id: 'pl-singdhar',
    name: 'Singdhar',
    subtext: 'Ward — Joshimath',
    coords: [30.5628, 79.5665],
    tier: 'locality',
    minZoom: 13,
  },
  {
    id: 'pl-sunil',
    name: 'Sunil Ward',
    subtext: 'Joshimath',
    coords: [30.5585, 79.5620],
    tier: 'locality',
    minZoom: 13,
  },
  {
    id: 'pl-ravigram',
    name: 'Ravigram',
    subtext: 'Near Joshimath',
    coords: [30.5540, 79.5700],
    tier: 'locality',
    minZoom: 13,
  },
  {
    id: 'pl-marwari',
    name: 'Marwari',
    subtext: 'Near Joshimath',
    coords: [30.5520, 79.5560],
    tier: 'locality',
    minZoom: 13,
  },

  // ── Villages ──────────────────────────────────────────────────────────────
  {
    id: 'pl-selang',
    name: 'Selang',
    subtext: 'Village · NH-7',
    coords: [30.5490, 79.5380],
    tier: 'village',
    minZoom: 12,
  },
  {
    id: 'pl-gauchar',
    name: 'Gauchar',
    subtext: 'Village',
    coords: [30.5640, 79.6050],
    tier: 'village',
    minZoom: 12,
  },
  {
    id: 'pl-bhyundar',
    name: 'Bhyundar',
    subtext: 'Village · Valley of Flowers trail',
    coords: [30.5480, 79.6460],
    tier: 'village',
    minZoom: 12,
  },
  {
    id: 'pl-badrinath-village',
    name: 'Badrinath Village',
    subtext: 'Resident settlement',
    coords: [30.6340, 79.8100],
    tier: 'village',
    minZoom: 12,
  },
  {
    id: 'pl-haat',
    name: 'Haat Village',
    subtext: 'Chamoli',
    coords: [30.5360, 79.5780],
    tier: 'village',
    minZoom: 12,
  },
  {
    id: 'pl-khet',
    name: 'Khet Village',
    subtext: 'Joshimath block',
    coords: [30.5740, 79.5820],
    tier: 'village',
    minZoom: 13,
  },
  {
    id: 'pl-dungri',
    name: 'Dungri',
    subtext: 'Village · above Joshimath',
    coords: [30.5670, 79.5510],
    tier: 'village',
    minZoom: 13,
  },

  // ── Landmarks ─────────────────────────────────────────────────────────────
  {
    id: 'pl-narsingh-temple',
    name: 'Narsingh Temple',
    subtext: 'Ancient Vishnu temple',
    coords: [30.5620, 79.5605],
    tier: 'landmark',
    minZoom: 13,
  },
  {
    id: 'pl-shankaracharya',
    name: 'Shankaracharya Math',
    subtext: 'Jyotirmath · 8th century',
    coords: [30.5655, 79.5630],
    tier: 'landmark',
    minZoom: 13,
  },
  {
    id: 'pl-auli-resort',
    name: 'Auli Ski Resort',
    subtext: '2,519 m · GMVN',
    coords: [30.5960, 79.5470],
    tier: 'landmark',
    minZoom: 12,
  },
  {
    id: 'pl-ropeway',
    name: 'Auli Ropeway Station',
    subtext: 'Gondola top station',
    coords: [30.5940, 79.5430],
    tier: 'landmark',
    minZoom: 13,
  },
  {
    id: 'pl-tapovan-dam',
    name: 'Tapovan-Vishnugad Dam',
    subtext: 'NTPC · Damaged 2021',
    coords: [30.5410, 79.5060],
    tier: 'landmark',
    minZoom: 12,
  },
  {
    id: 'pl-badrinath-temple',
    name: 'Badrinath Temple',
    subtext: 'Char Dham pilgrimage',
    coords: [30.6453, 79.8200],
    tier: 'landmark',
    minZoom: 12,
  },
  {
    id: 'pl-vasudhara',
    name: 'Vasudhara Falls',
    subtext: '122 m waterfall',
    coords: [30.6620, 79.8510],
    tier: 'landmark',
    minZoom: 12,
  },
  {
    id: 'pl-vof',
    name: 'Valley of Flowers',
    subtext: 'UNESCO World Heritage',
    coords: [30.5870, 79.6960],
    tier: 'landmark',
    minZoom: 11,
  },
  {
    id: 'pl-hemkund',
    name: 'Hemkund Sahib',
    subtext: 'Sikh shrine · 4,329 m',
    coords: [30.5910, 79.6790],
    tier: 'landmark',
    minZoom: 11,
  },
  {
    id: 'pl-satopanth',
    name: 'Satopanth Tal',
    subtext: 'Glacial lake · 4,402 m',
    coords: [30.7020, 79.8950],
    tier: 'glacier',
    minZoom: 11,
  },
  {
    id: 'pl-bheem-pul',
    name: 'Bheem Pul',
    subtext: 'Ancient stone bridge · Mana',
    coords: [30.6590, 79.8390],
    tier: 'landmark',
    minZoom: 13,
  },

  // ── River confluences (Prayags) ───────────────────────────────────────────
  {
    id: 'pl-vishnuprayag',
    name: 'Vishnuprayag',
    subtext: 'Alaknanda ✕ Dhauliganga',
    coords: [30.5360, 79.5010],
    tier: 'confluence',
    minZoom: 11,
  },
  {
    id: 'pl-govindghat-confluence',
    name: 'Govindghat Confluence',
    subtext: 'Alaknanda ✕ Pushpawati',
    coords: [30.5200, 79.6170],
    tier: 'confluence',
    minZoom: 12,
  },

  // ── Mountain passes ───────────────────────────────────────────────────────
  {
    id: 'pl-khullara',
    name: 'Khullara Bugyal',
    subtext: 'Alpine meadow · 3,660 m',
    coords: [30.6050, 79.6820],
    tier: 'pass',
    minZoom: 12,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE SEARCH INDEX — predefined emergency locations
// ─────────────────────────────────────────────────────────────────────────────
export const SEARCH_INDEX: SearchEntry[] = [
  { id: 'shelter-01', name: 'ITBP Camp Joshimath', type: 'shelter', coords: [30.5720, 79.5630] },
  { id: 'shelter-02', name: 'Govt Inter College Joshimath', type: 'shelter', coords: [30.5590, 79.5650] },
  { id: 'shelter-03', name: 'Narsingh Temple Dharamshala', type: 'shelter', coords: [30.5610, 79.5610] },
  { id: 'shelter-04', name: 'Badrinath Dham Guest House', type: 'shelter', coords: [30.6350, 79.8180] },
  { id: 'shelter-05', name: 'Auli GMVN Rest House', type: 'shelter', coords: [30.5970, 79.5460] },
  { id: 'hosp-01', name: 'CHC Hospital Joshimath', type: 'hospital', coords: [30.5570, 79.5660] },
  { id: 'hosp-02', name: 'ITBP Medical Unit', type: 'hospital', coords: [30.5715, 79.5635] },
  { id: 'hosp-03', name: 'PHC Badrinath', type: 'hospital', coords: [30.6380, 79.8160] },
  { id: 'hosp-04', name: 'First Aid Post Govindghat', type: 'hospital', coords: [30.5170, 79.6220] },
  { id: 'hosp-05', name: 'Base Hospital Srinagar Garhwal', type: 'hospital', coords: [30.2210, 78.7810] },
  { id: 'resp-01', name: 'SDRF Post Joshimath', type: 'response', coords: [30.5580, 79.5680] },
  { id: 'resp-02', name: 'BRO Camp Joshimath', type: 'response', coords: [30.5540, 79.5600] },
  { id: 'resp-03', name: 'Helipad Joshimath', type: 'response', coords: [30.5730, 79.5625] },
  { id: 'resp-04', name: 'Helipad Badrinath', type: 'response', coords: [30.6400, 79.8200] },
  { id: 'resp-05', name: 'Police Station Joshimath', type: 'response', coords: [30.5565, 79.5645] },
  { id: 'resp-06', name: 'District EOC Gopeshwar', type: 'response', coords: [30.4140, 79.2810] },
  { id: 'resp-07', name: 'NDRF Forward Post Pipalkoti', type: 'response', coords: [30.4720, 79.4880] },
  { id: 'safe-01', name: 'Auli Safe Zone', type: 'safe_zone', coords: [30.5980, 79.5480] },
  { id: 'safe-02', name: 'ITBP Ground Assembly Point', type: 'safe_zone', coords: [30.5720, 79.5640] },
  { id: 'safe-03', name: 'Pandukeshwar Upper Plateau', type: 'safe_zone', coords: [30.5880, 79.6640] },
  { id: 'safe-04', name: 'Badrinath Temple Zone', type: 'safe_zone', coords: [30.6370, 79.8140] },
  { id: 'risk-01', name: 'Joshimath Cracked Buildings', type: 'risk', coords: [30.5605, 79.5620] },
  { id: 'risk-02', name: 'Vishnuprayag Confluence Flood Risk', type: 'risk', coords: [30.5380, 79.5000] },
  { id: 'risk-03', name: 'Rishiganga GLOF Zone', type: 'risk', coords: [30.5600, 79.4960] },
  { id: 'risk-04', name: 'Tapovan Power Plant Damaged', type: 'risk', coords: [30.5420, 79.5040] },
  { id: 'risk-05', name: 'Selang Landslide Hotspot', type: 'risk', coords: [30.5490, 79.5370] },
];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type LocationType = 'shelter' | 'hospital' | 'response' | 'risk' | 'safe_zone';
export type LocationStatus = 'open' | 'limited' | 'full' | 'closed' | 'danger' | 'warning';

export interface EmergencyLocation {
  id: string;
  type: LocationType;
  name: string;
  coords: [number, number]; // [lat, lng]
  capacity?: number;
  occupied?: number;
  status: LocationStatus;
  phone: string;
  details: string;
  amenities: string[];
}

export interface SearchEntry {
  id: string;
  name: string;
  type: LocationType | 'safe_zone';
  coords: [number, number];
}
