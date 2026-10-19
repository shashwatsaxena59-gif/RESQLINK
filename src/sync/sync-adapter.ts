/**
 * Remote Backend Synchronization Adapters
 * Provides pluggable network adapters connecting ResQLink offline storage to remote servers.
 */

import type { SyncQueueItem } from '../domain/models/sync-metadata';
import type { EmergencyRequest } from '../domain/models/emergency-request';
import type { VolunteerTask } from '../domain/models/volunteer-task';
import type { Shelter } from '../domain/models/shelter';

export interface SyncPushResult {
  success: boolean;
  error?: string;
  serverAckTimestamp?: string;
  statusCode?: number;
  serverVersion?: number;
  conflict?: boolean;
}

export interface RemoteBackendAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  pushQueueItem(item: SyncQueueItem): Promise<SyncPushResult>;
  fetchRemoteRequests(): Promise<EmergencyRequest[]>;
  fetchRemoteTasks(): Promise<VolunteerTask[]>;
  fetchRemoteShelters(): Promise<Shelter[]>;
  setAuthToken?(token: string | null): void;
  getAuthToken?(): string | null;
}

/**
 * ExpressApiAdapter
 * Connects to the local Express disaster server (/api/*) with proxy support.
 */
export class ExpressApiAdapter implements RemoteBackendAdapter {
  public readonly name = 'ExpressApiAdapter';
  private baseUrl: string;
  private authToken: string | null = null;
  private eventSource: any = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  public setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  private lastAvailableCheck: { result: boolean; timestamp: number } | null = null;

