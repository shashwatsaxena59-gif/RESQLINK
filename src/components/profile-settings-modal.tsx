import { useState } from 'react';
import {
  User,
  Shield,
  MapPin,
  Moon,
  Sun,
  HardDrive,
  Check,
  CheckCircle2,
  Users,
  Building2,
  Activity,
  LogOut,
  RotateCcw,
  Sparkles,
  KeyRound,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { USER_ROLES } from '@/types';
import type { UserRole } from '@/types';
import type { MapRegion } from '@/components/map-view';
import { authClient, DEMO_ACCOUNTS } from '@/auth/auth-client';
import { toast } from 'sonner';

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
  onRoleChange: (r: UserRole) => void;
  region: MapRegion;
  onRegionChange: (r: MapRegion) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRestoreRequests?: () => void;
  ngoSessionName?: string;
  onLogoutNgo?: () => void;
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
  role,
  onRoleChange,
  region,
  onRegionChange,
  theme,
  onToggleTheme,
  onRestoreRequests,
  ngoSessionName,
  onLogoutNgo,
}: ProfileSettingsModalProps) {
  const currentRoleMeta = USER_ROLES[role];

  const handleSelectRole = async (r: UserRole) => {
    onRoleChange(r);
    const authRole = r === 'citizen' ? 'requester' : r;
    await authClient.switchDemoRole(authRole as any);
    toast.success(`Switched role to ${USER_ROLES[r].label}`, {
      description: USER_ROLES[r].tagline,
    });
  };

  const handleSelectRegion = (reg: MapRegion) => {
    onRegionChange(reg);
    toast.success(`Active region changed to ${reg === 'ncr' ? 'Delhi NCR' : 'Badrinath / Joshimath'}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-secondary/40 border-b border-border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md">
                <User className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  User Role & System Preferences
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  RESQLINK_PROFILE_CONFIGURATION
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
              {currentRoleMeta.badge}
            </Badge>
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Active Role Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                Active Operational Role
              </span>
              <span className="text-[11px] text-muted-foreground">Select role to preview tailored views</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(USER_ROLES) as UserRole[]).map((r) => {
                const meta = USER_ROLES[r];
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={cn(
                      'text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-background/50 hover:bg-secondary/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className={cn('text-xs font-bold', isSelected ? 'text-primary' : 'text-foreground')}>
                        {meta.label}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {meta.tagline}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Regional Territory */}
          <div>
            <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono block mb-2">
              Disaster Operations Region
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectRegion('ncr')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all',
                  region === 'ncr'
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background/50 hover:bg-secondary/40'
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">Delhi NCR</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Delhi · Noida · Gurugram
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRegion('badrinath')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all',
                  region === 'badrinath'
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background/50 hover:bg-secondary/40'
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MapPin className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-bold text-foreground">Joshimath</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Chamoli · Uttarakhand
                </p>
              </button>
            </div>
          </div>

          {/* Interface Appearance */}
          <div className="rounded-xl border border-border bg-background/50 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-foreground block">Visual Theme</span>
              <span className="text-[11px] text-muted-foreground">
                Optimized for tactical low-light emergency visibility
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onToggleTheme}
              className="gap-2 h-8 text-xs font-mono"
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-primary" />
                  Deep Charcoal
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-warning" />
                  Daylight Mode
                </>
              )}
            </Button>
          </div>

          {/* Authenticated Sessions */}
          {ngoSessionName && (
            <div className="rounded-xl border border-info/30 bg-info/5 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-info block">Authenticated NGO Session</span>
                <span className="text-[11px] text-muted-foreground font-mono">{ngoSessionName}</span>
              </div>
              {onLogoutNgo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogoutNgo}
                  className="h-7 text-xs text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-3 w-3 mr-1" />
                  Log Out
                </Button>
              )}
            </div>
          )}

          {/* Demo Mode Test Personas & Credentials */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wide">
                Demo Mode Test Accounts & Roles
              </span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary">
                PRE-SEEDED
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Test server-enforced role permissions with pre-configured accounts. Passwords are saved in{' '}
              <code className="text-[10px] font-mono bg-secondary px-1 py-0.5 rounded">server/data/users-store.json</code>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {DEMO_ACCOUNTS.map((acc) => {
                const targetRole: UserRole = acc.role === 'requester' ? 'citizen' : (acc.role as UserRole);
                const isActive = role === targetRole;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectRole(targetRole)}
                    className={cn(
                      'text-left p-2.5 rounded-lg border text-xs transition-all flex flex-col justify-between',
                      isActive
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-background/60 hover:bg-secondary/40'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-foreground text-[11px]">{acc.name}</span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                          {acc.role}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{acc.email}</div>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-primary flex items-center justify-between border-t border-border/40 pt-1">
                      <span>Pass: {acc.password}</span>
                      <span className="font-bold">{isActive ? 'ACTIVE' : 'SWITCH →'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Truthful Safety & Privacy Disclaimer */}
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                Truthful Safety & Privacy Disclaimer
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Emergency Dispatch:</strong> ResQLink is a community mutual-aid coordination platform. It does{' '}
              <strong>NOT</strong> provide official 911 / 112 emergency dispatch, guaranteed rescue, or SMS verification.
              In life-threatening situations, always contact official authorities directly.
            </p>
            <p className="text-[10px] text-muted-foreground/80 font-mono">
              <strong>Privacy Protection:</strong> Precise GPS coordinates and confidential medical notes are restricted
              to authorized responders and coordinators. Demo actions are simulated drills.
            </p>
          </div>

          {/* Drill Data Controls */}
          {onRestoreRequests && (
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground block">Reset Drill Data</span>
                <span className="text-[10px] text-muted-foreground">
                  Restore resolved incidents to initial simulation state
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRestoreRequests}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reset Simulated Feed
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-secondary/30 border-t border-border p-4 flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-xs h-9 px-5"
          >
            Apply & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
