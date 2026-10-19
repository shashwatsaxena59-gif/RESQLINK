import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, X, Send, Bot, User, WifiOff,
  Loader2, RotateCcw, Sparkles, Zap, ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { findOfflineAnswer, SUGGESTED_QUESTIONS } from '@/data/help-bot-knowledge';
import type { RegionContext } from '@/data/help-bot-knowledge';
import type { MapRegion } from '@/components/map-view';
import type { Shelter, Resource, AidRequest } from '@/types';
import { useModalBack } from '@/hooks/use-modal-back';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  mode?: 'online' | 'offline';
  ts: number;
}

export interface HelpBotProps {
  region: MapRegion;
  locationLabel: string;
  shelters: Shelter[];
  resources: Resource[];
  requests: AidRequest[];
  isOnline: boolean;
}

const API_BASE   = '';
const TIMEOUT_MS = 10000;

// ─────────────────────────────────────────────────────────────────────────────
// Tiny markdown → React renderer (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function boldify(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (!bullets.length) return;
    nodes.push(
      <ul key={key} className="mt-1 space-y-0.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-1.5 text-xs leading-relaxed">
            <span className="mt-px shrink-0 text-info select-none">•</span>
            <span dangerouslySetInnerHTML={{ __html: boldify(b.replace(/^[•\-*]\s*/, '')) }} />
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) { flush(`ul${idx}`); return; }

    if (/^\d+\.\s/.test(line)) {
      flush(`ul${idx}`);
      nodes.push(
        <p key={idx} className="flex gap-1.5 text-xs leading-relaxed mt-0.5">
          <span className="shrink-0 font-bold text-info">{line.match(/^\d+/)![0]}.</span>
          <span dangerouslySetInnerHTML={{ __html: boldify(line.replace(/^\d+\.\s*/, '')) }} />
        </p>,
      );
    } else if (/^[•\-*]\s/.test(line)) {
      bullets.push(line);
    } else if (/^\*\*(.+)\*\*:?$/.test(line)) {
      flush(`ul${idx}`);
      nodes.push(
        <p key={idx} className="font-bold text-xs mt-1.5 text-foreground"
          dangerouslySetInnerHTML={{ __html: boldify(line) }} />,
      );
    } else {
      flush(`ul${idx}`);
      nodes.push(
        <p key={idx} className="text-xs leading-relaxed mt-0.5"
          dangerouslySetInnerHTML={{ __html: boldify(line) }} />,
      );
    }
  });
  flush('end');
  return <div className="space-y-px">{nodes}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

