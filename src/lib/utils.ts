import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build a Google Maps URL for DIRECTIONS to a destination.
 * Opens turn-by-turn navigation from user's current location.
 * Prefers lat/lng coordinates; falls back to a text search query.
 * Returns null if no usable location data is provided.
 */
export function buildGoogleMapsUrl(
  opts: { coords?: [number, number] | null; query?: string | null },
): string | null {
  // Prefer exact coordinates — opens real navigation
  if (
    opts.coords &&
    Array.isArray(opts.coords) &&
    (opts.coords[0] !== 0 || opts.coords[1] !== 0)
  ) {
    const [lat, lng] = opts.coords;
    // Use directions mode so it opens turn-by-turn navigation
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  // Fall back to text search
  if (opts.query && opts.query.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(opts.query.trim())}&travelmode=driving`;
  }
  return null;
}

/**
 * Open Google Maps directions in a new tab from current location.
 * Uses coordinates when available; falls back to text address.
 */
export function openGoogleMapsDirections(
  destination: string,
  coords?: [number, number] | null,
): void {
  if (!destination?.trim() && !coords) return;
  const url = buildGoogleMapsUrl({ coords, query: destination });
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}
