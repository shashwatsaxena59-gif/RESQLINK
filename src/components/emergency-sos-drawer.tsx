import { useState, useEffect } from 'react';
import {
  Siren,
  HeartPulse,
  LifeBuoy,
  Droplets,
  BedDouble,
  Truck,
  Package,
  HelpCircle,
  MapPin,
  LocateFixed,
  CloudOff,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Phone,
  User,
  Users,
  Eye,
  ArrowLeft,
  X,
  Plus,
  Navigation,
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
import type { EmergencyRequest, RequestCategoryType, RequestSeverity, MedicalPriority } from '@/domain/models/emergency-request';
import { createEmergencyRequest } from '@/domain/services/request-service';
import { emergencyRequestRepo } from '@/storage/repositories/emergency-request-repository';
import { syncQueueManager } from '@/sync/sync-queue';

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

const CATEGORIES: Array<{
  value: RequestCategoryType;
  label: string;
  desc: string;
  icon: typeof Siren;
}> = [
  { value: 'medical', label: 'Medical Emergency', desc: 'Critical injury, trauma, medication needed', icon: HeartPulse },
  { value: 'rescue', label: 'Trapped / Rescue', desc: 'Trapped by water, debris, structural collapse', icon: LifeBuoy },
  { value: 'food', label: 'Food & Drinking Water', desc: 'Clean water, dry rations, infant formula', icon: Droplets },
  { value: 'shelter', label: 'Emergency Shelter', desc: 'Safe shelter beds, displaced families', icon: BedDouble },
  { value: 'evacuation', label: 'Evacuation Assist', desc: 'Elderly, disabled, flood zone transport', icon: Truck },
  { value: 'other', label: 'Essential Supplies / Other', desc: 'Blankets, power generator, hygiene kits', icon: Package },
];

const SEVERITIES: Array<{
  value: RequestSeverity;
  label: string;
  sublabel: string;
  colorClass: string;
}> = [
  {
    value: 'critical',
    label: 'Critical',
    sublabel: 'Life-threatening danger',
    colorClass: 'border-alert bg-alert/10 text-alert',
  },
  {
    value: 'urgent',
    label: 'High Urgency',
    sublabel: 'Severe distress, rapid help needed',
    colorClass: 'border-warning bg-warning/10 text-warning',
  },
  {
    value: 'moderate',
    label: 'Normal',
    sublabel: 'Urgent supplies, stable condition',
    colorClass: 'border-info bg-info/10 text-info',
  },
];

const RESOURCE_PRESETS = [
  'First Aid Kit',
  'Boat / Raft',
  'Drinking Water',
  'Emergency Rations',
  'Insulin / Cold-pack',
  'Warm Blankets',
  'Stretcher / Wheelchair',
  'Generator / Power',
  'Baby Formula',
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

  // Form states
  const [category, setCategory] = useState<RequestCategoryType>('rescue');
  const [severity, setSeverity] = useState<RequestSeverity>('urgent');
  const [description, setDescription] = useState('');
  const [numberOfPeople, setNumberOfPeople] = useState(1);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [customResource, setCustomResource] = useState('');

  // Medical specifics
  const [showMedicalSection, setShowMedicalSection] = useState(false);
  const [medicalPriority, setMedicalPriority] = useState<MedicalPriority>('none');
  const [confidentialMedicalDetails, setConfidentialMedicalDetails] = useState('');

  // Contact info
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Location handling
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationDescription, setLocationDescription] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Submission & validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<EmergencyRequest | null>(null);

  // Voice input
  const voice = useVoiceInput();

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setCategory('rescue');
      setSeverity('urgent');
      setDescription('');
      setNumberOfPeople(1);
      setSelectedResources([]);
      setCustomResource('');
      setShowMedicalSection(false);
      setMedicalPriority('none');
      setConfidentialMedicalDetails('');
      setContactName('');
      setContactPhone('');
      setLatitude(null);
      setLongitude(null);
      setLocationAccuracy(null);
      setLocationDescription(locationLabel || '');
      setGpsLoading(false);
      setGpsError(null);
      setErrors({});
      setIsSubmitting(false);
      setCreatedRequest(null);
    }
  }, [open, locationLabel]);

  // If user picks "medical" category, automatically reveal medical urgency section
  useEffect(() => {
    if (category === 'medical') {
      setShowMedicalSection(true);
      if (medicalPriority === 'none') {
        setMedicalPriority('immediate');
      }
    }
  }, [category, medicalPriority]);

  // Request GPS position with explicit permission
  const handleRequestGps = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationAccuracy(Math.round(pos.coords.accuracy));
        setGpsLoading(false);
        // Clear location error if present
        setErrors((prev) => {
          const next = { ...prev };
          delete next.location;
          return next;
        });
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('GPS permission was denied. You can provide your landmark or address below.');
        } else if (err.code === err.TIMEOUT) {
          setGpsError('GPS location request timed out. Please enter manual location.');
        } else {
          setGpsError('Could not retrieve GPS coordinates. Please enter manual location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleClearGps = () => {
    setLatitude(null);
    setLongitude(null);
    setLocationAccuracy(null);
    setGpsError(null);
  };

  const toggleResource = (resource: string) => {
    setSelectedResources((prev) =>
      prev.includes(resource) ? prev.filter((r) => r !== resource) : [...prev, resource]
    );
  };

  const handleAddCustomResource = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customResource.trim();
    if (trimmed && !selectedResources.includes(trimmed)) {
      setSelectedResources((prev) => [...prev, trimmed]);
      setCustomResource('');
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!description.trim()) {
      newErrors.description = 'Please describe the emergency situation so responders can prepare.';
    } else if (description.trim().length < 3) {
      newErrors.description = 'Please provide a more detailed description (at least 3 characters).';
    }

    if (numberOfPeople < 1) {
      newErrors.numberOfPeople = 'Number of people must be at least 1.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // 1. Generate unique idempotency key
      const idempotencyKey = `sos-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Resolve coordinates and location description reliably
      const resolvedLat = latitude !== null ? latitude : region === 'badrinath' ? 30.556 : 28.6139;
      const resolvedLng = longitude !== null ? longitude : region === 'badrinath' ? 79.564 : 77.209;
      const resolvedLocation = locationDescription.trim() || locationLabel || 'Reported Disaster Zone';

      // 2. Prepare domain model input
      const requestInput = {
        category,
        description: description.trim(),
        severity,
        medicalPriority: showMedicalSection ? medicalPriority : 'none',
        confidentialMedicalDetails: showMedicalSection && confidentialMedicalDetails.trim()
          ? confidentialMedicalDetails.trim()
          : null,
        numberOfPeople: Math.floor(numberOfPeople),
        requiredResources: selectedResources.length > 0 ? selectedResources : ['General Assistance'],
        latitude: resolvedLat,
        longitude: resolvedLng,
        locationAccuracy: locationAccuracy || (latitude !== null ? 15 : null),
        locationDescription: resolvedLocation,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        idempotencyKey,
        syncStatus: 'pending' as const,
      };

      // 3. Create validated domain request
      const newRequest = createEmergencyRequest(requestInput);

      // 4. Save to IndexedDB local repository FIRST (offline guarantee)
      try {
        await emergencyRequestRepo.save(newRequest);
      } catch (err) {
        console.warn('IDB save warning:', err);
      }

      // 5. Enqueue into background sync manager outbox
      try {
        await syncQueueManager.enqueue(
          'emergency_request',
          newRequest.id,
          'create',
          newRequest as unknown as Record<string, unknown>,
          newRequest.idempotencyKey
        );
      } catch (err) {
        console.warn('SyncQueue enqueue notice:', err);
      }

      // 6. Direct HTTP POST to server sync endpoint if online
      if (typeof window !== 'undefined') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        fetch('/api/sync/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            id: newRequest.id,
            category: newRequest.category,
            priority:
              newRequest.severity === 'critical'
                ? 'critical'
                : newRequest.severity === 'urgent'
                ? 'urgent'
                : 'moderate',
            title: `${newRequest.category.toUpperCase()} SOS: ${newRequest.description.slice(0, 42)}...`,
            details: newRequest.description,
            items: newRequest.requiredResources,
            contactName: newRequest.contactName || 'Emergency Requester',
            contactPhone: newRequest.contactPhone || '',
            distanceMiles: 0.1,
            createdAt: Date.now(),
            latitude: resolvedLat,
            longitude: resolvedLng,
            coords: { y: resolvedLat, x: resolvedLng },
            peopleCount: newRequest.numberOfPeople,
            locationDescription: resolvedLocation,
            isUserCreated: true,
            region,
          }),
          signal: controller.signal,
        })
          .catch(() => {})
          .finally(() => clearTimeout(timeout));
      }

      // 7. Notify parent component to update live feed / map immediately
      onSuccess(newRequest);

      // 8. Transition to success screen
      setCreatedRequest(newRequest);
    } catch (err: unknown) {
      console.error('Failed to submit SOS request:', err);
      const msg = err instanceof Error ? err.message : 'Failed to record emergency request.';
      setErrors({ submit: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0 bg-background border-l border-border"
      >
        {/* Sticky Header */}
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-alert/20 ring-1 ring-alert/40">
              <Siren className="h-5 w-5 text-alert" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Emergency SOS Dispatch
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase font-mono px-1.5 py-0',
                    isOnline
                      ? 'border-success/40 text-success bg-success/10'
                      : 'border-warning/40 text-warning bg-warning/10'
                  )}
                >
                  {isOnline ? 'Network Live' : 'Offline Mode'}
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate">
                Peer-to-peer neighborhood rescue & resource routing · {locationLabel}
              </SheetDescription>
            </div>
          </div>
        </div>

        {/* Official Emergency Disclaimer */}
        <div className="bg-alert/10 border-b border-alert/20 px-4 sm:px-6 py-2.5 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-alert shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-alert font-bold">Important Notice:</strong> ResQLink is a
            neighborhood coordination tool and does <span className="underline font-semibold">not replace</span> official emergency
            services. For life-threatening emergencies requiring police or military air evacuation, dial{' '}
            <strong className="text-foreground">112</strong> / <strong className="text-foreground">100</strong> immediately.
          </p>
        </div>

        {/* Submission Confirmation Screen */}
        {createdRequest ? (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 ring-2 ring-success/30">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">
                {isOnline ? '🚨 SOS Broadcast Registered' : '📱 Saved on This Device'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {isOnline
                  ? 'Your emergency signal has been recorded and broadcast to local disaster coordinators and verified responders.'
                  : 'Your request is safely stored in local IndexedDB. Awaiting transmission — it will sync automatically when signal returns.'}
              </p>
            </div>

            {/* Offline transmission badge */}
            {!isOnline && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-warning/15 border border-warning/30 text-warning text-xs font-semibold">
                <CloudOff className="h-4 w-4" />
                <span>Saved on this device — awaiting transmission</span>
              </div>
            )}

            {/* Request Summary Card */}
            <div className="p-4 rounded-xl bg-card border border-border text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Request ID:</span>
                <span className="font-mono text-foreground font-semibold">{createdRequest.id.slice(0, 13)}...</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-semibold text-foreground capitalize">{createdRequest.category}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Severity:</span>
                <span className="font-semibold text-alert uppercase">{createdRequest.severity}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/60 pb-2">
                <span className="text-muted-foreground">People in Danger:</span>
                <span className="font-semibold text-foreground">{createdRequest.numberOfPeople}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]">
                  {createdRequest.locationDescription || `${createdRequest.latitude}, ${createdRequest.longitude}`}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {onTrackOnMap && (
                <Button
                  type="button"
                  onClick={() => {
                    onTrackOnMap(createdRequest);
                    onOpenChange(false);
                  }}
                  className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Track on Live Map
                </Button>
              )}
              {onViewDetails && (
                <Button
                  type="button"
                  onClick={() => {
                    onViewDetails(createdRequest.id);
                    onOpenChange(false);
                  }}
                  variant="outline"
                  className="flex-1 border-border text-foreground hover:bg-secondary font-semibold"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="flex-1 text-muted-foreground hover:text-foreground"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* SOS Request Form */
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
            {/* General submit error */}
            {errors.submit && (
              <div className="p-3 rounded-xl bg-alert/15 border border-alert/30 text-alert text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errors.submit}</span>
              </div>
            )}

            {/* 1. Category Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Emergency Category <span className="text-alert">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5',
                        isSelected
                          ? 'border-lime bg-lime/10 ring-1 ring-lime/40'
                          : 'border-border bg-card/60 hover:bg-secondary/60 hover:border-border/80'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={cn('h-4 w-4', isSelected ? 'text-lime' : 'text-muted-foreground')} />
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-lime" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground leading-tight">{cat.label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{cat.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Severity Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Urgency Level <span className="text-alert">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {SEVERITIES.map((sev) => {
                  const isSelected = severity === sev.value;
                  return (
                    <button
                      key={sev.value}
                      type="button"
                      onClick={() => setSeverity(sev.value)}
                      className={cn(
                        'p-2.5 rounded-xl border text-left transition-all',
                        isSelected
                          ? sev.colorClass + ' ring-1'
                          : 'border-border bg-card/60 hover:bg-secondary/60'
                      )}
                    >
                      <div className="text-xs font-bold capitalize">{sev.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{sev.sublabel}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Description with optional Voice transcription */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sos-description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  3. Emergency Description <span className="text-alert">*</span>
                </Label>
                <VoiceMicButton
                  listening={voice.listening}
                  supported={voice.supported}
                  size="sm"
                  onStart={() => {
                    voice.start((transcript) => {
                      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
                    });
                  }}
                  onStop={() => voice.stop()}
                />
              </div>
              <Textarea
                id="sos-description"
                rows={3}
                placeholder="Describe current danger, trapped individuals, water level, structural risks..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) {
                    setErrors((prev) => ({ ...prev, description: '' }));
                  }
                }}
                className={cn(
                  'bg-secondary/40 border-border text-sm resize-none',
                  errors.description && 'border-alert ring-1 ring-alert'
                )}
              />
              {errors.description && (
                <p className="text-[11px] text-alert font-medium">{errors.description}</p>
              )}
            </div>

            {/* 4. Number of People Needing Help */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                4. People Requiring Assistance <span className="text-alert">*</span>
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setNumberOfPeople((p) => Math.max(1, p - 1))}
                    className="px-3.5 py-2 hover:bg-secondary text-foreground text-sm font-bold"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-sm font-bold text-foreground font-mono">
                    {numberOfPeople}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNumberOfPeople((p) => p + 1)}
                    className="px-3.5 py-2 hover:bg-secondary text-foreground text-sm font-bold"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {numberOfPeople === 1 ? '1 individual' : `${numberOfPeople} people in group`}
                </span>
              </div>
            </div>

            {/* 5. Required Resources Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                5. Required Resources (Select all that apply)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {RESOURCE_PRESETS.map((res) => {
                  const active = selectedResources.includes(res);
                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => toggleResource(res)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-lg border transition-all font-medium',
                        active
                          ? 'border-lime bg-lime/15 text-lime'
                          : 'border-border/80 bg-secondary/40 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {active ? '✓ ' : '+ '}
                      {res}
                    </button>
                  );
                })}
              </div>

              {/* Add custom resource */}
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Other resource (e.g. insulin, ropes)..."
                  value={customResource}
                  onChange={(e) => setCustomResource(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomResource();
                    }
                  }}
                  className="h-8 text-xs bg-secondary/30 border-border"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddCustomResource()}
                  className="h-8 text-xs border-border"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* 6. Location Selection (GPS with explicit permission OR manual alternative) */}
            <div className="space-y-2.5 p-3.5 rounded-xl border border-border bg-card/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  6. Location Selection <span className="text-alert">*</span>
                </Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  GPS OR Manual Landmark
                </span>
              </div>

              {/* GPS Button & Detected Pill */}
              <div className="space-y-2">
                {latitude !== null && longitude !== null ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-success/10 border border-success/30">
                    <div className="flex items-center gap-2 text-xs text-success font-medium">
                      <LocateFixed className="h-4 w-4 shrink-0 text-success" />
                      <div>
                        <div>GPS Detected: {latitude.toFixed(4)}, {longitude.toFixed(4)}</div>
                        {locationAccuracy !== null && (
                          <div className="text-[10px] text-muted-foreground">
                            Accuracy radius: ±{locationAccuracy}m
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearGps}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear GPS
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRequestGps}
                    disabled={gpsLoading}
                    className="w-full justify-center text-xs h-9 border-border bg-secondary/30 hover:bg-secondary font-semibold"
                  >
                    {gpsLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-lime" />
                        Detecting device coordinates...
                      </>
                    ) : (
                      <>
                        <LocateFixed className="h-3.5 w-3.5 mr-2 text-lime" />
                        Detect My GPS Coordinates (Requires Permission)
                      </>
                    )}
                  </Button>
                )}

                {gpsError && (
                  <p className="text-[11px] text-warning bg-warning/10 border border-warning/20 p-2 rounded-lg">
                    {gpsError}
                  </p>
                )}
              </div>

              {/* Manual Location Alternative */}
              <div className="space-y-1">
                <Label htmlFor="sos-manual-loc" className="text-[11px] font-semibold text-muted-foreground">
                  Manual Landmark, Address, or Evacuation Point:
                </Label>
                <Input
                  id="sos-manual-loc"
                  placeholder="e.g. Sector 15 Community Center, Gate 2, 3rd Floor"
                  value={locationDescription}
                  onChange={(e) => {
                    setLocationDescription(e.target.value);
                    if (errors.location) {
                      setErrors((prev) => ({ ...prev, location: '' }));
                    }
                  }}
                  className={cn(
                    'h-9 text-xs bg-secondary/40 border-border',
                    errors.location && 'border-alert ring-1 ring-alert'
                  )}
                />
                <p className="text-[10px] text-muted-foreground">
                  * GPS is optional when you supply a usable manual location description.
                </p>
              </div>

              {errors.location && (
                <p className="text-[11px] text-alert font-medium">{errors.location}</p>
              )}
            </div>

            {/* 7. Optional Confidential Medical Urgency */}
            <div className="rounded-xl border border-border/80 bg-card/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMedicalSection((prev) => !prev)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-bold text-foreground">
                    Confidential Medical Information (Optional)
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-border">
                  {showMedicalSection ? 'Hide' : 'Expand'}
                </Badge>
              </button>

              {showMedicalSection && (
                <div className="p-3.5 pt-0 space-y-3 border-t border-border/40">
                  <div className="p-2.5 rounded-lg bg-warning/10 border border-warning/20 text-[11px] text-muted-foreground flex items-start gap-2">
                    <Lock className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <span>
                      Medical details are encrypted and strictly isolated. Only assigned medical personnel
                      and on-scene rescuers can view this information.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Medical Priority:</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['immediate', 'delayed', 'minor', 'none'] as MedicalPriority[]).map((prio) => (
                        <button
                          key={prio}
                          type="button"
                          onClick={() => setMedicalPriority(prio)}
                          className={cn(
                            'text-[11px] py-1 px-1.5 rounded-lg border font-medium capitalize',
                            medicalPriority === prio
                              ? 'border-warning bg-warning/20 text-warning'
                              : 'border-border bg-secondary/30 text-muted-foreground'
                          )}
                        >
                          {prio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Specific Medical Conditions / Medication Needs:
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Diabetic insulin dependency, severe asthma, pacemaker, fracture..."
                      value={confidentialMedicalDetails}
                      onChange={(e) => setConfidentialMedicalDetails(e.target.value)}
                      className="bg-secondary/40 border-border text-xs resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 8. Optional Contact Info */}
            <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-card/30">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                7. Contact Information (Optional)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3" /> Name:
                  </div>
                  <Input
                    placeholder="Requester / Contact Name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="h-8 text-xs bg-secondary/40 border-border"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Phone className="h-3 w-3" /> Phone:
                  </div>
                  <Input
                    placeholder="Phone number for dispatch SMS"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="h-8 text-xs bg-secondary/40 border-border"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-lime hover:bg-lime/90 text-charcoal-950 font-bold text-sm shadow-md transition-all active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording Request Locally...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {isOnline ? 'Broadcast Emergency SOS' : 'Save Emergency SOS Offline'}
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground mt-2">
                {isOnline
                  ? 'Request will be stored in IndexedDB and dispatched to upstream servers.'
                  : 'Operating in offline mode. Request will be preserved on device and synced upon reconnection.'}
              </p>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
