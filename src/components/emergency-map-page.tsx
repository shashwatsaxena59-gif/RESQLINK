import React, { useState, useMemo, useCallback } from 'react';
import {
  Search, X, Navigation, Crosshair, MapPin, ShieldCheck,
  TriangleAlert, HeartPulse, Droplets, BedDouble, Users,
  LifeBuoy, Layers, Wifi, WifiOff, Hospital, Tent,
  Locate, ChevronRight, ChevronLeft, RotateCcw,
  SlidersHorizontal, Check, Eye, EyeOff, ListFilter,
  Phone, Clock, Compass, Car, Footprints, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CATEGORY_META } from '@/types';
import type { AidRequest, Shelter, Volunteer, Resource, RequestCategory } from '@/types';
import { MapView, type MapRegion } from '@/components/map-view';
import type { NavDestination } from '@/hooks/use-navigation';
import {
  haversineDistanceKm,
  haversineDistanceMiles,
  calculateBearing,
  formatDistance,
  checkLocationAccuracy,
  isValidLatLng,
  fetchRoute,
  type DistanceUnit,
  type RouteResult,
} from '@/lib/geo';

interface EmergencyMapPageProps {
  requests: AidRequest[];
  shelters: Shelter[];
  volunteers: Volunteer[];
  resources: Resource[];
  isOnline: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  region: MapRegion;
  onRegionChange: (region: MapRegion) => void;
  theme?: 'dark' | 'light';
  userRole?: string;
  navDestination?: NavDestination | null;
  onClearNavDestination?: () => void;
  onNavigate?: (dest: NavDestination) => void;
  onOpenDetailsModal?: (id: string) => void;
  onHelpRequest?: (id: string) => void;
  onResolveRequest?: (id: string) => void;
  onRestoreRequests?: () => void;
}

