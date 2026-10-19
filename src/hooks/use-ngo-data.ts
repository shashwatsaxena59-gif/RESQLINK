/**
 * use-ngo-data.ts
 *
 * Hook for NGO dashboard — polls the server every 3 s and exposes
 * all CRUD operations an NGO admin needs:
 *   • fetch + refresh store
 *   • add / remove volunteer members
 *   • change volunteer status
 *   • create rescue tasks from AidRequests
 *   • cancel / reassign tasks
 *   • confirm rescues
 *   • computed dashboard stats
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  NgoProfile,
  VolunteerMember,
  VolunteerMemberInput,
  RescueTask,
  RescueTaskCreateInput,
  NgoDashboardStats,
  VolunteerMemberStatus,
} from '@/types';

// Use relative /api/ paths — the Vite dev-server proxy forwards them to
// localhost:3001. This also works correctly when accessed over LAN.
const API_BASE = '';
const POLL_MS  = 3000;

// ── Safe JSON helper ──────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
  } catch {
    throw new Error(
      'Cannot reach the ResQLink server. Make sure the backend is running ' +
      '(cd server && npm run dev).'
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NgoStoreSnapshot {
  ngos: Omit<NgoProfile, 'passwordHash'>[];
  volunteers: VolunteerMember[];
  tasks: RescueTask[];
  version: number;
}

export interface UseNgoDataReturn {
  // Data
  volunteers: VolunteerMember[];
  tasks: RescueTask[];
  stats: NgoDashboardStats;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;

  // Volunteer CRUD
  addVolunteer: (input: VolunteerMemberInput) => Promise<VolunteerMember>;
  removeVolunteer: (volunteerId: string) => Promise<void>;
  setVolunteerStatus: (volunteerId: string, status: VolunteerMemberStatus) => Promise<void>;

  // Rescue task operations
  createRescueTask: (input: RescueTaskCreateInput) => Promise<RescueTask>;
  cancelTask: (taskId: string, reason?: string, makeAvailable?: boolean) => Promise<RescueTask>;
  confirmRescue: (taskId: string, confirmedByName: string) => Promise<RescueTask>;

  // Manual refresh
  refresh: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNgoData(ngoId: string | null): UseNgoDataReturn {
  const [volunteers, setVolunteers] = useState<VolunteerMember[]>([]);
  const [tasks,      setTasks]      = useState<RescueTask[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const versionRef  = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef  = useRef(true);

  // ── Pull full store and update state if version changed ───────────────────
  const pullStore = useCallback(async (force = false) => {
    if (!ngoId) return;
    try {
      const snapshot = await apiFetch<NgoStoreSnapshot>(`${API_BASE}/api/ngo-store`);
      if (!mountedRef.current) return;

      if (!force && snapshot.version === versionRef.current) return;
      versionRef.current = snapshot.version;

      // Filter to this NGO's data
      setVolunteers(snapshot.volunteers.filter((v) => v.ngoId === ngoId));
      setTasks(
        snapshot.tasks
          .filter((t) => t.assignedNgoId === ngoId || t.status === 'AVAILABLE')
          .sort((a, b) => b.createdAt - a.createdAt)
      );
      setLastUpdated(Date.now());
      setError(null);
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load NGO data');
      }
    }
  }, [ngoId]);

  // ── Initial load + polling ────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (!ngoId) {
      setVolunteers([]);
      setTasks([]);
      return;
    }

    setLoading(true);
    pullStore(true).finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    intervalRef.current = setInterval(() => pullStore(), POLL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ngoId, pullStore]);

  // ── Computed stats ────────────────────────────────────────────────────────
  const stats: NgoDashboardStats = {
    totalVolunteers:      volunteers.length,
    availableVolunteers:  volunteers.filter((v) => v.status === 'AVAILABLE').length,
    onMissionVolunteers:  volunteers.filter((v) => v.status === 'ON_MISSION').length,
    offlineVolunteers:    volunteers.filter((v) => v.status === 'OFFLINE').length,
    activeRescues:        tasks.filter((t) =>
      t.assignedNgoId === ngoId &&
      ['ASSIGNED', 'IN_PROGRESS'].includes(t.status)
    ).length,
    completedRescues:     tasks.filter((t) =>
      t.assignedNgoId === ngoId && t.status === 'RESCUED'
    ).length,
    awaitingConfirmation: tasks.filter((t) =>
      t.assignedNgoId === ngoId && t.status === 'AWAITING_CONFIRMATION'
    ).length,
  };

  // ── Volunteer CRUD ────────────────────────────────────────────────────────

  const addVolunteer = useCallback(async (input: VolunteerMemberInput): Promise<VolunteerMember> => {
    const result = await apiFetch<{ ok: boolean; volunteer: VolunteerMember }>(
      `${API_BASE}/api/ngo/${input.ngoId}/volunteers`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    await pullStore(true);
    return result.volunteer;
  }, [pullStore]);

  const removeVolunteer = useCallback(async (volunteerId: string): Promise<void> => {
    await apiFetch(`${API_BASE}/api/ngo/volunteers/${volunteerId}`, { method: 'DELETE' });
    await pullStore(true);
  }, [pullStore]);

  const setVolunteerStatus = useCallback(async (
    volunteerId: string,
    status: VolunteerMemberStatus,
  ): Promise<void> => {
    await apiFetch(`${API_BASE}/api/ngo/volunteers/${volunteerId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    await pullStore(true);
  }, [pullStore]);

  // ── Rescue task operations ────────────────────────────────────────────────

  const createRescueTask = useCallback(async (input: RescueTaskCreateInput): Promise<RescueTask> => {
    const result = await apiFetch<{ ok: boolean; task: RescueTask }>(
      `${API_BASE}/api/rescue-tasks`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    await pullStore(true);
    return result.task;
  }, [pullStore]);

  const cancelTask = useCallback(async (
    taskId: string,
    reason?: string,
    makeAvailable = false,
  ): Promise<RescueTask> => {
    const result = await apiFetch<{ ok: boolean; task: RescueTask }>(
      `${API_BASE}/api/rescue-tasks/${taskId}/cancel`,
      { method: 'POST', body: JSON.stringify({ ngoId, reason, makeAvailable }) }
    );
    await pullStore(true);
    return result.task;
  }, [ngoId, pullStore]);

  const confirmRescue = useCallback(async (
    taskId: string,
    confirmedByName: string,
  ): Promise<RescueTask> => {
    const result = await apiFetch<{ ok: boolean; task: RescueTask }>(
      `${API_BASE}/api/rescue-tasks/${taskId}/confirm`,
      { method: 'POST', body: JSON.stringify({ ngoId, confirmedByName }) }
    );
    await pullStore(true);
    return result.task;
  }, [ngoId, pullStore]);

  const refresh = useCallback(() => pullStore(true), [pullStore]);

  return {
    volunteers,
    tasks,
    stats,
    loading,
    error,
    lastUpdated,
    addVolunteer,
    removeVolunteer,
    setVolunteerStatus,
    createRescueTask,
    cancelTask,
    confirmRescue,
    refresh,
  };
}
