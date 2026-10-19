/**
 * ngo-dashboard.tsx
 *
 * Full NGO Dashboard rendered as a Sheet (slide-over panel) so it sits
 * on top of the existing ResQLink map without replacing it.
 *
 * Sections:
 *   Overview   — stat cards
 *   Volunteers — member list + add volunteer form
 *   Operations — active / awaiting-confirmation tasks
 *   History    — RESCUED tasks
 */

import { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Badge }    from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2, Users, Activity, History,
  UserPlus, Trash2, RefreshCw, LogOut, Loader2,
  AlertCircle, CheckCircle2, Clock, MapPin, AlertTriangle,
  BarChart3, UserCheck, UserX, Phone, Mail, Briefcase,
  ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { cn }  from '@/lib/utils';
import { useNgoData } from '@/hooks/use-ngo-data';
import { RescueTaskCard } from '@/components/rescue-task-card';
import { RescueConfirmationModal } from '@/components/rescue-confirmation-modal';
import { clearNgoSession } from '@/lib/ngo-auth';
import {
  VOLUNTEER_MEMBER_STATUS_META,
  RESCUE_TASK_STATUS_META,
} from '@/types';
import type {
  NgoProfile,
  VolunteerMember,
  VolunteerMemberStatus,
  RescueTask,
} from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: number | string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'success' | 'warning' | 'info' | 'alert' | 'muted';
}) {
  const colorMap = {
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    info:    'text-info bg-info/10',
    alert:   'text-alert bg-alert/10',
    muted:   'text-muted-foreground bg-muted/30',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className={cn('rounded-xl p-2.5', accent ? colorMap[accent] : colorMap.muted)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-foreground">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  );
}

// ── Volunteer Row ─────────────────────────────────────────────────────────────

function VolunteerRow({
  vol, tasks, onRemove, onStatusChange, removing,
}: {
  vol: VolunteerMember;
  tasks: RescueTask[];
  onRemove: () => void;
  onStatusChange: (s: VolunteerMemberStatus) => void;
  removing: boolean;
}) {
  const meta   = VOLUNTEER_MEMBER_STATUS_META[vol.status];
  const active = tasks.find((t) => t.id === vol.currentTaskId);
  const [expanded, setExpanded] = useState(false);

  const statusCycle: VolunteerMemberStatus[] = ['AVAILABLE', 'ON_MISSION', 'OFFLINE'];
  const nextStatus = statusCycle[(statusCycle.indexOf(vol.status) + 1) % statusCycle.length];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar dot */}
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
          {vol.fullName.charAt(0).toUpperCase()}
          <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card', meta.dot)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground text-sm">{vol.fullName}</span>
            <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold', meta.bg, meta.text)}>
              {meta.label}
            </span>
          </div>
          {active ? (
            <p className="mt-0.5 text-xs text-warning truncate">
              On task: {active.title}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {vol.phone}{vol.email ? ` • ${vol.email}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Details"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onRemove}
            disabled={removing || vol.status === 'ON_MISSION'}
            className="rounded p-1.5 text-muted-foreground hover:bg-alert/10 hover:text-alert disabled:opacity-40"
            title={vol.status === 'ON_MISSION' ? 'Cannot remove a volunteer on mission' : 'Remove volunteer'}
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3 w-3" />{vol.phone}
            </div>
            {vol.email && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3 w-3" />{vol.email}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
              <Clock className="h-3 w-3" />Joined {timeAgo(vol.joinedAt)}
            </div>
          </div>
          {vol.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {vol.skills.map((s) => (
                <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{s}</span>
              ))}
            </div>
          )}
          {/* Quick status change */}
          {vol.status !== 'ON_MISSION' && (
            <button
              onClick={() => onStatusChange(nextStatus)}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Mark as {VOLUNTEER_MEMBER_STATUS_META[nextStatus].label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Volunteer Form ────────────────────────────────────────────────────────

function AddVolunteerForm({
  ngoId,
  onAdd,
}: {
  ngoId: string;
  onAdd: (v: VolunteerMember) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState('');
  const [form, setForm]   = useState({
    fullName: '', phone: '', email: '', skills: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim()) {
      setErr('Full name and phone are required.'); return;
    }
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/ngo/${ngoId}/volunteers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngoId,
          fullName: form.fullName.trim(),
          phone:    form.phone.trim(),
          email:    form.email.trim(),
          skills:   form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add volunteer');
      setForm({ fullName: '', phone: '', email: '', skills: '' });
      setOpen(false);
      onAdd(data.volunteer as VolunteerMember);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add volunteer.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />Add Volunteer
      </Button>
    );
  }

  return (
    <form onSubmit={handleAdd} className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-primary" />New Volunteer
        </p>
        <button type="button" onClick={() => { setOpen(false); setErr(''); }}
          className="rounded p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="vol-name" className="text-xs">Full Name *</Label>
          <Input id="vol-name" value={form.fullName} onChange={set('fullName')} placeholder="Arjun Sharma" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vol-phone" className="text-xs">Phone *</Label>
          <Input id="vol-phone" value={form.phone} onChange={set('phone')} placeholder="+91 98100 00000" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vol-email" className="text-xs">Email</Label>
          <Input id="vol-email" type="email" value={form.email} onChange={set('email')} placeholder="volunteer@ngo.in" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vol-skills" className="text-xs">Skills (comma-separated)</Label>
          <Input id="vol-skills" value={form.skills} onChange={set('skills')} placeholder="Medical, Rescue, Driving" className="h-8 text-sm" />
        </div>
      </div>
      {err && <p className="flex items-center gap-1 text-xs text-alert"><AlertCircle className="h-3 w-3" />{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-8 text-xs" disabled={busy}>
          {busy ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Adding…</> : 'Add Volunteer'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setOpen(false); setErr(''); }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ ngo, stats, tasks, lastUpdated }: {
  ngo: Omit<NgoProfile, 'passwordHash'>;
  stats: ReturnType<typeof useNgoData>['stats'];
  tasks: RescueTask[];
  lastUpdated: number | null;
}) {
  const awaitingTasks = tasks.filter((t) => t.assignedNgoId === ngo.id && t.status === 'AWAITING_CONFIRMATION');

  return (
    <div className="space-y-4">
      {/* NGO profile card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            {ngo.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground">{ngo.name}</p>
            <p className="text-sm text-muted-foreground">{ngo.contactPerson}</p>
            {ngo.serviceArea && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />{ngo.serviceArea}
              </p>
            )}
          </div>
          <Badge variant="secondary" className={cn(
            'shrink-0 text-[10px]',
            ngo.verificationStatus === 'VERIFIED'
              ? 'bg-success/15 text-success'
              : 'bg-warning/15 text-warning',
          )}>
            {ngo.verificationStatus}
          </Badge>
        </div>
        {ngo.description && (
          <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
            {ngo.description}
          </p>
        )}
        {lastUpdated && (
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            Last synced: {timeAgo(lastUpdated)}
          </p>
        )}
      </div>

      {/* Awaiting confirmation alert */}
      {awaitingTasks.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{awaitingTasks.length} rescue{awaitingTasks.length > 1 ? 's' : ''} awaiting your confirmation</p>
            <p className="text-xs opacity-80">Switch to the Operations tab to review and confirm.</p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Volunteers"     value={stats.totalVolunteers}     icon={Users}       accent="muted"   />
        <StatCard label="Available"            value={stats.availableVolunteers} icon={UserCheck}   accent="success" />
        <StatCard label="On Mission"           value={stats.onMissionVolunteers} icon={Activity}    accent="warning" />
        <StatCard label="Active Rescues"       value={stats.activeRescues}       icon={AlertCircle} accent="alert"   />
        <StatCard label="Awaiting Confirm"     value={stats.awaitingConfirmation} icon={Clock}       accent="warning" />
        <StatCard label="Completed Rescues"    value={stats.completedRescues}    icon={CheckCircle2} accent="success" />
      </div>
    </div>
  );
}

// ── Volunteers Tab ────────────────────────────────────────────────────────────

function VolunteersTab({
  ngo, volunteers, tasks, onAdd, onRemove, onStatusChange,
}: {
  ngo: Omit<NgoProfile, 'passwordHash'>;
  volunteers: VolunteerMember[];
  tasks: RescueTask[];
  onAdd: (v: VolunteerMember) => void;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, s: VolunteerMemberStatus) => void;
}) {
  const [search,    setSearch]    = useState('');
  const [removing,  setRemoving]  = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  const filtered = volunteers.filter((v) =>
    v.fullName.toLowerCase().includes(search.toLowerCase()) ||
    v.phone.includes(search)
  );

  async function handleRemove(id: string) {
    setRemoving(id);
    try { await (async () => onRemove(id))(); }
    finally { setRemoving(null); }
  }

  async function handleStatusChange(id: string, s: VolunteerMemberStatus) {
    setStatusBusy(id);
    try { await (async () => onStatusChange(id, s))(); }
    finally { setStatusBusy(null); }
  }

  const byStatus: Record<VolunteerMemberStatus, VolunteerMember[]> = {
    AVAILABLE:  filtered.filter((v) => v.status === 'AVAILABLE'),
    ON_MISSION: filtered.filter((v) => v.status === 'ON_MISSION'),
    OFFLINE:    filtered.filter((v) => v.status === 'OFFLINE'),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search volunteers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <AddVolunteerForm ngoId={ngo.id} onAdd={onAdd} />
      </div>

      {volunteers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">No volunteers yet</p>
          <p className="text-xs text-muted-foreground/70">Add your first volunteer using the button above.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(Object.entries(byStatus) as [VolunteerMemberStatus, VolunteerMember[]][]).map(([status, vols]) => {
            if (vols.length === 0) return null;
            const meta = VOLUNTEER_MEMBER_STATUS_META[status];
            return (
              <div key={status}>
                <p className={cn('mb-2 text-[11px] font-bold uppercase tracking-widest', meta.text)}>
                  {meta.label} ({vols.length})
                </p>
                <div className="space-y-2">
                  {vols.map((vol) => (
                    <VolunteerRow
                      key={vol.id}
                      vol={vol}
                      tasks={tasks}
                      onRemove={() => handleRemove(vol.id)}
                      onStatusChange={(s) => handleStatusChange(vol.id, s)}
                      removing={removing === vol.id || statusBusy === vol.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Operations Tab ────────────────────────────────────────────────────────────

function OperationsTab({
  ngo,
  tasks,
  onConfirm,
  onCancel,
}: {
  ngo: Omit<NgoProfile, 'passwordHash'>;
  tasks: RescueTask[];
  onConfirm: (task: RescueTask) => void;
  onCancel: (taskId: string) => Promise<void>;
}) {
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const active    = tasks.filter((t) => t.assignedNgoId === ngo.id && ['ASSIGNED', 'IN_PROGRESS'].includes(t.status));
  const awaiting  = tasks.filter((t) => t.assignedNgoId === ngo.id && t.status === 'AWAITING_CONFIRMATION');
  const available = tasks.filter((t) => t.status === 'AVAILABLE');

  async function handleCancel(taskId: string) {
    setCancelBusy(taskId); setErr(null);
    try { await onCancel(taskId); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Cancel failed'); }
    finally { setCancelBusy(null); }
  }

  const EmptyOps = ({ label }: { label: string }) => (
    <div className="rounded-xl border border-dashed border-border py-8 text-center">
      <Activity className="mx-auto h-7 w-7 text-muted-foreground/40" />
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {err && (
        <div className="flex items-center gap-2 rounded-lg bg-alert/10 p-3 text-sm text-alert">
          <AlertCircle className="h-4 w-4 shrink-0" />{err}
        </div>
      )}

      {/* Awaiting confirmation */}
      {awaiting.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-400">
            🟡 Awaiting Confirmation ({awaiting.length})
          </p>
          <div className="space-y-3">
            {awaiting.map((task) => (
              <RescueTaskCard
                key={task.id}
                task={task}
                showVolunteer
                actions={[
                  {
                    label: 'Confirm Rescue ✅',
                    className: 'bg-success text-white hover:bg-success/90',
                    onClick: () => onConfirm(task),
                  },
                  {
                    label: 'Cancel Operation',
                    variant: 'outline',
                    className: 'border-alert/40 text-alert hover:bg-alert/10',
                    onClick:  () => handleCancel(task.id),
                    loading:  cancelBusy === task.id,
                  },
                ]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active rescues */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-warning">
          🟠 Active Rescues ({active.length})
        </p>
        {active.length === 0 ? <EmptyOps label="No active rescue operations." /> : (
          <div className="space-y-3">
            {active.map((task) => (
              <RescueTaskCard
                key={task.id}
                task={task}
                showVolunteer
                actions={[
                  {
                    label: 'Cancel Operation',
                    variant: 'outline',
                    className: 'border-alert/40 text-alert hover:bg-alert/10 text-xs',
                    onClick:  () => handleCancel(task.id),
                    loading:  cancelBusy === task.id,
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Available tasks (visible to this NGO's volunteers) */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-success">
          🟢 Available Tasks ({available.length})
        </p>
        {available.length === 0 ? <EmptyOps label="No available tasks right now." /> : (
          <div className="space-y-2">
            {available.map((task) => (
              <RescueTaskCard key={task.id} task={task} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ ngo, tasks }: { ngo: Omit<NgoProfile, 'passwordHash'>; tasks: RescueTask[] }) {
  const [search, setSearch] = useState('');
  const history = tasks
    .filter((t) => t.assignedNgoId === ngo.id && ['RESCUED', 'CANCELLED'].includes(t.status))
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));

  const filtered = history.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.location ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (t.assignedVolunteerName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <History className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search history…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {history.length === 0 ? 'No completed rescues yet' : 'No results found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <RescueTaskCard key={task.id} task={task} showVolunteer compact />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {filtered.length} of {history.length} operations
        </p>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

interface NgoDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ngo: Omit<NgoProfile, 'passwordHash'>;
  onLogout: () => void;
}

export function NgoDashboard({ open, onOpenChange, ngo, onLogout }: NgoDashboardProps) {
  const {
    volunteers, tasks, stats, loading, error, lastUpdated,
    addVolunteer, removeVolunteer, setVolunteerStatus,
    cancelTask, confirmRescue, refresh,
  } = useNgoData(ngo.id);

  const [tab,            setTab]            = useState('overview');
  const [confirmTask,    setConfirmTask]    = useState<RescueTask | null>(null);
  const [refreshing,     setRefreshing]     = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleAddVolunteer = useCallback((v: VolunteerMember) => {
    refresh();
    void v;
  }, [refresh]);

  const handleRemoveVolunteer = useCallback(async (id: string) => {
    await removeVolunteer(id);
  }, [removeVolunteer]);

  const handleStatusChange = useCallback(async (id: string, s: typeof volunteers[0]['status']) => {
    await setVolunteerStatus(id, s);
  }, [setVolunteerStatus]);

  const handleCancelTask = useCallback(async (taskId: string) => {
    await cancelTask(taskId, 'Cancelled by NGO admin');
  }, [cancelTask]);

  const handleConfirmRescue = useCallback(async (taskId: string) => {
    await confirmRescue(taskId, ngo.contactPerson);
  }, [confirmRescue, ngo.contactPerson]);

  function handleLogout() {
    clearNgoSession();
    onLogout();
    onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
              {ngo.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-none">{ngo.name}</SheetTitle>
              <SheetDescription className="mt-0.5 text-xs">NGO Dashboard</SheetDescription>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={cn('h-4 w-4', (refreshing || loading) && 'animate-spin')} />
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg p-2 text-muted-foreground hover:bg-alert/10 hover:text-alert"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Awaiting confirmation badge on Operations tab */}
          {stats.awaitingConfirmation > 0 && tab !== 'operations' && (
            <button
              onClick={() => setTab('operations')}
              className="flex shrink-0 items-center gap-2 bg-yellow-500/10 px-5 py-2 text-xs font-semibold text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.awaitingConfirmation} rescue{stats.awaitingConfirmation > 1 ? 's' : ''} awaiting confirmation — tap to review
            </button>
          )}

          {error && (
            <div className="shrink-0 flex items-center gap-2 bg-alert/10 px-5 py-2 text-xs text-alert">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
            </div>
          )}

          {/* Tabs nav */}
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-5 mt-3 grid shrink-0 grid-cols-4">
              <TabsTrigger value="overview"   className="text-xs"><BarChart3  className="mr-1 h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="volunteers" className="text-xs relative">
                <Users className="mr-1 h-3.5 w-3.5" />Team
                {volunteers.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1 text-[10px]">{volunteers.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="operations" className="text-xs relative">
                <Activity className="mr-1 h-3.5 w-3.5" />Ops
                {stats.awaitingConfirmation > 0 && (
                  <span className="ml-1 rounded-full bg-yellow-500 px-1 text-[10px] text-white">{stats.awaitingConfirmation}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history"    className="text-xs"><History   className="mr-1 h-3.5 w-3.5" />History</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 px-5 py-4">
              <TabsContent value="overview"   className="mt-0 focus-visible:ring-0">
                <OverviewTab ngo={ngo} stats={stats} tasks={tasks} lastUpdated={lastUpdated} />
              </TabsContent>

              <TabsContent value="volunteers" className="mt-0 focus-visible:ring-0">
                <VolunteersTab
                  ngo={ngo}
                  volunteers={volunteers}
                  tasks={tasks}
                  onAdd={handleAddVolunteer}
                  onRemove={handleRemoveVolunteer}
                  onStatusChange={handleStatusChange}
                />
              </TabsContent>

              <TabsContent value="operations" className="mt-0 focus-visible:ring-0">
                <OperationsTab
                  ngo={ngo}
                  tasks={tasks}
                  onConfirm={(t) => setConfirmTask(t)}
                  onCancel={handleCancelTask}
                />
              </TabsContent>

              <TabsContent value="history"    className="mt-0 focus-visible:ring-0">
                <HistoryTab ngo={ngo} tasks={tasks} />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Rescue Confirmation Modal */}
      <RescueConfirmationModal
        open={confirmTask !== null}
        onOpenChange={(o) => { if (!o) setConfirmTask(null); }}
        task={confirmTask}
        ngoName={ngo.name}
        onConfirm={handleConfirmRescue}
        onCancel={async (taskId, reason) => {
          await cancelTask(taskId, reason);
          setConfirmTask(null);
        }}
      />
    </>
  );
}
