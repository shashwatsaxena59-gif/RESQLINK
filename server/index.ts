import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  authenticateUser,
  requireAuth,
  requireRole,
  requireShelterOperator,
  createAuthToken,
  verifyAuthToken,
  hashPassword,
  usersStore,
  writeUsersStore,
  sanitizeUser,
  maskMedicalDataForViewer,
  SEED_USERS,
} from './auth';
import { handleEventStream, broadcastEvent } from './realtime';
import { recordAuditEvent, readAuditEvents } from './audit';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// Allow requests from all origins (localhost, Wi-Fi LAN IP, mobile devices)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '64kb' }));
// Also accept url-encoded bodies (some proxies rewrite Content-Type)
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// ── Idempotency Cache ─────────────────────────────────────────────────────────
interface IdempotentRecord {
  statusCode: number;
  body: any;
  timestamp: number;
}
const idempotencyMap = new Map<string, IdempotentRecord>();

function checkIdempotency(req: Request, res: Response, next: NextFunction) {
  const rawKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    next();
    return;
  }
  const key = rawKey.trim();
  const cached = idempotencyMap.get(key);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
    res.status(cached.statusCode).json(cached.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyMap.set(key, {
        statusCode: res.statusCode,
        body,
        timestamp: Date.now(),
      });
    }
    return originalJson(body);
  };
  next();
}

app.use(authenticateUser);
app.use(checkIdempotency);

// ── Data directory ────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sync-store.json');
const NGO_FILE  = path.join(DATA_DIR, 'ngo-store.json');
const SHELTER_FILE = path.join(DATA_DIR, 'shelter-store.json');
const RESOURCE_OFFERS_FILE = path.join(DATA_DIR, 'resource-offers.json');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); }
  catch (e) { console.error('[DataDir] mkdir error:', e); }
}

// ── Sync Store (existing) ─────────────────────────────────────────────────────
interface SyncStore {
  requests: any[];
  resolvedIds: string[];
  helpingIds: string[];
  version: number;
}

function readStore(): SyncStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) { console.error('[SyncStore] Read error:', e); }
  return { requests: [], resolvedIds: [], helpingIds: [], version: 1 };
}

function writeStore(data: SyncStore) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('[SyncStore] Write error:', e); }
}

let syncStore = readStore();

// ── NGO Store (new) ───────────────────────────────────────────────────────────

type RescueTaskStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'AWAITING_CONFIRMATION'
  | 'RESCUED'
  | 'CANCELLED';

type VolunteerMemberStatus = 'AVAILABLE' | 'ON_MISSION' | 'OFFLINE';

interface NgoProfile {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  serviceArea: string;
  description: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'SUSPENDED';
  passwordHash: string;
  createdAt: number;
}

