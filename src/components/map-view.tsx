import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  Search, X, Navigation, Crosshair, MapPin, ShieldCheck,
  TriangleAlert, HeartPulse, Droplets, BedDouble, Users,
  LifeBuoy, Radio, Layers, Wifi, WifiOff, Hospital, Tent,
  Locate, ChevronDown, Map, Phone, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_META } from '@/types';
import type { AidRequest, Shelter, Volunteer, Resource, RequestCategory } from '@/types';
import type { ResourceOffer } from '@/domain/models/resource-offer';
import { calculateAvailableBeds } from '@/domain/services/shelter-service';

// ── Badrinath / Joshimath data ─────────────────────────────────────────────
import {
  MAP_CENTER, MAP_ZOOM, MAP_ZOOM_MIN, MAP_ZOOM_MAX,
  ROADS_GEOJSON, RIVERS_GEOJSON,
  LANDSLIDE_ZONES_GEOJSON, FLOOD_ZONES_GEOJSON, SAFE_ZONES_GEOJSON,
  EMERGENCY_SHELTERS, HOSPITALS, EMERGENCY_RESPONSE, DISASTER_MARKERS,
  SEARCH_INDEX, PLACE_LABELS, ROAD_LABELS, BUILDINGS_GEOJSON, FAMOUS_POIS,
} from '@/data/joshimath-map-data';

// ── Delhi NCR data ─────────────────────────────────────────────────────────
import {
  NCR_CENTER, NCR_ZOOM, NCR_ZOOM_MIN, NCR_ZOOM_MAX,
  NCR_ROADS_GEOJSON, NCR_RIVERS_GEOJSON, NCR_FLOOD_ZONES_GEOJSON,
  NCR_PLACE_LABELS, NCR_ROAD_LABELS, NCR_FAMOUS_POIS, NCR_SEARCH_INDEX,
} from '@/data/delhi-ncr-map-data';

import type { EmergencyLocation, SearchEntry } from '@/data/joshimath-map-data';
import type { NavDestination } from '@/hooks/use-navigation';

// ─────────────────────────────────────────────────────────────────────────────
// Leaflet default-icon fix (bundler strips the URLs)
// ─────────────────────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
const offlinePinDataUri = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36"><path fill="%23ef4444" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12z"/></svg>`;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: offlinePinDataUri,
  iconUrl:       offlinePinDataUri,
  shadowUrl:     '',
});

// ─────────────────────────────────────────────────────────────────────────────
// Region type
// ─────────────────────────────────────────────────────────────────────────────
export type MapRegion = 'ncr' | 'badrinath';

const REGION_META: Record<MapRegion, {
  label: string; sublabel: string;
  center: [number, number]; zoom: number; zoomMin: number; zoomMax: number;
}> = {
  ncr: {
    label: 'Delhi NCR', sublabel: 'Delhi · Noida · Gurugram · Faridabad',
    center: NCR_CENTER, zoom: NCR_ZOOM, zoomMin: NCR_ZOOM_MIN, zoomMax: NCR_ZOOM_MAX,
  },
  badrinath: {
    label: 'Badrinath / Joshimath', sublabel: 'Chamoli · Uttarakhand · Disaster Region',
    center: MAP_CENTER, zoom: MAP_ZOOM, zoomMin: MAP_ZOOM_MIN, zoomMax: MAP_ZOOM_MAX,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG icon helpers — fully offline, no external URLs
// ─────────────────────────────────────────────────────────────────────────────
function svgIcon(html: string, w: number, h: number): L.DivIcon {
  return L.divIcon({ html, className: '', iconSize:[w,h], iconAnchor:[w/2,h], popupAnchor:[0,-(h-4)] });
}

const pin = (fill: string, symbol: string, uid = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 44" width="36" height="44">
    <defs><filter id="sh${uid}" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.45"/>
    </filter></defs>
    <path d="M18 1C10.82 1 5 6.82 5 14c0 10.5 13 29 13 29s13-18.5 13-29C31 6.82 25.18 1 18 1z"
          fill="${fill}" filter="url(#sh${uid})" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
    <circle cx="18" cy="14" r="8.5" fill="rgba(255,255,255,0.18)"/>
    <text x="18" y="18.5" text-anchor="middle" dominant-baseline="middle"
          font-size="12" font-family="system-ui,sans-serif" fill="white" font-weight="700">${symbol}</text>
  </svg>`;

const ICONS = {
  shelter:  svgIcon(pin('#2563eb','⛺','s'),  36,44),
  hospital: svgIcon(pin('#dc2626','✚','h'),  36,44),
  response: svgIcon(pin('#d97706','★','r'),  36,44),
  risk:     svgIcon(pin('#b91c1c','!','rk'), 36,44),
  safe:     svgIcon(pin('#16a34a','✓','sf'), 36,44),
  gps: svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
      <circle cx="14" cy="14" r="13" fill="#3b82f6" opacity="0.18"/>
      <circle cx="14" cy="14" r="7"  fill="#3b82f6" opacity="0.5"/>
      <circle cx="14" cy="14" r="4"  fill="#3b82f6"/>
      <circle cx="14" cy="14" r="2"  fill="white"/>
    </svg>`, 28, 28,
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — dark (default) and light variants
// ─────────────────────────────────────────────────────────────────────────────
const DARK = {
  highway:'#c8d4e8', majorRoad:'#8fa3bc', minorRoad:'#5c7080',
  highwayCasing: '#0f2a3d',
  river:'#38bdf8', stream:'#7dd3fc', riverGlow:'#0369a1',
  slideCrit:'#f97316', slideHigh:'#fb923c', slideMod:'#fbbf24',
  floodCrit:'#1d4ed8', floodHigh:'#2563eb', floodMod:'#3b82f6',
  safe:'#16a34a',
  bgDeep:'#0c1827', bgMid:'#122033', bgHill:'#1a2d40',
  labelBg:'rgba(10,22,36,0.82)',      labelBorder:'rgba(59,130,246,0.4)',
  labelColor:'#f1f5f9',               labelSub:'#64a8cc',
  roadBadgeBg:'rgba(12,42,62,0.92)',  roadBadgeBorder:'rgba(200,212,232,0.5)',
  roadBadgeColor:'#c8d4e8',
};

const LIGHT = {
  highway:'#1e3a5f', majorRoad:'#374e6a', minorRoad:'#5a6e82',
  highwayCasing: '#ffffff',
  river:'#0369a1', stream:'#0284c7', riverGlow:'#bae6fd',
  slideCrit:'#c2410c', slideHigh:'#ea580c', slideMod:'#d97706',
  floodCrit:'#1e40af', floodHigh:'#1d4ed8', floodMod:'#2563eb',
  safe:'#15803d',
  bgDeep:'#c8dce8', bgMid:'#d4e6f0', bgHill:'#bdd0dc',
  labelBg:'rgba(255,255,255,0.93)',   labelBorder:'rgba(30,58,95,0.35)',
  labelColor:'#0f172a',               labelSub:'#1e3a5f',
  roadBadgeBg:'rgba(255,255,255,0.96)', roadBadgeBorder:'rgba(30,58,95,0.40)',
  roadBadgeColor:'#1e3a5f',
};

// kept for backward-compat with any inline references
const C = DARK;

// ─────────────────────────────────────────────────────────────────────────────
// Layer visibility — shared across both regions
// ─────────────────────────────────────────────────────────────────────────────
interface LayerVisibility {
  roads:boolean; rivers:boolean;
  landslides:boolean; floods:boolean; safeZones:boolean;
  shelters:boolean; hospitals:boolean; response:boolean;
  risks:boolean; requests:boolean; volunteers:boolean; resources:boolean; labels:boolean;
  buildings:boolean; pois:boolean;
}

const DEFAULT_LAYERS: LayerVisibility = {
  roads:true, rivers:true, landslides:true, floods:true, safeZones:true,
  shelters:true, hospitals:true, response:true, risks:true, requests:true,
  volunteers:true, resources:true,
  labels:true, buildings:true, pois:true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface MapViewProps {
  requests: AidRequest[];
  shelters?: Shelter[];
  volunteers?: Volunteer[];
  resources?: Resource[];
  resourceOffers?: ResourceOffer[];
  isOnline: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  region: MapRegion;
  theme?: 'dark' | 'light';
  navDestination?: NavDestination | null;
  showFallbackToggle?: boolean;
}

const REQ_ICON_MAP: Record<RequestCategory, typeof HeartPulse> = {
  medical:HeartPulse, food:Droplets, shelter:BedDouble, volunteers:Users, rescue:LifeBuoy,
};

// ─────────────────────────────────────────────────────────────────────────────
// Emergency location popup builder
// ─────────────────────────────────────────────────────────────────────────────
function buildPopupHtml(loc: EmergencyLocation): string {
  const sc = loc.status==='open'?'#22c55e':loc.status==='danger'?'#ef4444':
             loc.status==='warning'?'#f59e0b':loc.status==='full'?'#f97316':'#94a3b8';
  const pct = loc.capacity && loc.occupied!=null
    ? Math.round((loc.occupied/loc.capacity)*100) : null;
  const bar = pct!=null ? `
    <div style="margin:10px 0 4px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:4px">
        <span>${loc.occupied}/${loc.capacity} beds used</span>
        <span style="color:${pct>80?'#f97316':'#22c55e'}">${pct}%</span>
      </div>
      <div style="height:6px;background:#1e3a52;border-radius:4px;overflow:hidden">
        <div style="height:6px;width:${pct}%;background:${pct>80?'#f97316':'#22c55e'};border-radius:4px"></div>
      </div>
    </div>` : '';
  const chips = loc.amenities.length ? `
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
      ${loc.amenities.map(a=>`<span style="background:#162840;border:1px solid #2a4a68;
        border-radius:5px;padding:2px 7px;font-size:10px;color:#93c5fd">${a}</span>`).join('')}
    </div>` : '';
  return `
    <div style="width:240px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700;color:#f1f5f9;line-height:1.35">${loc.name}</span>
        <span style="flex-shrink:0;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;
          text-transform:uppercase;background:${sc}1a;color:${sc};border:1px solid ${sc}40;white-space:nowrap">
          ${loc.status}</span>
      </div>
      <p style="font-size:11px;color:#8fb4d4;margin:0 0 4px;line-height:1.6">${loc.details}</p>
      ${bar}${chips}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #1e3a52;
        display:flex;align-items:center;gap:6px;font-size:11px;color:#5d8aaa">
        <span>📞</span>
        <a href="tel:${loc.phone.replace(/[\s\-().]/g,'')}" style="color:#38bdf8;text-decoration:none"
           onclick="event.stopPropagation()">${loc.phone}</a>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared map-building helpers (called for both regions)
// ─────────────────────────────────────────────────────────────────────────────

/** Render roads GeoJSON into a layer group using casing+fill for highways */
function buildRoadsGroup(
  map: L.Map,
  geojson: GeoJSON.FeatureCollection,
  pane: string,
  P = DARK,
): L.LayerGroup {
  const group = L.layerGroup();
  geojson.features.forEach(f => {
    const p = f.properties as { name:string; width:string };
    const isHwy = p.width === 'primary';
    const isSec = p.width === 'secondary';
    if (isHwy) {
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color: P.highwayCasing, weight:7, opacity:0.9, lineCap:'round', lineJoin:'round' },
      }).addTo(group);
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color: P.highway, weight:4, opacity:1, lineCap:'round', lineJoin:'round' },
      })
      .bindTooltip(`<div class="tt-row"><span class="tt-hwy">HWY</span>${p.name}</div>`,
        { sticky:true, className:'map-tt', direction:'top' })
      .addTo(group);
    } else if (isSec) {
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color: P.majorRoad, weight:2.5, opacity:0.9, lineCap:'round', lineJoin:'round' },
      })
      .bindTooltip(`<div class="tt-row">${p.name}</div>`,
        { sticky:true, className:'map-tt', direction:'top' })
      .addTo(group);
    } else {
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color: P.minorRoad, weight:1.5, opacity:0.75, dashArray:'5 4',
                     lineCap:'round', lineJoin:'round' },
      })
      .bindTooltip(`<div class="tt-row">${p.name}</div>`,
        { sticky:true, className:'map-tt', direction:'top' })
      .addTo(group);
    }
  });
  return group;
}

