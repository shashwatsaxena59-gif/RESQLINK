import { useState, useEffect, useCallback } from 'react';
import {
  Siren,
  HeartPulse,
  LifeBuoy,
  Droplets,
  BedDouble,
  MapPin,
  LocateFixed,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Navigation,
  Eye,
  ArrowLeft,
  Mic,
  Send,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { VoiceMicButton } from '@/components/voice-mic-button';
import { useModalBack } from '@/hooks/use-modal-back';
import type {
  EmergencyRequest,
  RequestCategoryType,
} from '@/domain/models/emergency-request';
import { createEmergencyRequest } from '@/domain/services/request-service';
import { emergencyRequestRepo } from '@/storage/repositories/emergency-request-repository';
import { syncQueueManager } from '@/sync/sync-queue';
import { toast } from 'sonner';

export interface EmergencySosDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOnline: boolean;
  region?: string;
  locationLabel?: string;
  onSuccess: (request: EmergencyRequest) => void;
  onViewDetails?: (requestId: string) => void;
  onTrackOnMap?: (request: EmergencyRequest) => void;
}

// Basic emergency needs only: Medicine, Food, Shelter, Rescue
const BASIC_NEEDS: Array<{
  value: RequestCategoryType;
  label: string;
  sublabel: string;
  icon: typeof HeartPulse;
  color: string;
  activeBorder: string;
  activeBg: string;
}> = [
  {
    value: 'medical',
    label: 'Medicine & First Aid',
    sublabel: 'Urgent medical aid or drugs',
    icon: HeartPulse,
    color: 'text-red-500',
    activeBorder: 'border-red-500 ring-2 ring-red-500/30',
    activeBg: 'bg-red-500/15',
  },
  {
    value: 'food',
    label: 'Food & Clean Water',
    sublabel: 'Drinking water & rations',
    icon: Droplets,
    color: 'text-blue-400',
    activeBorder: 'border-blue-500 ring-2 ring-blue-500/30',
    activeBg: 'bg-blue-500/15',
  },
  {
    value: 'shelter',
    label: 'Emergency Shelter',
    sublabel: 'Safe place & dry beds',
    icon: BedDouble,
    color: 'text-amber-400',
    activeBorder: 'border-amber-500 ring-2 ring-amber-500/30',
    activeBg: 'bg-amber-500/15',
  },
  {
    value: 'rescue',
    label: 'Rescue / Evacuation',
    sublabel: 'Trapped or in immediate danger',
    icon: LifeBuoy,
    color: 'text-orange-500',
    activeBorder: 'border-orange-500 ring-2 ring-orange-500/30',
    activeBg: 'bg-orange-500/15',
  },
];

