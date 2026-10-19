import { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Trash2,
  Download,
  RotateCw,
  Split,
  Layers,
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
import type { QueuedRequest, NetworkStatus } from '@/hooks/use-network';
import { timeAgo } from '@/hooks/use-network';
import { toast } from 'sonner';
import { syncQueueManager } from '@/sync/sync-queue';
import { syncQueueRepo } from '@/storage/repositories/sync-queue-repository';
import type { SyncQueueItem } from '@/domain/models/sync-metadata';
import { SyncTruthfulBadge } from '@/components/sync-truthful-badge';
import { pwaManager, type PwaStatus } from '@/pwa/pwa-manager';

interface SyncStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: NetworkStatus;
  onToggleNetwork: () => void;
  queue: QueuedRequest[];
  onClearQueue: () => void;
  onRemoveFromQueue: (id: string) => void;
  customRequestsCount: number;
}

export function SyncStatusModal({
  open,
  onOpenChange,
  status,
  onToggleNetwork,
  queue,
  onClearQueue,
  onRemoveFromQueue,
  customRequestsCount,
}: SyncStatusModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncItems, setSyncItems] = useState<SyncQueueItem[]>([]);
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>(pwaManager.getStatus());
  const [verifiedOnline, setVerifiedOnline] = useState<boolean | null>(null);

  const isOnline = status === 'online';

  const loadOutboxItems = async () => {
    try {
      const items = await syncQueueRepo.findAll();
      setSyncItems(items);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    if (open) {
      loadOutboxItems();
      const unsubPwa = pwaManager.subscribe(setPwaStatus);
      const unsubSync = syncQueueManager.subscribe(() => {
        loadOutboxItems();
      });

      // Probe real network
      syncQueueManager.getAdapter().isAvailable().then(setVerifiedOnline);

      return () => {
        unsubPwa();
        unsubSync();
      };
    }
  }, [open]);

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      const available = await syncQueueManager.getAdapter().isAvailable();
      setVerifiedOnline(available);

      if (!available) {
        toast.warning('Network probe failed', {
          description: 'Network is unreachable or server health endpoint is down. Operations remain safely queued in IndexedDB.',
        });
        setSyncing(false);
        return;
      }

      const res = await syncQueueManager.processQueue();
      await loadOutboxItems();

      if (res.conflicts > 0) {
        toast.warning('Version conflicts detected', {
          description: `${res.conflicts} operation(s) require review due to remote updates.`,
        });
      } else if (res.errors > 0) {
        toast.error('Sync completed with errors', {
          description: `${res.errors} items failed and scheduled for exponential backoff.`,
        });
      } else {
        toast.success('Synchronization verified', {
          description: `All outbox operations reconciled with remote endpoints.`,
        });
      }
    } catch (err: unknown) {
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Unknown sync failure',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryItem = async (id: string) => {
    await syncQueueManager.retryOperation(id);
    await loadOutboxItems();
    toast.info('Retrying operation', { description: 'Scheduled immediate re-attempt.' });
  };

  const handleRetryAll = async () => {
    const count = await syncQueueManager.retryAllFailed();
    await loadOutboxItems();
    toast.info(`Retrying ${count} failed operation(s)`);
  };

  const handleResolveConflict = async (id: string, resolution: 'keep_local' | 'accept_server') => {
    const success = await syncQueueManager.resolveConflict(id, resolution);
    await loadOutboxItems();
    if (success) {
      toast.success(
        resolution === 'keep_local'
          ? 'Rebased local edit onto server version'
          : 'Accepted remote server record'
      );
    }
  };

  const handleInstallApp = async () => {
    const installed = await pwaManager.promptInstall();
    if (installed) {
      toast.success('ResQLink installed', {
        description: 'You can now launch ResQLink directly from your home screen or desktop.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header with tactical telemetry bar */}
        <div className="bg-secondary/40 border-b border-border p-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center font-mono border',
                  verifiedOnline
                    ? 'bg-success/15 border-success/30 text-success'
                    : 'bg-warning/15 border-warning/30 text-warning'
                )}
              >
                {verifiedOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Sync & Connectivity Engine
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  RESQLINK_PWA_INDEXEDDB_TELEMETRY
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className={cn(
                'font-mono text-[10px] tracking-wider uppercase px-2 py-0.5',
                verifiedOnline
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-warning/30 bg-warning/10 text-warning'
              )}
            >
              {verifiedOnline ? 'Verified Online' : 'Offline / Standalone'}
            </Badge>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Connection status card with live probe */}
          <div className="rounded-xl border border-border bg-background/50 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                Network & Sync Protocol
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleNetwork}
                className="h-7 text-xs font-mono font-medium"
              >
                Simulate: {isOnline ? 'Go Offline' : 'Go Online'}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  verifiedOnline ? 'bg-success shadow-[0_0_8px_hsl(var(--success))]' : 'bg-warning'
                )}
              />
              <span className="text-foreground font-medium">
                {verifiedOnline
                  ? 'Live Server Reachable (HTTP / Health Probe Verified)'
                  : 'Disconnected / Offline Mode — IndexedDB Outbox Active'}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {verifiedOnline
                ? 'Truthful connection confirmed. Outgoing SOS calls and shelter updates reconcile immediately.'
                : 'Emergency requests and status changes are guaranteed to persist safely in local IndexedDB. No silent data loss.'}
            </p>

            {/* PWA Background Sync & Service Worker Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-[10px] font-mono">
              <span className="text-muted-foreground">PWA Capabilities:</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded border',
                  pwaStatus.isServiceWorkerRegistered
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-muted bg-muted/20 text-muted-foreground'
                )}
              >
                SW: {pwaStatus.isServiceWorkerRegistered ? 'Active (App-Shell Cached)' : 'Registering...'}
              </span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded border',
                  pwaStatus.isBackgroundSyncSupported
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                )}
              >
                Sync: {pwaStatus.isBackgroundSyncSupported ? 'Background Sync API' : 'Foreground Fallback'}
              </span>
              {pwaStatus.isInstallable && (
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="px-2 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 cursor-pointer font-bold transition-colors"
                >
                  <Download className="h-3 w-3" />
                  Install App
                </button>
              )}
            </div>
          </div>

          {/* Outbox Queue Telemetry */}
          <div className="rounded-xl border border-border bg-background/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  IndexedDB Outbox Queue ({syncItems.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {syncItems.some((i) => i.status === 'failed') && (
                  <button
                    type="button"
                    onClick={handleRetryAll}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <RotateCw className="h-3 w-3" />
                    Retry Failed
                  </button>
                )}
                {syncItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearQueue();
                      loadOutboxItems();
                    }}
                    className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear Outbox
                  </button>
                )}
              </div>
            </div>

            {syncItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1.5 opacity-80" />
                <p className="text-xs font-medium text-foreground">Outbox is clear</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  All local emergency reports and shelter operations are reconciled.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {syncItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-border bg-card/60 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
                          {item.entityType.replace('_', ' ')}
                        </Badge>
                        <SyncTruthfulBadge status={item.status} serverAckTimestamp={item.serverAckTimestamp} />
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {timeAgo(new Date(item.createdAt || item.clientTimestamp).getTime())}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {item.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetryItem(item.id)}
                            className="text-primary hover:underline p-1 text-[11px] flex items-center gap-1"
                            title="Retry operation"
                          >
                            <RotateCw className="h-3 w-3" />
                            Retry
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await syncQueueRepo.delete(item.id);
                            loadOutboxItems();
                          }}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-foreground font-medium truncate">
                      {(item.payload as { description?: string; name?: string })?.description ||
                        (item.payload as { name?: string })?.name ||
                        `Operation: ${item.action} on ${item.entityId}`}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Idempotency: {item.idempotencyKey.slice(0, 16)}...</span>
                      <span>Attempts: {item.attemptCount} / {item.maxAttempts}</span>
                    </div>

                    {item.lastError && (
                      <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded p-1 font-mono">
                        Error: {item.lastError}
                      </p>
                    )}

                    {/* Conflict Resolution Actions */}
                    {item.status === 'conflict' && (
                      <div className="mt-1 p-2 bg-purple-500/10 border border-purple-500/30 rounded flex items-center justify-between gap-2">
                        <div className="text-[11px] text-purple-300">
                          <span className="font-semibold block">Version Conflict</span>
                          Remote entity has been updated since your offline edit.
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveConflict(item.id, 'keep_local')}
                            className="h-6 text-[10px] border-purple-400/50 text-purple-300 hover:bg-purple-500/20"
                          >
                            Keep Local
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveConflict(item.id, 'accept_server')}
                            className="h-6 text-[10px] border-border text-foreground hover:bg-card"
                          >
                            Accept Remote
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostic Metrics */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-border bg-card/40 p-2.5">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                Local Custom Reports
              </span>
              <span className="text-lg font-bold font-mono text-foreground">
                {customRequestsCount}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-card/40 p-2.5">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                Storage Persistence
              </span>
              <span className="text-xs font-bold font-mono text-primary flex items-center justify-center gap-1 mt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                IndexedDB (v2 Safe)
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons footer */}
        <div className="p-4 bg-secondary/30 border-t border-border flex items-center gap-2 shrink-0">
          <Button
            onClick={handleForceSync}
            disabled={syncing}
            className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all h-9 text-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', syncing && 'animate-spin')} />
            {syncing ? 'Verifying & Syncing...' : 'Verify Network & Force Sync'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs font-medium"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
