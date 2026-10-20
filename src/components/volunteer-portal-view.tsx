import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HeartPulse,
  Droplets,
  BedDouble,
  LifeBuoy,
  Phone,
  Navigation,
  Building2,
  Mail,
  Search,
  Check,
  ExternalLink,
  Edit3,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, buildGoogleMapsUrl } from '@/lib/utils';
import type { NavDestination } from '@/hooks/use-navigation';
import type { AidRequest, RequestCategory } from '@/types';
import type { MapRegion } from '@/components/map-view';
import { getVolunteerProfile, saveVolunteerProfile, type VolunteerProfile } from '@/lib/volunteer-profile';
import { toast } from 'sonner';

interface VolunteerPortalViewProps {
  requests: AidRequest[];
  region: MapRegion;
  locationLabel: string;
  isOnline: boolean;
  onHelpRequest: (id: string) => void;
  onResolveRequest: (id: string) => void;
  onOpenDetailsModal: (id: string) => void;
  onNavigateToMap: () => void;
  onNavigate?: (dest: NavDestination) => void;
  onOpenVolunteerReg: () => void;
}

// Helpers for coordinates
function getCoords(req: AidRequest, region: string = 'ncr'): [number, number] {
  if (typeof req.latitude === 'number' && typeof req.longitude === 'number' && (req.latitude !== 0 || req.longitude !== 0)) {
    return [req.latitude, req.longitude];
  }
  if (req.coords) {
    const { x, y } = req.coords;
    if (y >= 8 && y <= 38 && x >= 65 && x <= 98) return [y, x];
    if (x >= 8 && x <= 38 && y >= 65 && y <= 98) return [x, y];
    const center: [number, number] = region === 'badrinath' ? [30.556, 79.564] : [28.6139, 77.209];
    const nx = typeof x === 'number' && !isNaN(x) ? x : 50;
    const ny = typeof y === 'number' && !isNaN(y) ? y : 50;
    return [center[0] + (ny - 50) * 0.0018, center[1] + (nx - 50) * 0.0018];
  }
  return region === 'badrinath' ? [30.556, 79.564] : [28.6139, 77.209];
}

