import { useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  ChevronDown,
  Clock3,
  HeartPulse,
  ImagePlus,
  MapPin,
  Package,
  Phone,
  Send,
  Truck,
  UtensilsCrossed,
  Users,
  X,
  Zap,
  Mic,
  ArrowLeft,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { VolunteerOffer, VolunteerOfferCategory } from '@/types';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { VoiceMicButton } from '@/components/voice-mic-button';
import { useModalBack } from '@/hooks/use-modal-back';

interface OfferHelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offers: VolunteerOffer[];
  loading: boolean;
  error: string | null;
  onCreate: (input: {
    category: VolunteerOfferCategory;
    title: string;
    details: string;
    quantity: string;
    contactName: string;
    contactPhone: string;
    location: string;
    photo: File | null;
  }) => Promise<void>;
}

const OFFER_CATEGORIES: { value: VolunteerOfferCategory; label: string; icon: typeof HeartPulse }[] = [
  { value: 'medical', label: 'Medical supplies or skills', icon: HeartPulse },
  { value: 'food', label: 'Prepared food or meals', icon: UtensilsCrossed },
  { value: 'water', label: 'Drinking water or ORS', icon: Zap },
  { value: 'shelter', label: 'A room, bed, or space', icon: Users },
  { value: 'transport', label: 'Transport or delivery', icon: Truck },
  { value: 'rescue', label: 'Rescue or field support', icon: BadgeCheck },
  { value: 'other', label: 'Other useful resource', icon: Package },
];

