/**
 * Geospatial Engine for ResQLink
 * Provides Haversine distance, bearings, coordinate validation,
 * proximity radius filtering, and real routing service integration with offline fallback.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type DistanceUnit = 'km' | 'mi';

export interface RouteGeometry {
  coordinates: Array<[number, number]>; // [lat, lng] for Leaflet
  distanceKm: number;
  durationMinutes: number;
  mode: 'driving' | 'walking';
}

export interface RouteResult {
  success: boolean;
  isRealRoute: boolean;
  mode: 'driving' | 'walking';
  route?: RouteGeometry;
  fallbackStraightLineKm?: number;
  fallbackStraightLineMiles?: number;
  error?: string;
  destinationCoords: [number, number];
  destinationAddress?: string;
}

// Earth radii
const EARTH_RADIUS_KM = 6371;
const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.60934;

/**
 * Validates whether latitude and longitude are finite numbers within physical world bounds.
 */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Calculate spherical distance between two points using the Haversine formula.
 * Returns distance in kilometres. Returns NaN if coordinates are invalid.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!isValidLatLng(lat1, lon1) || !isValidLatLng(lat2, lon2)) {
    return Number.NaN;
  }

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate distance in miles using the Haversine formula.
 */
export function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const km = haversineDistanceKm(lat1, lon1, lat2, lon2);
  if (Number.isNaN(km)) return Number.NaN;
  return km * KM_TO_MILES;
}

/**
 * Calculate compass bearing between two coordinates.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { degrees: number; compass: string } {
  if (!isValidLatLng(lat1, lon1) || !isValidLatLng(lat2, lon2)) {
    return { degrees: 0, compass: 'N' };
  }

  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);

  const degrees = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const compass = points[Math.round(degrees / 45) % 8];

  return { degrees: Math.round(degrees), compass };
}

/**
 * Check location accuracy and determine whether distance should be flagged as approximate.
 * Accuracy > 100 metres is treated as approximate.
 */
export function checkLocationAccuracy(accuracyMeters?: number | null): {
  isApproximate: boolean;
  accuracyDesc: string;
} {
  if (accuracyMeters === null || accuracyMeters === undefined) {
    return { isApproximate: false, accuracyDesc: 'Estimated' };
  }
  if (accuracyMeters > 100) {
    return {
      isApproximate: true,
      accuracyDesc: `Approximate (±${Math.round(accuracyMeters)}m GPS accuracy)`,
    };
  }
  return {
    isApproximate: false,
    accuracyDesc: `Precise (±${Math.round(accuracyMeters)}m)`,
  };
}

/**
 * Formats distance with unit and optional approximate symbol.
 */
export function formatDistance(
  distanceKm: number | null | undefined,
  unit: DistanceUnit = 'mi',
  isApproximate = false
): string {
  if (distanceKm === null || distanceKm === undefined || Number.isNaN(distanceKm)) {
    return 'Distance unavailable';
  }

  const prefix = isApproximate ? '~' : '';
  if (unit === 'mi') {
    const miles = distanceKm * KM_TO_MILES;
    if (miles < 0.1) return `${prefix}${Math.round(miles * 5280)} ft`;
    return `${prefix}${miles.toFixed(1)} mi`;
  }

  // Kilometres
  if (distanceKm < 1) {
    return `${prefix}${Math.round(distanceKm * 1000)} m`;
  }
  return `${prefix}${distanceKm.toFixed(1)} km`;
}

/**
 * Filters items within a configurable radius (in miles, default 2 miles per requirements).
 */
