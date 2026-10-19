import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export type UserRole =
  | 'coordinator'
  | 'volunteer'
  | 'shelter_manager'
  | 'shelter_officer'
  | 'requester'
  | 'citizen';

export interface AppUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  assignedShelterId?: string | null;
  skills?: string[];
  createdAt: number;
}

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  assignedShelterId?: string | null;
  skills?: string[];
  iat: number;
  exp: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload | null;
    }
  }
}

const AUTH_SECRET = process.env.AUTH_SECRET || 'resqlink-secure-hmac-sha256-auth-token-key-2026';
const PASSWORD_SALT = 'resqlink-pwd-salt-981248';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + PASSWORD_SALT).digest('hex');
}

export function createAuthToken(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  assignedShelterId?: string | null;
  skills?: string[];
}, expiresInSeconds: number = 7 * 86400): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    assignedShelterId: user.assignedShelterId || null,
    skills: user.skills || [],
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, receivedSignature] = parts;

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (receivedSignature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const raw = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(raw) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// ── Seed users for demo mode & tests ──────────────────────────────────────────
export const SEED_USERS: AppUser[] = [
  {
    id: 'user-coord-001',
    email: 'coordinator@resqlink.org',
    passwordHash: hashPassword('Coord@123'),
    name: 'Chief Officer R. Sharma',
    role: 'coordinator',
    createdAt: 1710000000000,
  },
  {
    id: 'user-shelter-001',
    email: 'shelter.officer@resqlink.org',
    passwordHash: hashPassword('Shelter@123'),
    name: 'Officer K. Verma (Mayur Vihar)',
    role: 'shelter_officer',
    assignedShelterId: 'shelter-001',
    createdAt: 1710000000000,
  },
  {
    id: 'user-vol-001',
    email: 'volunteer@resqlink.org',
    passwordHash: hashPassword('Volunteer@123'),
    name: 'A. Patel (Rapid Response)',
    role: 'volunteer',
    skills: ['first_aid', 'triage', 'water_rescue'],
    createdAt: 1710000000000,
  },
  {
    id: 'user-citizen-001',
    email: 'citizen@resqlink.org',
    passwordHash: hashPassword('Citizen@123'),
    name: 'P. Kumar (Displaced Citizen)',
    role: 'requester',
    createdAt: 1710000000000,
  },
];

// ── Persistent Users Store ────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users-store.json');

export interface UsersStore {
  users: AppUser[];
  version: number;
}

export function readUsersStore(): UsersStore {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      // Ensure seed users are always present
      const existingEmails = new Set(parsed.users.map((u: AppUser) => u.email.toLowerCase()));
      for (const seed of SEED_USERS) {
        if (!existingEmails.has(seed.email.toLowerCase())) {
          parsed.users.push(seed);
        }
      }
      return parsed;
    }
  } catch (err) {
    console.error('[UsersStore] Read error:', err);
  }
  return { users: [...SEED_USERS], version: 1 };
}

export function writeUsersStore(store: UsersStore) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[UsersStore] Write error:', err);
  }
}

export let usersStore = readUsersStore();

export function reloadUsersStore() {
  usersStore = readUsersStore();
  return usersStore;
}

// ── Auth Middlewares ──────────────────────────────────────────────────────────

export function authenticateUser(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyAuthToken(token);
    req.user = payload;
  } else {
    req.user = null;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Coordinator is administrator with superuser access
    if (req.user.role === 'coordinator') {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Action requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`,
        code: 'FORBIDDEN_ROLE',
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
      return;
    }
    next();
  };
}

export function requireShelterOperator(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
    return;
  }

  // Coordinators can operate any shelter
  if (req.user.role === 'coordinator') {
    next();
    return;
  }

  const shelterId = req.params.id;
  if (
    (req.user.role === 'shelter_officer' || req.user.role === 'shelter_manager') &&
    req.user.assignedShelterId === shelterId
  ) {
    next();
    return;
  }

  res.status(403).json({
    error: `Forbidden: You are only authorized to operate shelter '${req.user.assignedShelterId || 'none'}', not '${shelterId}'.`,
    code: 'SHELTER_OPERATOR_RESTRICTED',
  });
}

/**
 * Strips passwordHash and returns safe user record
 */
export function sanitizeUser(user: AppUser) {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

/**
 * Masks confidential medical information unless the viewer is a coordinator
 * or the assigned responder on scene.
 */
export function maskMedicalDataForViewer(
  record: any,
  viewer: TokenPayload | null | undefined
): any {
  if (!record) return record;

  // Coordinator always allowed
  if (viewer?.role === 'coordinator') return record;

  // Assigned volunteer allowed
  if (viewer?.role === 'volunteer' && record.assignedVolunteerId && viewer.sub === record.assignedVolunteerId) {
    return record;
  }

  const sanitized = { ...record };
  if (sanitized.confidentialMedicalDetails) {
    sanitized.confidentialMedicalDetails = '[CONFIDENTIAL MEDICAL DETAILS - RESTRICTED ACCESS]';
  }
  if (sanitized.medicalNotes) {
    sanitized.medicalNotes = '[CONFIDENTIAL MEDICAL NOTES - RESTRICTED ACCESS]';
  }

  // Location privacy: if requester revoked GPS permission or anonymous public query, obfuscate
  if (sanitized.locationPermission === false && !viewer) {
    sanitized.latitude = null;
    sanitized.longitude = null;
    sanitized.approximateOnly = true;
  }

  return sanitized;
}
