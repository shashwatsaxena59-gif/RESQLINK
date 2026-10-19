import { useCallback, useEffect, useState } from 'react';
import { syncQueueManager } from '@/sync/sync-queue';
import { syncQueueRepo } from '@/storage/repositories/sync-queue-repository';

export type NetworkStatus = 'online' | 'offline';

const STORAGE_KEY = 'resqlink-network';
const QUEUE_KEY = 'resqlink-offline-queue';

export interface QueuedRequest {
  id: string;
  category: string;
  details: string;
  items: string;
  contact: string;
  coords: string;
  createdAt: number;
  region?: string;
  location?: string;
  // Optional AI triage data — present when submitted via TriagePanel
  triage?: {
    priority:         'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    incidentType:     string;
    people:           number | null;
    vulnerable:       { elderly: number; children: number; pregnant: number; disabled: number; injured: number };
    dangerIndicators: string[];
    priorityReasons:  string[];
    requiredResources:string[];
    rawMessage:       string;
    parsedBy:         'gemini' | 'fallback';
  };
}

export function useNetwork() {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    if (typeof window === 'undefined') return 'online';
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'offline' ? 'offline' : 'online';
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, status);
  }, [status]);

  const toggle = useCallback(() => {
    setStatus((s) => (s === 'online' ? 'offline' : 'online'));
  }, []);

  return { status, toggle, isOnline: status === 'online' };
}

export function useOfflineQueue(isOnline: boolean) {
  const [queue, setQueue] = useState<QueuedRequest[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(QUEUE_KEY);
      return saved ? (JSON.parse(saved) as QueuedRequest[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);

  const enqueue = useCallback((req: QueuedRequest) => {
    setQueue((q) => [...q, req]);
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((q) => q.filter((item) => item.id !== id));
  }, []);

  // When connectivity returns, trigger real background sync
  useEffect(() => {
    if (isOnline) {
      syncQueueManager.processQueue().catch((err) => {
        console.warn('Sync queue background run:', err);
      });
    }
  }, [isOnline]);

  return { queue, enqueue, clearQueue, removeFromQueue, queueCount: queue.length };
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}