interface VolunteerMember {
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

interface RescueTask {
  id: string;
  requestId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  location: string;
  coords: { x: number; y: number };
  peopleCount: number;
  contactName: string;
  contactPhone: string;
  region: string;
  status: RescueTaskStatus;
  assignedNgoId: string | null;
  assignedNgoName: string | null;
  assignedVolunteerId: string | null;
  assignedVolunteerName: string | null;
  createdAt: number;
  assignedAt: number | null;
  startedAt: number | null;
  completionRequestedAt: number | null;
  confirmedAt: number | null;
  completedAt: number | null;
  confirmedByNgoId: string | null;
  confirmedByName: string | null;
  cancelledAt: number | null;
  cancelReason: string | null;
}

interface NgoStore {
  ngos: NgoProfile[];
  volunteers: VolunteerMember[];
  tasks: RescueTask[];
  version: number;
}

function readNgoStore(): NgoStore {
  try {
    if (fs.existsSync(NGO_FILE)) {
      const raw = fs.readFileSync(NGO_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) { console.error('[NgoStore] Read error:', e); }
  return { ngos: [], volunteers: [], tasks: [], version: 1 };
}

function writeNgoStore(data: NgoStore) {
  // Throws on failure — callers must wrap in try/catch to handle gracefully
  fs.writeFileSync(NGO_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let ngoStore = readNgoStore();

// ── Shelter Store ─────────────────────────────────────────────────────────────

interface ServerShelterInventoryItem {
  quantity: number;
  unit: string;
  minThreshold?: number;
  lastRestockedAt?: string;
}

interface ServerIncomingDelivery {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  expectedAt: string;
  source: string;
  status: 'scheduled' | 'in_transit' | 'delivered';
  notes?: string;
}

interface ServerShelter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  coords: { x: number; y: number };
  totalCapacity: number;
  occupiedBeds: number;
  reservedBeds: number;
  capacity: number;
  occupied: number;
  operatingStatus: 'open' | 'full' | 'evacuating' | 'closed';
  status: 'open' | 'full' | 'evacuating' | 'closed';
  inventory: Record<string, ServerShelterInventoryItem>;
  incomingDeliveries: ServerIncomingDelivery[];
  resourceShortages: string[];
  lastUpdatedAt: string;
  contactPhone?: string;
  amenities: string[];
  region: string;
}

interface ShelterStore {
  shelters: ServerShelter[];
  version: number;
}

const SEED_SHELTERS: ServerShelter[] = [
  {
    id: 'shelter-001',
    name: 'Rajkiya Sarvodaya Bal Vidyalaya, Mayur Vihar',
    address: 'Pocket 1, Mayur Vihar Phase I, East Delhi',
    latitude: 28.601,
    longitude: 77.295,
    coords: { x: 28, y: 50 },
    totalCapacity: 60,
    occupiedBeds: 45,
    reservedBeds: 5,
    capacity: 60,
    occupied: 45,
    operatingStatus: 'open',
    status: 'open',
    amenities: ['Pet-friendly', 'Accessible', 'Hot meals (ISKCON)', 'Medical staff'],
    contactPhone: '+91 11 2275 1100',
    region: 'ncr',
    lastUpdatedAt: new Date().toISOString(),
    inventory: {
      water_liters: { quantity: 1800, unit: 'liters', minThreshold: 400, lastRestockedAt: new Date().toISOString() },
      meals: { quantity: 450, unit: 'packets', minThreshold: 100, lastRestockedAt: new Date().toISOString() },
      blankets: { quantity: 150, unit: 'units', minThreshold: 50, lastRestockedAt: new Date().toISOString() },
      cots: { quantity: 60, unit: 'units', minThreshold: 20, lastRestockedAt: new Date().toISOString() },
      first_aid_kits: { quantity: 24, unit: 'kits', minThreshold: 10, lastRestockedAt: new Date().toISOString() },
    },
    incomingDeliveries: [
      {
        id: 'del-001',
        item: 'blankets',
        quantity: 50,
        unit: 'units',
        expectedAt: new Date(Date.now() + 2 * 3600000).toISOString(),
        source: 'Red Cross Depot',
        status: 'in_transit',
        notes: 'En route via transport van DL-1V-4421',
      },
    ],
    resourceShortages: [],
  },
  {
    id: 'shelter-002',
    name: 'Talkatora Indoor Stadium',
    address: 'Willingdon Crescent, New Delhi',
    latitude: 28.621,
    longitude: 77.195,
    coords: { x: 64, y: 68 },
    totalCapacity: 120,
    occupiedBeds: 118,
    reservedBeds: 2,
    capacity: 120,
    occupied: 118,
    operatingStatus: 'full',
    status: 'full',
    amenities: ['Cots provided', 'Family rooms', 'Charging station', '24/7 Security'],
    contactPhone: '+91 11 2309 3322',
    region: 'ncr',
    lastUpdatedAt: new Date().toISOString(),
    inventory: {
      water_liters: { quantity: 3200, unit: 'liters', minThreshold: 600, lastRestockedAt: new Date().toISOString() },
      meals: { quantity: 550, unit: 'packets', minThreshold: 200, lastRestockedAt: new Date().toISOString() },
      blankets: { quantity: 120, unit: 'units', minThreshold: 40, lastRestockedAt: new Date().toISOString() },
      hygiene_kits: { quantity: 25, unit: 'kits', minThreshold: 50, lastRestockedAt: new Date().toISOString() },
    },
    incomingDeliveries: [
      {
        id: 'del-002',
        item: 'hygiene_kits',
        quantity: 100,
        unit: 'kits',
        expectedAt: new Date(Date.now() + 3.5 * 3600000).toISOString(),
        source: 'Delhi Civil Defence Warehouse',
        status: 'scheduled',
        notes: 'Priority restocking shipment',
      },
    ],
    resourceShortages: ['hygiene_kits'],
  },
  {
    id: 'shelter-003',
    name: 'Ramleela Ground, Red Fort',
    address: 'Chandni Chowk, Old Delhi',
    latitude: 28.652,
    longitude: 77.234,
    coords: { x: 82, y: 38 },
    totalCapacity: 100,
    occupiedBeds: 72,
    reservedBeds: 3,
    capacity: 100,
    occupied: 72,
    operatingStatus: 'open',
    status: 'open',
    amenities: ['Hot meals (Gurudwara)', 'Quiet space', 'Counseling', 'Medical outpost'],
    contactPhone: '+91 11 2327 5544',
    region: 'ncr',
    lastUpdatedAt: new Date().toISOString(),
    inventory: {
      water_liters: { quantity: 1500, unit: 'liters', minThreshold: 300, lastRestockedAt: new Date().toISOString() },
      meals: { quantity: 400, unit: 'packets', minThreshold: 100, lastRestockedAt: new Date().toISOString() },
      blankets: { quantity: 95, unit: 'units', minThreshold: 30, lastRestockedAt: new Date().toISOString() },
      baby_supplies: { quantity: 30, unit: 'kits', minThreshold: 15, lastRestockedAt: new Date().toISOString() },
    },
    incomingDeliveries: [],
    resourceShortages: [],
  },
  {
    id: 'shelter-004',
    name: 'Chhatrasal Stadium',
    address: 'Model Town, North Delhi',
    latitude: 28.705,
    longitude: 77.189,
    coords: { x: 16, y: 36 },
    totalCapacity: 200,
    occupiedBeds: 134,
    reservedBeds: 10,
    capacity: 200,
    occupied: 134,
    operatingStatus: 'open',
    status: 'open',
    amenities: ['Large capacity', 'Medical staff (GTB Hospital)', 'Pet-friendly', 'Showers'],
    contactPhone: '+91 11 2745 2200',
    region: 'ncr',
    lastUpdatedAt: new Date().toISOString(),
    inventory: {
      water_liters: { quantity: 4500, unit: 'liters', minThreshold: 1000, lastRestockedAt: new Date().toISOString() },
      meals: { quantity: 1100, unit: 'packets', minThreshold: 300, lastRestockedAt: new Date().toISOString() },
      blankets: { quantity: 220, unit: 'units', minThreshold: 80, lastRestockedAt: new Date().toISOString() },
      cots: { quantity: 180, unit: 'units', minThreshold: 50, lastRestockedAt: new Date().toISOString() },
    },
    incomingDeliveries: [],
    resourceShortages: [],
  },
  {
    id: 'ch-shelter-001',
    name: 'ITBP Camp — Joshimath',
    address: 'ITBP Campus, Upper Joshimath, Chamoli',
    latitude: 30.556,
    longitude: 79.564,
    coords: { x: 52, y: 28 },
    totalCapacity: 500,
    occupiedBeds: 180,
    reservedBeds: 20,
    capacity: 500,
    occupied: 180,
    operatingStatus: 'open',
    status: 'open',
    amenities: ['Helipad', 'Medical unit', 'Rations', 'Blankets', 'Radio comms', '24/7'],
    contactPhone: '01389-222001',
    region: 'badrinath',
    lastUpdatedAt: new Date().toISOString(),
    inventory: {
      water_liters: { quantity: 8000, unit: 'liters', minThreshold: 1500, lastRestockedAt: new Date().toISOString() },
      meals: { quantity: 2000, unit: 'packets', minThreshold: 500, lastRestockedAt: new Date().toISOString() },
      blankets: { quantity: 400, unit: 'units', minThreshold: 100, lastRestockedAt: new Date().toISOString() },
      oxygen_cylinders: { quantity: 30, unit: 'cylinders', minThreshold: 10, lastRestockedAt: new Date().toISOString() },
    },
    incomingDeliveries: [],
    resourceShortages: [],
  },
  {
    id: 'ch-shelter-002',
    name: 'Govt Inter College — Joshimath',
    address: 'Upper Market Area, Joshimath, Chamoli',
    latitude: 30.559,
    longitude: 79.568,
    coords: { x: 44, y: 46 },
    totalCapacity: 300,
    occupiedBeds: 220,
    reservedBeds: 30,
    capacity: 300,
    occupied: 220,
    operatingStatus: 'open',
    status: 'open',
    amenities: ['Accessible', 'Hot meals (Gurudwara Govindghat)', 'Toilets', 'Water supply'],
    contactPhone: '01389-222110',
    region: 'badrinath',
    lastUpdatedAt: new Date().toISOString(),
    inventory: {
      water_liters: { quantity: 3500, unit: 'liters', minThreshold: 800, lastRestockedAt: new Date().toISOString() },
      meals: { quantity: 800, unit: 'packets', minThreshold: 250, lastRestockedAt: new Date().toISOString() },
      blankets: { quantity: 250, unit: 'units', minThreshold: 75, lastRestockedAt: new Date().toISOString() },
    },
    incomingDeliveries: [],
    resourceShortages: [],
  },
  {
    id: 'ch-shelter-003',
    name: 'Narsingh Temple Dharamshala',
    address: 'Near Narsingh Temple, Upper Joshimath',
    latitude: 30.554,
    longitude: 79.561,
    coords: { x: 48, y: 38 },
    totalCapacity: 150,
    occupiedBeds: 90,
    reservedBeds: 10,
    capacity: 150,
    occupied: 90,
    operatingStatus: 'open',
    status: 'open',
    amenities: ['Kitchen', 'Blankets', 'Safe elevation', 'Prayers'],
    contactPhone: '01389-222340',
    region: 'badrinath',
    lastUpdatedAt: new Date().toISOString(),
    inventory: {
      water_liters: { quantity: 1800, unit: 'liters', minThreshold: 400, lastRestockedAt: new Date().toISOString() },
      meals: { quantity: 500, unit: 'packets', minThreshold: 150, lastRestockedAt: new Date().toISOString() },
      blankets: { quantity: 120, unit: 'units', minThreshold: 40, lastRestockedAt: new Date().toISOString() },
    },
    incomingDeliveries: [],
    resourceShortages: [],
  },
  {
    id: 'ch-shelter-004',
    name: 'Auli GMVN Rest House',
    address: 'Auli Ski Resort Area, 2,519 m altitude',
    latitude: 30.531,
    longitude: 79.571,
    coords: { x: 36, y: 20 },
    totalCapacity: 120,
    occupiedBeds: 30,
    reservedBeds: 5,
    capacity: 120,
    occupied: 30,
    operatingStatus: 'open',
    status: 'open',
    amenities: ['Heated rooms', 'High-altitude staging', 'Generator backup', 'Catering'],
    contactPhone: '01389-223208',
    region: 'badrinath',
    lastUpdatedAt: new Date().toISOString(),
    inventory: {
      water_liters: { quantity: 2000, unit: 'liters', minThreshold: 400, lastRestockedAt: new Date().toISOString() },
      meals: { quantity: 400, unit: 'packets', minThreshold: 100, lastRestockedAt: new Date().toISOString() },
      blankets: { quantity: 150, unit: 'units', minThreshold: 50, lastRestockedAt: new Date().toISOString() },
      heating_fuel_liters: { quantity: 500, unit: 'liters', minThreshold: 100, lastRestockedAt: new Date().toISOString() },
    },
    incomingDeliveries: [],
    resourceShortages: [],
  },
];

function readShelterStore(): ShelterStore {
  try {
    if (fs.existsSync(SHELTER_FILE)) {
      const raw = fs.readFileSync(SHELTER_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) { console.error('[ShelterStore] Read error:', e); }
  return { shelters: SEED_SHELTERS, version: 1 };
}

function writeShelterStore(data: ShelterStore) {
  try {
    fs.writeFileSync(SHELTER_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[ShelterStore] Write error:', e);
  }
}

let shelterStore = readShelterStore();

// ── Resource Offers Store ─────────────────────────────────────────────────────
export interface ServerResourceOffer {
  id: string;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  quantityAllocated: number;
  status: 'available' | 'allocated' | 'fulfilled';
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  contactName: string;
  contactPhone: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceOffersStore {
  offers: ServerResourceOffer[];
  version: number;
}

const SEED_OFFERS: ServerResourceOffer[] = [
  {
    id: 'offer-001',
    title: 'Clean Bottled Water (500L packs)',
    category: 'water',
    quantity: 500,
    unit: 'liters',
    quantityAllocated: 120,
    status: 'available',
    location: 'Community Center, Sector 15, Rohini',
    latitude: 28.718,
    longitude: 77.126,
    contactName: 'Rohini Seva Trust',
    contactPhone: '+91 98110 22334',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'offer-002',
    title: 'Warm Blankets & Sleeping Mats',
    category: 'shelter',
    quantity: 150,
    unit: 'units',
    quantityAllocated: 50,
    status: 'available',
    location: 'Gurudwara Bangla Sahib Langar Hall',
    latitude: 28.626,
    longitude: 77.209,
    contactName: 'Gurudwara Relief Wing',
    contactPhone: '+91 11 2336 5486',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function readResourceOffersStore(): ResourceOffersStore {
  try {
    if (fs.existsSync(RESOURCE_OFFERS_FILE)) {
      const raw = fs.readFileSync(RESOURCE_OFFERS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) { console.error('[ResourceOffersStore] Read error:', e); }
  return { offers: SEED_OFFERS, version: 1 };
}

function writeResourceOffersStore(data: ResourceOffersStore) {
  try { fs.writeFileSync(RESOURCE_OFFERS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('[ResourceOffersStore] Write error:', e); }
}

let resourceOffersStore = readResourceOffersStore();

// ── Incidents Store ───────────────────────────────────────────────────────────
export interface ServerIncident {
  id: string;
  title: string;
  category: 'flood' | 'earthquake' | 'fire' | 'landslide' | 'cyclone' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'contained' | 'resolved';
  region: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  declaredBy: string;
  declaredAt: string;
  updatedAt: string;
  notes?: string;
}

export interface IncidentsStore {
  incidents: ServerIncident[];
  version: number;
}

const SEED_INCIDENTS: ServerIncident[] = [
  {
    id: 'inc-001',
    title: 'Yamuna Water Level Warning Level Breach',
    category: 'flood',
    severity: 'high',
    status: 'active',
    region: 'ncr',
    location: 'Old Railway Bridge (Loha Pul), Yamuna Bank',
    latitude: 28.655,
    longitude: 77.248,
    declaredBy: 'State Disaster Management Authority (SDMA)',
    declaredAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Low-lying floodplains under alert. Boat rescue units on high standby.',
  },
];

function readIncidentsStore(): IncidentsStore {
  try {
    if (fs.existsSync(INCIDENTS_FILE)) {
      const raw = fs.readFileSync(INCIDENTS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) { console.error('[IncidentsStore] Read error:', e); }
  return { incidents: SEED_INCIDENTS, version: 1 };
}

function writeIncidentsStore(data: IncidentsStore) {
  try { fs.writeFileSync(INCIDENTS_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('[IncidentsStore] Write error:', e); }
}

let incidentsStore = readIncidentsStore();

function validateServerShelterCapacity(totalCapacity: number, occupiedBeds: number, reservedBeds: number = 0): { valid: boolean; error?: string } {
  if (typeof totalCapacity !== 'number' || isNaN(totalCapacity) || totalCapacity < 0) {
    return { valid: false, error: 'Total shelter capacity must be a non-negative number.' };
  }
  if (typeof occupiedBeds !== 'number' || isNaN(occupiedBeds) || occupiedBeds < 0) {
    return { valid: false, error: 'Occupied beds count must be a non-negative number.' };
  }
  if (typeof reservedBeds !== 'number' || isNaN(reservedBeds) || reservedBeds < 0) {
    return { valid: false, error: 'Reserved beds count must be a non-negative number.' };
  }
  if (occupiedBeds + reservedBeds > totalCapacity) {
    return {
      valid: false,
      error: `Total occupied (${occupiedBeds}) + reserved (${reservedBeds}) = ${occupiedBeds + reservedBeds} exceeds total capacity (${totalCapacity}). Overbooking prevented.`,
    };
  }
  return { valid: true };
}


/**
 * Simple deterministic hash (not cryptographic — demo only).
 * For production replace with bcrypt.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'h' + Math.abs(hash).toString(36) + str.length.toString(36);
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Gemini client ─────────────────────────────────────────────────────────────
const API_KEY    = process.env.GEMINI_API_KEY;
const GEMINI_READY = !!(API_KEY && API_KEY.trim() && !API_KEY.startsWith('your_'));

const SYSTEM_INSTRUCTION = `You are the Disaster Assistant for a disaster-management application called ResQLink.

Your responsibilities are:
1. Explain how the application works.
2. Provide simple, basic, safety-focused disaster guidance.
3. Help users find resources using ONLY the application data provided to you in the context.
4. Adapt your responses to the currently selected region.
5. NEVER invent locations, shelter names, shelter capacity, available beds, hospitals, food points, water points, rescue locations, distances, or any other resource details.
6. Keep answers short, clear, and practical — maximum 4-5 sentences or 5 bullet points.
7. Use numbered steps or bullet points for emergency guidance.
8. Use simple language suitable for someone under stress.
9. If the user appears to be facing immediate danger, first say: call emergency services immediately, then move to the nearest safe location.
10. Do not provide dangerous, experimental, or risky instructions.
11. Do not pretend to be a doctor, firefighter, rescue worker, or emergency responder.
12. If you do not know something, say so clearly instead of guessing.
13. Reply in English when asked in English; reply in Hindi/Hinglish when asked in Hindi/Hinglish.
14. For resources (shelters, hospitals, food, water, rescue), only reference what appears in the structured app data given to you.
15. If the requested information is not in the app data, say: "I don't currently have that information in the app."`;

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    gemini: GEMINI_READY,
    syncRequestsCount: syncStore.requests.length,
    ngoCount: ngoStore.ngos.length,
    rescueTaskCount: ngoStore.tasks.length,
    authUsersCount: usersStore.users.length,
    shelterCount: shelterStore.shelters.length,
    resourceOffersCount: resourceOffersStore.offers.length,
    incidentsCount: incidentsStore.incidents.length,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REAL-TIME EVENT STREAM (SSE)
// ═════════════════════════════════════════════════════════════════════════════

app.get('/api/events', handleEventStream);

// ═════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION & ROLE MANAGEMENT ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** POST /api/auth/login — authenticate with email and password */
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = (req.body || {}) as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const normalEmail = email.trim().toLowerCase();
  const user = usersStore.users.find((u) => u.email.toLowerCase() === normalEmail);

  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = createAuthToken(user);

  recordAuditEvent({
    action: 'AUTH_LOGIN',
    actorId: user.id,
    actorRole: user.role,
    entityType: 'user',
    entityId: user.id,
    details: { email: user.email },
    ipAddress: req.ip,
  });

  res.json({ ok: true, token, user: sanitizeUser(user) });
});

/** POST /api/auth/register — register a new account */
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, name, role = 'requester', assignedShelterId, skills } =
    (req.body || {}) as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      assignedShelterId?: string;
      skills?: string[];
    };

  if (!email || !password || !name) {
    res.status(400).json({ error: 'email, password, and name are required.' });
    return;
  }

  const normalEmail = email.trim().toLowerCase();
  const existing = usersStore.users.find((u) => u.email.toLowerCase() === normalEmail);
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists.' });
    return;
  }

  const validRoles = ['requester', 'volunteer', 'shelter_officer', 'coordinator'];
  const userRole = validRoles.includes(role) ? role : 'requester';
  // Prevent public self-assignment to coordinator
  const finalRole = userRole === 'coordinator' ? 'requester' : userRole;

  const newUser = {
    id: generateId('usr'),
    email: normalEmail,
    passwordHash: hashPassword(password),
    name: name.trim(),
    role: finalRole as any,
    assignedShelterId: assignedShelterId || null,
    skills: Array.isArray(skills) ? skills : [],
    createdAt: Date.now(),
  };

  usersStore.users.push(newUser);
  usersStore.version += 1;
  writeUsersStore(usersStore);

  recordAuditEvent({
    action: 'USER_REGISTER',
    actorId: newUser.id,
    actorRole: newUser.role,
    entityType: 'user',
    entityId: newUser.id,
    details: { email: newUser.email, role: newUser.role },
    ipAddress: req.ip,
  });

  const token = createAuthToken(newUser);
  res.status(201).json({ ok: true, token, user: sanitizeUser(newUser) });
});

/** GET /api/auth/me — fetch authenticated user profile */
app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const user = usersStore.users.find((u) => u.id === req.user!.sub);
  if (!user) {
    res.status(404).json({ error: 'User record not found.' });
    return;
  }
  res.json({ ok: true, user: sanitizeUser(user) });
});

/** POST /api/auth/demo-login — instant role-switch for demo evaluation */
app.post('/api/auth/demo-login', (req: Request, res: Response) => {
  const { role = 'coordinator' } = (req.body || {}) as { role?: string };
  const user = SEED_USERS.find((u) => u.role === role) || SEED_USERS[0];
  const token = createAuthToken(user);

  recordAuditEvent({
    action: 'DEMO_LOGIN_SWITCH',
    actorId: user.id,
    actorRole: user.role,
    entityType: 'user',
    entityId: user.id,
    details: { role: user.role, isDemo: true },
    ipAddress: req.ip,
  });

  res.json({ ok: true, token, user: sanitizeUser(user), isDemo: true });
});

/** GET /api/auth/demo-accounts — list test credentials for reviewer documentation */
app.get('/api/auth/demo-accounts', (_req: Request, res: Response) => {
  res.json({
    accounts: [
      {
        role: 'coordinator',
        email: 'coordinator@resqlink.org',
        password: 'Coord@123',
        name: 'Chief Officer R. Sharma',
        description: 'Incident Command Coordinator (Full system authorization and medical access)',
      },
      {
        role: 'shelter_officer',
        email: 'shelter.officer@resqlink.org',
        password: 'Shelter@123',
        name: 'Officer K. Verma (Mayur Vihar)',
        assignedShelterId: 'shelter-001',
        description: 'Authorized Shelter Operator for Rajkiya Sarvodaya (shelter-001)',
      },
      {
        role: 'volunteer',
        email: 'volunteer@resqlink.org',
        password: 'Volunteer@123',
        name: 'A. Patel (Rapid Response)',
        skills: ['first_aid', 'triage', 'water_rescue'],
        description: 'Field Responder with first aid & triage certification',
      },
      {
        role: 'requester',
        email: 'citizen@resqlink.org',
        password: 'Citizen@123',
        name: 'P. Kumar (Displaced Citizen)',
        description: 'Public Citizen / Disaster Requester with localized emergency ticket',
      },
    ],
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AUDIT LOG ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/audit-events — append-only security audit events (coordinator only) */
app.get('/api/audit-events', requireRole('coordinator'), (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const events = readAuditEvents(limit);
  res.json({ ok: true, count: events.length, events });
});

// ═════════════════════════════════════════════════════════════════════════════
// RESOURCE OFFERS ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/resource-offers — list offers with optional status/category filter */
app.get('/api/resource-offers', (req: Request, res: Response) => {
  const { status, category } = req.query as { status?: string; category?: string };
  let offers = resourceOffersStore.offers;
  if (status && status !== 'all') {
    offers = offers.filter((o) => o.status === status);
  }
  if (category && category !== 'all') {
    offers = offers.filter((o) => o.category === category);
  }
  res.json(offers);
});

/** POST /api/resource-offers — create a resource offer */
app.post('/api/resource-offers', requireAuth, (req: Request, res: Response) => {
  const { title, category, quantity, unit = 'units', location, latitude, longitude, contactName, contactPhone } =
    req.body as Partial<ServerResourceOffer>;

  const qty = Number(quantity);
  if (!title?.trim() || isNaN(qty) || qty <= 0 || !location?.trim()) {
    res.status(400).json({ error: 'Title, quantity (>0), and location are required.' });
    return;
  }

  const newOffer: ServerResourceOffer = {
    id: generateId('offer'),
    title: title.trim(),
    category: category || 'general',
    quantity: qty,
    unit: unit || 'units',
    quantityAllocated: 0,
    status: 'available',
    location: location.trim(),
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    contactName: (contactName || req.user?.name || 'Anonymous Donor').trim(),
    contactPhone: (contactPhone || '').trim(),
    createdByUserId: req.user?.sub,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  resourceOffersStore.offers.unshift(newOffer);
  resourceOffersStore.version += 1;
  writeResourceOffersStore(resourceOffersStore);

  recordAuditEvent({
    action: 'RESOURCE_OFFER_CREATE',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'resource_offer',
    entityId: newOffer.id,
    details: { title: newOffer.title, quantity: newOffer.quantity },
    ipAddress: req.ip,
  });

  broadcastEvent('RESOURCE_OFFER_UPDATED', newOffer, newOffer.id);
  res.status(201).json({ ok: true, offer: newOffer });
});

/** POST /api/resource-offers/:id/claim — atomic allocation of offered resources */
app.post('/api/resource-offers/:id/claim', requireAuth, (req: Request, res: Response) => {
  const offer = resourceOffersStore.offers.find((o) => o.id === req.params.id);
  if (!offer) {
    res.status(404).json({ error: 'Resource offer not found.' });
    return;
  }

  const { amountToClaim } = req.body as { amountToClaim: number };
  const claimQty = Number(amountToClaim);
  if (isNaN(claimQty) || claimQty <= 0) {
    res.status(400).json({ error: 'amountToClaim must be greater than zero.' });
    return;
  }

  const remaining = offer.quantity - offer.quantityAllocated;
  if (claimQty > remaining) {
    res.status(409).json({
      error: `Cannot allocate ${claimQty} ${offer.unit}: only ${remaining} ${offer.unit} remaining.`,
      remaining,
    });
    return;
  }

  offer.quantityAllocated += claimQty;
  if (offer.quantityAllocated >= offer.quantity) {
    offer.status = 'fulfilled';
  } else {
    offer.status = 'allocated';
  }
  offer.updatedAt = new Date().toISOString();

  resourceOffersStore.version += 1;
  writeResourceOffersStore(resourceOffersStore);

  recordAuditEvent({
    action: 'RESOURCE_ALLOCATE',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'resource_offer',
    entityId: offer.id,
    details: { claimed: claimQty, newAllocated: offer.quantityAllocated },
    ipAddress: req.ip,
  });

  broadcastEvent('RESOURCE_OFFER_UPDATED', offer, offer.id);
  res.json({ ok: true, offer });
});

// ═════════════════════════════════════════════════════════════════════════════
// INCIDENT MANAGEMENT ENDPOINTS (COORDINATOR ONLY)
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/incidents — list disaster incidents */
app.get('/api/incidents', (_req: Request, res: Response) => {
  res.json(incidentsStore.incidents);
});

/** POST /api/incidents — declare disaster incident (strictly coordinator) */
app.post('/api/incidents', requireRole('coordinator'), (req: Request, res: Response) => {
  const { title, category = 'general', severity = 'high', region = 'ncr', location, latitude, longitude, notes } =
    req.body as Partial<ServerIncident>;

  if (!title?.trim() || !location?.trim()) {
    res.status(400).json({ error: 'Incident title and location description are required.' });
    return;
  }

  const newIncident: ServerIncident = {
    id: generateId('inc'),
    title: title.trim(),
    category: category as any,
    severity: severity as any,
    status: 'active',
    region: region || 'ncr',
    location: location.trim(),
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    declaredBy: req.user?.name || 'Incident Commander',
    declaredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: notes?.trim(),
  };

  incidentsStore.incidents.unshift(newIncident);
  incidentsStore.version += 1;
  writeIncidentsStore(incidentsStore);

  recordAuditEvent({
    action: 'INCIDENT_DECLARED',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'incident',
    entityId: newIncident.id,
    details: { title: newIncident.title, severity: newIncident.severity },
    ipAddress: req.ip,
  });

  broadcastEvent('INCIDENT_UPDATED', newIncident, newIncident.id);
  res.status(201).json({ ok: true, incident: newIncident });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECURE REMOTE PERSISTENCE & SYNC ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/sync — fetch synced requests with medical privacy redaction */
app.get('/api/sync', (req: Request, res: Response) => {
  const sanitizedRequests = syncStore.requests.map((r) =>
    maskMedicalDataForViewer(r, req.user)
  );
  res.json({
    ...syncStore,
    requests: sanitizedRequests,
  });
});

/** POST /api/sync/request — persist or update emergency request */
app.post('/api/sync/request', (req: Request, res: Response) => {
  const newReq = req.body;
  if (!newReq || !newReq.id) {
    res.status(400).json({ error: 'Invalid request payload.' });
    return;
  }

  // Validate coordinates server-side
  if (newReq.latitude !== undefined && newReq.latitude !== null) {
    const lat = Number(newReq.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      res.status(400).json({ error: 'Latitude must be a valid number between -90 and 90 degrees.' });
      return;
    }
  }
  if (newReq.longitude !== undefined && newReq.longitude !== null) {
    const lng = Number(newReq.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Longitude must be a valid number between -180 and 180 degrees.' });
      return;
    }
  }

  const idx = syncStore.requests.findIndex((r) => r.id === newReq.id);
  const isCreate = idx < 0;

  if (idx >= 0) {
    syncStore.requests[idx] = newReq;
  } else {
    syncStore.requests.unshift(newReq);
  }
  syncStore.resolvedIds = syncStore.resolvedIds.filter((id) => id !== newReq.id);
  syncStore.version += 1;
  writeStore(syncStore);

  recordAuditEvent({
    action: isCreate ? 'REQUEST_CREATED' : 'REQUEST_UPDATED',
    actorId: req.user?.sub || 'anonymous',
    actorRole: req.user?.role || 'requester',
    entityType: 'emergency_request',
    entityId: newReq.id,
    details: { category: newReq.category, priority: newReq.priority },
    ipAddress: req.ip,
  });

  broadcastEvent(isCreate ? 'REQUEST_CREATED' : 'REQUEST_UPDATED', newReq, newReq.id);
  res.json({ ok: true, store: syncStore, serverAckTimestamp: new Date().toISOString() });
});

/** POST /api/sync/resolve — resolve emergency request */
app.post('/api/sync/resolve', (req: Request, res: Response) => {
  const { id } = req.body as { id: string };
  if (!id) { res.status(400).json({ error: 'Missing request id.' }); return; }
  if (!syncStore.resolvedIds.includes(id)) syncStore.resolvedIds.push(id);
  syncStore.requests = syncStore.requests.filter((r) => r.id !== id);
  syncStore.version += 1;
  writeStore(syncStore);

  recordAuditEvent({
    action: 'REQUEST_RESOLVED',
    actorId: req.user?.sub || 'anonymous',
    actorRole: req.user?.role || 'anonymous',
    entityType: 'emergency_request',
    entityId: id,
    details: { id },
    ipAddress: req.ip,
  });

  broadcastEvent('REQUEST_RESOLVED', { id }, id);
  res.json({ ok: true, store: syncStore });
});

/** POST /api/sync/help */
app.post('/api/sync/help', (req: Request, res: Response) => {
  const { id } = req.body as { id: string };
  if (!id) { res.status(400).json({ error: 'Missing request id.' }); return; }
  if (!syncStore.helpingIds.includes(id)) syncStore.helpingIds.push(id);
  syncStore.version += 1;
  writeStore(syncStore);
  broadcastEvent('REQUEST_UPDATED', { id, helping: true }, id);
  res.json({ ok: true, store: syncStore });
});

app.post('/api/sync/cancel-help', (req: Request, res: Response) => {
  const { id } = req.body as { id: string };
  if (!id) { res.status(400).json({ error: 'Missing request id.' }); return; }
  syncStore.helpingIds = syncStore.helpingIds.filter((item) => item !== id);
  syncStore.version += 1;
  writeStore(syncStore);
  res.json({ ok: true, store: syncStore });
});

app.post('/api/sync/restore', (_req: Request, res: Response) => {
  syncStore.resolvedIds = [];
  syncStore.version += 1;
  writeStore(syncStore);
  res.json({ ok: true, store: syncStore });
});

// ═════════════════════════════════════════════════════════════════════════════
// NGO AUTHENTICATION ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** POST /api/ngo/register */
app.post('/api/ngo/register', (req: Request, res: Response) => {
  // Guard: body-parser sets req.body to undefined if Content-Type is not application/json
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({
      error: 'Request body is missing or not JSON. Send Content-Type: application/json.',
    });
    return;
  }

  const { name, contactPerson, phone, email, serviceArea, description, password } =
    req.body as {
      name: string; contactPerson: string; phone: string; email: string;
      serviceArea: string; description: string; password: string;
    };

  if (!name || !contactPerson || !phone || !email || !password) {
    res.status(400).json({ error: 'name, contactPerson, phone, email, and password are required.' });
    return;
  }

  // Prevent duplicate email
  const existing = ngoStore.ngos.find((n) => n.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    res.status(409).json({ error: 'An NGO with this email already exists.' });
    return;
  }

  const ngo: NgoProfile = {
    id: generateId('ngo'),
    name: name.trim(),
    contactPerson: contactPerson.trim(),
    phone: phone.trim(),
    email: email.trim().toLowerCase(),
    serviceArea: (serviceArea || '').trim(),
    description: (description || '').trim(),
    verificationStatus: 'PENDING',
    passwordHash: simpleHash(password),
    createdAt: Date.now(),
  };

  ngoStore.ngos.push(ngo);
  ngoStore.version += 1;

  try {
    writeNgoStore(ngoStore);
  } catch (writeErr) {
    console.error('[NGO Register] Failed to persist ngo-store.json:', writeErr);
    // Remove the in-memory push so state stays consistent
    ngoStore.ngos.pop();
    res.status(500).json({
      error: 'Registration could not be saved. Please try again.',
    });
    return;
  }

  // Return profile without passwordHash
  const { passwordHash: _ph, ...safeProfile } = ngo;
  res.json({ ok: true, ngo: safeProfile });
});

/** POST /api/ngo/login */
app.post('/api/ngo/login', (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({ error: 'Request body is missing or not JSON.' });
    return;
  }
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required.' });
    return;
  }

  const ngo = ngoStore.ngos.find((n) => n.email.toLowerCase() === email.trim().toLowerCase());
  if (!ngo || ngo.passwordHash !== simpleHash(password)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (ngo.verificationStatus === 'SUSPENDED') {
    res.status(403).json({ error: 'This NGO account has been suspended.' });
    return;
  }

  const { passwordHash: _ph, ...safeProfile } = ngo;
  res.json({ ok: true, ngo: safeProfile });
});

/** GET /api/ngo/:ngoId — fetch NGO profile */
app.get('/api/ngo/:ngoId', (req: Request, res: Response) => {
  const ngo = ngoStore.ngos.find((n) => n.id === req.params.ngoId);
  if (!ngo) { res.status(404).json({ error: 'NGO not found.' }); return; }
  const { passwordHash: _ph, ...safeProfile } = ngo;
  res.json(safeProfile);
});

/** PUT /api/ngo/:ngoId — update NGO profile */
app.put('/api/ngo/:ngoId', (req: Request, res: Response) => {
  const idx = ngoStore.ngos.findIndex((n) => n.id === req.params.ngoId);
  if (idx < 0) { res.status(404).json({ error: 'NGO not found.' }); return; }

  const allowed = ['name', 'contactPerson', 'phone', 'serviceArea', 'description'];
  const update  = req.body as Partial<NgoProfile>;
  const ngo     = ngoStore.ngos[idx];

  for (const key of allowed) {
    if (update[key as keyof NgoProfile] !== undefined) {
      (ngo as any)[key] = (update as any)[key];
    }
  }

  ngoStore.version += 1;
  writeNgoStore(ngoStore);
  const { passwordHash: _ph, ...safeProfile } = ngo;
  res.json({ ok: true, ngo: safeProfile });
});

// ═════════════════════════════════════════════════════════════════════════════
// VOLUNTEER MEMBER ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/ngo/:ngoId/volunteers */
app.get('/api/ngo/:ngoId/volunteers', (req: Request, res: Response) => {
  const members = ngoStore.volunteers.filter((v) => v.ngoId === req.params.ngoId);
  res.json(members);
});

/** POST /api/ngo/:ngoId/volunteers — add a volunteer to an NGO */
app.post('/api/ngo/:ngoId/volunteers', (req: Request, res: Response) => {
  const ngoId = req.params.ngoId;
  const ngo   = ngoStore.ngos.find((n) => n.id === ngoId);
  if (!ngo) { res.status(404).json({ error: 'NGO not found.' }); return; }

  const { fullName, phone, email, skills } = req.body as {
    fullName: string; phone: string; email?: string; skills?: string[];
  };

  if (!fullName || !phone) {
    res.status(400).json({ error: 'fullName and phone are required.' });
    return;
  }

  // Prevent duplicate phone within same NGO
  const dup = ngoStore.volunteers.find((v) => v.ngoId === ngoId && v.phone === phone.trim());
  if (dup) {
    res.status(409).json({ error: 'A volunteer with this phone is already in your NGO.' });
    return;
  }

  const member: VolunteerMember = {
    id: generateId('vmem'),
    ngoId,
    fullName: fullName.trim(),
    phone: phone.trim(),
    email: (email || '').trim(),
    skills: Array.isArray(skills) ? skills : [],
    status: 'AVAILABLE',
    currentTaskId: null,
    joinedAt: Date.now(),
  };

  ngoStore.volunteers.push(member);
  ngoStore.version += 1;
  writeNgoStore(ngoStore);
  res.json({ ok: true, volunteer: member });
});

/** PUT /api/ngo/volunteers/:volunteerId/status — update volunteer status */
app.put('/api/ngo/volunteers/:volunteerId/status', (req: Request, res: Response) => {
  const idx = ngoStore.volunteers.findIndex((v) => v.id === req.params.volunteerId);
  if (idx < 0) { res.status(404).json({ error: 'Volunteer not found.' }); return; }

  const { status } = req.body as { status: VolunteerMemberStatus };
  const valid: VolunteerMemberStatus[] = ['AVAILABLE', 'ON_MISSION', 'OFFLINE'];
  if (!valid.includes(status)) {
    res.status(400).json({ error: 'Invalid status.' });
    return;
  }

  ngoStore.volunteers[idx].status = status;
  if (status !== 'ON_MISSION') ngoStore.volunteers[idx].currentTaskId = null;
  ngoStore.version += 1;
  writeNgoStore(ngoStore);
  res.json({ ok: true, volunteer: ngoStore.volunteers[idx] });
});

/** DELETE /api/ngo/volunteers/:volunteerId */
app.delete('/api/ngo/volunteers/:volunteerId', (req: Request, res: Response) => {
  const idx = ngoStore.volunteers.findIndex((v) => v.id === req.params.volunteerId);
  if (idx < 0) { res.status(404).json({ error: 'Volunteer not found.' }); return; }

  // Only delete if not currently on a mission
  if (ngoStore.volunteers[idx].status === 'ON_MISSION') {
    res.status(409).json({ error: 'Cannot remove a volunteer who is currently on a mission.' });
    return;
  }

  ngoStore.volunteers.splice(idx, 1);
  ngoStore.version += 1;
  writeNgoStore(ngoStore);
  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// RESCUE TASK ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/rescue-tasks — all tasks (public, filtered by status for volunteer view) */
app.get('/api/rescue-tasks', (req: Request, res: Response) => {
  const { status, region, ngoId } = req.query as {
    status?: string; region?: string; ngoId?: string;
  };

  let tasks = [...ngoStore.tasks];
  if (status)  tasks = tasks.filter((t) => t.status === status);
  if (region)  tasks = tasks.filter((t) => t.region === region);
  if (ngoId)   tasks = tasks.filter((t) => t.assignedNgoId === ngoId);

  // Sort newest first
  tasks.sort((a, b) => b.createdAt - a.createdAt);
  res.json(tasks);
});

/** GET /api/rescue-tasks/available — only AVAILABLE tasks (volunteer list view) */
app.get('/api/rescue-tasks/available', (_req: Request, res: Response) => {
  const available = ngoStore.tasks
    .filter((t) => t.status === 'AVAILABLE')
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(available);
});

/** GET /api/rescue-tasks/:taskId */
app.get('/api/rescue-tasks/:taskId', (req: Request, res: Response) => {
  const task = ngoStore.tasks.find((t) => t.id === req.params.taskId);
  if (!task) { res.status(404).json({ error: 'Task not found.' }); return; }
  res.json(task);
});

/** POST /api/rescue-tasks — create a rescue task from an AidRequest */
app.post('/api/rescue-tasks', (req: Request, res: Response) => {
  const body = req.body as {
    requestId: string; title: string; description: string;
    category: string; priority: string; location: string;
    coords: { x: number; y: number }; peopleCount: number;
    contactName: string; contactPhone: string; region: string;
  };

  if (!body.requestId || !body.title) {
    res.status(400).json({ error: 'requestId and title are required.' });
    return;
  }

  // Idempotent: if a task already exists for this requestId, return it
  const existing = ngoStore.tasks.find((t) => t.requestId === body.requestId);
  if (existing) {
    res.json({ ok: true, task: existing, alreadyExists: true });
    return;
  }

  const task: RescueTask = {
    id: generateId('task'),
    requestId:    body.requestId,
    title:        body.title,
    description:  body.description || '',
    category:     body.category   || 'rescue',
    priority:     body.priority   || 'urgent',
    location:     body.location   || '',
    coords:       body.coords     || { x: 50, y: 50 },
    peopleCount:  body.peopleCount || 1,
    contactName:  body.contactName || '',
    contactPhone: body.contactPhone || '',
    region:       body.region     || 'ncr',
    status:       'AVAILABLE',
    assignedNgoId:        null,
    assignedNgoName:      null,
    assignedVolunteerId:  null,
    assignedVolunteerName: null,
    createdAt:               Date.now(),
    assignedAt:              null,
    startedAt:               null,
    completionRequestedAt:   null,
    confirmedAt:             null,
    completedAt:             null,
    confirmedByNgoId:        null,
    confirmedByName:         null,
    cancelledAt:             null,
    cancelReason:            null,
  };

  ngoStore.tasks.push(task);
  ngoStore.version += 1;
  writeNgoStore(ngoStore);

  recordAuditEvent({
    action: 'TASK_CREATED',
    actorId: req.user?.sub || 'anonymous',
    actorRole: req.user?.role || 'anonymous',
    entityType: 'rescue_task',
    entityId: task.id,
    details: { requestId: task.requestId, title: task.title, priority: task.priority },
    ipAddress: req.ip,
  });

  broadcastEvent('TASK_CREATED', task, task.id);
  res.json({ ok: true, task });
});

/**
 * POST /api/rescue-tasks/:taskId/assign
 *
 * ATOMIC ASSIGNMENT — the critical section.
 * Uses a synchronous file-read + write cycle as a pessimistic lock.
 * The in-process ngoStore is the source of truth; all other requests
 * wait for the synchronous write before responding.
 */
app.post('/api/rescue-tasks/:taskId/assign', (req: Request, res: Response) => {
  const { volunteerId, ngoId } = req.body as { volunteerId: string; ngoId: string };
  if (!volunteerId || !ngoId) {
    res.status(400).json({ error: 'volunteerId and ngoId are required.' });
    return;
  }

  // Re-read from disk to get the absolute latest state before assigning
  // (guards against concurrent requests when the server has multiple replicas
  //  or when a previous in-flight write hasn't been reflected in memory yet)
  ngoStore = readNgoStore();

  const taskIdx = ngoStore.tasks.findIndex((t) => t.id === req.params.taskId);
  if (taskIdx < 0) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }

  const task = ngoStore.tasks[taskIdx];

  // ── Atomic check: only AVAILABLE tasks may be assigned ────────────────────
  if (task.status !== 'AVAILABLE') {
    res.status(409).json({
      ok: false,
      alreadyAssigned: true,
      error: 'This rescue request has already been assigned to another volunteer.',
      currentStatus: task.status,
      assignedVolunteerName: task.assignedVolunteerName,
    });
    return;
  }

  const volunteerIdx = ngoStore.volunteers.findIndex((v) => v.id === volunteerId);
  if (volunteerIdx < 0) {
    res.status(404).json({ error: 'Volunteer not found.' });
    return;
  }

  const volunteer = ngoStore.volunteers[volunteerIdx];

  // Ensure volunteer is AVAILABLE
  if (volunteer.status !== 'AVAILABLE') {
    res.status(409).json({
      ok: false,
      error: 'This volunteer is already on a mission or offline.',
      volunteerStatus: volunteer.status,
    });
    return;
  }

  const ngo = ngoStore.ngos.find((n) => n.id === ngoId);

  // ── Apply the assignment atomically ───────────────────────────────────────
  task.status               = 'ASSIGNED';
  task.assignedNgoId        = ngoId;
  task.assignedNgoName      = ngo ? ngo.name : 'Unknown NGO';
  task.assignedVolunteerId  = volunteerId;
  task.assignedVolunteerName = volunteer.fullName;
  task.assignedAt           = Date.now();

  volunteer.status          = 'ON_MISSION';
  volunteer.currentTaskId   = task.id;

  ngoStore.version += 1;
  // Synchronous write — guarantees persistence before response is sent
  writeNgoStore(ngoStore);

  recordAuditEvent({
    action: 'TASK_ASSIGNED',
    actorId: req.user?.sub || volunteerId,
    actorRole: req.user?.role || 'volunteer',
    entityType: 'rescue_task',
    entityId: task.id,
    details: { volunteerId, volunteerName: volunteer.fullName },
    ipAddress: req.ip,
  });

  broadcastEvent('TASK_UPDATED', task, task.id);
  res.json({ ok: true, task, volunteer });
});

/** POST /api/rescue-tasks/:taskId/start — ASSIGNED → IN_PROGRESS */
app.post('/api/rescue-tasks/:taskId/start', (req: Request, res: Response) => {
  const { volunteerId } = req.body as { volunteerId: string };

  ngoStore = readNgoStore();
  const taskIdx = ngoStore.tasks.findIndex((t) => t.id === req.params.taskId);
  if (taskIdx < 0) { res.status(404).json({ error: 'Task not found.' }); return; }

  const task = ngoStore.tasks[taskIdx];

  if (task.status !== 'ASSIGNED') {
    res.status(409).json({ error: `Cannot start a task with status ${task.status}.` });
    return;
  }

  if (task.assignedVolunteerId !== volunteerId) {
    res.status(403).json({ error: 'Only the assigned volunteer can start this task.' });
    return;
  }

  task.status    = 'IN_PROGRESS';
  task.startedAt = Date.now();

  ngoStore.version += 1;
  writeNgoStore(ngoStore);

  recordAuditEvent({
    action: 'TASK_STARTED',
    actorId: volunteerId,
    actorRole: 'volunteer',
    entityType: 'rescue_task',
    entityId: task.id,
    details: { startedAt: task.startedAt },
    ipAddress: req.ip,
  });

  broadcastEvent('TASK_UPDATED', task, task.id);
  res.json({ ok: true, task });
});

/** POST /api/rescue-tasks/:taskId/complete — IN_PROGRESS → AWAITING_CONFIRMATION */
app.post('/api/rescue-tasks/:taskId/complete', (req: Request, res: Response) => {
  const { volunteerId } = req.body as { volunteerId: string };

  ngoStore = readNgoStore();
  const taskIdx = ngoStore.tasks.findIndex((t) => t.id === req.params.taskId);
  if (taskIdx < 0) { res.status(404).json({ error: 'Task not found.' }); return; }

  const task = ngoStore.tasks[taskIdx];

  if (task.status !== 'IN_PROGRESS') {
    res.status(409).json({ error: `Cannot complete a task with status ${task.status}.` });
    return;
  }

  if (task.assignedVolunteerId !== volunteerId) {
    res.status(403).json({ error: 'Only the assigned volunteer can request completion.' });
    return;
  }

  task.status                  = 'AWAITING_CONFIRMATION';
  task.completionRequestedAt   = Date.now();

  ngoStore.version += 1;
  writeNgoStore(ngoStore);

  recordAuditEvent({
    action: 'TASK_COMPLETION_REQUESTED',
    actorId: volunteerId,
    actorRole: 'volunteer',
    entityType: 'rescue_task',
    entityId: task.id,
    details: { completionRequestedAt: task.completionRequestedAt },
    ipAddress: req.ip,
  });

  broadcastEvent('TASK_UPDATED', task, task.id);
  res.json({ ok: true, task });
});

/** POST /api/rescue-tasks/:taskId/confirm — AWAITING_CONFIRMATION → RESCUED (NGO only) */
app.post('/api/rescue-tasks/:taskId/confirm', (req: Request, res: Response) => {
  const { ngoId, confirmedByName } = req.body as { ngoId: string; confirmedByName: string };
  if (!ngoId) { res.status(400).json({ error: 'ngoId is required.' }); return; }

  ngoStore = readNgoStore();
  const taskIdx = ngoStore.tasks.findIndex((t) => t.id === req.params.taskId);
  if (taskIdx < 0) { res.status(404).json({ error: 'Task not found.' }); return; }

  const task = ngoStore.tasks[taskIdx];

  if (task.status !== 'AWAITING_CONFIRMATION') {
    res.status(409).json({ error: `Cannot confirm a task with status ${task.status}.` });
    return;
  }

  if (task.assignedNgoId !== ngoId) {
    res.status(403).json({ error: 'Only the assigned NGO can confirm this rescue.' });
    return;
  }

  const now = Date.now();
  task.status           = 'RESCUED';
  task.confirmedAt      = now;
  task.completedAt      = now;
  task.confirmedByNgoId = ngoId;
  task.confirmedByName  = confirmedByName || 'NGO Admin';

  // Free the volunteer
  const volunteerIdx = ngoStore.volunteers.findIndex(
    (v) => v.id === task.assignedVolunteerId
  );
  if (volunteerIdx >= 0) {
    ngoStore.volunteers[volunteerIdx].status        = 'AVAILABLE';
    ngoStore.volunteers[volunteerIdx].currentTaskId = null;
  }

  ngoStore.version += 1;
  writeNgoStore(ngoStore);

  recordAuditEvent({
    action: 'TASK_CONFIRMED_RESCUED',
    actorId: req.user?.sub || ngoId,
    actorRole: req.user?.role || 'coordinator',
    entityType: 'rescue_task',
    entityId: task.id,
    details: { confirmedByName: task.confirmedByName },
    ipAddress: req.ip,
  });

  broadcastEvent('TASK_UPDATED', task, task.id);
  res.json({ ok: true, task });
});

/** POST /api/rescue-tasks/:taskId/cancel — cancel and optionally make AVAILABLE again */
app.post('/api/rescue-tasks/:taskId/cancel', (req: Request, res: Response) => {
  const { ngoId, reason, makeAvailable } = req.body as {
    ngoId: string; reason?: string; makeAvailable?: boolean;
  };

  ngoStore = readNgoStore();
  const taskIdx = ngoStore.tasks.findIndex((t) => t.id === req.params.taskId);
  if (taskIdx < 0) { res.status(404).json({ error: 'Task not found.' }); return; }

  const task = ngoStore.tasks[taskIdx];

  // Cancellable statuses
  const cancellable: RescueTaskStatus[] = ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION'];
  if (!cancellable.includes(task.status)) {
    res.status(409).json({ error: `Task with status ${task.status} cannot be cancelled.` });
    return;
  }

  // Free the volunteer if one was assigned
  if (task.assignedVolunteerId) {
    const volunteerIdx = ngoStore.volunteers.findIndex(
      (v) => v.id === task.assignedVolunteerId
    );
    if (volunteerIdx >= 0) {
      ngoStore.volunteers[volunteerIdx].status        = 'AVAILABLE';
      ngoStore.volunteers[volunteerIdx].currentTaskId = null;
    }
  }

  if (makeAvailable) {
    // Reset to AVAILABLE for reassignment
    task.status               = 'AVAILABLE';
    task.assignedNgoId        = null;
    task.assignedNgoName      = null;
    task.assignedVolunteerId  = null;
    task.assignedVolunteerName = null;
    task.assignedAt           = null;
    task.startedAt            = null;
    task.completionRequestedAt = null;
    task.cancelledAt          = null;
    task.cancelReason         = null;
  } else {
    task.status       = 'CANCELLED';
    task.cancelledAt  = Date.now();
    task.cancelReason = reason || 'Cancelled by NGO';
  }

  ngoStore.version += 1;
  writeNgoStore(ngoStore);

  recordAuditEvent({
    action: 'TASK_CANCELLED',
    actorId: req.user?.sub || ngoId,
    actorRole: req.user?.role || 'ngo',
    entityType: 'rescue_task',
    entityId: task.id,
    details: { reason: task.cancelReason, makeAvailable: !!makeAvailable },
    ipAddress: req.ip,
  });

  broadcastEvent('TASK_UPDATED', task, task.id);
  res.json({ ok: true, task });
});

/** GET /api/ngo-store/version — lightweight version poll for change detection */
app.get('/api/ngo-store/version', (_req: Request, res: Response) => {
  res.json({ version: ngoStore.version });
});

/** GET /api/ngo-store — full store (for polling sync) */
app.get('/api/ngo-store', (_req: Request, res: Response) => {
  // Strip password hashes before sending
  const safe = {
    ...ngoStore,
    ngos: ngoStore.ngos.map(({ passwordHash: _ph, ...rest }) => rest),
  };
  res.json(safe);
});

// ═════════════════════════════════════════════════════════════════════════════
// SHELTER MANAGEMENT ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/shelters — list all shelters with optional query filters */
app.get('/api/shelters', (req: Request, res: Response) => {
  const { region, status, hasAvailableBeds } = req.query as {
    region?: string;
    status?: string;
    hasAvailableBeds?: string;
  };

  let list = shelterStore.shelters;

  if (region && region !== 'all') {
    list = list.filter((s) => s.region === region);
  }

  if (status && status !== 'all') {
    list = list.filter((s) => s.operatingStatus === status || s.status === status);
  }

  if (hasAvailableBeds === 'true') {
    list = list.filter((s) => s.totalCapacity - (s.occupiedBeds + s.reservedBeds) > 0);
  }

  // Include calculated available beds
  const enriched = list.map((s) => ({
    ...s,
    availableBeds: Math.max(0, s.totalCapacity - (s.occupiedBeds + s.reservedBeds)),
  }));

  res.json(enriched);
});

/** GET /api/shelters/:id — get single shelter */
app.get('/api/shelters/:id', (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }
  res.json({
    ...shelter,
    availableBeds: Math.max(0, shelter.totalCapacity - (shelter.occupiedBeds + shelter.reservedBeds)),
  });
});

/** POST /api/shelters — create new shelter (coordinator only) */
app.post('/api/shelters', requireRole('coordinator'), (req: Request, res: Response) => {
  const {
    name,
    address,
    latitude = 28.6139,
    longitude = 77.209,
    totalCapacity = 50,
    occupiedBeds = 0,
    reservedBeds = 0,
    operatingStatus = 'open',
    amenities = [],
    contactPhone,
    region = 'ncr',
    inventory = {},
  } = req.body;

  if (!name?.trim() || !address?.trim()) {
    res.status(400).json({ error: 'Shelter name and address are required.' });
    return;
  }

  const capValidation = validateServerShelterCapacity(totalCapacity, occupiedBeds, reservedBeds);
  if (!capValidation.valid) {
    res.status(400).json({ error: capValidation.error });
    return;
  }

  const isFull = occupiedBeds + reservedBeds >= totalCapacity;
  const statusToSet = isFull && operatingStatus === 'open' ? 'full' : operatingStatus;

  const newShelter: ServerShelter = {
    id: generateId('shelter'),
    name: name.trim(),
    address: address.trim(),
    latitude: Number(latitude),
    longitude: Number(longitude),
    coords: { x: 50, y: 50 },
    totalCapacity: Number(totalCapacity),
    occupiedBeds: Number(occupiedBeds),
    reservedBeds: Number(reservedBeds),
    capacity: Number(totalCapacity),
    occupied: Number(occupiedBeds),
    operatingStatus: statusToSet,
    status: statusToSet,
    inventory: inventory || {},
    incomingDeliveries: [],
    resourceShortages: [],
    lastUpdatedAt: new Date().toISOString(),
    contactPhone: contactPhone?.trim(),
    amenities: Array.isArray(amenities) ? amenities : [],
    region: region || 'ncr',
  };

  shelterStore.shelters.push(newShelter);
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_CREATE',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: newShelter.id,
    details: { name: newShelter.name, totalCapacity: newShelter.totalCapacity },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', newShelter, newShelter.id);
  console.info(`[Shelter] Created new shelter: ${newShelter.name} (${newShelter.id})`);
  res.status(201).json({ ok: true, shelter: newShelter });
});

/** PUT /api/shelters/:id — update capacity, status, or details (authorized operator only) */
app.put('/api/shelters/:id', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const {
    name,
    address,
    totalCapacity,
    operatingStatus,
    contactPhone,
    amenities,
  } = req.body;

  if (totalCapacity !== undefined) {
    const newCap = Number(totalCapacity);
    if (isNaN(newCap) || newCap < 0) {
      res.status(400).json({ error: 'Total capacity must be a non-negative number.' });
      return;
    }
    const currentCommitted = shelter.occupiedBeds + shelter.reservedBeds;
    if (newCap < currentCommitted) {
      res.status(400).json({
        error: `Cannot reduce total capacity to ${newCap}: current occupied (${shelter.occupiedBeds}) + reserved (${shelter.reservedBeds}) = ${currentCommitted} beds exceeds proposed capacity.`,
      });
      return;
    }
    shelter.totalCapacity = newCap;
    shelter.capacity = newCap;
  }

  if (name?.trim()) shelter.name = name.trim();
  if (address?.trim()) shelter.address = address.trim();
  if (contactPhone !== undefined) shelter.contactPhone = contactPhone;
  if (Array.isArray(amenities)) shelter.amenities = amenities;

  if (operatingStatus) {
    const isFull = shelter.occupiedBeds + shelter.reservedBeds >= shelter.totalCapacity;
    if (operatingStatus === 'open' && isFull) {
      shelter.operatingStatus = 'full';
      shelter.status = 'full';
    } else {
      shelter.operatingStatus = operatingStatus;
      shelter.status = operatingStatus;
    }
  }

  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_UPDATE',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { totalCapacity: shelter.totalCapacity, operatingStatus: shelter.operatingStatus },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({
    ok: true,
    shelter: {
      ...shelter,
      availableBeds: Math.max(0, shelter.totalCapacity - (shelter.occupiedBeds + shelter.reservedBeds)),
    },
  });
});

/** POST /api/shelters/:id/intake — record bed intake (authorized operator only) */
app.post('/api/shelters/:id/intake', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const { newOccupiedBeds } = req.body;
  const newOccupied = Number(newOccupiedBeds);

  const capValidation = validateServerShelterCapacity(shelter.totalCapacity, newOccupied, shelter.reservedBeds);
  if (!capValidation.valid) {
    res.status(400).json({ error: capValidation.error });
    return;
  }

  shelter.occupiedBeds = newOccupied;
  shelter.occupied = newOccupied;
  const isFull = newOccupied + shelter.reservedBeds >= shelter.totalCapacity;
  if (isFull && shelter.operatingStatus === 'open') {
    shelter.operatingStatus = 'full';
    shelter.status = 'full';
  } else if (!isFull && shelter.operatingStatus === 'full') {
    shelter.operatingStatus = 'open';
    shelter.status = 'open';
  }

  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_BEDS_INTAKE',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { newOccupiedBeds: newOccupied },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({
    ok: true,
    shelter: {
      ...shelter,
      availableBeds: Math.max(0, shelter.totalCapacity - (shelter.occupiedBeds + shelter.reservedBeds)),
    },
  });
});

/** POST /api/shelters/:id/reserve — reserve beds (authorized operator only) */
app.post('/api/shelters/:id/reserve', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const bedsToReserve = Number(req.body.bedsToReserve);
  if (isNaN(bedsToReserve) || bedsToReserve <= 0) {
    res.status(400).json({ error: 'Beds to reserve must be greater than zero.' });
    return;
  }

  const newReserved = shelter.reservedBeds + bedsToReserve;
  const capValidation = validateServerShelterCapacity(shelter.totalCapacity, shelter.occupiedBeds, newReserved);
  if (!capValidation.valid) {
    res.status(400).json({ error: capValidation.error });
    return;
  }

  shelter.reservedBeds = newReserved;
  const isFull = shelter.occupiedBeds + newReserved >= shelter.totalCapacity;
  if (isFull && shelter.operatingStatus === 'open') {
    shelter.operatingStatus = 'full';
    shelter.status = 'full';
  }

  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_BEDS_RESERVED',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { bedsReserved: bedsToReserve, totalReserved: newReserved },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({
    ok: true,
    shelter: {
      ...shelter,
      availableBeds: Math.max(0, shelter.totalCapacity - (shelter.occupiedBeds + shelter.reservedBeds)),
    },
  });
});

/** POST /api/shelters/:id/release — release reserved beds (authorized operator only) */
app.post('/api/shelters/:id/release', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const bedsToRelease = Number(req.body.bedsToRelease);
  const convertedToOccupied = Boolean(req.body.convertedToOccupied);

  if (isNaN(bedsToRelease) || bedsToRelease <= 0) {
    res.status(400).json({ error: 'Beds to release must be greater than zero.' });
    return;
  }

  const actualRelease = Math.min(shelter.reservedBeds, bedsToRelease);
  const newReserved = shelter.reservedBeds - actualRelease;
  const newOccupied = convertedToOccupied ? shelter.occupiedBeds + actualRelease : shelter.occupiedBeds;

  const capValidation = validateServerShelterCapacity(shelter.totalCapacity, newOccupied, newReserved);
  if (!capValidation.valid) {
    res.status(400).json({ error: capValidation.error });
    return;
  }

  shelter.reservedBeds = newReserved;
  shelter.occupiedBeds = newOccupied;
  shelter.occupied = newOccupied;

  const isFull = newOccupied + newReserved >= shelter.totalCapacity;
  if (!isFull && shelter.operatingStatus === 'full') {
    shelter.operatingStatus = 'open';
    shelter.status = 'open';
  }

  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_BEDS_RELEASED',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { bedsReleased: actualRelease, convertedToOccupied },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({
    ok: true,
    shelter: {
      ...shelter,
      availableBeds: Math.max(0, shelter.totalCapacity - (shelter.occupiedBeds + shelter.reservedBeds)),
    },
  });
});

