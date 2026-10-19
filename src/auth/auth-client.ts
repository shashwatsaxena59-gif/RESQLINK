/**
 * ResQLink Client-Side Authentication Service
 * Manages Bearer tokens, active session state, role validation, and demo mode accounts.
 */

import type { AuthUser, UserRole } from './permissions';

export interface DemoAccountInfo {
  role: UserRole;
  email: string;
  password: string;
  name: string;
  assignedShelterId?: string;
  skills?: string[];
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccountInfo[] = [
  {
    role: 'coordinator',
    email: 'coordinator@resqlink.org',
    password: 'Coord@123',
    name: 'Chief Officer R. Sharma',
    description: 'Incident Commander with full administrative and medical record clearance',
  },
  {
    role: 'shelter_officer',
    email: 'shelter.officer@resqlink.org',
    password: 'Shelter@123',
    name: 'Officer K. Verma (Mayur Vihar)',
    assignedShelterId: 'shelter-001',
    description: 'Designated Shelter Operator for Rajkiya Sarvodaya (shelter-001)',
  },
  {
    role: 'volunteer',
    email: 'volunteer@resqlink.org',
    password: 'Volunteer@123',
    name: 'A. Patel (Rapid Response)',
    skills: ['first_aid', 'triage', 'water_rescue'],
    description: 'Certified Field Responder for triage and rescue dispatch',
  },
  {
    role: 'requester',
    email: 'citizen@resqlink.org',
    password: 'Citizen@123',
    name: 'P. Kumar (Displaced Citizen)',
    description: 'Civilian requester seeking evacuation and shelter assistance',
  },
];

const STORAGE_KEY_TOKEN = 'resqlink_auth_token';
const STORAGE_KEY_USER = 'resqlink_auth_user';

type AuthChangeListener = (user: AuthUser | null) => void;

class AuthClientService {
  private currentUser: AuthUser | null = null;
  private token: string | null = null;
  private listeners: Set<AuthChangeListener> = new Set();
  private baseUrl: string = '';

  constructor() {
    this.restoreSession();
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  private restoreSession() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
        const storedUser = localStorage.getItem(STORAGE_KEY_USER);
        if (storedToken && storedUser) {
          this.token = storedToken;
          this.currentUser = JSON.parse(storedUser);
          return;
        }
      }
    } catch {
      // LocalStorage access issues (private mode / sandboxed test)
    }

    // Default to Coordinator demo account for instant testability
    const defaultDemo = DEMO_ACCOUNTS[0];
    this.currentUser = {
      id: 'user-coord-001',
      displayName: defaultDemo.name,
      role: defaultDemo.role,
    };
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public subscribe(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  /**
   * Logs in with email and password via backend API with offline demo fallback.
   */
  public async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Authentication failed' };
      }

      const data = await res.json();
      this.token = data.token;
      this.currentUser = {
        id: data.user.id,
        displayName: data.user.name,
        role: data.user.role,
        assignedShelterId: data.user.assignedShelterId,
      };

      this.persistSession();
      this.notify();
      return { success: true };
    } catch {
      // Offline fallback: check demo credentials
      const demo = DEMO_ACCOUNTS.find(
        (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password
      );
      if (demo) {
        this.currentUser = {
          id: `demo-${demo.role}`,
          displayName: demo.name,
          role: demo.role,
          assignedShelterId: demo.assignedShelterId,
        };
        this.token = `demo-token-${demo.role}`;
        this.persistSession();
        this.notify();
        return { success: true };
      }
      return { success: false, error: 'Offline authentication failed: Invalid credentials.' };
    }
  }

  /**
   * Switches role instantly using pre-configured test personas (Demo Mode).
   */
  public async switchDemoRole(role: UserRole): Promise<void> {
    const demo = DEMO_ACCOUNTS.find((a) => a.role === role) || DEMO_ACCOUNTS[0];

    try {
      const res = await fetch(`${this.baseUrl}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: demo.role }),
      });

      if (res.ok) {
        const data = await res.json();
        this.token = data.token;
        this.currentUser = {
          id: data.user.id,
          displayName: data.user.name,
          role: data.user.role,
          assignedShelterId: data.user.assignedShelterId,
        };
        this.persistSession();
        this.notify();
        return;
      }
    } catch {
      // Backend unreachable: switch purely client-side
    }

    this.currentUser = {
      id: `demo-${demo.role}`,
      displayName: demo.name,
      role: demo.role,
      assignedShelterId: demo.assignedShelterId,
    };
    this.token = `demo-token-${demo.role}`;
    this.persistSession();
    this.notify();
  }

  public logout(): void {
    this.token = null;
    this.currentUser = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch {}
    this.notify();
  }

  private persistSession() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (this.token) localStorage.setItem(STORAGE_KEY_TOKEN, this.token);
        if (this.currentUser) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
      }
    } catch {}
  }
}

export const authClient = new AuthClientService();
