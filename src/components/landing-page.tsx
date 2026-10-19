import {
  Siren,
  LifeBuoy,
  Users,
  Building2,
  HardDrive,
  WifiOff,
  Radio,
  MapPin,
  ShieldCheck,
  ArrowRight,
  HeartPulse,
  Droplets,
  BedDouble,
  Clock,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MapRegion } from '@/components/map-view';
import type { AidRequest, Shelter, Volunteer, Resource } from '@/types';

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
  onExploreMap: () => void;
  onOpenShelters: () => void;
  onOpenResources: () => void;
  onOpenOperations: () => void;
  onOpenSync: () => void;
}

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
  onExploreMap,
  onOpenShelters,
  onOpenResources,
  onOpenOperations,
  onOpenSync,
}: LandingPageProps) {
  const criticalCount = requests.filter((r) => r.priority === 'critical').length;
  const totalFreeBeds = shelters.reduce(
    (acc, s) => acc + (s.capacity - s.occupied),
    0
  );
  const openSheltersCount = shelters.filter((s) => s.status === 'open').length;
  const activeVolunteersCount = volunteers.filter((v) => v.available).length;

  return (
    <div className="w-full flex flex-col space-y-16 py-6 px-4 sm:px-6 lg:px-8 max-w-[1500px] mx-auto animate-fade-in">
      {/* ── 1. Hero Section ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10 lg:p-14 shadow-xl">
        {/* Subtle tactical grid background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 max-w-4xl space-y-6">
          {/* Brand Badge & Descriptor */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-mono font-bold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping-slow" />
              ResQLink
            </div>
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              Local Disaster Response & Peer-to-Peer Resource Matcher
            </span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Immediate Community Aid & Resource Coordination{' '}
            <span className="text-primary block mt-1">When Networks Fail.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            When cellular towers lose power and emergency switchboards are overloaded,
            ResQLink operates locally through cached vector cartography, peer-to-peer
            mesh synchronization, and zero-cloud offline outboxes.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Primary Action: Request Emergency Help */}
            <Button
              size="lg"
              onClick={onRequestHelp}
              className="bg-primary text-primary-foreground font-extrabold hover:bg-primary/90 shadow-lg shadow-primary/20 text-sm sm:text-base h-12 px-6 rounded-xl transition-transform active:scale-95"
            >
              <Siren className="h-5 w-5 mr-2 text-primary-foreground" />
              Request Emergency Help
            </Button>

            {/* Secondary Action: Become a Volunteer */}
            <Button
              size="lg"
              variant="outline"
              onClick={onBecomeVolunteer}
              className="border-border bg-secondary/50 hover:bg-secondary text-foreground font-bold text-sm sm:text-base h-12 px-6 rounded-xl transition-all"
            >
              <Users className="h-4 w-4 mr-2 text-primary" />
              Become a Volunteer
            </Button>

            {/* Tertiary Link: Explore Shelters & Live Map */}
            <Button
              size="lg"
              variant="ghost"
              onClick={onExploreMap}
              className="text-muted-foreground hover:text-foreground text-sm sm:text-base h-12 px-4 font-mono font-semibold"
            >
              Explore Shelters & Map <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Tactical Telemetry Strip in Hero bottom */}
        <div className="relative z-10 mt-10 pt-6 border-t border-border/80 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Active Territory
            </span>
            <span className="text-sm font-bold text-foreground mt-0.5 block truncate">
              {locationLabel}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Network Mode
            </span>
            <span
              className={cn(
                'text-sm font-bold mt-0.5 flex items-center gap-1.5',
                isOnline ? 'text-success' : 'text-warning'
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  isOnline ? 'bg-success' : 'bg-warning'
                )}
              />
              {isOnline ? 'Mesh Online' : 'Offline Cached'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Critical Incidents
            </span>
            <span className="text-sm font-bold text-alert mt-0.5 block">
              {criticalCount} Active
            </span>
          </div>

          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Verified Free Beds
            </span>
            <span className="text-sm font-bold text-info mt-0.5 block">
              {totalFreeBeds} Beds Open
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. Offline Capability Indicator (Dedicated Architecture Card) ── */}
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
                Offline Capability Architecture
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Zero Cloud Dependency for Immediate Safety
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              ResQLink caches its entire vector cartography, emergency directory, and
              incident database directly into your browser’s IndexedDB storage. You can
              submit SOS alerts, locate open shelters, and calculate nearest safe routes
              with airplane mode active.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="p-3 rounded-xl border border-border bg-card/60 text-center min-w-[110px]">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                Local Map
              </span>
              <span className="text-xs font-bold font-mono text-success mt-0.5 block">
                100% Vector
              </span>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card/60 text-center min-w-[110px]">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                Storage
              </span>
              <span className="text-xs font-bold font-mono text-primary mt-0.5 block">
                IndexedDB
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSync}
              className="text-xs font-mono h-10 border-border"
            >
              Inspect Outbox & Telemetry
            </Button>
          </div>
        </div>
      </section>

      {/* ── 3. How the Platform Works (4 Tactical Steps) ── */}
      <section className="space-y-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
            Operational Lifecycle
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1 tracking-tight">
            How ResQLink Works During a Blackout
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 relative flex flex-col justify-between">
            <span className="text-3xl font-extrabold font-mono text-border/70">
              01
            </span>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                Report Without Cellular
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Victims broadcast needs via voice or text. The report is cryptographically
                assigned a local tracking ID and buffered in the persistent outbox.
              </p>
            </div>
            <Badge variant="outline" className="w-fit font-mono text-[10px] border-border">
              Local Outbox
            </Badge>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 relative flex flex-col justify-between">
            <span className="text-3xl font-extrabold font-mono text-border/70">
              02
            </span>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                Proximity Vector Matching
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Client-side Haversine trigonometry calculates nearest verified shelters,
                potable water taps, and emergency medical stations instantly.
              </p>
            </div>
            <Badge variant="outline" className="w-fit font-mono text-[10px] border-border">
              Offline GIS Math
            </Badge>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 relative flex flex-col justify-between">
            <span className="text-3xl font-extrabold font-mono text-border/70">
              03
            </span>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                Volunteer Field Dispatch
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nearby registered volunteers claim urgent rescue tasks atomically,
                preventing duplicate missions and coordinating supply transport.
              </p>
            </div>
            <Badge variant="outline" className="w-fit font-mono text-[10px] border-border">
              Atomic Assignment
            </Badge>
          </div>

          {/* Step 4 */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 relative flex flex-col justify-between">
            <span className="text-3xl font-extrabold font-mono text-border/70">
              04
            </span>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                Reconciliation & Confirmation
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When network signals or local emergency Wi-Fi beacons return, outbox queues
                reconcile across all responder devices automatically.
              </p>
            </div>
            <Badge variant="outline" className="w-fit font-mono text-[10px] border-border">
              Two-Way Sync
            </Badge>
          </div>
        </div>
      </section>

      {/* ── 4. The Three Pillars: Volunteers, Shelters, and Local Resources ── */}
      <section className="space-y-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
            Community Network
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1 tracking-tight">
            Local Emergency Response Infrastructure
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1: Volunteers */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Community Volunteers
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                First responders, boat operators, licensed nurses, and neighborhood
                helpers mobilized to transport supplies and extract stranded families.
              </p>
              <div className="pt-2 font-mono text-xs text-foreground font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                {activeVolunteersCount} Active Personnel Nearby
              </div>
            </div>

            <Button
              variant="outline"
              onClick={onBecomeVolunteer}
              className="w-full mt-4 border-border text-xs font-bold"
            >
              Register as Volunteer <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          {/* Pillar 2: Shelters */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-info/10 border border-info/30 flex items-center justify-center text-info font-bold">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Emergency Shelters
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Community centers, high-ground schools, and disaster relief facilities
                with monitored bed capacities, hot meals, and power generator access.
              </p>
              <div className="pt-2 font-mono text-xs text-foreground font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-info" />
                {openSheltersCount} Shelters Open ({totalFreeBeds} Free Beds)
              </div>
            </div>

            <Button
              variant="outline"
              onClick={onOpenShelters}
              className="w-full mt-4 border-border text-xs font-bold"
            >
              View Shelter Directory <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          {/* Pillar 3: Local Resources */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-center text-warning font-bold">
                <Droplets className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Critical Local Resources
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Potable drinking water points, medical clinics, ration distribution
                sites, and equipment sharing hubs mapped in real-time.
              </p>
              <div className="pt-2 font-mono text-xs text-foreground font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-warning" />
                {resources.length} Verified Facilities Listed
              </div>
            </div>

            <Button
              variant="outline"
              onClick={onOpenResources}
              className="w-full mt-4 border-border text-xs font-bold"
            >
              Browse Resource Map <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── 5. Quick Operations Jump Banner ── */}
      <section className="rounded-2xl border border-border bg-secondary/30 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase text-muted-foreground">
            Disaster Management & NGOs
          </span>
          <h3 className="text-base font-bold text-foreground">
            Are you a disaster coordinator or shelter administrator?
          </h3>
          <p className="text-xs text-muted-foreground">
            Access the Operations Command Center for dispatch rosters, bottleneck heatmaps, and verification.
          </p>
        </div>

        <Button
          onClick={onOpenOperations}
          className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-xs font-mono h-10 px-5 shrink-0"
        >
          Open Operations Center <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </section>
    </div>
  );
}