/** POST /api/shelters/:id/inventory — update supply stock (authorized operator only) */
app.post('/api/shelters/:id/inventory', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const { itemKey, quantity, unit = 'units', minThreshold } = req.body;
  if (!itemKey?.trim()) {
    res.status(400).json({ error: 'itemKey is required.' });
    return;
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty < 0) {
    res.status(400).json({ error: `Inventory quantity for ${itemKey} cannot be negative.` });
    return;
  }

  const threshold = minThreshold !== undefined ? Number(minThreshold) : (shelter.inventory?.[itemKey]?.minThreshold ?? 10);

  shelter.inventory = shelter.inventory || {};
  shelter.inventory[itemKey] = {
    quantity: qty,
    unit: unit || 'units',
    minThreshold: threshold,
    lastRestockedAt: new Date().toISOString(),
  };

  // Auto update shortages list
  const shortages = new Set(shelter.resourceShortages || []);
  if (qty <= threshold) {
    shortages.add(itemKey);
  } else {
    shortages.delete(itemKey);
  }
  shelter.resourceShortages = Array.from(shortages);

  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_INVENTORY_UPDATE',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { itemKey, quantity: qty, unit },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({ ok: true, shelter });
});

/** POST /api/shelters/:id/deliveries — schedule incoming delivery (authorized operator only) */
app.post('/api/shelters/:id/deliveries', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const { item, quantity, unit = 'units', expectedAt, source = 'Central Logistics', notes } = req.body;
  const qty = Number(quantity);
  if (!item?.trim() || isNaN(qty) || qty <= 0) {
    res.status(400).json({ error: 'Valid item name and quantity > 0 are required.' });
    return;
  }

  const delivery: ServerIncomingDelivery = {
    id: generateId('del'),
    item: item.trim(),
    quantity: qty,
    unit: unit || 'units',
    expectedAt: expectedAt || new Date(Date.now() + 3600000).toISOString(),
    source: source.trim(),
    status: 'scheduled',
    notes: notes?.trim(),
  };

  shelter.incomingDeliveries = shelter.incomingDeliveries || [];
  shelter.incomingDeliveries.push(delivery);
  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_DELIVERY_SCHEDULED',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { deliveryId: delivery.id, item: delivery.item, quantity: delivery.quantity },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({ ok: true, delivery, shelter });
});

