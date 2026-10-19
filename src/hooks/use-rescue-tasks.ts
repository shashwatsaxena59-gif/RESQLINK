/**
 * use-rescue-tasks.ts
 *
 * Hook for volunteer-facing rescue task operations.
 * Polls available tasks every 3 s and provides:
 *   - acceptTask   : atomic assignment (handles 409 conflict gracefully)
 *   - startRescue  : ASSIGNED → IN_PROGRESS
 *   - completeRescue: IN_PROGRESS → AWAITING_CONFIRMATION
 *   - refreshAll   : manual full refresh
 *
 * Also tracks the volunteer's active task (if any) and rescue history.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RescueTask, TaskAssignmentResponse } from '@/types';
import { refreshVolunteerSession } from '@/lib/ngo-auth';
import type { VolunteerMember } from '@/types';

// Use relative /api/ paths — Vite proxy forwards to localhost:3001
const API_BASE = '';
const POLL_MS  = 3000;

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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as any).error ?? `HTTP ${res.status}`), body);
  return body as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseRescueTasksReturn {
  /** Tasks that are genuinely AVAILABLE for acceptance */
  availableTasks: RescueTask[];
  /** The task currently assigned to this volunteer (ASSIGNED | IN_PROGRESS | AWAITING_CONFIRMATION) */
  activeTask: RescueTask | null;
  /** All RESCUED tasks for this volunteer — rescue history */
  history: RescueTask[];
  loading: boolean;
  error: string | null;

  /** Accept a task — returns conflict error if already taken */
  acceptTask: (taskId: string) => Promise<TaskAssignmentResponse>;
  /** Mark active task as IN_PROGRESS */
  startRescue: (taskId: string) => Promise<RescueTask>;
  /** Mark active task as AWAITING_CONFIRMATION */
  completeRescue: (taskId: string) => Promise<RescueTask>;

  refresh: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRescueTasks(
  volunteerId: string | null,
  ngoId: string | null,
): UseRescueTasksReturn {
  const [allTasks,  setAllTasks]  = useState<RescueTask[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const versionRef  = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef  = useRef(true);

  // ── Pull all tasks (available + volunteer's own tasks) ────────────────────
  const pullTasks = useCallback(async (force = false) => {
    try {
      // 1. Check version first (lightweight)
      if (!force) {
        const vRes = await fetch(`${API_BASE}/api/ngo-store/version`)
          .then((r) => r.json())
          .catch(() => null);
        if (vRes && vRes.version === versionRef.current) return;
        if (vRes) versionRef.current = vRes.version;
      }

      // 2. Fetch all tasks
      const tasks = await apiFetch<RescueTask[]>(`${API_BASE}/api/rescue-tasks`);
      if (!mountedRef.current) return;
      setAllTasks(tasks);
      setError(null);
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load rescue tasks');
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    pullTasks(true).finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    intervalRef.current = setInterval(() => pullTasks(), POLL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pullTasks]);

  // ── Derived views ─────────────────────────────────────────────────────────

  /** Tasks genuinely available — must be AVAILABLE status only */
  const availableTasks = allTasks.filter((t) => t.status === 'AVAILABLE');

  /** This volunteer's currently active task */
  const activeTask = volunteerId
    ? allTasks.find(
        (t) =>
          t.assignedVolunteerId === volunteerId &&
          ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION'].includes(t.status),
      ) ?? null
    : null;

  /** Completed rescue history for this volunteer */
  const history = volunteerId
    ? allTasks
        .filter((t) => t.assignedVolunteerId === volunteerId && t.status === 'RESCUED')
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    : [];

  // ── Actions ───────────────────────────────────────────────────────────────

  const acceptTask = useCallback(async (taskId: string): Promise<TaskAssignmentResponse> => {
    if (!volunteerId || !ngoId) {
      return { ok: false, error: 'Not logged in as a volunteer.' };
    }

    try {
      const result = await apiFetch<{
        ok: boolean;
        task: RescueTask;
        volunteer: VolunteerMember;
        alreadyAssigned?: boolean;
        error?: string;
      }>(`${API_BASE}/api/rescue-tasks/${taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ volunteerId, ngoId }),
      });

      // Update local session with refreshed volunteer data
      if (result.volunteer) {
        refreshVolunteerSession(result.volunteer);
      }

      // Force immediate refresh so the task disappears from available list
      await pullTasks(true);

      return { ok: true, task: result.task };
    } catch (e: unknown) {
      await pullTasks(true); // Refresh regardless — task may have been taken
      const err = e as any;
      if (err.alreadyAssigned || (typeof err.message === 'string' && err.message.includes('already'))) {
        return {
          ok: false,
          alreadyAssigned: true,
          error: err.error ?? err.message ?? 'This rescue request has already been assigned to another volunteer.',
        };
      }
      return {
        ok: false,
        error: err.error ?? err.message ?? 'Failed to accept task.',
      };
    }
  }, [volunteerId, ngoId, pullTasks]);

  const startRescue = useCallback(async (taskId: string): Promise<RescueTask> => {
    if (!volunteerId) throw new Error('Not logged in as a volunteer.');

    const result = await apiFetch<{ ok: boolean; task: RescueTask }>(
      `${API_BASE}/api/rescue-tasks/${taskId}/start`,
      { method: 'POST', body: JSON.stringify({ volunteerId }) }
    );
    await pullTasks(true);
    return result.task;
  }, [volunteerId, pullTasks]);

  const completeRescue = useCallback(async (taskId: string): Promise<RescueTask> => {
    if (!volunteerId) throw new Error('Not logged in as a volunteer.');

    const result = await apiFetch<{ ok: boolean; task: RescueTask }>(
      `${API_BASE}/api/rescue-tasks/${taskId}/complete`,
      { method: 'POST', body: JSON.stringify({ volunteerId }) }
    );
    await pullTasks(true);
    return result.task;
  }, [volunteerId, pullTasks]);

  const refresh = useCallback(() => pullTasks(true), [pullTasks]);

  return {
    availableTasks,
    activeTask,
    history,
    loading,
    error,
    acceptTask,
    startRescue,
    completeRescue,
    refresh,
  };
}
