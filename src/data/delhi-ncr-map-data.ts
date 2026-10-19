/**
 * Offline Map Data — Delhi NCR
 * Coverage: Delhi · Noida · Ghaziabad · Gurugram · Faridabad (incl. Kabulpur/Kaboolpur)
 *
 * Map center: 28.5500, 77.2500  (covers the full NCR region)
 * Zoom: 11 default, 9 min, 16 max
 *
 * Coordinate convention:
 *   GeoJSON features (LineString / Polygon):  [longitude, latitude]
 *   All point arrays (PlaceLabel, SEARCH_INDEX, etc.):  [latitude, longitude]  ← Leaflet order
 */

export const NCR_CENTER: [number, number] = [28.55, 77.25]; // [lat, lng]
export const NCR_ZOOM     = 11;
export const NCR_ZOOM_MIN =  9;
export const NCR_ZOOM_MAX = 17;

// ─────────────────────────────────────────────────────────────────────────────
// MAJOR ROADS — National Highways, Ring Roads, Expressways
// GeoJSON [lng, lat]
// ─────────────────────────────────────────────────────────────────────────────
export const NCR_ROADS_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [

    // ── National Highways ──────────────────────────────────────────────────

    // NH-19 / NH-2 — Delhi–Mathura–Agra (passes through Faridabad)
    {
      type: 'Feature',
      properties: { name: 'NH-19 Delhi–Agra Highway (via Faridabad)', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2490, 28.6280], // Ashram, Delhi
          [77.2540, 28.6060], // Badarpur
          [77.2700, 28.5860], // Faridabad border
          [77.2840, 28.5620], // NIT Faridabad
          [77.2920, 28.5380], // Sector 28 Faridabad
          [77.3030, 28.5100], // Sector 37 Faridabad
          [77.3060, 28.4900], // Old Faridabad
          [77.3100, 28.4680], // Ballabhgarh
          [77.3150, 28.4400], // Palwal approach
        ],
      },
    },

    // NH-48 — Delhi–Gurugram–Jaipur (NH-8 old)
    {
      type: 'Feature',
      properties: { name: 'NH-48 Delhi–Gurugram Expressway', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.1100, 28.5950], // Dhaula Kuan
          [77.0950, 28.5710], // Mahipalpur
          [77.0700, 28.5480], // Rajiv Chowk Gurugram
          [77.0560, 28.5260], // IFFCO Chowk
          [77.0400, 28.4920], // Sikandarpur
          [77.0200, 28.4680], // Hero Honda Chowk
          [76.9950, 28.4350], // IMT Manesar
        ],
      },
    },

    // NH-9 — Delhi–Noida–Ghaziabad
    {
      type: 'Feature',
      properties: { name: 'NH-9 Delhi–Noida–Ghaziabad', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2430, 28.6320], // ITO Delhi
          [77.2880, 28.6270], // Mayur Vihar
          [77.3260, 28.6160], // Sector 62 Noida
          [77.3560, 28.6080], // Sector 78 Noida
          [77.3880, 28.6000], // Ghaziabad border
          [77.4200, 28.5950], // Kaushambi
          [77.4480, 28.5840], // Vaishali
          [77.4850, 28.6050], // NH-9 Ghaziabad city
        ],
      },
    },

    // NH-44 — Delhi–Sonipat (north)
    {
      type: 'Feature',
      properties: { name: 'NH-44 Delhi–Sonipat', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2260, 28.6760], // Mukarba Chowk
          [77.1980, 28.7050], // Samaypur Badli
          [77.1700, 28.7380], // Kundli
          [77.1500, 28.7650], // Sonipat outskirts
        ],
      },
    },

    // NH-24 / NH-9 Eastern — Delhi–Ghaziabad–Lucknow
    {
      type: 'Feature',
      properties: { name: 'NH-9 Eastern Peripheral (Delhi–Ghaziabad)', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2700, 28.6500], // Anand Vihar ISBT
          [77.3100, 28.6580], // NH-24 Ghaziabad entry
          [77.3800, 28.6630], // Hapur Road
          [77.4300, 28.6680], // Dasna
        ],
      },
    },

    // Yamuna Expressway (Greater Noida–Agra)
    {
      type: 'Feature',
      properties: { name: 'Yamuna Expressway', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.3930, 28.5560], // Greater Noida entry
          [77.4100, 28.5200],
          [77.4260, 28.4800],
          [77.4420, 28.4350],
          [77.4550, 28.3900],
        ],
      },
    },

    // Eastern Peripheral Expressway (Kundli–Manesar–Palwal)
    {
      type: 'Feature',
      properties: { name: 'Eastern Peripheral Expressway (KMP)', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.1700, 28.7380], // Kundli
          [77.2000, 28.7000],
          [77.2350, 28.6600],
          [77.2700, 28.6100],
          [77.2950, 28.5600],
          [77.3100, 28.5000],
          [77.3200, 28.4500],
          [77.3300, 28.4000], // Palwal
        ],
      },
    },

    // ── Ring Roads & Arterials ─────────────────────────────────────────────

    // Delhi Outer Ring Road (partial — south & east)
    {
      type: 'Feature',
      properties: { name: 'Delhi Outer Ring Road', type: 'ring_road', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.1100, 28.5950], // Dhaula Kuan
          [77.1500, 28.5900], // Vasant Kunj
          [77.1900, 28.5720], // Mehrauli
          [77.2150, 28.5560], // Saket
          [77.2430, 28.5620], // Khanpur
          [77.2700, 28.5860], // Badarpur
          [77.2900, 28.6100], // Kalindi Kunj
          [77.3000, 28.6300], // Mayur Vihar
          [77.2800, 28.6580], // Patparganj
          [77.2570, 28.6700], // Shahdara
          [77.2430, 28.6800], // Seelampur
        ],
      },
    },

    // Delhi Inner Ring Road
    {
      type: 'Feature',
      properties: { name: 'Delhi Inner Ring Road', type: 'ring_road', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2200, 28.6450], // Paharganj
          [77.2350, 28.6600], // Civil Lines
          [77.2570, 28.6700], // Shahdara
          [77.2780, 28.6580], // Anand Vihar
          [77.2900, 28.6380], // Laxmi Nagar
          [77.2780, 28.6200], // Nizamuddin
          [77.2500, 28.5960], // Lajpat Nagar
          [77.2200, 28.5850], // Moti Bagh
          [77.2000, 28.6050], // RK Puram
          [77.2100, 28.6300], // Connaught Place area
          [77.2200, 28.6450], // close ring
        ],
      },
    },

    // Mathura Road / MB Road (Delhi–Faridabad)
    {
      type: 'Feature',
      properties: { name: 'Mathura Road (MB Road)', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2510, 28.6280], // Ashram Chowk Delhi
          [77.2600, 28.6050], // Sarita Vihar
          [77.2680, 28.5850], // Mohan Estate
          [77.2800, 28.5620], // Badarpur
          [77.2920, 28.5380], // NIT Faridabad
          [77.3060, 28.4900], // Faridabad Old
        ],
      },
    },

    // ── Faridabad Internal Roads ───────────────────────────────────────────

    // Faridabad–Gurugram Road (FNG Expressway)
    {
      type: 'Feature',
      properties: { name: 'Faridabad–Noida–Gurugram (FNG) Expressway', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2920, 28.5380], // NIT Faridabad
          [77.3120, 28.5320], // Sector 86 Faridabad
          [77.3360, 28.5100], // Sector 76
          [77.3560, 28.4950], // Sector 58 Faridabad
          [77.3700, 28.4750], // Ballabhgarh side
        ],
      },
    },

    // Sector 14 Road Faridabad
    {
      type: 'Feature',
      properties: { name: 'Faridabad Sector 14–21 Road', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.3100, 28.5150],
          [77.3200, 28.5100],
          [77.3300, 28.5050],
          [77.3400, 28.5000],
        ],
      },
    },

    // Kabulpur / Kaboolpur area — local roads
    {
      type: 'Feature',
      properties: { name: 'Kabulpur Road (Faridabad)', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.3060, 28.4080],
          [77.3100, 28.4120],
          [77.3140, 28.4160],
          [77.3180, 28.4200],
          [77.3220, 28.4240],
        ],
      },
    },

    {
      type: 'Feature',
      properties: { name: 'Kabulpur Internal Road', type: 'local', width: 'tertiary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.3100, 28.4120],
          [77.3080, 28.4100],
          [77.3060, 28.4090],
          [77.3040, 28.4080],
        ],
      },
    },

    {
      type: 'Feature',
      properties: { name: 'Ballabhgarh–Kabulpur Link Road', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.3150, 28.4400], // Ballabhgarh
          [77.3140, 28.4320],
          [77.3130, 28.4250],
          [77.3120, 28.4180],
          [77.3100, 28.4120], // Kabulpur
        ],
      },
    },

    // Ballabhgarh town road
    {
      type: 'Feature',
      properties: { name: 'Ballabhgarh Town Road', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.3050, 28.4450],
          [77.3100, 28.4420],
          [77.3150, 28.4400],
          [77.3200, 28.4380],
          [77.3260, 28.4360],
        ],
      },
    },

    // ── Noida Roads ────────────────────────────────────────────────────────

    // Noida Expressway (DND–Greater Noida)
    {
      type: 'Feature',
      properties: { name: 'Noida–Greater Noida Expressway', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2970, 28.5780], // DND Flyover exit
          [77.3150, 28.5540],
          [77.3320, 28.5300],
          [77.3500, 28.5080],
          [77.3680, 28.4840],
          [77.3900, 28.4620],
          [77.4100, 28.4380], // Greater Noida
        ],
      },
    },

    // Noida Sector 18 Commercial Road
    {
      type: 'Feature',
      properties: { name: 'Noida Sector 18 Road', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.3120, 28.5690],
          [77.3200, 28.5680],
          [77.3280, 28.5660],
          [77.3360, 28.5640],
        ],
      },
    },

    // ── Gurugram Roads ─────────────────────────────────────────────────────

    // Golf Course Road Gurugram
    {
      type: 'Feature',
      properties: { name: 'Golf Course Road, Gurugram', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.0850, 28.5080], // Sikandarpur
          [77.1000, 28.4880],
          [77.1100, 28.4680],
          [77.1200, 28.4480],
          [77.1300, 28.4260],
        ],
      },
    },

    // MG Road Gurugram
    {
      type: 'Feature',
      properties: { name: 'MG Road, Gurugram', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.0480, 28.5000],
          [77.0620, 28.5050],
          [77.0760, 28.5080],
          [77.0900, 28.5080],
        ],
      },
    },

    // ── Delhi Internal Arterials ───────────────────────────────────────────

    // Ring Road (south — near Lajpat–ITO)
    {
      type: 'Feature',
      properties: { name: 'Ring Road (ITO–Lajpat Nagar)', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2430, 28.6320], // ITO
          [77.2430, 28.6200],
          [77.2430, 28.6050], // Lajpat Nagar
          [77.2480, 28.5900], // Andrews Ganj
          [77.2100, 28.5850], // Moti Bagh
        ],
      },
    },

    // Vikas Marg
    {
      type: 'Feature',
      properties: { name: 'Vikas Marg (Delhi–Laxmi Nagar)', type: 'secondary', width: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2430, 28.6320], // ITO
          [77.2700, 28.6380], // Laxmi Nagar
          [77.2880, 28.6350], // Nirman Vihar
          [77.3060, 28.6280],
        ],
      },
    },

    // GT Road (Grand Trunk Road — Shahdara–Ghaziabad)
    {
      type: 'Feature',
      properties: { name: 'GT Road (Grand Trunk — Shahdara–Ghaziabad)', type: 'highway', width: 'primary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2570, 28.6700], // Shahdara
          [77.2880, 28.6700], // Dilshad Garden
          [77.3200, 28.6680], // Ghaziabad
          [77.3650, 28.6720], // Sahibabad
          [77.4250, 28.6800], // Ghaziabad city
        ],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// RIVERS & WATER BODIES
// GeoJSON [lng, lat]
// ─────────────────────────────────────────────────────────────────────────────
export const NCR_RIVERS_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    // Yamuna River — main river through Delhi and bordering Faridabad
    {
      type: 'Feature',
      properties: { name: 'Yamuna River', type: 'river', risk: 'flood' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2200, 28.7400], // Wazirabad Barrage
          [77.2350, 28.7200], // Seelampur
          [77.2450, 28.7000], // ISBT Kashmere Gate
          [77.2480, 28.6800], // Old Delhi
          [77.2490, 28.6600], // ITO Bridge
          [77.2510, 28.6400], // Nizamuddin Bridge
          [77.2530, 28.6200], // Okhla
          [77.2600, 28.5950], // Kalindi Kunj
          [77.2750, 28.5700], // Badarpur Barrage
          [77.2880, 28.5500], // Faridabad side
          [77.3000, 28.5200], // Faridabad riverbank
          [77.3050, 28.4900], // Old Faridabad
          [77.3100, 28.4600], // Ballabhgarh bank
          [77.3160, 28.4300], // Near Palwal
        ],
      },
    },

    // Hindon River — Ghaziabad
    {
      type: 'Feature',
      properties: { name: 'Hindon River', type: 'river', risk: 'flood' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.3800, 28.7200],
          [77.4000, 28.6900],
          [77.4150, 28.6600],
          [77.4300, 28.6300],
          [77.4200, 28.5900],
          [77.4100, 28.5500],
        ],
      },
    },

    // Najafgarh Lake (seasonal wetland)
    {
      type: 'Feature',
      properties: { name: 'Najafgarh Lake (Wetland)', type: 'wetland', risk: 'flood' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [76.9800, 28.6200],
          [77.0000, 28.6300],
          [77.0200, 28.6350],
          [77.0500, 28.6280],
          [77.0700, 28.6150],
        ],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FLOOD / RISK ZONES (Yamuna floodplain — relevant for NCR demos)
// GeoJSON [lng, lat]
// ─────────────────────────────────────────────────────────────────────────────
export const NCR_FLOOD_ZONES_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Yamuna Floodplain — Central Delhi',
        type: 'flood', severity: 'high',
        description: 'Yamuna floodplain. Riverbanks flood annually during monsoon. ITO–Nizamuddin reach most affected.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.2380, 28.6800], [77.2600, 28.6800],
          [77.2640, 28.6200], [77.2560, 28.6050],
          [77.2380, 28.6050], [77.2320, 28.6400],
          [77.2380, 28.6800],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Yamuna Floodplain — Okhla to Badarpur',
        type: 'flood', severity: 'high',
        description: 'Low-lying Yamuna bank. Okhla Bird Sanctuary and informal settlements flood during peak monsoon.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.2500, 28.6000], [77.2700, 28.5980],
          [77.2850, 28.5600], [77.2750, 28.5550],
          [77.2560, 28.5750], [77.2420, 28.5900],
          [77.2500, 28.6000],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Yamuna Floodplain — Faridabad Bank',
        type: 'flood', severity: 'moderate',
        description: 'Faridabad side of Yamuna. Riverside colonies and farms flood in heavy rain years.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.2750, 28.5700], [77.3050, 28.5700],
          [77.3150, 28.4600], [77.3050, 28.4500],
          [77.2850, 28.5000], [77.2700, 28.5400],
          [77.2750, 28.5700],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Hindon River Flood Zone — Ghaziabad',
        type: 'flood', severity: 'moderate',
        description: 'Hindon floods lower-lying Ghaziabad colonies in heavy monsoon years.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.3900, 28.6900], [77.4300, 28.6900],
          [77.4400, 28.6300], [77.4200, 28.6200],
          [77.3950, 28.6500], [77.3850, 28.6700],
          [77.3900, 28.6900],
        ]],
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PLACE LABELS — cities, districts, localities, landmarks
// [lat, lng] — Leaflet order
// ─────────────────────────────────────────────────────────────────────────────
import type { PlaceLabel } from './joshimath-map-data';
export type { PlaceLabel };

