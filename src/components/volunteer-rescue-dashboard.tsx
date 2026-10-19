/**
 * volunteer-rescue-dashboard.tsx
 *
 * Volunteer-facing rescue dashboard rendered as a Sheet.
 *
 * Sections (tabs):
 *   Available  — AVAILABLE rescue tasks the volunteer can accept
 *   My Rescue  — active task (ASSIGNED | IN_PROGRESS | AWAITING_CONFIRMATION)
 *   History    — RESCUED tasks for this volunteer
 */

import { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button }     from '@/components/ui/button';
import { Input }      from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User, ListTodo, Activity, History, LogOut,
  RefreshCw, AlertCircle, CheckCircle2, Loader2,
  AlertTriangle, Clock, MapPin, Users, Phone, Building2,
  LifeBuoy, Flame, X,
} from 'lucide-react';
import { cn }          from '@/lib/utils';
import { useRescueTasks } from '@/hooks/use-rescue-tasks';
import { RescueTaskCard } from '@/components/rescue-task-card';
import {
  clearVolunteerSession,
  refreshVolunteerSession,
} from '@/lib/ngo-auth';
import { RESCUE_TASK_STATUS_META, VOLUNTEER_MEMBER_STATUS_META } from '@/types';
import type { VolunteerMember, RescueTask } from '@/types';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number | null): string {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function duration(start: number | null, end: number | null): string {
  if (!start) return '—';
  const diff = Math.floor(((end ?? Date.now()) - start) / 1000);
  if (diff < 60)    return `${diff}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

// ── Active Rescue Panel ───────────────────────────────────────────────────────

function ActiveRescuePanel({
  task,
  volunteerId,
  onStart,
  onComplete,
}: {
  task: RescueTask;
  volunteerId: string;
  onStart:    () => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  const [startBusy,    setStartBusy]    = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [err,          setErr]          = useState('');

  const meta = RESCUE_TASK_STATUS_META[task.status];

  async function handleStart() {
    setStartBusy(true); setErr('');
    try {
      await onStart();
      toast.success('Rescue started!', { description: 'Status updated to In Progress.' });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to start rescue.');
    } finally {
      setStartBusy(false);
    }
  }

  async function handleComplete() {
    setCompleteBusy(true); setErr('');
    try {
      await onComplete();
      toast.success('Completion requested!', {
        description: 'Your NGO will review and officially confirm the rescue.',
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to request completion.');
    } finally {
      setCompleteBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold',
        task.status === 'ASSIGNED'              && 'bg-info/10 text-info',
        task.status === 'IN_PROGRESS'           && 'bg-warning/10 text-warning',
        task.status === 'AWAITING_CONFIRMATION' && 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
      )}>
        <span className="text-xl">{meta.emoji}</span>
        <div>
          <p>{meta.label}</p>
          {task.status === 'ASSIGNED'              && <p className="text-xs font-normal opacity-80">You have accepted this rescue. Tap "Start Rescue" when you reach the area.</p>}
          {task.status === 'IN_PROGRESS'           && <p className="text-xs font-normal opacity-80">Rescue is in progress. Tap "Mark Completed" once the operation is done.</p>}
          {task.status === 'AWAITING_CONFIRMATION' && <p className="text-xs font-normal opacity-80">Completion submitted. Waiting for your NGO to officially confirm.</p>}
        </div>
      </div>

      {/* Task details card */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <p className="font-bold text-foreground text-base">{task.title}</p>
          {task.description && (
            <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-3 text-sm">
          {task.location && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-foreground">{task.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-foreground">{task.peopleCount} {task.peopleCount === 1 ? 'person' : 'people'} needing help</span>
          </div>
          {task.contactPhone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a href={`tel:${task.contactPhone}`} className="text-primary underline-offset-2 hover:underline">
                {task.contactName} • {task.contactPhone}
              </a>
            </div>
          )}
          {task.assignedNgoName && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-foreground">{task.assignedNgoName}</span>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Created {timeAgo(task.createdAt)}</span>
          {task.assignedAt   && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Accepted {timeAgo(task.assignedAt)}</span>}
          {task.startedAt    && <span className="flex items-center gap-1"><Flame className="h-3 w-3" />Started {timeAgo(task.startedAt)}</span>}
          {task.startedAt    && <span>Active for {duration(task.startedAt, null)}</span>}
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-lg bg-alert/10 p-3 text-sm text-alert">
          <AlertCircle className="h-4 w-4 shrink-0" />{err}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        {task.status === 'ASSIGNED' && (
          <Button
            className="w-full bg-warning text-white hover:bg-warning/90"
            onClick={handleStart}
            disabled={startBusy}
          >
            {startBusy
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</>
              : <><Flame className="mr-2 h-4 w-4" />Start Rescue</>
            }
          </Button>
        )}

        {task.status === 'IN_PROGRESS' && (
          <Button
            className="w-full bg-success text-white hover:bg-success/90"
            onClick={handleComplete}
            disabled={completeBusy}
          >
            {completeBusy
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
              : <><CheckCircle2 className="mr-2 h-4 w-4" />Mark Rescue Completed</>
            }
          </Button>
        )}

        {task.status === 'AWAITING_CONFIRMATION' && (
          <div className="flex items-center gap-3 rounded-xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Waiting for NGO confirmation</p>
              <p className="text-xs font-normal">Your NGO admin will review and officially confirm the rescue.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Available Tasks Tab ───────────────────────────────────────────────────────

function AvailableTasksTab({
  tasks,
  volunteerId,
  ngoId,
  hasActiveTask,
  onAccept,
}: {
  tasks: RescueTask[];
  volunteerId: string;
  ngoId: string;
  hasActiveTask: boolean;
  onAccept: (taskId: string) => Promise<void>;
}) {
  const [search,    setSearch]    = useState('');
  const [accepting, setAccepting] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  const filtered = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.location ?? '').toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAccept(taskId: string) {
    if (hasActiveTask) {
      toast.error('You already have an active rescue.', {
        description: 'Complete your current rescue before accepting another.',
      });
      return;
    }
    setAccepting(taskId); setConflictMsg(null);
    try {
      await onAccept(taskId);
      toast.success('Rescue accepted!', { description: 'Check "My Rescue" for details.' });
    } catch (e: unknown) {
      const err = e as any;
      if (err?.alreadyAssigned) {
        setConflictMsg(err.error ?? 'This rescue request has already been assigned to another volunteer.');
        toast.error('Already Assigned', { description: err.error ?? 'This task was just taken by another volunteer.' });
      } else {
        const msg = err?.message ?? 'Failed to accept task.';
        toast.error('Error', { description: msg });
      }
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="space-y-4">
      {hasActiveTask && (
        <div className="flex items-center gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          You have an active rescue. Complete it before accepting another.
        </div>
      )}

      <div className="relative">
        <ListTodo className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search available rescues…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {conflictMsg && (
        <div className="flex items-start gap-2 rounded-xl bg-alert/10 px-4 py-3 text-sm text-alert">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Already Assigned</p>
            <p className="text-xs font-normal">{conflictMsg}</p>
          </div>
          <button onClick={() => setConflictMsg(null)} className="ml-auto shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {tasks.length === 0 ? 'No rescue requests available right now' : 'No results match your search'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            New requests appear automatically every few seconds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <RescueTaskCard
              key={task.id}
              task={task}
              actions={[
                {
                  label:    accepting === task.id ? 'Accepting…' : 'Accept Rescue',
                  className: 'bg-primary text-white hover:bg-primary/90',
                  disabled: hasActiveTask || accepting !== null,
                  loading:  accepting === task.id,
                  onClick:  () => handleAccept(task.id),
                },
              ]}
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Showing {filtered.length} available rescue request{filtered.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function VolunteerHistoryTab({ tasks }: { tasks: RescueTask[] }) {
  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">No completed rescues yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Your confirmed rescues will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <RescueTaskCard key={task.id} task={task} showNgo compact />
          ))}
        </div>
      )}
      {tasks.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">{tasks.length} completed rescue{tasks.length !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface VolunteerRescueDashboardProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  volunteer:     VolunteerMember;
  ngoId:         string;
  ngoName:       string;
  onLogout:      () => void;
}

export function VolunteerRescueDashboard({
  open,
  onOpenChange,
  volunteer,
  ngoId,
  ngoName,
  onLogout,
}: VolunteerRescueDashboardProps) {
  const {
    availableTasks,
    activeTask,
    history,
    loading,
    error,
    acceptTask,
    startRescue,
    completeRescue,
    refresh,
  } = useRescueTasks(volunteer.id, ngoId);

  const [tab,        setTab]        = useState('available');
  const [refreshing, setRefreshing] = useState(false);

  // Auto-switch to My Rescue tab when a task is assigned
  const prevActiveRef = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleAccept = useCallback(async (taskId: string) => {
    const result = await acceptTask(taskId);
    if (!result.ok) {
      // Throw so the AvailableTasksTab can catch and show the conflict message
      throw Object.assign(new Error(result.error ?? 'Accept failed'), result);
    }
    // Switch to My Rescue tab
    setTab('active');
  }, [acceptTask]);

  const handleStart = useCallback(async () => {
    if (!activeTask) return;
    const updated = await startRescue(activeTask.id);
    void updated;
  }, [activeTask, startRescue]);

  const handleComplete = useCallback(async () => {
    if (!activeTask) return;
    await completeRescue(activeTask.id);
  }, [activeTask, completeRescue]);

  function handleLogout() {
    clearVolunteerSession();
    onLogout();
    onOpenChange(false);
  }

  const volMeta = VOLUNTEER_MEMBER_STATUS_META[volunteer.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
            {volunteer.fullName.charAt(0).toUpperCase()}
            <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card', volMeta.dot)} />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-sm leading-none">{volunteer.fullName}</SheetTitle>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold', volMeta.bg, volMeta.text)}>
                {volMeta.label}
              </span>
              <span className="text-xs text-muted-foreground">{ngoName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
              title="Refresh"
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

        {/* Active rescue alert strip */}
        {activeTask && tab !== 'active' && (
          <button
            onClick={() => setTab('active')}
            className="flex shrink-0 items-center gap-2 bg-warning/10 px-5 py-2 text-xs font-semibold text-warning hover:bg-warning/20 transition-colors"
          >
            <Activity className="h-3.5 w-3.5 shrink-0" />
            Active rescue: {activeTask.title} — tap to view
          </button>
        )}

        {error && (
          <div className="shrink-0 flex items-center gap-2 bg-alert/10 px-5 py-2 text-xs text-alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-3 grid shrink-0 grid-cols-3">
            <TabsTrigger value="available" className="text-xs">
              <ListTodo className="mr-1 h-3.5 w-3.5" />
              Available
              {availableTasks.length > 0 && (
                <span className="ml-1 rounded-full bg-success px-1 text-[10px] text-white">{availableTasks.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs relative">
              <Activity className="mr-1 h-3.5 w-3.5" />
              My Rescue
              {activeTask && (
                <span className="ml-1 h-2 w-2 rounded-full bg-warning animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="mr-1 h-3.5 w-3.5" />
              History
              {history.length > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1 text-[10px]">{history.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-5 py-4">
            <TabsContent value="available" className="mt-0 focus-visible:ring-0">
              <AvailableTasksTab
                tasks={availableTasks}
                volunteerId={volunteer.id}
                ngoId={ngoId}
                hasActiveTask={activeTask !== null}
                onAccept={handleAccept}
              />
            </TabsContent>

            <TabsContent value="active" className="mt-0 focus-visible:ring-0">
              {activeTask ? (
                <ActiveRescuePanel
                  task={activeTask}
                  volunteerId={volunteer.id}
                  onStart={handleStart}
                  onComplete={handleComplete}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
                  <LifeBuoy className="h-12 w-12 text-muted-foreground/40" />
                  <div>
                    <p className="font-medium text-foreground">No active rescue</p>
                    <p className="mt-1 text-sm text-muted-foreground">Accept a rescue from the Available tab.</p>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setTab('available')}
                    className="gap-1.5"
                  >
                    <ListTodo className="h-3.5 w-3.5" />View Available
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0 focus-visible:ring-0">
              <VolunteerHistoryTab tasks={history} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