/** Render rivers GeoJSON with glow casing */
function buildRiversGroup(
  map: L.Map,
  geojson: GeoJSON.FeatureCollection,
  pane: string,
  P = DARK,
): L.LayerGroup {
  const group = L.layerGroup();
  geojson.features.forEach(f => {
    const p = f.properties as { name:string; type:string };
    const isStream = p.type === 'stream' || p.type === 'wetland';
    if (!isStream) {
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color: P.riverGlow, weight:6, opacity:0.35, lineCap:'round' },
      }).addTo(group);
    }
    L.geoJSON(f as GeoJSON.Feature, {
      pane, style:{
        color: isStream ? P.stream : P.river,
        weight: isStream ? 1.5 : 3, opacity: isStream ? 0.8 : 1,
        dashArray: isStream ? '4 4' : undefined, lineCap:'round',
      },
    })
    .bindTooltip(
      `<div class="tt-row"><span class="tt-dot" style="background:${P.river}"></span>${p.name}</div>`,
      { sticky:true, className:'map-tt', direction:'top' },
    )
    .addTo(group);
  });
  return group;
}

/** Render flood / hazard polygon zones */
function buildFloodGroup(
  map: L.Map,
  geojson: GeoJSON.FeatureCollection,
  pane: string,
  P = DARK,
): L.LayerGroup {
  const group = L.layerGroup();
  geojson.features.forEach(f => {
    const p = f.properties as { name:string; severity:string; description:string };
    const col = p.severity==='critical'? P.floodCrit : p.severity==='high'? P.floodHigh : P.floodMod;
    L.geoJSON(f as GeoJSON.Feature, {
      pane, style:{ color:col, fillColor:col, fillOpacity:0.22, weight:2, opacity:0.8, dashArray:'8 5' },
    })
    .bindTooltip(
      `<div class="tt-row"><span class="tt-dot" style="background:${col}"></span>
       <b>Flood Zone · ${p.severity.toUpperCase()}</b></div>${p.name}
       <div class="tt-sub">${(p.description||'').slice(0,80)}…</div>`,
      { sticky:true, className:'map-tt map-tt-wide', direction:'top' },
    )
    .addTo(group);
  });
  return group;
}

/** Place label DivIcon markers, zoom-gated */
function buildPlaceLabels(
  map: L.Map,
  labels: import('@/data/joshimath-map-data').PlaceLabel[],
  pane: string,
  P = DARK,
): L.LayerGroup {
  const group = L.layerGroup();
  type LS = { fontSize:number; fontWeight:string; color:string; subColor:string; subSize:number;
               bg:string; border:string; radius:number; px:number; py:number;
               shadowBlur:number; shadowColor:string; letterSpacing:string;
               iconChar?:string; iconColor?:string; };

  // Shared shadow depends on theme
  const sh = P === LIGHT ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.75)';

  const TS: Record<string,LS> = {
    city:      { fontSize:14, fontWeight:'800', color: P.labelColor,   subColor: P.labelSub, subSize:9.5,
                 bg: P.labelBg, border:`1px solid ${P.labelBorder}`,
                 radius:6, px:7, py:3, shadowBlur:10, shadowColor:sh, letterSpacing:'0.02em' },
    town:      { fontSize:11.5, fontWeight:'700', color: P.labelColor, subColor: P.labelSub, subSize:9,
                 bg: P === LIGHT ? 'rgba(255,255,255,0.88)' : 'rgba(10,22,36,0.75)',
                 border:`1px solid ${P.labelBorder}`,
                 radius:5, px:6, py:2.5, shadowBlur:7, shadowColor:sh, letterSpacing:'0.01em' },
    village:   { fontSize:10, fontWeight:'600',
                 color: P === LIGHT ? '#1e3a5f' : '#cbd5e1',
                 subColor: P === LIGHT ? '#374e6a' : '#4a6a82', subSize:8.5,
                 bg: P === LIGHT ? 'rgba(255,255,255,0.82)' : 'rgba(10,22,36,0.65)',
                 border: P === LIGHT ? '1px solid rgba(30,58,95,0.25)' : '1px solid rgba(35,70,100,0.3)',
                 radius:4, px:5, py:2, shadowBlur:5, shadowColor:sh, letterSpacing:'0em' },
    locality:  { fontSize:9.5, fontWeight:'600',
                 color: P === LIGHT ? '#374e6a' : '#94a3b8',
                 subColor: P === LIGHT ? '#4a5e72' : '#3a5a72', subSize:8,
                 bg: P === LIGHT ? 'rgba(255,255,255,0.78)' : 'rgba(10,22,36,0.60)',
                 border: P === LIGHT ? '1px solid rgba(30,58,95,0.20)' : '1px solid rgba(30,58,82,0.25)',
                 radius:4, px:5, py:2, shadowBlur:4, shadowColor:sh, letterSpacing:'0em' },
    landmark:  { fontSize:10, fontWeight:'600',
                 color: P === LIGHT ? '#92400e' : '#fbbf24',
                 subColor: P === LIGHT ? '#78716c' : '#78716c', subSize:8.5,
                 bg: P === LIGHT ? 'rgba(255,251,235,0.92)' : 'rgba(10,18,28,0.72)',
                 border: P === LIGHT ? '1px solid rgba(146,64,14,0.30)' : '1px solid rgba(251,191,36,0.25)',
                 radius:4, px:5, py:2, shadowBlur:5, shadowColor:sh, letterSpacing:'0em',
                 iconChar:'◆', iconColor: P === LIGHT ? '#b45309' : '#fbbf24' },
    confluence:{ fontSize:10, fontWeight:'700',
                 color: P === LIGHT ? '#0369a1' : '#38bdf8',
                 subColor: P === LIGHT ? '#0369a1' : '#0e4a6a', subSize:8.5,
                 bg: P === LIGHT ? 'rgba(239,248,255,0.92)' : 'rgba(7,18,28,0.72)',
                 border: P === LIGHT ? '1px solid rgba(3,105,161,0.30)' : '1px solid rgba(56,189,248,0.3)',
                 radius:4, px:5, py:2, shadowBlur:5, shadowColor:sh, letterSpacing:'0em',
                 iconChar:'~', iconColor: P === LIGHT ? '#0369a1' : '#38bdf8' },
    pass:      { fontSize:10, fontWeight:'600',
                 color: P === LIGHT ? '#374151' : '#a3b4c2',
                 subColor: P === LIGHT ? '#4a5568' : '#4a6070', subSize:8.5,
                 bg: P === LIGHT ? 'rgba(248,250,252,0.90)' : 'rgba(10,20,30,0.65)',
                 border: P === LIGHT ? '1px solid rgba(55,65,81,0.25)' : '1px solid rgba(80,110,140,0.25)',
                 radius:4, px:5, py:2, shadowBlur:4, shadowColor:sh, letterSpacing:'0.02em',
                 iconChar:'▲', iconColor: P === LIGHT ? '#374151' : '#a3b4c2' },
    glacier:   { fontSize:10, fontWeight:'600',
                 color: P === LIGHT ? '#0c4a6e' : '#bae6fd',
                 subColor: P === LIGHT ? '#0369a1' : '#1a4a60', subSize:8.5,
                 bg: P === LIGHT ? 'rgba(240,249,255,0.92)' : 'rgba(8,18,28,0.70)',
                 border: P === LIGHT ? '1px solid rgba(12,74,110,0.30)' : '1px solid rgba(186,230,253,0.25)',
                 radius:4, px:5, py:2, shadowBlur:4, shadowColor:sh, letterSpacing:'0em',
                 iconChar:'❄', iconColor: P === LIGHT ? '#0c4a6e' : '#bae6fd' },
  };
  labels.forEach(place => {
    const st = TS[place.tier] ?? TS.village;
    const minZ = place.minZoom ?? 10;
    const iconPart = st.iconChar ? `<span style="margin-right:4px;font-size:${st.fontSize-2}px;color:${st.iconColor}">${st.iconChar}</span>` : '';
    const subPart  = place.subtext ? `<div style="font-size:${st.subSize}px;color:${st.subColor};margin-top:1px;line-height:1.2;font-weight:500">${place.subtext}</div>` : '';
    const dotPart  = (place.tier==='city'||place.tier==='town')
      ? `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${place.tier==='city'?'#3b82f6':'#475569'};margin-right:5px;vertical-align:middle;flex-shrink:0"></span>` : '';
    const html = `<div style="display:inline-flex;flex-direction:column;align-items:flex-start;
      background:${st.bg};border:${st.border};border-radius:${st.radius}px;padding:${st.py}px ${st.px}px;
      box-shadow:0 2px ${st.shadowBlur}px ${st.shadowColor};backdrop-filter:blur(6px);
      pointer-events:none;user-select:none;white-space:nowrap;">
      <div style="display:flex;align-items:center;line-height:1.25">${dotPart}${iconPart}
        <span style="font-family:'Inter',system-ui,sans-serif;font-size:${st.fontSize}px;
          font-weight:${st.fontWeight};color:${st.color};letter-spacing:${st.letterSpacing}">${place.name}</span>
      </div>${subPart}</div>`;
    const icon = L.divIcon({ html, className:`place-label place-label-${place.tier}`,
      iconSize:undefined as unknown as L.PointExpression, iconAnchor:[0,0] });
    const marker = L.marker(place.coords, { icon, pane,
      zIndexOffset:place.tier==='city'?1000:place.tier==='town'?500:0,
      interactive:false, keyboard:false });
    marker.addTo(group);
    map.on('zoomend', () => { const el=marker.getElement(); if(el) el.style.display=map.getZoom()>=minZ?'':'none'; });
    marker.once('add', () => { const el=marker.getElement(); if(el) el.style.display=map.getZoom()>=minZ?'':'none'; });
  });
  return group;
}

