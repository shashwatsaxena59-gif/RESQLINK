import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, HeartPulse, Droplets, BedDouble, Users, LifeBuoy,
  Navigation, Clock, MapPin, PersonStanding, CheckCircle2,
  CloudOff, Trash2, RefreshCw, AlertTriangle, ChevronRight,
  Brain, X, ShieldAlert, Users2, Flame, Mountain, Building2,
  Phone, ExternalLink, Copy, Check, ArrowLeft, Zap, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, buildGoogleMapsUrl } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CATEGORY_META, PRIORITY_META } from '@/types';
import type { AidRequest, RequestCategory, FilterCategory } from '@/types';
import type { QueuedRequest } from '@/hooks/use-network';
import { timeAgo } from '@/hooks/use-network';
import type { NavDestination } from '@/hooks/use-navigation';
import { useModalBack } from '@/hooks/use-modal-back';
import { VolunteerRegistrationModal } from '@/components/volunteer-registration-modal';
import { hasVolunteerProfile } from '@/lib/volunteer-profile';

// ─────────────────────────────────────────────────────────────────────────────
// Priority configuration (AI triage)
// ─────────────────────────────────────────────────────────────────────────────
type TriagePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const TRIAGE_PRIORITY_META: Record<TriagePriority, {
  label: string; bg: string; text: string; border: string; ring: string;
}> = {
  CRITICAL: { label: 'CRITICAL', bg: 'bg-alert/15',   text: 'text-alert',   border: 'border-alert/40',   ring: 'ring-alert/30'   },
  HIGH:     { label: 'HIGH',     bg: 'bg-warning/15',  text: 'text-warning', border: 'border-warning/40', ring: 'ring-warning/30' },
  MEDIUM:   { label: 'MEDIUM',   bg: 'bg-info/15',     text: 'text-info',    border: 'border-info/40',    ring: 'ring-info/30'    },
  LOW:      { label: 'LOW',      bg: 'bg-success/15',  text: 'text-success', border: 'border-success/40', ring: 'ring-success/30' },
};

const PRIORITY_ORDER: Record<TriagePriority, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
};