export function HelpBot({
  region, locationLabel, shelters, resources, requests, isOnline,
}: HelpBotProps) {
  const [open, setOpen]         = useState(false);
  useModalBack(open, () => setOpen(false));

  const [input, setInput]       = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(false);
  const [geminiUp, setGeminiUp] = useState<boolean | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const ctx: RegionContext = { locationLabel, shelters, resources, requests };

  // Scroll to bottom
  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [messages, open]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Probe backend health
  useEffect(() => {
    if (!open || !isOnline) { if (!isOnline) setGeminiUp(false); return; }
    let live = true;
    (async () => {
      try {
        const ctrl = new AbortController();
        const t    = setTimeout(() => ctrl.abort(), 3500);
        const res  = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        const j = await res.json();
        if (live) setGeminiUp(!!(j.ok && j.gemini));
      } catch {
        if (live) setGeminiUp(false);
      }
    })();
    return () => { live = false; };
  }, [open, isOnline]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: uid(), role: 'bot', mode: 'offline', ts: Date.now(),
        text: `👋 Hi! I'm the **ResQLinkk Disaster Assistant**.

I can help you with:
• Finding **shelters, food, water, and medical help** in ${locationLabel}
• **Disaster safety** — earthquakes, floods, landslides, fires
• **How to use** this app (SOS, map, regions, etc.)

What do you need?`,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Region change notification
  const prevRegion = useRef(region);
  useEffect(() => {
    if (prevRegion.current === region) return;
    prevRegion.current = region;
    if (!open || messages.length === 0) return;
    setMessages(prev => [...prev, {
      id: uid(), role: 'bot', mode: geminiUp ? 'online' : 'offline', ts: Date.now(),
      text: `📍 Switched to **${locationLabel}**. I now have the latest shelters, resources, and data for this region. What would you like to know?`,
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, locationLabel]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;

    setMessages(prev => [...prev, { id: uid(), role: 'user', text: q, ts: Date.now() }]);
    setInput('');
    setLoading(true);

    let reply = '';
    let mode: 'online' | 'offline' = 'offline';

    // Try Gemini backend
    if (isOnline && geminiUp !== false) {
      let gps: string | undefined;
      if (navigator.geolocation) {
        await new Promise<void>(resolve => {
          navigator.geolocation.getCurrentPosition(
            p => { gps = `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`; resolve(); },
            () => resolve(),
            { timeout: 2000, maximumAge: 30000 },
          );
        });
      }
      try {
        const ctrl = new AbortController();
        const t    = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        const res  = await fetch(`${API_BASE}/api/chat`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            message: q,
            context: {
              region, locationLabel,
              shelters: shelters.map(s => ({
                name: s.name, address: s.address,
                capacity: s.capacity, occupied: s.occupied,
                status: s.status, amenities: s.amenities,
              })),
              resources: resources.map(r => ({
                type: r.type, name: r.name, address: r.address,
                status: r.status, phone: r.phone, tags: r.tags,
              })),
              activeRequests: requests.map(r => ({
                category: r.category, priority: r.priority,
                title: r.title, peopleCount: r.peopleCount,
              })),
              gps,
            },
          }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (res.ok) {
          const j = await res.json();
          if (j.reply) { reply = j.reply; mode = 'online'; setGeminiUp(true); }
          else setGeminiUp(false);
        } else {
          setGeminiUp(false);
        }
      } catch {
        setGeminiUp(false);
      }
    }

    // Offline fallback
    if (!reply) {
      reply = findOfflineAnswer(q, ctx)
        ?? "I'm not sure about that. Try asking about shelters, food, medical help, disaster safety, or how to use the app.";
      mode = 'offline';
    }

    setLoading(false);
    setMessages(prev => [...prev, { id: uid(), role: 'bot', text: reply, mode, ts: Date.now() }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isOnline, geminiUp, region, locationLabel, shelters, resources, requests]);

  const clearChat = () => {
    setMessages([{
      id: uid(), role: 'bot', mode: 'offline', ts: Date.now(),
      text: `Chat cleared. Ask me anything about **${locationLabel}** resources or disaster safety.`,
    }]);
  };

  const statusLabel = geminiUp === true  ? 'Gemini AI · Online'
    : geminiUp === false                  ? 'Offline Mode'
    :                                       'ResQ Assistant';
  const dotClass = geminiUp === true  ? 'bg-success animate-pulse'
    : geminiUp === false              ? 'bg-warning'
    :                                   'bg-muted-foreground';

  return (
    <>
      {/* ── Floating trigger bubble ── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open Disaster Assistant"
        className={cn(
          'fixed bottom-24 right-4 z-50 lg:bottom-6 lg:right-6',
          'flex flex-col items-center justify-center gap-0.5',
          'h-14 w-14 rounded-2xl',
          'bg-info shadow-2xl text-white',
          'ring-4 ring-info/20 shadow-info/30',
          'transition-all hover:scale-105 active:scale-95',
          open && 'opacity-0 pointer-events-none scale-90',
        )}
      >
        <ShieldCheck className="h-5 w-5" />
        <span className="text-[8px] font-bold tracking-wide leading-none">ResQ AI</span>

        {/* Attention badge — before first open */}
        {messages.length === 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert opacity-60" />
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-alert text-[7px] font-bold text-white">
              AI
            </span>
          </span>
        )}
      </button>

      {/* ── Chat window ── */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />

          <div className={cn(
            'fixed z-50 flex flex-col overflow-hidden',
            'bottom-20 inset-x-3 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[420px]',
            'max-h-[80vh] lg:max-h-[640px]',
            'rounded-2xl border border-border bg-card shadow-2xl',
            'animate-float-up',
          )}>

            {/* ── Header ── */}
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border glass-strong px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50
                  px-2.5 py-1.5 text-xs font-bold hover:bg-secondary active:scale-95 transition-all"
                aria-label="Close assistant"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              {/* Bot avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-info/15 ring-1 ring-info/25">
                <Bot className="h-4 w-4 text-info" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">Disaster Assistant</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', dotClass)} />
                  <span className="text-[10px] text-muted-foreground truncate">{statusLabel}</span>
                  {geminiUp === true  && <Sparkles className="h-2.5 w-2.5 text-info flex-shrink-0" />}
                  {geminiUp === false && <Zap       className="h-2.5 w-2.5 text-warning flex-shrink-0" />}
                </div>
              </div>

              <button
                onClick={clearChat}
                title="Clear chat"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Region context strip ── */}
            <div className="shrink-0 flex items-center gap-2 border-b border-border/40 bg-info/[0.04] px-4 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-info">Region</span>
              <span className="text-[10px] font-semibold text-foreground">{locationLabel}</span>
              <span className="ml-auto text-[9px] text-muted-foreground">
                {shelters.length} shelters · {resources.length} resources · {requests.length} requests
              </span>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn('flex gap-2 animate-slide-in-up', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'bot' && (
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info/15">
                      <Bot className="h-3.5 w-3.5 text-info" />
                    </div>
                  )}

                  <div className={cn(
                    'max-w-[84%] rounded-2xl px-3 py-2',
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-info text-white text-xs'
                      : 'rounded-bl-sm bg-secondary/60 text-foreground border border-border/40',
                  )}>
                    {msg.role === 'bot'
                      ? <Markdown text={msg.text} />
                      : <p className="text-xs leading-relaxed">{msg.text}</p>
                    }
                    {msg.role === 'bot' && msg.mode && (
                      <div className="mt-1.5 flex items-center gap-1">
                        {msg.mode === 'online'
                          ? <><Sparkles className="h-2.5 w-2.5 text-info" /><span className="text-[9px] text-info">Gemini AI</span></>
                          : <><Zap className="h-2.5 w-2.5 text-warning/70" /><span className="text-[9px] text-muted-foreground">Offline</span></>
                        }
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info/15">
                    <Bot className="h-3.5 w-3.5 text-info" />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm border border-border/40 bg-secondary/60 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-info" />
                      <span className="text-[10px] text-muted-foreground">
                        {geminiUp ? 'Asking Gemini AI…' : 'Looking up answer…'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* ── Suggested questions ── */}
            {messages.length <= 1 && !loading && (
              <div className="shrink-0 border-t border-border/50 px-3 py-2.5">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Quick questions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_QUESTIONS.slice(0, 4).map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className={cn(
                        'rounded-full border border-border bg-secondary/40 px-2.5 py-1',
                        'text-[10px] font-medium text-foreground leading-tight',
                        'hover:bg-secondary hover:border-info/35 transition-all active:scale-95',
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Input bar ── */}
            <div className="shrink-0 border-t border-border bg-card/95 px-3 py-3">
              <form
                onSubmit={e => { e.preventDefault(); send(input); }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Ask about ${locationLabel}…`}
                  disabled={loading}
                  className={cn(
                    'flex-1 min-w-0 rounded-xl border border-border bg-secondary/30 px-3 py-2',
                    'text-xs text-foreground placeholder:text-muted-foreground',
                    'focus:outline-none focus:border-info/50 focus:ring-1 focus:ring-info/20',
                    'disabled:opacity-50 transition-colors',
                  )}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                    'bg-info text-white transition-all active:scale-95',
                    'disabled:opacity-40 disabled:cursor-not-allowed hover:bg-info/90',
                  )}
                >
                  {loading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                </button>
              </form>

              <p className="mt-1.5 text-center text-[9px] text-muted-foreground/50">
                {geminiUp
                  ? '✦ Gemini AI · Verify critical info with local authorities'
                  : '⚡ Offline mode · Full safety guidance available'}
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