/** Road name badge labels */
function buildRoadLabels(
  map: L.Map,
  roadLabels: import('@/data/joshimath-map-data').RoadLabel[],
  pane: string,
  P = DARK,
): L.LayerGroup {
  const group = L.layerGroup();
  roadLabels.forEach(rl => {
    const isHwy = rl.type==='highway';
    const isSec = rl.type==='secondary';
    const bg    = isHwy ? P.roadBadgeBg
                : isSec ? (P === LIGHT ? 'rgba(248,250,252,0.94)' : 'rgba(10,28,46,0.88)')
                :          (P === LIGHT ? 'rgba(241,245,249,0.90)' : 'rgba(8,22,36,0.82)');
    const border = isHwy ? `1px solid ${P.roadBadgeBorder}`
                 : isSec  ? (P === LIGHT ? '1px solid rgba(55,78,106,0.35)' : '1px solid rgba(143,163,188,0.4)')
                 :           (P === LIGHT ? '1px solid rgba(90,110,130,0.28)' : '1px solid rgba(92,112,128,0.35)');
    const color  = isHwy ? P.roadBadgeColor
                 : isSec  ? P.majorRoad
                 :           P.minorRoad;
    const shieldBg    = P === LIGHT ? 'rgba(30,58,95,0.12)' : 'rgba(59,130,246,0.25)';
    const shieldBorder= P === LIGHT ? '1px solid rgba(30,58,95,0.35)' : '1px solid rgba(59,130,246,0.4)';
    const shieldColor = P === LIGHT ? '#1e3a5f' : '#93c5fd';
    const shield = isHwy
      ? `<span style="display:inline-flex;align-items:center;justify-content:center;
          background:${shieldBg};border:${shieldBorder};
          border-radius:3px;padding:0 4px;margin-right:4px;
          font-size:9px;font-weight:800;color:${shieldColor};line-height:1.4">${rl.short}</span>` : '';
    const label = isHwy ? '' : `<span style="font-size:${isSec?10:9}px;color:${color};font-weight:${isHwy?'700':'600'}">${rl.short}</span>`;
    const html = `<div style="display:inline-flex;align-items:center;background:${bg};border:${border};
      border-radius:4px;padding:2px 6px;box-shadow:0 1px 5px rgba(0,0,0,${P===LIGHT?'0.14':'0.5'});
      backdrop-filter:blur(4px);pointer-events:none;user-select:none;white-space:nowrap;
      transform:rotate(${rl.rotation??0}deg);font-family:'Inter',system-ui,sans-serif;">
      ${shield}${label}</div>`;
    const icon = L.divIcon({ html, className:'road-label',
      iconSize:undefined as unknown as L.PointExpression, iconAnchor:[0,0] });
    const marker = L.marker(rl.coords, { icon, pane, interactive:false, keyboard:false });
    const minZ = rl.minZoom??12;
    marker.addTo(group);
    map.on('zoomend', ()=>{ const el=marker.getElement(); if(el) el.style.display=map.getZoom()>=minZ?'':'none'; });
    marker.once('add', ()=>{ const el=marker.getElement(); if(el) el.style.display=map.getZoom()>=minZ?'':'none'; });
  });
  return group;
}

