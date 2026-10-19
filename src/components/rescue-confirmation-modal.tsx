/**
 * rescue-confirmation-modal.tsx
 *
 * Modal presented to an NGO admin when a volunteer has requested rescue completion
 * (status = AWAITING_CONFIRMATION). The NGO must review and confirm before the
 * task transitions to RESCUED.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import {
  CheckCircle2, AlertTriangle, MapPin, Users, Phone,
  Clock, User, Building2, Loader2, XCircle,
} from 'lucide-react';
import { cn }       from '@/lib/utils';
import { PRIORITY_META } from '@/types';
import type { RescueTask } from '@/types';

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

// ── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RescueConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: RescueTask | null;
  ngoName: string;
  /** Called when NGO confirms the rescue */
  onConfirm: (taskId: string) => Promise<void>;
  /** Called when NGO cancels/rejects the confirmation (sends back to in-progress or cancels) */
  onCancel?: (taskId: string, reason: string) => Promise<void>;
}

export function RescueConfirmationModal({
  open,
  onOpenChange,
  task,
  ngoName,
  onConfirm,
  onCancel,
}: RescueConfirmationModalProps) {
  const [busy,       setBusy]       = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [done,       setDone]       = useState(false);
  const [err,        setErr]        = useState('');

  if (!task) return null;

  const priorityMeta = PRIORITY_META[task.priority as keyof typeof PRIORITY_META] ?? PRIORITY_META.urgent;

  async function handleConfirm() {
    setBusy(true); setErr('');
    try {
      await onConfirm(task!.id);
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onOpenChange(false);
      }, 1500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Confirmation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!onCancel) return;
    setCancelBusy(true); setErr('');
    try {
      await onCancel(task!.id, 'NGO rejected confirmation — sending back for review');
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Cancellation failed.');
    } finally {
      setCancelBusy(false);
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-success" />
            <div>
              <p className="text-lg font-bold text-foreground">Rescue Confirmed!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Task #{task.id.slice(-6).toUpperCase()} is now marked as <strong>RESCUED</strong>.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Rescue Confirmation Required
          </DialogTitle>
          <DialogDescription>
            Review the details below and confirm whether this rescue operation has been successfully completed.
          </DialogDescription>
        </DialogHeader>

        {/* Awaiting confirmation banner */}
        <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">Volunteer has marked this rescue as complete.</span>
            {' '}Completion requested {timeAgo(task.completionRequestedAt)}.
          </div>
        </div>

        {/* Task details */}
        <div className="mt-1 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          {/* Priority + title */}
          <div className="flex flex-wrap items-start gap-2">
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
              priorityMeta.bg, priorityMeta.text,
            )}>
              {priorityMeta.label}
            </span>
            <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {task.category}
            </span>
          </div>
          <p className="font-semibold text-foreground">{task.title}</p>
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}

          <div className="mt-1 space-y-2 border-t border-border pt-3">
            <InfoRow icon={MapPin}    label="Location"  value={task.location || '—'} />
            <InfoRow icon={Users}     label="People"    value={`${task.peopleCount} requiring assistance`} />
            <InfoRow icon={Phone}     label="Contact"   value={`${task.contactName} • ${task.contactPhone}`} />
            <InfoRow icon={User}      label="Volunteer" value={task.assignedVolunteerName ?? '—'} />
            <InfoRow icon={Building2} label="NGO"       value={ngoName} />
          </div>
        </div>

        {/* Timeline summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Created',   value: timeAgo(task.createdAt) },
            { label: 'Assigned',  value: timeAgo(task.assignedAt) },
            { label: 'Started',   value: timeAgo(task.startedAt) },
            { label: 'Duration',  value: duration(task.startedAt, task.completionRequestedAt) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/40 px-3 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-lg bg-alert/10 p-3 text-sm text-alert">
            <AlertTriangle className="h-4 w-4 shrink-0" />{err}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {onCancel && (
            <Button
              variant="outline"
              className="w-full border-alert/40 text-alert hover:bg-alert/10 sm:w-auto"
              onClick={handleCancel}
              disabled={cancelBusy || busy}
            >
              {cancelBusy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling…</>
                : <><XCircle className="mr-2 h-4 w-4" />Reject / Cancel</>
              }
            </Button>
          )}
          <Button
            className="w-full bg-success text-white hover:bg-success/90 sm:w-auto"
            onClick={handleConfirm}
            disabled={busy || cancelBusy}
          >
            {busy
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming…</>
              : <><CheckCircle2 className="mr-2 h-4 w-4" />Confirm Rescue</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
