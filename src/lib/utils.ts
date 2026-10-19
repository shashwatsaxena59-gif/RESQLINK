import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build a Google Maps URL for a destination.
 * Prefers lat/lng coordinates; falls back to a text search query.
 * Returns null if no usable location data is provided.
 */
export function buildGoogleMapsUrl(
  opts: { coords?: [number, number] | null; query?: string | null },
): string | null {
  // Prefer exact coordinates
  if (
    opts.coords &&
    Array.isArray(opts.coords) &&
    (opts.coords[0] !== 0 || opts.coords[1] !== 0)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${opts.coords[0]},${opts.coords[1]}`;
  }
  // Fall back to text search
  if (opts.query && opts.query.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.query.trim())}`;
  }
  return null;
}

/**
 * Open a destination in Google Maps in a new tab.
 * Uses coordinates when available; falls back to text address.
 */
export function openGoogleMapsDirections(destination: string): void {
  if (!destination?.trim()) return;
  const url = buildGoogleMapsUrl({ query: destination });
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

