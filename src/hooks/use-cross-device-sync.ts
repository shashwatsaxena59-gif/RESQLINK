import { useState, useEffect, useRef, useCallback } from 'react';
import type { AidRequest } from '@/types';

interface SyncData {
  requests: AidRequest[];
  resolvedIds: string[];
  helpingIds: string[];
  version: number;
}

const LOCAL_STORAGE_KEY_REQUESTS = 'resqlink-custom-requests-v1';
const LOCAL_STORAGE_KEY_RESOLVED = 'resqlink-resolved-requests';
const LOCAL_STORAGE_KEY_HELPING  = 'resqlink-helping-requests-v1';

export function useCrossDeviceSync() {
  // Local state initialized from localStorage
  const [customRequests, setCustomRequests] = useState<AidRequest[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_REQUESTS);
      return saved ? (JSON.parse(saved) as AidRequest[]) : [];
    } catch {
      return [];
    }
  });

  const [resolvedRequestIds, setResolvedRequestIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_RESOLVED);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [helpingRequestIds, setHelpingRequestIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_HELPING);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  const lastVersionRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // BroadcastChannel for instant same-browser multi-tab sync
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('resqlink-sync-v1');
      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_UPDATE') {
          const { requests, resolvedIds, helpingIds } = event.data;
          if (Array.isArray(requests)) setCustomRequests(requests);
          if (Array.isArray(resolvedIds)) setResolvedRequestIds(resolvedIds);
          if (Array.isArray(helpingIds)) setHelpingRequestIds(helpingIds);
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  // Fetch updates from the shared server with adaptive polling
  const isServerAvailableRef = useRef<boolean>(true);
  const failureCountRef = useRef<number>(0);

  const pullFromServer = useCallback(async () => {
    // If hidden, skip polling to conserve client resources
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch('/api/sync', {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        isServerAvailableRef.current = false;
        failureCountRef.current = Math.min(failureCountRef.current + 1, 10);
        return;
      }

      isServerAvailableRef.current = true;
      failureCountRef.current = 0;
      const data: SyncData = await res.json();

      if (data && typeof data.version === 'number') {
        if (data.version !== lastVersionRef.current) {
          lastVersionRef.current = data.version;

          if (Array.isArray(data.requests)) {
            setCustomRequests(data.requests);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY_REQUESTS, JSON.stringify(data.requests));
            } catch (e) {
              console.error(e);
            }
          }

          if (Array.isArray(data.resolvedIds)) {
            setResolvedRequestIds(data.resolvedIds);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY_RESOLVED, JSON.stringify(data.resolvedIds));
            } catch (e) {
              console.error(e);
            }
          }

          if (Array.isArray(data.helpingIds)) {
            setHelpingRequestIds(data.helpingIds);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY_HELPING, JSON.stringify(data.helpingIds));
            } catch (e) {
              console.error(e);
            }
          }

          // Broadcast to tabs
          channelRef.current?.postMessage({
            type: 'SYNC_UPDATE',
            requests: data.requests,
            resolvedIds: data.resolvedIds,
            helpingIds: data.helpingIds,
          });
        }
      }
    } catch {
      // Backend offline or unreachable, local fallback remains active
      isServerAvailableRef.current = false;
      failureCountRef.current = Math.min(failureCountRef.current + 1, 10);
    }
  }, []);

  // Adaptive Real-Time Sync: polite polling + optional SSE if backend available
  useEffect(() => {
    pullFromServer();

    let eventSource: EventSource | null = null;
    let sseTimeout: ReturnType<typeof setTimeout> | null = null;

    // Only attempt EventSource after initial pull indicates server availability
    sseTimeout = setTimeout(() => {
      if (isServerAvailableRef.current && typeof EventSource !== 'undefined') {
        try {
          eventSource = new EventSource('/api/events');
          eventSource.onmessage = (e) => {
            try {
              const parsed = JSON.parse(e.data);
              if (parsed.type && parsed.type !== 'PING') {
                pullFromServer();
              }
            } catch {}
          };
          eventSource.onerror = () => {
            // Close SSE on error to avoid repeated reconnect thrashing
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
          };
        } catch {}
      }
    }, 1500);

    // Adaptive interval: 10s if server reachable, 30s backoff if server is down
    let intervalTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextPoll = () => {
      const delay = failureCountRef.current > 0 ? 30000 : 10000;
      intervalTimer = setTimeout(async () => {
        await pullFromServer();
        scheduleNextPoll();
      }, delay);
    };

    scheduleNextPoll();

    const handleFocus = () => {
      failureCountRef.current = 0;
      pullFromServer();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      if (sseTimeout) clearTimeout(sseTimeout);
      if (eventSource) eventSource.close();
      if (intervalTimer) clearTimeout(intervalTimer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  }, [pullFromServer]);

  // Actions with instant local + remote server propagation
  const addCustomRequest = useCallback((newReq: AidRequest) => {
    setCustomRequests((prev) => {
      const next = [newReq, ...prev.filter((r) => r.id !== newReq.id)];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_REQUESTS, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    // Instant same-browser cross-tab broadcast
    channelRef.current?.postMessage({
      type: 'SYNC_UPDATE',
      requests: [newReq],
      resolvedIds: [],
      helpingIds: [],
    });

    // Notify server asynchronously without blocking UI
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    fetch('/api/sync/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReq),
      signal: controller.signal,
    })
      .then(() => {
        clearTimeout(timeout);
        pullFromServer();
      })
      .catch(() => {
        clearTimeout(timeout);
      });
  }, [pullFromServer]);

  const resolveRequest = useCallback((id: string) => {
    setCustomRequests((prev) => {
      const next = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_REQUESTS, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    setResolvedRequestIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_RESOLVED, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    // Notify server
    fetch('/api/sync/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
      .then(() => pullFromServer())
      .catch(() => {});
  }, [pullFromServer]);

  const helpRequest = useCallback((id: string) => {
    setHelpingRequestIds((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_HELPING, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    fetch('/api/sync/help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
      .then(() => pullFromServer())
      .catch(() => {});
  }, [pullFromServer]);

  const cancelHelpRequest = useCallback((id: string) => {
    setHelpingRequestIds((prev) => {
      const next = prev.filter((item) => item !== id);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_HELPING, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    fetch('/api/sync/cancel-help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
      .then(() => pullFromServer())
      .catch(() => {});
  }, [pullFromServer]);

  const restoreRequests = useCallback(() => {
    setResolvedRequestIds([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_RESOLVED);
    } catch (e) {
      console.error(e);
    }

    fetch('/api/sync/restore', {
      method: 'POST',
    })
      .then(() => pullFromServer())
      .catch(() => {});
  }, [pullFromServer]);

  return {
    customRequests,
    resolvedRequestIds,
    helpingRequestIds,
    addCustomRequest,
    resolveRequest,
    helpRequest,
    cancelHelpRequest,
    restoreRequests,
  };
}
