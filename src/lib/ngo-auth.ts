/**
 * ngo-auth.ts
 *
 * Client-side session management for NGO users and NGO-registered volunteer members.
 * Sessions are stored in localStorage so they survive page refresh.
 *
 * Two session types:
 *   - NgoSession   : an NGO admin who logged in via /api/ngo/login
 *   - VolunteerSession : a volunteer member who was added by an NGO and "logged in"
 *                        by selecting their name (no password required for volunteers —
 *                        they identify themselves within the NGO context).
 */

import type { NgoProfile, VolunteerMember } from '@/types';

// ── Storage keys ──────────────────────────────────────────────────────────────
const NGO_SESSION_KEY       = 'resqlink-ngo-session-v1';
const VOLUNTEER_SESSION_KEY = 'resqlink-volunteer-session-v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NgoSession {
  ngo: Omit<NgoProfile, 'passwordHash'>;
  loggedInAt: number;
}

export interface VolunteerSession {
  volunteer: VolunteerMember;
  ngoId: string;
  ngoName: string;
  loggedInAt: number;
}

// ── NGO Session helpers ───────────────────────────────────────────────────────

export function getNgoSession(): NgoSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(NGO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as NgoSession) : null;
  } catch {
    return null;
  }
}

export function setNgoSession(ngo: Omit<NgoProfile, 'passwordHash'>): NgoSession {
  const session: NgoSession = { ngo, loggedInAt: Date.now() };
  try {
    localStorage.setItem(NGO_SESSION_KEY, JSON.stringify(session));
  } catch {
    // storage quota exceeded — ignore
  }
  return session;
}

export function clearNgoSession(): void {
  try {
    localStorage.removeItem(NGO_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function hasNgoSession(): boolean {
  return getNgoSession() !== null;
}

// ── Volunteer Session helpers ─────────────────────────────────────────────────

export function getVolunteerSession(): VolunteerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VOLUNTEER_SESSION_KEY);
    return raw ? (JSON.parse(raw) as VolunteerSession) : null;
  } catch {
    return null;
  }
}

export function setVolunteerSession(
  volunteer: VolunteerMember,
  ngoId: string,
  ngoName: string,
): VolunteerSession {
  const session: VolunteerSession = { volunteer, ngoId, ngoName, loggedInAt: Date.now() };
  try {
    localStorage.setItem(VOLUNTEER_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
  return session;
}

export function clearVolunteerSession(): void {
  try {
    localStorage.removeItem(VOLUNTEER_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function hasVolunteerSession(): boolean {
  return getVolunteerSession() !== null;
}

/**
 * Update the volunteer data stored in the active session.
 * Called after the server returns an updated volunteer object
 * (e.g. after status changes on assignment / confirmation).
 */
export function refreshVolunteerSession(updated: VolunteerMember): void {
  const existing = getVolunteerSession();
  if (!existing) return;
  setVolunteerSession(updated, existing.ngoId, existing.ngoName);
}

// ── Combined helpers ──────────────────────────────────────────────────────────

/** Clear both sessions (full logout) */
export function clearAllSessions(): void {
  clearNgoSession();
  clearVolunteerSession();
}

/** Which "role" is the current browser tab acting as? */
export type ActiveRole = 'ngo' | 'volunteer' | 'none';

export function getActiveRole(): ActiveRole {
  if (hasNgoSession()) return 'ngo';
  if (hasVolunteerSession()) return 'volunteer';
  return 'none';
}