  public async isAvailable(): Promise<boolean> {
    const now = Date.now();
    // Cache positive/negative result for 6 seconds to eliminate repeated blocking roundtrips
    if (this.lastAvailableCheck && now - this.lastAvailableCheck.timestamp < 6000) {
      return this.lastAvailableCheck.result;
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(800),
      });
      const ok = res.ok;
      this.lastAvailableCheck = { result: ok, timestamp: now };
      return ok;
    } catch {
      this.lastAvailableCheck = { result: false, timestamp: now };
      return false;
    }
  }

  public async pushQueueItem(item: SyncQueueItem): Promise<SyncPushResult> {
    try {
      const now = new Date().toISOString();

      if (item.entityType === 'emergency_request') {
        if (item.action === 'create' || item.action === 'update') {
          const res = await fetch(`${this.baseUrl}/api/sync/request`, {
            method: 'POST',
            headers: this.getHeaders({
              'X-Idempotency-Key': item.idempotencyKey,
              ...(item.baseVersion !== undefined ? { 'X-Base-Version': String(item.baseVersion) } : {}),
            }),
            body: JSON.stringify(item.payload),
          });

          if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            return {
              success: false,
              conflict: true,
              statusCode: 409,
              serverVersion: data.serverVersion,
              error: 'Conflict: Stale edit detected against newer remote state.',
            };
          }

          if (!res.ok) {
            return {
              success: false,
              statusCode: res.status,
              error: `Server responded with ${res.status}: ${res.statusText}`,
            };
          }

          const ackData = await res.json().catch(() => ({}));
          return {
            success: true,
            serverAckTimestamp: ackData.serverAckTimestamp || now,
            serverVersion: ackData.serverVersion || (item.baseVersion ? item.baseVersion + 1 : 1),
          };
        }

        if (item.action === 'delete') {
          const res = await fetch(`${this.baseUrl}/api/sync/resolve`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ id: item.entityId }),
          });
          if (!res.ok) {
            return { success: false, statusCode: res.status, error: res.statusText };
          }
          return { success: true, serverAckTimestamp: now };
        }
      }

      if (item.entityType === 'volunteer_task') {
        const res = await fetch(`${this.baseUrl}/api/rescue-tasks`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) {
          return { success: false, statusCode: res.status, error: res.statusText };
        }
        return { success: true, serverAckTimestamp: now };
      }

      if (item.entityType === 'shelter') {
        const isUpdate = item.action === 'update';
        const url = isUpdate ? `${this.baseUrl}/api/shelters/${item.entityId}` : `${this.baseUrl}/api/shelters`;
        const method = isUpdate ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: this.getHeaders(),
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) {
          return { success: false, statusCode: res.status, error: res.statusText };
        }
        return { success: true, serverAckTimestamp: now };
      }

      return { success: true, serverAckTimestamp: now };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  public async fetchRemoteRequests(): Promise<EmergencyRequest[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/sync`, {
        headers: this.getHeaders({ Accept: 'application/json' }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.requests) ? data.requests : [];
    } catch {
      return [];
    }
  }

  public async fetchRemoteTasks(): Promise<VolunteerTask[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/rescue-tasks`, {
        headers: this.getHeaders({ Accept: 'application/json' }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  public async fetchRemoteShelters(): Promise<Shelter[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/shelters`, {
        headers: this.getHeaders({ Accept: 'application/json' }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  public async fetchRemoteResourceOffers(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/resource-offers`, {
        headers: this.getHeaders({ Accept: 'application/json' }),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  public async fetchRemoteIncidents(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/incidents`, {
        headers: this.getHeaders({ Accept: 'application/json' }),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  public subscribeToRealtimeEvents(onEvent: (event: any) => void): () => void {
    if (typeof EventSource === 'undefined') return () => {};
    try {
      this.eventSource = new EventSource(`${this.baseUrl}/api/events`);
      this.eventSource.onmessage = (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type !== 'PING') {
            onEvent(parsed);
          }
        } catch {}
      };
      return () => {
        this.eventSource?.close();
        this.eventSource = null;
      };
    } catch {
      return () => {};
    }
  }
}

/**
 * LocalInMemoryAdapter
 * Simulates remote persistence completely in memory (ideal for tests and offline demos).
 * Supports simulated latency, server failure codes, offline toggling, and conflict generation.
 */
export class LocalInMemoryAdapter implements RemoteBackendAdapter {
  public readonly name = 'LocalInMemoryAdapter';
  public memoryRequests: EmergencyRequest[] = [];
  public memoryTasks: VolunteerTask[] = [];
  public memoryShelters: Shelter[] = [];
  public entityVersions: Map<string, number> = new Map();
  public simulatedLatencyMs: number = 0;
  public simulateOffline: boolean = false;
  public simulateFailure: boolean = false;
  public simulateFailureStatusCode: number = 500;
  public simulateFailureMessage: string = 'Internal Server Error';
  public authToken: string | null = null;
  public memoryResourceOffers: any[] = [];
  public memoryIncidents: any[] = [];

  public setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  public async isAvailable(): Promise<boolean> {
    if (this.simulateOffline) return false;
    return true;
  }

  public async pushQueueItem(item: SyncQueueItem): Promise<SyncPushResult> {
    if (this.simulateOffline) {
      return { success: false, error: 'Network unreachable' };
    }

    if (this.simulatedLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.simulatedLatencyMs));
    }

    if (this.simulateFailure) {
      return {
        success: false,
        statusCode: this.simulateFailureStatusCode,
        error: this.simulateFailureMessage,
      };
    }

    const now = new Date().toISOString();
    const currentVersion = this.entityVersions.get(item.entityId) || 1;

    // Detect conflict: client baseVersion is strictly behind current serverVersion
    if (item.baseVersion !== undefined && item.baseVersion < currentVersion) {
      return {
        success: false,
        conflict: true,
        statusCode: 409,
        serverVersion: currentVersion,
        error: `Conflict: Remote version (${currentVersion}) is newer than client base version (${item.baseVersion}).`,
      };
    }

    const nextVersion = currentVersion + 1;
    this.entityVersions.set(item.entityId, nextVersion);

    if (item.entityType === 'emergency_request') {
      const req = item.payload as unknown as EmergencyRequest;
      const idx = this.memoryRequests.findIndex((r) => r.id === req.id);
      if (item.action === 'delete') {
        this.memoryRequests = this.memoryRequests.filter((r) => r.id !== req.id);
      } else if (idx >= 0) {
        this.memoryRequests[idx] = { ...req, version: nextVersion };
      } else {
        this.memoryRequests.push({ ...req, version: nextVersion });
      }
    }

    return {
      success: true,
      serverAckTimestamp: now,
      serverVersion: nextVersion,
    };
  }

  public async fetchRemoteRequests(): Promise<EmergencyRequest[]> {
    return [...this.memoryRequests];
  }

  public async fetchRemoteTasks(): Promise<VolunteerTask[]> {
    return [...this.memoryTasks];
  }

  public async fetchRemoteShelters(): Promise<Shelter[]> {
    return [...this.memoryShelters];
  }
}