export function EmergencyMapPage({
  requests,
  shelters,
  volunteers,
  resources,
  isOnline,
  selectedId,
  onSelect,
  region,
  onRegionChange,
  theme = 'dark',
  userRole = 'citizen',
  navDestination = null,
  onClearNavDestination,
  onNavigate,
  onOpenDetailsModal,
  onHelpRequest,
  onResolveRequest,
  onRestoreRequests,
}: EmergencyMapPageProps) {
  // ── Layout & View State ──────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(true);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('mi');
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'shelters' | 'volunteers' | 'resources'>('all');

  // ── Filter State ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'urgent' | 'moderate'>('all');
  const [radiusMiles, setRadiusMiles] = useState<number>(0); // 0 = all distances, default radius 2 miles when activated
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'in-progress'>('all');
  const [shelterBedsOnly, setShelterBedsOnly] = useState(false);
  const [volunteersAvailableOnly, setVolunteersAvailableOnly] = useState(false);

  // ── Geolocation State ────────────────────────────────────────────────────
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'located' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // ── Routing / Directions State ───────────────────────────────────────────
  const [activeNavDest, setActiveNavDest] = useState<NavDestination | null>(null);
  const [routingMode, setRoutingMode] = useState<'driving' | 'walking'>('driving');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  // ── Geolocation Handler ("Use My Location") ──────────────────────────────
  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('Browser does not support geolocation.');
      return;
    }

    setGpsStatus('requesting');
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserCoords([latitude, longitude]);
        setGpsAccuracy(accuracy);
        setGpsStatus('located');
        // Default to 2-mile radius filter when user location becomes available
        if (radiusMiles === 0) {
          setRadiusMiles(2);
        }
      },
      (err) => {
        setGpsStatus('error');
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError('Location permission was denied. You can search or select a landmark.');
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsError('GPS signal unavailable. Check your connection or search manually.');
            break;
          case err.TIMEOUT:
            setGpsError('GPS request timed out. Please retry.');
            break;
          default:
            setGpsError('Unable to acquire location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  }, [radiusMiles]);

  // ── Routing Action Handler ───────────────────────────────────────────────
  const handleStartNavigation = useCallback(async (dest: NavDestination) => {
    setActiveNavDest(dest);
    if (!userCoords) {
      // If user coords not available, prompt GPS
      handleUseMyLocation();
      return;
    }

    setIsRoutingLoading(true);
    const result = await fetchRoute(userCoords, dest.coords, routingMode, dest.address);
    setRouteResult(result);
    setIsRoutingLoading(false);

    if (onNavigate) {
      onNavigate(dest);
    }
  }, [userCoords, routingMode, handleUseMyLocation, onNavigate]);

  // ── Synchronize with incoming navDestination prop (e.g. from Volunteer Portal) ──
  React.useEffect(() => {
    if (navDestination) {
      setActiveNavDest(navDestination);
      setViewMode('map');
      if (userCoords) {
        setIsRoutingLoading(true);
        fetchRoute(userCoords, navDestination.coords, routingMode, navDestination.address)
          .then((result) => setRouteResult(result))
          .catch(() => {})
          .finally(() => setIsRoutingLoading(false));
      } else {
        handleUseMyLocation();
      }
    }
  }, [navDestination, userCoords, routingMode, handleUseMyLocation]);

  // ── Recalculate route when mode changes ──────────────────────────────────
  const handleToggleRoutingMode = useCallback(async (mode: 'driving' | 'walking') => {
    setRoutingMode(mode);
    if (activeNavDest && userCoords) {
      setIsRoutingLoading(true);
      const result = await fetchRoute(userCoords, activeNavDest.coords, mode, activeNavDest.address);
      setRouteResult(result);
      setIsRoutingLoading(false);
    }
  }, [activeNavDest, userCoords]);

  // ── Coordinates Helper for Unified Entities ──────────────────────────────
  const getEntityLatLng = useCallback((item: { coords?: { x: number; y: number } }): [number, number] | null => {
    if (!item.coords) return null;
    const { x, y } = item.coords;
    if (x === 0 && y === 0) return null;
    // Real world coordinates
    if (y >= 20 && y <= 40 && x >= 65 && x <= 95) {
      return [y, x];
    }
    // Projected offset from region center
    const center = region === 'ncr' ? [28.55, 77.25] : [30.556, 79.564];
    return [center[0] + (y - 50) * 0.0018, center[1] + (x - 50) * 0.0018];
  }, [region]);

  // ── Filtered Requests ────────────────────────────────────────────────────
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          r.title.toLowerCase().includes(q) ||
          r.details.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.items.some((i) => i.toLowerCase().includes(q));
        if (!matches) return false;
      }
      // Category
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      // Severity
      if (severityFilter !== 'all' && r.priority !== severityFilter) return false;
      // Status
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      // Distance Radius
      if (radiusMiles > 0 && userCoords) {
        const coords = getEntityLatLng(r);
        if (!coords) return false; // Exclude from proximity filter if missing coordinates
        const distMi = haversineDistanceMiles(userCoords[0], userCoords[1], coords[0], coords[1]);
        if (Number.isNaN(distMi) || distMi > radiusMiles) return false;
      }

      return true;
    });
  }, [requests, searchQuery, categoryFilter, severityFilter, statusFilter, radiusMiles, userCoords, getEntityLatLng]);

  // ── Filtered Shelters ────────────────────────────────────────────────────
  const filteredShelters = useMemo(() => {
    return shelters.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.amenities.some((a) => a.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (shelterBedsOnly && s.capacity - s.occupied <= 0) return false;

      if (radiusMiles > 0 && userCoords) {
        const coords = getEntityLatLng(s);
        if (!coords) return false;
        const distMi = haversineDistanceMiles(userCoords[0], userCoords[1], coords[0], coords[1]);
        if (Number.isNaN(distMi) || distMi > radiusMiles) return false;
      }

      return true;
    });
  }, [shelters, searchQuery, shelterBedsOnly, radiusMiles, userCoords, getEntityLatLng]);

  // ── Filtered Volunteers ──────────────────────────────────────────────────
  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          v.name.toLowerCase().includes(q) ||
          v.skills.some((s) => s.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (volunteersAvailableOnly && !v.available) return false;

      if (radiusMiles > 0 && userCoords) {
        const coords = getEntityLatLng(v);
        if (!coords) return false;
        const distMi = haversineDistanceMiles(userCoords[0], userCoords[1], coords[0], coords[1]);
        if (Number.isNaN(distMi) || distMi > radiusMiles) return false;
      }

      return true;
    });
  }, [volunteers, searchQuery, volunteersAvailableOnly, radiusMiles, userCoords, getEntityLatLng]);

  // ── Filtered Resources ───────────────────────────────────────────────────
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          res.name.toLowerCase().includes(q) ||
          res.address.toLowerCase().includes(q) ||
          res.type.toLowerCase().includes(q) ||
          res.tags.some((t) => t.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'medical' && res.type !== 'hospital' && res.type !== 'pharmacy') return false;
        if (categoryFilter === 'food' && res.type !== 'food') return false;
        if (categoryFilter === 'shelter' && res.type !== 'shelter') return false;
        if (categoryFilter === 'rescue' && res.type !== 'rescue') return false;
      }

      if (radiusMiles > 0 && userCoords) {
        const coords = getEntityLatLng(res);
        if (!coords) return false;
        const distMi = haversineDistanceMiles(userCoords[0], userCoords[1], coords[0], coords[1]);
        if (Number.isNaN(distMi) || distMi > radiusMiles) return false;
      }

      return true;
    });
  }, [resources, searchQuery, categoryFilter, radiusMiles, userCoords, getEntityLatLng]);

  // ── Currently Selected Item ──────────────────────────────────────────────
  const selectedEntity = useMemo(() => {
    if (!selectedId) return null;
    const req = requests.find((r) => r.id === selectedId);
    if (req) return { type: 'request' as const, data: req };
    const shelt = shelters.find((s) => s.id === selectedId);
    if (shelt) return { type: 'shelter' as const, data: shelt };
    const vol = volunteers.find((v) => v.id === selectedId);
    if (vol) return { type: 'volunteer' as const, data: vol };
    const res = resources.find((r) => r.id === selectedId);
    if (res) return { type: 'resource' as const, data: res };
    return null;
  }, [selectedId, requests, shelters, volunteers, resources]);

  // Distance computation from user to selected entity
  const selectedDistance = useMemo(() => {
    if (!selectedEntity || !userCoords) return null;
    const coords = getEntityLatLng(selectedEntity.data);
    if (!coords) return null;
    const distKm = haversineDistanceKm(userCoords[0], userCoords[1], coords[0], coords[1]);
    const bearing = calculateBearing(userCoords[0], userCoords[1], coords[0], coords[1]);
    const { isApproximate } = checkLocationAccuracy(gpsAccuracy);
    return {
      distKm,
      distMiles: distKm * 0.621371,
      formatted: formatDistance(distKm, distanceUnit, isApproximate),
      bearing: bearing.compass,
      degrees: bearing.degrees,
    };
  }, [selectedEntity, userCoords, gpsAccuracy, distanceUnit, getEntityLatLng]);

  return (
    <div className="relative flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden bg-background">

      {/* ── TOP CONTROL & FILTER BAR ── */}
      <header className="z-20 shrink-0 border-b border-border bg-card/95 backdrop-blur-md px-3 py-2.5 sm:px-4">
        <div className="flex flex-col gap-2">

          {/* Row 1: Search, Region, Location, Mode Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2">

            {/* Left: Search input */}
            <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md bg-secondary/40 border border-border rounded-xl px-3 py-1.5 focus-within:border-primary/60 transition-colors">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search emergency requests, shelters, volunteers, supplies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Center / Right: Region Switcher, GPS Action, View Switcher */}
            <div className="flex items-center gap-1.5 flex-wrap">

              {/* Region Switcher */}
              <div className="flex items-center bg-secondary/50 p-0.5 rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => onRegionChange('ncr')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-mono text-[11px] font-bold transition-all',
                    region === 'ncr' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Delhi NCR
                </button>
                <button
                  type="button"
                  onClick={() => onRegionChange('badrinath')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-mono text-[11px] font-bold transition-all',
                    region === 'badrinath' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Chamoli / Joshimath
                </button>
              </div>

              {/* Use My Location GPS Button */}
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={gpsStatus === 'requesting'}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold border transition-all active:scale-95',
                  gpsStatus === 'located'
                    ? 'border-info/40 bg-info/10 text-info'
                    : gpsStatus === 'requesting'
                    ? 'border-warning/40 bg-warning/10 text-warning animate-pulse'
                    : 'border-border bg-card text-foreground hover:bg-secondary'
                )}
                title={gpsError ?? (userCoords ? `Lat: ${userCoords[0].toFixed(4)}, Lng: ${userCoords[1].toFixed(4)}` : 'Detect your current GPS position')}
              >
                <Locate className={cn('h-3.5 w-3.5', gpsStatus === 'requesting' && 'animate-spin')} />
                <span className="hidden sm:inline">
                  {gpsStatus === 'located' ? 'GPS Active' : gpsStatus === 'requesting' ? 'Locating...' : 'Use My Location'}
                </span>
              </button>

              {/* Distance Radius Filter (Configurable 2-mile default) */}
              <div className="flex items-center gap-1 bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs">
                <Compass className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(Number(e.target.value))}
                  className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
                  title="Filter by distance radius from your location"
                >
                  <option value={0} className="bg-card text-foreground">Radius: All</option>
                  <option value={1} className="bg-card text-foreground">Within 1 mi</option>
                  <option value={2} className="bg-card text-foreground">Within 2 mi (Default)</option>
                  <option value={5} className="bg-card text-foreground">Within 5 mi</option>
                  <option value={10} className="bg-card text-foreground">Within 10 mi</option>
                </select>
              </div>

              {/* Unit Toggle: mi vs km */}
              <button
                type="button"
                onClick={() => setDistanceUnit((u) => (u === 'mi' ? 'km' : 'mi'))}
                className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-mono font-bold text-muted-foreground hover:text-foreground"
                title="Toggle distance unit (miles / kilometres)"
              >
                {distanceUnit.toUpperCase()}
              </button>

              {/* Accessible List vs Map View Toggle */}
              <div className="flex items-center bg-secondary/50 p-0.5 rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all',
                    viewMode === 'map' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="View interactive geographical vector map"
                >
                  <span>Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all',
                    viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Switch to accessible list view for screen readers or low connectivity"
                >
                  <ListFilter className="h-3 w-3" />
                  <span>Accessible List</span>
                </button>
              </div>

              {/* Side Panel Toggle (Desktop) */}
              <button
                type="button"
                onClick={() => setDetailsPanelOpen((o) => !o)}
                className="hidden lg:flex items-center gap-1 rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
                title={detailsPanelOpen ? 'Collapse side details' : 'Expand side details'}
              >
                {detailsPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Row 2: Category & Severity Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">

            {/* Severity Filter Pills */}
            <div className="flex items-center gap-1 border-r border-border pr-2 shrink-0">
              <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1">Severity:</span>
              <button
                type="button"
                onClick={() => setSeverityFilter('all')}
                className={cn(
                  'px-2 py-0.5 rounded-md font-mono text-[10px] font-bold transition-all',
                  severityFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('critical')}
                className={cn(
                  'px-2 py-0.5 rounded-md font-mono text-[10px] font-bold transition-all border',
                  severityFilter === 'critical'
                    ? 'border-alert bg-alert text-alert-foreground'
                    : 'border-alert/30 bg-alert/10 text-alert'
                )}
              >
                CRITICAL
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('urgent')}
                className={cn(
                  'px-2 py-0.5 rounded-md font-mono text-[10px] font-bold transition-all border',
                  severityFilter === 'urgent'
                    ? 'border-warning bg-warning text-warning-foreground'
                    : 'border-warning/30 bg-warning/10 text-warning'
                )}
              >
                HIGH / URGENT
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('moderate')}
                className={cn(
                  'px-2 py-0.5 rounded-md font-mono text-[10px] font-bold transition-all border',
                  severityFilter === 'moderate'
                    ? 'border-info bg-info text-info-foreground'
                    : 'border-info/30 bg-info/10 text-info'
                )}
              >
                NORMAL
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1">Category:</span>
              {[
                { id: 'all', label: 'All Needs' },
                { id: 'medical', label: 'Medical', icon: '✚' },
                { id: 'rescue', label: 'Rescue', icon: '⛑' },
                { id: 'food', label: 'Food / Water', icon: '💧' },
                { id: 'shelter', label: 'Shelter', icon: '⛺' },
                { id: 'volunteers', label: 'Volunteers', icon: '👥' },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategoryFilter(id)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all',
                    categoryFilter === id
                      ? 'bg-foreground text-background font-bold'
                      : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {icon && <span>{icon}</span>}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Quick Invariant Toggles: Bed Capacity & Volunteer Availability */}
            <div className="flex items-center gap-1.5 ml-auto shrink-0 pl-2">
              <button
                type="button"
                onClick={() => setShelterBedsOnly((v) => !v)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all',
                  shelterBedsOnly ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground'
                )}
              >
                🛏️ Beds Available Only
              </button>
              <button
                type="button"
                onClick={() => setVolunteersAvailableOnly((v) => !v)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all',
                  volunteersAvailableOnly ? 'border-success bg-success/20 text-success' : 'border-border text-muted-foreground'
                )}
              >
                🛡️ Available Volunteers
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* GPS Error Notification Toast */}
      {gpsError && (
        <div className="z-30 bg-alert/15 border-b border-alert/30 px-4 py-2 flex items-center justify-between text-xs text-alert">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span>{gpsError}</span>
          </div>
          <button type="button" onClick={() => setGpsError(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Offline Status & Tile Service Fallback Banner */}
      {!isOnline && (
        <div className="z-20 bg-warning/15 border-b border-warning/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-warning">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0 text-warning" />
            <span>
              <strong>Offline Mode Active:</strong> Online satellite tiles and turn-by-turn routing services are unavailable. Local cached vector data and saved disaster records remain accessible.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {viewMode === 'map' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-6 text-[11px] border-warning/40 text-warning hover:bg-warning/20 font-bold"
              >
                Switch to Usable List-Based View
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('map')}
                className="h-6 text-[11px] border-warning/40 text-warning hover:bg-warning/20 font-bold"
              >
                Switch to Cached Vector Map
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE: MAP VIEW OR ACCESSIBLE LIST ── */}
      <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* VIEW 1: INTERACTIVE MAP VIEW */}
        {viewMode === 'map' ? (
          <div className="relative flex-1 h-full w-full overflow-hidden">
            <MapView
              requests={filteredRequests}
              shelters={filteredShelters}
              volunteers={filteredVolunteers}
              resources={filteredResources}
              isOnline={isOnline}
              selectedId={selectedId}
              onSelect={onSelect}
              region={region}
              theme={theme}
              navDestination={activeNavDest}
            />

            {/* Routing Mode Controller Overlay (When in active routing) */}
            {activeNavDest && (
              <div className="absolute top-3 left-3 z-30 bg-card/95 backdrop-blur border border-warning/40 rounded-xl p-3 shadow-xl max-w-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-warning">
                      Active Navigation
                    </span>
                    <h4 className="text-xs font-bold text-foreground truncate">{activeNavDest.name}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNavDest(null);
                      setRouteResult(null);
                      onClearNavDestination?.();
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Driving vs Walking Mode Switcher */}
                <div className="mt-2 flex items-center gap-1 bg-secondary/60 p-0.5 rounded-lg border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleRoutingMode('driving')}
                    disabled={isRoutingLoading}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold flex-1 justify-center transition-all',
                      routingMode === 'driving' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                    )}
                  >
                    <Car className="h-3 w-3" /> Driving
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleRoutingMode('walking')}
                    disabled={isRoutingLoading}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold flex-1 justify-center transition-all',
                      routingMode === 'walking' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                    )}
                  >
                    <Footprints className="h-3 w-3" /> Walking
                  </button>
                </div>

                {/* Routing status & distance stats */}
                <div className="mt-2 text-[11px] text-muted-foreground space-y-1">
                  {isRoutingLoading ? (
                    <div className="flex items-center gap-2 text-warning animate-pulse">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Calculating optimal road route via OSRM...</span>
                    </div>
                  ) : routeResult?.isRealRoute && routeResult.route ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-foreground font-bold">
                        <span>Route Distance:</span>
                        <span>
                          {routeResult.route.distanceKm.toFixed(1)} km (
                          {(routeResult.route.distanceKm * 0.621371).toFixed(1)} mi)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-foreground font-bold">
                        <span>Estimated Travel Time:</span>
                        <span className="text-primary font-mono">~{routeResult.route.durationMinutes} min</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Navigating via actual road network ({routingMode} mode).
                      </p>
                    </div>
                  ) : (
                    <div className="rounded bg-warning/10 border border-warning/20 p-2 text-[10px] text-warning leading-relaxed">
                      <span className="font-bold">Road routing service offline:</span>
                      <p className="mt-0.5">
                        Straight-line distance: ~
                        {routeResult?.fallbackStraightLineMiles?.toFixed(1) ?? '—'} mi (~
                        {routeResult?.fallbackStraightLineKm?.toFixed(1) ?? '—'} km).
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        Always verify local road conditions and flood safety before dispatch.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: ACCESSIBLE LIST VIEW ALTERNATIVE */
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 bg-card space-y-6">
            <div className="max-w-5xl mx-auto space-y-6">

              {/* Accessible Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Accessible Emergency Directory</h2>
                  <p className="text-xs text-muted-foreground">
                    Structured listings for high-contrast viewing, screen-readers, and offline situations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-bold text-foreground hover:bg-secondary/80"
                >
                  Return to Map
                </button>
              </div>

              {/* Entity Directory Tabs */}
              <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    'px-3 py-1 rounded-lg font-bold transition-all',
                    activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  All Records ({filteredRequests.length + filteredShelters.length + filteredVolunteers.length + filteredResources.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className={cn(
                    'px-3 py-1 rounded-lg font-bold transition-all',
                    activeTab === 'requests' ? 'bg-alert text-alert-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Needs & SOS ({filteredRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('shelters')}
                  className={cn(
                    'px-3 py-1 rounded-lg font-bold transition-all',
                    activeTab === 'shelters' ? 'bg-info text-info-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Shelters ({filteredShelters.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('volunteers')}
                  className={cn(
                    'px-3 py-1 rounded-lg font-bold transition-all',
                    activeTab === 'volunteers' ? 'bg-success text-success-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Responders ({filteredVolunteers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('resources')}
                  className={cn(
                    'px-3 py-1 rounded-lg font-bold transition-all',
                    activeTab === 'resources' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Depots & Hospitals ({filteredResources.length})
                </button>
              </div>

              {/* Requests Section */}
              {(activeTab === 'all' || activeTab === 'requests') && filteredRequests.length > 0 && (
                <section aria-labelledby="heading-requests" className="space-y-3">
                  <h3 id="heading-requests" className="text-sm font-bold uppercase tracking-wider text-alert flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4" />
                    Emergency Aid Requests ({filteredRequests.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredRequests.map((req) => (
                      <article
                        key={req.id}
                        className={cn(
                          'p-4 rounded-xl border bg-card/60 space-y-2 transition-all cursor-pointer hover:border-primary',
                          req.priority === 'critical' ? 'border-alert/40 bg-alert/5' : 'border-border',
                          selectedId === req.id && 'ring-2 ring-primary border-primary'
                        )}
                        onClick={() => {
                          onSelect(req.id);
                          setViewMode('map');
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                            req.priority === 'critical' ? 'bg-alert text-alert-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            {req.priority} · {req.category}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {req.distanceMiles} mi away
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground leading-snug">{req.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{req.details}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {req.items.map((item, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-secondary/80 text-[10px] text-muted-foreground">
                              {item}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Shelters Section */}
              {(activeTab === 'all' || activeTab === 'shelters') && filteredShelters.length > 0 && (
                <section aria-labelledby="heading-shelters" className="space-y-3">
                  <h3 id="heading-shelters" className="text-sm font-bold uppercase tracking-wider text-info flex items-center gap-2">
                    <Tent className="h-4 w-4" />
                    Evacuation Shelters ({filteredShelters.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredShelters.map((shelter) => {
                      const availableBeds = shelter.capacity - shelter.occupied;
                      return (
                        <article
                          key={shelter.id}
                          className="p-4 rounded-xl border border-border bg-card/60 space-y-2 hover:border-info transition-all cursor-pointer"
                          onClick={() => {
                            onSelect(shelter.id);
                            setViewMode('map');
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-foreground">{shelter.name}</h4>
                            <span className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                              availableBeds > 0 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                            )}>
                              {availableBeds > 0 ? `${availableBeds} beds available` : 'Capacity Full'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{shelter.address}</p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {shelter.amenities.map((a, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-info/10 text-[10px] text-info">
                                {a}
                              </span>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Volunteers Section */}
              {(activeTab === 'all' || activeTab === 'volunteers') && filteredVolunteers.length > 0 && (
                <section aria-labelledby="heading-volunteers" className="space-y-3">
                  <h3 id="heading-volunteers" className="text-sm font-bold uppercase tracking-wider text-success flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Consenting Responders ({filteredVolunteers.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredVolunteers.map((vol) => (
                      <article
                        key={vol.id}
                        className="p-4 rounded-xl border border-border bg-card/60 space-y-2 hover:border-success transition-all cursor-pointer"
                        onClick={() => {
                          onSelect(vol.id);
                          setViewMode('map');
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-foreground">{vol.name}</h4>
                          <span className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold',
                            vol.available ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                          )}>
                            {vol.available ? 'Available Now' : 'Assigned'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {vol.skills.map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">
                              {s}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Resources Section */}
              {(activeTab === 'all' || activeTab === 'resources') && filteredResources.length > 0 && (
                <section aria-labelledby="heading-resources" className="space-y-3">
                  <h3 id="heading-resources" className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Hospital className="h-4 w-4" />
                    Emergency Supplies & Hospitals ({filteredResources.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredResources.map((res) => (
                      <article
                        key={res.id}
                        className="p-4 rounded-xl border border-border bg-card/60 space-y-2 hover:border-primary transition-all cursor-pointer"
                        onClick={() => {
                          onSelect(res.id);
                          setViewMode('map');
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-foreground">{res.name}</h4>
                          <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-mono uppercase text-muted-foreground">
                            {res.type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{res.address}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {res.tags.map((t, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground">
                              {t}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

            </div>
          </div>
        )}

        {/* ── DESKTOP COLLAPSIBLE DETAILS & DIRECTORY PANEL ── */}
        {detailsPanelOpen && viewMode === 'map' && (
          <aside className="hidden lg:flex w-96 xl:w-[420px] shrink-0 border-l border-border bg-card/95 backdrop-blur flex-col h-full z-10 overflow-hidden shadow-2xl">

            {/* Panel Header */}
            <div className="p-3 border-b border-border flex items-center justify-between bg-secondary/30">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {selectedEntity ? 'Selected Entity Details' : 'Operations Directory'}
                </span>
              </div>
              {selectedEntity && (
                <button
                  type="button"
                  onClick={() => onSelect('')}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* ── CASE A: SELECTED ENTITY INSPECTOR ── */}
              {selectedEntity ? (
                <div className="space-y-4">

                  {/* Header Badge & Title */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                        selectedEntity.type === 'request'
                          ? selectedEntity.data.priority === 'critical'
                            ? 'bg-alert text-alert-foreground'
                            : 'bg-primary/20 text-primary'
                          : selectedEntity.type === 'shelter'
                          ? 'bg-info/20 text-info'
                          : selectedEntity.type === 'volunteer'
                          ? 'bg-success/20 text-success'
                          : 'bg-secondary text-foreground'
                      )}>
                        {selectedEntity.type.toUpperCase()}
                      </span>

                      {selectedDistance && (
                        <div className="flex items-center gap-1 text-xs font-mono font-bold text-primary">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span>{selectedDistance.formatted} · {selectedDistance.bearing}</span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-foreground leading-snug">
                      {'title' in selectedEntity.data ? selectedEntity.data.title : selectedEntity.data.name}
                    </h3>
                  </div>

                  {/* Specific Entity Info */}
                  {selectedEntity.type === 'request' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {selectedEntity.data.details}
                      </p>

                      <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span className="font-bold text-foreground capitalize">{selectedEntity.data.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span className="font-bold text-foreground uppercase">{selectedEntity.data.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">People Count:</span>
                          <span className="font-bold text-foreground">{selectedEntity.data.peopleCount} individuals</span>
                        </div>
                      </div>

                      {/* Required items */}
                      {selectedEntity.data.items.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">Required Resources:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedEntity.data.items.map((item, idx) => (
                              <span key={idx} className="px-2 py-1 rounded-md bg-secondary text-xs text-foreground font-medium">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contact Phone */}
                      {selectedEntity.data.contactPhone && (
                        <a
                          href={`tel:${selectedEntity.data.contactPhone.replace(/[\s\-().]/g, '')}`}
                          className="flex items-center gap-2 p-2.5 rounded-xl border border-info/30 bg-info/10 text-xs font-bold text-info hover:bg-info/20 transition-all"
                        >
                          <Phone className="h-4 w-4" />
                          <span>Call Requester: {selectedEntity.data.contactPhone}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {selectedEntity.type === 'shelter' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {selectedEntity.data.address}
                      </p>

                      {/* Bed capacity invariant bar */}
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-2 text-xs">
                        <div className="flex justify-between font-bold">
                          <span className="text-foreground">Bed Availability:</span>
                          <span className={cn(
                            selectedEntity.data.capacity - selectedEntity.data.occupied > 0 ? 'text-success' : 'text-alert'
                          )}>
                            {selectedEntity.data.capacity - selectedEntity.data.occupied} beds free
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              selectedEntity.data.occupied / selectedEntity.data.capacity > 0.8 ? 'bg-alert' : 'bg-success'
                            )}
                            style={{
                              width: `${Math.min(100, Math.round((selectedEntity.data.occupied / selectedEntity.data.capacity) * 100))}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Occupied: {selectedEntity.data.occupied}</span>
                          <span>Total Capacity: {selectedEntity.data.capacity}</span>
                        </div>
                      </div>

                      {/* Amenities */}
                      <div>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">Amenities & Facilities:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedEntity.data.amenities.map((amenity, idx) => (
                            <span key={idx} className="px-2 py-1 rounded-md bg-info/10 border border-info/20 text-xs text-info font-medium">
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedEntity.type === 'volunteer' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span className={cn('font-bold', selectedEntity.data.available ? 'text-success' : 'text-muted-foreground')}>
                            {selectedEntity.data.available ? 'Available for Deployment' : 'Currently Assigned'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">Skills & Credentials:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedEntity.data.skills.map((skill, idx) => (
                            <span key={idx} className="px-2 py-1 rounded-md bg-success/10 border border-success/20 text-xs text-success font-medium">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-border flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const coords = getEntityLatLng(selectedEntity.data);
                        if (coords) {
                          handleStartNavigation({
                            id: selectedEntity.data.id,
                            name: 'title' in selectedEntity.data ? selectedEntity.data.title : selectedEntity.data.name,
                            address: 'details' in selectedEntity.data ? selectedEntity.data.details : 'address' in selectedEntity.data ? selectedEntity.data.address : '',
                            coords,
                            phone: 'contactPhone' in selectedEntity.data ? selectedEntity.data.contactPhone : undefined,
                          });
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 px-4 text-xs font-bold shadow-md hover:bg-primary/90 transition-all active:scale-95"
                    >
                      <Navigation className="h-4 w-4" />
                      <span>In-App Directions & Routing</span>
                    </button>

                    {selectedEntity.type === 'request' && onOpenDetailsModal && (
                      <button
                        type="button"
                        onClick={() => onOpenDetailsModal(selectedEntity.data.id)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2 px-4 text-xs font-bold text-foreground hover:bg-secondary transition-all"
                      >
                        <Info className="h-4 w-4" />
                        <span>Inspect Full Incident & Lifecycle</span>
                      </button>
                    )}
                  </div>

                </div>
              ) : (
                /* ── CASE B: FILTERED OPERATIONS DIRECTORY LIST ── */
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{filteredRequests.length} needs · {filteredShelters.length} shelters</span>
                    {radiusMiles > 0 && <span className="text-primary font-mono font-bold">Within {radiusMiles} mi</span>}
                  </div>

                  {/* Requests preview cards */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                      Active Needs ({filteredRequests.length})
                    </p>
                    {filteredRequests.slice(0, 10).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onSelect(r.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border transition-all',
                          r.priority === 'critical'
                            ? 'border-alert/30 bg-alert/5 hover:border-alert'
                            : 'border-border bg-card/60 hover:border-primary',
                          selectedId === r.id && 'border-primary ring-2 ring-primary/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={cn(
                            'px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase',
                            r.priority === 'critical' ? 'bg-alert text-alert-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            {r.priority} · {r.category}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">{r.distanceMiles} mi</span>
                        </div>
                        <h4 className="text-xs font-bold text-foreground truncate">{r.title}</h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{r.details}</p>
                      </button>
                    ))}
                  </div>

                  {/* Shelters preview cards */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                      Shelters ({filteredShelters.length})
                    </p>
                    {filteredShelters.slice(0, 6).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onSelect(s.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border border-border bg-card/60 hover:border-info transition-all',
                          selectedId === s.id && 'border-info ring-2 ring-info/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-foreground truncate">{s.name}</span>
                          <span className="text-[10px] font-mono text-success font-bold shrink-0">
                            {s.capacity - s.occupied} beds
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{s.address}</p>
                      </button>
                    ))}
                  </div>

                </div>
              )}

            </div>
          </aside>
        )}

      </div>
    </div>
  );
}
