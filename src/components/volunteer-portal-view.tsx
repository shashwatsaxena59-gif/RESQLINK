import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  LifeBuoy,
  Phone,
  Package,
  Compass,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  Check,
  X,
  Truck,
  HeartHandshake,
  LocateFixed,
  Eye,
  FileText,
  AlertCircle,
  Share2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  SlidersHorizontal,
  CheckCheck,
  Navigation,
} from 'lucide-react';
import type { NavDestination } from '@/hooks/use-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import type { AidRequest, RequestCategory, RequestPriority, RequestStatus } from '@/types';
import type { MapRegion } from '@/components/map-view';
import { REGION_DATA } from '@/mockData';
import { haversineDistanceMiles, isValidLatLng } from '@/lib/geo';
import {
  getVolunteerProfile,
  saveVolunteerProfile,
  updateVolunteerAvailability,
  type VolunteerProfile,
  type OfferedSupplyItem,
} from '@/lib/volunteer-profile';
import {
  evaluateRequestVolunteerMatch,
  findRecommendedRequestsForVolunteer,
  DEFAULT_MATCHING_RADIUS_MILES,
  ADVISORY_DISCLAIMER,
  type MatchRecommendation,
} from '@/domain/services/matching-engine';
import {
  allocateResource,
  deallocateResource,
  fulfillAllocatedResource,
} from '@/domain/services/resource-service';
import type { ResourceOffer, OfferAvailabilityStatus } from '@/domain/models/resource-offer';
import {
  canAssignVolunteer,
  createVolunteerTask,
  transitionTaskStatus,
} from '@/domain/services/task-service';
import type { VolunteerTask, TaskLifecycleStatus } from '@/domain/models/volunteer-task';
import type { EmergencyRequest } from '@/domain/models/emergency-request';
import type { Volunteer } from '@/domain/models/volunteer';

// ── Persistent Storage Keys ──────────────────────────────────────────────────
const VOLUNTEER_TASKS_KEY = 'resqlink-volunteer-tasks-v2';
const RESOURCE_OFFERS_KEY = 'resqlink-resource-offers-v2';

// ── Region Centers ───────────────────────────────────────────────────────────
const REGION_CENTERS: Record<string, [number, number]> = {
  ncr: [28.6139, 77.2090],
  mumbai: [19.0760, 72.8777],
  bengaluru: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  kolkata: [22.5726, 88.3639],
  kerala: [9.9312, 76.2673],
  assam: [26.1445, 91.7362],
  uttarakhand: [30.3165, 78.0322],
  odisha: [20.2961, 85.8245],
};

