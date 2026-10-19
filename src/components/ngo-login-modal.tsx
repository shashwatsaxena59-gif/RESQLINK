/**
 * ngo-login-modal.tsx
 *
 * Combined NGO Registration + Login modal.
 * Also handles volunteer "login" (volunteers pick their name from
 * the NGO's member list — no password needed).
 *
 * Tabs:
 *   • NGO Login
 *   • NGO Register
 *   • Volunteer Login   (pick NGO → pick your name)
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge }    from '@/components/ui/badge';
import {
  Building2, User, Phone, Mail, MapPin, Lock,
  Eye, EyeOff, Loader2, AlertCircle, CheckCircle2,
  Users, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  setNgoSession,
  setVolunteerSession,
} from '@/lib/ngo-auth';
import type { NgoProfile, VolunteerMember } from '@/types';

// Use relative /api/ paths so the Vite dev-server proxy (→ localhost:3001)
// forwards them correctly — works on localhost AND on LAN IP addresses.
// In production, the Express server must be behind the same origin or a
// reverse-proxy that exposes /api/* at the same host.

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(
      'Cannot reach the ResQLink server. Make sure the backend is running ' +
      '(cd server && npm run dev) and try again.'
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `Server error (HTTP ${res.status})`);
  return data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { 'Accept': 'application/json' },
    });
  } catch (networkErr) {
    throw new Error('Cannot reach the ResQLink server. Make sure the backend is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `Server error (HTTP ${res.status})`);
  return data as T;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 flex items-center gap-1 text-xs text-alert"><AlertCircle className="h-3 w-3" />{msg}</p>;
}

function FormField({
  label, id, type = 'text', value, onChange, placeholder, error, required, icon: Icon, rightSlot,
}: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  error?: string; required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}{required && <span className="ml-0.5 text-alert">*</span>}
      </Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            Icon ? 'pl-9' : '',
            rightSlot ? 'pr-10' : '',
            error ? 'border-alert focus-visible:ring-alert/30' : '',
          )}
        />
        {rightSlot && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      <FieldError msg={error} />
    </div>
  );
}

// ── NGO Login Tab ─────────────────────────────────────────────────────────────

function NgoLoginTab({ onSuccess }: { onSuccess: () => void }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setErr('Email and password are required.'); return; }
    setBusy(true); setErr('');
    try {
      const data = await apiPost<{ ok: boolean; ngo: Omit<NgoProfile, 'passwordHash'> }>(
        '/api/ngo/login', { email: email.trim(), password }
      );
      setNgoSession(data.ngo);
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <FormField
        label="Email" id="ngo-login-email" type="email"
        value={email} onChange={setEmail}
        placeholder="ngo@example.org" required icon={Mail}
      />
      <FormField
        label="Password" id="ngo-login-password"
        type={showPw ? 'text' : 'password'}
        value={password} onChange={setPassword}
        placeholder="••••••••" required icon={Lock}
        rightSlot={
          <button type="button" onClick={() => setShowPw((p) => !p)}
            className="text-muted-foreground hover:text-foreground transition-colors">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      {err && (
        <div className="flex items-center gap-2 rounded-lg bg-alert/10 p-3 text-sm text-alert">
          <AlertCircle className="h-4 w-4 shrink-0" />{err}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : 'Sign In as NGO'}
      </Button>
    </form>
  );
}

// ── NGO Register Tab ──────────────────────────────────────────────────────────

function NgoRegisterTab({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', contactPerson: '', phone: '', email: '',
    serviceArea: '', description: '', password: '', confirmPassword: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState('');
  const [success, setSuccess] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { name, contactPerson, phone, email, password, confirmPassword } = form;
    if (!name || !contactPerson || !phone || !email || !password) {
      setErr('Please fill in all required fields.'); return;
    }
    if (password !== confirmPassword) { setErr('Passwords do not match.'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }

    setBusy(true); setErr('');
    try {
      const data = await apiPost<{ ok: boolean; ngo: Omit<NgoProfile, 'passwordHash'> }>(
        '/api/ngo/register', {
          name: form.name.trim(),
          contactPerson: form.contactPerson.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          serviceArea: form.serviceArea.trim(),
          description: form.description.trim(),
          password,
        }
      );
      setNgoSession(data.ngo);
      setSuccess(true);
      setTimeout(onSuccess, 1200);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="font-semibold text-foreground">NGO Registered Successfully!</p>
        <p className="text-sm text-muted-foreground">Opening your dashboard…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2">
      <FormField label="NGO Name" id="reg-name" value={form.name} onChange={set('name')}
        placeholder="e.g. National Relief Foundation" required icon={Building2} />
      <FormField label="Contact Person" id="reg-contact" value={form.contactPerson} onChange={set('contactPerson')}
        placeholder="Full name of coordinator" required icon={User} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Phone" id="reg-phone" value={form.phone} onChange={set('phone')}
          placeholder="+91 98100 00000" required icon={Phone} />
        <FormField label="Email" id="reg-email" type="email" value={form.email} onChange={set('email')}
          placeholder="ngo@org.in" required icon={Mail} />
      </div>
      <FormField label="Service Area" id="reg-area" value={form.serviceArea} onChange={set('serviceArea')}
        placeholder="e.g. Delhi NCR, Uttarakhand" icon={MapPin} />
      <div className="space-y-1.5">
        <Label htmlFor="reg-desc" className="text-sm font-medium">Description</Label>
        <Textarea
          id="reg-desc" value={form.description}
          onChange={(e) => set('description')(e.target.value)}
          placeholder="Brief description of your NGO's mission and capabilities…"
          className="min-h-[72px] resize-none text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Password" id="reg-pw" type={showPw ? 'text' : 'password'}
          value={form.password} onChange={set('password')} placeholder="Min 6 chars" required icon={Lock}
          rightSlot={
            <button type="button" onClick={() => setShowPw((p) => !p)}
              className="text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          } />
        <FormField label="Confirm Password" id="reg-cpw" type={showPw ? 'text' : 'password'}
          value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" required icon={Lock} />
      </div>
      {err && (
        <div className="flex items-center gap-2 rounded-lg bg-alert/10 p-3 text-sm text-alert">
          <AlertCircle className="h-4 w-4 shrink-0" />{err}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering…</> : 'Register NGO'}
      </Button>
    </form>
  );
}

// ── Volunteer Login Tab ───────────────────────────────────────────────────────

interface NgoStoreSnapshot {
  ngos: Omit<NgoProfile, 'passwordHash'>[];
  volunteers: VolunteerMember[];
  tasks: unknown[];
  version: number;
}

function VolunteerLoginTab({ onSuccess }: { onSuccess: () => void }) {
  const [step,        setStep]        = useState<'pick-ngo' | 'pick-vol'>('pick-ngo');
  const [ngos,        setNgos]        = useState<Omit<NgoProfile, 'passwordHash'>[]>([]);
  const [vols,        setVols]        = useState<VolunteerMember[]>([]);
  const [selectedNgo, setSelectedNgo] = useState<Omit<NgoProfile, 'passwordHash'> | null>(null);
  const [ngoSearch,   setNgoSearch]   = useState('');
  const [volSearch,   setVolSearch]   = useState('');
  const [busy,        setBusy]        = useState(false);
  const [err,         setErr]         = useState('');

  // Load NGO list on mount
  useEffect(() => {
    setBusy(true);
    apiGet<NgoStoreSnapshot>('/api/ngo-store')
      .then((data) => {
        setNgos(data.ngos ?? []);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not load NGO list.'))
      .finally(() => setBusy(false));
  }, []); // empty dep array = run once on mount

  async function pickNgo(ngo: Omit<NgoProfile, 'passwordHash'>) {
    setSelectedNgo(ngo);
    setBusy(true); setErr('');
    try {
      const members = await apiGet<VolunteerMember[]>(`/api/ngo/${ngo.id}/volunteers`);
      setVols(members.filter((v) => v.status !== 'OFFLINE'));
      setStep('pick-vol');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not load volunteers.');
    } finally {
      setBusy(false);
    }
  }

  function pickVolunteer(vol: VolunteerMember) {
    if (!selectedNgo) return;
    setVolunteerSession(vol, selectedNgo.id, selectedNgo.name);
    onSuccess();
  }

  const filteredNgos = ngos.filter((n) =>
    n.name.toLowerCase().includes(ngoSearch.toLowerCase()) ||
    n.serviceArea.toLowerCase().includes(ngoSearch.toLowerCase())
  );

  const filteredVols = vols.filter((v) =>
    v.fullName.toLowerCase().includes(volSearch.toLowerCase())
  );

  if (busy) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === 'pick-ngo') {
    return (
      <div className="space-y-3 pt-2">
        <p className="text-sm text-muted-foreground">Select your NGO to see your name on the volunteer list.</p>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search NGOs…" value={ngoSearch} onChange={(e) => setNgoSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {err && <div className="rounded-lg bg-alert/10 p-3 text-sm text-alert">{err}</div>}
        {filteredNgos.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {ngos.length === 0
              ? 'No NGOs registered yet. Ask your NGO admin to register first.'
              : 'No NGOs match your search.'}
          </div>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {filteredNgos.map((ngo) => (
              <button
                key={ngo.id}
                onClick={() => pickNgo(ngo)}
                className="group flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <div>
                  <p className="font-medium text-foreground">{ngo.name}</p>
                  <p className="text-xs text-muted-foreground">{ngo.serviceArea || 'Service area not specified'}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // pick-vol step
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setStep('pick-ngo'); setSelectedNgo(null); setVols([]); setVolSearch(''); }}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Change NGO
        </button>
        <Badge variant="secondary" className="text-xs">{selectedNgo?.name}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Select your name from the list:</p>
      <div className="relative">
        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search your name…" value={volSearch}
          onChange={(e) => setVolSearch(e.target.value)} className="pl-9"
        />
      </div>
      {err && <div className="rounded-lg bg-alert/10 p-3 text-sm text-alert">{err}</div>}
      {filteredVols.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {vols.length === 0
            ? 'No active volunteers in this NGO. Ask your NGO admin to add you.'
            : 'No volunteers match your search.'}
        </div>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {filteredVols.map((vol) => (
            <button
              key={vol.id}
              onClick={() => pickVolunteer(vol)}
              className="group flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <div>
                <p className="font-medium text-foreground">{vol.fullName}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {vol.skills.slice(0, 3).map((s) => (
                    <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{s}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  vol.status === 'AVAILABLE'
                    ? 'bg-success/15 text-success'
                    : vol.status === 'ON_MISSION'
                    ? 'bg-warning/15 text-warning'
                    : 'bg-muted/50 text-muted-foreground',
                )}>
                  {vol.status === 'AVAILABLE' ? 'Available' : vol.status === 'ON_MISSION' ? 'On Mission' : 'Offline'}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface NgoLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register' | 'volunteer';
  onNgoLoggedIn: () => void;
  onVolunteerLoggedIn: () => void;
}

export function NgoLoginModal({
  open,
  onOpenChange,
  defaultTab = 'login',
  onNgoLoggedIn,
  onVolunteerLoggedIn,
}: NgoLoginModalProps) {
  const [tab, setTab] = useState<string>(defaultTab);

  function handleNgoSuccess() {
    onOpenChange(false);
    onNgoLoggedIn();
  }

  function handleVolSuccess() {
    onOpenChange(false);
    onVolunteerLoggedIn();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-full max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            NGO & Volunteer Access
          </DialogTitle>
          <DialogDescription>
            Sign in as an NGO administrator, register your organisation, or log in as a volunteer.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login"     className="text-xs sm:text-sm"><Lock  className="mr-1 h-3.5 w-3.5" />NGO Login</TabsTrigger>
            <TabsTrigger value="register"  className="text-xs sm:text-sm"><Building2 className="mr-1 h-3.5 w-3.5" />Register</TabsTrigger>
            <TabsTrigger value="volunteer" className="text-xs sm:text-sm"><Users className="mr-1 h-3.5 w-3.5" />Volunteer</TabsTrigger>
          </TabsList>

          <TabsContent value="login"     className="mt-4"><NgoLoginTab    onSuccess={handleNgoSuccess}  /></TabsContent>
          <TabsContent value="register"  className="mt-4"><NgoRegisterTab onSuccess={handleNgoSuccess}  /></TabsContent>
          <TabsContent value="volunteer" className="mt-4"><VolunteerLoginTab onSuccess={handleVolSuccess} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