export function OfferHelpPanel({ open, onOpenChange, offers, loading, error, onCreate }: OfferHelpPanelProps) {
  useModalBack(open, () => onOpenChange(false));

  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<VolunteerOfferCategory>('medical');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [quantity, setQuantity] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [voiceField, setVoiceField] = useState<string | null>(null);
  const voice = useVoiceInput();

  const handleVoice = (field: 'title' | 'details' | 'quantity' | 'location' | 'contactName' | 'contactPhone') => {
    if (voice.listening) {
      voice.stop();
      setVoiceField(null);
      return;
    }
    setVoiceField(field);
    const setters = { title: setTitle, details: setDetails, quantity: setQuantity, location: setLocation, contactName: setContactName, contactPhone: setContactPhone };
    const current = { title, details, quantity, location, contactName, contactPhone };
    voice.start((text) => {
      setters[field](text || current[field]);
    });
  };

  const canSubmit = useMemo(
    () => title.trim() && details.trim() && quantity.trim() && contactName.trim() && contactPhone.trim() && location.trim(),
    [title, details, quantity, contactName, contactPhone, location]
  );

  const resetForm = () => {
    setTitle('');
    setDetails('');
    setQuantity('');
    setContactName('');
    setContactPhone('');
    setLocation('');
    setPhoto(null);
    setPhotoError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePhoto = (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoError('Use a JPG, PNG, or WebP image under 5 MB.');
      return;
    }
    setPhotoError('');
    setPhoto(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        category,
        title: title.trim(),
        details: details.trim(),
        quantity: quantity.trim(),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        location: location.trim(),
        photo,
      });
      resetForm();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : 'Your offer could not be posted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 sm:px-5 py-3 sm:py-3.5 backdrop-blur-xl">
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/15 ring-1 ring-success/30">
              <BadgeCheck className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-bold">Offer Help</SheetTitle>
              <SheetDescription className="text-xs truncate">Tell nearby people what you can provide</SheetDescription>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100dvh-75px)] sm:h-[calc(100dvh-88px)]">
          <div className="space-y-5 sm:space-y-6 px-3.5 sm:px-5 py-4 sm:py-5">
            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 rounded-xl border border-success/25 bg-success/[0.04] p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">Post an available resource</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Your offer will be visible to people seeking help.</p>
                </div>
                {success && <span className="text-xs font-bold text-success shrink-0">Posted successfully</span>}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm font-medium">What can you provide?</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as VolunteerOfferCategory)}>
                  <SelectTrigger className="h-10 sm:h-11 border-border bg-secondary/30 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OFFER_CATEGORIES.map((item) => {
                      const Icon = item.icon;
                      return <SelectItem key={item.value} value={item.value}><span className="flex items-center gap-2 text-xs sm:text-sm"><Icon className="h-4 w-4 text-muted-foreground" />{item.label}</span></SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:space-y-2"><div className="flex items-center justify-between"><Label className="text-xs sm:text-sm font-medium">Short title</Label><VoiceMicButton listening={voice.listening && voiceField === 'title'} supported={voice.supported} onStart={() => handleVoice('title')} onStop={() => { voice.stop(); setVoiceField(null); }} size="sm" /></div><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 20 meal boxes near Mayur Vihar" className={cn('h-10 sm:h-11 border-border bg-secondary/30 text-xs sm:text-sm', voice.listening && voiceField === 'title' && 'border-alert/40 ring-1 ring-alert/20')} /></div>
              <div className="space-y-1.5 sm:space-y-2"><div className="flex items-center justify-between"><Label className="text-xs sm:text-sm font-medium">Details</Label><VoiceMicButton listening={voice.listening && voiceField === 'details'} supported={voice.supported} onStart={() => handleVoice('details')} onStop={() => { voice.stop(); setVoiceField(null); }} size="sm" /></div><Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe what is available, timing, pickup or delivery details..." className={cn('min-h-[80px] resize-none border-border bg-secondary/30 text-xs sm:text-sm', voice.listening && voiceField === 'details' && 'border-alert/40 ring-1 ring-alert/20')} /></div>

              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1.5 sm:space-y-2"><div className="flex items-center justify-between"><Label className="text-xs sm:text-sm font-medium">Quantity or capacity</Label><VoiceMicButton listening={voice.listening && voiceField === 'quantity'} supported={voice.supported} onStart={() => handleVoice('quantity')} onStop={() => { voice.stop(); setVoiceField(null); }} size="sm" /></div><Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 20 meals, 2 seats" className={cn('h-10 sm:h-11 border-border bg-secondary/30 text-xs sm:text-sm', voice.listening && voiceField === 'quantity' && 'border-alert/40 ring-1 ring-alert/20')} /></div>
                <div className="space-y-1.5 sm:space-y-2"><div className="flex items-center justify-between"><Label className="text-xs sm:text-sm font-medium">Area in NCR</Label><VoiceMicButton listening={voice.listening && voiceField === 'location'} supported={voice.supported} onStart={() => handleVoice('location')} onStop={() => { voice.stop(); setVoiceField(null); }} size="sm" /></div><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. ITO, East Delhi" className={cn('h-10 sm:h-11 border-border bg-secondary/30 text-xs sm:text-sm', voice.listening && voiceField === 'location' && 'border-alert/40 ring-1 ring-alert/20')} /></div>
              </div>

              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1.5 sm:space-y-2"><div className="flex items-center justify-between"><Label className="text-xs sm:text-sm font-medium">Your name</Label><VoiceMicButton listening={voice.listening && voiceField === 'contactName'} supported={voice.supported} onStart={() => handleVoice('contactName')} onStop={() => { voice.stop(); setVoiceField(null); }} size="sm" /></div><Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name or organisation" className={cn('h-10 sm:h-11 border-border bg-secondary/30 text-xs sm:text-sm', voice.listening && voiceField === 'contactName' && 'border-alert/40 ring-1 ring-alert/20')} /></div>
                <div className="space-y-1.5 sm:space-y-2"><div className="flex items-center justify-between"><Label className="text-xs sm:text-sm font-medium">Phone / WhatsApp</Label><VoiceMicButton listening={voice.listening && voiceField === 'contactPhone'} supported={voice.supported} onStart={() => handleVoice('contactPhone')} onStop={() => { voice.stop(); setVoiceField(null); }} size="sm" /></div><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 ..." className={cn('h-10 sm:h-11 border-border bg-secondary/30 text-xs sm:text-sm', voice.listening && voiceField === 'contactPhone' && 'border-alert/40 ring-1 ring-alert/20')} /></div>
              </div>
              {voice.listening && voiceField && (
                <p className="flex items-center gap-1 text-[11px] font-medium text-alert"><Mic className="h-3 w-3 animate-pulse" /> Listening… speak now</p>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Photo (optional)</Label>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} />
                <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-3 text-left transition-colors hover:bg-secondary/40">
                  {photo ? <ImagePlus className="h-5 w-5 text-success shrink-0" /> : <Camera className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{photo?.name || 'Add a photo of the supplies or setup'}</span><span className="block text-[10px] text-muted-foreground">JPG, PNG, or WebP · max 5 MB</span></span>
                  {photo && <X className="h-4 w-4 text-muted-foreground shrink-0" onClick={(e) => { e.stopPropagation(); setPhoto(null); if (fileRef.current) fileRef.current.value = ''; }} />}
                </button>
                {photoError && <p className="text-xs text-alert">{photoError}</p>}
              </div>

              <Button type="submit" disabled={!canSubmit || submitting} className="h-11 w-full bg-success font-bold text-white hover:bg-success/90">
                <Send className="h-4 w-4" /> {submitting ? 'Posting offer...' : 'Post Available Help'}
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">Only share contact details you are comfortable making visible to responders.</p>
            </form>

            <div>
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold">Available from volunteers</h3><p className="text-xs text-muted-foreground">Latest offers shared across the NCR board</p></div><span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success shrink-0">{offers.length} offers</span></div>
              {loading ? <p className="py-8 text-center text-xs text-muted-foreground">Loading volunteer offers...</p> : error ? <p className="rounded-lg border border-alert/30 bg-alert/10 p-3 text-xs text-alert">{error}</p> : offers.length === 0 ? <p className="rounded-lg border border-border p-5 text-center text-xs text-muted-foreground">No offers yet. Be the first to post available help.</p> : <div className="space-y-2.5">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function OfferCard({ offer }: { offer: VolunteerOffer }) {
  const category = OFFER_CATEGORIES.find((item) => item.value === offer.category) ?? OFFER_CATEGORIES[6];
  const Icon = category.icon;
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex gap-3 p-3 sm:p-3.5">
        {offer.photoUrl ? (
          <img src={offer.photoUrl} alt="" className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold leading-tight break-words">{offer.title}</h4>
            <span className="shrink-0 text-[10px] font-bold uppercase text-success">{offer.status}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground break-words">{offer.details}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Package className="h-3 w-3 shrink-0" />{offer.quantity}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{offer.location}</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{offer.contactPhone}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
