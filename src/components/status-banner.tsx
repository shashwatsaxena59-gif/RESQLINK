import {
  AlertTriangle, MapPin, Radio, Map,
  Activity, BedDouble, Users, Flame, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FILTER_TABS } from '@/types';
import type { FilterCategory } from '@/types';
import { REGION_ZONES } from '@/mockData';
import type { MapRegion } from '@/components/map-view';

interface StatusBannerProps {
  activeFilter: FilterCategory;
  onFilterChange: (f: FilterCategory) => void;
  requestCount: number;
  region: MapRegion;
  onRegionChange: (r: MapRegion) => void;
}

const REGION_OPTIONS: { value: MapRegion; label: string; shortLabel: string; flag: string }[] = [
  { value: 'ncr',       label: 'Delhi NCR',             shortLabel: 'Delhi NCR',   flag: '🏙️' },
  { value: 'badrinath', label: 'Chamoli, Uttarakhand', shortLabel: 'Chamoli',   flag: '🏔️' },
];

/* Category icons for filter chips */
const TAB_ICONS: Record<string, React.ReactNode> = {
  all:        <Activity   className="h-4 w-4" />,
  medical:    <Flame      className="h-4 w-4" />,
  food:       <Users      className="h-4 w-4" />,
  shelter:    <BedDouble  className="h-4 w-4" />,
  volunteers: <Users      className="h-4 w-4" />,
};

export function StatusBanner({
  activeFilter,
  onFilterChange,
  requestCount,
  region,
  onRegionChange,
}: StatusBannerProps) {
  const info = REGION_ZONES[region];
  const criticalCount = Math.max(1, Math.round(requestCount * 0.3));

  return (
    <section className="w-full p-4 sm:p-6 flex flex-col gap-6 bg-transparent">
      {/* Sector Switcher Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Command Sector</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/10 rounded-2xl flex-wrap">
            {REGION_OPTIONS.map((opt) => {
              const isActive = region === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onRegionChange(opt.value)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 justify-center sm:flex-none sm:justify-start',
                    isActive
                      ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.2)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
                  )}
                >
                  {isActive && <span className="w-2 h-2 rounded-full bg-alert animate-ping shadow-[0_0_10px_hsl(var(--alert))]"></span>}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
          <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/10 rounded-2xl text-foreground text-xs font-bold">
            <Radio className="h-4 w-4 text-success animate-pulse" />
            <span>Active Sector</span>
          </div>
        </div>
      </div>

      {/* Holographic KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <KpiCard
          value={requestCount}
          label="Total Requests"
          icon={<Activity className="h-5 w-5 text-primary" />}
          valueClass="text-foreground"
          subtitle="Active Triage"
          subClass="text-primary"
          bgClass="bg-primary/10"
          borderClass="border-primary/20"
        />
        <KpiCard
          value={criticalCount}
          label="Critical SOS"
          icon={<AlertTriangle className="h-5 w-5 text-alert" />}
          valueClass="text-foreground drop-shadow-[0_0_8px_hsl(var(--alert))] text-alert"
          subtitle="Pending Rescue"
          subClass="text-alert"
          bgClass="bg-alert/10"
          borderClass="border-alert/30"
          glowClass="shadow-[0_0_20px_hsl(var(--alert)/0.15)]"
        />
        <KpiCard
          value={info.stats.shelterCount}
          label="Shelters Open"
          icon={<BedDouble className="h-5 w-5 text-success" />}
          valueClass="text-foreground text-success"
          subtitle="Regional Access"
          subClass="text-success"
          bgClass="bg-success/10"
          borderClass="border-success/20"
        />
        <KpiCard
          value={info.stats.responderCount}
          label="Responders"
          icon={<Users className="h-5 w-5 text-info" />}
          valueClass="text-foreground text-info"
          subtitle="Field Units"
          subClass="text-info"
          bgClass="bg-info/10"
          borderClass="border-info/20"
        />
      </div>

      {/* 3D Filter Tabs */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Resource Filter</h2>
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onFilterChange(tab.id)}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border',
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-[0_4px_20px_hsl(var(--primary)/0.4)] scale-105 z-10'
                    : 'bg-black/40 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground'
                )}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {TAB_ICONS[tab.id]}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  value,
  label,
  icon,
  valueClass,
  subtitle,
  subClass,
  bgClass,
  borderClass,
  glowClass,
}: {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  valueClass: string;
  subtitle: string;
  subClass: string;
  bgClass: string;
  borderClass: string;
  glowClass?: string;
}) {
  return (
    <div 
      className={cn(
        'relative flex flex-col gap-3 p-4 bg-black/40 backdrop-blur-md rounded-2xl border transition-all duration-200 hover:scale-[1.03] hover:-translate-y-0.5 cursor-default',
        borderClass,
        glowClass
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10',
          bgClass
        )}>
          {icon}
        </div>
        <span className={cn('text-[9px] font-black uppercase tracking-widest', subClass)}>
          {subtitle}
        </span>
      </div>
      <div>
        <div className={cn('text-3xl font-black tracking-tighter leading-none', valueClass)}>
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-semibold tracking-wide uppercase">{label}</p>
      </div>
    </div>
  );
}