export function EmergencySosDrawer({
  open,
  onOpenChange,
  isOnline,
  region = 'ncr',
  locationLabel = 'Delhi NCR',
  onSuccess,
  onViewDetails,
  onTrackOnMap,
}: EmergencySosDrawerProps) {
  useModalBack(open, () => onOpenChange(false));

  // Selected essential emergency need (default: medicine)
  const [selectedCategory, setSelectedCategory] = useState<RequestCategoryType>('medical');
  const [locationText, setLocationText] = useState(locationLabel);
  const [contactPhone, setContactPhone] = useState('');
  const [details, setDetails] = useState('');

  // GPS state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<EmergencyRequest | null>(null);

  const voice = useVoiceInput();

  // Auto-acquire GPS on open (best effort, non-blocking)
  const requestGps = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsDetected(true);
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setSelectedCategory('medical');
      setLocationText(locationLabel || 'Delhi NCR');
      setContactPhone('');
      setDetails('');
      setIsSubmitting(false);
      setCreatedRequest(null);
      requestGps();
    }
  }, [open, locationLabel, requestGps]);

  // Handle immediate SOS Broadcast
  const handleBroadcast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // 1. Resolve coordinates safely
      const defaultLat = region === 'badrinath' ? 30.556 : 28.6139;
      const defaultLng = region === 'badrinath' ? 79.564 : 77.209;
      const resolvedLat = latitude !== null ? latitude : defaultLat;
      const resolvedLng = longitude !== null ? longitude : defaultLng;

      const categoryMeta = BASIC_NEEDS.find((b) => b.value === selectedCategory);
      const catTitle = categoryMeta ? categoryMeta.label : 'Emergency Aid';

      // 2. Safe description (always non-empty)
      const userText = details.trim();
      const resolvedDescription = userText.length >= 3
        ? userText
        : `Urgent ${catTitle} needed at ${locationText || locationLabel || 'current location'}.`;

      // 3. Unique idempotency key
      const idempotencyKey = `sos-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const requestInput = {
        category: selectedCategory,
        description: resolvedDescription,
        severity: 'critical' as const,
        medicalPriority: selectedCategory === 'medical' ? ('immediate' as const) : ('none' as const),
        confidentialMedicalDetails: null,
        numberOfPeople: 1,
        requiredResources: [catTitle],
        latitude: resolvedLat,
        longitude: resolvedLng,
        locationAccuracy: gpsDetected ? 15 : null,
        locationDescription: locationText.trim() || locationLabel || 'Emergency Zone',
        contactName: 'Emergency Citizen',
        contactPhone: contactPhone.trim() || undefined,
        idempotencyKey,
        syncStatus: 'pending' as const,
      };

      // 4. Create domain request
      const newRequest = createEmergencyRequest(requestInput);

      // 5. Save to local IndexedDB (instant offline storage)
      try {
        await emergencyRequestRepo.save(newRequest);
      } catch (err) {
        console.warn('IDB save warning:', err);
      }

      // 6. Enqueue into sync queue outbox
      try {
        await syncQueueManager.enqueue(
          'emergency_request',
          newRequest.id,
          'create',
          newRequest as unknown as Record<string, unknown>,
          newRequest.idempotencyKey
        );
      } catch (err) {
        console.warn('SyncQueue notice:', err);
      }

      // 7. Post to server sync endpoint if online (non-blocking)
      if (typeof window !== 'undefined') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        fetch('/api/sync/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            id: newRequest.id,
            category: newRequest.category,
            priority: 'critical',
            title: `🚨 ${catTitle} Needed`,
            details: resolvedDescription,
            items: [catTitle],
            contactName: newRequest.contactName || 'Citizen',
            contactPhone: newRequest.contactPhone || '',
            distanceMiles: 0.1,
            createdAt: Date.now(),
            latitude: resolvedLat,
            longitude: resolvedLng,
            coords: { y: resolvedLat, x: resolvedLng },
            peopleCount: 1,
            locationDescription: locationText.trim() || locationLabel,
            isUserCreated: true,
            region,
          }),
          signal: controller.signal,
        })
          .catch(() => {})
          .finally(() => clearTimeout(timeout));
      }

      // 8. Immediately notify App.tsx to update live feed and map!
      onSuccess(newRequest);

      // 9. Show confirmation view
      setCreatedRequest(newRequest);
      toast.success('🚨 SOS Broadcast Sent!', {
        description: `${catTitle} signal dispatched to nearby responders & map.`,
      });
    } catch (err: unknown) {
      console.error('SOS submission error:', err);
      toast.error('Could not complete SOS broadcast. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto p-0 bg-background border-l border-border"
      >
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 sm:px-6 py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-secondary active:scale-95 transition-all"
              aria-label="Close"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600/20 ring-1 ring-red-500/40">
              <Siren className="h-5 w-5 text-red-500 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Emergency SOS
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase font-mono px-1.5 py-0',
                    isOnline
                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                      : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                  )}
                >
                  {isOnline ? 'Online' : 'Offline Mode'}
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate">
                Broadcast instant distress signal to nearby volunteers & map
              </SheetDescription>
            </div>
          </div>
        </div>

        {/* Successful Broadcast Confirmation Screen */}
        {createdRequest ? (
          <div className="p-6 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/20 ring-4 ring-emerald-500/30">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                🚨 SOS Signal Sent!
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Your emergency request is registered and active on the live disaster feed and map.
              </p>
            </div>

            {/* Quick Summary Box */}
            <div className="p-4 rounded-xl bg-card border border-border text-left space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Emergency Need:</span>
                <span className="font-bold text-foreground capitalize flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {createdRequest.category}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-bold text-red-500 uppercase">BROADCAST ACTIVE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium text-foreground truncate max-w-[200px]">
                  {createdRequest.locationDescription || `${createdRequest.latitude?.toFixed(4)}, ${createdRequest.longitude?.toFixed(4)}`}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5 pt-2">
              {onTrackOnMap && (
                <Button
                  type="button"
                  onClick={() => {
                    onTrackOnMap(createdRequest);
                    onOpenChange(false);
                  }}
                  className="w-full h-11 bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-sm shadow-lg shadow-primary/20"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  View On Live Map
                </Button>
              )}
              {onViewDetails && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onViewDetails(createdRequest.id);
                    onOpenChange(false);
                  }}
                  className="w-full h-10 border-border text-foreground hover:bg-secondary text-xs font-semibold"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Request Details
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full text-muted-foreground hover:text-foreground text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* Simplified Emergency Form */
          <form onSubmit={handleBroadcast} className="p-4 sm:p-5 space-y-5">
            {/* 1. What is needed? */}
            <div className="space-y-2.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>1. What do you need?</span>
                <span className="text-[10px] text-red-400 font-semibold">Select One</span>
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                {BASIC_NEEDS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedCategory === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSelectedCategory(item.value)}
                      className={cn(
                        'p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 active:scale-95',
                        isSelected
                          ? `${item.activeBorder} ${item.activeBg}`
                          : 'border-border bg-card/80 hover:bg-secondary/60 hover:border-border/80'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn('p-2 rounded-lg bg-black/20', item.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {isSelected && (
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-400/40" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground leading-tight">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                          {item.sublabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Location */}
            <div className="space-y-2 rounded-xl p-3.5 border border-border bg-card/50">
              <div className="flex items-center justify-between">
                <Label htmlFor="sos-location" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-red-500" />
                  <span>2. Your Location</span>
                </Label>
                <button
                  type="button"
                  onClick={requestGps}
                  disabled={gpsLoading}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300"
                >
                  {gpsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <LocateFixed className="h-3 w-3" />
                  )}
                  {gpsDetected ? 'GPS Active' : 'Detect GPS'}
                </button>
              </div>

              <Input
                id="sos-location"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Area, landmark, street (e.g. Near Geeta Colony Camp)"
                className="bg-secondary/40 border-border text-xs h-9"
              />

              {latitude !== null && longitude !== null && (
                <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span>✓ GPS:</span>
                  <span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
                </div>
              )}
            </div>

            {/* 3. Phone Number (Optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="sos-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-sky-400" />
                <span>3. Contact Phone (Optional)</span>
              </Label>
              <Input
                id="sos-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210 (so responders can call you)"
                className="bg-secondary/40 border-border text-xs h-9"
              />
            </div>

            {/* 4. Quick Details / Voice (Optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sos-details" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  4. Short Note (Optional)
                </Label>
                <VoiceMicButton
                  listening={voice.listening}
                  supported={voice.supported}
                  size="sm"
                  onStart={() => {
                    voice.start((transcript) => {
                      setDetails((prev) => (prev ? `${prev} ${transcript}` : transcript));
                    });
                  }}
                  onStop={() => voice.stop()}
                />
              </div>
              <Textarea
                id="sos-details"
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. 2 children with fever, flood water reached door..."
                className="bg-secondary/40 border-border text-xs resize-none"
              />
            </div>

            {/* Big High-Priority Broadcast Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  'w-full py-4 px-4 rounded-2xl font-black text-sm uppercase tracking-wide text-white',
                  'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500',
                  'shadow-lg shadow-red-600/30 active:scale-[0.98] transition-all',
                  'flex items-center justify-center gap-2 border border-red-400/30'
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Broadcasting SOS Signal...</span>
                  </>
                ) : (
                  <>
                    <Siren className="h-5 w-5 animate-bounce" />
                    <span>🚨 BROADCAST SOS REQUEST NOW</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                Sends instant high-priority alert to all active responders and live map.
              </p>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
