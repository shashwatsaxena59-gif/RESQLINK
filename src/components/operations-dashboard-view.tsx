import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  Building2,
  Users,
  LifeBuoy,
  HeartPulse,
  Droplets,
  BedDouble,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Layers,
  MapPin,
  Activity,
  Send,
  UserCheck,
  Package,
  Wifi,
  WifiOff,
  Compass,
  FileCheck,
  Share2,
  SlidersHorizontal,
  X,
  Phone,
  ArrowUpDown,
  Truck,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  AidRequest,
  Shelter,
  Volunteer,
  Resource,
  RequestPriority,
  RequestCategory,
  FilterCategory,
} from '@/types';
import type { ResourceOffer } from '@/domain/models/resource-offer';
import type { MapRegion } from '@/components/map-view';
import { MapView } from '@/components/map-view';
import { calculateAvailableBeds } from '@/domain/services/shelter-service';
import { activityStore, type ActivityEvent } from '@/storage/activity-store';
import type { AuthUser } from '@/auth/permissions';
import { toast } from 'sonner';

interface OperationsDashboardViewProps {
  requests: AidRequest[];
  shelters: Shelter[];
  volunteers: Volunteer[];
  resources: Resource[];
  resourceOffers?: ResourceOffer[];
  region: MapRegion;
  locationLabel: string;
  pendingSyncCount?: number;
  isOnline?: boolean;
  currentUser?: AuthUser | null;
  selectedId?: string | null;
  onNavigateToMap: () => void;
  onOpenSos: () => void;
  onOpenShelters: () => void;
  onOpenNgoPortal: () => void;
  onOpenSyncModal?: () => void;
  onSelectRequest: (id: string) => void;
  onOpenDetailsModal?: (id: string) => void;
  onAcknowledgeRequest?: (id: string) => void;
  onAssignVolunteerTask?: (requestId: string, volunteerId?: string) => void;
  onAllocateResource?: (resourceId: string, requestId: string) => void;
  onResolveRequest?: (id: string) => void;
  onOpenShelterOperatorModal?: (shelterId: string) => void;
}

// Helper to format human-readable relative age and exact time
function formatRelativeAge(timestamp: number | string | undefined): { relative: string; exact: string } {
  if (!timestamp) return { relative: 'Live', exact: 'Real-time' };
  const timeMs = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(timeMs)) return { relative: 'Live', exact: 'Real-time' };
  const exact = new Date(timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
  if (diffSec < 60) return { relative: 'Just now', exact };
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return { relative: `${diffMin}m ago`, exact };
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return { relative: `${diffHours}h ${diffMin % 60}m ago`, exact };
  const diffDays = Math.floor(diffHours / 24);
  return { relative: `${diffDays}d ago`, exact };
}

