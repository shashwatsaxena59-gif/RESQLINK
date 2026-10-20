import { useState, useEffect, useCallback } from 'react';
import {
  Siren,
  Clock,
  MapPin,
  LocateFixed,
  Users,
  ShieldAlert,
  HeartPulse,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  CloudOff,
  RefreshCw,
  Lock,
  ArrowRight,
  UserCheck,
  AlertTriangle,
  LifeBuoy,
  Phone,
  FileText,
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
import { Separator } from '@/components/ui/separator';
import { cn, buildGoogleMapsUrl } from '@/lib/utils';
import { Navigation } from 'lucide-react';
import type {
  EmergencyRequest,
  RequestLifecycleStatus,
} from '@/domain/models/emergency-request';
import { emergencyRequestRepo } from '@/storage/repositories/emergency-request-repository';
import { transitionRequestStatus } from '@/domain/services/request-service';
import { isValidRequestTransition } from '@/domain/validation/validators';
import { syncQueueManager } from '@/sync/sync-queue';
import { SyncTruthfulBadge } from '@/components/sync-truthful-badge';
import { toast } from 'sonner';

export interface RequestDetailsModalProps {
  requestId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOnline: boolean;
  onStatusUpdated?: (updated: EmergencyRequest) => void;
}

const STATUS_CONFIG: Record<
  RequestLifecycleStatus,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  active: {
    label: 'Submitted / Awaiting Responder',
    bg: 'bg-alert/15',
    text: 'text-alert',
    border: 'border-alert/30',
    desc: 'Request received and broadcast. Waiting for nearby volunteers or coordinators.',
  },
  assigned: {
    label: 'Assigned to Responder',
    bg: 'bg-warning/15',
    text: 'text-warning',
    border: 'border-warning/30',
    desc: 'A volunteer or rescue crew has been dispatched to this location.',
  },
  'in-progress': {
    label: 'In Progress / En Route',
    bg: 'bg-info/15',
    text: 'text-info',
    border: 'border-info/30',
    desc: 'Responder is actively navigating or providing on-scene aid.',
  },
  fulfilled: {
    label: 'Fulfilled / Aid Delivered',
    bg: 'bg-success/15',
    text: 'text-success',
    border: 'border-success/30',
    desc: 'Assistance completed, evacuees sheltered, or critical supplies verified.',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-muted/30',
    text: 'text-muted-foreground',
    border: 'border-border',
    desc: 'Request was withdrawn or superseded by official operations.',
  },
};