/** POST /api/shelters/:id/deliveries/:deliveryId/receive — mark delivery received and auto-restock */
app.post('/api/shelters/:id/deliveries/:deliveryId/receive', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const delivery = (shelter.incomingDeliveries || []).find((d) => d.id === req.params.deliveryId);
  if (!delivery) {
    res.status(404).json({ error: `Delivery ${req.params.deliveryId} not found.` });
    return;
  }

  if (delivery.status === 'delivered') {
    res.status(400).json({ error: 'Delivery has already been marked as received.' });
    return;
  }

  delivery.status = 'delivered';

  // Restock inventory
  shelter.inventory = shelter.inventory || {};
  const existing = shelter.inventory[delivery.item] || {
    quantity: 0,
    unit: delivery.unit,
    minThreshold: 20,
  };

  existing.quantity += delivery.quantity;
  existing.lastRestockedAt = new Date().toISOString();
  shelter.inventory[delivery.item] = existing;

  // Resolve shortage if now above threshold
  if (existing.quantity > (existing.minThreshold ?? 0)) {
    shelter.resourceShortages = (shelter.resourceShortages || []).filter((s) => s !== delivery.item);
  }

  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_DELIVERY_RECEIVED',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { deliveryId: delivery.id, item: delivery.item, quantity: delivery.quantity },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({ ok: true, delivery, shelter });
});

