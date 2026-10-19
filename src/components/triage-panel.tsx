import { useState, useCallback } from 'react';
import {
  AlertTriangle, Loader2, Send, Mic, RotateCcw,
  CheckCircle2, XCircle, ChevronRight, MapPin,
  Phone, Users, HeartPulse, Droplets, Home, LifeBuoy,
  Zap, ShieldAlert, Brain, RefreshCw, ArrowLeft,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { parseEmergencyMessage } from '@/lib/triage-fallback';
import { matchResources } from '@/lib/triage-resource-match';
import type { TriageResult, MatchedResource, TriagePriority } from '@/types/triage';
import type { Resource } from '@/types';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { VoiceMicButton } from '@/components/voice-mic-button';
import type { NavDestination } from '@/hooks/use-navigation';
import type { QueuedRequest } from '@/hooks/use-network';
import { useModalBack } from '@/hooks/use-modal-back';

const API_BASE = '';

// ── Priority styling ──────────────────────────────────────────────────────────
const PRIORITY_META: Record<TriagePriority, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  CRITICAL: {
    label: 'CRITICAL', bg: 'bg-alert/15', text: 'text-alert', border: 'border-alert/40',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  HIGH: {
    label: 'HIGH', bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/40',
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  MEDIUM: {
    label: 'MEDIUM', bg: 'bg-info/15', text: 'text-info', border: 'border-info/40',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  LOW: {
    label: 'LOW', bg: 'bg-success/15', text: 'text-success', border: 'border-success/40',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
};

const RESOURCE_TYPE_ICON: Record<string, React.ReactNode> = {
  hospital:  <HeartPulse className="h-3.5 w-3.5" />,
  pharmacy:  <HeartPulse className="h-3.5 w-3.5" />,
  food:      <Droplets className="h-3.5 w-3.5" />,
  shelter:   <Home className="h-3.5 w-3.5" />,
  rescue:    <LifeBuoy className="h-3.5 w-3.5" />,
};

const RESOURCE_TYPE_COLOR: Record<string, string> = {
  hospital: 'text-alert bg-alert/10 border-alert/20',
  pharmacy: 'text-info  bg-info/10  border-info/20',
  food:     'text-warning bg-warning/10 border-warning/20',
  shelter:  'text-success bg-success/10 border-success/20',
  rescue:   'text-alert bg-alert/10 border-alert/20',
};

// ── Demo scenarios ────────────────────────────────────────────────────────────
const DEMO_MESSAGES: { label: string; text: string }[] = [
  {
    label: '🌊 Flood — Hinglish',
    text: 'Hum 4 log Yamuna ke paas phas gaye hain, ek elderly person hain aur pani ghar ke first floor tak aa gaya hai.',
  },
  {
    label: '🏔️ Landslide — Chamoli',
    text: 'Landslide near Selang village. Family of 5 trapped, road blocked. 2 children. Need rescue team.',
  },
  {
    label: '🔥 Fire — English',
    text: 'Fire in our building at Laxmi Nagar, 3rd floor. 8 people stuck inside, heavy smoke. Cannot find stairs.',
  },
  {
    label: '🏥 Medical — Hindi',
    text: 'Meri dadi behosh ho gayi hain, oxygen khatam ho raha hai, ambulance nahi aa rahi. Hum Mayur Vihar mein hain.',
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface TriagePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region: string;
  locationLabel: string;
  resources: Resource[];
  isOnline: boolean;
  onEnqueue: (req: QueuedRequest) => void;
  onNavigate?: (dest: NavDestination) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TriagePanel({
  open, onOpenChange, region, locationLabel, resources, isOnline, onEnqueue, onNavigate,
}: TriagePanelProps) {
  useModalBack(open, () => onOpenChange(false));

  const [message, setMessage]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [triage, setTriage]           = useState<TriageResult | null>(null);
  const [matched, setMatched]         = useState<MatchedResource[]>([]);
  const [error, setError]             = useState<string | null>(null);
  const [submitted, setSubmitted]     = useState(false);
  const voice = useVoiceInput();

  const reset = () => {
    setMessage(''); setTriage(null); setMatched([]);
    setError(null); setSubmitted(false);
  };

  // ── Run triage ──────────────────────────────────────────────────────────────
  const runTriage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) { setError('Please describe your emergency situation.'); return; }

    setLoading(true); setError(null); setTriage(null); setMatched([]);

    let triageResult: TriageResult | null = null;

    // Try Gemini backend first
    if (isOnline) {
      try {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res   = await fetch(`${API_BASE}/api/triage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, region, locationLabel }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const json = await res.json();
          if (json.incidentType) {
            triageResult = { ...json, rawMessage: trimmed, parsedBy: 'gemini' } as TriageResult;
          }
        }
      } catch {
        // Fall through to offline parser
      }
    }

    // Offline fallback
    if (!triageResult) {
      const parsed = parseEmergencyMessage(trimmed, region);
      triageResult = { ...parsed, rawMessage: trimmed, parsedBy: 'fallback' };
    }

    const matchedRes = matchResources(triageResult, resources);
    setTriage(triageResult);
    setMatched(matchedRes);
    setLoading(false);

    // ── Auto-enqueue immediately after analysis ────────────────────────────
    const fallbackCoords = region === 'badrinath' ? '30.55600, 79.56400' : '28.61390, 77.20900';
    const req: QueuedRequest = {
      id:       `triage-${Date.now()}`,
      category: (triageResult.medicalEmergency || triageResult.incidentType === 'Medical Emergency')
                  ? 'medical' : 'rescue',
      details:  triageResult.rawMessage,
      items:    triageResult.requiredResources.join(', '),
      contact:  '',
      coords:   fallbackCoords,
      createdAt: Date.now(),
      region,
      location: triageResult.location ?? locationLabel,
      triage: {
        priority:          triageResult.priority,
        incidentType:      triageResult.incidentType,
        people:            triageResult.people,
        vulnerable:        triageResult.vulnerable,
        dangerIndicators:  triageResult.dangerIndicators,
        priorityReasons:   triageResult.priorityReasons,
        requiredResources: triageResult.requiredResources,
        rawMessage:        triageResult.rawMessage,
        parsedBy:          triageResult.parsedBy,
      },
    };
    onEnqueue(req);
  }, [isOnline, region, locationLabel, resources, onEnqueue]);

  const handleSubmit = useCallback(() => {
    if (!triage) return;
    // No-op: triage is auto-enqueued in runTriage.
    // Kept to avoid removing the button entirely in one step — button now just resets.
    setSubmitted(true);
  }, [triage]);

  // ── Priority colours for pulse ring on CRITICAL ───────────────────────────
  const prioMeta = triage ? PRIORITY_META[triage.priority] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 sm:px-6 py-3 sm:py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-secondary active:scale-95 transition-all mr-1"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-alert/15 ring-1 ring-alert/30">
              <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-alert" />
              {triage?.priority === 'CRITICAL' && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-alert" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-bold">AI Emergency Triage</SheetTitle>
              <SheetDescription className="text-xs truncate">
                {triage
                  ? `${triage.parsedBy === 'gemini' ? '✦ Gemini AI' : '⚡ Offline'} · ${locationLabel}`
                  : `Describe your emergency · ${locationLabel}`}
              </SheetDescription>
            </div>
            {triage && (
              <button onClick={reset}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                title="New analysis">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Submitted success state */}
        {submitted ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 ring-2 ring-success/30">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h3 className="mt-4 text-lg font-bold">Request {isOnline ? 'Submitted' : 'Queued'}</h3>
            <p className="mt-1 max-w-[260px] text-sm text-muted-foreground">
              {isOnline
                ? 'Your emergency has been broadcast to nearby responders.'
                : 'Saved offline. Will sync automatically when connected.'}
            </p>
            <Button className="mt-6" variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" /> New Triage
            </Button>
          </div>
        ) : (
          <div className="space-y-4 px-4 sm:px-6 py-4">

            {/* Input area */}
            {!triage && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Describe the emergency
                    </label>
                    <VoiceMicButton
                      listening={voice.listening}
                      supported={voice.supported}
                      onStart={() => voice.start(t => setMessage(t))}
                      onStop={() => voice.stop()}
                      size="sm"
                    />
                  </div>
                  <Textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={`Describe in English, Hindi, or Hinglish…\n\nExample: "Hum 4 log phas gaye hain, ek bujurg hain aur pani first floor tak aa gaya hai."`}
                    className={cn(
                      'min-h-[120px] resize-none border-border bg-secondary/30 text-sm',
                      voice.listening && 'border-alert/40 ring-1 ring-alert/20',
                    )}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runTriage(message); }}
                  />
                  {voice.listening && (
                    <p className="flex items-center gap-1 text-[11px] text-alert font-medium">
                      <Mic className="h-3 w-3 animate-pulse" /> Listening… speak your emergency
                    </p>
                  )}
                  {error && (
                    <p className="flex items-center gap-1 text-xs text-alert">
                      <XCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                    </p>
                  )}
                </div>

                {/* Demo scenarios */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Demo scenarios — tap to try
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DEMO_MESSAGES.map(d => (
                      <button key={d.label} onClick={() => setMessage(d.text)}
                        className="rounded-lg border border-border bg-secondary/30 px-2.5 py-2 text-left text-[10px] font-medium text-foreground hover:bg-secondary transition-colors active:scale-[0.98]">
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => runTriage(message)}
                  disabled={!message.trim() || loading}
                  className="w-full h-11 bg-alert text-white hover:bg-alert/90 font-bold"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing Emergency…</>
                  ) : (
                    <><Brain className="h-4 w-4 mr-2" /> Analyze &amp; Triage</>
                  )}
                </Button>

                <p className="text-center text-[10px] text-muted-foreground">
                  Works offline · Supports English, Hindi &amp; Hinglish
                </p>
              </>
            )}

            {/* Triage result */}
            {triage && !loading && (
              <div className="space-y-4 animate-float-up">

                {/* Emergency card */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center gap-2 border-b border-border bg-secondary/20 px-4 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-alert shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-widest text-alert">Emergency Analysis</span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                      {triage.parsedBy === 'gemini'
                        ? <><Zap className="h-3 w-3 text-info" /> Gemini AI</>
                        : <><Zap className="h-3 w-3 text-warning" /> Offline Parser</>
                      }
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Incident + location */}
                    <div className="grid grid-cols-2 gap-3">
                      <InfoBlock label="Incident Type" value={triage.incidentType} />
                      <InfoBlock
                        label="Location"
                        value={triage.location ?? 'Not specified'}
                        subtext={triage.locationConfidence === 'low' ? '⚠ Please clarify location' : undefined}
                        subtextClass="text-warning"
                      />
                    </div>

                    {/* People */}
                    <div className="grid grid-cols-2 gap-3">
                      <InfoBlock label="People Affected" value={triage.people !== null ? `${triage.people}` : 'Unknown'} />
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Vulnerable</p>
                        <div className="flex flex-wrap gap-1">
                          {triage.vulnerable.elderly  > 0 && <VulnBadge label={`${triage.vulnerable.elderly} Elderly`}  color="text-warning bg-warning/10 border-warning/25" />}
                          {triage.vulnerable.children > 0 && <VulnBadge label={`${triage.vulnerable.children} Children`} color="text-info bg-info/10 border-info/25" />}
                          {triage.vulnerable.pregnant > 0 && <VulnBadge label="Pregnant"                                  color="text-info bg-info/10 border-info/25" />}
                          {triage.vulnerable.disabled > 0 && <VulnBadge label="Disabled"                                  color="text-warning bg-warning/10 border-warning/25" />}
                          {triage.vulnerable.injured  > 0 && <VulnBadge label={`${triage.vulnerable.injured} Injured`}   color="text-alert bg-alert/10 border-alert/25" />}
                          {Object.values(triage.vulnerable).every(v => v === 0) && (
                            <span className="text-[10px] text-muted-foreground">None reported</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Danger indicators */}
                    {triage.dangerIndicators.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Danger Indicators</p>
                        <div className="flex flex-wrap gap-1">
                          {triage.dangerIndicators.map((d, i) => (
                            <span key={i} className="rounded-md border border-alert/20 bg-alert/8 px-2 py-0.5 text-[10px] font-medium text-alert">
                              ⚠ {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Required resources */}
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Required Resources</p>
                      <div className="flex flex-wrap gap-1">
                        {triage.requiredResources.map((r, i) => (
                          <span key={i} className="flex items-center gap-1 rounded-md border border-info/25 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
                            <CheckCircle2 className="h-2.5 w-2.5" /> {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority card */}
                {prioMeta && (
                  <div className={cn('rounded-xl border p-4', prioMeta.bg, prioMeta.border)}>
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', prioMeta.bg)}>
                        <span className={prioMeta.text}>{prioMeta.icon}</span>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Priority Level</p>
                        <p className={cn('text-2xl font-extrabold leading-tight', prioMeta.text)}>
                          {triage.priority}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {triage.priorityReasons.map((r, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs">
                          <ChevronRight className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', prioMeta.text)} />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Location clarification warning */}
                {triage.locationConfidence === 'low' && (
                  <div className="rounded-xl border border-warning/30 bg-warning/8 p-3 flex gap-2">
                    <MapPin className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-warning">Location unclear</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Please add your specific location (neighbourhood, street, or landmark) so responders can reach you faster.
                      </p>
                    </div>
                  </div>
                )}

                {/* Matched resources */}
                {matched.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Nearby Resources Matched
                      </p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        DEMO DATA
                      </span>
                    </div>
                    <div className="space-y-2">
                      {matched.map(r => (
                        <div key={r.id}
                          className="rounded-xl border border-border bg-card p-3 flex items-start gap-3">
                          <div className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs',
                            RESOURCE_TYPE_COLOR[r.type] ?? 'text-info bg-info/10 border-info/20',
                          )}>
                            {RESOURCE_TYPE_ICON[r.type] ?? <LifeBuoy className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold leading-tight">{r.name}</p>
                              <span className={cn(
                                'shrink-0 text-[10px] font-bold uppercase',
                                r.status === 'open' ? 'text-success' : r.status === 'limited' ? 'text-warning' : 'text-alert',
                              )}>
                                {r.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.address}</p>
                            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5 text-info" /> {r.distanceMiles}mi
                              </span>
                              <a href={`tel:${r.phone.replace(/[\s\-().]/g,'')}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-0.5 text-info hover:underline">
                                <Phone className="h-2.5 w-2.5" /> {r.phone}
                              </a>
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground/70 italic">{r.relevanceReason}</p>
                          </div>
                          {onNavigate && (
                            <button
                              onClick={() => onNavigate({ id: r.id, name: r.name, address: r.address, coords: [0,0], phone: r.phone, type: r.type })}
                              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground hover:text-info hover:border-info/40 transition-colors"
                              title="View on map"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auto-queued confirmation — shown as soon as triage completes */}
                <div className="rounded-xl border border-success/30 bg-success/10 p-3 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-success">
                      Emergency added to response queue
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isOnline
                        ? 'Visible to nearby responders in the emergency queue.'
                        : 'Saved offline — will sync when connected.'}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={reset} className="flex-1 h-11">
                    <RotateCcw className="h-4 w-4 mr-2" /> New Analysis
                  </Button>
                </div>

                <p className="text-center text-[10px] text-muted-foreground">
                  ⚠ AI-assisted triage. Always call <strong>112</strong> for immediate life-threatening emergencies.
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Small reusable sub-components ─────────────────────────────────────────────
function InfoBlock({ label, value, subtext, subtextClass }: { label: string; value: string; subtext?: string; subtextClass?: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold text-foreground leading-tight">{value}</p>
      {subtext && <p className={cn('text-[10px] mt-0.5', subtextClass ?? 'text-muted-foreground')}>{subtext}</p>}
    </div>
  );
}

function VulnBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', color)}>
      {label}
    </span>
  );
}