export function RequestDetailsModal({
  requestId,
  open,
  onOpenChange,
  isOnline,
  onStatusUpdated,
}: RequestDetailsModalProps) {
  const [request, setRequest] = useState<EmergencyRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch request from local repository
  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setRequest(null);
      return;
    }
    setLoading(true);
    try {
      const data = await emergencyRequestRepo.findById(requestId);
      setRequest(data);
    } catch (err) {
      console.error('Failed to load request details:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (open && requestId) {
      loadRequest();
    }
  }, [open, requestId, loadRequest]);

  const handleCopyId = () => {
    if (!request) return;
    navigator.clipboard.writeText(request.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Request ID copied to clipboard');
  };

  const handleTransition = async (targetStatus: RequestLifecycleStatus) => {
    if (!request) return;

    if (!isValidRequestTransition(request.status, targetStatus)) {
      toast.error(`Invalid transition from '${request.status}' to '${targetStatus}'.`);
      return;
    }

    setTransitioning(true);
    try {
      const updated = transitionRequestStatus(request, targetStatus);
      await emergencyRequestRepo.save(updated);

      // Queue synchronization update
      await syncQueueManager.enqueue(
        'emergency_request',
        updated.id,
        'update',
        updated as unknown as Record<string, unknown>,
        `transition-${updated.id}-${targetStatus}-${Date.now()}`
      );

      setRequest(updated);
      onStatusUpdated?.(updated);
      toast.success(`Status updated to ${STATUS_CONFIG[targetStatus].label}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update request state.';
      toast.error(msg);
    } finally {
      setTransitioning(false);
    }
  };

  const handleManualSync = async () => {
    if (!request) return;
    setSyncing(true);
    try {
      const res = await syncQueueManager.processQueue();
      await loadRequest();
      if (res.errors === 0) {
        toast.success('Synchronization completed successfully');
      } else {
        toast.warning('Sync attempted, some operations still pending');
      }
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (!open) return null;

  const statusMeta = request ? STATUS_CONFIG[request.status] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border p-0">
        {loading || !request ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading emergency request records...
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-6 py-4 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">ID:</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="font-mono text-xs font-bold text-foreground hover:text-lime inline-flex items-center gap-1 group"
                      title="Click to copy ID"
                    >
                      {request.id}
                      {copied ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </div>
                  <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2.5">
                    <span className="capitalize">{request.category} Emergency</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs uppercase font-mono font-bold px-2 py-0.5',
                        request.severity === 'critical'
                          ? 'border-alert bg-alert/15 text-alert'
                          : request.severity === 'urgent'
                          ? 'border-warning bg-warning/15 text-warning'
                          : 'border-info bg-info/15 text-info'
                      )}
                    >
                      {request.severity}
                    </Badge>
                  </DialogTitle>
                </div>

                {/* Sync status badge */}
                <div className="flex flex-col items-end gap-1">
                  <SyncTruthfulBadge
                    status={request.syncStatus}
                    serverAckTimestamp={request.serverAckTimestamp}
                  />

                  {request.syncStatus !== 'synced' && request.syncStatus !== 'confirmed_by_server' && isOnline && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleManualSync}
                      disabled={syncing}
                      className="h-6 text-[11px] px-2 text-primary hover:text-primary/80"
                    >
                      <RefreshCw className={cn('h-3 w-3 mr-1', syncing && 'animate-spin')} />
                      Sync Now
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Official Disclaimer */}
            <div className="bg-alert/10 border-b border-alert/20 px-6 py-2.5 flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-alert shrink-0 mt-0.5" />
              <span>
                ResQLink coordinates community responders and is <strong>not a replacement</strong> for official emergency services. Call <strong>112 / 100</strong> for government rescue operations.
              </span>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6">
              {/* Lifecycle Status Banner */}
              {statusMeta && (
                <div className={cn('p-4 rounded-xl border flex items-start gap-3', statusMeta.bg, statusMeta.border)}>
                  <div className="p-2 rounded-lg bg-background/50 shrink-0">
                    <LifeBuoy className={cn('h-5 w-5', statusMeta.text)} />
                  </div>
                  <div>
                    <div className={cn('text-sm font-bold', statusMeta.text)}>
                      {statusMeta.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {statusMeta.desc}
                    </div>
                  </div>
                </div>
              )}

              {/* Main Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> People in Need
                  </div>
                  <div className="text-base font-bold text-foreground mt-1">
                    {request.numberOfPeople}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Reported
                  </div>
                  <div className="text-xs font-semibold text-foreground mt-1">
                    {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <HeartPulse className="h-3 w-3" /> Medical Triage
                  </div>
                  <div className="text-xs font-bold text-foreground mt-1 capitalize">
                    {request.medicalPriority || 'None'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Assigned Volunteer
                  </div>
                  <div className="text-xs font-semibold text-foreground mt-1 truncate">
                    {request.assignedVolunteerId ? 'Assigned' : 'Unassigned'}
                  </div>
                </div>
              </div>

              {/* Emergency Description */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Description of Distress
                </div>
                <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {request.description}
                </div>
              </div>

              {/* Required Resources */}
              {request.requiredResources && request.requiredResources.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Required Relief Supplies & Equipment
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {request.requiredResources.map((res, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-secondary/60 text-foreground border-border text-xs px-2.5 py-1"
                      >
                        {res}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Location Details */}
              <div className="space-y-2 p-3.5 rounded-xl border border-border bg-card">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-lime" /> Location & Coordinates
                </div>

                <div className="text-sm font-semibold text-foreground">
                  {request.locationDescription || 'Location description not specified'}
                </div>

                {request.latitude !== null && request.longitude !== null ? (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">
                      GPS: {request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}
                    </span>
                    {request.locationAccuracy !== null && (
                      <span className="text-[11px] text-lime font-mono">
                        (±{request.locationAccuracy}m accuracy)
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    No GPS coordinates attached (manual location only).
                  </div>
                )}

                {(() => {
                  const destCoords: [number, number] | null =
                    request.latitude !== null && request.longitude !== null
                      ? [request.latitude, request.longitude]
                      : null;
                  const gmapsUrl = buildGoogleMapsUrl({
                    coords: destCoords,
                    query: request.locationDescription,
                  });
                  if (!gmapsUrl) return null;
                  return (
                    <a
                      href={gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 px-3 rounded-lg bg-info text-white text-xs font-bold shadow-sm hover:bg-info/90 active:scale-95 transition-all text-center"
                    >
                      <Navigation className="h-3.5 w-3.5" /> 📍 Open Turn-by-Turn Directions in Google Maps
                    </a>
                  );
                })()}
              </div>

              {/* Confidential Medical Details */}
              {request.confidentialMedicalDetails && (
                <div className="space-y-2 p-3.5 rounded-xl border border-warning/30 bg-warning/5">
                  <div className="text-xs font-bold uppercase tracking-wider text-warning flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-warning" /> Confidential Medical Record
                  </div>
                  <div className="text-xs text-foreground bg-card/60 p-2.5 rounded-lg border border-warning/20">
                    {request.confidentialMedicalDetails}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    * Restricted visibility. Not exposed on public unauthenticated views.
                  </p>
                </div>
              )}

              {/* Lifecycle State Transitions Controls */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Operational Mission State Controls
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Active -> Assigned */}
                  {request.status === 'active' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleTransition('assigned')}
                      disabled={transitioning}
                      className="bg-warning hover:bg-warning/90 text-charcoal-950 font-bold text-xs"
                    >
                      Dispatch / Assign Responder
                    </Button>
                  )}

                  {/* Assigned -> In Progress */}
                  {request.status === 'assigned' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleTransition('in-progress')}
                      disabled={transitioning}
                      className="bg-info hover:bg-info/90 text-charcoal-950 font-bold text-xs"
                    >
                      Start En Route (In Progress)
                    </Button>
                  )}

                  {/* In Progress -> Fulfilled */}
                  {request.status === 'in-progress' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleTransition('fulfilled')}
                      disabled={transitioning}
                      className="bg-success hover:bg-success/90 text-charcoal-950 font-bold text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Mark Fulfilled & Rescued
                    </Button>
                  )}

                  {/* Assigned / In Progress -> Active (Reopen) */}
                  {(request.status === 'assigned' || request.status === 'in-progress') && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTransition('active')}
                      disabled={transitioning}
                      className="text-xs border-border"
                    >
                      Reopen to Pool (Unassign)
                    </Button>
                  )}

                  {/* Active / Assigned / In Progress -> Cancelled */}
                  {request.status !== 'fulfilled' && request.status !== 'cancelled' && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleTransition('cancelled')}
                      disabled={transitioning}
                      className="text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Cancel Request
                    </Button>
                  )}

                  {(request.status === 'fulfilled' || request.status === 'cancelled') && (
                    <span className="text-xs text-muted-foreground italic">
                      This request has reached terminal state ({request.status}). No further transitions allowed.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-card/50 px-6 py-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="border-border text-foreground text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
