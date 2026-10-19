/**
 * ResQLink Operations Activity Timeline Store
 * Records and broadcasts significant operational events:
 * - Request acknowledgement
 * - Task assignment
 * - Shelter capacity & inventory updates
 * - Resource allocations
 * - Mission completion
 * Strictly distinguishes confirmed live events from simulated demo activity.
 */

export type ActivityEventType =
  | 'request_created'
  | 'request_acknowledged'
  | 'task_assigned'
  | 'volunteer_accepted'
  | 'shelter_updated'
  | 'intake_recorded'
  | 'delivery_scheduled'
  | 'delivery_received'
  | 'resource_allocated'
  | 'request_completed'
  | 'sync_completed'
  | 'sync_failed';

export interface ActivityEvent {
  id: string;
  timestamp: string; // ISO 8601
  type: ActivityEventType;
  title: string;
  description: string;
  targetId?: string;
  targetType?: 'request' | 'shelter' | 'task' | 'resource' | 'sync' | 'volunteer';
  actorName: string;
  actorRole: string;
  isLive: boolean; // true = actual confirmed user/system record, false = simulated demo data
}

const STORAGE_KEY = 'resqlink_activity_events_v1';
const CHANNEL_NAME = 'resqlink_activity_channel';

// Default initial demo events explicitly labeled as simulated
const INITIAL_DEMO_EVENTS: ActivityEvent[] = [
  {
    id: 'act-demo-1',
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    type: 'request_acknowledged',
    title: 'SOS Request Acknowledged',
    description: 'Dialysis patient dispatch prioritized near Yamuna Bank.',
    targetId: 'req-001',
    targetType: 'request',
    actorName: 'Command Dispatch (C-1)',
    actorRole: 'coordinator',
    isLive: false,
  },
  {
    id: 'act-demo-2',
    timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    type: 'task_assigned',
    title: 'Rescue Mission Dispatched',
    description: 'Dr. Arjun R. assigned to Geeta Colony water purification mission.',
    targetId: 'req-003',
    targetType: 'task',
    actorName: 'NDRF Relay Officer',
    actorRole: 'coordinator',
    isLive: false,
  },
  {
    id: 'act-demo-3',
    timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    type: 'shelter_updated',
    title: 'Shelter Capacity Intake',
    description: 'Chhatrasal Stadium recorded intake of 14 evacuees from Wazirabad.',
    targetId: 'shelter-004',
    targetType: 'shelter',
    actorName: 'Caretaker Sharma',
    actorRole: 'shelter_officer',
    isLive: false,
  },
  {
    id: 'act-demo-4',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    type: 'delivery_scheduled',
    title: 'Essential Supplies In-Transit',
    description: '50 emergency blankets en route to Rajkiya Sarvodaya Bal Vidyalaya.',
    targetId: 'shelter-001',
    targetType: 'shelter',
    actorName: 'Red Cross Logistics',
    actorRole: 'coordinator',
    isLive: false,
  },
];

class ActivityStore {
  private events: ActivityEvent[] = [];
  private listeners: Set<(events: ActivityEvent[]) => void> = new Set();
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.loadFromStorage();

    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        (this.channel as any)?.unref?.();
        this.channel.onmessage = (e) => {
          if (e.data?.type === 'ACTIVITY_UPDATE' && Array.isArray(e.data.events)) {
            this.events = e.data.events;
            this.notify();
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not available:', err);
      }
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') {
      this.events = [...INITIAL_DEMO_EVENTS];
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.events = JSON.parse(raw);
      } else {
        this.events = [...INITIAL_DEMO_EVENTS];
        this.saveToStorage();
      }
    } catch {
      this.events = [...INITIAL_DEMO_EVENTS];
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch (err) {
      console.error('Failed to save activity events:', err);
    }
  }

  private notify() {
    this.listeners.forEach((l) => l(this.getEvents()));
  }

  public getEvents(): ActivityEvent[] {
    return [...this.events].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public recordEvent(
    event: Omit<ActivityEvent, 'id' | 'timestamp' | 'isLive'> & { isLive?: boolean }
  ): ActivityEvent {
    const newEvent: ActivityEvent = {
      ...event,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      isLive: event.isLive ?? true,
    };

    // Keep up to 100 recent events
    this.events = [newEvent, ...this.events].slice(0, 100);
    this.saveToStorage();
    this.notify();

    try {
      this.channel?.postMessage({
        type: 'ACTIVITY_UPDATE',
        events: this.events,
      });
    } catch {
      // ignore channel post error
    }

    return newEvent;
  }

  public subscribe(listener: (events: ActivityEvent[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getEvents());
    return () => this.listeners.delete(listener);
  }
}

export const activityStore = new ActivityStore();
