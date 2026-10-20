import { useState, useMemo, useEffect } from 'react';
import {
  Siren,
  Users,
  Building2,
  HardDrive,
  MapPin,
  ArrowRight,
  HeartPulse,
  Droplets,
  BedDouble,
  LifeBuoy,
  Clock,
  Navigation,
  ExternalLink,
  Search,
  CheckCircle2,
  Sparkles,
  Phone,
  Flame,
  Radio,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, buildGoogleMapsUrl } from '@/lib/utils';
import type { MapRegion } from '@/components/map-view';
import type { AidRequest, Shelter, Volunteer, Resource, RequestCategory } from '@/types';
import type { NavDestination } from '@/hooks/use-navigation';

import { getVolunteerProfile, type VolunteerProfile } from '@/lib/volunteer-profile';

interface LandingPageProps {
  region: MapRegion;
  locationLabel: string;
  requests: AidRequest[];
  shelters: Shelter[];
  volunteers: Volunteer[];
  resources: Resource[];
  isOnline: boolean;
  onRequestHelp: () => void;
  onBecomeVolunteer: () => void;
  onOpenVolunteerPortal?: () => void;
  onExploreMap: () => void;
  onOpenShelters: () => void;
  onOpenResources: () => void;
  onOpenOperations: () => void;
  onOpenSync: () => void;
  onNavigate?: (dest: NavDestination) => void;
  onSelectRequest?: (id: string) => void;
  onHelpRequest?: (id: string) => void;
}