export function OperationsDashboardView({
  requests,
  shelters,
  volunteers,
  resources,
  resourceOffers = [],
  region,
  locationLabel,
  pendingSyncCount = 0,
  isOnline = true,
  currentUser,
  selectedId: propSelectedId,
  onNavigateToMap,
  onOpenSos,
  onOpenShelters,
  onOpenNgoPortal,
  onOpenSyncModal,
  onSelectRequest,
  onOpenDetailsModal,
  onAcknowledgeRequest,
  onAssignVolunteerTask,
  onAllocateResource,
  onResolveRequest,
  onOpenShelterOperatorModal,
}: OperationsDashboardViewProps) {
  // ── Selected Item & Sync with Map ──
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(propSelectedId || null);
  const activeSelectedId = propSelectedId !== undefined ? propSelectedId : internalSelectedId;

  // ── Tab State ──
  const [activeCenterTab, setActiveCenterTab] = useState<'triage' | 'shelters' | 'tasks' | 'shortages' | 'activity'>('triage');

  // ── Feed Filters & Search ──
  const [priorityFilter, setPriorityFilter] = useState<'all' | RequestPriority>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RequestCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'in-progress' | 'resolved'>('all');
  const [syncFilter, setSyncFilter] = useState<'all' | 'pending' | 'synced'>('all');
  const [sortBy, setSortBy] = useState<'urgency' | 'newest' | 'oldest' | 'distance' | 'people'>('urgency');
  const [search, setSearch] = useState('');

  // ── Shelter Filter ──
  const [shelterFilter, setShelterFilter] = useState<'all' | 'available' | 'full'>('all');

  // ── Activity Filter ──
  const [activityFilter, setActivityFilter] = useState<'all' | 'live' | 'demo'>('all');

  // ── Activity Timeline State ──
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(() => activityStore.getEvents());

  useEffect(() => {
    const unsub = activityStore.subscribe((events) => {
      setActivityEvents(events);
    });
    return unsub;
  }, []);

  // ── Real Derived Metrics (All derived from active ledger records) ──
  const metrics = useMemo(() => {
    // 1. Active SOS Requests
    const activeRequests = requests.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled');

    // 2. Critical & High Priority Cases
    const criticalCount = activeRequests.filter((r) => r.priority === 'critical').length;
    const urgentCount = activeRequests.filter((r) => r.priority === 'urgent').length;
    const highPriorityCases = criticalCount + urgentCount;

    // 3. Available Volunteers
    const availableVolunteers = volunteers.filter((v) => v.available).length;
    const totalVolunteers = volunteers.length;

    // 4. Open Volunteer Tasks
    const openTasks = requests.filter(
      (r) =>
        (r.category === 'rescue' || r.category === 'volunteers' || r.status === 'in-progress') &&
        r.status !== 'resolved' &&
        r.status !== 'cancelled'
    );

    // 5. Available Shelter Beds (derived from strict capacity math)
    let totalBedCap = 0;
    let totalBedOcc = 0;
    let totalBedRsv = 0;
    let availableBeds = 0;

    shelters.forEach((s) => {
      const cap = s.totalCapacity ?? s.capacity ?? 0;
      const occ = s.occupiedBeds ?? s.occupied ?? 0;
      const rsv = s.reservedBeds ?? 0;
      totalBedCap += cap;
      totalBedOcc += occ;
      totalBedRsv += rsv;
      availableBeds += calculateAvailableBeds(s);
    });

    const occupancyRate = Math.round((totalBedOcc / Math.max(1, totalBedCap)) * 100);

    // 6. Unfulfilled Resource Needs (requests needing specific supplies + shelter shortages)
    const requestsNeedingItems = requests.filter(
      (r) => r.items && r.items.length > 0 && r.status !== 'resolved' && r.status !== 'cancelled'
    ).length;
    let shelterShortagesCount = 0;
    shelters.forEach((s) => {
      if (s.resourceShortages && s.resourceShortages.length > 0) {
        shelterShortagesCount += s.resourceShortages.length;
      }
    });
    const unfulfilledResourceNeeds = requestsNeedingItems + shelterShortagesCount;

    // 7. Activity Event Provenance Breakdown
    const liveEventsCount = activityEvents.filter((e) => e.isLive).length;
    const demoEventsCount = activityEvents.filter((e) => !e.isLive).length;

    return {
      activeRequestsCount: activeRequests.length,
      criticalCount,
      urgentCount,
      highPriorityCases,
      availableVolunteers,
      totalVolunteers,
      openTasksCount: openTasks.length,
      availableBeds,
      totalBedCap,
      totalBedOcc,
      totalBedRsv,
      occupancyRate,
      unfulfilledResourceNeeds,
      requestsNeedingItems,
      shelterShortagesCount,
      liveEventsCount,
      demoEventsCount,
    };
  }, [requests, volunteers, shelters, activityEvents]);

  // ── Filtered & Sorted Requests for Command Feed ──
  const filteredRequests = useMemo(() => {
    const list = requests.filter((r) => {
      const matchPrio = priorityFilter === 'all' || r.priority === priorityFilter;
      const matchCat = categoryFilter === 'all' || r.category === categoryFilter;
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? r.status !== 'resolved' && r.status !== 'cancelled'
          : r.status === statusFilter;
      const matchSync =
        syncFilter === 'all'
          ? true
          : syncFilter === 'pending'
          ? r.syncStatus === 'pending' || r.isUserCreated
          : r.syncStatus === 'synced' || !r.isUserCreated;
      const matchSearch =
        !search ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.details.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase()) ||
        (r.locationDescription && r.locationDescription.toLowerCase().includes(search.toLowerCase())) ||
        (r.contactName && r.contactName.toLowerCase().includes(search.toLowerCase())) ||
        (r.items && r.items.some((it) => it.toLowerCase().includes(search.toLowerCase())));
      return matchPrio && matchCat && matchStatus && matchSync && matchSearch;
    });

    return list.sort((a, b) => {
      if (sortBy === 'urgency') {
        const prioScore: Record<string, number> = { critical: 3, urgent: 2, moderate: 1 };
        const diff = (prioScore[b.priority] || 0) - (prioScore[a.priority] || 0);
        if (diff !== 0) return diff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === 'newest') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === 'oldest') {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }
      if (sortBy === 'distance') {
        return (a.distanceMiles || 0) - (b.distanceMiles || 0);
      }
      if (sortBy === 'people') {
        return (b.peopleCount || 1) - (a.peopleCount || 1);
      }
      return 0;
    });
  }, [requests, priorityFilter, categoryFilter, statusFilter, syncFilter, search, sortBy]);

  // ── Filtered Shelters ──
  const filteredShelters = useMemo(() => {
    return shelters.filter((s) => {
      const free = calculateAvailableBeds(s);
      if (shelterFilter === 'available') return free > 0;
      if (shelterFilter === 'full') return free === 0 || (s.operatingStatus ?? s.status) === 'full';
      return true;
    });
  }, [shelters, shelterFilter]);

  // ── Selected Entity for Detail Inspection Panel ──
  const selectedEntity = useMemo(() => {
    if (!activeSelectedId) return null;
    const req = requests.find((r) => r.id === activeSelectedId);
    if (req) return { type: 'request' as const, data: req };
    const sh = shelters.find((s) => s.id === activeSelectedId);
    if (sh) return { type: 'shelter' as const, data: sh };
    const vol = volunteers.find((v) => v.id === activeSelectedId);
    if (vol) return { type: 'volunteer' as const, data: vol };
    const res = resources.find((r) => r.id === activeSelectedId);
    if (res) return { type: 'resource' as const, data: res };
    const off = resourceOffers.find((o) => o.id === activeSelectedId);
    if (off) return { type: 'offer' as const, data: off };
    return null;
  }, [activeSelectedId, requests, shelters, volunteers, resources, resourceOffers]);

  // Handle Item Select (Request, Shelter, Volunteer, Resource)
  const handleItemSelect = (id: string) => {
    setInternalSelectedId(id);
    onSelectRequest(id);
  };

  const handleDeselect = () => {
    setInternalSelectedId(null);
  };

  // ── Coordinator Actions with Live Audit Trail ──
  const handleAcknowledge = (e: React.MouseEvent, req: AidRequest) => {
    e.stopPropagation();
    activityStore.recordEvent({
      type: 'request_acknowledged',
      title: 'Incident Ticket Acknowledged',
      description: `Coordinator verified priority for "${req.title}". Field dispatch alert transmitted.`,
      targetId: req.id,
      targetType: 'request',
      actorName: currentUser?.displayName || 'Disaster Coordinator',
      actorRole: currentUser?.role || 'coordinator',
      isLive: true,
    });
    if (onAcknowledgeRequest) {
      onAcknowledgeRequest(req.id);
    } else {
      toast.success('Incident Acknowledged', {
        description: `Signal for ${req.title} marked prioritized.`,
      });
    }
  };

  const handleQuickAssign = (e: React.MouseEvent, req: AidRequest) => {
    e.stopPropagation();
    const availableVol = volunteers.find((v) => v.available);
    const volName = availableVol ? availableVol.name : 'Rapid Response Unit 1';

    activityStore.recordEvent({
      type: 'task_assigned',
      title: 'Field Responder Dispatched',
      description: `Dispatched ${volName} to assist with mission "${req.title}".`,
      targetId: req.id,
      targetType: 'task',
      actorName: currentUser?.displayName || 'Incident Command',
      actorRole: currentUser?.role || 'coordinator',
      isLive: true,
    });

    if (onAssignVolunteerTask) {
      onAssignVolunteerTask(req.id, availableVol?.id);
    } else {
      toast.success('Volunteer Dispatched', {
        description: `${volName} assigned to mission.`,
      });
    }
  };

  const handleQuickResolve = (e: React.MouseEvent, req: AidRequest) => {
    e.stopPropagation();
    activityStore.recordEvent({
      type: 'request_completed',
      title: 'Mission Confirmed Fulfilled',
      description: `Emergency operation for "${req.title}" confirmed fulfilled and logged.`,
      targetId: req.id,
      targetType: 'request',
      actorName: currentUser?.displayName || 'Incident Command',
      actorRole: currentUser?.role || 'coordinator',
      isLive: true,
    });

    if (onResolveRequest) {
      onResolveRequest(req.id);
    } else {
      toast.success('Incident Resolved', {
        description: `${req.title} marked resolved in operational ledger.`,
      });
    }
  };

  const handleQuickAllocateResource = (e: React.MouseEvent, req: AidRequest) => {
    e.stopPropagation();
    const item = req.items?.[0] || 'Relief Supplies';
    activityStore.recordEvent({
      type: 'resource_allocated',
      title: 'Emergency Supplies Allocated',
      description: `Allocated inventory (${item}) for dispatch to "${req.title}".`,
      targetId: req.id,
      targetType: 'resource',
      actorName: currentUser?.displayName || 'Logistics Officer',
      actorRole: currentUser?.role || 'coordinator',
      isLive: true,
    });

    if (onAllocateResource) {
      onAllocateResource('res-auto', req.id);
    } else {
      toast.success('Supplies Allocated', {
        description: `Reserved supplies allocated for ${req.title}.`,
      });
    }
  };

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Top Header Banner: Live Operational Command ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-alert" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-alert font-bold">
              Operations Command Center
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono px-2 py-0 border-primary/40 text-primary bg-primary/10">
              Territory: {locationLabel}
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Integrated Emergency Operations & Incident Command
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            Every metric below links directly to a filtered view. Click any card to immediately focus the operational ledger.
          </p>
        </div>

        {/* Action Controls & Sync Status Telemetry */}
        <div className="flex flex-wrap items-center gap-2">
          {pendingSyncCount > 0 ? (
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-warning/40 bg-warning/10 text-warning text-xs font-mono font-bold hover:bg-warning/20 transition-all cursor-pointer"
              title="Click to view and manage pending synchronization queue"
            >
              <WifiOff className="h-3.5 w-3.5" />
              <span>{pendingSyncCount} Pending Sync</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-success/30 bg-success/10 text-success text-xs font-mono hover:bg-success/20 transition-all cursor-pointer"
              title="All client operations synced with authority ledger"
            >
              <Wifi className="h-3.5 w-3.5" />
              <span>Synced with Server</span>
            </button>
          )}

          <Button
            onClick={onOpenNgoPortal}
            variant="outline"
            size="sm"
            className="text-xs font-mono h-9 border-border"
          >
            NGO / Dispatch Portal
          </Button>

          <Button
            onClick={onOpenShelters}
            variant="outline"
            size="sm"
            className="text-xs font-mono h-9 border-border text-info hover:text-info hover:bg-info/10"
          >
            <Building2 className="h-3.5 w-3.5 mr-1" />
            Shelter Directory
          </Button>

          <Button
            onClick={onNavigateToMap}
            size="sm"
            className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-xs h-9 font-mono"
          >
            Full Map View <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* ── Operations Command KPI Grid (8 derived metrics, EVERY card links to relevant filtered view) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
        {/* Metric 1: Active SOS Requests -> Links to Active Triage Feed */}
        <button
          type="button"
          onClick={() => {
            setActiveCenterTab('triage');
            setStatusFilter('active');
            setPriorityFilter('all');
            setCategoryFilter('all');
            setSyncFilter('all');
            setSearch('');
          }}
          className={cn(
            'text-left rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-md hover:border-primary/60 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/40',
            activeCenterTab === 'triage' && statusFilter === 'active' && priorityFilter === 'all'
              ? 'border-primary ring-1 ring-primary bg-primary/10 shadow-sm'
              : 'border-border bg-card'
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold font-mono uppercase">Active SOS</span>
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-foreground leading-none">
              {metrics.activeRequestsCount}
            </span>
            <span className="text-[10px] text-primary/80 font-mono font-semibold block mt-0.5 truncate">
              Filter feed →
            </span>
          </div>
        </button>

        {/* Metric 2: Critical & High Priority Cases -> Links to Critical Filter */}
        <button
          type="button"
          onClick={() => {
            setActiveCenterTab('triage');
            setPriorityFilter('critical');
            setStatusFilter('active');
            setSearch('');
          }}
          className={cn(
            'text-left rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-md hover:border-alert active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-alert/40',
            activeCenterTab === 'triage' && priorityFilter === 'critical'
              ? 'border-alert ring-1 ring-alert bg-alert/20 shadow-sm'
              : 'border-alert/40 bg-alert/10'
          )}
        >
          <div className="flex items-center justify-between text-alert mb-1">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider">Critical / High</span>
            <ShieldAlert className="h-3.5 w-3.5 text-alert" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-alert leading-none">
              {metrics.highPriorityCases}
            </span>
            <span className="text-[10px] text-alert/90 font-bold block mt-0.5 truncate">
              {metrics.criticalCount} crit · {metrics.urgentCount} urg →
            </span>
          </div>
        </button>

        {/* Metric 3: Available Volunteers -> Links to Volunteer Tasks */}
        <button
          type="button"
          onClick={() => {
            setActiveCenterTab('tasks');
          }}
          className={cn(
            'text-left rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-md hover:border-success/60 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-success/40',
            activeCenterTab === 'tasks'
              ? 'border-success ring-1 ring-success bg-success/15 shadow-sm'
              : 'border-success/30 bg-success/5'
          )}
        >
          <div className="flex items-center justify-between text-success mb-1">
            <span className="text-[10px] font-bold font-mono uppercase">Volunteers</span>
            <Users className="h-3.5 w-3.5 text-success" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-success leading-none">
              {metrics.availableVolunteers} / {metrics.totalVolunteers}
            </span>
            <span className="text-[10px] text-success/80 font-mono block mt-0.5 truncate">
              View roster →
            </span>
          </div>
        </button>

        {/* Metric 4: Open Volunteer Tasks -> Links to Tasks Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveCenterTab('tasks');
          }}
          className={cn(
            'text-left rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-md hover:border-info/60 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-info/40',
            activeCenterTab === 'tasks'
              ? 'border-info ring-1 ring-info bg-info/15 shadow-sm'
              : 'border-info/30 bg-info/5'
          )}
        >
          <div className="flex items-center justify-between text-info mb-1">
            <span className="text-[10px] font-bold font-mono uppercase">Open Tasks</span>
            <LifeBuoy className="h-3.5 w-3.5 text-info" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-info leading-none">
              {metrics.openTasksCount}
            </span>
            <span className="text-[10px] text-info/80 font-mono block mt-0.5 truncate">
              Dispatch units →
            </span>
          </div>
        </button>

        {/* Metric 5: Available Shelter Beds -> Links to Shelters Tab (Available Beds filter) */}
        <button
          type="button"
          onClick={() => {
            setActiveCenterTab('shelters');
            setShelterFilter('available');
          }}
          className={cn(
            'text-left rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-md hover:border-info active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-info/40',
            activeCenterTab === 'shelters' && shelterFilter === 'available'
              ? 'border-info ring-1 ring-info bg-info/10 shadow-sm'
              : 'border-border bg-card'
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold font-mono uppercase">Free Beds</span>
            <BedDouble className="h-3.5 w-3.5 text-info" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-success leading-none">
              {metrics.availableBeds}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              of {metrics.totalBedCap} total beds →
            </span>
          </div>
        </button>

        {/* Metric 6: Unfulfilled Resource Needs -> Links to Shortages Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveCenterTab('shortages');
          }}
          className={cn(
            'text-left rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-md hover:border-warning active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-warning/40',
            activeCenterTab === 'shortages'
              ? 'border-warning ring-1 ring-warning bg-warning/20 shadow-sm'
              : metrics.unfulfilledResourceNeeds > 0
              ? 'border-warning/40 bg-warning/10'
              : 'border-border bg-card'
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold font-mono uppercase text-warning">Bottlenecks</span>
            <Package className="h-3.5 w-3.5 text-warning" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-warning leading-none">
              {metrics.unfulfilledResourceNeeds}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              {metrics.requestsNeedingItems} reqs + {metrics.shelterShortagesCount} shrt →
            </span>
          </div>
        </button>

        {/* Metric 7: Pending Synchronization Count -> Opens Telemetry & Filters to Unsynced */}
        <button
          type="button"
          onClick={() => {
            if (onOpenSyncModal) onOpenSyncModal();
            setActiveCenterTab('triage');
            setSyncFilter('pending');
          }}
          className={cn(
            'text-left rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-md hover:border-primary active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/40',
            syncFilter === 'pending'
              ? 'border-primary ring-1 ring-primary bg-primary/10 shadow-sm'
              : 'border-border bg-card'
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold font-mono uppercase">Pending Sync</span>
            <RefreshCw className={cn('h-3.5 w-3.5', pendingSyncCount > 0 ? 'text-warning' : 'text-success')} />
          </div>
          <div>
            <span
              className={cn(
                'text-xl sm:text-2xl font-extrabold font-mono leading-none',
                pendingSyncCount > 0 ? 'text-warning' : 'text-success'
              )}
            >
              {pendingSyncCount}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              {pendingSyncCount > 0 ? 'Review outbox →' : 'Ledger synced →'}
            </span>
          </div>
        </button>

        {/* Metric 8: Incident Activity Log Count -> Links to Activity Timeline */}
        <button
          type="button"
          onClick={() => {
            setActiveCenterTab('activity');
          }}
          className={cn(
            'text-left rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-md hover:border-foreground active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-foreground/40',
            activeCenterTab === 'activity'
              ? 'border-foreground ring-1 ring-foreground bg-secondary shadow-sm'
              : 'border-border bg-card'
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[10px] font-bold font-mono uppercase">Activity Log</span>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-foreground leading-none">
              {activityEvents.length}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
              {metrics.liveEventsCount} live · {metrics.demoEventsCount} demo →
            </span>
          </div>
        </button>
      </div>

      {/* ── Main Operations Split: Left Command Data Matrix (7 cols) + Right Synchronized Interactive Map (5 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Unified Data Matrix */}
        <div className="lg:col-span-7 space-y-4">
          {/* Module Tabs Header */}
          <div className="flex items-center justify-between border-b border-border pb-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveCenterTab('triage')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5',
                  activeCenterTab === 'triage'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Activity className="h-3.5 w-3.5" />
                Emergency Feed ({filteredRequests.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveCenterTab('shelters')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5',
                  activeCenterTab === 'shelters'
                    ? 'bg-info text-white shadow-sm'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Shelters ({filteredShelters.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveCenterTab('tasks')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5',
                  activeCenterTab === 'tasks'
                    ? 'bg-warning text-black shadow-sm font-extrabold'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                Volunteer Tasks ({metrics.openTasksCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveCenterTab('shortages')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5',
                  activeCenterTab === 'shortages'
                    ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Package className="h-3.5 w-3.5" />
                Bottlenecks ({metrics.unfulfilledResourceNeeds})
              </button>

              <button
                type="button"
                onClick={() => setActiveCenterTab('activity')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5',
                  activeCenterTab === 'activity'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Activity Timeline ({activityEvents.length})
              </button>
            </div>
          </div>

          {/* TAB 1: EMERGENCY FEED & TRIAGE QUEUE */}
          {activeCenterTab === 'triage' && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              {/* Filter controls bar */}
              <div className="space-y-2 pb-2 border-b border-border/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Priority / Severity Filters */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1">Severity:</span>
                    {(['all', 'critical', 'urgent', 'moderate'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriorityFilter(p)}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-bold transition-all',
                          priorityFilter === p
                            ? p === 'critical'
                              ? 'bg-alert text-white font-black'
                              : p === 'urgent'
                              ? 'bg-warning text-black font-black'
                              : 'bg-primary text-primary-foreground'
                            : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Sync State Filter */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1">Sync:</span>
                    {(['all', 'pending', 'synced'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSyncFilter(s)}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-mono capitalize transition-all',
                          syncFilter === s
                            ? 'bg-primary/20 text-primary border border-primary/40 font-bold'
                            : 'bg-secondary/30 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Category Filters */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1">Category:</span>
                    {(['all', 'medical', 'rescue', 'food', 'shelter', 'volunteers'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] capitalize transition-all',
                          categoryFilter === cat
                            ? 'bg-primary/20 text-primary border border-primary/40 font-bold'
                            : 'bg-secondary/30 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Sort Controls */}
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase text-muted-foreground">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-background border border-border rounded-lg px-2 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="urgency">Urgency (Critical First)</option>
                      <option value="newest">Newest First</option>
                      <option value="oldest">Longest Waiting (Oldest)</option>
                      <option value="distance">Distance (Closest First)</option>
                      <option value="people">People Count (Highest)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by description, requested supplies, location or contact..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Information-Dense Sortable Incident Stream */}
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {filteredRequests.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground font-mono text-xs">
                    No emergency requests match current filters.
                  </div>
                ) : (
                  filteredRequests.map((req) => {
                    const isSelected = activeSelectedId === req.id;
                    const isCritical = req.priority === 'critical';
                    const isUrgent = req.priority === 'urgent';
                    const isLiveRecord = Boolean(req.isUserCreated);
                    const age = formatRelativeAge(req.createdAt);
                    const hasValidGps = req.coords && !(req.coords.x === 0 && req.coords.y === 0);
                    const isResolved = req.status === 'resolved';

                    return (
                      <div
                        key={req.id}
                        onClick={() => handleItemSelect(req.id)}
                        className={cn(
                          'p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5',
                          isSelected
                            ? 'border-primary ring-2 ring-primary/60 bg-primary/5'
                            : isCritical
                            ? 'border-alert/70 bg-alert/5 hover:bg-alert/10 shadow-sm'
                            : isUrgent
                            ? 'border-warning/60 bg-warning/5 hover:bg-warning/10'
                            : 'border-border bg-background/70 hover:bg-secondary/40'
                        )}
                      >
                        {/* Header Line */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Urgent Label (no flashing, high contrast) */}
                            <span
                              className={cn(
                                'text-[9px] font-mono uppercase font-black px-2 py-0.5 rounded-md border',
                                isCritical
                                  ? 'bg-alert text-white border-alert'
                                  : isUrgent
                                  ? 'bg-warning text-black border-warning'
                                  : 'bg-secondary text-muted-foreground border-border'
                              )}
                            >
                              {req.priority}
                            </span>

                            <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">
                              {req.category}
                            </span>

                            {/* Status Pill */}
                            <span
                              className={cn(
                                'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                                isResolved
                                  ? 'bg-success/15 text-success border-success/30 font-bold'
                                  : req.status === 'in-progress'
                                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 font-bold'
                                  : 'bg-secondary text-muted-foreground border-border'
                              )}
                            >
                              {isResolved ? 'RESOLVED' : req.status === 'in-progress' ? 'IN PROGRESS' : 'UNASSIGNED'}
                            </span>

                            {/* Distinguish confirmed current information from simulated data */}
                            {isLiveRecord ? (
                              <span className="text-[9px] font-mono bg-success/15 text-success border border-success/30 px-1.5 py-0.5 rounded font-bold">
                                CONFIRMED LIVE
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono bg-secondary text-muted-foreground/80 px-1.5 py-0.5 rounded">
                                SIMULATED DEMO
                              </span>
                            )}

                            {/* Current synchronization state */}
                            {req.syncStatus === 'pending' || (req.isUserCreated && pendingSyncCount > 0) ? (
                              <span className="text-[9px] font-mono bg-warning/15 text-warning border border-warning/30 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                                <WifiOff className="h-2.5 w-2.5" /> Pending Outbox
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono bg-success/10 text-success/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Wifi className="h-2.5 w-2.5" /> Synced
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] font-mono text-muted-foreground shrink-0 text-right" title={`Logged at ${age.exact}`}>
                            <span className="font-bold text-foreground">{age.relative}</span>
                            <span className="block text-[9px] text-muted-foreground">{age.exact}</span>
                          </div>
                        </div>

                        {/* Title & Details */}
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                            {req.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
                            {req.details}
                          </p>
                        </div>

                        {/* Location context: GPS status vs manual description */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground bg-secondary/30 p-1.5 rounded-lg border border-border/40">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary shrink-0" />
                            <strong>{req.distanceMiles} mi away</strong>
                          </span>

                          {hasValidGps ? (
                            <span className="text-success font-semibold flex items-center gap-1">
                              <span>📍 GPS Verified</span>
                              <span className="text-[9px] text-muted-foreground">(±{req.locationAccuracy ?? 15}m)</span>
                            </span>
                          ) : (
                            <span className="text-warning font-semibold flex items-center gap-1">
                              <span>⚠️ Manual Location (No GPS)</span>
                            </span>
                          )}

                          {req.locationDescription && (
                            <span className="truncate max-w-[280px] text-foreground">
                              · {req.locationDescription}
                            </span>
                          )}
                        </div>

                        {/* Resource requirements & items needed */}
                        {req.items && req.items.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                            <span className="text-muted-foreground font-semibold">Needed:</span>
                            {req.items.map((it, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/25 font-bold">
                                {it}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Coordinator Action Buttons Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                            <span>People: <strong>{req.peopleCount || 1}</strong></span>
                            {req.contactPhone && (
                              <a
                                href={`tel:${req.contactPhone.replace(/[\s\-().]/g, '')}`}
                                className="text-primary hover:underline flex items-center gap-0.5"
                                title="Call requester directly"
                              >
                                <Phone className="h-2.5 w-2.5" />
                                <span>{req.contactPhone}</span>
                              </a>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Acknowledge Button */}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleAcknowledge(e, req)}
                              className="h-6 px-2 text-[10px] font-mono text-info hover:bg-info/10"
                              title="Acknowledge and prioritize incident"
                            >
                              <FileCheck className="h-3 w-3 mr-1" />
                              Acknowledge
                            </Button>

                            {/* Quick Dispatch Task */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleQuickAssign(e, req)}
                              className="h-6 px-2 text-[10px] font-mono border-primary/40 text-primary hover:bg-primary/10"
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Dispatch
                            </Button>

                            {/* Allocate Resource */}
                            {req.items && req.items.length > 0 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleQuickAllocateResource(e, req)}
                                className="h-6 px-2 text-[10px] font-mono border-warning/40 text-warning hover:bg-warning/10"
                              >
                                <Package className="h-3 w-3 mr-1" />
                                Allocate
                              </Button>
                            )}

                            {/* Quick Resolve Button */}
                            {!isResolved && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleQuickResolve(e, req)}
                                className="h-6 px-2 text-[10px] font-mono text-success hover:bg-success/10"
                                title="Mark operation resolved"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Resolve
                              </Button>
                            )}

                            {/* Inspect Details */}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (onOpenDetailsModal) onOpenDetailsModal(req.id);
                                else handleItemSelect(req.id);
                              }}
                              className="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                            >
                              Inspect Details →
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SHELTERS & FACILITY BED MATRIX */}
          {activeCenterTab === 'shelters' && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                <div>
                  <h3 className="text-xs font-mono uppercase font-bold text-foreground">
                    Regional Facility Bed Status & Inventories
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Selecting a shelter centers its marker on the map and displays inventory metrics.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {(['all', 'available', 'full'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setShelterFilter(filter)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-all',
                        shelterFilter === filter
                          ? 'bg-info text-white font-bold'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onOpenShelters}
                    className="h-7 text-xs font-mono ml-1"
                  >
                    Directory →
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {filteredShelters.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center font-mono">
                    No facilities match current shelter filter.
                  </p>
                ) : (
                  filteredShelters.map((sh) => {
                    const cap = sh.totalCapacity ?? sh.capacity ?? 0;
                    const occ = sh.occupiedBeds ?? sh.occupied ?? 0;
                    const rsv = sh.reservedBeds ?? 0;
                    const available = calculateAvailableBeds(sh);
                    const isSelected = activeSelectedId === sh.id;
                    const opStatus = sh.operatingStatus ?? sh.status ?? 'open';
                    const isFull = opStatus === 'full' || available === 0;

                    return (
                      <div
                        key={sh.id}
                        onClick={() => handleItemSelect(sh.id)}
                        className={cn(
                          'p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                          isSelected
                            ? 'border-info ring-1 ring-info bg-info/5'
                            : 'border-border bg-background/70 hover:bg-secondary/40'
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs text-foreground">{sh.name}</h4>
                            <span
                              className={cn(
                                'text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold',
                                isFull
                                  ? 'bg-alert/15 text-alert border border-alert/30'
                                  : 'bg-success/15 text-success border border-success/30'
                              )}
                            >
                              {opStatus}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{sh.address}</span>
                          </p>
                          {sh.resourceShortages && sh.resourceShortages.length > 0 && (
                            <div className="flex items-center gap-1 text-[9px] font-mono text-warning">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              <span>Shortages: {sh.resourceShortages.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
                          <div className="text-right">
                            <span className={cn('text-sm font-extrabold', available === 0 ? 'text-alert' : 'text-success')}>
                              {available} free
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              {occ} occ · {rsv} rsv of {cap}
                            </span>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenShelterOperatorModal) onOpenShelterOperatorModal(sh.id);
                              else onOpenShelters();
                            }}
                            className="h-7 text-[10px] font-mono border-border"
                          >
                            Manage
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OPEN VOLUNTEER TASKS & DISPATCH ROSTER */}
          {activeCenterTab === 'tasks' && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-xs font-mono uppercase font-bold text-foreground">
                  Rescue & Logistics Missions
                </h3>
                <span className="text-xs font-mono text-success font-semibold">
                  {metrics.availableVolunteers} Responders ready for dispatch
                </span>
              </div>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {requests
                  .filter((r) => r.category === 'rescue' || r.category === 'volunteers' || r.status === 'in-progress')
                  .map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleItemSelect(task.id)}
                      className={cn(
                        'p-3 rounded-xl border transition-all cursor-pointer space-y-2',
                        activeSelectedId === task.id
                          ? 'border-warning ring-1 ring-warning bg-warning/5'
                          : 'border-border bg-background/70 hover:bg-secondary/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase font-bold bg-warning/20 text-warning px-2 py-0.5 rounded">
                          {task.category}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Priority: {task.priority.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground">{task.title}</h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{task.details}</p>

                      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] font-mono">
                        <span className="text-muted-foreground">Contact: {task.contactName || 'Relay Operator'}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleQuickAssign(e, task)}
                          className="h-6 text-[10px] font-mono border-warning/40 text-warning hover:bg-warning/10"
                        >
                          Assign Volunteer
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 4: RESOURCE BOTTLENECKS & SHORTAGES */}
          {activeCenterTab === 'shortages' && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-xs font-mono uppercase font-bold text-foreground">
                    Unfulfilled Resource Needs & Deficit Matrix
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Cross-references emergency supplies needed against available community offers and depot inventory.
                  </p>
                </div>
                <Badge variant="outline" className="border-warning/40 text-warning font-mono text-xs">
                  {metrics.unfulfilledResourceNeeds} Critical Deficits
                </Badge>
              </div>

              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {/* 1. Requests Needing Supplies */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-mono font-bold uppercase text-muted-foreground">
                    Citizen & Field Aid Requests Needing Supplies
                  </h4>
                  {requests
                    .filter((r) => r.items && r.items.length > 0 && r.status !== 'resolved' && r.status !== 'cancelled')
                    .map((req) => (
                      <div
                        key={req.id}
                        onClick={() => handleItemSelect(req.id)}
                        className="p-3 rounded-xl border border-border bg-background/70 space-y-2 hover:bg-secondary/40 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground">{req.title}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{req.distanceMiles} mi away</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {req.items.map((it, idx) => (
                            <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 font-bold">
                              {it}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-mono">
                          <span className="text-muted-foreground">Affects: {req.peopleCount || 1} individuals</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleQuickAllocateResource(e, req)}
                            className="h-6 text-[10px] font-mono border-warning/40 text-warning"
                          >
                            Allocate Stock
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>

                {/* 2. Shelter Inventory Shortages */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-[11px] font-mono font-bold uppercase text-muted-foreground">
                    Shelter Facility Shortages
                  </h4>
                  {shelters
                    .filter((s) => s.resourceShortages && s.resourceShortages.length > 0)
                    .map((sh) => (
                      <div
                        key={sh.id}
                        onClick={() => handleItemSelect(sh.id)}
                        className="p-3 rounded-xl border border-alert/30 bg-alert/5 space-y-2 hover:bg-alert/10 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground">{sh.name}</span>
                          <span className="text-[10px] font-mono text-alert font-bold">CRITICAL SHORTAGE</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {sh.resourceShortages!.map((shortage, idx) => (
                            <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-alert/20 text-alert border border-alert/30 font-bold">
                              {shortage}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-mono">
                          <span className="text-muted-foreground">{sh.address}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenShelterOperatorModal) onOpenShelterOperatorModal(sh.id);
                            }}
                            className="h-6 text-[10px] font-mono border-alert/40 text-alert"
                          >
                            Schedule Supply Inbound
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RECENT INCIDENT ACTIVITY TIMELINE */}
          {activeCenterTab === 'activity' && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                <div>
                  <h3 className="text-xs font-mono uppercase font-bold text-foreground">
                    Multi-Device Operations Activity Trail
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Synchronized audit log distinguishing actual recorded field events from simulated demo activity.
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {(['all', 'live', 'demo'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActivityFilter(filter)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-all',
                        activityFilter === filter
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {activityEvents
                  .filter((act) => {
                    if (activityFilter === 'live') return act.isLive;
                    if (activityFilter === 'demo') return !act.isLive;
                    return true;
                  })
                  .map((act) => (
                    <div
                      key={act.id}
                      onClick={() => {
                        if (act.targetId) handleItemSelect(act.targetId);
                      }}
                      className={cn(
                        'p-3 rounded-xl border bg-background/70 space-y-1 transition-all cursor-pointer hover:bg-secondary/40',
                        act.targetId && activeSelectedId === act.targetId
                          ? 'border-primary ring-1 ring-primary'
                          : 'border-border'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="font-bold uppercase text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                          {act.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {act.isLive ? (
                            <span className="bg-success/15 text-success border border-success/30 px-1 rounded text-[9px] font-bold">
                              CONFIRMED LIVE
                            </span>
                          ) : (
                            <span className="bg-secondary text-muted-foreground px-1 rounded text-[9px]">
                              SIMULATED DEMO
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {act.description}
                      </p>

                      <div className="text-[9px] font-mono text-muted-foreground flex items-center justify-between pt-0.5">
                        <span>Actor: {act.actorName} ({act.actorRole})</span>
                        {act.targetId && (
                          <span className="text-primary hover:underline">
                            Focus target: {act.targetId} →
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Unified Interactive Map, Controls & Selected-Item Detail Panel */}
        <div className="lg:col-span-5 space-y-4 flex flex-col">
          {/* Synchronized Map Card */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 flex flex-col flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-mono uppercase font-bold text-foreground">
                  Synchronized Leaflet Operations Map
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onNavigateToMap}
                  className="h-6 px-1.5 text-[10px] font-mono text-primary hover:bg-primary/10"
                >
                  Expand ↗
                </Button>
              </div>
            </div>

            {/* Embedded Interactive Map with Fallback Roster Toggle */}
            <div className="relative rounded-xl overflow-hidden border border-border flex-1 min-h-[420px] lg:min-h-[500px]">
              <MapView
                requests={filteredRequests}
                shelters={filteredShelters}
                volunteers={volunteers}
                resources={resources}
                resourceOffers={resourceOffers}
                isOnline={isOnline}
                region={region}
                selectedId={activeSelectedId}
                onSelect={handleItemSelect}
                showFallbackToggle={true}
                theme="dark"
              />
            </div>

            {/* Accessible Legend Strip */}
            <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-alert" /> Critical SOS
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-info" /> Shelters
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success" /> Volunteers (Consenting)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-warning" /> Depots / Supplies
                </span>
              </div>
              <span>Click pin to inspect</span>
            </div>
          </div>

          {/* ── SELECTED-ITEM DETAIL PANEL ── */}
          {selectedEntity && (
            <div className="rounded-2xl border border-primary/50 bg-card p-4 space-y-3 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-border">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      {selectedEntity.type.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ID: {selectedEntity.data.id}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground mt-1">
                    {'title' in selectedEntity.data
                      ? selectedEntity.data.title
                      : 'name' in selectedEntity.data
                      ? selectedEntity.data.name
                      : (selectedEntity.data as ResourceOffer).resourceType.replace(/_/g, ' ').toUpperCase()}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={handleDeselect}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  title="Close inspection panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Entity-specific inspection details */}
              {selectedEntity.type === 'request' && (
                <div className="space-y-2 text-xs font-mono">
                  <p className="text-muted-foreground font-sans leading-relaxed">
                    {selectedEntity.data.details}
                  </p>
                  <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-secondary/30 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">SEVERITY</span>
                      <span className="font-bold uppercase text-alert">{selectedEntity.data.priority}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">PEOPLE COUNT</span>
                      <span className="font-bold text-foreground">{selectedEntity.data.peopleCount || 1} people</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">DISTANCE</span>
                      <span className="font-bold text-foreground">{selectedEntity.data.distanceMiles} mi away</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">COORDINATES</span>
                      <span className="font-bold text-foreground">
                        {selectedEntity.data.coords && !(selectedEntity.data.coords.x === 0 && selectedEntity.data.coords.y === 0)
                          ? '📍 GPS Verified'
                          : '⚠️ No GPS (Manual only)'}
                      </span>
                    </div>
                  </div>

                  {selectedEntity.data.items && selectedEntity.data.items.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Requested Supplies:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedEntity.data.items.map((it, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 text-[10px]">
                            {it}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                    {selectedEntity.data.contactPhone && (
                      <a
                        href={`tel:${selectedEntity.data.contactPhone.replace(/[\s\-().]/g, '')}`}
                        className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <Phone className="h-3 w-3" />
                        <span>{selectedEntity.data.contactPhone} ({selectedEntity.data.contactName || 'Requester'})</span>
                      </a>
                    )}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleQuickAssign(e, selectedEntity.data)}
                        className="h-7 text-xs font-mono"
                      >
                        Dispatch Responder
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => handleQuickResolve(e, selectedEntity.data)}
                        className="h-7 text-xs font-mono bg-success text-white hover:bg-success/90"
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {selectedEntity.type === 'shelter' && (
                <div className="space-y-2 text-xs font-mono">
                  <p className="text-muted-foreground">{selectedEntity.data.address}</p>
                  <div className="p-2.5 rounded-xl bg-secondary/30 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Available Beds:</span>
                      <span className="font-bold text-success">{calculateAvailableBeds(selectedEntity.data)} free</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Occupied / Reserved:</span>
                      <span>
                        {selectedEntity.data.occupiedBeds ?? selectedEntity.data.occupied ?? 0} occ · {selectedEntity.data.reservedBeds ?? 0} rsv
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Total Facility Capacity:</span>
                      <span>{selectedEntity.data.totalCapacity ?? selectedEntity.data.capacity} beds</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (onOpenShelterOperatorModal) onOpenShelterOperatorModal(selectedEntity.data.id);
                        else onOpenShelters();
                      }}
                      className="h-7 text-xs font-mono"
                    >
                      Manage Capacity & Intake →
                    </Button>
                  </div>
                </div>
              )}

              {selectedEntity.type === 'volunteer' && (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={cn('font-bold', selectedEntity.data.available ? 'text-success' : 'text-muted-foreground')}>
                      {selectedEntity.data.available ? 'AVAILABLE FOR DISPATCH' : 'BUSY / ON MISSION'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Verified Distance:</span>
                    <span className="font-bold text-foreground">{selectedEntity.data.distanceMiles} mi away</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">SKILLS & CERTIFICATIONS</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedEntity.data.skills.map((sk, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px]">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedEntity.type === 'resource' && (
                <div className="space-y-2 text-xs font-mono">
                  <p className="text-muted-foreground">{selectedEntity.data.address}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Facility Type:</span>
                    <span className="font-bold uppercase text-foreground">{selectedEntity.data.type}</span>
                  </div>
                  {selectedEntity.data.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Direct Line:</span>
                      <a href={`tel:${selectedEntity.data.phone}`} className="text-primary hover:underline">
                        {selectedEntity.data.phone}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {selectedEntity.type === 'offer' && (
                <div className="space-y-2 text-xs font-mono">
                  <p className="text-muted-foreground">{selectedEntity.data.location}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Resource Type:</span>
                    <span className="font-bold uppercase text-warning">
                      {selectedEntity.data.resourceType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Available Quantity:</span>
                    <span className="font-bold text-foreground">
                      {selectedEntity.data.quantityAvailable - (selectedEntity.data.quantityAllocated || 0)} {selectedEntity.data.unit}
                    </span>
                  </div>
                  {selectedEntity.data.providerPhone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Provider Phone:</span>
                      <a href={`tel:${selectedEntity.data.providerPhone}`} className="text-primary hover:underline">
                        {selectedEntity.data.providerPhone}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
