import {
  Siren, Building2, Wifi, WifiOff, Power, Search,
  BadgeCheck, Sun, Moon, Brain, ShieldAlert,
  Users, Menu, CheckCircle2, Shield
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { NetworkStatus } from '@/hooks/use-network';

interface TopNavProps {
  status: NetworkStatus;
  onToggleNetwork: () => void;
  onSos: () => void;
  onShelter: () => void;
  onFindHelp: () => void;
  onOfferHelp: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onTriage?: () => void;
  onNgoPortal?: () => void;
  ngoLoggedIn?: boolean;
  volunteerLoggedIn?: boolean;
  ngoName?: string;
}

export function TopNav({
  status, onToggleNetwork, onSos, onShelter,
  onFindHelp, onOfferHelp, theme, onToggleTheme, onTriage,
  onNgoPortal, ngoLoggedIn, volunteerLoggedIn, ngoName,
}: TopNavProps) {
  const isOnline = status === 'online';
  const isNgoActive = ngoLoggedIn || volunteerLoggedIn;

  return (
    <header className="sticky top-0 z-50 p-3 sm:p-4 pointer-events-none w-full max-w-[1800px] mx-auto">
      <div className="flex flex-col gap-2 pointer-events-auto">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4 rounded-3xl bg-card/50 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-4 sm:px-6 py-3 min-h-[64px]">
          {/* Logo & Brand */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary))] ring-1 ring-white/20">
                <Shield className="h-5 w-5 text-primary-foreground font-bold" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground leading-none drop-shadow-md">
                  ResQLink
                </span>
                <span className="text-[10px] tracking-[0.2em] text-primary uppercase font-bold mt-1 drop-shadow-[0_0_8px_hsl(var(--primary))]">
                  Command Grid
                </span>
              </div>
            </div>
          </div>

          {/* Network Status & Center Nav (Hidden on very small screens, visible on md+) */}
          <div className="hidden md:flex items-center gap-4 xl:gap-8 flex-1 justify-center">
             <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold shadow-inner',
              isOnline 
                ? 'bg-success/15 border-success/30 text-success shadow-[0_0_10px_hsl(var(--success)/0.2)]'
                : 'bg-warning/15 border-warning/30 text-warning shadow-[0_0_10px_hsl(var(--warning)/0.2)]'
            )}>
              <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-75',
                  isOnline ? 'bg-success animate-ping' : 'bg-warning animate-ping'
                )}></span>
                <span className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  isOnline ? 'bg-success' : 'bg-warning'
                )}></span>
              </div>
              <span>{isOnline ? 'LIVE NETWORK' : 'OFFLINE SYNC'}</span>
            </div>

            <nav className="flex items-center gap-1">
              <NavButton onClick={onFindHelp} label="Live Map" isActive />
              <NavButton onClick={onOfferHelp} label="Offer Resources" />
              <NavButton onClick={onShelter} label="Shelters" />
              {onTriage && <NavButton onClick={onTriage} label="AI Triage" />}
              {onNgoPortal && (
                <NavButton 
                  onClick={onNgoPortal} 
                  label={isNgoActive ? (ngoName ? ngoName.split(' ')[0] : 'NGO') : 'NGO Portal'} 
                />
              )}
            </nav>
          </div>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 hover:bg-secondary text-foreground cursor-pointer transition-colors bg-secondary/30 backdrop-blur-md"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-primary" />}
            </button>

            {/* Network Toggle */}
            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 hover:bg-secondary text-foreground cursor-pointer transition-colors bg-secondary/30 backdrop-blur-md">
              <Switch
                checked={isOnline}
                onCheckedChange={onToggleNetwork}
                aria-label="Toggle network"
                className="scale-75"
              />
            </div>

            {/* SOS Dispatch Button */}
            <button
              onClick={onSos}
              className="group flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl bg-alert text-alert-foreground text-sm font-extrabold shadow-[0_0_20px_hsl(var(--alert)/0.5)] hover:bg-alert/90 hover:scale-105 active:scale-95 transition-all ring-1 ring-white/20"
            >
              <Siren className="h-4 w-4 animate-pulse" />
              <span className="tracking-wide hidden sm:inline">SOS DISPATCH</span>
              <span className="tracking-wide sm:hidden">SOS</span>
            </button>
            
            {/* Mobile Menu */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-secondary/30 backdrop-blur-md hover:bg-secondary transition-colors text-foreground">
                    <Menu className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card/90 backdrop-blur-xl border-white/10 p-2 shadow-2xl rounded-2xl">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1.5">
                    Command Options
                  </DropdownMenuLabel>
                  <MobileMenuItem onClick={onFindHelp} icon={<Search className="h-4 w-4 text-info" />} label="Live Map" />
                  <MobileMenuItem onClick={onOfferHelp} icon={<BadgeCheck className="h-4 w-4 text-success" />} label="Offer Resources" />
                  <MobileMenuItem onClick={onShelter} icon={<Building2 className="h-4 w-4 text-info" />} label="Shelters" />
                  {onTriage && <MobileMenuItem onClick={onTriage} icon={<Brain className="h-4 w-4 text-warning" />} label="AI Triage" />}
                  {onNgoPortal && <MobileMenuItem onClick={onNgoPortal} icon={<Users className="h-4 w-4 text-primary" />} label="NGO Portal" />}
                  
                  <DropdownMenuSeparator className="my-1 border-white/10" />
                  <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-secondary/50">
                    <span className="flex items-center gap-2 text-muted-foreground font-medium">
                      <Power className="h-4 w-4" />
                      <span>Network</span>
                    </span>
                    <Switch checked={isOnline} onCheckedChange={onToggleNetwork} className="scale-75" />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Critical Advisory Ribbon */}
        <div className="rounded-2xl bg-alert/20 backdrop-blur-xl border border-alert/30 flex items-center justify-between text-foreground px-4 py-2.5 shadow-[0_0_15px_hsl(var(--alert)/0.15)] flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto flex-1">
            <span className="flex h-3 w-3 rounded-full bg-alert shadow-[0_0_10px_hsl(var(--alert))] animate-pulse shrink-0"></span>
            <span className="text-[10px] sm:text-xs font-black text-alert uppercase tracking-widest shrink-0">CRITICAL ADVISORY</span>
            <span className="hidden sm:inline text-alert/50 font-light shrink-0">|</span>
            <span className="text-xs sm:text-sm text-foreground truncate font-semibold drop-shadow-md">
              Active Disaster Zone: Yamuna Basin / NCR • Flood Relief Protocol Alpha
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <span className="px-3 py-1 rounded-lg bg-black/40 border border-white/10 text-foreground text-[10px] sm:text-xs font-bold tracking-wide">Sector 4-A</span>
            <span className="px-3 py-1 rounded-lg bg-alert border border-alert text-alert-foreground text-[10px] sm:text-xs font-black tracking-widest shadow-[0_0_10px_hsl(var(--alert)/0.5)]">HIGH SURGE</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavButton({
  onClick, label, isActive = false,
}: {
  onClick: () => void;
  label: string;
  isActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 font-bold',
        isActive 
          ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.2)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent'
      )}
    >
      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_hsl(var(--primary))]"></span>}
      <span>{label}</span>
    </button>
  );
}

function MobileMenuItem({
  onClick, icon, label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className="flex items-center gap-3 py-3 px-3 text-sm font-bold cursor-pointer rounded-xl hover:bg-secondary/60 focus:bg-secondary/60 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </DropdownMenuItem>
  );
}