// Helpers for request coords
function getRequestCoords(req: AidRequest, region: string = 'ncr'): [number, number] {
  if (typeof req.latitude === 'number' && typeof req.longitude === 'number' && (req.latitude !== 0 || req.longitude !== 0)) {
    return [req.latitude, req.longitude];
  }
  if (req.coords) {
    const { x, y } = req.coords;
    if (y >= 8 && y <= 38 && x >= 65 && x <= 98) {
      return [y, x];
    }
    if (x >= 8 && x <= 38 && y >= 65 && y <= 98) {
      return [x, y];
    }
    const center: [number, number] = region === 'badrinath' ? [30.556, 79.564] : [28.6139, 77.209];
    const nx = typeof x === 'number' && !isNaN(x) ? x : 50;
    const ny = typeof y === 'number' && !isNaN(y) ? y : 50;
    return [
      center[0] + (ny - 50) * 0.0018,
      center[1] + (nx - 50) * 0.0018,
    ];
  }
  return region === 'badrinath' ? [30.556, 79.564] : [28.6139, 77.209];
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'Just now';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CATEGORY_ICONS: Record<string, { icon: typeof HeartPulse; color: string; bg: string; border: string }> = {
  medical: { icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  food: { icon: Droplets, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  shelter: { icon: BedDouble, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  rescue: { icon: LifeBuoy, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  volunteers: { icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
};

export function LandingPage({
  region,
  locationLabel,
  requests,
  shelters,
  volunteers,
  resources,
  isOnline,
  onRequestHelp,
  onBecomeVolunteer,
  onOpenVolunteerPortal,
  onExploreMap,
  onOpenShelters,
  onOpenResources,
  onOpenOperations,
  onOpenSync,
  onNavigate,
  onSelectRequest,
  onHelpRequest,
}: LandingPageProps) {
  const [sosFilter, setSosFilter] = useState<'all' | 'medical' | 'food' | 'shelter' | 'rescue'>('all');
  const [sosSearch, setSosSearch] = useState('');

  // Volunteer Profile state
  const [volunteerProfile, setVolunteerProfile] = useState<VolunteerProfile | null>(() => getVolunteerProfile());

  useEffect(() => {
    const update = () => setVolunteerProfile(getVolunteerProfile());
    update();
    window.addEventListener('storage', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('focus', update);
    };
  }, []);

  const isVolunteerRegistered = Boolean(volunteerProfile && (volunteerProfile.displayName || volunteerProfile.email));

  // Critical & total counts
  const criticalCount = requests.filter((r) => r.priority === 'critical').length;
  const totalFreeBeds = shelters.reduce((acc, s) => acc + Math.max(0, s.capacity - s.occupied), 0);
  const openSheltersCount = shelters.filter((s) => s.status === 'open').length;
  const activeVolunteersCount = volunteers.filter((v) => v.available).length;

  // Filtered requests for the side SOS portal
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Category filter
      if (sosFilter !== 'all' && req.category !== sosFilter) {
        return false;
      }
      // Search query
      if (sosSearch.trim()) {
        const q = sosSearch.toLowerCase();
        const matches =
          req.title.toLowerCase().includes(q) ||
          req.details.toLowerCase().includes(q) ||
          (req.locationDescription && req.locationDescription.toLowerCase().includes(q)) ||
          req.items.some((i) => i.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [requests, sosFilter, sosSearch]);

  const handleStartNav = (req: AidRequest) => {
    const coords = getRequestCoords(req, region);
    if (onNavigate) {
      onNavigate({
        id: req.id,
        name: req.title,
        address: req.locationDescription || `${req.contactName || 'Requester'} · ${locationLabel}`,
        coords,
        phone: req.contactPhone,
        type: req.category,
      });
    } else if (onSelectRequest) {
      onSelectRequest(req.id);
    }
  };

  return (
    <div className="w-full py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-[1700px] mx-auto animate-fade-in">
      {/* ── Main Split View: Decluttered Left Content + Right SOS Portal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── LEFT COLUMN: Decluttered Hero & Quick Emergency Actions (7 Cols) ── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Hero Card */}
          <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card to-card/70 p-6 sm:p-8 lg:p-10 shadow-lg">
            <div className="space-y-4">
              {/* Badge strip */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-mono font-bold text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  Live Emergency Response
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-mono text-muted-foreground">
                  <MapPin className="h-3 w-3 text-sky-400" />
                  {locationLabel}
                </div>
                <div className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono font-semibold',
                  isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-amber-400')} />
                  {isOnline ? 'Mesh Network Connected' : 'Offline Storage Active'}
                </div>
              </div>

              {/* Title & Tagline */}
              <div>
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
                  Local Disaster Aid & SOS Routing{' '}
                  <span className="text-red-500 block sm:inline">When Seconds Count.</span>
                </h1>
                <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                  Real-time peer-to-peer neighborhood relief. Broadcast SOS emergencies, get instant turn-by-turn directions, and locate open shelters without cellular dependence.
                </p>
              </div>

              {/* Big Prominent Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={onRequestHelp}
                  className="bg-red-600 hover:bg-red-500 text-white font-black text-sm sm:text-base h-12 px-6 rounded-2xl shadow-lg shadow-red-600/30 active:scale-95 transition-all flex items-center gap-2 border border-red-400/40"
                >
                  <Siren className="h-5 w-5 animate-bounce" />
                  Request Emergency SOS
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={onExploreMap}
                  className="border-border bg-secondary/60 hover:bg-secondary text-foreground font-bold text-sm h-12 px-5 rounded-2xl"
                >
                  <Navigation className="h-4 w-4 mr-2 text-info" />
                  Open Interactive Map
                </Button>

                <Button
                  size="lg"
                  variant="ghost"
                  onClick={onBecomeVolunteer}
                  className="text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground h-12 px-3"
                >
                  Volunteer Roster <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>

            {/* Compact Telemetry Strip inside Hero */}
            <div className="mt-6 pt-5 border-t border-border/70 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Active SOS</span>
                <span className="text-base font-black text-red-500 mt-0.5 block flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {requests.length} Requests
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Open Beds</span>
                <span className="text-base font-black text-emerald-400 mt-0.5 block">
                  {totalFreeBeds} Available
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Shelters</span>
                <span className="text-base font-black text-sky-400 mt-0.5 block">
                  {openSheltersCount} Open
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Volunteers</span>
                <span className="text-base font-black text-amber-400 mt-0.5 block">
                  {activeVolunteersCount} Ready
                </span>
              </div>
            </div>
          </section>

          {/* ── Citizen & Volunteer Portals ── */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Citizen SOS Portal */}
            <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-card via-card to-red-500/5 p-4 sm:p-5 space-y-3.5 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
                    <Siren className="h-5 w-5 animate-pulse" />
                  </div>
                  <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 text-[10px] font-bold">
                    Citizen Emergency
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    Citizen SOS Portal
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Need urgent medicine, drinking water, shelter beds, or rescue? Broadcast an emergency distress alert.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  onClick={onRequestHelp}
                  className="w-full h-10 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Siren className="h-4 w-4" />
                  Request Emergency Help
                </Button>
              </div>
            </div>

            {/* Card 2: Volunteer Portal with Register button & Registered State */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/5 p-4 sm:p-5 space-y-3.5 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                    <Users className="h-5 w-5" />
                  </div>
                  {isVolunteerRegistered ? (
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Registered
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                      Volunteer Hub
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    Volunteer Portal
                  </h3>
                  {isVolunteerRegistered ? (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Registered as {volunteerProfile?.displayName || 'Volunteer'}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {volunteerProfile?.ngoAffiliation ? `🏛️ ${volunteerProfile.ngoAffiliation}` : 'Independent Responder'} • {volunteerProfile?.email}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Register with your Gmail & optional NGO to claim emergency tasks and help neighbors.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                {isVolunteerRegistered ? (
                  <>
                    <Button
                      onClick={onOpenVolunteerPortal || onBecomeVolunteer}
                      className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Open Volunteer Hub
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onBecomeVolunteer}
                      className="h-10 px-3 text-xs border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground rounded-xl"
                      title="Update Profile"
                    >
                      Edit
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={onBecomeVolunteer}
                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Register as Volunteer
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Quick Essential Aid Hub (3 Cards) */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Card 1: Medical */}
            <div
              onClick={() => {
                setSosFilter('medical');
              }}
              className="group cursor-pointer rounded-2xl border border-red-500/20 bg-card p-4 hover:border-red-500/50 hover:bg-red-500/5 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="border-red-500/30 text-red-400 text-[10px]">
                  {requests.filter((r) => r.category === 'medical').length} SOS
                </Badge>
              </div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-red-400 transition-colors">
                Medicine & Medical Aid
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                Emergency clinics, first aid supplies, and urgent patient extractions.
              </p>
            </div>

            {/* Card 2: Food & Water */}
            <div
              onClick={() => {
                setSosFilter('food');
              }}
              className="group cursor-pointer rounded-2xl border border-blue-500/20 bg-card p-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Droplets className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px]">
                  {requests.filter((r) => r.category === 'food').length} SOS
                </Badge>
              </div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-blue-400 transition-colors">
                Food & Clean Water
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                Potable drinking water delivery, emergency food rations, and infant packs.
              </p>
            </div>

            {/* Card 3: Shelter */}
            <div
              onClick={onOpenShelters}
              className="group cursor-pointer rounded-2xl border border-amber-500/20 bg-card p-4 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <BedDouble className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
                  {totalFreeBeds} Free Beds
                </Badge>
              </div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-amber-400 transition-colors">
                Disaster Shelters
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                Safe high-ground camps, community halls, and verified dry beds.
              </p>
            </div>
          </section>

          {/* Minimal 3-Step Offline Strip */}
          <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-primary" />
                <span>Zero-Cloud Offline Reliability</span>
              </span>
              <button
                type="button"
                onClick={onOpenSync}
                className="text-[11px] font-mono text-primary hover:underline"
              >
                Sync Status →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                <span className="font-bold text-foreground block">1. 100% Offline Storage</span>
                <span className="text-[11px] text-muted-foreground">SOS alerts and cached maps save to device storage immediately.</span>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                <span className="font-bold text-foreground block">2. Peer-to-Peer Match</span>
                <span className="text-[11px] text-muted-foreground">Local vectors match nearby helpers without waiting for cellular networks.</span>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                <span className="font-bold text-foreground block">3. Multi-Tab & Device Sync</span>
                <span className="text-[11px] text-muted-foreground">Reconciles automatically as soon as any signal or Wi-Fi beacon connects.</span>
              </div>
            </div>
          </section>
        </div>

        {/* ── RIGHT COLUMN: Live SOS Emergency Portal with Turn-by-Turn Directions (5 Cols) ── */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border-2 border-red-500/30 bg-card p-4 sm:p-5 shadow-2xl space-y-4 lg:sticky lg:top-20">
            {/* Portal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
                  <Siren className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    Live SOS Portal
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-500 text-white animate-pulse">
                      LIVE
                    </span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Recent distress broadcasts & 1-click navigation
                  </p>
                </div>
              </div>

              {/* Broadcast button trigger */}
              <Button
                size="sm"
                onClick={onRequestHelp}
                className="h-8 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-600/20"
              >
                + Post SOS
              </Button>
            </div>

            {/* Filter Pills & Search */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {(['all', 'medical', 'food', 'shelter', 'rescue'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSosFilter(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all whitespace-nowrap capitalize',
                      sosFilter === cat
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/60'
                    )}
                  >
                    {cat === 'all' ? `All (${requests.length})` : cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by location, symptom, or supply..."
                  value={sosSearch}
                  onChange={(e) => setSosSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-secondary/40 border-border"
                />
              </div>
            </div>

            {/* Scrollable SOS Cards Feed */}
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredRequests.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-border/80 space-y-3">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-secondary/50 flex items-center justify-center text-muted-foreground">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">No matching requests found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sosSearch ? 'Try a different search keyword.' : 'All clear in this category right now.'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={onRequestHelp}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                  >
                    Send New SOS Alert
                  </Button>
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const meta = CATEGORY_ICONS[req.category] || CATEGORY_ICONS.rescue;
                  const Icon = meta.icon;
                  const coords = getRequestCoords(req, region);
                  const gmapsUrl = buildGoogleMapsUrl({
                    coords,
                    query: req.locationDescription || req.title,
                  });
                  const isUserSos = Boolean(req.isUserCreated);

                  return (
                    <div
                      key={req.id}
                      className={cn(
                        'rounded-2xl border p-3.5 transition-all space-y-2.5 relative',
                        isUserSos
                          ? 'border-red-500/80 bg-red-500/10 ring-2 ring-red-500/30 shadow-md shadow-red-500/10'
                          : 'border-border bg-card/90 hover:border-border/80 hover:bg-secondary/20'
                      )}
                    >
                      {/* Top row: Category, Severity, and Time */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                              meta.bg,
                              meta.color,
                              'border',
                              meta.border
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {req.category}
                          </span>

                          {req.priority === 'critical' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600 text-white uppercase tracking-wider">
                              CRITICAL
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                              URGENT
                            </span>
                          )}

                          {isUserSos && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm uppercase animate-pulse">
                              🚨 YOUR SOS
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {timeAgo(req.createdAt)}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-1">
                          {req.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                          {req.details}
                        </p>
                      </div>

                      {/* Location & People tags */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                        <span className="flex items-center gap-1 truncate max-w-[200px]" title={req.locationDescription}>
                          <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                          <span className="truncate">{req.locationDescription || `${coords[0].toFixed(3)}, ${coords[1].toFixed(3)}`}</span>
                        </span>
                        {req.peopleCount > 0 && (
                          <span className="text-foreground font-semibold">
                            {req.peopleCount} {req.peopleCount === 1 ? 'person' : 'people'}
                          </span>
                        )}
                      </div>

                      {/* Action buttons: Directions & Live Map */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {gmapsUrl ? (
                          <a
                            href={gmapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95 text-center"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>📍 Directions</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartNav(req)}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>📍 Directions</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStartNav(req)}
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-foreground text-[11px] font-bold transition-all active:scale-95"
                        >
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span>View on Map</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
