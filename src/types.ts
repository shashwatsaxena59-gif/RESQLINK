export type RequestCategory =
  | 'medical'
  | 'food'
  | 'shelter'
  | 'volunteers'
  | 'rescue';

export type RequestPriority = 'critical' | 'urgent' | 'moderate';

export type RequestStatus = 'active' | 'in-progress' | 'fulfilled' | 'queued' | 'resolved' | 'cancelled';

export type ShelterOperatingStatus = 'open' | 'full' | 'evacuating' | 'closed';

export interface AidRequest {
  id: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  title: string;
  details: string;
  items: string[];
  contactName: string;
  contactPhone: string;
  distanceMiles: number;
  createdAt: number;
  coords: { x: number; y: number };
  peopleCount: number;
  isUserCreated?: boolean;
  region?: string;
  locationDescription?: string;
  locationAccuracy?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  assignedVolunteerId?: string | null;
  assignedVolunteerName?: string | null;
  syncStatus?: 'pending' | 'synced' | 'conflict' | 'failed';
  acknowledged?: boolean;
  acknowledgedAt?: string;
  triage?: {
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    incidentType: string;
    people: number | null;
    vulnerable?: { elderly: number; children: number; pregnant: number; disabled: number; injured: number };
    dangerIndicators?: string[];
    priorityReasons?: string[];
    requiredResources?: string[];
    rawMessage?: string;
    parsedBy?: 'gemini' | 'fallback';
  };
}

export interface ShelterInventoryItem {
  quantity: number;
  unit: string;
  minThreshold?: number;
  lastRestockedAt?: string;
}

export interface IncomingDelivery {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  expectedAt: string;
  source: string;
  status: 'scheduled' | 'in_transit' | 'delivered';
  notes?: string;
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  capacity: number;
  occupied: number;
  totalCapacity?: number;
  occupiedBeds?: number;
  reservedBeds?: number;
  coords: { x: number; y: number };
  latitude?: number;
  longitude?: number;
  amenities: string[];
  status: 'open' | 'full' | 'closing' | 'evacuating' | 'closed';
  operatingStatus?: 'open' | 'full' | 'evacuating' | 'closed';
  lastUpdatedAt?: string;
  contactPhone?: string;
  accessibilityFeatures?: string[];
  region?: string;
  inventory?: Record<string, ShelterInventoryItem>;
  incomingDeliveries?: IncomingDelivery[];
  resourceShortages?: string[];
}

export interface Volunteer {
  id: string;
  name: string;
  skills: string[];
  coords: { x: number; y: number };
  distanceMiles: number;
  available: boolean;
  locationSharingPermission?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string;
}

export type ResourceType = 'hospital' | 'pharmacy' | 'food' | 'shelter' | 'rescue';

export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  address: string;
  distanceMiles: number;
  coords: { x: number; y: number };
  open24h: boolean;
  phone: string;
  tags: string[];
  status: 'open' | 'limited' | 'closed';
  bedsAvailable?: number;
}

export type VolunteerOfferCategory = 'medical' | 'food' | 'water' | 'shelter' | 'transport' | 'rescue' | 'other';

export type VolunteerGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type VolunteerStatus = 'registered' | 'available' | 'on-duty' | 'unavailable';

export interface VolunteerRegistration {
  id: string;
  fullName: string;
  gender: VolunteerGender;
  phone: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  locationPermission: boolean;
  status: VolunteerStatus;
  createdAt: number;
}

export interface VolunteerRegistrationInput {
  fullName: string;
  displayName?: string;
  gender?: VolunteerGender;
  phone?: string;
  email?: string;
  skills?: string[];
  offeredSupplies?: Array<{ type: string; quantity: number; unit: string }>;
  preferredCategories?: string[];
  availabilityStatus?: 'available' | 'on_mission' | 'offline' | 'unavailable';
  serviceArea?: string;
  serviceRadiusMiles?: number;
  latitude: number | null;
  longitude: number | null;
  locationPermission: boolean;
}

export interface VolunteerOffer {
  id: string;
  category: VolunteerOfferCategory;
  title: string;
  details: string;
  quantity: string;
  contactName: string;
  contactPhone: string;
  location: string;
  photoPath: string | null;
  photoUrl: string | null;
  status: 'available' | 'limited' | 'fulfilled';
  createdAt: number;
}

export type FilterCategory = 'all' | RequestCategory;

