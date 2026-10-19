import { useState, useEffect, useCallback, useRef } from 'react';
import type { Shelter, ShelterInventoryItem, IncomingDelivery, ShelterOperatingStatus } from '@/types';
import {
  calculateAvailableBeds,
  recordBedIntake,
  updateShelterCapacity,
  reserveBeds as domainReserveBeds,
  releaseReservedBeds as domainReleaseBeds,
  updateShelterOperatingStatus,
  updateShelterInventory as domainUpdateInventory,
  addIncomingDelivery as domainAddDelivery,
  receiveIncomingDelivery as domainReceiveDelivery,
  reportResourceShortage as domainReportShortage,
  resolveResourceShortage as domainResolveShortage,
  detectShelterShortages,
  ShelterDomainError,
} from '@/domain/services/shelter-service';
import { activityStore } from '@/storage/activity-store';
import { canUpdateShelter, type AuthUser } from '@/auth/permissions';
import { authClient } from '@/auth/auth-client';
import { toast } from 'sonner';

const STORAGE_KEY_SHELTERS = 'resqlink_shelters_state_v1';
const CHANNEL_NAME = 'resqlink_shelter_channel_v1';

function getShelterAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = authClient.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function useShelterStore(currentUser?: AuthUser | null, defaultShelters?: Shelter[]) {
  const [shelters, setShelters] = useState<Shelter[]>(() => {
    if (typeof window === 'undefined') return defaultShelters || [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHELTERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return defaultShelters || [];
    } catch {
      return defaultShelters || [];
    }
  });

  // Sync defaultShelters if shelters state is empty
  useEffect(() => {
    if (shelters.length === 0 && defaultShelters && defaultShelters.length > 0) {
      setShelters(defaultShelters);
    }
  }, [defaultShelters, shelters.length]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Cross-tab broadcast channel
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = channel;
        channel.onmessage = (event) => {
          if (event.data?.type === 'SHELTERS_UPDATED' && Array.isArray(event.data.shelters)) {
            setShelters(event.data.shelters);
          }
        };
        return () => channel.close();
      } catch (e) {
        console.warn('BroadcastChannel error in useShelterStore:', e);
      }
    }
  }, []);

  // Save to localStorage & broadcast
  const persistAndBroadcast = useCallback((updated: Shelter[]) => {
    setShelters(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_SHELTERS, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save shelters to localStorage:', e);
      }
    }
    try {
      channelRef.current?.postMessage({
        type: 'SHELTERS_UPDATED',
        shelters: updated,
      });
    } catch {
      // ignore
    }
  }, []);

  // Fetch from server /api/shelters
  const fetchShelters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/shelters', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          persistAndBroadcast(data);
          setError(null);
          return;
        }
      }
    } catch {
      // Offline fallback: keep existing or local state
    } finally {
      setLoading(false);
    }
  }, [persistAndBroadcast]);

  useEffect(() => {
    fetchShelters();

    let eventSource: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.type === 'SHELTER_UPDATED') {
              fetchShelters();
            }
          } catch {}
        };
      } catch {}
    }

    const interval = setInterval(fetchShelters, 5000);
    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [fetchShelters]);

  // Check auth helper
  const assertAuthorized = (shelterId?: string): boolean => {
    if (!currentUser) {
      toast.error('Authentication Required', {
        description: 'You must be logged in as a Shelter Manager or Disaster Coordinator to make updates.',
      });
      return false;
    }
    if (!canUpdateShelter(currentUser, shelterId)) {
      toast.error('Access Denied', {
        description: `Your role (${currentUser.role}) does not have permission to modify shelter records.`,
      });
      return false;
    }
    return true;
  };

  /**
   * Updates total capacity with invariant check preventing capacity < occupied + reserved
   */
  const updateCapacity = async (shelterId: string, newTotalCapacity: number) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = updateShelterCapacity(target as any, newTotalCapacity);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      // Log activity
      activityStore.recordEvent({
        type: 'shelter_updated',
        title: 'Shelter Capacity Updated',
        description: `${target.name} total capacity updated to ${newTotalCapacity} beds.`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      // Push to server
      fetch(`/api/shelters/${shelterId}`, {
        method: 'PUT',
        headers: getShelterAuthHeaders(),
        body: JSON.stringify({ totalCapacity: newTotalCapacity }),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Capacity Updated', {
        description: `${target.name} maximum capacity is now ${newTotalCapacity} beds.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Invalid Capacity Reduction', { description: msg });
      throw err;
    }
  };

  /**
   * Records bed intake (occupied bed count)
   */
  const recordIntake = async (shelterId: string, newOccupiedBeds: number) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = recordBedIntake(target as any, newOccupiedBeds);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'intake_recorded',
        title: 'Shelter Bed Intake Recorded',
        description: `${target.name} occupied beds updated to ${newOccupiedBeds} (${calculateAvailableBeds(updatedDomain)} free).`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}/intake`, {
        method: 'POST',
        headers: getShelterAuthHeaders(),
        body: JSON.stringify({ newOccupiedBeds }),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Bed Intake Saved', {
        description: `${target.name} currently has ${newOccupiedBeds} occupied beds.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Capacity Invariant Error', { description: msg });
      throw err;
    }
  };

  /**
   * Reserves beds for incoming evacuee convoys
   */
  const reserveBeds = async (shelterId: string, bedsToReserve: number) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = domainReserveBeds(target as any, bedsToReserve);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'shelter_updated',
        title: 'Shelter Beds Reserved',
        description: `Reserved ${bedsToReserve} beds at ${target.name} for incoming evacuees.`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}/reserve`, {
        method: 'POST',
        headers: getShelterAuthHeaders(),
        body: JSON.stringify({ bedsToReserve }),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Beds Reserved', {
        description: `Reserved ${bedsToReserve} beds at ${target.name}.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Reservation Error', { description: msg });
      throw err;
    }
  };

  /**
   * Releases reserved beds
   */
  const releaseBeds = async (shelterId: string, bedsToRelease: number, convertedToOccupied = false) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = domainReleaseBeds(target as any, bedsToRelease, convertedToOccupied);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'shelter_updated',
        title: 'Reserved Beds Released',
        description: `Released ${bedsToRelease} reserved beds at ${target.name} (${convertedToOccupied ? 'checked in' : 'cancelled'}).`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}/release`, {
        method: 'POST',
        headers: getShelterAuthHeaders(),
        body: JSON.stringify({ bedsToRelease, convertedToOccupied }),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Beds Released', {
        description: `${bedsToRelease} reserved beds released at ${target.name}.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Release Error', { description: msg });
      throw err;
    }
  };

  /**
   * Updates shelter operating status ('open', 'full', 'evacuating', 'closed')
   */
  const updateStatus = async (shelterId: string, newStatus: ShelterOperatingStatus) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = updateShelterOperatingStatus(target as any, newStatus);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'shelter_updated',
        title: 'Shelter Status Changed',
        description: `${target.name} status updated to ${newStatus.toUpperCase()}.`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}`, {
        method: 'PUT',
        headers: getShelterAuthHeaders(),
        body: JSON.stringify({ operatingStatus: newStatus }),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Status Updated', {
        description: `${target.name} is now marked ${newStatus.toUpperCase()}.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Status Update Error', { description: msg });
      throw err;
    }
  };

  /**
   * Updates inventory item stock
   */
  const updateInventory = async (
    shelterId: string,
    itemKey: string,
    quantity: number,
    unit = 'units',
    minThreshold?: number
  ) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = domainUpdateInventory(target as any, itemKey, quantity, unit, minThreshold);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'shelter_updated',
        title: 'Essential Supplies Adjusted',
        description: `${target.name} updated ${itemKey}: ${quantity} ${unit}.`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}/inventory`, {
        method: 'POST',
        headers: getShelterAuthHeaders(),
        body: JSON.stringify({ itemKey, quantity, unit, minThreshold }),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Inventory Adjusted', {
        description: `${itemKey} stock updated to ${quantity} ${unit}.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Inventory Error', { description: msg });
      throw err;
    }
  };

  /**
   * Schedules incoming delivery of food, water, blankets, etc.
   */
  const scheduleDelivery = async (shelterId: string, delivery: Omit<IncomingDelivery, 'id'>) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = domainAddDelivery(target as any, delivery);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'delivery_scheduled',
        title: 'Delivery Scheduled',
        description: `Incoming shipment: ${delivery.quantity} ${delivery.unit} of ${delivery.item} for ${target.name}.`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Logistics Coordinator',
        actorRole: currentUser?.role || 'coordinator',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}/deliveries`, {
        method: 'POST',
        headers: getShelterAuthHeaders(),
        body: JSON.stringify(delivery),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Delivery Scheduled', {
        description: `${delivery.quantity} ${delivery.unit} of ${delivery.item} scheduled for arrival.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Delivery Error', { description: msg });
      throw err;
    }
  };

  /**
   * Receives incoming delivery and restocks inventory
   */
  const receiveDelivery = async (shelterId: string, deliveryId: string) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = domainReceiveDelivery(target as any, deliveryId);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'delivery_received',
        title: 'Delivery Received & Restocked',
        description: `${target.name} confirmed arrival of shipment ${deliveryId}. Inventory restocked.`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}/deliveries/${deliveryId}/receive`, {
        method: 'POST',
        headers: getShelterAuthHeaders(),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Delivery Received', {
        description: `Shipment received and added to shelter inventory.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Receive Error', { description: msg });
      throw err;
    }
  };

  /**
   * Reports resource shortage
   */
  const reportShortage = async (shelterId: string, itemKey: string) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = domainReportShortage(target as any, itemKey);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'shelter_updated',
        title: 'Resource Shortage Declared',
        description: `${target.name} reported critical shortage of ${itemKey}.`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}/shortages`, {
        method: 'POST',
        headers: getShelterAuthHeaders(),
        body: JSON.stringify({ itemKey }),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.warning('Shortage Logged', {
        description: `Shortage of ${itemKey} reported to central dispatch.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Error reporting shortage', { description: msg });
      throw err;
    }
  };

  /**
   * Resolves resource shortage
   */
  const resolveShortage = async (shelterId: string, itemKey: string) => {
    if (!assertAuthorized(shelterId)) return false;

    const target = shelters.find((s) => s.id === shelterId);
    if (!target) throw new Error(`Shelter ${shelterId} not found.`);

    try {
      const updatedDomain = domainResolveShortage(target as any, itemKey);
      const updatedList = shelters.map((s) => (s.id === shelterId ? (updatedDomain as unknown as Shelter) : s));
      persistAndBroadcast(updatedList);

      activityStore.recordEvent({
        type: 'shelter_updated',
        title: 'Resource Shortage Resolved',
        description: `${target.name} resolved shortage of ${itemKey}.`,
        targetId: shelterId,
        targetType: 'shelter',
        actorName: currentUser?.displayName || 'Shelter Officer',
        actorRole: currentUser?.role || 'shelter_officer',
        isLive: true,
      });

      fetch(`/api/shelters/${shelterId}/shortages/${itemKey}`, {
        method: 'DELETE',
        headers: getShelterAuthHeaders(),
      }).catch((err) => console.warn('Server sync failed:', err));

      toast.success('Shortage Resolved', {
        description: `${itemKey} shortage marked as resolved.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Error resolving shortage', { description: msg });
      throw err;
    }
  };

  return {
    shelters,
    loading,
    error,
    refresh: fetchShelters,
    updateCapacity,
    recordIntake,
    reserveBeds,
    releaseBeds,
    updateStatus,
    updateInventory,
    scheduleDelivery,
    receiveDelivery,
    reportShortage,
    resolveShortage,
  };
}