const CATEGORY_META: Record<string, { label: string; icon: typeof HeartPulse; color: string; bg: string; border: string }> = {
  medical: { label: 'Medical', icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  food: { label: 'Food & Water', icon: Droplets, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  shelter: { label: 'Shelter', icon: BedDouble, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  rescue: { label: 'Rescue', icon: LifeBuoy, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
};

export function VolunteerPortalView({
  requests,
  region,
  locationLabel,
  isOnline,
  onHelpRequest,
  onResolveRequest,
  onOpenDetailsModal,
  onNavigateToMap,
  onNavigate,
  onOpenVolunteerReg,
}: VolunteerPortalViewProps) {
  // Volunteer Profile state
  const [profile, setProfile] = useState<VolunteerProfile | null>(() => getVolunteerProfile());
  const [activeTab, setActiveTab] = useState<'available' | 'my_missions'>('available');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'medical' | 'food' | 'shelter' | 'rescue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [claimedIds, setClaimedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('resqlink-my-claimed-missions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Reload profile when returning or updating
  useEffect(() => {
    const p = getVolunteerProfile();
    setProfile(p);
  }, []);

  const handleToggleStatus = () => {
    if (!profile) {
      onOpenVolunteerReg();
      return;
    }
    const nextStatus: 'available' | 'offline' =
      profile.availabilityStatus === 'available' ? 'offline' : 'available';
    const updated: VolunteerProfile = { ...profile, availabilityStatus: nextStatus };
    setProfile(updated);
    saveVolunteerProfile(updated);
    toast.success(nextStatus === 'available' ? 'Status: Available to Help' : 'Status: On Break');
  };

  const handleClaimHelp = (req: AidRequest) => {
    onHelpRequest(req.id);
    setClaimedIds((prev) => {
      const next = prev.includes(req.id) ? prev : [req.id, ...prev];
      localStorage.setItem('resqlink-my-claimed-missions', JSON.stringify(next));
      return next;
    });
    toast.success('Mission Accepted!', {
      description: `You are now assisting with "${req.title}". View in My Missions.`,
    });
  };

  const handleCompleteMission = (reqId: string) => {
    onResolveRequest(reqId);
    setClaimedIds((prev) => {
      const next = prev.filter((id) => id !== reqId);
      localStorage.setItem('resqlink-my-claimed-missions', JSON.stringify(next));
      return next;
    });
    toast.success('Mission Completed & Verified!', {
      description: 'Aid successfully delivered to recipient.',
    });
  };

  const handleDirections = (req: AidRequest) => {
    const coords = getCoords(req, region);
    if (onNavigate) {
      onNavigate({
        id: req.id,
        name: req.title,
        address: req.locationDescription || `${req.contactName || 'Requester'} · ${locationLabel}`,
        coords,
        phone: req.contactPhone,
        type: req.category,
      });
    } else {
      onNavigateToMap();
    }
  };

  // Filter requests
  const availableRequests = useMemo(() => {
    return requests.filter((r) => {
      if (r.status === 'fulfilled') return false;
      if (claimedIds.includes(r.id)) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          r.title.toLowerCase().includes(q) ||
          r.details.toLowerCase().includes(q) ||
          (r.locationDescription && r.locationDescription.toLowerCase().includes(q)) ||
          r.items.some((i) => i.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [requests, claimedIds, categoryFilter, searchQuery]);

  // My claimed missions
  const myMissions = useMemo(() => {
    return requests.filter((r) => claimedIds.includes(r.id) || r.status === 'in-progress');
  }, [requests, claimedIds]);

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground min-h-[calc(100vh-4rem)]">
      {/* ── Top Volunteer Profile Header ── */}
      <section className="border-b border-border bg-card/60 backdrop-blur-md px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {profile?.displayName || profile?.fullName || 'Community Volunteer'}
                </h1>
                {profile?.ngoAffiliation ? (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-semibold flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    <span>{profile.ngoAffiliation}</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                    Independent Volunteer
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {isOnline ? '🟢 Online' : '🟡 Offline'}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                {profile?.email && (
                  <span className="flex items-center gap-1 text-sky-400">
                    <Mail className="h-3 w-3" />
                    <span>{profile.email}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-red-400" />
                  <span>{locationLabel}</span>
                </span>
                {profile?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{profile.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleStatus}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 active:scale-95',
                profile?.availabilityStatus === 'available'
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : 'border-border bg-secondary/50 text-muted-foreground'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', profile?.availabilityStatus === 'available' ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground')} />
              <span>{profile?.availabilityStatus === 'available' ? 'Ready to Help' : 'Status: Away'}</span>
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={onOpenVolunteerReg}
              className="h-8 px-3 text-xs font-semibold border-border bg-card hover:bg-secondary flex items-center gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{profile ? 'Edit Profile' : 'Register'}</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Main Volunteer Dashboard Content ── */}
      <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-5">
        
        {/* Unregistered Alert Banner */}
        {!profile && (
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                Register as a Community Responder
              </h3>
              <p className="text-xs text-muted-foreground">
                Enter your Gmail and optional NGO name to claim emergency tasks and navigate directly to people in need.
              </p>
            </div>
            <Button
              size="sm"
              onClick={onOpenVolunteerReg}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0"
            >
              Quick Registration (1 Minute)
            </Button>
          </div>
        )}

        {/* Tab Switcher & Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* 2 Simple Tabs */}
          <div className="flex items-center gap-2 bg-secondary/40 p-1 rounded-2xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('available')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                activeTab === 'available'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Flame className="h-3.5 w-3.5 text-red-500" />
              <span>Emergencies Needing Help</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500/20 text-red-400 font-bold">
                {availableRequests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('my_missions')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                activeTab === 'my_missions'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>My Active Missions</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">
                {myMissions.length}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by area or need..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs bg-secondary/40 border-border"
            />
          </div>
        </div>

        {/* Category Filter Pills (When on available tab) */}
        {activeTab === 'available' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {(['all', 'medical', 'food', 'shelter', 'rescue'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'px-3 py-1 rounded-xl font-bold text-xs transition-all whitespace-nowrap capitalize',
                  categoryFilter === cat
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50'
                )}
              >
                {cat === 'all' ? `All Requests (${requests.length})` : cat}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab 1: Available Requests Feed ── */}
        {activeTab === 'available' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableRequests.length === 0 ? (
              <div className="col-span-full p-10 rounded-2xl border border-dashed border-border text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">No pending requests right now</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {searchQuery ? 'Try a different search keyword.' : 'All local distress signals in this category are assigned or resolved.'}
                  </p>
                </div>
              </div>
            ) : (
              availableRequests.map((req) => {
                const meta = CATEGORY_META[req.category] || CATEGORY_META.rescue;
                const Icon = meta.icon;
                const coords = getCoords(req, region);
                const gmapsUrl = buildGoogleMapsUrl({
                  coords,
                  query: req.locationDescription || req.title,
                });

                return (
                  <div
                    key={req.id}
                    className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm hover:border-border/80 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold uppercase', meta.bg, meta.color, 'border', meta.border)}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>

                          <span className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                            req.priority === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          )}>
                            {req.priority.toUpperCase()}
                          </span>
                        </div>

                        <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {req.distanceMiles ? `${req.distanceMiles} mi` : 'Nearby'}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-sm font-bold text-foreground leading-snug">
                          {req.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {req.details}
                        </p>
                      </div>

                      {/* Location & Requester */}
                      <div className="pt-1 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          <span className="truncate">{req.locationDescription || `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`}</span>
                        </div>
                        {req.contactPhone && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Phone className="h-3 w-3 text-sky-400" />
                            <a href={`tel:${req.contactPhone}`} className="text-sky-400 hover:underline">
                              {req.contactName || 'Requester'}: {req.contactPhone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        onClick={() => handleClaimHelp(req)}
                        className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm"
                      >
                        🤝 I Can Help
                      </Button>

                      {gmapsUrl ? (
                        <a
                          href={gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all text-center"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          <span>📍 Directions</span>
                        </a>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDirections(req)}
                          className="h-9 text-xs font-bold border-border"
                        >
                          <Navigation className="h-3.5 w-3.5 mr-1" />
                          Directions
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab 2: My Active Missions ── */}
        {activeTab === 'my_missions' && (
          <div className="space-y-4">
            {myMissions.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-border text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground">
                  <HeartPulse className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">No active missions right now</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browse the "Emergencies Needing Help" tab to accept a task.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setActiveTab('available')}
                  className="bg-primary text-primary-foreground font-bold text-xs"
                >
                  Find Open Requests
                </Button>
              </div>
            ) : (
              myMissions.map((mission) => {
                const meta = CATEGORY_META[mission.category] || CATEGORY_META.rescue;
                const Icon = meta.icon;
                const coords = getCoords(mission, region);
                const gmapsUrl = buildGoogleMapsUrl({
                  coords,
                  query: mission.locationDescription || mission.title,
                });

                return (
                  <div
                    key={mission.id}
                    className="p-5 rounded-2xl border-2 border-emerald-500/40 bg-card space-y-4 shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold uppercase', meta.bg, meta.color, 'border', meta.border)}>
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                        <Badge variant="outline" className="border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold text-xs">
                          🤝 Mission In Progress
                        </Badge>
                      </div>

                      <span className="text-xs text-muted-foreground font-mono">
                        Target Area: {mission.locationDescription || locationLabel}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        {mission.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {mission.details}
                      </p>
                    </div>

                    {mission.contactPhone && (
                      <div className="p-3 rounded-xl bg-secondary/40 border border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Recipient Contact:</span>
                        <a href={`tel:${mission.contactPhone}`} className="font-bold text-sky-400 hover:underline flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{mission.contactPhone}</span>
                        </a>
                      </div>
                    )}

                    {/* Action Row */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {gmapsUrl && (
                        <a
                          href={gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all text-center"
                        >
                          <Navigation className="h-4 w-4" />
                          <span>📍 Turn-by-Turn Directions</span>
                        </a>
                      )}

                      <Button
                        onClick={() => handleCompleteMission(mission.id)}
                        className="flex-1 min-w-[140px] h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md"
                      >
                        <Check className="h-4 w-4 mr-1.5" />
                        Mark as Completed
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
