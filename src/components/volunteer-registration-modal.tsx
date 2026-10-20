import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Building2,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  HeartPulse,
  LifeBuoy,
  Droplets,
  HandHeart,
  MapPin,
  LocateFixed,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useModalBack } from '@/hooks/use-modal-back';
import { useVolunteers } from '@/hooks/use-volunteers';
import { saveVolunteerProfile, getVolunteerProfile } from '@/lib/volunteer-profile';
import type { VolunteerProfile } from '@/lib/volunteer-profile';
import type { VolunteerGender } from '@/types';
import { toast } from 'sonner';

interface VolunteerRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const ROLES = [
  { id: 'first_aid', label: 'Medicine & First Aid', icon: HeartPulse, color: 'text-red-500' },
  { id: 'food_distribution', label: 'Food & Clean Water', icon: Droplets, color: 'text-blue-400' },
  { id: 'rescue', label: 'Rescue & Transport', icon: LifeBuoy, color: 'text-orange-500' },
  { id: 'general_aid', label: 'General Assistance', icon: HandHeart, color: 'text-emerald-400' },
];

export function VolunteerRegistrationModal({
  open,
  onOpenChange,
  onComplete,
}: VolunteerRegistrationModalProps) {
  useModalBack(open, () => onOpenChange(false));

  const { registerVolunteer, registering } = useVolunteers();

  // Simple Form Fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [ngoName, setNgoName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('first_aid');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing profile on open
  useEffect(() => {
    if (open) {
      const existing = getVolunteerProfile();
      if (existing) {
        setDisplayName(existing.displayName || existing.fullName || '');
        setEmail(existing.email || '');
        setNgoName(existing.ngoAffiliation || '');
        setPhone(existing.phone || '');
        if (existing.skills && existing.skills[0]) {
          setSelectedRole(existing.skills[0]);
        }
        if (existing.coordinates) {
          setCoords({ lat: existing.coordinates.lat, lng: existing.coordinates.lng });
        }
      }
      setError(null);

      // Auto-fetch GPS in background
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {},
          { timeout: 5000 }
        );
      }
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your Gmail / Email address.');
      return;
    }

    try {
      const volId = `vol-${Date.now()}`;
      const profileData: VolunteerProfile = {
        id: volId,
        displayName: displayName.trim(),
        fullName: displayName.trim(),
        email: email.trim(),
        ngoAffiliation: ngoName.trim() || undefined,
        phone: phone.trim() || undefined,
        skills: [selectedRole, 'general_aid'],
        offeredSupplies: [],
        preferredCategories: ['medical', 'food', 'shelter', 'rescue'],
        availabilityStatus: 'available',
        serviceArea: ngoName.trim() ? `${ngoName.trim()} Volunteer Unit` : 'Neighborhood Responder',
        serviceRadiusMiles: 5,
        locationPermission: Boolean(coords),
        coordinates: coords ? { lat: coords.lat, lng: coords.lng, accuracy: 15 } : null,
        registeredAt: Date.now(),
      };

      saveVolunteerProfile(profileData);

      await registerVolunteer({
        fullName: displayName.trim(),
        displayName: displayName.trim(),
        gender: 'prefer_not_to_say' as VolunteerGender,
        skills: [selectedRole, 'general_aid'],
        offeredSupplies: [],
        preferredCategories: ['medical', 'food', 'shelter', 'rescue'],
        availabilityStatus: 'available',
        serviceArea: ngoName.trim() ? `${ngoName.trim()} Unit` : 'Neighborhood Volunteer',
        serviceRadiusMiles: 5,
        phone: phone.trim() || '',
        email: email.trim(),
        latitude: coords ? coords.lat : null,
        longitude: coords ? coords.lng : null,
        locationPermission: Boolean(coords),
      });

      toast.success('Volunteer Profile Registered!', {
        description: `Welcome, ${displayName.trim()}! You are now active on the dispatch roster.`,
      });

      onOpenChange(false);
      onComplete?.();
    } catch (err: unknown) {
      console.warn('Backend sync warning:', err);
      // Still allow local completion
      onOpenChange(false);
      onComplete?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600/20 via-primary/10 to-transparent p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Volunteer Registration
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Join the local emergency responder dispatch network
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* 1. Name */}
          <div className="space-y-1.5">
            <Label htmlFor="vol-name" className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Your Name <span className="text-red-500">*</span></span>
            </Label>
            <Input
              id="vol-name"
              placeholder="e.g. Rahul Sharma"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-9 text-xs bg-secondary/40 border-border"
              required
            />
          </div>

          {/* 2. Gmail / Email */}
          <div className="space-y-1.5">
            <Label htmlFor="vol-email" className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-sky-400" />
              <span>Gmail / Email Address <span className="text-red-500">*</span></span>
            </Label>
            <Input
              id="vol-email"
              type="email"
              placeholder="e.g. rahul.sharma@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 text-xs bg-secondary/40 border-border"
              required
            />
          </div>

          {/* 3. NGO Affiliation (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="vol-ngo" className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-amber-400" />
                <span>Are you from an NGO?</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Optional</span>
            </Label>
            <Input
              id="vol-ngo"
              placeholder="e.g. Red Cross, Khalsa Aid, Robin Hood Army (or leave blank)"
              value={ngoName}
              onChange={(e) => setNgoName(e.target.value)}
              className="h-9 text-xs bg-secondary/40 border-border"
            />
          </div>

          {/* 4. Contact Phone (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="vol-phone" className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Phone Number</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Optional</span>
            </Label>
            <Input
              id="vol-phone"
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 text-xs bg-secondary/40 border-border"
            />
          </div>

          {/* 5. Primary Help Skill */}
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-bold text-foreground">
              What can you help with most?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 text-xs font-semibold',
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                        : 'border-border bg-card hover:bg-secondary/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', role.color)} />
                    <span className="line-clamp-1">{role.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={registering}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
            >
              {registering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving Profile...
                </>
              ) : (
                'Save & Open Volunteer Hub'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