// ── Seed Resource Offers ──────────────────────────────────────────────────────
const INITIAL_RESOURCE_OFFERS: ResourceOffer[] = [
  {
    id: 'res-water-01',
    providerId: 'hub-connaught',
    providerName: 'Central Civic Depot',
    providerPhone: '+91 98100 12345',
    resourceType: 'Drinking Water (Bottled)',
    quantityAvailable: 250,
    quantityAllocated: 0,
    unit: 'liters',
    location: 'Barakhamba Road Staging Ground',
    latitude: 28.6280,
    longitude: 77.2250,
    availabilityStatus: 'available',
    availabilityWindow: { start: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Purified mineral water in sealed 5L containers.',
  },
  {
    id: 'res-food-02',
    providerId: 'hub-karolbagh',
    providerName: 'Community Relief Kitchen',
    providerPhone: '+91 98111 23456',
    resourceType: 'Prepared Rations & Meals',
    quantityAvailable: 150,
    quantityAllocated: 20,
    unit: 'meals',
    location: 'Pusa Road Community Center',
    latitude: 28.6420,
    longitude: 77.1850,
    availabilityStatus: 'partially_allocated',
    availabilityWindow: { start: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'High-energy ready-to-eat meal packs.',
  },
  {
    id: 'res-blankets-03',
    providerId: 'hub-shelter',
    providerName: 'Red Cross Aid Center',
    providerPhone: '+91 98222 34567',
    resourceType: 'Thermal Blankets & Tarps',
    quantityAvailable: 80,
    quantityAllocated: 0,
    unit: 'units',
    location: 'Mandir Marg Logistics Base',
    latitude: 28.6250,
    longitude: 77.1980,
    availabilityStatus: 'available',
    availabilityWindow: { start: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Waterproof insulated emergency blankets.',
  },
  {
    id: 'res-med-04',
    providerId: 'hub-firstaid',
    providerName: 'City Trauma First Responders',
    providerPhone: '+91 98333 45678',
    resourceType: 'Trauma & First Aid Kits',
    quantityAvailable: 35,
    quantityAllocated: 10,
    unit: 'kits',
    location: 'Lady Hardinge Staging Post',
    latitude: 28.6320,
    longitude: 77.2140,
    availabilityStatus: 'partially_allocated',
    availabilityWindow: { start: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Bandages, antiseptics, tourniquets, burn dressings.',
  },
  {
    id: 'res-transport-05',
    providerId: 'hub-fleet',
    providerName: '4x4 Volunteer Fleet',
    providerPhone: '+91 98444 56789',
    resourceType: 'Heavy Vehicle / 4x4 Transport',
    quantityAvailable: 4,
    quantityAllocated: 1,
    unit: 'vehicles',
    location: 'Janpath Staging Depot',
    latitude: 28.6210,
    longitude: 77.2190,
    availabilityStatus: 'partially_allocated',
    availabilityWindow: { start: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'High-clearance flood and debris evacuation vehicles.',
  },
];

export interface VolunteerPortalViewProps {
  requests: AidRequest[];
  region: MapRegion;
  locationLabel: string;
  isOnline: boolean;
  onHelpRequest: (id: string) => void;
  onResolveRequest: (id: string) => void;
  onOpenDetailsModal: (id: string) => void;
  onNavigateToMap: () => void;
  onNavigate?: (dest: NavDestination) => void;
  onOpenVolunteerReg: () => void;
}

export function VolunteerPortalView({
  requests,
  region,
  locationLabel,
  isOnline,
  onHelpRequest,
  onResolveRequest,
  onOpenDetailsModal,
  onNavigateToMap,
  onNavigate,
  onOpenVolunteerReg,
}: VolunteerPortalViewProps) {
  // ── Profile State ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<VolunteerProfile | null>(() => getVolunteerProfile());

  // ── Resource Offers State ──────────────────────────────────────────────────
  const [resourceOffers, setResourceOffers] = useState<ResourceOffer[]>(() => {
    try {
      const saved = localStorage.getItem(RESOURCE_OFFERS_KEY);
      return saved ? JSON.parse(saved) : INITIAL_RESOURCE_OFFERS;
    } catch {
      return INITIAL_RESOURCE_OFFERS;
    }
  });

  // ── Tasks State ────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<VolunteerTask[]>(() => {
    try {
      const saved = localStorage.getItem(VOLUNTEER_TASKS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save tasks and offers to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(VOLUNTEER_TASKS_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(RESOURCE_OFFERS_KEY, JSON.stringify(resourceOffers));
    } catch (e) {
      console.error('Failed to save resource offers', e);
    }
  }, [resourceOffers]);

  // Sync profile when opened
  useEffect(() => {
    const p = getVolunteerProfile();
    setProfile(p);
  }, []);

  // ── Active Tab & Filter State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'nearby' | 'missions' | 'resources' | 'history'>('nearby');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [distanceRadiusMiles, setDistanceRadiusMiles] = useState<number>(2.0); // Default 2 miles
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);

  // ── Modals State ───────────────────────────────────────────────────────────
  const [completionModalTask, setCompletionModalTask] = useState<VolunteerTask | null>(null);
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [cancellingTask, setCancellingTask] = useState<VolunteerTask | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [newOfferModalOpen, setNewOfferModalOpen] = useState(false);

  // New Offer Form State
  const [newOfferType, setNewOfferType] = useState('Drinking Water');
  const [newOfferQty, setNewOfferQty] = useState(50);
  const [newOfferUnit, setNewOfferUnit] = useState('liters');
  const [newOfferLocation, setNewOfferLocation] = useState('Neighborhood Staging Point');
  const [newOfferNotes, setNewOfferNotes] = useState('');

  // ── Resolve Request Lat/Lng Helper ─────────────────────────────────────────
  const getRequestCoords = useCallback(
    (req: AidRequest): [number, number] | null => {
      if (req.latitude && req.longitude) {
        return [req.latitude, req.longitude];
      }
      if (req.coords && (req.coords.x !== 0 || req.coords.y !== 0)) {
        const { x, y } = req.coords;
        if (y >= 20 && y <= 40 && x >= 65 && x <= 95) {
          return [y, x];
        }
        const center = REGION_CENTERS[region] || REGION_CENTERS.ncr;
        const lat = center[0] + (50 - y) * 0.0035;
        const lng = center[1] + (x - 50) * 0.0035;
        return [lat, lng];
      }
      const center = REGION_CENTERS[region] || REGION_CENTERS.ncr;
      return center;
    },
    [region]
  );

  // ── Directions Navigation Handler ──────────────────────────────────────────
  const handleDirections = useCallback(
    (req: AidRequest) => {
      const coords = getRequestCoords(req) || REGION_CENTERS[region] || REGION_CENTERS.ncr;
      const dest: NavDestination = {
        id: req.id,
        name: req.title,
        address: req.locationDescription || req.details || `${req.contactName || 'Requester'} · ${locationLabel}`,
        coords,
        phone: req.contactPhone,
        type: req.category,
      };
      if (onNavigate) {
        onNavigate(dest);
      } else {
        onNavigateToMap();
      }
    },
    [getRequestCoords, onNavigate, onNavigateToMap, region, locationLabel]
  );

  // Volunteer coordinates (if location permitted)
  const volunteerCoords: [number, number] | null = useMemo(() => {
    if (profile?.locationPermission && profile.coordinates) {
      return [profile.coordinates.lat, profile.coordinates.lng];
    }
    // Fall back to region center for demonstration if permitted or general landmark
    return null;
  }, [profile]);

  // ── Availability Toggle ────────────────────────────────────────────────────
  const handleToggleAvailability = (newStatus: 'available' | 'on_mission' | 'offline' | 'unavailable') => {
    const updated = updateVolunteerAvailability(newStatus);
    if (updated) {
      setProfile(updated);
      toast.success(`Availability updated: ${newStatus.toUpperCase()}`, {
        description:
          newStatus === 'available'
            ? 'You are active and receiving intelligent dispatch recommendations.'
            : 'Dispatch notifications paused.',
      });
    }
  };

  // ── Convert AidRequest to Domain EmergencyRequest ──────────────────────────
  const mapToDomainRequest = useCallback(
    (req: AidRequest): EmergencyRequest => {
      const coords = getRequestCoords(req);
      const cat = (['medical', 'food', 'shelter', 'volunteers', 'rescue', 'evacuation', 'water'].includes(req.category)
        ? req.category
        : 'other') as any;

      return {
        id: req.id,
        incidentId: 'inc-default',
        requesterId: req.contactName || 'citizen',
        category: cat,
        description: req.details || req.title,
        severity: req.priority === 'critical' ? 'critical' : req.priority === 'urgent' ? 'urgent' : 'moderate',
        medicalPriority: req.category === 'medical' ? 'immediate' : 'none',
        numberOfPeople: req.peopleCount || 1,
        requiredResources: req.items || [],
        latitude: coords ? coords[0] : null,
        longitude: coords ? coords[1] : null,
        locationAccuracy: coords ? 15 : null,
        locationDescription: req.title || 'Reported Incident Area',
        createdAt: new Date(req.createdAt).toISOString(),
        updatedAt: new Date().toISOString(),
        status: req.status === 'fulfilled' ? 'fulfilled' : req.status === 'in-progress' ? 'in-progress' : 'active',
        assignedVolunteerId: null,
        syncStatus: 'synced',
        idempotencyKey: `idem-${req.id}`,
        contactName: req.contactName,
        contactPhone: req.contactPhone,
      };
    },
    [getRequestCoords]
  );

  // ── Convert Profile to Domain Volunteer ────────────────────────────────────
  const domainVolunteer: Volunteer = useMemo(() => {
    return {
      id: profile?.id || 'vol-guest',
      displayName: profile?.displayName || profile?.fullName || 'Community Volunteer',
      skills: profile?.skills || ['general_aid', 'first_aid'],
      offeredResources: profile?.offeredSupplies?.map((s) => s.type.toLowerCase()) || ['drinking_water', 'prepared_meals'],
      availabilityStatus: profile?.availabilityStatus || 'available',
      locationSharingPermission: Boolean(profile?.locationPermission),
      coordinates:
        profile?.locationPermission && profile?.coordinates
          ? {
              latitude: profile.coordinates.lat,
              longitude: profile.coordinates.lng,
              accuracy: profile.coordinates.accuracy ?? 15,
            }
          : null,
      serviceRadius: profile?.serviceRadiusMiles || 2.0,
      lastSeenAt: new Date().toISOString(),
      phone: profile?.phone,
      email: profile?.email,
    };
  }, [profile]);

  // ── Matching Recommendations Computation ──────────────────────────────────
  const requestMatches: Array<{
    aidRequest: AidRequest;
    domainRequest: EmergencyRequest;
    recommendation: MatchRecommendation;
    distanceMiles: number | null;
  }> = useMemo(() => {
    return requests
      .filter((r) => r.status !== 'fulfilled')
      .map((req) => {
        const domainReq = mapToDomainRequest(req);
        const rec = evaluateRequestVolunteerMatch(domainReq, domainVolunteer, {
          maxDistanceMiles: distanceRadiusMiles,
        });

        return {
          aidRequest: req,
          domainRequest: domainReq,
          recommendation: rec,
          distanceMiles: rec.distanceMiles,
        };
      })
      .sort((a, b) => {
        // Prioritize eligible tasks, then score descending, then distance ascending
        if (a.recommendation.isEligible !== b.recommendation.isEligible) {
          return a.recommendation.isEligible ? -1 : 1;
        }
        if (b.recommendation.score !== a.recommendation.score) {
          return b.recommendation.score - a.recommendation.score;
        }
        if (a.distanceMiles !== null && b.distanceMiles !== null) {
          return a.distanceMiles - b.distanceMiles;
        }
        return 0;
      });
  }, [requests, mapToDomainRequest, domainVolunteer, distanceRadiusMiles]);

  // ── Filtered Recommendations ──────────────────────────────────────────────
  const filteredMatches = useMemo(() => {
    return requestMatches.filter(({ aidRequest, recommendation, distanceMiles }) => {
      // Category filter
      if (categoryFilter !== 'all' && aidRequest.category !== categoryFilter) return false;

      // Severity filter
      if (severityFilter !== 'all' && aidRequest.priority !== severityFilter) return false;

      // Distance filter: if radius is selected, must be within radius or explicitly non-geographic
      if (distanceRadiusMiles > 0) {
        if (distanceMiles !== null && distanceMiles > distanceRadiusMiles) return false;
      }

      // Skill filter
      if (skillFilter !== 'all') {
        const hasSkill = domainVolunteer.skills.includes(skillFilter);
        if (!hasSkill) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = aidRequest.title.toLowerCase().includes(q);
        const matchesDetails = aidRequest.details?.toLowerCase().includes(q);
        const matchesItems = aidRequest.items?.some((i) => i.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDetails && !matchesItems) return false;
      }

      return true;
    });
  }, [requestMatches, categoryFilter, severityFilter, distanceRadiusMiles, skillFilter, domainVolunteer, searchQuery]);

  // ── Active Tasks for this Volunteer ────────────────────────────────────────
  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'accepted' || t.status === 'in_transit' || t.status === 'at_scene');
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'completed');
  }, [tasks]);

  // ── Atomic Task Acceptance Handler ─────────────────────────────────────────
  const handleAcceptTask = async (aidReq: AidRequest) => {
    if (!profile) {
      toast.error('Registration Required', {
        description: 'Please complete your volunteer profile before accepting rescue dispatches.',
      });
      onOpenVolunteerReg();
      return;
    }

    const domainReq = mapToDomainRequest(aidReq);

    // 1. Check double booking and concurrent assignment constraint
    const check = canAssignVolunteer(tasks, domainVolunteer.id, domainReq.id);
    if (!check.allowed) {
      toast.error('Assignment Constraint', {
        description: check.reason || 'You already have an in-flight mission or this request is already claimed.',
      });
      return;
    }

    // 2. Select compatible resource offer to allocate (if available)
    let allocatedOffer: ResourceOffer | null = null;
    let quantityToAllocate = 0;
    const reqItem = aidReq.items?.[0]?.toLowerCase() || '';

    const matchingOffer = resourceOffers.find(
      (off) =>
        (off.quantityAvailable - off.quantityAllocated > 0) &&
        (off.resourceType.toLowerCase().includes(reqItem) ||
          reqItem.includes(off.resourceType.toLowerCase()) ||
          off.resourceType.toLowerCase().includes('water') ||
          off.resourceType.toLowerCase().includes('meal'))
    );

    if (matchingOffer) {
      quantityToAllocate = Math.min(10, matchingOffer.quantityAvailable - matchingOffer.quantityAllocated);
      allocatedOffer = matchingOffer;
    }

    // 3. Create volunteer task record
    try {
      const { task: newTask } = createVolunteerTask(
        {
          emergencyRequestId: domainReq.id,
          volunteerId: domainVolunteer.id,
          volunteerName: domainVolunteer.displayName,
          status: 'accepted',
          allocatedResources: allocatedOffer
            ? [
                {
                  resourceOfferId: allocatedOffer.id,
                  type: allocatedOffer.resourceType,
                  quantity: quantityToAllocate,
                  unit: allocatedOffer.unit,
                },
              ]
            : [],
        },
        tasks
      );

      // 4. Update resource inventory allocation bounds
      if (allocatedOffer && quantityToAllocate > 0) {
        const updatedOffer = allocateResource(allocatedOffer, quantityToAllocate);
        setResourceOffers((prev) => prev.map((o) => (o.id === updatedOffer.id ? updatedOffer : o)));
      }

      // 5. Update local task ledger
      setTasks((prev) => [newTask, ...prev]);

      // 6. Notify App to update request status across all views consistently
      onHelpRequest(aidReq.id);

      // 7. Auto-update volunteer status to on_mission
      handleToggleAvailability('on_mission');

      toast.success('Mission Accepted & Dispatched!', {
        description: `You are assigned to ${aidReq.title}. View details in My Missions tab.`,
      });

      setActiveTab('missions');
    } catch (err: unknown) {
      toast.error('Task Claim Error', {
        description: err instanceof Error ? err.message : 'Unable to accept task.',
      });
    }
  };

  // ── Transition Task (In-Transit / At Scene) ─────────────────────────────────
  const handleProgressTask = (task: VolunteerTask, nextStatus: TaskLifecycleStatus, etaMinutes?: number) => {
    try {
      const updated = transitionTaskStatus(task, nextStatus, { etaMinutes });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      toast.success(`Task status updated: ${nextStatus.replace('_', ' ').toUpperCase()}`);
    } catch (err: unknown) {
      toast.error('Transition Error', {
        description: err instanceof Error ? err.message : 'Illegal status transition.',
      });
    }
  };

  // ── Complete Task & Fulfill Resources ──────────────────────────────────────
  const handleConfirmCompletion = () => {
    if (!completionModalTask) return;
    try {
      const updatedTask = transitionTaskStatus(completionModalTask, 'completed', {
        deliveryNotes: fulfillmentNotes.trim() || 'Delivered supplies to recipient. Mission fulfilled safely.',
      });

      // Fulfill allocated resources from inventory
      if (updatedTask.allocatedResources && updatedTask.allocatedResources.length > 0) {
        setResourceOffers((prev) =>
          prev.map((offer) => {
            const alloc = updatedTask.allocatedResources.find((r) => r.resourceOfferId === offer.id);
            if (alloc) {
              return fulfillAllocatedResource(offer, alloc.quantity);
            }
            return offer;
          })
        );
      }

      setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));

      // Mark request fulfilled across the app
      onResolveRequest(updatedTask.emergencyRequestId);

      // Re-enable volunteer availability
      handleToggleAvailability('available');

      toast.success('Mission Successfully Fulfilled!', {
        description: 'Fulfillment notes logged and inventory consumption recorded.',
      });

      setCompletionModalTask(null);
      setFulfillmentNotes('');
    } catch (err: unknown) {
      toast.error('Completion Error', {
        description: err instanceof Error ? err.message : 'Could not complete task.',
      });
    }
  };

  // ── Cancel Task & Deallocate Resources ─────────────────────────────────────
  const handleConfirmCancel = () => {
    if (!cancellingTask) return;
    try {
      const updatedTask = transitionTaskStatus(cancellingTask, 'cancelled', {
        cancelReason: cancelReason.trim() || 'Volunteer unable to proceed; returned to dispatch pool.',
      });

      // Deallocate resources back to inventory
      if (updatedTask.allocatedResources && updatedTask.allocatedResources.length > 0) {
        setResourceOffers((prev) =>
          prev.map((offer) => {
            const alloc = updatedTask.allocatedResources.find((r) => r.resourceOfferId === offer.id);
            if (alloc) {
              return deallocateResource(offer, alloc.quantity);
            }
            return offer;
          })
        );
      }

      setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      handleToggleAvailability('available');

      toast.info('Mission Cancelled & Deallocated', {
        description: 'Allocated supplies returned to neighborhood inventory pool.',
      });

      setCancellingTask(null);
      setCancelReason('');
    } catch (err: unknown) {
      toast.error('Cancellation Error', {
        description: err instanceof Error ? err.message : 'Could not cancel task.',
      });
    }
  };

  // ── Add New Resource Offer ─────────────────────────────────────────────────
  const handleCreateResourceOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfferType.trim() || newOfferQty <= 0) return;

    const newOffer: ResourceOffer = {
      id: `offer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      providerId: domainVolunteer.id,
      providerName: domainVolunteer.displayName,
      providerPhone: domainVolunteer.phone,
      resourceType: newOfferType.trim(),
      quantityAvailable: Number(newOfferQty),
      quantityAllocated: 0,
      unit: newOfferUnit.trim() || 'units',
      location: newOfferLocation.trim() || locationLabel,
      latitude: volunteerCoords ? volunteerCoords[0] : null,
      longitude: volunteerCoords ? volunteerCoords[1] : null,
      availabilityStatus: 'available',
      availabilityWindow: { start: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: newOfferNotes.trim() || undefined,
    };

    setResourceOffers((prev) => [newOffer, ...prev]);
    setNewOfferModalOpen(false);
    setNewOfferType('Drinking Water');
    setNewOfferQty(50);
    setNewOfferNotes('');

    toast.success('Resource Offer Registered', {
      description: `${newOffer.quantityAvailable} ${newOffer.unit} of ${newOffer.resourceType} added to community pool.`,
    });
  };

  // ── Metrics ────────────────────────────────────────────────────────────────
  const criticalCount = requests.filter((r) => r.priority === 'critical' && r.status !== 'fulfilled').length;
  const nearbyCount = filteredMatches.filter((m) => m.distanceMiles !== null && m.distanceMiles <= 2.0).length;
  const totalOfferedSupplies = resourceOffers.reduce((acc, curr) => acc + curr.quantityAvailable, 0);
  const totalAllocatedSupplies = resourceOffers.reduce((acc, curr) => acc + curr.quantityAllocated, 0);

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground min-h-[calc(100vh-4rem)]">
      {/* ── Decluttered Header & Telemetry ── */}
      <section className="border-b border-border bg-card/70 backdrop-blur-md px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {profile ? profile.displayName : 'Volunteer Dispatch Hub'}
                </h1>
                <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0">
                  {isOnline ? '🟢 Live' : '🟡 Offline'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3 w-3 text-primary" />
                <span>{profile?.serviceArea || locationLabel}</span>
                <span>•</span>
                <span>Radius: {distanceRadiusMiles > 0 ? `${distanceRadiusMiles} mi` : 'All'}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions & Status Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 3-State Availability Control */}
            <div className="flex items-center rounded-xl border border-border bg-background/80 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleToggleAvailability('available')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all',
                  domainVolunteer.availabilityStatus === 'available'
                    ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                ● Available
              </button>
              <button
                type="button"
                onClick={() => handleToggleAvailability('on_mission')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all',
                  domainVolunteer.availabilityStatus === 'on_mission'
                    ? 'bg-amber-500/20 text-amber-400 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                ● On Mission
              </button>
              <button
                type="button"
                onClick={() => handleToggleAvailability('offline')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all',
                  domainVolunteer.availabilityStatus === 'offline'
                    ? 'bg-muted text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Standby
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenVolunteerReg}
              className="text-xs h-8 border-border hover:bg-muted"
            >
              <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              Profile
            </Button>

            <Button
              size="sm"
              onClick={() => setNewOfferModalOpen(true)}
              className="text-xs h-8 bg-primary text-primary-foreground font-bold hover:bg-primary/90"
            >
              <Package className="h-3.5 w-3.5 mr-1" />
              Offer Supplies
            </Button>
          </div>
        </div>
      </section>

      {/* ── Compact 4-Metric Strip (Decluttered) ── */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3.5 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="px-3.5 py-2.5 rounded-xl border border-border/80 bg-card/60 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-muted-foreground">Nearby Needs</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{nearbyCount}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <LocateFixed className="h-4 w-4" />
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-destructive font-semibold">Critical Incidents</p>
              <p className="text-xl font-bold text-destructive mt-0.5">{criticalCount}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-destructive/15 flex items-center justify-center text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-amber-400 font-semibold">Active Missions</p>
              <p className="text-xl font-bold text-amber-400 mt-0.5">{activeTasks.length}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Truck className="h-4 w-4" />
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">Completed</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{completedTasks.length}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Dashboard Tabs ── */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-12 flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="nearby" className="text-xs font-semibold px-3 py-1.5 rounded-lg">
                Available Tasks
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {filteredMatches.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="missions" className="text-xs font-semibold px-3 py-1.5 rounded-lg relative">
                My Missions
                {activeTasks.length > 0 && (
                  <Badge className="ml-1.5 px-1.5 py-0 text-[10px] bg-amber-500 text-black font-bold animate-pulse">
                    {activeTasks.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resources" className="text-xs font-semibold px-3 py-1.5 rounded-lg">
                Supply Pool
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {resourceOffers.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-semibold px-3 py-1.5 rounded-lg">
                History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {completedTasks.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToMap}
              className="text-xs h-8 border-border hover:bg-muted self-start sm:self-auto"
            >
              <Compass className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Live Map View
            </Button>
          </div>

          {/* ════ TAB 1: NEARBY REQUESTS & MATCHING ENGINE ════ */}
          <TabsContent value="nearby" className="pt-3.5 flex-1 flex flex-col space-y-3.5">
            {/* Decluttered Filter Toolbar */}
            <div className="p-3 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search incident, needed items, or caller…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background border-border"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'rescue', label: 'Rescue' },
                  { id: 'medical', label: 'Medical' },
                  { id: 'food', label: 'Food & Water' },
                  { id: 'shelter', label: 'Shelter' },
                  { id: 'evacuation', label: 'Evac' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all',
                      categoryFilter === cat.id
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Distance Radius Select */}
              <select
                value={distanceRadiusMiles}
                onChange={(e) => setDistanceRadiusMiles(Number(e.target.value))}
                className="h-8 px-2.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground"
                aria-label="Distance filter"
              >
                <option value={1.0}>&le; 1 mi</option>
                <option value={2.0}>&le; 2 mi</option>
                <option value={5.0}>&le; 5 mi</option>
                <option value={0}>All Distances</option>
              </select>
            </div>

            {/* Recommendations Grid */}
            {filteredMatches.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-2xl text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">No Matching Aid Requests in Range</h3>
                <p className="text-xs text-muted-foreground max-w-md">
                  No active incidents match your current {distanceRadiusMiles > 0 ? `${distanceRadiusMiles}-mile` : ''} filter. Try broadening your distance radius or checking other categories.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter('all');
                    setSeverityFilter('all');
                    setDistanceRadiusMiles(0);
                    setSearchQuery('');
                  }}
                  className="text-xs"
                >
                  Reset All Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredMatches.map(({ aidRequest, recommendation, distanceMiles }) => {
                  const isExpanded = expandedRecId === aidRequest.id;
                  const hasActiveTask = tasks.some(
                    (t) =>
                      t.emergencyRequestId === aidRequest.id &&
                      t.status !== 'completed' &&
                      t.status !== 'cancelled'
                  );

                  return (
                    <div
                      key={aidRequest.id}
                      className={cn(
                        'p-4 rounded-xl border transition-all bg-card flex flex-col justify-between hover:border-primary/40 shadow-xs',
                        aidRequest.priority === 'critical'
                          ? 'border-l-4 border-l-destructive border-border/80'
                          : aidRequest.priority === 'urgent'
                          ? 'border-l-4 border-l-amber-500 border-border/80'
                          : 'border-l-4 border-l-info border-border/80'
                      )}
                    >
                      <div>
                        {/* Header: Urgency + Category + Match Score + Distance */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] uppercase font-mono font-bold px-1.5 py-0',
                                aidRequest.priority === 'critical'
                                  ? 'border-destructive text-destructive bg-destructive/10'
                                  : aidRequest.priority === 'urgent'
                                  ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                                  : 'border-info text-info bg-info/10'
                              )}
                            >
                              {aidRequest.priority}
                            </Badge>

                            <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
                              {aidRequest.category}
                            </Badge>

                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                              🎯 {recommendation.score}%
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            {recommendation.isGeographicMatch && distanceMiles !== null ? (
                              <span className="text-xs font-mono font-semibold text-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-primary" />
                                {distanceMiles.toFixed(1)} mi
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {aidRequest.locationDescription ? aidRequest.locationDescription.slice(0, 18) : 'Landmark'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Details */}
                        <h3 className="text-sm sm:text-base font-bold text-foreground mt-2 leading-snug">
                          {aidRequest.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {aidRequest.details}
                        </p>

                        {/* Caller Info & Required items */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {aidRequest.contactPhone && (
                            <a
                              href={`tel:${aidRequest.contactPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md hover:underline"
                            >
                              <Phone className="h-3 w-3" />
                              {aidRequest.contactPhone}
                            </a>
                          )}
                          {aidRequest.items &&
                            aidRequest.items.slice(0, 3).map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-mono"
                              >
                                {item}
                              </span>
                            ))}
                        </div>

                        {/* Minimal Match breakdown toggle */}
                        <div className="mt-2.5 pt-2 border-t border-border/40">
                          <button
                            type="button"
                            onClick={() => setExpandedRecId(isExpanded ? null : aidRequest.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground font-mono flex items-center gap-1"
                          >
                            <span>Matching Factors</span>
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 p-2 rounded-lg bg-muted/30 border border-border/40 text-[11px] space-y-1">
                              {recommendation.factors.map((f, idx) => (
                                <div key={idx} className="flex justify-between text-muted-foreground">
                                  <span>{f.factor}:</span>
                                  <span className="font-mono text-foreground">{f.score}/{f.maxScore} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions Footer with Prominent Directions button */}
                      <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenDetailsModal(aidRequest.id)}
                          className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>

                        <div className="flex items-center gap-2">
                          {/* DIRECTIONS BUTTON */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDirections(aidRequest)}
                            className="text-xs h-8 border-primary/30 hover:bg-primary/10 text-primary font-semibold"
                          >
                            <Navigation className="h-3.5 w-3.5 mr-1" />
                            Directions
                          </Button>

                          {hasActiveTask ? (
                            <Badge variant="outline" className="text-xs font-mono text-amber-400 border-amber-500/40">
                              Claimed
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              disabled={!recommendation.isEligible}
                              onClick={() => handleAcceptTask(aidRequest)}
                              className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-xs h-8 px-3"
                            >
                              <HeartHandshake className="h-3.5 w-3.5 mr-1" />
                              Accept
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ════ TAB 2: MY ACTIVE MISSIONS ════ */}
          <TabsContent value="missions" className="pt-4 flex-1 space-y-4">
            {activeTasks.length === 0 ? (
              <div className="p-12 border border-dashed border-border rounded-2xl text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground mx-auto">
                  <Truck className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">No In-Flight Missions</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  You are currently not dispatched on any active rescue missions. Browse the Nearby Requests tab and accept a matching dispatch.
                </p>
                <Button size="sm" onClick={() => setActiveTab('nearby')} className="text-xs">
                  Browse Available Dispatches
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTasks.map((task) => {
                  const matchingReq = requests.find((r) => r.id === task.emergencyRequestId);

                  return (
                    <div
                      key={task.id}
                      className="p-5 rounded-2xl border border-amber-500/40 bg-card shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                            <Truck className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-foreground">
                                {matchingReq?.title || `Rescue Task ${task.id.slice(-6)}`}
                              </h3>
                              <Badge className="bg-amber-500 text-black font-mono font-bold text-[10px] uppercase">
                                {task.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Accepted at: {new Date(task.acceptedAt || task.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        {/* Caller / Victim Contact Information */}
                        {matchingReq?.contactPhone && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            <span className="font-mono font-semibold">{matchingReq.contactPhone}</span>
                            <span className="text-muted-foreground">({matchingReq.contactName || 'Requester'})</span>
                          </div>
                        )}
                      </div>

                      {/* Allocated Supplies */}
                      {task.allocatedResources && task.allocatedResources.length > 0 && (
                        <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                          <span className="text-[11px] font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-primary" /> Allocated Delivery Supplies:
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {task.allocatedResources.map((res, idx) => (
                              <Badge key={idx} variant="secondary" className="font-mono text-xs">
                                {res.quantity} {res.unit} • {res.type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* State Machine Transition Buttons */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/60">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (matchingReq) {
                                handleDirections(matchingReq);
                              } else {
                                onNavigate?.({
                                  id: task.emergencyRequestId,
                                  name: `Rescue Incident #${task.emergencyRequestId.slice(-6)}`,
                                  address: locationLabel,
                                  coords: REGION_CENTERS[region] || REGION_CENTERS.ncr,
                                  type: 'emergency',
                                });
                              }
                            }}
                            className="text-xs border-primary/40 text-primary hover:bg-primary/10 font-bold"
                          >
                            <Navigation className="h-3.5 w-3.5 mr-1 text-primary" />
                            Directions
                          </Button>

                          {task.status === 'accepted' && (
                            <Button
                              size="sm"
                              onClick={() => handleProgressTask(task, 'in_transit', 15)}
                              className="text-xs bg-amber-500 text-black font-bold hover:bg-amber-400"
                            >
                              <Truck className="h-3.5 w-3.5 mr-1" />
                              Mark In-Transit (ETA 15m)
                            </Button>
                          )}

                          {task.status === 'in_transit' && (
                            <Button
                              size="sm"
                              onClick={() => handleProgressTask(task, 'at_scene')}
                              className="text-xs bg-emerald-500 text-black font-bold hover:bg-emerald-400"
                            >
                              <MapPin className="h-3.5 w-3.5 mr-1" />
                              Arrived At Scene
                            </Button>
                          )}

                          {(task.status === 'at_scene' || task.status === 'in_transit') && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setCompletionModalTask(task);
                                setFulfillmentNotes('');
                              }}
                              className="text-xs bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                            >
                              <CheckCheck className="h-3.5 w-3.5 mr-1" />
                              Complete Mission
                            </Button>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCancellingTask(task);
                            setCancelReason('');
                          }}
                          className="text-xs text-destructive hover:bg-destructive/10"
                        >
                          Cancel Mission
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ════ TAB 3: RESOURCE OFFERS POOL ════ */}
          <TabsContent value="resources" className="pt-4 flex-1 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur">
              <div>
                <h3 className="text-sm font-bold text-foreground">Neighborhood Supplies & Logistics Inventory</h3>
                <p className="text-xs text-muted-foreground">
                  Food, potable water, blankets, vehicles, and medical kits tracked with non-over-allocation invariant.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setNewOfferModalOpen(true)}
                className="text-xs bg-primary text-primary-foreground font-bold hover:bg-primary/90"
              >
                <Package className="h-3.5 w-3.5 mr-1" />
                Register New Supply
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {resourceOffers.map((offer) => {
                const remaining = Math.max(0, offer.quantityAvailable - offer.quantityAllocated);

                return (
                  <div
                    key={offer.id}
                    className="p-4 rounded-2xl border border-border/80 bg-card flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-foreground">{offer.resourceType}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-mono font-bold uppercase',
                            offer.availabilityStatus === 'available'
                              ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                              : offer.availabilityStatus === 'partially_allocated'
                              ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                              : 'border-muted text-muted-foreground'
                          )}
                        >
                          {offer.availabilityStatus.replace('_', ' ')}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-primary" /> {offer.location}
                      </p>

                      {offer.notes && <p className="text-[11px] text-muted-foreground mt-2 italic">{offer.notes}</p>}
                    </div>

                    {/* Quantities Ledger */}
                    <div className="pt-3 border-t border-border/60">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded-xl bg-muted/30">
                          <span className="text-[10px] font-mono text-muted-foreground block">Offered</span>
                          <span className="font-bold text-foreground">
                            {offer.quantityAvailable} {offer.unit}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <span className="text-[10px] font-mono text-amber-400 block">Allocated</span>
                          <span className="font-bold text-amber-400">
                            {offer.quantityAllocated} {offer.unit}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-[10px] font-mono text-emerald-400 block">Remaining</span>
                          <span className="font-bold text-emerald-400">
                            {remaining} {offer.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ════ TAB 4: COMPLETED MISSIONS HISTORY ════ */}
          <TabsContent value="history" className="pt-4 flex-1 space-y-4">
            {completedTasks.length === 0 ? (
              <div className="p-12 border border-dashed border-border rounded-2xl text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">No Missions Completed Yet</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  When you complete assigned rescue dispatches and log fulfillment receipts, they will appear here as verified relief history.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl border border-emerald-500/30 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <CheckCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Mission {t.id.slice(-8)}</h4>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono uppercase">
                            Fulfilled
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Completed: {t.completedAt ? new Date(t.completedAt).toLocaleString() : 'Recently'}
                        </p>
                        {t.deliveryNotes && (
                          <p className="text-xs text-foreground/90 mt-1.5 p-2 rounded-lg bg-muted/40 font-mono">
                            &ldquo;{t.deliveryNotes}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {t.allocatedResources?.length || 0} Supplies Fulfilled
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* ── Modal: Complete Mission & Log Fulfillment Notes ── */}
      <Dialog open={Boolean(completionModalTask)} onOpenChange={(open) => !open && setCompletionModalTask(null)}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Log Mission Fulfillment Notes
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record receipt verification, quantities delivered, and on-scene observations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Fulfillment & Delivery Notes</Label>
              <textarea
                rows={4}
                value={fulfillmentNotes}
                onChange={(e) => setFulfillmentNotes(e.target.value)}
                placeholder="e.g. Delivered 20L drinking water and 1 trauma kit to Caretaker Verma. Recipient safe."
                className="w-full mt-1.5 p-3 rounded-xl bg-background border border-border text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompletionModalTask(null)}
                className="text-xs text-muted-foreground"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmCompletion}
                className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-xs"
              >
                Confirm & Mark Fulfilled
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Cancel Mission ── */}
      <Dialog open={Boolean(cancellingTask)} onOpenChange={(open) => !open && setCancellingTask(null)}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Cancel Rescue Mission
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cancelling releases allocated supplies back to the neighborhood inventory and returns the request to the open dispatch pool.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Reason for Cancellation</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Road blocked by floodwater / redirecting to critical incident"
                className="mt-1.5 text-xs bg-background border-border"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setCancellingTask(null)} className="text-xs">
                Keep Mission
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmCancel}
                className="text-xs font-bold"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Register New Community Resource Offer ── */}
      <Dialog open={newOfferModalOpen} onOpenChange={setNewOfferModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Package className="h-5 w-5 text-primary" /> Offer Supplies to Neighborhood Pool
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Contribute drinking water, rations, blankets, or transport equipment for responder dispatch.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateResourceOffer} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Supply / Resource Type</Label>
              <Input
                value={newOfferType}
                onChange={(e) => setNewOfferType(e.target.value)}
                placeholder="e.g. Potable Water, Ready-to-eat Meals, Tarps"
                required
                className="mt-1 text-xs bg-background border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono uppercase text-muted-foreground">Quantity Available</Label>
                <Input
                  type="number"
                  min="1"
                  value={newOfferQty}
                  onChange={(e) => setNewOfferQty(Math.max(1, Number(e.target.value)))}
                  required
                  className="mt-1 text-xs bg-background border-border"
                />
              </div>
              <div>
                <Label className="text-xs font-mono uppercase text-muted-foreground">Unit</Label>
                <Input
                  value={newOfferUnit}
                  onChange={(e) => setNewOfferUnit(e.target.value)}
                  placeholder="liters / packs / kits"
                  required
                  className="mt-1 text-xs bg-background border-border"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Location / Staging Depot</Label>
              <Input
                value={newOfferLocation}
                onChange={(e) => setNewOfferLocation(e.target.value)}
                placeholder="e.g. Connaught Place Civic Hall"
                className="mt-1 text-xs bg-background border-border"
              />
            </div>

            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Additional Notes</Label>
              <Input
                value={newOfferNotes}
                onChange={(e) => setNewOfferNotes(e.target.value)}
                placeholder="e.g. Sealed containers, ready for immediate pickup"
                className="mt-1 text-xs bg-background border-border"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" type="button" onClick={() => setNewOfferModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold text-xs">
                Register Offer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