export function filterNearby<T>(
  items: T[],
  userCoords: [number, number] | null,
  radiusMiles = 2,
  getCoords: (item: T) => [number, number] | null
): Array<T & { distanceKm: number; distanceMiles: number; isApproximate: boolean }> {
  if (!userCoords || !isValidLatLng(userCoords[0], userCoords[1])) {
    return [];
  }

  const radiusKm = radiusMiles * MILES_TO_KM;
  const results: Array<T & { distanceKm: number; distanceMiles: number; isApproximate: boolean }> = [];

  for (const item of items) {
    const coords = getCoords(item);
    if (!coords || !isValidLatLng(coords[0], coords[1])) continue;

    const distKm = haversineDistanceKm(userCoords[0], userCoords[1], coords[0], coords[1]);
    if (!Number.isNaN(distKm) && distKm <= radiusKm) {
      results.push({
        ...item,
        distanceKm: distKm,
        distanceMiles: distKm * KM_TO_MILES,
        isApproximate: false,
      });
    }
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Sorts items by proximity to the user coordinates. Items without coordinates appear last.
 */
export function sortByDistance<T>(
  items: T[],
  userCoords: [number, number] | null,
  getCoords: (item: T) => [number, number] | null
): Array<T & { distanceKm: number | null; distanceMiles: number | null }> {
  if (!userCoords || !isValidLatLng(userCoords[0], userCoords[1])) {
    return items.map((i) => ({ ...i, distanceKm: null, distanceMiles: null }));
  }

  const withDist = items.map((item) => {
    const coords = getCoords(item);
    if (!coords || !isValidLatLng(coords[0], coords[1])) {
      return { ...item, distanceKm: null, distanceMiles: null };
    }
    const distKm = haversineDistanceKm(userCoords[0], userCoords[1], coords[0], coords[1]);
    return {
      ...item,
      distanceKm: Number.isNaN(distKm) ? null : distKm,
      distanceMiles: Number.isNaN(distKm) ? null : distKm * KM_TO_MILES,
    };
  });

  return withDist.sort((a, b) => {
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

/**
 * Fetches real turn-by-turn routing from OpenStreetMap's Project OSRM service.
 * Supports driving or walking modes.
 * If routing service fails or is offline, provides safe fallback displaying destination
 * coordinates with clearly marked approximate straight-line distance.
 */
export async function fetchRoute(
  start: [number, number], // [lat, lng]
  end: [number, number],   // [lat, lng]
  mode: 'driving' | 'walking' = 'driving',
  destinationAddress?: string
): Promise<RouteResult> {
  const straightLineKm = haversineDistanceKm(start[0], start[1], end[0], end[1]);
  const straightLineMiles = straightLineKm * KM_TO_MILES;

  if (!isValidLatLng(start[0], start[1]) || !isValidLatLng(end[0], end[1])) {
    return {
      success: false,
      isRealRoute: false,
      mode,
      destinationCoords: end,
      destinationAddress,
      error: 'Invalid coordinates provided for route calculation.',
    };
  }

  const osrmProfile = mode === 'walking' ? 'foot' : 'car';
  // OSRM expects coordinates in lng,lat order
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Routing service responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No navigable route found between points.');
    }

    const primaryRoute = data.routes[0];
    const distanceMeters = primaryRoute.distance;
    const durationSeconds = primaryRoute.duration;
    const geoJsonCoords: Array<[number, number]> = primaryRoute.geometry.coordinates;

    // Convert GeoJSON [lng, lat] back to Leaflet [lat, lng]
    const leafletCoords: Array<[number, number]> = geoJsonCoords.map(([lng, lat]) => [lat, lng]);

    return {
      success: true,
      isRealRoute: true,
      mode,
      destinationCoords: end,
      destinationAddress,
      route: {
        coordinates: leafletCoords,
        distanceKm: distanceMeters / 1000,
        durationMinutes: Math.round(durationSeconds / 60),
        mode,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : 'Routing service unreachable (offline or timeout)';

    // Strict safety invariant: Never invent turn-by-turn or present straight-line as driving/walking
    return {
      success: false,
      isRealRoute: false,
      mode,
      destinationCoords: end,
      destinationAddress,
      fallbackStraightLineKm: straightLineKm,
      fallbackStraightLineMiles: straightLineMiles,
      error: message,
    };
  }
}
