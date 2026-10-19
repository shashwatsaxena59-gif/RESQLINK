import { Map, ListChecks, Siren, Building2, Shield, Activity, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppNavRoute } from '@/types';

export type MobileTab = 'home' | 'map' | 'operations' | 'shelters' | 'sos';

interface MobileNavProps {
  active: AppNavRoute;
  onChange: (route: AppNavRoute) => void;
  onSos: () => void;
}

export function MobileNav({ active, onChange, onSos }: MobileNavProps) {
  const TABS: { id: MobileTab; label: string; icon: typeof Map }[] = [
    { id: 'home',       label: 'Home',       icon: Shield },
    { id: 'map',        label: 'Map',        icon: Map },
    { id: 'sos',        label: 'SOS',        icon: Siren },
    { id: 'operations', label: 'Command',    icon: Activity },
    { id: 'shelters',   label: 'Shelters',   icon: Building2 },
  ];

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        'border-t border-border bg-background/95 backdrop-blur-xl shadow-lg',
      )}
    >
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-1 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {TABS.map((tab) => {
          /* ── Centered SOS button ── */
          if (tab.id === 'sos') {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={onSos}
                className="relative -mt-5 flex h-[46px] w-[46px] flex-col items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
                aria-label="Post SOS emergency request"
              >
                {/* Glow ring */}
                <span className="absolute inset-0 -m-1.5 rounded-full bg-alert/20 animate-ping-slow pointer-events-none" />
                {/* Button circle */}
                <span
                  className={cn(
                    'relative flex h-13 w-13 items-center justify-center rounded-full',
                    'bg-alert text-white shadow-lg shadow-alert/30',
                    'ring-4 ring-background',
                    'transition-transform active:scale-90',
                  )}
                >
                  <Siren className="h-6 w-6 animate-pulse" />
                </span>
                <span className="mt-1 text-[9px] font-mono font-extrabold tracking-wide text-alert">
                  SOS
                </span>
              </button>
            );
          }

          /* ── Regular nav items ── */
          const Icon = tab.icon;
          const isActive = active === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id as AppNavRoute)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-1',
                'min-h-[44px] justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg',
                'transition-all active:scale-95',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-11 items-center justify-center rounded-lg transition-all',
                  isActive
                    ? 'bg-secondary text-primary font-bold border border-primary/25'
                    : 'bg-transparent',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  'text-[10px] transition-all font-mono',
                  isActive ? 'font-bold text-foreground' : 'font-medium',
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
