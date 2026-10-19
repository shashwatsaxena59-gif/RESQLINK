import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Loader2,
  CheckCircle2,
  MapPin,
  LocateFixed,
  MapPinOff,
  User,
  Mail,
  Phone,
  X,
  ShieldCheck,
  Send,
  Plus,
  Trash2,
  Package,
  Wrench,
  Radio,
  Compass,
  HeartHandshake,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useModalBack } from '@/hooks/use-modal-back';
import { useVolunteers } from '@/hooks/use-volunteers';
import { saveVolunteerProfile, getVolunteerProfile } from '@/lib/volunteer-profile';
import type { OfferedSupplyItem, VolunteerProfile } from '@/lib/volunteer-profile';
import type { VolunteerGender } from '@/types';

interface VolunteerRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const AVAILABLE_SKILLS = [
  { id: 'first_aid', label: 'First Aid & CPR', category: 'medical' },
  { id: 'paramedic', label: 'EMT / Paramedic', category: 'medical' },
  { id: 'triage', label: 'Medical Triage', category: 'medical' },
  { id: 'search_and_rescue', label: 'Search & Rescue', category: 'rescue' },
  { id: 'water_rescue', label: 'Water / Flood Rescue', category: 'rescue' },
  { id: 'driver', label: '4x4 / Heavy Vehicle Driving', category: 'transport' },
  { id: 'boat_operator', label: 'Boat / Watercraft Navigation', category: 'rescue' },
  { id: 'food_distribution', label: 'Food Rations & Logistics', category: 'food' },
  { id: 'water_purification', label: 'Water Purification & Dist.', category: 'water' },
  { id: 'shelter_management', label: 'Shelter Operations', category: 'shelter' },
  { id: 'mental_health', label: 'Crisis / Mental Health Aid', category: 'medical' },
  { id: 'translation', label: 'Multilingual Translation', category: 'comms' },
  { id: 'general_aid', label: 'General Neighborhood Aid', category: 'other' },
];

const PREFERRED_CATEGORIES = [
  { id: 'medical', label: 'Medical Assistance' },
  { id: 'food', label: 'Food Rations' },
  { id: 'water', label: 'Drinking Water' },
  { id: 'shelter', label: 'Emergency Shelter' },
  { id: 'rescue', label: 'Rescue Operations' },
  { id: 'evacuation', label: 'Evacuation & Transport' },
  { id: 'other', label: 'Essential Supplies' },
];

const SERVICE_RADIUS_OPTIONS = [
  { value: 1, label: 'Immediate Block (Within 1 mile)' },
  { value: 2, label: 'Neighborhood (Within 2 miles - Recommended)' },
  { value: 5, label: 'Wider District (Within 5 miles)' },
  { value: 10, label: 'Regional Sector (Within 10 miles)' },
];

type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