const INCIDENT_ICON: Record<string, React.ReactNode> = {
  Flood:               <Droplets      className="h-3.5 w-3.5" />,
  Fire:                <Flame         className="h-3.5 w-3.5" />,
  Earthquake:          <Building2     className="h-3.5 w-3.5" />,
  Landslide:           <Mountain      className="h-3.5 w-3.5" />,
  'Medical Emergency': <HeartPulse    className="h-3.5 w-3.5" />,
  Trapped:             <AlertTriangle className="h-3.5 w-3.5" />,
  'Building Collapse': <Building2     className="h-3.5 w-3.5" />,
  Unknown:             <AlertTriangle className="h-3.5 w-3.5" />,
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
const ICON_MAP: Record<RequestCategory, typeof HeartPulse> = {
  medical:    HeartPulse,
  food:       Droplets,
  shelter:    BedDouble,
  volunteers: Users,
  rescue:     LifeBuoy,
};

export function computeRequestCoords(request: AidRequest, region: string = 'ncr'): [number, number] {
  const center: [number, number] = region === 'badrinath' ? [30.5560, 79.5640] : [28.6139, 77.2090];
  if (request.coords && request.coords.y > 15 && request.coords.x > 60) {
    return [request.coords.y, request.coords.x];
  }
  const x = request.coords?.x ?? 50;
  const y = request.coords?.y ?? 50;
  return [
    center[0] + (y - 50) * 0.0012,
    center[1] + (x - 50) * 0.0012,
  ];
}

interface LiveFeedProps {
  requests: AidRequest[];
  filter: FilterCategory;
  isOnline: boolean;
  queue: QueuedRequest[];
  queueCount: number;
  onClearQueue: () => void;
  onRemoveFromQueue: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  locationLabel?: string;
  onNavigate?: (dest: NavDestination) => void;
  region?: string;
  onResolveRequest?: (id: string) => void;
  onHelpRequest?: (id: string) => void;
  onCancelHelp?: (id: string) => void;
  onRestoreRequests?: () => void;
  onOpenDetailsModal?: (id: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Triage detail modal
// ─────────────────────────────────────────────────────────────────────────────
function TriageDetailModal({
  item,
  onClose,
  onNavigate,
}: {
  item: QueuedRequest;
  onClose: () => void;
  onNavigate?: (dest: NavDestination) => void;
}) {
  useModalBack(true, onClose);

  const t = item.triage;
  const prioMeta = t ? TRIAGE_PRIORITY_META[t.priority] : null;

  const vulnList: string[] = [];
  if (t?.vulnerable) {
    if (t.vulnerable.elderly  > 0) vulnList.push(`${t.vulnerable.elderly} Elderly`);
    if (t.vulnerable.children > 0) vulnList.push(`${t.vulnerable.children} Children`);
    if (t.vulnerable.pregnant > 0) vulnList.push('Pregnant person');
    if (t.vulnerable.disabled > 0) vulnList.push('Person with disability');
    if (t.vulnerable.injured  > 0) vulnList.push(`${t.vulnerable.injured} Injured`);
  }

  const parsedCoords = ((): [number, number] | null => {
    if (!item.coords) return null;
    const parts = item.coords.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
    return null;
  })();

  const locationStr = item.location || null;
  const hasLocation = !!(parsedCoords || locationStr);
  const googleMapsUrl = buildGoogleMapsUrl({ coords: parsedCoords, query: locationStr });

  const handleViewOnMap = () => {
    if (!onNavigate) return;
    onNavigate({
      id: item.id,
      name: item.triage?.incidentType ? `${item.triage.incidentType} Emergency` : 'Emergency',
      address: item.location || 'Location unavailable',
      coords: parsedCoords ?? [0, 0],
      type: item.category,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto
        rounded-2xl border border-border bg-card shadow-2xl animate-float-up">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-border
          bg-card/95 px-4 py-3 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50
              px-2.5 py-1.5 text-xs font-bold hover:bg-secondary active:scale-95 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-alert/15">
            <Brain className="h-4 w-4 text-alert" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-alert">AI Triage Analysis</p>
            <p className="text-[10px] text-muted-foreground">{timeAgo(item.createdAt)} · {item.location || 'Location unknown'}</p>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Priority banner */}
          {prioMeta ? (
            <div className={cn('rounded-xl border p-3.5 flex items-center gap-3', prioMeta.bg, prioMeta.border)}>
              <AlertTriangle className={cn('h-5 w-5 shrink-0', prioMeta.text)} />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Priority</p>
                <p className={cn('text-2xl font-extrabold leading-tight', prioMeta.text)}>{t!.priority}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[9px] text-muted-foreground">Parsed by</p>
                <p className="text-[10px] font-semibold text-foreground capitalize">
                  {t!.parsedBy === 'gemini' ? '✦ Gemini AI' : '⚡ Offline'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              AI Triage: Not available for this request
            </div>
          )}

          {t && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <DetailBlock label="Incident Type">
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    <span className="text-alert">{INCIDENT_ICON[t.incidentType]}</span>
                    {t.incidentType}
                  </div>
                </DetailBlock>
                <DetailBlock label="Location">
                  {hasLocation ? (
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold">{item.location || 'See coordinates'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {onNavigate && (
                          <button onClick={handleViewOnMap}
                            className="flex items-center gap-1 rounded-md border border-info/30 bg-info/10
                              px-2 py-1 text-[10px] font-semibold text-info hover:bg-info/20 transition-colors">
                            <MapPin className="h-3 w-3" /> View on Map
                          </button>
                        )}
                        {googleMapsUrl && (
                          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-md border border-border bg-secondary/40
                              px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-secondary transition-colors">
                            <ExternalLink className="h-3 w-3" /> Google Maps ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Location unavailable</p>
                  )}
                </DetailBlock>
                <DetailBlock label="People Affected">
                  <p className="text-sm font-bold">{t.people !== null ? `${t.people} people` : 'Unknown'}</p>
                </DetailBlock>
                <DetailBlock label="Vulnerable People">
                  {vulnList.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {vulnList.map((v, i) => (
                        <span key={i} className="rounded-md border border-warning/25 bg-warning/10
                          px-1.5 py-0.5 text-[10px] font-semibold text-warning">{v}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">None reported</p>
                  )}
                </DetailBlock>
              </div>

              {t.dangerIndicators.length > 0 && (
                <DetailBlock label="Danger Details">
                  <div className="flex flex-wrap gap-1">
                    {t.dangerIndicators.map((d, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-md border border-alert/20
                        bg-alert/10 px-2 py-0.5 text-[10px] font-medium text-alert">
                        <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> {d}
                      </span>
                    ))}
                  </div>
                </DetailBlock>
              )}

              {t.priorityReasons.length > 0 && (
                <DetailBlock label="AI Priority Reasons">
                  <ul className="space-y-1">
                    {t.priorityReasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <ChevronRight className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', prioMeta?.text ?? 'text-muted-foreground')} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </DetailBlock>
              )}

              {t.requiredResources.length > 0 && (
                <DetailBlock label="Required Resources">
                  <div className="flex flex-wrap gap-1.5">
                    {t.requiredResources.map((r, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-md border border-info/25
                        bg-info/10 px-2 py-1 text-[10px] font-bold text-info">
                        <CheckCircle2 className="h-2.5 w-2.5" /> {r}
                      </span>
                    ))}
                  </div>
                </DetailBlock>
              )}
            </>
          )}

          {item.contact && (
            <DetailBlock label="Contact">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Phone className="h-3.5 w-3.5 text-info" />
                <a href={`tel:${item.contact.replace(/[\s\-().]/g,'')}`}
                  className="text-info hover:underline">{item.contact}</a>
              </div>
            </DetailBlock>
          )}

          {item.coords && (
            <DetailBlock label="GPS Coordinates">
              <p className="font-mono text-xs text-foreground">{item.coords}</p>
            </DetailBlock>
          )}

          <DetailBlock label="Original User Message">
            <blockquote className="border-l-2 border-alert/40 pl-3 text-xs italic text-muted-foreground leading-relaxed">
              "{t?.rawMessage || item.details}"
            </blockquote>
          </DetailBlock>

          <div className="flex items-center gap-2 pt-1">
            <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
              📍 {item.location || 'Region unknown'}
            </span>
            <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
              🕐 {timeAgo(item.createdAt)}
            </span>
          </div>

          <p className="text-center text-[10px] text-muted-foreground/60 pt-1">
            ⚠ AI-assisted triage · Verify with responders on ground · Call <strong>112</strong> for life-threatening emergencies
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</p>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue item row
// ─────────────────────────────────────────────────────────────────────────────
function QueueItem({
  item,
  onViewDetails,
  onResolve,
}: {
  item: QueuedRequest;
  onViewDetails: () => void;
  onResolve: (id: string) => void;
}) {
  const t = item.triage;
  const prioMeta = t ? TRIAGE_PRIORITY_META[t.priority] : null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onViewDetails}
        className={cn(
          'w-full text-left rounded-xl border p-3 transition-all hover:shadow-md active:scale-[0.99]',
          prioMeta
            ? cn(prioMeta.bg, prioMeta.border, 'hover:opacity-90')
            : 'bg-card border-border hover:bg-secondary/40',
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
            {prioMeta ? (
              <span className={cn(
                'rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border',
                prioMeta.bg, prioMeta.text, prioMeta.border,
              )}>
                {t!.priority === 'CRITICAL' ? '🚨 ' : t!.priority === 'HIGH' ? '🟠 ' : t!.priority === 'MEDIUM' ? '🟡 ' : '🟢 '}
                {t!.priority}
              </span>
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {t && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                  <span className="text-alert">{INCIDENT_ICON[t.incidentType]}</span>
                  {t.incidentType}
                </span>
              )}
              {t?.people != null && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Users2 className="h-2.5 w-2.5" /> {t.people} people
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
              <MapPin className="inline h-2.5 w-2.5 mr-0.5" />
              {item.location || item.details?.slice(0, 40) || item.category}
            </p>
            {t && Object.values(t.vulnerable).some(v => v > 0) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {t.vulnerable.elderly  > 0 && <span className="text-[9px] font-semibold text-warning bg-warning/10 border border-warning/20 rounded px-1 py-0.5">{t.vulnerable.elderly} Elderly</span>}
                {t.vulnerable.children > 0 && <span className="text-[9px] font-semibold text-info bg-info/10 border border-info/20 rounded px-1 py-0.5">{t.vulnerable.children} Children</span>}
                {t.vulnerable.pregnant > 0 && <span className="text-[9px] font-semibold text-info bg-info/10 border border-info/20 rounded px-1 py-0.5">Pregnant</span>}
                {t.vulnerable.injured  > 0 && <span className="text-[9px] font-semibold text-alert bg-alert/10 border border-alert/20 rounded px-1 py-0.5">{t.vulnerable.injured} Injured</span>}
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-[9px] text-muted-foreground">{timeAgo(item.createdAt)}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </button>

      {/* Resolve button — sibling, NOT nested inside card */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="w-full rounded-lg border border-border bg-secondary/20 py-1 text-[10px]
              font-semibold text-muted-foreground hover:bg-success/10 hover:border-success/30
              hover:text-success transition-colors"
          >
            ✓ Mark Resolved
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this emergency as resolved?</AlertDialogTitle>
            <AlertDialogDescription>
              This emergency will be removed from the active response queue permanently.
              {t && (
                <span className="block mt-2 font-medium text-foreground">
                  {t.incidentType} · {t.priority} · {item.location || 'Unknown location'}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onResolve(item.id)}
              className="bg-success text-white hover:bg-success/90"
            >
              Mark Resolved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveFeed
// ─────────────────────────────────────────────────────────────────────────────
export function LiveFeed({
  requests, filter, isOnline, queue, queueCount, onClearQueue, onRemoveFromQueue,
  selectedId, onSelect, locationLabel = 'Delhi NCR', onNavigate, region = 'ncr',
  onResolveRequest, onHelpRequest, onCancelHelp, onRestoreRequests, onOpenDetailsModal,
}: LiveFeedProps) {
  const [search, setSearch]               = useState('');
  const [selectedQueue, setSelectedQueue] = useState<QueuedRequest | null>(null);
  const [helpingRequest, setHelpingRequest] = useState<AidRequest | null>(null);

  const filtered = requests.filter((r) => {
    if (filter !== 'all' && r.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q)       ||
             r.details.toLowerCase().includes(q)     ||
             (r.contactName ? r.contactName.toLowerCase().includes(q) : false) ||
             (r.contactPhone ? r.contactPhone.toLowerCase().includes(q) : false) ||
             r.items.some((i) => i.toLowerCase().includes(q));
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.isUserCreated && !b.isUserCreated) return -1;
    if (!a.isUserCreated && b.isUserCreated) return 1;
    const order = { critical: 0, urgent: 1, moderate: 2 };
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
    return a.distanceMiles - b.distanceMiles;
  });

  const sortedQueue = [...queue].sort((a, b) => {
    const pa = a.triage?.priority;
    const pb = b.triage?.priority;
    if (pa && pb) {
      const diff = PRIORITY_ORDER[pa] - PRIORITY_ORDER[pb];
      if (diff !== 0) return diff;
    } else if (pa) return -1;
    else if (pb)    return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <>
      <div className="flex h-full flex-col">

        {/* ── Panel header ── */}
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Response Feed</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                <MapPin className="inline h-2.5 w-2.5 mr-0.5 text-info" />
                {locationLabel} · {sorted.length} active request{sorted.length !== 1 ? 's' : ''}
              </p>
            </div>
            {/* Online/offline pill */}
            <span className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
              isOnline
                ? 'border-success/25 bg-success/10 text-success'
                : 'border-warning/25 bg-warning/10 text-warning',
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-success animate-pulse' : 'bg-warning')} />
              {isOnline ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requests, names, phones…"
              className={cn(
                'w-full rounded-xl border border-border bg-secondary/30 pl-9 pr-3 py-2',
                'text-xs text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:border-info/50 focus:ring-1 focus:ring-info/20',
                'transition-colors',
              )}
            />
          </div>
        </div>

        {/* ── Emergency Queue ── */}
        {queueCount > 0 && (
          <div className="shrink-0 border-b border-border bg-alert/[0.04] px-4 py-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-alert/15">
                  {isOnline
                    ? <RefreshCw className="h-3 w-3 animate-spin text-success" />
                    : <CloudOff className="h-3 w-3 text-warning" />
                  }
                </div>
                <div>
                  <p className="text-xs font-bold text-alert flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Emergency Queue · {queueCount} active
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isOnline ? 'Syncing to network…' : 'Offline — syncs on reconnect'}
                    {' · Tap for full triage'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClearQueue}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5
                  text-[10px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
            <div className="space-y-1.5">
              {sortedQueue.map((q) => (
                <QueueItem
                  key={q.id}
                  item={q}
                  onViewDetails={() => setSelectedQueue(q)}
                  onResolve={onRemoveFromQueue}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Request list ── */}
        <ScrollArea className="flex-1">
          <div className="space-y-2.5 p-3 pb-24">
            {sorted.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-border mb-4">
                  <CheckCircle2 className="h-7 w-7 text-success/50" />
                </div>
                <p className="text-sm font-semibold text-foreground">No active requests</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search ? 'Try a different search term' : 'No requests in this category'}
                </p>
                {onRestoreRequests && (
                  <button
                    type="button"
                    onClick={onRestoreRequests}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50
                      px-4 py-2 text-xs font-bold hover:bg-secondary active:scale-95 transition-all shadow-sm"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Restore Cleared Requests
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {sorted.map((r, i) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    selected={selectedId === r.id}
                    onSelect={() => onSelect(r.id)}
                    onHelp={(req) => setHelpingRequest(req)}
                    onOpenDetails={onOpenDetailsModal ? () => onOpenDetailsModal(r.id) : undefined}
                    index={i}
                    locationLabel={locationLabel}
                    onNavigate={onNavigate}
                    region={region}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Triage detail modal */}
      {selectedQueue && (
        <TriageDetailModal
          item={selectedQueue}
          onClose={() => setSelectedQueue(null)}
          onNavigate={onNavigate}
        />
      )}

      {/* Responder modal */}
      {helpingRequest && (
        <HelpOfferModal
          request={helpingRequest}
          onClose={() => setHelpingRequest(null)}
          onNavigate={onNavigate}
          region={region}
          locationLabel={locationLabel}
          onHelpRequest={onHelpRequest}
          onResolve={onResolveRequest}
          onCancelHelp={onCancelHelp}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HelpOfferModal ("I Can Help")
// ─────────────────────────────────────────────────────────────────────────────
function HelpOfferModal({
  request,
  onClose,
  onNavigate,
  region = 'ncr',
  locationLabel = 'Delhi NCR',
  onHelpRequest,
  onResolve,
  onCancelHelp,
}: {
  request: AidRequest;
  onClose: () => void;
  onNavigate?: (dest: NavDestination) => void;
  region?: string;
  locationLabel?: string;
  onHelpRequest?: (id: string) => void;
  onResolve?: (id: string) => void;
  onCancelHelp?: (id: string) => void;
}) {
  useModalBack(true, onClose);

  const [copied, setCopied] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    request.items.forEach((item) => { init[item] = true; });
    return init;
  });
  const [committed, setCommitted] = useState(request.status === 'in-progress');
  const [volunteerModalOpen, setVolunteerModalOpen] = useState(false);

  const meta   = CATEGORY_META[request.category];
  const Icon   = ICON_MAP[request.category] || HeartPulse;
  const prio   = PRIORITY_META[request.priority];
  const coords = computeRequestCoords(request, region);
  const googleMapsUrl = buildGoogleMapsUrl({ coords, query: locationLabel });

  const handleCopyPhone = () => {
    if (!request.contactPhone) return;
    navigator.clipboard.writeText(request.contactPhone.replace(/\s+/g, '')).then(() => {
      setCopied(true);
      toast.success('Phone number copied to clipboard', { description: request.contactPhone });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStartNavigation = () => {
    if (onNavigate) {
      onNavigate({
        id: request.id,
        name: request.title,
        address: `${request.contactName} · ${locationLabel}`,
        coords,
        phone: request.contactPhone,
        type: request.category,
      });
    }
    onClose();
  };

  // ── Final confirmation — only runs AFTER volunteer registration succeeds,
  //    or immediately if the volunteer has already registered before.
  const finalizeConfirmation = () => {
    setCommitted(true);
    if (onResolve) onResolve(request.id);
    toast.success('🤝 Help Confirmed & Request Resolved!', {
      description: request.contactPhone
        ? `Emergency request for ${request.contactName} (${request.contactPhone}) marked as resolved. Starting route...`
        : `Emergency request for ${request.contactName} marked as resolved. Starting route...`,
    });
    setTimeout(() => { handleStartNavigation(); }, 600);
  };

  // "Confirm Help" no longer finalises immediately. A registered volunteer is
  // required first; returning volunteers are recognised and skip the popup.
  const handleConfirmHelp = () => {
    if (committed) return;
    if (hasVolunteerProfile()) {
      finalizeConfirmation();
    } else {
      setVolunteerModalOpen(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[92dvh] overflow-y-auto
        rounded-2xl border border-border bg-card shadow-2xl animate-float-up">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-border
          bg-card/95 px-4 py-3 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50
              px-2.5 py-1.5 text-xs font-bold hover:bg-secondary active:scale-95 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', meta.bg)}>
            <Icon className={cn('h-4 w-4', meta.text)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', meta.bg, meta.text)}>
                {meta.label}
              </span>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase', prio.bg, prio.text)}>
                {prio.label}
              </span>
              {request.isUserCreated && (
                <span className="rounded-md bg-alert/15 border border-alert/30 px-1.5 py-0.5 text-[9px] font-extrabold text-alert uppercase">
                  ⚡ Live SOS
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold truncate mt-0.5">{request.title}</h2>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">

          {/* Situation details */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Emergency Situation
            </p>
            <p className="text-xs sm:text-sm leading-relaxed text-foreground break-words">{request.details}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t border-border/50 pt-2.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-info" /> {timeAgo(request.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-info" /> {request.distanceMiles} mi away
              </span>
              {request.peopleCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-info" /> {request.peopleCount} people
                </span>
              )}
            </div>
          </div>

          {/* Contact card — only shown when requester provided a phone number */}
          {request.contactPhone ? (
            <div className="rounded-xl border-2 border-success/35 bg-success/[0.05] p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/20 text-success">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-success">Requester Contact</p>
                    <p className="text-sm font-bold text-foreground">{request.contactName || 'Emergency Requester'}</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-success bg-success/15 px-2.5 py-1 rounded-lg border border-success/25">
                  {request.contactPhone}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`tel:${request.contactPhone.replace(/[\s\-().]/g, '')}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-success px-3 py-2.5
                    text-xs font-bold text-white shadow-md shadow-success/20 hover:bg-success/90 active:scale-95 transition-all"
                >
                  <Phone className="h-3.5 w-3.5" /> Call Now
                </a>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border
                    bg-secondary/60 px-3 py-2.5 text-xs font-bold hover:bg-secondary active:scale-95 transition-all"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy Number'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-secondary/20 p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/80 text-muted-foreground">
                  {request.triage ? <Brain className="h-4 w-4 text-warning" /> : <Phone className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {request.contactName || (request.triage ? 'AI Triage Request' : 'Emergency Requester')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {request.triage ? 'Submitted via AI Triage (No phone number attached)' : 'No phone number provided'}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-muted-foreground bg-secondary/80 px-2 py-1 rounded-md border border-border">
                {request.triage ? 'AI TRIAGE' : 'NO PHONE'}
              </span>
            </div>
          )}

          {/* Location & nav card */}
          <div className="rounded-xl border border-info/25 bg-info/[0.04] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/20 text-info">
                  <Navigation className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-info">Location & Route</p>
                  <p className="text-xs font-bold text-foreground">{locationLabel}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded border border-border">
                {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStartNavigation}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-info px-3 py-2.5
                  text-xs font-bold text-white shadow-md shadow-info/20 hover:bg-info/90 active:scale-95 transition-all"
              >
                <MapPin className="h-3.5 w-3.5" /> Navigate on Map
              </button>
              {googleMapsUrl && (
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border
                    bg-secondary/60 px-3 py-2.5 text-xs font-bold hover:bg-secondary active:scale-95 transition-all text-center">
                  <ExternalLink className="h-3.5 w-3.5" /> Google Maps ↗
                </a>
              )}
            </div>
          </div>

          {/* Items checklist */}
          {request.items.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Items Needed — Select what you can provide
              </p>
              <div className="space-y-1.5">
                {request.items.map((item, idx) => (
                  <label
                    key={idx}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium cursor-pointer transition-colors',
                      selectedItems[item]
                        ? 'border-success/40 bg-success/10 text-foreground'
                        : 'border-border bg-secondary/20 text-muted-foreground hover:bg-secondary/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedItems[item]}
                      onChange={(e) => setSelectedItems((prev) => ({ ...prev, [item]: e.target.checked }))}
                      className="rounded border-border text-success focus:ring-success h-3.5 w-3.5"
                    />
                    <span className="flex-1">{item}</span>
                    {selectedItems[item] && (
                      <span className="text-[10px] font-bold text-success">✓ Providing</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleConfirmHelp}
              disabled={committed}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5',
                'text-sm font-bold text-white shadow-lg transition-all active:scale-[0.99]',
                committed
                  ? 'bg-success/70 cursor-not-allowed'
                  : 'bg-success shadow-success/25 hover:bg-success/90',
              )}
            >
              <Users className="h-4 w-4" />
              {committed ? '✓ Help Confirmed & Resolved!' : '🤝 Confirm Help & Resolve Request'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStartNavigation}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-info/30
                  bg-info/10 hover:bg-info/20 text-info px-3 py-2.5 text-xs font-bold active:scale-95 transition-all"
              >
                <MapPin className="h-3.5 w-3.5" /> Navigate
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border
                  bg-secondary/60 hover:bg-secondary px-3 py-2.5 text-xs font-bold
                  text-muted-foreground active:scale-95 transition-all"
              >
                Close
              </button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground/60 pt-1">
              Ensure personal safety first · Dial <strong>112</strong> for life-threatening emergencies
            </p>
          </div>
        </div>
      </div>

      {/* Volunteer registration popup — opened by "Confirm Help" and gated so
          the request is only confirmed after successful registration. Closing
          it without registering keeps this popup safe for retry. */}
      <VolunteerRegistrationModal
        open={volunteerModalOpen}
        onOpenChange={setVolunteerModalOpen}
        onComplete={finalizeConfirmation}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RequestCard
// ─────────────────────────────────────────────────────────────────────────────
interface RequestCardProps {
  request: AidRequest;
  selected: boolean;
  onSelect: () => void;
  onHelp: (req: AidRequest) => void;
  onOpenDetails?: () => void;
  index: number;
  locationLabel?: string;
  onNavigate?: (dest: NavDestination) => void;
  region?: string;
}

function RequestCard({
  request,
  selected,
  onSelect,
  onHelp,
  onOpenDetails,
  index,
  locationLabel = 'Delhi NCR',
  onNavigate,
  region = 'ncr',
}: RequestCardProps) {
  const meta   = CATEGORY_META[request.category];
  const Icon   = ICON_MAP[request.category] || HeartPulse;
  const prio   = PRIORITY_META[request.priority];
  const coords = computeRequestCoords(request, region);
  const isHelping = request.status === 'in-progress';

  /* Priority accent border class */
  const accentClass = request.priority === 'critical'
    ? 'border-l-alert/60'
    : request.priority === 'urgent'
    ? 'border-l-warning/50'
    : 'border-l-info/40';

  const handleDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNavigate) {
      onNavigate({
        id: request.id,
        name: request.title,
        address: `${request.contactName} · ${locationLabel}`,
        coords,
        phone: request.contactPhone,
        type: request.category,
      });
    }
    onSelect();
  };

  const handleHelpClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHelp(request);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20, rotateX: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      whileHover={{ scale: 1.02, rotateY: -3, rotateX: 3, z: 30, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.05 }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
      style={{ transformStyle: 'preserve-3d' }}
      className={cn(
        'group cursor-pointer rounded-2xl border-l-[4px] border border-white/10 bg-card/60 backdrop-blur-xl',
        'p-4 transition-colors outline-none shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)]',
        accentClass,
        selected
          ? 'border-alert/50 bg-secondary/50 shadow-md ring-2 ring-alert/30'
          : 'hover:bg-secondary/40 hover:border-white/20',
        request.isUserCreated && 'ring-1 ring-alert/40 border-alert/40 bg-alert/[0.04]',
        isHelping && 'border-success/40 bg-success/[0.04] ring-1 ring-success/30',
      )}
    >
      {/* Top row — category + priority + time */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', meta.bg)}>
            <Icon className={cn('h-3.5 w-3.5', meta.text)} />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', meta.bg, meta.text)}>
              {meta.label}
            </span>
            <span className={cn(
              'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase',
              request.priority === 'critical'
                ? 'bg-alert/15 text-alert border border-alert/30'
                : request.priority === 'urgent'
                ? 'bg-warning/15 text-warning border border-warning/30'
                : 'bg-info/[12%] text-info border border-info/25',
            )}>
              {prio.label}
            </span>
            {request.isUserCreated && (
              <span className="flex items-center gap-0.5 rounded-md bg-alert/[12%] border border-alert/25 px-1.5 py-0.5 text-[9px] font-extrabold text-alert uppercase">
                <Zap className="h-2.5 w-2.5" /> Live SOS
              </span>
            )}
            {isHelping && (
              <span className="flex items-center gap-0.5 rounded-md bg-success/[12%] border border-success/25 px-1.5 py-0.5 text-[9px] font-extrabold text-success uppercase">
                <Users className="h-2.5 w-2.5" /> Helping
              </span>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
          <Clock className="h-2.5 w-2.5" /> {timeAgo(request.createdAt)}
        </span>
      </div>

      {/* Title + details */}
      <h3 className="mt-2 text-sm font-bold leading-snug break-words text-foreground">{request.title}</h3>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed break-words">{request.details}</p>

      {/* Contact row */}
      {request.contactPhone && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg
          bg-secondary/30 border border-border/60 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="text-xs font-semibold text-foreground truncate">{request.contactName}</span>
            <span className="text-[10px] font-mono text-muted-foreground truncate hidden sm:block">
              {request.contactPhone}
            </span>
          </div>
          <a
            href={`tel:${request.contactPhone.replace(/[\s\-().]/g, '')}`}
            onClick={(e) => e.stopPropagation()}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-success/15 border border-success/25
              px-2.5 py-1 text-[10px] font-bold text-success hover:bg-success/25 transition-colors"
          >
            <Phone className="h-2.5 w-2.5" /> Call
          </a>
        </div>
      )}

      {/* Items chips */}
      {request.items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {request.items.slice(0, 4).map((item, i) => (
            <span key={i} className="rounded-md border border-border bg-secondary/40
              px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {item}
            </span>
          ))}
          {request.items.length > 4 && (
            <span className="rounded-md border border-border bg-secondary/40
              px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              +{request.items.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Footer row — distance + actions */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3 text-info" /> {request.distanceMiles} mi
          </span>
          {request.peopleCount > 0 && (
            <span className="flex items-center gap-0.5">
              <PersonStanding className="h-3 w-3" /> {request.peopleCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenDetails && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails();
              }}
              className="flex items-center gap-1 rounded-lg border border-border
                bg-secondary/40 px-2 py-1.5 text-[11px] font-bold text-foreground
                hover:bg-secondary transition-all active:scale-95"
              title="Inspect Details"
            >
              <FileText className="h-3 w-3 text-lime" />
              <span className="hidden sm:inline">Details</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleHelpClick}
            className={cn(
              'flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white',
              'shadow-sm transition-all active:scale-95',
              isHelping
                ? 'bg-emerald-600 shadow-emerald-600/20 ring-1 ring-emerald-400/30'
                : 'bg-success shadow-success/20 hover:bg-success/90',
            )}
          >
            <Users className="h-3 w-3" />
            {isHelping ? 'Helping' : 'I Can Help'}
          </button>
          <button
            type="button"
            onClick={handleDirections}
            className="flex items-center gap-1 rounded-lg border border-border
              bg-secondary/40 px-2.5 py-1.5 text-[11px] font-bold
              hover:bg-secondary transition-all active:scale-95"
          >
            <Navigation className="h-3 w-3 text-info" />
            <span className="hidden sm:inline">Directions</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
