import { useState } from 'react';
import {
  Siren,
  Building2,
  Wifi,
  WifiOff,
  Search,
  HardDrive,
  Users,
  Settings,
  Activity,
  Map,
  Shield,
  Layers,
  LifeBuoy,
  Radio,
  ChevronDown,
  User,
  HeartPulse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AppNavRoute, UserRole } from '@/types';
import { USER_ROLES } from '@/types';
import type { NetworkStatus } from '@/hooks/use-network';
import type { MapRegion } from '@/components/map-view';

interface AppNavProps {
  currentRoute: AppNavRoute;
  onRouteChange: (route: AppNavRoute) => void;
  status: NetworkStatus;
  queueCount: number;
  userRole: UserRole;
  region: MapRegion;
  locationLabel: string;
  onOpenSos: () => void;
  onOpenSyncModal: () => void;
  onOpenProfileModal: () => void;
  onOpenTriage?: () => void;
}

export function AppNav({
  currentRoute,
  onRouteChange,
  status,
  queueCount,
  userRole,
  region,
  locationLabel,
  onOpenSos,
  onOpenSyncModal,
  onOpenProfileModal,
  onOpenTriage,
}: AppNavProps) {
  const isOnline = status === 'online';
  const roleMeta = USER_ROLES[userRole];

  // Route definitions with icon & role restriction check
  const NAV_ITEMS: { id: AppNavRoute; label: string; icon: typeof Map }[] = [
    { id: 'home', label: 'Home', icon: Shield },
    { id: 'map', label: 'Live Map', icon: Map },
    { id: 'operations', label: 'Operations', icon: Activity },
    { id: 'shelters', label: 'Shelters', icon: Building2 },
    { id: 'resources', label: 'Resources', icon: LifeBuoy },
    { id: 'volunteer', label: 'Volunteers', icon: Users },
  ];

  // Filter routes allowed for current role
  const allowedNavItems = NAV_ITEMS.filter((item) =>
    roleMeta.allowedRoutes.includes(item.id)
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex h-16 max-w-[1700px] items-center justify-between px-3 sm:px-6 gap-3">
        {/* Left: Brand Identity & Descriptor */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onRouteChange('home')}
            className="flex items-center gap-2.5 text-left group focus-visible:ring-2 focus-visible:ring-primary rounded-xl p-1"
            aria-label="ResQLink Home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <Shield className="h-5 w-5" />
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-foreground leading-none">
                  ResQLink
                </span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-secondary text-primary font-bold">
                  LOCAL
                </span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5 max-w-[210px] truncate">
                Disaster Response Mesh
              </span>
            </div>
          </button>
        </div>

        {/* Center: Primary Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {allowedNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onRouteChange(item.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all outline-none',
                  'focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-secondary text-primary font-bold border border-primary/30 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Telemetry Indicators, Role & Emergency Action */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Connectivity & Outbox Badge */}
          <button
            type="button"
            onClick={onOpenSyncModal}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold transition-all',
              'focus-visible:ring-2 focus-visible:ring-primary',
              isOnline
                ? 'bg-success/10 border-success/30 text-success hover:bg-success/15'
                : 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/15'
            )}
            title="Open Sync & Telemetry Status"
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                isOnline ? 'bg-success' : 'bg-warning'
              )}
            />
            <span className="hidden sm:inline">
              {isOnline ? 'MESH LIVE' : 'OFFLINE'}
            </span>
            {queueCount > 0 && (
              <span className="rounded-full bg-alert text-white px-1.5 py-0 text-[9px] font-bold">
                {queueCount}
              </span>
            )}
          </button>

          {/* Active Role Switcher Pill */}
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card/60 text-xs hover:bg-secondary transition-colors"
            title="Switch User Role & Profile"
          >
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground text-[11px] font-mono">
              {roleMeta.badge}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {/* Settings button on mobile */}
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="sm:hidden p-2 rounded-lg border border-border bg-card/60 text-muted-foreground hover:text-foreground"
            aria-label="Profile and Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Primary Action: Emergency SOS Button */}
          <Button
            onClick={onOpenSos}
            className="bg-alert text-white font-extrabold hover:bg-alert/90 shadow-md shadow-alert/25 h-9 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-mono tracking-wide transition-transform active:scale-95"
            aria-label="Trigger Emergency SOS"
          >
            <Siren className="h-4 w-4 mr-1.5 animate-pulse" />
            <span>SOS</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