export const CATEGORY_META: Record<
  RequestCategory,
  { label: string; icon: string; color: string; bg: string; text: string; border: string }
> = {
  medical: {
    label: 'Medical Aid',
    icon: 'HeartPulse',
    color: 'alert',
    bg: 'bg-alert/10',
    text: 'text-alert',
    border: 'border-alert/30',
  },
  food: {
    label: 'Food & Water',
    icon: 'Droplets',
    color: 'warning',
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/30',
  },
  shelter: {
    label: 'Shelter Beds',
    icon: 'BedDouble',
    color: 'info',
    bg: 'bg-info/10',
    text: 'text-info',
    border: 'border-info/30',
  },
  volunteers: {
    label: 'Volunteers Needed',
    icon: 'Users',
    color: 'success',
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/30',
  },
  rescue: {
    label: 'Rescue',
    icon: 'LifeBuoy',
    color: 'alert',
    bg: 'bg-alert/10',
    text: 'text-alert',
    border: 'border-alert/30',
  },
};

export const PRIORITY_META: Record<
  RequestPriority,
  { label: string; color: string; bg: string; text: string }
> = {
  critical: { label: 'Critical', color: 'alert',   bg: 'bg-alert/10',   text: 'text-alert' },
  urgent:   { label: 'Urgent',   color: 'warning', bg: 'bg-warning/10', text: 'text-warning' },
  moderate: { label: 'Moderate', color: 'info',    bg: 'bg-info/10',    text: 'text-info' },
};

export const FILTER_TABS: { id: FilterCategory; label: string }[] = [
  { id: 'all', label: 'All Requests' },
  { id: 'medical', label: 'Medical Aid' },
  { id: 'food', label: 'Food & Water' },
  { id: 'shelter', label: 'Shelter Beds' },
  { id: 'volunteers', label: 'Volunteers Needed' },
];

// ─────────────────────────────────────────────────────────────────────────────
// NGO MANAGEMENT SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/** Status of a rescue task in the lifecycle */
export type RescueTaskStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'AWAITING_CONFIRMATION'
  | 'RESCUED'
  | 'CANCELLED';

/** Availability status of a volunteer member */
export type VolunteerMemberStatus = 'AVAILABLE' | 'ON_MISSION' | 'OFFLINE';

/** Verification status of an NGO */
export type NgoVerificationStatus = 'PENDING' | 'VERIFIED' | 'SUSPENDED';

/** An NGO (Non-Governmental Organization) registered in ResQLink */
export interface NgoProfile {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  serviceArea: string;
  description: string;
  verificationStatus: NgoVerificationStatus;
  passwordHash: string; // simple bcrypt-free hash for local demo
  createdAt: number;
}

/** Input type for NGO registration */
export interface NgoRegistrationInput {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  serviceArea: string;
  description: string;
  password: string;
}

/** A volunteer who belongs to an NGO */
export interface VolunteerMember {
  id: string;
  ngoId: string;
  fullName: string;
  phone: string;
  email: string;
  skills: string[];
  status: VolunteerMemberStatus;
  currentTaskId: string | null;
  joinedAt: number;
}

/** Input type for adding a volunteer to an NGO */
export interface VolunteerMemberInput {
  ngoId: string;
  fullName: string;
  phone: string;
  email: string;
  skills: string[];
}

/** A rescue task linking an AidRequest to an NGO volunteer assignment */
export interface RescueTask {
  id: string;
  /** The original AidRequest this task was created from */
  requestId: string;
  /** Snapshot of request details for display */
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  location: string;
  coords: { x: number; y: number };
  peopleCount: number;
  contactName: string;
  contactPhone: string;
  region: string;
  /** Assignment & lifecycle */
  status: RescueTaskStatus;
  assignedNgoId: string | null;
  assignedNgoName: string | null;
  assignedVolunteerId: string | null;
  assignedVolunteerName: string | null;
  /** Timestamps */
  createdAt: number;
  assignedAt: number | null;
  startedAt: number | null;
  completionRequestedAt: number | null;
  confirmedAt: number | null;
  completedAt: number | null;
  /** Confirmation metadata */
  confirmedByNgoId: string | null;
  confirmedByName: string | null;
  /** Cancellation */
  cancelledAt: number | null;
  cancelReason: string | null;
}

/** Input for creating a rescue task from an AidRequest */
export interface RescueTaskCreateInput {
  requestId: string;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  location: string;
  coords: { x: number; y: number };
  peopleCount: number;
  contactName: string;
  contactPhone: string;
  region: string;
}