export const NCR_PLACE_LABELS: PlaceLabel[] = [

  // ── Major cities ──────────────────────────────────────────────────────────
  { id:'ncr-delhi',      name:'New Delhi',         subtext:'National Capital', coords:[28.6139, 77.2090], tier:'city', minZoom:9  },
  { id:'ncr-noida',      name:'Noida',             subtext:'Gautam Buddh Nagar', coords:[28.5355, 77.3910], tier:'city', minZoom:10 },
  { id:'ncr-gurgaon',    name:'Gurugram',          subtext:'Gurgaon · Haryana', coords:[28.4595, 77.0266], tier:'city', minZoom:10 },
  { id:'ncr-ghaziabad',  name:'Ghaziabad',         subtext:'Uttar Pradesh',    coords:[28.6692, 77.4538], tier:'city', minZoom:10 },
  { id:'ncr-faridabad',  name:'Faridabad',         subtext:'Haryana',          coords:[28.4089, 77.3178], tier:'city', minZoom:10 },
  { id:'ncr-greaternoida',name:'Greater Noida',    subtext:'G.B. Nagar',       coords:[28.4744, 77.5040], tier:'city', minZoom:11 },

  // ── Delhi localities ───────────────────────────────────────────────────────
  { id:'ncr-cp',         name:'Connaught Place',   subtext:'Central Delhi',    coords:[28.6315, 77.2167], tier:'town', minZoom:12 },
  { id:'ncr-ito',        name:'ITO',               subtext:'Income Tax Office', coords:[28.6304, 77.2400], tier:'town', minZoom:12 },
  { id:'ncr-cp-rajpath', name:'Rajpath / Kartavya Path', subtext:'New Delhi ceremonial axis', coords:[28.6129, 77.2295], tier:'landmark', minZoom:12 },
  { id:'ncr-lajpat',     name:'Lajpat Nagar',      subtext:'South Delhi',      coords:[28.5699, 77.2433], tier:'town', minZoom:13 },
  { id:'ncr-saket',      name:'Saket',             subtext:'South Delhi',      coords:[28.5272, 77.2190], tier:'locality', minZoom:13 },
  { id:'ncr-vasant',     name:'Vasant Kunj',       subtext:'South-West Delhi', coords:[28.5207, 77.1508], tier:'locality', minZoom:13 },
  { id:'ncr-dwarka',     name:'Dwarka',            subtext:'West Delhi',       coords:[28.5921, 77.0460], tier:'town', minZoom:12 },
  { id:'ncr-rohini',     name:'Rohini',            subtext:'North-West Delhi', coords:[28.7041, 77.1025], tier:'town', minZoom:12 },
  { id:'ncr-shahdara',   name:'Shahdara',          subtext:'East Delhi',       coords:[28.6731, 77.2894], tier:'town', minZoom:12 },
  { id:'ncr-preet',      name:'Preet Vihar',       subtext:'East Delhi',       coords:[28.6454, 77.2968], tier:'locality', minZoom:13 },
  { id:'ncr-mayurvihar', name:'Mayur Vihar',       subtext:'East Delhi',       coords:[28.6088, 77.2960], tier:'locality', minZoom:13 },
  { id:'ncr-nizamuddin', name:'Nizamuddin',        subtext:'SE Delhi',         coords:[28.5892, 77.2538], tier:'locality', minZoom:13 },
  { id:'ncr-okhla',      name:'Okhla',             subtext:'South-East Delhi', coords:[28.5368, 77.2701], tier:'locality', minZoom:13 },
  { id:'ncr-badarpur',   name:'Badarpur',          subtext:'South Delhi border', coords:[28.5021, 77.2924], tier:'town', minZoom:12 },
  { id:'ncr-kalindikunj',name:'Kalindi Kunj',      subtext:'Delhi–Noida border', coords:[28.5440, 77.3065], tier:'locality', minZoom:13 },
  { id:'ncr-ashram',     name:'Ashram Chowk',      subtext:'SE Delhi',         coords:[28.5783, 77.2492], tier:'locality', minZoom:13 },

  // ── Faridabad localities ───────────────────────────────────────────────────
  { id:'ncr-nit',        name:'NIT Faridabad',     subtext:'National Industrial Town', coords:[28.3907, 77.3176], tier:'town', minZoom:12 },
  { id:'ncr-oldfaridabad',name:'Old Faridabad',    subtext:'Historic core',    coords:[28.4089, 77.3106], tier:'town', minZoom:12 },
  { id:'ncr-sec28',      name:'Sector 28',         subtext:'Faridabad',        coords:[28.4232, 77.3060], tier:'locality', minZoom:13 },
  { id:'ncr-sec37',      name:'Sector 37',         subtext:'Faridabad',        coords:[28.4388, 77.3000], tier:'locality', minZoom:13 },
  { id:'ncr-sec86',      name:'Sector 86',         subtext:'Faridabad',        coords:[28.4498, 77.3060], tier:'locality', minZoom:13 },
  { id:'ncr-sec76',      name:'Sector 76',         subtext:'Faridabad',        coords:[28.4582, 77.3180], tier:'locality', minZoom:13 },
  { id:'ncr-sec58',      name:'Sector 58',         subtext:'Faridabad',        coords:[28.4620, 77.3280], tier:'locality', minZoom:13 },
  { id:'ncr-ballabhgarh',name:'Ballabhgarh',       subtext:'Faridabad district', coords:[28.3406, 77.3194], tier:'town', minZoom:12 },
  { id:'ncr-kabulpur',   name:'Kabulpur',          subtext:'Faridabad · Demo location', coords:[28.4080, 77.3120], tier:'town', minZoom:12 },
  { id:'ncr-tigaon',     name:'Tigaon',            subtext:'Faridabad',        coords:[28.3710, 77.3400], tier:'village', minZoom:13 },
  { id:'ncr-palwal',     name:'Palwal',            subtext:'Haryana',          coords:[28.1442, 77.3220], tier:'town', minZoom:12 },

  // ── Noida localities ───────────────────────────────────────────────────────
  { id:'ncr-sec18',      name:'Sector 18',         subtext:'Noida commercial hub', coords:[28.5685, 77.3219], tier:'locality', minZoom:13 },
  { id:'ncr-sec62',      name:'Sector 62',         subtext:'Noida IT hub',     coords:[28.6261, 77.3647], tier:'locality', minZoom:13 },
  { id:'ncr-sec78',      name:'Sector 78',         subtext:'Noida',            coords:[28.5917, 77.3900], tier:'locality', minZoom:13 },
  { id:'ncr-filmcity',   name:'Film City / Sector 16A', subtext:'Noida',      coords:[28.5826, 77.3210], tier:'locality', minZoom:13 },
  { id:'ncr-dnd',        name:'DND Flyover',       subtext:'Delhi–Noida link', coords:[28.5687, 77.3028], tier:'landmark', minZoom:12 },

  // ── Ghaziabad localities ───────────────────────────────────────────────────
  { id:'ncr-kaushambi',  name:'Kaushambi',         subtext:'Ghaziabad',        coords:[28.6422, 77.3317], tier:'locality', minZoom:13 },
  { id:'ncr-vaishali',   name:'Vaishali',          subtext:'Ghaziabad',        coords:[28.6452, 77.3414], tier:'locality', minZoom:13 },
  { id:'ncr-rajnagar',   name:'Raj Nagar Extension', subtext:'Ghaziabad',      coords:[28.6650, 77.4400], tier:'locality', minZoom:13 },

  // ── Gurugram localities ────────────────────────────────────────────────────
  { id:'ncr-sikandarpur',name:'Sikandarpur',       subtext:'Gurugram',         coords:[28.4795, 77.0888], tier:'locality', minZoom:13 },
  { id:'ncr-udyog-vihar',name:'Udyog Vihar',       subtext:'Industrial estate', coords:[28.5027, 77.0880], tier:'locality', minZoom:13 },
  { id:'ncr-cyber-city', name:'Cyber City',        subtext:'DLF, Gurugram',    coords:[28.4965, 77.0896], tier:'landmark', minZoom:13 },
  { id:'ncr-sohna-rd',   name:'Sohna Road',        subtext:'Gurugram',         coords:[28.4288, 77.0420], tier:'locality', minZoom:13 },

  // ── Key landmarks ─────────────────────────────────────────────────────────
  { id:'ncr-redfort',    name:'Red Fort',          subtext:'UNESCO World Heritage', coords:[28.6562, 77.2410], tier:'landmark', minZoom:12 },
  { id:'ncr-qutub',      name:'Qutub Minar',       subtext:'UNESCO World Heritage', coords:[28.5244, 77.1855], tier:'landmark', minZoom:12 },
  { id:'ncr-lotus',      name:'Lotus Temple',      subtext:'Bahai Temple',     coords:[28.5535, 77.2588], tier:'landmark', minZoom:13 },
  { id:'ncr-akshardham', name:'Akshardham Temple', subtext:'East Delhi',       coords:[28.6127, 77.2773], tier:'landmark', minZoom:12 },
  { id:'ncr-india-gate', name:'India Gate',        subtext:'War Memorial',     coords:[28.6129, 77.2295], tier:'landmark', minZoom:12 },
  { id:'ncr-humayun',    name:'Humayun\'s Tomb',   subtext:'UNESCO World Heritage', coords:[28.5933, 77.2507], tier:'landmark', minZoom:13 },
  { id:'ncr-igdairport', name:'IGI Airport',       subtext:'Indira Gandhi International', coords:[28.5562, 77.1000], tier:'landmark', minZoom:11 },
  { id:'ncr-millennium', name:'Millennium City Centre', subtext:'Gurugram',    coords:[28.4823, 77.0829], tier:'landmark', minZoom:13 },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROAD LABELS — inline badge labels along major roads
// [lat, lng] — Leaflet order
// ─────────────────────────────────────────────────────────────────────────────
import type { RoadLabel } from './joshimath-map-data';
export type { RoadLabel };

export const NCR_ROAD_LABELS: RoadLabel[] = [
  { id:'rl-nh19-1', name:'NH-19 Delhi–Agra (via Faridabad)', short:'NH-19', type:'highway', coords:[28.5860, 77.2700], rotation: 25, minZoom:11 },
  { id:'rl-nh19-2', name:'NH-19 Delhi–Agra (via Faridabad)', short:'NH-19', type:'highway', coords:[28.5100, 77.3030], rotation: 30, minZoom:11 },
  { id:'rl-nh48-1', name:'NH-48 Delhi–Gurugram', short:'NH-48', type:'highway', coords:[28.5480, 77.0700], rotation:-15, minZoom:11 },
  { id:'rl-nh9-1',  name:'NH-9 Delhi–Noida–Ghaziabad', short:'NH-9', type:'highway', coords:[28.6160, 77.3260], rotation: 8, minZoom:11 },
  { id:'rl-nh44-1', name:'NH-44 Delhi–Sonipat', short:'NH-44', type:'highway', coords:[28.7050, 77.1980], rotation:-25, minZoom:11 },
  { id:'rl-gt-road', name:'GT Road (Grand Trunk)', short:'GT Road', type:'highway', coords:[28.6700, 77.3200], rotation: 5, minZoom:12 },
  { id:'rl-nh-ye',  name:'Yamuna Expressway', short:'Yamuna Expy', type:'highway', coords:[28.5200, 77.4100], rotation: 65, minZoom:11 },
  { id:'rl-ne-exp', name:'Noida–Greater Noida Expressway', short:'N-GN Expy', type:'highway', coords:[28.5540, 77.3150], rotation: 58, minZoom:12 },
  { id:'rl-fng',    name:'FNG Expressway', short:'FNG Expy', type:'highway', coords:[28.5320, 77.3120], rotation:  5, minZoom:12 },
  { id:'rl-mathura','name':'Mathura Road', short:'Mathura Rd', type:'highway', coords:[28.6050, 77.2600], rotation: 22, minZoom:12 },
  { id:'rl-kabulpur','name':'Kabulpur Road', short:'Kabulpur Rd', type:'secondary', coords:[28.4160, 77.3140], rotation: 18, minZoom:13 },
  { id:'rl-ballabh', name:'Ballabhgarh Town Rd', short:'Ballabhgarh Rd', type:'secondary', coords:[28.4420, 77.3150], rotation: 5, minZoom:13 },
  { id:'rl-golf-gug','name':'Golf Course Road', short:'Golf Course Rd', type:'secondary', coords:[28.4880, 77.1000], rotation:-68, minZoom:13 },
  { id:'rl-mg-gug',  name:'MG Road Gurugram', short:'MG Road', type:'secondary', coords:[28.5050, 77.0620], rotation: 5, minZoom:13 },
];

// ─────────────────────────────────────────────────────────────────────────────
// FAMOUS POIs — key locations in Delhi NCR for navigation reference
// [lat, lng] — Leaflet order
// ─────────────────────────────────────────────────────────────────────────────
import type { FamousPoi } from './joshimath-map-data';
export type { FamousPoi };

export const NCR_FAMOUS_POIS: FamousPoi[] = [

  // ── National landmarks ────────────────────────────────────────────────────
  { id:'poi-ncr-redfort',    category:'temple',     name:'Red Fort',             coords:[28.6562, 77.2410], address:'Chandni Chowk, Old Delhi', phone:'011-2327-7705', note:'UNESCO World Heritage. Mughal-era fort. Major tourist and orientation landmark for Central Delhi.', minZoom:11 },
  { id:'poi-ncr-indiagate',  category:'viewpoint',  name:'India Gate',            coords:[28.6129, 77.2295], address:'Rajpath, New Delhi', phone:'—', note:'War memorial. Kartavya Path central axis. Key landmark for navigation in Lutyens Delhi.', minZoom:11 },
  { id:'poi-ncr-akshardham', category:'temple',     name:'Akshardham Temple',    coords:[28.6127, 77.2773], address:'NH-24 approach, East Delhi', phone:'011-4344-2344', note:'Major Hindu temple complex. Riverside, near Yamuna. Reference point for East Delhi navigation.', minZoom:11 },
  { id:'poi-ncr-qutub',      category:'temple',     name:'Qutub Minar',          coords:[28.5244, 77.1855], address:'Mehrauli, South Delhi', phone:'—', note:'UNESCO World Heritage. Tallest brick minaret in the world. Key South Delhi landmark.', minZoom:11 },
  { id:'poi-ncr-lotus',      category:'temple',     name:'Lotus Temple',         coords:[28.5535, 77.2588], address:'Bahapur, Okhla', phone:'011-2644-4029', note:'Bahá\'í House of Worship. SE Delhi landmark near Okhla. Easily recognisable lotus shape.', minZoom:12 },
  { id:'poi-ncr-humayun',    category:'temple',     name:'Humayun\'s Tomb',      coords:[28.5933, 77.2507], address:'Nizamuddin East', phone:'—', note:'UNESCO World Heritage. Near Nizamuddin railway station. Important reference for SE Delhi.', minZoom:12 },
  { id:'poi-ncr-jantar',     category:'viewpoint',  name:'Jantar Mantar',        coords:[28.6270, 77.2166], address:'Connaught Place', phone:'—', note:'18th century astronomical observatory. Central Delhi reference point.', minZoom:12 },

  // ── Airports & Major Terminals ────────────────────────────────────────────
  { id:'poi-ncr-igi',        category:'infrastructure', name:'IGI Airport T3',  coords:[28.5562, 77.1000], address:'NH-48, SW Delhi', phone:'011-2465-2011', note:'Indira Gandhi International Airport. Terminal 3. Major western gateway to Delhi.', minZoom:10 },
  { id:'poi-ncr-isbt-kashmere', category:'bus_stand', name:'ISBT Kashmere Gate', coords:[28.6682, 77.2302], address:'Kashmere Gate, Old Delhi', phone:'011-2296-8836', note:'Major inter-state bus terminal. North Delhi. Buses to Haridwar, Chandigarh, Amritsar.', minZoom:11 },
  { id:'poi-ncr-isbt-anand', category:'bus_stand',  name:'ISBT Anand Vihar',    coords:[28.6469, 77.3165], address:'Anand Vihar, East Delhi', phone:'011-2214-4680', note:'ISBT for buses to UP, Bihar, Uttarakhand. Also Metro and railway connectivity.', minZoom:11 },
  { id:'poi-ncr-new-delhi-rly', category:'infrastructure', name:'New Delhi Railway Station', coords:[28.6414, 77.2196], address:'Paharganj side', phone:'139', note:'Major railway hub. Two faces: Ajmeri Gate & Paharganj. Central Delhi.', minZoom:11 },
  { id:'poi-ncr-hazrat',     category:'infrastructure', name:'Hazrat Nizamuddin Rly', coords:[28.5886, 77.2513], address:'Nizamuddin', phone:'139', note:'Major railway terminus. Connects South India trains. Near ITO and Mathura Road.', minZoom:11 },

  // ── Hospitals ─────────────────────────────────────────────────────────────
  { id:'poi-ncr-aiims',      category:'government', name:'AIIMS New Delhi',      coords:[28.5672, 77.2100], address:'Ansari Nagar', phone:'011-2659-4404', note:'All India Institute of Medical Sciences. Premier trauma and emergency centre. 24/7.', minZoom:11 },
  { id:'poi-ncr-safdarjung', category:'government', name:'Safdarjung Hospital',  coords:[28.5691, 77.2058], address:'Sri Aurobindo Marg', phone:'011-2673-0000', note:'Major government hospital. Burns, trauma, emergency. Near AIIMS.', minZoom:12 },
  { id:'poi-ncr-lnjp',       category:'government', name:'LNJP Hospital',        coords:[28.6360, 77.2470], address:'JLN Marg, Central Delhi', phone:'011-2323-1740', note:'Lok Nayak Jai Prakash Hospital. Government hospital serving Old Delhi and Central Delhi.', minZoom:12 },
  { id:'poi-ncr-bk-hosp',    category:'government', name:'BK Hospital Faridabad', coords:[28.4093, 77.3080], address:'NIT Faridabad', phone:'0129-222-0000', note:'Main government hospital for Faridabad. Emergency, ICU, trauma care.', minZoom:12 },
  { id:'poi-ncr-esic',       category:'government', name:'ESIC Hospital Faridabad', coords:[28.4260, 77.3020], address:'Sector 7-A, Faridabad', phone:'0129-224-3000', note:'ESIC Medical College and Hospital. Major facility serving Faridabad industrial belt.', minZoom:12 },

  // ── Markets & Commercial ───────────────────────────────────────────────────
  { id:'poi-ncr-chandni',    category:'market',     name:'Chandni Chowk Market', coords:[28.6506, 77.2334], address:'Old Delhi', phone:'—', note:'Oldest market in Delhi. Wholesale hub for textiles, electronics, spices. Near Red Fort.', minZoom:12 },
  { id:'poi-ncr-lajpat-mkt', category:'market',     name:'Lajpat Nagar Market',  coords:[28.5699, 77.2433], address:'Lajpat Nagar Central', phone:'—', note:'Popular South Delhi market. Clothes, household goods. Metro accessible (Pink/Violet Line).', minZoom:13 },
  { id:'poi-ncr-sec18-noida',category:'market',     name:'Sector 18 Market, Noida', coords:[28.5685, 77.3219], address:'Noida Sector 18', phone:'—', note:'Main Noida commercial hub. Malls, restaurants, cinema. Atta Market nearby.', minZoom:13 },

  // ── Government ────────────────────────────────────────────────────────────
  { id:'poi-ncr-parliament',  category:'government', name:'Parliament House',    coords:[28.6171, 77.2088], address:'Sansad Marg', phone:'—', note:'India\'s Parliament. Sansad Marg, New Delhi. Restricted zone.', minZoom:11 },
  { id:'poi-ncr-dc-faridabad',category:'government', name:'DC Office Faridabad', coords:[28.4096, 77.3154], address:'Sector 12, Faridabad', phone:'0129-222-8801', note:'Deputy Commissioner Office. Main civic authority for Faridabad district. Emergency coordination.', minZoom:12 },
  { id:'poi-ncr-civil-faridabad',category:'government', name:'Civil Hospital Faridabad', coords:[28.4010, 77.3110], address:'Old Faridabad', phone:'0129-222-1234', note:'Civil Hospital. Government primary care. Near Old Faridabad bus stand.', minZoom:13 },

  // ── Faridabad & Kabulpur specific ─────────────────────────────────────────
  { id:'poi-ncr-kabulpur-main', category:'market', name:'Kabulpur Village',      coords:[28.4080, 77.3100], address:'Kabulpur, Faridabad', phone:'—', note:'Kabulpur/Kaboolpur village. Located in Old Faridabad area. Key demo location.', minZoom:12 },
  { id:'poi-ncr-crown-plaza',  category:'hotel',   name:'Crown Plaza Faridabad', coords:[28.4086, 77.3178], address:'NH-19, Faridabad', phone:'0129-666-5000', note:'5-star hotel on NH-19. Key navigation reference on the Delhi–Agra highway in Faridabad.', minZoom:12 },
  { id:'poi-ncr-faridabad-rly',category:'infrastructure', name:'Faridabad Railway Station', coords:[28.4075, 77.3121], address:'Old Faridabad', phone:'139', note:'Faridabad Railway Station. Delhi–Mathura line. Important transit reference.', minZoom:11 },
  { id:'poi-ncr-ballabh-rly',  category:'infrastructure', name:'Ballabhgarh Railway Station', coords:[28.3406, 77.3194], address:'Ballabhgarh', phone:'139', note:'Railway station on Delhi–Palwal line. Reference point for southern Faridabad.', minZoom:12 },
  { id:'poi-ncr-neharpar',     category:'viewpoint', name:'Neharpar (Greater Faridabad)', coords:[28.3780, 77.3420], address:'Faridabad', phone:'—', note:'Emerging area beyond the canal. New sectors of Faridabad. Growing residential zone.', minZoom:12 },
  { id:'poi-ncr-surajkund',    category:'viewpoint', name:'Surajkund',           coords:[28.4870, 77.2880], address:'Faridabad–Delhi border', phone:'—', note:'Surajkund Crafts Mela venue. Near Delhi–Faridabad border. Good landmark for GPS reference.', minZoom:12 },
  { id:'poi-ncr-damdama',      category:'viewpoint', name:'Damdama Lake',        coords:[28.3658, 77.0025], address:'Gurgaon–Sohna', phone:'—', note:'Scenic lake near Gurgaon. Weekend destination. Useful GPS waypoint for Gurgaon south.', minZoom:12 },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH INDEX — offline search entries for NCR
// [lat, lng] — Leaflet order
// ─────────────────────────────────────────────────────────────────────────────
import type { SearchEntry } from './joshimath-map-data';
export type { SearchEntry };

export const NCR_SEARCH_INDEX: SearchEntry[] = [
  // Cities
  { id:'ncr-delhi',       name:'New Delhi',          type:'safe_zone', coords:[28.6139, 77.2090] },
  { id:'ncr-faridabad',   name:'Faridabad',          type:'safe_zone', coords:[28.4089, 77.3178] },
  { id:'ncr-noida',       name:'Noida',              type:'safe_zone', coords:[28.5355, 77.3910] },
  { id:'ncr-gurgaon',     name:'Gurugram (Gurgaon)', type:'safe_zone', coords:[28.4595, 77.0266] },
  { id:'ncr-ghaziabad',   name:'Ghaziabad',          type:'safe_zone', coords:[28.6692, 77.4538] },
  { id:'ncr-greaternoida',name:'Greater Noida',      type:'safe_zone', coords:[28.4744, 77.5040] },
  // Faridabad/Kabulpur area
  { id:'ncr-kabulpur',    name:'Kabulpur / Kaboolpur', type:'safe_zone', coords:[28.4080, 77.3120] },
  { id:'ncr-ballabhgarh', name:'Ballabhgarh',         type:'safe_zone', coords:[28.3406, 77.3194] },
  { id:'ncr-nit',         name:'NIT Faridabad',       type:'safe_zone', coords:[28.3907, 77.3176] },
  { id:'ncr-neharpar',    name:'Neharpar Faridabad',  type:'safe_zone', coords:[28.3780, 77.3420] },
  // Hospitals
  { id:'poi-ncr-aiims',       name:'AIIMS New Delhi',         type:'hospital', coords:[28.5672, 77.2100] },
  { id:'poi-ncr-bk-hosp',     name:'BK Hospital Faridabad',   type:'hospital', coords:[28.4093, 77.3080] },
  { id:'poi-ncr-esic',        name:'ESIC Hospital Faridabad',  type:'hospital', coords:[28.4260, 77.3020] },
  { id:'poi-ncr-lnjp',        name:'LNJP Hospital Delhi',     type:'hospital', coords:[28.6360, 77.2470] },
  { id:'poi-ncr-safdarjung',  name:'Safdarjung Hospital',     type:'hospital', coords:[28.5691, 77.2058] },
  // Response
  { id:'poi-ncr-isbt-kashmere', name:'ISBT Kashmere Gate',    type:'response', coords:[28.6682, 77.2302] },
  { id:'poi-ncr-isbt-anand',    name:'ISBT Anand Vihar',      type:'response', coords:[28.6469, 77.3165] },
  { id:'poi-ncr-faridabad-rly', name:'Faridabad Railway Station', type:'response', coords:[28.4075, 77.3121] },
  { id:'poi-ncr-new-delhi-rly', name:'New Delhi Railway Station', type:'response', coords:[28.6414, 77.2196] },
  { id:'poi-ncr-igi',           name:'IGI Airport New Delhi',  type:'response', coords:[28.5562, 77.1000] },
  // Government
  { id:'poi-ncr-dc-faridabad',  name:'DC Office Faridabad',   type:'shelter', coords:[28.4096, 77.3154] },
  { id:'poi-ncr-parliament',    name:'Parliament House',       type:'shelter', coords:[28.6171, 77.2088] },
  // Landmarks
  { id:'poi-ncr-redfort',       name:'Red Fort Delhi',         type:'risk',    coords:[28.6562, 77.2410] },
  { id:'poi-ncr-indiagate',     name:'India Gate',             type:'risk',    coords:[28.6129, 77.2295] },
  { id:'poi-ncr-akshardham',    name:'Akshardham Temple',      type:'risk',    coords:[28.6127, 77.2773] },
  { id:'poi-ncr-surajkund',     name:'Surajkund Faridabad',    type:'risk',    coords:[28.4870, 77.2880] },
];
