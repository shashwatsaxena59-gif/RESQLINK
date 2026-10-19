/**
 * rescue-task-card.tsx
 *
 * Reusable card for displaying a RescueTask with status badge,
 * priority badge, and configurable action buttons.
 */

import { Clock, MapPin, Users, Phone, AlertTriangle, Building2 } from 'lucide-react';
import { Badge }  from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn }     from '@/lib/utils';
import { RESCUE_TASK_STATUS_META, PRIORITY_META } from '@/types';
import type { RescueTask, RescueTaskStatus } from '@/types';

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

// ── Status Badge ──────────────────────────────────────────────────────────────

export function RescueStatusBadge({ status, size = 'sm' }: { status: RescueTaskStatus; size?: 'xs' | 'sm' }) {
  const meta = RESCUE_TASK_STATUS_META[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-semibold',
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      meta.bg, meta.text,
    )}>
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}

// ── Action button presets ─────────────────────────────────────────────────────

export interface RescueTaskAction {
  label: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  className?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export interface RescueTaskCardProps {
  task: RescueTask;
  actions?: RescueTaskAction[];
  /** Show the assigned volunteer info (NGO view) */
  showVolunteer?: boolean;
  /** Show the assigned NGO info (volunteer view) */
  showNgo?: boolean;
  /** Compact mode — less padding, smaller text */
  compact?: boolean;
  className?: string;
}

export function RescueTaskCard({
  task,
  actions = [],
  showVolunteer = false,
  showNgo = false,
  compact = false,
  className,
}: RescueTaskCardProps) {
  const priorityMeta = PRIORITY_META[task.priority as keyof typeof PRIORITY_META] ?? PRIORITY_META.urgent;
  const isActive     = ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION'].includes(task.status);

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card transition-shadow',
      compact ? 'p-3' : 'p-4',
      isActive && 'border-primary/20 shadow-sm',
      className,
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <RescueStatusBadge status={task.status} />
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
          <h3 className={cn(
            'mt-1.5 font-semibold leading-snug text-foreground',
            compact ? 'text-sm' : 'text-base',
          )}>
            {task.title}
          </h3>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(task.createdAt)}</span>
      </div>

      {/* Description */}
      {task.description && !compact && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
      )}

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {task.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{task.location}</span>
          </span>
        )}
        {task.peopleCount > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 shrink-0" />
            {task.peopleCount} {task.peopleCount === 1 ? 'person' : 'people'}
          </span>
        )}
        {task.contactPhone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {task.contactPhone}
          </span>
        )}
      </div>

      {/* Assignment info */}
      {showVolunteer && task.assignedVolunteerName && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Volunteer:</span>
          <span className="font-medium text-foreground">{task.assignedVolunteerName}</span>
        </div>
      )}
      {showNgo && task.assignedNgoName && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">NGO:</span>
          <span className="font-medium text-foreground">{task.assignedNgoName}</span>
        </div>
      )}

      {/* Timeline row for active tasks */}
      {isActive && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {task.assignedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />Assigned {timeAgo(task.assignedAt)}
            </span>
          )}
          {task.startedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />Started {timeAgo(task.startedAt)}
            </span>
          )}
          {task.status === 'AWAITING_CONFIRMATION' && task.completionRequestedAt && (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3" />Completion requested {timeAgo(task.completionRequestedAt)}
            </span>
          )}
        </div>
      )}

      {/* RESCUED — show final info */}
      {task.status === 'RESCUED' && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {task.completedAt && (
            <span>Completed: {new Date(task.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          )}
          {task.startedAt && task.completedAt && (
            <span>Duration: {duration(task.startedAt, task.completedAt)}</span>
          )}
          {task.confirmedByName && (
            <span>Confirmed by: {task.confirmedByName}</span>
          )}
        </div>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant ?? 'default'}
              size="sm"
              className={cn('h-8 text-xs', action.className)}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
            >
              {action.loading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {action.label}
                </span>
              ) : action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