/** Famous POI icon markers */
function buildPoisGroup(
  map: L.Map,
  pois: import('@/data/joshimath-map-data').FamousPoi[],
  pane: string,
): L.LayerGroup {
  const IC: Record<string,{sym:string;bg:string;border:string;textColor:string}> = {
    temple:        {sym:'🛕',bg:'rgba(146,64,14,0.85)',  border:'rgba(217,119,6,0.7)',  textColor:'#fde68a'},
    gurudwara:     {sym:'🏯',bg:'rgba(3,84,63,0.85)',    border:'rgba(6,182,212,0.5)',  textColor:'#a7f3d0'},
    government:    {sym:'🏛',bg:'rgba(5,46,22,0.85)',    border:'rgba(34,197,94,0.5)',  textColor:'#86efac'},
    school:        {sym:'🏫',bg:'rgba(7,89,133,0.85)',   border:'rgba(56,189,248,0.5)', textColor:'#bae6fd'},
    market:        {sym:'🏪',bg:'rgba(66,32,6,0.85)',    border:'rgba(234,179,8,0.5)',  textColor:'#fef08a'},
    hotel:         {sym:'🏨',bg:'rgba(30,27,75,0.85)',   border:'rgba(139,92,246,0.5)', textColor:'#ddd6fe'},
    infrastructure:{sym:'⚡',bg:'rgba(30,27,30,0.85)',   border:'rgba(161,161,170,0.5)',textColor:'#d4d4d8'},
    viewpoint:     {sym:'🔭',bg:'rgba(5,46,22,0.85)',    border:'rgba(52,211,153,0.5)', textColor:'#6ee7b7'},
    bus_stand:     {sym:'🚌',bg:'rgba(12,74,110,0.85)',  border:'rgba(14,165,233,0.5)', textColor:'#7dd3fc'},
    bank:          {sym:'🏦',bg:'rgba(5,46,22,0.85)',    border:'rgba(34,197,94,0.5)',  textColor:'#86efac'},
    post_office:   {sym:'📮',bg:'rgba(127,29,29,0.85)',  border:'rgba(248,113,113,0.5)',textColor:'#fca5a5'},
    locality:      {sym:'📍',bg:'rgba(30,40,60,0.85)',   border:'rgba(100,130,180,0.5)',textColor:'#93c5fd'},
  };
  const group = L.layerGroup();
  pois.forEach(poi => {
    const ic = IC[poi.category] ?? IC.government;
    const minZ = poi.minZoom??13;
    const iconHtml = `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
      <div style="width:28px;height:28px;border-radius:8px;background:${ic.bg};border:1.5px solid ${ic.border};
        display:flex;align-items:center;justify-content:center;font-size:14px;
        box-shadow:0 3px 10px rgba(0,0,0,0.55);">${ic.sym}</div>
      <div style="margin-top:2px;background:rgba(8,18,30,0.88);border:1px solid rgba(30,58,82,0.5);
        border-radius:3px;padding:1px 5px;font-family:'Inter',system-ui,sans-serif;
        font-size:8.5px;font-weight:600;color:${ic.textColor};white-space:nowrap;
        max-width:90px;overflow:hidden;text-overflow:ellipsis;">${poi.name}</div>
    </div>`;
    const popup = `<div style="width:230px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:32px;height:32px;border-radius:8px;background:${ic.bg};border:1.5px solid ${ic.border};
          display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">${ic.sym}</div>
        <div><p style="font-size:13px;font-weight:700;color:#f1f5f9;margin:0;line-height:1.3">${poi.name}</p>
          <p style="font-size:10px;color:${ic.textColor};margin:0;text-transform:capitalize">${poi.category.replace('_',' ')}</p>
        </div></div>
      ${poi.address?`<p style="font-size:10px;color:#64748b;margin:0 0 6px">📍 ${poi.address}</p>`:''}
      <p style="font-size:11px;color:#8fb4d4;margin:0 0 8px;line-height:1.6">${poi.note}</p>
      ${poi.phone&&poi.phone!=='—'?`<div style="padding-top:8px;border-top:1px solid #1e3a52;
        display:flex;align-items:center;gap:6px;font-size:11px;color:#5d8aaa">
        <span>📞</span><span style="color:#93c5fd">${poi.phone}</span></div>`:''}
    </div>`;
    const marker = L.marker(poi.coords, {
      icon:L.divIcon({html:iconHtml,className:'poi-marker',iconSize:[28,46],iconAnchor:[14,28],popupAnchor:[0,-32]}),
      pane, zIndexOffset:100,
    }).bindPopup(popup,{className:'map-popup',maxWidth:260});
    marker.addTo(group);
    map.on('zoomend',()=>{const el=marker.getElement();if(el)el.style.display=map.getZoom()>=minZ?'':'none';});
    marker.once('add',()=>{const el=marker.getElement();if(el)el.style.display=map.getZoom()>=minZ?'':'none';});
  });
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// MapView component
// ─────────────────────────────────────────────────────────────────────────────
export function MapView({
  requests,
  shelters = [],
  volunteers = [],
  resources = [],
  resourceOffers = [],
  isOnline,
  selectedId,
  onSelect,
  region,
  theme,
  navDestination,
  showFallbackToggle = false,
}: MapViewProps) {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<L.Map | null>(null);
  const groupsRef      = useRef<Record<string, L.LayerGroup>>({});
  const reqMarkersRef  = useRef<Record<string, L.Marker>>({});
  const gpsMarkerRef   = useRef<L.Marker | null>(null);
  const destMarkerRef  = useRef<L.Marker | null>(null);
  const watchIdRef     = useRef<number | null>(null);  // watchPosition ID for cleanup

  // Directions overlay state (extended with live navigation fields)
  const [dirInfo, setDirInfo] = useState<{
    dest: NavDestination;
    distanceKm: number | null;
    bearing: string | null;
    userCoords: [number, number] | null;
    etaMinutes: number | null;
    isNavActive: boolean;
  } | null>(null);

  // Region state is now controlled from outside — no local region state
  const [_regionMenuOpen, _setRegionMenuOpen] = useState(false); // kept for future use

  // Layer / UI state
  const [layers,       setLayers]       = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [legendOpen,   setLegendOpen]   = useState(true);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchResults,setSearchResults]= useState<SearchEntry[]>([]);
  const [selLoc,       setSelLoc]       = useState<EmergencyLocation | null>(null);
  const [gpsActive,    setGpsActive]    = useState(false);
  const [gpsError,     setGpsError]     = useState<string | null>(null);

  const rmeta = REGION_META[region];

  // ── Core map initialiser — re-runs when `region` changes ─────────────────
  useEffect(() => {
    // Destroy existing map instance
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    groupsRef.current  = {};
    reqMarkersRef.current = {};
    gpsMarkerRef.current  = null;
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: rmeta.center, zoom: rmeta.zoom,
      minZoom: rmeta.zoomMin, maxZoom: rmeta.zoomMax,
      zoomControl:false, attributionControl:false,
      preferCanvas:true,
    });

    // Detect current theme — pick palette accordingly
    const isLight = theme === 'light';
    const P = isLight ? LIGHT : DARK;

    containerRef.current.style.background =
      `radial-gradient(ellipse at 60% 40%, ${P.bgHill} 0%, ${P.bgMid} 45%, ${P.bgDeep} 100%)`;

    // Topo texture overlay (local SVG — no network)
    const terrainSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <pattern id="topo" width="80" height="80" patternUnits="userSpaceOnUse">
          <ellipse cx="40" cy="40" rx="36" ry="22" fill="none" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>
          <ellipse cx="40" cy="40" rx="24" ry="14" fill="none" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>
        </pattern>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0L0 0 0 40" fill="none" stroke="#ffffff" stroke-width="0.25" opacity="0.025"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)"/>
      <rect width="100%" height="100%" fill="url(#topo)"/>
    </svg>`;
    const terrainPane = map.createPane('terrain');
    terrainPane.style.zIndex = '100';
    terrainPane.style.pointerEvents = 'none';
    L.svgOverlay(
      new DOMParser().parseFromString(terrainSvg,'image/svg+xml').documentElement as unknown as SVGElement,
      map.getBounds().pad(10),
      { pane:'terrain', interactive:false, opacity:1 },
    ).addTo(map);

    // Custom z-ordered panes
    const hazardPane = map.createPane('hazard'); hazardPane.style.zIndex = '200';
    const bldPane    = map.createPane('buildings'); bldPane.style.zIndex = '280';
    const roadPane   = map.createPane('road');   roadPane.style.zIndex  = '300';
    const waterPane  = map.createPane('water');  waterPane.style.zIndex = '310';
    const rlPane     = map.createPane('roadLabels'); rlPane.style.zIndex= '320'; rlPane.style.pointerEvents='none';
    const labPane    = map.createPane('labels'); labPane.style.zIndex   = '350'; labPane.style.pointerEvents='none';
    const poiPane    = map.createPane('pois');   poiPane.style.zIndex   = '390';
    const mrkPane    = map.createPane('markerLayer'); mrkPane.style.zIndex='400';

    L.control.attribution({prefix:false})
      .addAttribution(`<span style="opacity:.4">Offline · ${rmeta.label}</span>`)
      .addTo(map);

    // ── Roads ──
    const roadsGroup = buildRoadsGroup(map, region==='ncr' ? NCR_ROADS_GEOJSON : ROADS_GEOJSON, 'road', P);

    // ── Rivers ──
    const riversGroup = buildRiversGroup(map, region==='ncr' ? NCR_RIVERS_GEOJSON : RIVERS_GEOJSON, 'water', P);

    // ── Flood zones ──
    const floodsGroup = buildFloodGroup(map, region==='ncr' ? NCR_FLOOD_ZONES_GEOJSON : FLOOD_ZONES_GEOJSON, 'hazard', P);

    // ── Badrinath-only hazard layers ──
    const landslidesGroup = L.layerGroup();
    const safeGroup       = L.layerGroup();
    if (region === 'badrinath') {
      LANDSLIDE_ZONES_GEOJSON.features.forEach(f => {
        const p = f.properties as {name:string;severity:string;description:string};
        const col = p.severity==='critical'?P.slideCrit:p.severity==='high'?P.slideHigh:P.slideMod;
        L.geoJSON(f as GeoJSON.Feature, {
          pane:'hazard', style:{color:col,fillColor:col,fillOpacity:0.22,weight:2,opacity:0.8},
        })
        .bindTooltip(`<div class="tt-row"><span class="tt-dot" style="background:${col}"></span>
          <b>Landslide · ${p.severity.toUpperCase()}</b></div>${p.name}
          <div class="tt-sub">${p.description.slice(0,80)}…</div>`,
          {sticky:true,className:'map-tt map-tt-wide',direction:'top'})
        .addTo(landslidesGroup);
      });
      SAFE_ZONES_GEOJSON.features.forEach(f => {
        const p = f.properties as {name:string;description:string;capacity:number};
        L.geoJSON(f as GeoJSON.Feature, {
          pane:'hazard', style:{color:P.safe,fillColor:P.safe,fillOpacity:0.12,weight:1.5,opacity:0.7,dashArray:'6 4'},
        })
        .bindTooltip(`<div class="tt-row"><span class="tt-dot" style="background:${P.safe}"></span>
          <b>Safe Zone</b></div>${p.name}`,
          {sticky:true,className:'map-tt',direction:'top'})
        .addTo(safeGroup);
      });
    }

    // ── Emergency markers (Badrinath only) ──
    const sheltersGroup  = L.layerGroup();
    const hospitalsGroup = L.layerGroup();
    const responseGroup  = L.layerGroup();
    const risksGroup     = L.layerGroup();
    if (region === 'badrinath') {
      const addM = (locs: EmergencyLocation[], icon: L.DivIcon, grp: L.LayerGroup) =>
        locs.forEach(loc => L.marker(loc.coords,{icon,pane:'markerLayer',zIndexOffset:200})
          .bindPopup(buildPopupHtml(loc),{className:'map-popup',maxWidth:280}).addTo(grp));
      addM(EMERGENCY_SHELTERS, ICONS.shelter,  sheltersGroup);
      addM(HOSPITALS,          ICONS.hospital, hospitalsGroup);
      addM(EMERGENCY_RESPONSE, ICONS.response, responseGroup);
      addM(DISASTER_MARKERS,   ICONS.risk,     risksGroup);
    }

    // ── Building footprints (Badrinath only) ──
    const buildingsGroup = L.layerGroup();
    if (region === 'badrinath') {
      const BLD_COLORS: Record<string,{fill:string;stroke:string}> = isLight ? {
        residential:{fill:'#dbeafe',stroke:'#2563eb'},government:{fill:'#dcfce7',stroke:'#16a34a'},
        commercial:{fill:'#fef9c3',stroke:'#ca8a04'},religious:{fill:'#ffedd5',stroke:'#c2410c'},
        educational:{fill:'#e0f2fe',stroke:'#0369a1'},medical:{fill:'#fee2e2',stroke:'#dc2626'},
        military:{fill:'#d1fae5',stroke:'#059669'},utility:{fill:'#f3e8ff',stroke:'#7c3aed'},
      } : {
        residential:{fill:'#1a3a5c',stroke:'#2a5a82'},government:{fill:'#1a3a2c',stroke:'#2a6a4a'},
        commercial:{fill:'#2a2a10',stroke:'#6a5a1a'},religious:{fill:'#2a1a08',stroke:'#b45309'},
        educational:{fill:'#0a2a3a',stroke:'#1e6a8a'},medical:{fill:'#1a0808',stroke:'#dc2626'},
        military:{fill:'#101a10',stroke:'#4a7a4a'},utility:{fill:'#1a1a2a',stroke:'#4a4a8a'},
      };
      type BP={id:string;name:string;type:string;floors?:number;note?:string;cracked?:boolean};
      BUILDINGS_GEOJSON.features.forEach(f => {
        const p=f.properties as BP;
        const col=BLD_COLORS[p.type]??{fill:'#1a2a3a',stroke:'#3a5a72'};
        const crack=p.cracked===true;
        L.geoJSON(f as GeoJSON.Feature,{pane:'buildings',style:{
          fillColor:crack?'#7c2020':col.fill,color:crack?'#ef4444':col.stroke,
          weight:crack?1.5:1,fillOpacity:0.75,opacity:1,dashArray:crack?'4 2':undefined,
        }})
        .bindTooltip(`<div class="tt-row"><span class="tt-dot" style="background:${crack?'#ef4444':col.stroke}"></span>
          <b>${p.name}</b></div>
          <div style="font-size:10px;color:#5d8aaa;margin-top:2px">${p.type}${p.floors?' · '+p.floors+' fl':''}</div>
          ${crack?'<div style="margin-top:5px;padding:3px 7px;background:#7c202060;border:1px solid #ef444460;border-radius:4px;font-size:10px;color:#ef4444;font-weight:700">⚠ CRACKED</div>':''}
          <div class="tt-sub">${p.note??''}</div>`,
          {sticky:true,className:'map-tt map-tt-wide',direction:'top'})
        .addTo(buildingsGroup);
      });
      map.on('zoomend',()=>{ const el=map.getPane('buildings'); if(el)el.style.display=map.getZoom()>=13?'':'none'; });
      const bpe=map.getPane('buildings'); if(bpe)bpe.style.display=map.getZoom()>=13?'':'none';
    }

    // ── Place labels ──
    const pl = region==='ncr' ? NCR_PLACE_LABELS : PLACE_LABELS;
    const labelsGroup = buildPlaceLabels(map, pl, 'labels', P);

    // ── Road labels ──
    const rl = region==='ncr' ? NCR_ROAD_LABELS : ROAD_LABELS;
    const roadLabelsGroup = buildRoadLabels(map, rl, 'roadLabels', P);

    // ── POI markers ──
    const pm = region==='ncr' ? NCR_FAMOUS_POIS : FAMOUS_POIS;
    const poisGroup = buildPoisGroup(map, pm, 'pois');

    // ── Aid request markers (empty — filled by separate effect) ──
    const requestsGroup = L.markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 40,
    });

    const volunteersGroup = L.layerGroup();
    const resourcesGroup = L.layerGroup();

    groupsRef.current = {
      safeZones:safeGroup, floods:floodsGroup, landslides:landslidesGroup,
      roads:roadsGroup, rivers:riversGroup,
      shelters:sheltersGroup, hospitals:hospitalsGroup,
      response:responseGroup, risks:risksGroup, requests:requestsGroup,
      volunteers:volunteersGroup, resources:resourcesGroup,
      labels:labelsGroup, roadLabels:roadLabelsGroup,
      buildings:buildingsGroup, pois:poisGroup,
    };
    Object.values(groupsRef.current).forEach(g => g.addTo(map));

    // Honour current layer visibility state
    Object.entries(layers).forEach(([key,on]) => {
      const g = groupsRef.current[key];
      if (!g) return;
      if (!on) map.removeLayer(g);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [region, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entities markers (requests, shelters, volunteers, resources) ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const reqGroup = groupsRef.current['requests'];
    const sheltGroup = groupsRef.current['shelters'];
    const volGroup = groupsRef.current['volunteers'];
    const resGroup = groupsRef.current['resources'];

    if (reqGroup) reqGroup.clearLayers();
    if (sheltGroup) sheltGroup.clearLayers();
    if (volGroup) volGroup.clearLayers();
    if (resGroup) resGroup.clearLayers();
    reqMarkersRef.current = {};
    const center = rmeta.center;

    // Helper to calculate lat/lng safely and NEVER fabricate missing coordinates or plot (0, 0)
    const getPointLatLng = (entity: any): [number, number] | null => {
      if (!entity) return null;
      // 1. Direct latitude and longitude fields
      const lat = entity.latitude ?? entity.coordinates?.latitude ?? (entity.lat !== undefined ? entity.lat : undefined);
      const lng = entity.longitude ?? entity.coordinates?.longitude ?? (entity.lng !== undefined ? entity.lng : undefined);
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        if (lat === 0 && lng === 0) return null; // Invariant: Never plot unknown locations at (0, 0)
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return [lat, lng];
        }
      }

      // 2. Coords object
      const coords = entity.coords;
      if (!coords) return null;
      if (coords.x === 0 && coords.y === 0) return null; // Never plot (0, 0)

      // Direct lat/lng in coords object
      if (coords.lat !== undefined && coords.lng !== undefined) {
        const cLat = Number(coords.lat);
        const cLng = Number(coords.lng);
        if (!isNaN(cLat) && !isNaN(cLng) && (cLat !== 0 || cLng !== 0)) {
          return [cLat, cLng];
        }
      }

      // Indian subcontinent GPS coordinates:
      // Case A: coords.y is Latitude, coords.x is Longitude
      if (coords.y >= 8 && coords.y <= 38 && coords.x >= 65 && coords.x <= 98) {
        return [coords.y, coords.x];
      }
      // Case B: coords.x is Latitude, coords.y is Longitude
      if (coords.x >= 8 && coords.x <= 38 && coords.y >= 65 && coords.y <= 98) {
        return [coords.x, coords.y];
      }

      // Percentage / relative coordinates mapped to active region center
      if (typeof coords.x === 'number' && typeof coords.y === 'number' && !isNaN(coords.x) && !isNaN(coords.y)) {
        const offsetLat = center[0] + (coords.y - 50) * 0.0018;
        const offsetLng = center[1] + (coords.x - 50) * 0.0018;
        if (offsetLat >= -90 && offsetLat <= 90 && offsetLng >= -180 && offsetLng <= 180) {
          return [offsetLat, offsetLng];
        }
      }
      return null;
    };

    // 1. Plot Aid Requests (Clustered)
    if (reqGroup) {
      requests.forEach((r) => {
        const point = getPointLatLng(r);
        if (!point) return; // Invariant: Never plot records without coordinates

        const meta = CATEGORY_META[r.category] || { label: r.category, color: 'info' };
        const isCrit = r.priority === 'critical';
        const isSel = selectedId === r.id;
        const fill = isCrit ? '#ff3b30' : meta.color === 'warning' ? '#ff9500' : meta.color === 'info' ? '#007aff' : '#34c759';
        const sym = r.category === 'medical' ? '✚' : r.category === 'rescue' ? '⛑' : r.category === 'food' ? '💧' : r.category === 'shelter' ? '⛺' : '👥';
        const sz = isSel ? 42 : 34;
        const pulse = isCrit
          ? `<circle cx="${sz / 2}" cy="${sz / 2}" r="${sz / 2 - 2}" fill="${fill}" opacity="0">
              <animate attributeName="r" values="${sz / 2 - 2};${sz / 2 + 8}" dur="1.2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0" dur="1.2s" repeatCount="indefinite"/></circle>`
          : '';
        const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sz} ${sz + 8}" width="${sz}" height="${sz + 8}">
          <defs><filter id="sh${r.id}" x="-40%" y="-30%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="${isSel ? 0.7 : 0.45}"/></filter></defs>
          ${pulse}
          <path d="M${sz / 2} 1C${sz / 2 - 8.5} 1 ${sz / 2 - 14} ${sz / 2 - 8} ${sz / 2 - 14} ${sz / 2}
                   c0 ${sz * 0.3} ${sz / 2 - 1} ${sz * 0.54} ${sz / 2 - 1} ${sz * 0.54}
                   s${sz / 2 - 1}-${sz * 0.24} ${sz / 2 - 1}-${sz * 0.54}
                   C${sz / 2 + 14} ${sz / 2 - 8} ${sz / 2 + 8.5} 1 ${sz / 2} 1z"
                fill="${fill}" filter="url(#sh${r.id})"
                stroke="${isSel ? '#fff' : 'rgba(255,255,255,0.3)'}" stroke-width="${isSel ? 2 : 1}"/>
          <text x="${sz / 2}" y="${sz / 2 + 4}" text-anchor="middle" dominant-baseline="middle"
                font-size="${sz * 0.35}" fill="white" font-weight="700">${sym}</text></svg>`;

        const icon = L.divIcon({ html: iconSvg, className: 'marker-3d', iconSize: [sz, sz + 8], iconAnchor: [sz / 2, sz + 8], popupAnchor: [0, -(sz + 4)] });
        const marker = L.marker(point, { icon, pane: 'markerLayer', zIndexOffset: isSel ? 2000 : 500 });

        marker.bindPopup(
          `<div style="width:230px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
              <span style="padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;background:${fill}20;color:${fill};border:1px solid ${fill}40">${meta.label}</span>
              <span style="font-size:10px;color:#64748b">${r.distanceMiles}mi${r.peopleCount > 0 ? ' · ' + r.peopleCount + ' people' : ''}</span>
              ${r.status === 'in-progress' ? `<span style="padding:2px 6px;border-radius:12px;font-size:9px;font-weight:800;background:#10b98130;color:#34d399;border:1px solid #10b98160">🤝 HELPING</span>` : ''}
            </div>
            <p style="font-size:13px;font-weight:700;color:#f1f5f9;margin:0 0 4px">${r.title}</p>
            <p style="font-size:11px;color:#8fb4d4;margin:0 0 8px;line-height:1.6">${r.details}</p>
            ${r.items && r.items.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${r.items.map((i) => `<span style="background:#162840;border:1px solid #2a4a68;border-radius:5px;padding:2px 7px;font-size:10px;color:#93c5fd">${i}</span>`).join('')}</div>` : ''}
            <div style="padding-top:8px;border-top:1px solid #1e3a52;display:flex;flex-direction:column;gap:6px;font-size:11px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
                ${r.contactPhone ? `<span>📞 <a href="tel:${r.contactPhone.replace(/[\s\-().]/g, '')}" style="color:#38bdf8;font-weight:700;text-decoration:none" onclick="event.stopPropagation()">${r.contactPhone}</a></span>` : '<span style="color:#64748b;font-size:10px;font-style:italic">No phone attached</span>'}
                <span style="color:#94a3b8;font-size:10px">${r.contactName || 'Requester'}</span>
              </div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${point[0]},${point[1]}&travelmode=driving" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;gap:5px;background:#1d4ed8;color:white;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:700;text-decoration:none;border:1px solid #2563eb">
                📍 Get Directions
              </a>
            </div>
          </div>`,
          { className: 'map-popup', maxWidth: 260 }
        );

        marker.on('click', () => onSelect(r.id));
        marker.addTo(reqGroup);
        reqMarkersRef.current[r.id] = marker;
      });
    }

    // 2. Plot Dynamic Shelters
    if (sheltGroup && shelters.length > 0) {
      shelters.forEach((s) => {
        const point = getPointLatLng(s);
        if (!point) return;
        const cap = s.totalCapacity ?? s.capacity ?? 0;
        const occ = s.occupiedBeds ?? s.occupied ?? 0;
        const availableBeds = calculateAvailableBeds(s);
        const pct = Math.round((occ / Math.max(1, cap)) * 100);
        const opStatus = s.operatingStatus ?? s.status ?? 'open';
        const isFull = opStatus === 'full' || availableBeds === 0;

        const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 42" width="34" height="42">
          <defs><filter id="sh_s${s.id}"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.5"/></filter></defs>
          <path d="M17 1C9.8 1 4 6.8 4 14c0 10.5 13 27 13 27s13-16.5 13-27C30 6.8 24.2 1 17 1z" fill="${isFull ? '#ef4444' : '#2563eb'}" filter="url(#sh_s${s.id})" stroke="white" stroke-width="1.5"/>
          <circle cx="17" cy="14" r="8" fill="rgba(255,255,255,0.2)"/>
          <text x="17" y="18" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="white">⛺</text>
        </svg>`;

        const icon = L.divIcon({ html: iconSvg, className: 'marker-3d', iconSize: [34, 42], iconAnchor: [17, 42], popupAnchor: [0, -(38)] });
        const marker = L.marker(point, { icon, pane: 'markerLayer', zIndexOffset: 450 });

        marker.bindPopup(
          `<div style="width:230px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:13px;font-weight:700;color:#f1f5f9">${s.name}</span>
              <span style="padding:2px 7px;border-radius:12px;font-size:9px;font-weight:800;background:${availableBeds > 0 ? '#10b98125' : '#ef444425'};color:${availableBeds > 0 ? '#34d399' : '#f87171'}">${opStatus.toUpperCase()}</span>
            </div>
            <p style="font-size:11px;color:#8fb4d4;margin:0 0 8px">${s.address}</p>
            <div style="margin:8px 0;background:#1e293b;border-radius:6px;padding:6px 8px">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
                <span style="color:#94a3b8">${occ}/${cap} beds used</span>
                <span style="font-weight:700;color:${availableBeds > 0 ? '#22c55e' : '#ef4444'}">${availableBeds} free</span>
              </div>
              <div style="height:6px;background:#334155;border-radius:4px;overflow:hidden">
                <div style="height:6px;width:${Math.min(100, pct)}%;background:${pct > 80 ? '#f97316' : '#22c55e'};border-radius:4px"></div>
              </div>
            </div>
            ${s.amenities && s.amenities.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${s.amenities.map((a) => `<span style="background:#162840;border:1px solid #2a4a68;border-radius:4px;padding:1px 6px;font-size:9px;color:#93c5fd">${a}</span>`).join('')}</div>` : ''}
            ${s.contactPhone ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e3a52;font-size:11px;color:#38bdf8">📞 <a href="tel:${s.contactPhone.replace(/[\s\-().]/g,'')}" style="color:#38bdf8;text-decoration:none" onclick="event.stopPropagation()">${s.contactPhone}</a></div>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${point[0]},${point[1]}&travelmode=driving" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;gap:5px;background:#2563eb;color:white;border-radius:8px;padding:7px 10px;margin-top:10px;font-size:11px;font-weight:700;text-decoration:none;border:1px solid #3b82f6">
              📍 Get Directions
            </a>
          </div>`,
          { className: 'map-popup', maxWidth: 260 }
        );

        marker.on('click', () => onSelect(s.id));
        marker.addTo(sheltGroup);
        reqMarkersRef.current[s.id] = marker;
      });
    }

    // 3. Plot Dynamic Consenting Volunteers (Strict privacy check)
    if (volGroup && volunteers.length > 0) {
      volunteers.forEach((v) => {
        // Privacy rule: Responders who declined location sharing must NEVER be plotted on the map
        if (v.locationSharingPermission === false) return;
        const point = getPointLatLng(v);
        if (!point) return;

        const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 38" width="30" height="38">
          <defs><filter id="sh_v${v.id}"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/></filter></defs>
          <path d="M15 1C8.5 1 3 6.5 3 13c0 9 12 24 12 24s12-15 12-24C27 6.5 21.5 1 15 1z" fill="${v.available ? '#10b981' : '#64748b'}" filter="url(#sh_v${v.id})" stroke="white" stroke-width="1.5"/>
          <text x="15" y="16" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="white">👥</text>
        </svg>`;

        const icon = L.divIcon({ html: iconSvg, className: 'marker-3d', iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -(34)] });
        const marker = L.marker(point, { icon, pane: 'markerLayer', zIndexOffset: 400 });

        marker.bindPopup(
          `<div style="width:210px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:12px;font-weight:700;color:#f1f5f9">${v.name}</span>
              <span style="padding:1px 6px;border-radius:10px;font-size:9px;font-weight:800;background:${v.available ? '#10b98125' : '#64748b25'};color:${v.available ? '#34d399' : '#94a3b8'}">${v.available ? 'AVAILABLE' : 'BUSY'}</span>
            </div>
            <div style="font-size:10px;color:#94a3b8;margin-bottom:6px">${v.distanceMiles} mi away · Verified GPS</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">${v.skills.map((sk) => `<span style="background:#162840;border:1px solid #2a4a68;border-radius:4px;padding:1px 6px;font-size:9px;color:#93c5fd">${sk}</span>`).join('')}</div>
          </div>`,
          { className: 'map-popup', maxWidth: 240 }
        );

        marker.on('click', () => onSelect(v.id));
        marker.addTo(volGroup);
        reqMarkersRef.current[v.id] = marker;
      });
    }

    // 4. Plot Dynamic Resources & Community Resource Offers
    if (resGroup) {
      if (resources && resources.length > 0) {
        resources.forEach((res) => {
          const point = getPointLatLng(res);
          if (!point) return;
          const sym = res.type === 'hospital' ? '✚' : res.type === 'pharmacy' ? '💊' : '📦';
          const fill = res.type === 'hospital' ? '#dc2626' : res.type === 'pharmacy' ? '#06b6d4' : '#f59e0b';

          const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 38" width="30" height="38">
            <defs><filter id="sh_res${res.id}"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/></filter></defs>
            <path d="M15 1C8.5 1 3 6.5 3 13c0 9 12 24 12 24s12-15 12-24C27 6.5 21.5 1 15 1z" fill="${fill}" filter="url(#sh_res${res.id})" stroke="white" stroke-width="1.5"/>
            <text x="15" y="16" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="white">${sym}</text>
          </svg>`;

          const icon = L.divIcon({ html: iconSvg, className: 'marker-3d', iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -(34)] });
          const marker = L.marker(point, { icon, pane: 'markerLayer', zIndexOffset: 350 });

          marker.bindPopup(
            `<div style="width:220px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;font-weight:700;color:#f1f5f9">${res.name}</span>
                <span style="padding:1px 6px;border-radius:10px;font-size:9px;font-weight:800;background:${fill}25;color:${fill}">${res.type.toUpperCase()}</span>
              </div>
              <p style="font-size:11px;color:#8fb4d4;margin:0 0 6px">${res.address}</p>
              ${res.phone ? `<p style="font-size:10px;color:#38bdf8;margin:0 0 6px">📞 ${res.phone}</p>` : ''}
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${res.tags.map((t) => `<span style="background:#162840;border:1px solid #2a4a68;border-radius:4px;padding:1px 6px;font-size:9px;color:#93c5fd">${t}</span>`).join('')}</div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${point[0]},${point[1]}&travelmode=driving" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;gap:5px;background:#0284c7;color:white;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;text-decoration:none;border:1px solid #38bdf8">
                📍 Get Directions
              </a>
            </div>`,
            { className: 'map-popup', maxWidth: 240 }
          );

          marker.on('click', () => onSelect(res.id));
          marker.addTo(resGroup);
          reqMarkersRef.current[res.id] = marker;
        });
      }

      // Community Resource Offers
      if (resourceOffers && resourceOffers.length > 0) {
        resourceOffers.forEach((ro) => {
          if (ro.availabilityStatus === 'fulfilled' || ro.availabilityStatus === 'withdrawn') return;
          const point = getPointLatLng(ro);
          if (!point) return;

          const remaining = Math.max(0, ro.quantityAvailable - (ro.quantityAllocated || 0));
          const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 38" width="30" height="38">
            <defs><filter id="sh_ro${ro.id}"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/></filter></defs>
            <path d="M15 1C8.5 1 3 6.5 3 13c0 9 12 24 12 24s12-15 12-24C27 6.5 21.5 1 15 1z" fill="#f59e0b" filter="url(#sh_ro${ro.id})" stroke="white" stroke-width="1.5"/>
            <text x="15" y="16" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="white">📦</text>
          </svg>`;

          const icon = L.divIcon({ html: iconSvg, className: 'marker-3d', iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -(34)] });
          const marker = L.marker(point, { icon, pane: 'markerLayer', zIndexOffset: 340 });

          marker.bindPopup(
            `<div style="width:220px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;font-weight:700;color:#f1f5f9">${ro.resourceType.replace(/_/g, ' ').toUpperCase()}</span>
                <span style="padding:1px 6px;border-radius:10px;font-size:9px;font-weight:800;background:#f59e0b25;color:#fbbf24">${remaining} ${ro.unit}</span>
              </div>
              <p style="font-size:11px;color:#8fb4d4;margin:0 0 6px">${ro.location}</p>
              ${ro.providerPhone ? `<p style="font-size:10px;color:#38bdf8;margin:0 0 6px">📞 ${ro.providerPhone}</p>` : ''}
              <div style="font-size:9px;color:#94a3b8;margin-bottom:8px">Provider: ${ro.providerName || 'Community Member'}</div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${point[0]},${point[1]}&travelmode=driving" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;gap:5px;background:#d97706;color:white;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;text-decoration:none;border:1px solid #f59e0b">
                📍 Get Directions
              </a>
            </div>`,
            { className: 'map-popup', maxWidth: 240 }
          );

          marker.on('click', () => onSelect(ro.id));
          marker.addTo(resGroup);
          reqMarkersRef.current[ro.id] = marker;
        });
      }
    }
  }, [requests, shelters, volunteers, resources, resourceOffers, selectedId, onSelect, region]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan to selected entity (request, shelter, volunteer, resource) ────────
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const marker = reqMarkersRef.current[selectedId];
    if (marker) {
      mapRef.current.panTo(marker.getLatLng());
      marker.openPopup();
    }
  }, [selectedId]);

  // ── Layer toggle ─────────────────────────────────────────────────────────
  const toggleLayer = useCallback((key: keyof LayerVisibility) => {
    const map  = mapRef.current;
    const grp  = groupsRef.current[key];
    if (!map || !grp) return;
    setLayers(prev => {
      const next = { ...prev, [key]:!prev[key] };
      next[key] ? grp.addTo(map) : map.removeLayer(grp);
      return next;
    });
  }, []);

  // ── React to incoming navDestination prop — live GPS navigation ─────────
  useEffect(() => {
    const map = mapRef.current;

    // Stop any existing watcher when destination changes or clears
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!map || !navDestination) return;

    // Remove previous destination marker + route line
    if (destMarkerRef.current) {
      const prev = destMarkerRef.current as unknown as { _rl?: L.Polyline };
      if (prev._rl) prev._rl.remove();
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    // Aid requests use relative coords [0,0] — fall back to region centre
    const isReal = navDestination.coords[0] !== 0 || navDestination.coords[1] !== 0;
    const destLL: [number, number] = isReal ? navDestination.coords : rmeta.center;

    // Destination pin (orange D marker)
    const destIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 44" width="36" height="44">
        <defs><filter id="dsh2"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.5"/></filter></defs>
        <path d="M18 1C10.82 1 5 6.82 5 14c0 10.5 13 29 13 29s13-18.5 13-29C31 6.82 25.18 1 18 1z"
              fill="#f97316" filter="url(#dsh2)" stroke="white" stroke-width="2"/>
        <text x="18" y="18" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="white" font-weight="800">D</text>
      </svg>`,
      className: '', iconSize:[36,44], iconAnchor:[18,44], popupAnchor:[0,-44],
    });

    destMarkerRef.current = L.marker(destLL, { icon: destIcon, pane: 'markerLayer', zIndexOffset: 3000 })
      .bindPopup(`<div style="font-family:'Inter',system-ui;color:#e2e8f0;min-width:180px">
        <p style="font-weight:700;font-size:13px;margin:0 0 4px">${navDestination.name}</p>
        <p style="font-size:11px;color:#94a3b8;margin:0">${navDestination.address}</p>
        ${navDestination.phone ? `<p style="margin-top:6px;font-size:11px"><a href="tel:${navDestination.phone.replace(/[\s\-().]/g,'')}" style="color:#38bdf8">📞 ${navDestination.phone}</a></p>` : ''}
      </div>`, { className:'map-popup' })
      .addTo(map)
      .openPopup();

    map.setView(destLL, Math.max(map.getZoom(), 14));

    // ── Haversine distance + bearing helper ───────────────────────────────
    const computeNav = (latitude: number, longitude: number) => {
      const R = 6371;
      const dLat = (destLL[0]-latitude)*Math.PI/180;
      const dLon = (destLL[1]-longitude)*Math.PI/180;
      const a = Math.sin(dLat/2)**2 +
                Math.cos(latitude*Math.PI/180)*Math.cos(destLL[0]*Math.PI/180)*Math.sin(dLon/2)**2;
      const distKm = R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const y2 = Math.sin((destLL[1]-longitude)*Math.PI/180)*Math.cos(destLL[0]*Math.PI/180);
      const x2 = Math.cos(latitude*Math.PI/180)*Math.sin(destLL[0]*Math.PI/180)-
                 Math.sin(latitude*Math.PI/180)*Math.cos(destLL[0]*Math.PI/180)*
                 Math.cos((destLL[1]-longitude)*Math.PI/180);
      const bDeg = (Math.atan2(y2,x2)*180/Math.PI+360)%360;
      const bearing = ['N','NE','E','SE','S','SW','W','NW'][Math.round(bDeg/45)%8];
      return { distKm, bearing };
    };

    // ── ETA estimator ──────────────────────────────────────────────────────
    // Uses device-reported speed when available; otherwise assumes walking (4 km/h)
    // or slow vehicle (20 km/h for distances > 2 km). Always labelled "Estimated".
    const estimateEta = (distKm: number, speedMps?: number | null): number => {
      if (speedMps && speedMps > 0.5) {
        // Device reported speed in m/s — convert to minutes
        return Math.ceil((distKm * 1000) / speedMps / 60);
      }
      // Heuristic: walking speed 4 km/h under 2 km, 20 km/h above
      const kmh = distKm < 2 ? 4 : 20;
      return Math.ceil((distKm / kmh) * 60);
    };

    // ── Track previous user position to debounce trivial movements ────────
    let prevLat: number | null = null;
    let prevLng: number | null = null;
    const MIN_MOVE_M = 15; // metres — ignore updates smaller than this

    const onPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, speed } = pos.coords;

      // Debounce: skip if user moved less than MIN_MOVE_M
      if (prevLat !== null && prevLng !== null) {
        const dM = Math.sqrt(
          ((latitude-prevLat)*111320)**2 +
          ((longitude-prevLng)*111320*Math.cos(latitude*Math.PI/180))**2,
        );
        if (dM < MIN_MOVE_M) return;
      }
      prevLat = latitude; prevLng = longitude;

      const userLL: [number, number] = [latitude, longitude];
      const { distKm, bearing } = computeNav(latitude, longitude);
      const etaMinutes = estimateEta(distKm, speed);

      // Update user marker
      if (gpsMarkerRef.current) gpsMarkerRef.current.remove();
      gpsMarkerRef.current = L.marker(userLL, {
        icon: ICONS.gps, pane: 'markerLayer', zIndexOffset: 2000,
      } as L.MarkerOptions).addTo(map);

      // Update dashed route line
      const existing = destMarkerRef.current as unknown as { _rl?: L.Polyline };
      if (existing?._rl) existing._rl.remove();
      const line = L.polyline([userLL, destLL], {
        color:'#f97316', weight:3, opacity:0.8, dashArray:'10 7',
      }).addTo(map);
      if (destMarkerRef.current) {
        (destMarkerRef.current as unknown as { _rl?: L.Polyline })._rl = line;
      }

      setDirInfo({
        dest: navDestination,
        distanceKm: distKm,
        bearing,
        userCoords: userLL,
        etaMinutes,
        isNavActive: true,
      });
    };

    const onError = () => {
      setDirInfo({
        dest: navDestination,
        distanceKm: null,
        bearing: null,
        userCoords: null,
        etaMinutes: null,
        isNavActive: false,
      });
    };

    if (navigator.geolocation) {
      // Start live tracking with watchPosition
      watchIdRef.current = navigator.geolocation.watchPosition(
        onPosition,
        onError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
    } else {
      setDirInfo({
        dest: navDestination,
        distanceKm: null,
        bearing: null,
        userCoords: null,
        etaMinutes: null,
        isNavActive: false,
      });
    }

    return () => {
      // Stop watcher and clean up markers
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (destMarkerRef.current) {
        const p = destMarkerRef.current as unknown as { _rl?: L.Polyline };
        if (p._rl) p._rl.remove();
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
    };
  }, [navDestination]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS (works in both regions) ──────────────────────────────────────────
  const handleGps = useCallback(() => {
    const map = mapRef.current; if(!map) return;
    setGpsError(null);
    if (!navigator.geolocation) { setGpsError('GPS unavailable on this device'); return; }
    setGpsActive(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        if (gpsMarkerRef.current) gpsMarkerRef.current.remove();
        gpsMarkerRef.current = L.marker([latitude,longitude],{icon:ICONS.gps})
          .bindPopup(
            `<b style="color:#93c5fd">Your Location</b><br>
             <span style="font-size:11px;color:#94a3b8">${latitude.toFixed(5)}°N, ${longitude.toFixed(5)}°E</span>`,
            {className:'map-popup'},
          ).addTo(map).openPopup();
        map.setView([latitude,longitude],15);
        setGpsActive(false);
      },
      err => { setGpsError(err.message); setGpsActive(false); },
      { enableHighAccuracy:true, timeout:10000 },
    );
  }, []);

  const handleRecenter = useCallback(() => mapRef.current?.setView(rmeta.center, rmeta.zoom), [rmeta]);
  const handleZoomIn   = useCallback(() => mapRef.current?.zoomIn(),  []);
  const handleZoomOut  = useCallback(() => mapRef.current?.zoomOut(), []);

  // Stop live navigation and clean up watcher
  const handleStopNavigation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setDirInfo(null);
  }, []);

  // Recenter on user's current position during navigation
  const handleRecenterOnUser = useCallback(() => {
    const map = mapRef.current;
    if (!map || !dirInfo?.userCoords) return;
    map.setView(dirInfo.userCoords, Math.max(map.getZoom(), 15));
  }, [dirInfo?.userCoords]);

  // ── Offline search ───────────────────────────────────────────────────────
  const activeIndex = region==='ncr' ? NCR_SEARCH_INDEX : SEARCH_INDEX;

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.trim().length<2) { setSearchResults([]); return; }
    const lc = q.toLowerCase();
    setSearchResults(activeIndex.filter(e=>
      e.name.toLowerCase().includes(lc)||e.type.toLowerCase().includes(lc)
    ).slice(0,8));
  }, [activeIndex]);

  const flyTo = useCallback((entry: SearchEntry) => {
    mapRef.current?.setView(entry.coords,14);
    setSearchOpen(false); setSearchQuery(''); setSearchResults([]);
    if (region==='badrinath') {
      const loc=[...EMERGENCY_SHELTERS,...HOSPITALS,...EMERGENCY_RESPONSE,...DISASTER_MARKERS]
        .find(l=>l.id===entry.id);
      if(loc) setSelLoc(loc);
    }
  }, [region]);

  // ── Region switch — no longer needed here (handled in StatusBanner) ───────

  // ── Layer defs for legend ────────────────────────────────────────────────
  type LayerDef = { key: keyof LayerVisibility; label:string; color:string; group:string };
  const layerDefs: LayerDef[] = [
    { key:'roads',      label:'Roads & Highways', color:'#c8d4e8', group:'base'     },
    { key:'rivers',     label:'Rivers & Water',   color:'#38bdf8', group:'base'     },
    { key:'labels',     label:'Place Names',      color:'#94a3b8', group:'base'     },
    { key:'buildings',  label:'Buildings',        color:'#2a5a82', group:'base'     },
    { key:'pois',       label:'Famous Locations', color:'#fbbf24', group:'base'     },
    { key:'floods',     label:'Flood Zones',      color:'#2563eb', group:'hazard'   },
    ...(region==='badrinath' ? [
      { key:'landslides' as keyof LayerVisibility, label:'Landslide Risk', color:'#f97316', group:'hazard' },
      { key:'safeZones'  as keyof LayerVisibility, label:'Safe Zones',     color:'#16a34a', group:'hazard' },
    ] : []),
    { key:'shelters',   label:'Shelters',         color:'#2563eb', group:'location' },
    { key:'volunteers', label:'Responders',       color:'#10b981', group:'location' },
    { key:'resources',  label:'Depots & Supplies', color:'#06b6d4', group:'location' },
    { key:'hospitals',  label:'Hospitals',        color:'#dc2626', group:'location' },
    { key:'response',   label:'Response Posts',   color:'#d97706', group:'location' },
    { key:'risks',      label:'Risk Markers',     color:'#b91c1c', group:'location' },
    { key:'requests',   label:'Aid Requests',     color:'#a855f7', group:'location' },
  ];
  const grouped = {
    base:     layerDefs.filter(l=>l.group==='base'),
    hazard:   layerDefs.filter(l=>l.group==='hazard'),
    location: layerDefs.filter(l=>l.group==='location'),
  };

  // Quick hazard toggles (toolbar)
  type QT = { key: keyof LayerVisibility; icon: React.ReactNode; label: string; color: string };
  const quickToggles: QT[] = [
    { key:'floods', icon:<Droplets className="h-3.5 w-3.5"/>, label:'Flood', color:'#2563eb' },
    ...(region==='badrinath' ? [
      { key:'landslides' as keyof LayerVisibility, icon:<TriangleAlert className="h-3.5 w-3.5"/>, label:'Slide', color:'#f97316' },
      { key:'safeZones'  as keyof LayerVisibility, icon:<ShieldCheck   className="h-3.5 w-3.5"/>, label:'Safe',  color:'#16a34a' },
    ] : []),
  ];

  const coordLine = region==='ncr'
    ? '28.5500°N 77.2500°E · Delhi NCR'
    : '30.5560°N 79.5640°E · Chamoli District';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border">

      {/* Leaflet map container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* ── ACCESSIBLE UNDERSTANDABLE FALLBACK LIST ── */}
      {viewMode === 'list' && (
        <div className="absolute inset-0 z-10 bg-background/95 backdrop-blur-md overflow-y-auto p-4 sm:p-5 space-y-4 pt-16">
          <div className="p-3 rounded-xl border border-primary/30 bg-primary/10 flex items-start gap-2.5">
            <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-bold text-foreground">Operational Territory Map Roster (Fallback View)</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Displaying full operational roster with coordinate status and distances. Entities without GPS are clearly identified.
              </p>
            </div>
          </div>

          {/* Section: Requests */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-mono font-bold uppercase text-muted-foreground">
              Emergency Incidents ({requests.length})
            </h5>
            <div className="space-y-1.5">
              {requests.map((r) => {
                const isCrit = r.priority === 'critical';
                const hasGps = r.coords && !(r.coords.x === 0 && r.coords.y === 0);
                const isSel = selectedId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => onSelect(r.id)}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs cursor-pointer transition-all space-y-1',
                      isSel ? 'border-primary ring-1 ring-primary bg-primary/10' : 'border-border bg-card hover:bg-secondary/40'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{r.title}</span>
                      <span className={cn('text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold', isCrit ? 'bg-alert text-white' : 'bg-warning text-black')}>
                        {r.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{r.details}</p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                      <span>{r.distanceMiles} mi away · {r.category}</span>
                      <span>{hasGps ? '📍 GPS Verified' : '⚠️ Manual Location (No GPS)'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Shelters */}
          {shelters.length > 0 && (
            <div className="space-y-2 pt-2">
              <h5 className="text-[11px] font-mono font-bold uppercase text-muted-foreground">
                Shelter Facilities ({shelters.length})
              </h5>
              <div className="space-y-1.5">
                {shelters.map((s) => {
                  const free = calculateAvailableBeds(s);
                  const isSel = selectedId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => onSelect(s.id)}
                      className={cn(
                        'p-2.5 rounded-xl border text-xs cursor-pointer transition-all space-y-1',
                        isSel ? 'border-info ring-1 ring-info bg-info/10' : 'border-border bg-card hover:bg-secondary/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{s.name}</span>
                        <span className={cn('text-[10px] font-mono font-bold', free > 0 ? 'text-success' : 'text-alert')}>
                          {free} beds free
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{s.address}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Consenting Volunteers */}
          {volunteers.length > 0 && (
            <div className="space-y-2 pt-2">
              <h5 className="text-[11px] font-mono font-bold uppercase text-muted-foreground">
                Field Volunteers ({volunteers.filter((v) => v.locationSharingPermission !== false).length})
              </h5>
              <div className="space-y-1.5">
                {volunteers.filter((v) => v.locationSharingPermission !== false).map((v) => (
                  <div
                    key={v.id}
                    onClick={() => onSelect(v.id)}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between',
                      selectedId === v.id ? 'border-success ring-1 ring-success bg-success/10' : 'border-border bg-card hover:bg-secondary/40'
                    )}
                  >
                    <div>
                      <span className="font-bold text-foreground block">{v.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{v.skills.join(', ')}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{v.distanceMiles} mi</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none flex items-start justify-between gap-2 px-2 pt-2 sm:px-3">

        {/* Title pill */}
        <div className="pointer-events-none flex items-center gap-2 rounded-lg
          border border-border bg-card px-3 py-1.5 shadow-md">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-alert/20 text-alert">
            <TriangleAlert className="h-3 w-3" />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-alert leading-none">
              Offline Disaster Map
            </p>
            <p className="text-[9px] text-muted-foreground leading-none mt-0.5">
              {rmeta.sublabel}
            </p>
          </div>
        </div>

        {/* Right: offline badge + fallback toggle + quick toggles */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {showFallbackToggle && (
              <button
                type="button"
                onClick={() => setViewMode((v) => (v === 'map' ? 'list' : 'map'))}
                className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-card border border-border text-foreground hover:bg-secondary flex items-center gap-1 shadow-md transition-all active:scale-95"
                title="Toggle between interactive map and accessible text roster"
              >
                {viewMode === 'map' ? (
                  <>
                    <Layers className="h-3 w-3 text-primary" />
                    <span>Fallback Roster</span>
                  </>
                ) : (
                  <>
                    <Map className="h-3 w-3 text-primary" />
                    <span>Interactive Map</span>
                  </>
                )}
              </button>
            )}

            <div className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
              'border shadow-md',
              isOnline ? 'border-success/30 bg-success/10 text-success'
                       : 'border-warning/40 bg-card text-warning',
            )}>
              {isOnline
                ? <><Wifi className="h-3 w-3"/><span>Online</span></>
                : <><WifiOff className="h-3 w-3"/><span>OFFLINE — Local Data</span>
                    <span className="relative ml-0.5 flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75"/>
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning"/>
                    </span>
                  </>
              }
            </div>
          </div>

          {/* Quick hazard toggles */}
          {quickToggles.length > 0 && (
            <div className="flex items-center gap-1">
              {quickToggles.map(({ key, icon, label, color }) => (
                <button key={key} onClick={()=>toggleLayer(key)}
                  title={`${layers[key]?'Hide':'Show'} ${label}`}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold
                    border shadow-sm transition-all active:scale-95"
                  style={{
                    borderColor:layers[key]?color+'60':'#2a2a2a',
                    background: layers[key]?color+'18':'#1a1a1a',
                    color:      layers[key]?color:'#666666',
                  }}>
                  <span style={{color:layers[key]?color:'#666666'}}>{icon}</span>{label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT TOOLBAR ── */}
      <div className="absolute right-2 sm:right-3 top-[72px] z-20 flex flex-col gap-1.5">
        <button onClick={handleZoomIn}  title="Zoom in"  className="map-ctrl-btn" aria-label="Zoom in">
          <span className="text-base font-bold leading-none text-foreground">+</span>
        </button>
        <button onClick={handleZoomOut} title="Zoom out" className="map-ctrl-btn" aria-label="Zoom out">
          <span className="text-base font-bold leading-none text-foreground">−</span>
        </button>
        <div className="my-0.5 h-px bg-border/50" />
        <button onClick={handleRecenter} title="Re-centre" className="map-ctrl-btn" aria-label="Re-centre">
          <Crosshair className="h-4 w-4 text-info" />
        </button>
        <button onClick={handleGps}
          title={gpsError ?? 'Locate me'}
          className={cn('map-ctrl-btn', gpsActive && 'border-info bg-info/15 animate-pulse')}
          aria-label="Locate me">
          <Locate className={cn('h-4 w-4', gpsActive ? 'text-info' : 'text-muted-foreground')} />
        </button>
        <div className="my-0.5 h-px bg-border/50" />
        <button onClick={()=>setSearchOpen(v=>!v)} title="Search"
          className={cn('map-ctrl-btn', searchOpen && 'border-info bg-info/15')} aria-label="Search">
          <Search className={cn('h-4 w-4', searchOpen ? 'text-info' : 'text-muted-foreground')} />
        </button>
        <button onClick={()=>setLegendOpen(v=>!v)} title="Legend"
          className={cn('map-ctrl-btn', legendOpen && 'border-info bg-info/15')} aria-label="Legend">
          <Layers className={cn('h-4 w-4', legendOpen ? 'text-info' : 'text-muted-foreground')} />
        </button>

        {/* ── Compass ── */}
        <div className="my-0.5 h-px bg-border/50" />
        <div
          title="North is up"
          aria-label="Compass — north is up"
          className="map-ctrl-btn cursor-default select-none"
          style={{ width: 36, height: 36, padding: 0 }}
        >
          <svg
            viewBox="0 0 36 36"
            width="36"
            height="36"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Outer ring */}
            <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(100,150,200,0.18)" strokeWidth="1" />
            {/* Tick marks at cardinal points */}
            <line x1="18" y1="3"  x2="18" y2="6"  stroke="#555555" strokeWidth="1.2" />
            <line x1="18" y1="30" x2="18" y2="33" stroke="#555555" strokeWidth="1.2" />
            <line x1="3"  y1="18" x2="6"  y2="18" stroke="#555555" strokeWidth="1.2" />
            <line x1="30" y1="18" x2="33" y2="18" stroke="#555555" strokeWidth="1.2" />
            {/* North needle — red */}
            <polygon
              points="18,5 15.5,18 18,16 20.5,18"
              fill="#ef4444"
            />
            {/* South needle — muted */}
            <polygon
              points="18,31 15.5,18 18,20 20.5,18"
              fill="#444444"
            />
            {/* Centre dot */}
            <circle cx="18" cy="18" r="2.2" fill="#666666" />
            <circle cx="18" cy="18" r="1"   fill="#aaaaaa" />
            {/* N label */}
            <text
              x="18"
              y="13"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="5.5"
              fontWeight="800"
              fontFamily="Inter,system-ui,sans-serif"
              fill="#ef4444"
              letterSpacing="0.04em"
            >N</text>
          </svg>
        </div>
      </div>

      {/* ── SEARCH PANEL ── */}
      {searchOpen && (
        <div className="absolute right-[3.25rem] sm:right-[3.5rem] top-[100px] z-30 w-64 sm:w-72
          rounded-lg border border-border bg-card shadow-md
          animate-float-up overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input autoFocus type="text"
              placeholder={region==='ncr' ? 'Delhi, Faridabad, Kabulpur…' : 'Shelters, hospitals…'}
              value={searchQuery}
              onChange={e=>handleSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            {searchQuery && (
              <button onClick={()=>handleSearch('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchResults.length > 0 && (
            <ul className="max-h-56 overflow-y-auto divide-y divide-border">
              {searchResults.map(r => (
                <li key={r.id}>
                  <button onClick={()=>flyTo(r)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors">
                    <TypeBadge type={r.type} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{r.name}</p>
                      <p className="text-[10px] capitalize text-muted-foreground">{r.type.replace('_',' ')}</p>
                    </div>
                    <Navigation className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchQuery.length>=2 && searchResults.length===0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No results found</p>
          )}
          {!searchQuery && (
            <p className="px-3 py-2 text-[10px] text-muted-foreground/60">
              Type to search {activeIndex.length} locations
            </p>
          )}
        </div>
      )}

      {/* ── LEGEND ── */}
      {legendOpen && (
        <div className="absolute left-2 sm:left-3 top-[100px] z-20 w-52
          rounded-lg border border-border bg-card shadow-md
          animate-float-up overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-info" />
              <span className="text-[11px] font-bold text-foreground">Map Layers</span>
            </div>
            <button onClick={()=>setLegendOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2 space-y-3">
            <LayerGroupUI label="Base"      layers={grouped.base}     active={layers} onToggle={toggleLayer} />
            <LayerGroupUI label="Hazards"   layers={grouped.hazard}   active={layers} onToggle={toggleLayer} />
            <LayerGroupUI label="Locations" layers={grouped.location} active={layers} onToggle={toggleLayer} />
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Severity</p>
              <div className="space-y-1">
                <SeverityRow color="#dc2626" label="Critical" />
                <SeverityRow color="#f97316" label="High" />
                <SeverityRow color="#fbbf24" label="Moderate" />
                <SeverityRow color="#16a34a" label="Safe / Clear" />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Markers</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <MarkerKey color="#2563eb" sym="⛺" label="Shelter" />
                <MarkerKey color="#dc2626" sym="✚"  label="Hospital" />
                <MarkerKey color="#d97706" sym="★"  label="Response" />
                <MarkerKey color="#b91c1c" sym="!"  label="Risk Zone" />
                <MarkerKey color="#16a34a" sym="✓"  label="Safe Zone" />
                <MarkerKey color="#a855f7" sym="●"  label="Aid Request" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Live Navigation panel ── */}
      {dirInfo && (
        <div className="absolute inset-x-2 bottom-2 z-30 sm:inset-x-3 sm:bottom-3
          rounded-lg border border-warning/40 bg-card shadow-md
          animate-float-up overflow-hidden">
          <div className="flex items-start gap-3 p-3 sm:p-4 pr-10">
            {/* Nav icon */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/20">
              <Navigation className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              {/* Header row */}
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-warning">
                  {dirInfo.isNavActive ? '🟢 Navigation Active' : 'In-App Directions'}
                </p>
                {dirInfo.isNavActive && (
                  <span className="flex h-1.5 w-1.5 rounded-full">
                    <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-warning opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" />
                  </span>
                )}
              </div>

              <p className="text-sm font-bold text-foreground leading-tight mt-0.5">{dirInfo.dest.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{dirInfo.dest.address}</p>

              {/* Distance + ETA */}
              {dirInfo.distanceKm !== null ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1 text-xs font-bold text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-info" />
                    {dirInfo.distanceKm < 1
                      ? `${Math.round(dirInfo.distanceKm * 1000)} m`
                      : `${dirInfo.distanceKm.toFixed(1)} km`}
                  </span>
                  {dirInfo.etaMinutes !== null && (
                    <span className="flex items-center gap-1 text-xs font-bold text-foreground">
                      <Clock className="h-3.5 w-3.5 text-warning" />
                      ETA ~{dirInfo.etaMinutes} min
                    </span>
                  )}
                  {dirInfo.bearing && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <Crosshair className="h-3 w-3" />
                      Head {dirInfo.bearing}
                    </span>
                  )}
                  <span className="w-full text-[9px] text-muted-foreground/70">
                    Straight-line · Estimated time · Verify route safety
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-warning">
                  📍 GPS unavailable — destination shown on map
                </p>
              )}

              {/* Action buttons */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {/* Stop Navigation */}
                <button
                  onClick={handleStopNavigation}
                  className="flex items-center gap-1 rounded-lg border border-warning/40 bg-warning/10
                    px-2.5 py-1.5 text-[11px] font-bold text-warning hover:bg-warning/20
                    transition-colors active:scale-95"
                >
                  <X className="h-3 w-3" /> Stop Navigation
                </button>

                {/* Recenter on user */}
                {dirInfo.userCoords && (
                  <button
                    onClick={handleRecenterOnUser}
                    className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40
                      px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-secondary
                      transition-colors active:scale-95"
                    title="Recenter on my location"
                  >
                    <Crosshair className="h-3 w-3 text-info" /> Recenter
                  </button>
                )}

                {/* Call button */}
                {dirInfo.dest.phone && (
                  <a href={`tel:${dirInfo.dest.phone.replace(/[\s\-().]/g,'')}`}
                    className="flex items-center gap-1.5 rounded-lg border border-info/30 bg-info/10
                      px-2.5 py-1.5 text-[11px] font-bold text-info hover:bg-info/20
                      transition-colors active:scale-95">
                    <Phone className="h-3 w-3" /> Call
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* Close (X) button — also stops navigation */}
          <button onClick={handleStopNavigation}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Stop navigation">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {gpsError && (
        <div className="absolute bottom-16 right-2 z-30 flex items-center gap-2 rounded-lg
          border border-alert/30 bg-card px-3 py-2 text-xs text-alert
          shadow-md animate-float-up">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[200px]">{gpsError}</span>
          <button onClick={()=>setGpsError(null)} className="ml-1 hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Selected location card (Badrinath only) */}
      {selLoc && (
        <div className="absolute inset-x-2 bottom-2 z-30 sm:inset-x-3 sm:bottom-3
          rounded-lg border border-border bg-card shadow-md
          animate-float-up max-h-[55vh] overflow-y-auto">
          <button onClick={()=>setSelLoc(null)}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"><X className="h-4 w-4" /></button>
          <LocDetail loc={selLoc} />
        </div>
      )}

      {/* Coordinate footer */}
      <div className="pointer-events-none absolute bottom-1 left-2 z-10 text-[9px] font-mono text-muted-foreground/40">
        {coordLine}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LayerGroupUI({
  label, layers, active, onToggle,
}: {
  label: string;
  layers: { key: keyof LayerVisibility; label: string; color: string }[];
  active: LayerVisibility;
  onToggle: (k: keyof LayerVisibility) => void;
}) {
  if (!layers.length) return null;
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="space-y-0.5">
        {layers.map(({ key, label: lbl, color }) => (
          <button key={key} onClick={()=>onToggle(key)}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted transition-colors">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: active[key] ? color : '#444444' }} />
            <span className={cn('flex-1 text-left text-[11px] leading-tight',
              active[key] ? 'text-foreground' : 'text-muted-foreground')}>{lbl}</span>
            <span className={cn('h-3.5 w-3.5 shrink-0 rounded border text-[8px] font-bold flex items-center justify-center',
              active[key] ? 'border-info/50 bg-info/15 text-info' : 'border-border text-muted-foreground/50')}>
              {active[key] ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SeverityRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-5 rounded-sm" style={{ background:color+'60', borderLeft:`3px solid ${color}` }} />
      <span className="text-[11px] text-muted-foreground/70">{label}</span>
    </div>
  );
}

function MarkerKey({ color, sym, label }: { color: string; sym: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
        style={{ background:color+'30', color }}>{sym}</span>
      <span className="text-[10px] text-muted-foreground/70">{label}</span>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const m: Record<string,{color:string;label:string}> = {
    shelter:{color:'#2563eb',label:'S'}, hospital:{color:'#dc2626',label:'H'},
    response:{color:'#d97706',label:'R'}, risk:{color:'#b91c1c',label:'!'},
    safe_zone:{color:'#16a34a',label:'✓'},
  };
  const t = m[type] ?? { color:'#64748b', label:'?' };
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
      style={{ background:t.color+'25', color:t.color }}>{t.label}</span>
  );
}

function LocDetail({ loc }: { loc: EmergencyLocation }) {
  const typeConf: Record<string,{icon:React.ReactNode;color:string}> = {
    hospital: { icon:<Hospital     className="h-4 w-4"/>, color:'#dc2626' },
    shelter:  { icon:<Tent         className="h-4 w-4"/>, color:'#2563eb' },
    response: { icon:<Radio        className="h-4 w-4"/>, color:'#d97706' },
    risk:     { icon:<TriangleAlert className="h-4 w-4"/>, color:'#b91c1c' },
    safe_zone:{ icon:<ShieldCheck  className="h-4 w-4"/>, color:'#16a34a' },
  };
  const conf = typeConf[loc.type] ?? { icon:<MapPin className="h-4 w-4"/>, color:'#64748b' };
  const statusConf: Record<string,string> = {
    open:'text-success bg-success/10 border-success/30',
    danger:'text-alert bg-alert/10 border-alert/30',
    warning:'text-warning bg-warning/10 border-warning/30',
    full:'text-orange-400 bg-orange-400/10 border-orange-400/30',
    limited:'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    closed:'text-muted-foreground bg-muted/10 border-border',
  };
  const pct = loc.capacity && loc.occupied!=null ? Math.round((loc.occupied/loc.capacity)*100) : null;
  return (
    <div className="p-3 sm:p-4 pr-10">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background:conf.color+'20', color:conf.color }}>{conf.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground leading-tight">{loc.name}</h3>
            <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
              statusConf[loc.status] ?? statusConf.closed)}>{loc.status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{loc.details}</p>
        </div>
      </div>
      {pct !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-foreground">{loc.occupied}/{loc.capacity} beds</span>
            <span className={pct>80?'text-orange-400':'text-success'}>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', pct>80?'bg-orange-400':'bg-success')}
              style={{width:`${pct}%`}} />
          </div>
        </div>
      )}
      {loc.amenities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {loc.amenities.map((a,i) => (
            <span key={i} className="rounded-md border border-border bg-muted px-2 py-0.5
              text-[11px] font-medium text-muted-foreground">{a}</span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border">
        <HeartPulse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs text-primary font-medium">{loc.phone}</span>
      </div>
    </div>
  );
}