export function VolunteerRegistrationModal({
  open,
  onOpenChange,
  onComplete,
}: VolunteerRegistrationModalProps) {
  useModalBack(open, () => onOpenChange(false));

  const { registerVolunteer, registering, registered, resetRegistration } = useVolunteers();

  // Form Fields
  const [displayName, setDisplayName] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['first_aid', 'general_aid']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'medical',
    'food',
    'water',
    'shelter',
  ]);
  const [availability, setAvailability] = useState<'available' | 'on_mission' | 'offline'>('available');
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState<number>(2);
  const [serviceAreaDesc, setServiceAreaDesc] = useState('Central Community Ward');

  // Supplies offered
  const [supplies, setSupplies] = useState<OfferedSupplyItem[]>([
    { type: 'Drinking Water', quantity: 20, unit: 'liters' },
    { type: 'Prepared Meals / Rations', quantity: 15, unit: 'packs' },
  ]);
  const [newSupplyType, setNewSupplyType] = useState('');
  const [newSupplyQty, setNewSupplyQty] = useState(10);
  const [newSupplyUnit, setNewSupplyUnit] = useState('units');

  // Optional Contact
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Location Consent (GPS is explicitly optional)
  const [locationPermission, setLocationPermission] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('idle');

  // Validation
  const [error, setError] = useState<string | null>(null);

  // Initialize from existing profile if available
  useEffect(() => {
    if (open) {
      const existing = getVolunteerProfile();
      if (existing) {
        setDisplayName(existing.displayName || existing.fullName || '');
        if (existing.skills && existing.skills.length > 0) setSelectedSkills(existing.skills);
        if (existing.preferredCategories && existing.preferredCategories.length > 0)
          setSelectedCategories(existing.preferredCategories);
        if (existing.offeredSupplies && existing.offeredSupplies.length > 0)
          setSupplies(existing.offeredSupplies);
        setAvailability(existing.availabilityStatus === 'unavailable' ? 'offline' : existing.availabilityStatus);
        setServiceRadiusMiles(existing.serviceRadiusMiles || 2);
        if (existing.serviceArea) setServiceAreaDesc(existing.serviceArea);
        if (existing.phone) setPhone(existing.phone);
        if (existing.email) setEmail(existing.email);
        if (existing.coordinates) {
          setCoords({ lat: existing.coordinates.lat, lng: existing.coordinates.lng });
          setLocationPermission(existing.locationPermission);
          setLocationState('granted');
        }
      }
    }
  }, [open]);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleAddSupply = () => {
    if (!newSupplyType.trim() || newSupplyQty <= 0) return;
    setSupplies((prev) => [
      ...prev,
      {
        type: newSupplyType.trim(),
        quantity: Number(newSupplyQty),
        unit: newSupplyUnit.trim() || 'units',
      },
    ]);
    setNewSupplyType('');
    setNewSupplyQty(10);
  };

  const handleRemoveSupply = (index: number) => {
    setSupplies((prev) => prev.filter((_, i) => i !== index));
  };

  // Location request (Explicit permission with optional fallback)
  const handleRequestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationState('unsupported');
      return;
    }
    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationPermission(true);
        setLocationState('granted');
      },
      () => {
        setCoords(null);
        setLocationPermission(false);
        setLocationState('denied');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleSkipLocation = () => {
    setCoords(null);
    setLocationPermission(false);
    setLocationState('denied');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Please provide a display name or callsign.');
      return;
    }

    try {
      const volId = `vol-${Date.now()}`;
      const profileData: VolunteerProfile = {
        id: volId,
        displayName: displayName.trim(),
        fullName: displayName.trim(),
        skills: selectedSkills,
        offeredSupplies: supplies,
        preferredCategories: selectedCategories,
        availabilityStatus: availability,
        serviceArea: serviceAreaDesc.trim() || 'Neighborhood',
        serviceRadiusMiles,
        locationPermission,
        coordinates: locationPermission && coords ? { lat: coords.lat, lng: coords.lng, accuracy: 15 } : null,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        registeredAt: Date.now(),
      };

      saveVolunteerProfile(profileData);

      await registerVolunteer({
        fullName: displayName.trim(),
        displayName: displayName.trim(),
        gender: 'prefer_not_to_say' as VolunteerGender,
        skills: selectedSkills,
        offeredSupplies: supplies,
        preferredCategories: selectedCategories,
        availabilityStatus: availability,
        serviceArea: serviceAreaDesc.trim(),
        serviceRadiusMiles,
        phone: phone.trim() || '',
        email: email.trim() || '',
        latitude: locationPermission && coords ? coords.lat : null,
        longitude: locationPermission && coords ? coords.lng : null,
        locationPermission,
      });

      onOpenChange(false);
      onComplete?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Saved locally on this device.');
      // Local profile is still saved
      onOpenChange(false);
      onComplete?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground p-0 overflow-hidden shadow-2xl rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Volunteer Responder Portal Registration
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Join the neighborhood crisis response mesh and supply dispatch network.
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[75vh] px-6 py-5">
            <div className="space-y-6">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Identity & Availability */}
              <div className="space-y-3">
                <Label htmlFor="vol-display-name" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Display Name or Callsign <span className="text-primary">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="vol-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Captain Mehra / Rapid Relief Responder"
                    className="pl-9 bg-background border-border"
                    required
                  />
                </div>

                <div className="pt-2">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Initial Availability Status
                  </Label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {[
                      { id: 'available', label: '🟢 Available Now', desc: 'Ready for dispatches' },
                      { id: 'on_mission', label: '🟡 On Mission', desc: 'Currently engaged' },
                      { id: 'offline', label: '⚪ Offline / Standby', desc: 'Not active currently' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAvailability(item.id as any)}
                        className={cn(
                          'p-2.5 rounded-xl border text-left transition-all',
                          availability === item.id
                            ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-sm'
                            : 'border-border/60 bg-background/50 hover:border-border text-muted-foreground'
                        )}
                      >
                        <div className="text-xs">{item.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Skills Multi-Select */}
              <div className="space-y-2 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Certifications & Practical Skills
                  </Label>
                  <span className="text-[11px] font-mono text-primary font-semibold">
                    {selectedSkills.length} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {AVAILABLE_SKILLS.map((skill) => {
                    const active = selectedSkills.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleSkill(skill.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5',
                          active
                            ? 'bg-primary/20 border-primary text-primary font-bold shadow-xs'
                            : 'bg-secondary/40 border-border/70 text-foreground/80 hover:bg-secondary'
                        )}
                      >
                        {active && <CheckCircle2 className="h-3 w-3 text-primary" />}
                        {skill.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Preferred Categories */}
              <div className="space-y-2 border-t border-border/60 pt-4">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Preferred Assistance Categories
                </Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {PREFERRED_CATEGORIES.map((cat) => {
                    const active = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs border transition-colors',
                          active
                            ? 'bg-accent/25 border-accent text-accent-foreground font-semibold'
                            : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Offered Supplies & Quantities */}
              <div className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    Offered Supplies & Equipment
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Tangible goods you can allocate</span>
                </div>

                {supplies.length > 0 && (
                  <div className="space-y-2">
                    {supplies.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-background text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{item.type}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="font-mono">
                            {item.quantity} {item.unit}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => handleRemoveSupply(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-md"
                            aria-label={`Remove ${item.type}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="Add item (e.g. Blankets, First Aid Kits)"
                    value={newSupplyType}
                    onChange={(e) => setNewSupplyType(e.target.value)}
                    className="flex-2 bg-background border-border text-xs"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={newSupplyQty}
                    onChange={(e) => setNewSupplyQty(Math.max(1, Number(e.target.value)))}
                    className="w-20 bg-background border-border text-xs"
                    placeholder="Qty"
                  />
                  <Input
                    placeholder="Unit"
                    value={newSupplyUnit}
                    onChange={(e) => setNewSupplyUnit(e.target.value)}
                    className="w-20 bg-background border-border text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddSupply}
                    className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>

              {/* 5. Service Area & Radius */}
              <div className="space-y-3 border-t border-border/60 pt-4">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-primary" />
                  Approximate Service Area & Operating Radius
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Default Matching Radius</Label>
                    <select
                      value={serviceRadiusMiles}
                      onChange={(e) => setServiceRadiusMiles(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-xs font-medium focus:ring-1 focus:ring-primary"
                    >
                      {SERVICE_RADIUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Neighborhood / District Landmark</Label>
                    <Input
                      value={serviceAreaDesc}
                      onChange={(e) => setServiceAreaDesc(e.target.value)}
                      placeholder="e.g. Connaught Place, Karol Bagh"
                      className="mt-1 bg-background border-border text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Geolocation Permission (Explicit and Optional) */}
              <div className="space-y-2 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Geospatial Location Access (Optional)
                  </Label>
                  <span className="text-[10px] bg-primary/10 text-primary font-mono px-2 py-0.5 rounded-full font-bold">
                    GPS NOT REQUIRED
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ResQLink asks permission before accessing GPS coordinates.
                    <strong className="text-foreground"> You can fully participate and accept tasks without sharing precise GPS.</strong> If coordinates are omitted, the matching engine uses your landmark service area and non-geographic prioritization.
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {locationState === 'granted' && coords ? (
                      <div className="flex items-center gap-2 text-xs text-primary font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Coordinates detected ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})</span>
                      </div>
                    ) : locationState === 'requesting' ? (
                      <Button type="button" size="sm" disabled className="text-xs">
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Detecting coordinates…
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRequestLocation}
                          className="text-xs border-primary/50 text-foreground hover:bg-primary/10"
                        >
                          <LocateFixed className="h-3.5 w-3.5 mr-1.5 text-primary" />
                          Grant GPS Coordinates
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSkipLocation}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <MapPinOff className="h-3.5 w-3.5 mr-1" />
                          Continue Without GPS
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 7. Optional Contact Information */}
              <div className="space-y-3 border-t border-border/60 pt-4">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Optional Contact Information
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone / WhatsApp (Optional)"
                      className="pl-9 bg-background border-border text-xs"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email (Optional)"
                      className="pl-9 bg-background border-border text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t border-border px-6 py-4 bg-muted/40 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={registering}
              className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 px-6 text-xs h-10 shadow-lg shadow-primary/20"
            >
              {registering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving Profile…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Volunteer Registration
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