/** POST /api/shelters/:id/shortages — report resource shortage */
app.post('/api/shelters/:id/shortages', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const { itemKey } = req.body;
  if (!itemKey?.trim()) {
    res.status(400).json({ error: 'itemKey is required.' });
    return;
  }

  const shortages = new Set(shelter.resourceShortages || []);
  shortages.add(itemKey.trim());
  shelter.resourceShortages = Array.from(shortages);
  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_SHORTAGE_REPORTED',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { itemKey: itemKey.trim() },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({ ok: true, shelter });
});

/** DELETE /api/shelters/:id/shortages/:itemKey — resolve resource shortage */
app.delete('/api/shelters/:id/shortages/:itemKey', requireShelterOperator, (req: Request, res: Response) => {
  const shelter = shelterStore.shelters.find((s) => s.id === req.params.id);
  if (!shelter) {
    res.status(404).json({ error: `Shelter with ID ${req.params.id} not found.` });
    return;
  }

  const itemKey = req.params.itemKey;
  shelter.resourceShortages = (shelter.resourceShortages || []).filter((s) => s !== itemKey);
  shelter.lastUpdatedAt = new Date().toISOString();
  shelterStore.version += 1;
  writeShelterStore(shelterStore);

  recordAuditEvent({
    action: 'SHELTER_SHORTAGE_RESOLVED',
    actorId: req.user!.sub,
    actorRole: req.user!.role,
    entityType: 'shelter',
    entityId: shelter.id,
    details: { itemKey },
    ipAddress: req.ip,
  });

  broadcastEvent('SHELTER_UPDATED', shelter, shelter.id);

  res.json({ ok: true, shelter });
});