/** Response from the atomic task assignment endpoint */
export interface TaskAssignmentResponse {
  ok: boolean;
  task?: RescueTask;
  error?: string;
  alreadyAssigned?: boolean;
}

/** The NGO data store persisted on server */
export interface NgoStore {
  ngos: NgoProfile[];
  volunteers: VolunteerMember[];
  tasks: RescueTask[];
  version: number;
}

/** Stats computed for the NGO dashboard overview */
export interface NgoDashboardStats {
  totalVolunteers: number;
  availableVolunteers: number;
  onMissionVolunteers: number;
  offlineVolunteers: number;
  activeRescues: number;
  completedRescues: number;
  awaitingConfirmation: number;
}

export const RESCUE_TASK_STATUS_META: Record<
  RescueTaskStatus,
  { label: string; color: string; bg: string; text: string; emoji: string }
> = {
  AVAILABLE:             { label: 'Available',             color: 'success', bg: 'bg-success/10', text: 'text-success',  emoji: '' },
  ASSIGNED:              { label: 'Assigned',              color: 'info',    bg: 'bg-info/10',    text: 'text-info',     emoji: '' },
  IN_PROGRESS:           { label: 'In Progress',           color: 'warning', bg: 'bg-warning/10', text: 'text-warning',  emoji: '' },
  AWAITING_CONFIRMATION: { label: 'Awaiting Confirmation', color: 'warning', bg: 'bg-warning/10', text: 'text-warning',  emoji: '' },
  RESCUED:               { label: 'Rescued',               color: 'success', bg: 'bg-success/10', text: 'text-success',  emoji: '' },
  CANCELLED:             { label: 'Cancelled',             color: 'alert',   bg: 'bg-alert/10',   text: 'text-alert',    emoji: '' },
};

export const VOLUNTEER_MEMBER_STATUS_META: Record<
  VolunteerMemberStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  AVAILABLE:   { label: 'Available',   bg: 'bg-success/10',  text: 'text-success',          dot: 'bg-success' },
  ON_MISSION:  { label: 'On Mission',  bg: 'bg-warning/10',  text: 'text-warning',          dot: 'bg-warning' },
  OFFLINE:     { label: 'Offline',     bg: 'bg-muted/50',    text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION NAVIGATION & USER ROLES
// ─────────────────────────────────────────────────────────────────────────────

export type AppNavRoute =
  | 'home'
  | 'operations'
  | 'sos'
  | 'map'
  | 'volunteer'
  | 'shelters'
  | 'resources'
  | 'sync'
  | 'profile';

export type UserRole =
  | 'citizen'
  | 'volunteer'
  | 'shelter_officer'
  | 'coordinator';

export interface UserRoleMeta {
  id: UserRole;
  label: string;
  tagline: string;
  badge: string;
  color: string;
  allowedRoutes: AppNavRoute[];
}

export const USER_ROLES: Record<UserRole, UserRoleMeta> = {
  citizen: {
    id: 'citizen',
    label: 'Citizen / Requester',
    tagline: 'Seeking aid, nearby shelter, or emergency updates',
    badge: 'Citizen',
    color: 'text-foreground',
    allowedRoutes: ['home', 'map', 'shelters', 'resources', 'sync', 'profile'],
  },
  volunteer: {
    id: 'volunteer',
    label: 'Community Volunteer',
    tagline: 'Providing rescue, supplies, and field assistance',
    badge: 'Volunteer',
    color: 'text-primary',
    allowedRoutes: ['home', 'map', 'volunteer', 'shelters', 'resources', 'sync', 'profile'],
  },
  shelter_officer: {
    id: 'shelter_officer',
    label: 'Shelter Manager',
    tagline: 'Managing facility beds, intake, and essential supplies',
    badge: 'Shelter Ops',
    color: 'text-info',
    allowedRoutes: ['home', 'shelters', 'operations', 'map', 'resources', 'sync', 'profile'],
  },
  coordinator: {
    id: 'coordinator',
    label: 'Disaster Coordinator / NGO',
    tagline: 'Operations overview, task dispatch, and resource coordination',
    badge: 'Incident Command',
    color: 'text-alert',
    allowedRoutes: ['home', 'operations', 'map', 'volunteer', 'shelters', 'resources', 'sync', 'profile'],
  },
};