// ═════════════════════════════════════════════════════════════════════════════
// EXISTING CHAT ENDPOINT (unchanged)
// ═════════════════════════════════════════════════════════════════════════════

app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, context } = req.body as {
    message: string;
    context: {
      region: string;
      locationLabel: string;
      shelters: { name: string; address: string; capacity: number; occupied: number; status: string; amenities: string[] }[];
      resources: { type: string; name: string; address: string; status: string; phone: string; tags: string[] }[];
      activeRequests: { category: string; priority: string; title: string; peopleCount: number }[];
      gps?: string;
    };
  };

  if (!message || typeof message !== 'string' || message.length > 2000) {
    res.status(400).json({ error: 'Invalid message.' });
    return;
  }
  if (!GEMINI_READY) {
    res.status(503).json({ error: 'Gemini not configured.' });
    return;
  }

  const shelterLines = (context?.shelters ?? []).map(s => {
    const beds = s.capacity - s.occupied;
    return `  • ${s.name} (${s.address}) — Status: ${s.status}, Beds available: ${beds}/${s.capacity}, Amenities: ${s.amenities.join(', ')}`;
  }).join('\n');

  const resourceLines = (context?.resources ?? []).map(r =>
    `  • [${r.type.toUpperCase()}] ${r.name}, ${r.address} — ${r.status} | ☎ ${r.phone} | Tags: ${r.tags.join(', ')}`
  ).join('\n');

  const requestLines = (context?.activeRequests ?? []).map(r =>
    `  • [${r.priority.toUpperCase()}] ${r.category}: ${r.title}${r.peopleCount > 0 ? ` (${r.peopleCount} people)` : ''}`
  ).join('\n');

  const appContext = `
=== CURRENT APP CONTEXT ===
Region: ${context?.locationLabel ?? 'Unknown'}
${context?.gps ? `User GPS: ${context.gps}` : 'GPS: not available'}

SHELTERS (${(context?.shelters ?? []).length}):
${shelterLines || '  (none)'}

RESOURCES / HELP POINTS (${(context?.resources ?? []).length}):
${resourceLines || '  (none)'}

ACTIVE AID REQUESTS (${(context?.activeRequests ?? []).length}):
${requestLines || '  (none)'}
===========================`;

  try {
    const ai     = new GoogleGenAI({ apiKey: API_KEY });
    const model  = 'gemini-2.0-flash';
    const prompt = `${appContext}\n\nUser question: ${message}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, maxOutputTokens: 512 },
    });

    const text = response.text ?? '';
    if (!text) { res.status(502).json({ error: 'Empty response from Gemini.' }); return; }

    res.json({ reply: text, mode: 'online' });
  } catch (err: unknown) {
    console.error('[Gemini error]', err);
    res.status(502).json({ error: 'Gemini request failed.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// EXISTING AI TRIAGE ENDPOINT (unchanged)
// ═════════════════════════════════════════════════════════════════════════════

const TRIAGE_SYSTEM_INSTRUCTION = `You are an emergency triage AI for a disaster-management system called ResQLink.

Your job is to analyze an emergency message — which may be in English, Hindi, or Hinglish — and extract structured information.

You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation — just the raw JSON.

The JSON must follow this exact schema:
{
  "incidentType": one of ["Flood","Fire","Earthquake","Landslide","Medical Emergency","Trapped","Building Collapse","Unknown"],
  "location": string or null (the location mentioned, or null if unclear),
  "locationConfidence": one of ["high","medium","low"],
  "people": number or null (total people affected, null if not mentioned),
  "vulnerable": {
    "elderly": number (0 if not mentioned),
    "children": number (0 if not mentioned),
    "pregnant": number (0 if not mentioned),
    "disabled": number (0 if not mentioned),
    "injured": number (0 if not mentioned)
  },
  "dangerIndicators": array of strings (e.g. ["Water level: first floor", "No boat access", "Rising rapidly"]),
  "medicalEmergency": boolean,
  "requiredResources": array of strings (e.g. ["Evacuation","Rescue Boat","Medical Assistance","Food","Water"]),
  "priority": one of ["CRITICAL","HIGH","MEDIUM","LOW"],
  "priorityReasons": array of strings (each reason on why this priority was assigned)
}

Priority rules:
- CRITICAL: trapped person, elderly/child/pregnant/disabled in immediate danger, serious injury, rapidly rising water, fire/collapse, immediate evacuation required
- HIGH: dangerous conditions, multiple people affected, limited time
- MEDIUM: assistance needed but relatively safe for now
- LOW: information request, non-urgent

Translate Hindi/Hinglish terms:
- "phas gaye" = trapped
- "bujurg/elderly" = elderly person
- "pani/paani" = water
- "aag" = fire
- "bhukamp" = earthquake
- "pahad/landslide" = landslide
- "bachcha/bacche" = children
- "garbhwati" = pregnant

If a field cannot be determined, use null for strings/numbers, false for booleans, and empty arrays for arrays.
Do NOT invent location names. If the location is ambiguous, set locationConfidence to "low".`;

app.post('/api/triage', async (req: Request, res: Response) => {
  const { message, region, locationLabel } = req.body as {
    message: string; region?: string; locationLabel?: string;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }
  if (message.length > 2000) {
    res.status(400).json({ error: 'Message too long (max 2000 characters).' });
    return;
  }
  if (!GEMINI_READY) {
    res.status(503).json({ error: 'Gemini not configured — use offline fallback.' });
    return;
  }

  const prompt = `Current region context: ${locationLabel || region || 'Unknown'}

Emergency message to analyze:
"${message}"

Respond with ONLY the JSON object as described.`;

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: TRIAGE_SYSTEM_INSTRUCTION,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text ?? '';
    if (!raw) { res.status(502).json({ error: 'Empty response from Gemini.' }); return; }

    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: 'Gemini returned invalid JSON.', raw: cleaned.slice(0, 200) });
      return;
    }

    res.json({ ...parsed, parsedBy: 'gemini' });
  } catch (err: unknown) {
    console.error('[Triage Gemini error]', err);
    res.status(502).json({ error: 'Gemini triage request failed.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC VOLUNTEER REGISTRATION ENDPOINT
// Fallback used by the frontend when Supabase env vars are not configured.
// Persists records in ngo-store.json under a "publicVolunteers" array.
// Upserts by email so re-submissions never create duplicate records.
// ═════════════════════════════════════════════════════════════════════════════

interface PublicVolunteer {
  id: string;
  fullName: string;
  gender: string;
  phone: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  locationPermission: boolean;
  registeredAt: number;
}

function getPublicVolunteers(): PublicVolunteer[] {
  return ((ngoStore as any).publicVolunteers as PublicVolunteer[]) ?? [];
}

function savePublicVolunteers(vols: PublicVolunteer[]): void {
  (ngoStore as any).publicVolunteers = vols;
  ngoStore.version += 1;
  writeNgoStore(ngoStore);
}

/** POST /api/volunteer/register — upsert a public volunteer by email */
app.post('/api/volunteer/register', (req: Request, res: Response) => {
  const { fullName, gender, phone, email, latitude, longitude, locationPermission } =
    req.body as {
      fullName: string; gender?: string; phone: string; email: string;
      latitude?: number | null; longitude?: number | null;
      locationPermission?: boolean;
    };

  if (!fullName?.trim() || !phone?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'fullName, phone, and email are required.' });
    return;
  }

  const normalEmail = email.trim().toLowerCase();
  const vols = getPublicVolunteers();
  const existingIdx = vols.findIndex((v) => v.email === normalEmail);

  if (existingIdx >= 0) {
    // Update in place — no duplicate
    vols[existingIdx] = {
      ...vols[existingIdx],
      fullName:           fullName.trim(),
      gender:             gender || vols[existingIdx].gender,
      phone:              phone.trim(),
      latitude:           locationPermission ? (latitude ?? null) : vols[existingIdx].latitude,
      longitude:          locationPermission ? (longitude ?? null) : vols[existingIdx].longitude,
      locationPermission: Boolean(locationPermission),
    };
    savePublicVolunteers(vols);
    console.info(`[Volunteer] Updated existing volunteer: ${normalEmail}`);
    res.json({ ok: true, volunteer: vols[existingIdx], updated: true });
    return;
  }

  const volunteer: PublicVolunteer = {
    id:                 generateId('vol'),
    fullName:           fullName.trim(),
    gender:             gender || 'prefer_not_to_say',
    phone:              phone.trim(),
    email:              normalEmail,
    latitude:           locationPermission ? (latitude ?? null) : null,
    longitude:          locationPermission ? (longitude ?? null) : null,
    locationPermission: Boolean(locationPermission),
    registeredAt:       Date.now(),
  };

  vols.push(volunteer);
  savePublicVolunteers(vols);
  console.info(`[Volunteer] New volunteer registered: ${normalEmail}`);
  res.json({ ok: true, volunteer, updated: false });
});

/** GET /api/volunteer/list — list all public volunteers (debug / admin use) */
app.get('/api/volunteer/list', (_req: Request, res: Response) => {
  res.json(getPublicVolunteers());
});

// ── Single app.listen ─────────────────────────────────────────────────────────
// Global error handler — catches any unhandled exception thrown inside a route
// and returns a structured JSON error instead of Express's default empty 500.
// This means the frontend always receives `{ error: "..." }` even in unexpected cases.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[ResQLink API] Unhandled error:', err);
  // Avoid double-sending if headers already sent
  if (res.headersSent) return;
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[ResQLink API] Running on http://localhost:${PORT}`);
  console.log(`[ResQLink API] Gemini configured: ${GEMINI_READY}`);
  if (!GEMINI_READY) console.log('[ResQLink API] Add GEMINI_API_KEY to server/.env to enable AI responses');
  // Bootstrap ngo-store.json on first start so it exists before any request
  if (!fs.existsSync(NGO_FILE)) {
    writeNgoStore(ngoStore);
    console.log(`[ResQLink API] Created ${NGO_FILE}`);
  }
  // Bootstrap shelter-store.json on first start
  if (!fs.existsSync(SHELTER_FILE)) {
    writeShelterStore(shelterStore);
    console.log(`[ResQLink API] Created ${SHELTER_FILE}`);
  }
  // Bootstrap resource-offers.json on first start
  if (!fs.existsSync(RESOURCE_OFFERS_FILE)) {
    writeResourceOffersStore(resourceOffersStore);
    console.log(`[ResQLink API] Created ${RESOURCE_OFFERS_FILE}`);
  }
  // Bootstrap incidents.json on first start
  if (!fs.existsSync(INCIDENTS_FILE)) {
    writeIncidentsStore(incidentsStore);
    console.log(`[ResQLink API] Created ${INCIDENTS_FILE}`);
  }
  writeUsersStore(usersStore);
});
