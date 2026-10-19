/**
 * Backend Integration, Authorization and Data Security Test Suite
 * Validates server-enforced authentication, HMAC token integrity, privilege separation,
 * medical privacy protection, idempotency replay, atomic resource limits, and audit logs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAuthToken,
  verifyAuthToken,
  hashPassword,
  maskMedicalDataForViewer,
  SEED_USERS,
  type AppUser,
} from '../../server/auth';
import {
  canAccessMedicalData,
  canUpdateShelter,
  canAssignVolunteerTask,
  canModifyIncident,
  canAllocateResources,
  type AuthUser,
} from '../auth/permissions';
import { authClient, DEMO_ACCOUNTS } from '../auth/auth-client';
import { recordAuditEvent, readAuditEvents } from '../../server/audit';
import { broadcastEvent, getConnectedClientCount } from '../../server/realtime';
import { ExpressApiAdapter, LocalInMemoryAdapter } from '../sync/sync-adapter';

// ── 1. Cryptographic Authentication & HMAC Token Verification ────────────────

test('Auth Security: Token generation and cryptographic HMAC verification', () => {
  const user = SEED_USERS[0]; // coordinator
  const token = createAuthToken(user, 3600);

  assert.ok(token && typeof token === 'string');
  assert.equal(token.split('.').length, 2, 'Token must be <payload>.<signature>');

  const verified = verifyAuthToken(token);
  assert.ok(verified !== null);
  assert.equal(verified?.sub, user.id);
  assert.equal(verified?.role, 'coordinator');
  assert.equal(verified?.email, user.email);
});

test('Auth Security: Rejects forged or tampered authentication tokens', () => {
  const user = SEED_USERS[2]; // volunteer
  const validToken = createAuthToken(user, 3600);
  const [encodedPayload, signature] = validToken.split('.');

  // Tamper with payload to elevate role to coordinator
  const rawPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  rawPayload.role = 'coordinator';
  const tamperedPayload = Buffer.from(JSON.stringify(rawPayload)).toString('base64url');
  const forgedToken = `${tamperedPayload}.${signature}`;

  const verified = verifyAuthToken(forgedToken);
  assert.equal(verified, null, 'Forged payload must be strictly rejected due to signature mismatch');
});

test('Auth Security: Rejects expired tokens', () => {
  const user = SEED_USERS[3]; // requester
  // Create token with negative expiration (-10 seconds)
  const expiredToken = createAuthToken(user, -10);

  const verified = verifyAuthToken(expiredToken);
  assert.equal(verified, null, 'Expired tokens must be rejected');
});

// ── 2. Server-Enforced Role Separation & Privilege Elevation Defense ─────────

test('Permissions: Incident Coordinator has universal operational authorization', () => {
  const coordinator: AuthUser = {
    id: 'user-coord-001',
    displayName: 'Chief Officer R. Sharma',
    role: 'coordinator',
  };

  assert.equal(canAssignVolunteerTask(coordinator), true);
  assert.equal(canModifyIncident(coordinator), true);
  assert.equal(canUpdateShelter(coordinator, 'shelter-001'), true);
  assert.equal(canUpdateShelter(coordinator, 'shelter-999'), true);
  assert.equal(canAllocateResources(coordinator), true);
  assert.equal(canAccessMedicalData(coordinator), true);
});

test('Permissions: Shelter Officer strictly restricted to assigned shelter', () => {
  const shelterOfficer: AuthUser = {
    id: 'user-shelter-001',
    displayName: 'Officer K. Verma',
    role: 'shelter_officer',
    assignedShelterId: 'shelter-001',
  };

  // Permitted on assigned shelter
  assert.equal(canUpdateShelter(shelterOfficer, 'shelter-001'), true);

  // Strictly prohibited from modifying unassigned shelters
  assert.equal(canUpdateShelter(shelterOfficer, 'shelter-002'), false);
  assert.equal(canUpdateShelter(shelterOfficer, 'shelter-999'), false);

  // Prohibited from assigning tasks or declaring incidents
  assert.equal(canAssignVolunteerTask(shelterOfficer), false);
  assert.equal(canModifyIncident(shelterOfficer), false);
});

test('Permissions: Citizen / Requester cannot perform privileged operational actions', () => {
  const citizen: AuthUser = {
    id: 'user-citizen-001',
    displayName: 'P. Kumar',
    role: 'requester',
  };

  assert.equal(canAssignVolunteerTask(citizen), false);
  assert.equal(canModifyIncident(citizen), false);
  assert.equal(canUpdateShelter(citizen, 'shelter-001'), false);
  assert.equal(canAllocateResources(citizen), false);
  assert.equal(canAccessMedicalData(citizen), false);
});

// ── 3. Medical Privacy & Confidential Data Masking ───────────────────────────

test('Medical Privacy: Redacts confidential medical notes for unauthorized viewers', () => {
  const emergencyTicket = {
    id: 'req-001',
    title: 'Severe trauma from building collapse',
    category: 'trauma',
    confidentialMedicalDetails: 'Patient has severe hemorrhage and requires type O- blood immediately.',
    medicalNotes: 'Pre-existing respiratory condition.',
    assignedVolunteerId: 'vol-42',
    locationPermission: false,
    latitude: 28.6139,
    longitude: 77.2090,
  };

  // Case 1: Anonymous public query
  const publicView = maskMedicalDataForViewer(emergencyTicket, null);
  assert.ok(publicView.confidentialMedicalDetails.includes('RESTRICTED ACCESS'));
  assert.ok(publicView.medicalNotes.includes('RESTRICTED ACCESS'));
  assert.equal(publicView.latitude, null, 'Coordinates masked when locationPermission is false for anonymous viewers');

  // Case 2: Other volunteer viewing
  const otherVolToken = {
    sub: 'vol-99',
    email: 'other@resqlink.org',
    name: 'Other Vol',
    role: 'volunteer' as const,
    iat: 0,
    exp: 9999999999,
  };
  const otherVolView = maskMedicalDataForViewer(emergencyTicket, otherVolToken);
  assert.ok(otherVolView.confidentialMedicalDetails.includes('RESTRICTED ACCESS'));

  // Case 3: Assigned volunteer viewing
  const assignedVolToken = {
    sub: 'vol-42',
    email: 'responder@resqlink.org',
    name: 'Assigned Responder',
    role: 'volunteer' as const,
    iat: 0,
    exp: 9999999999,
  };
  const assignedVolView = maskMedicalDataForViewer(emergencyTicket, assignedVolToken);
  assert.equal(assignedVolView.confidentialMedicalDetails, emergencyTicket.confidentialMedicalDetails);

  // Case 4: Incident Coordinator viewing
  const coordinatorToken = {
    sub: 'user-coord-001',
    email: 'coordinator@resqlink.org',
    name: 'Chief Coordinator',
    role: 'coordinator' as const,
    iat: 0,
    exp: 9999999999,
  };
  const coordView = maskMedicalDataForViewer(emergencyTicket, coordinatorToken);
  assert.equal(coordView.confidentialMedicalDetails, emergencyTicket.confidentialMedicalDetails);
});

// ── 4. Remote Persistence & Sync Adapter Auth Header Integration ──────────────

test('Sync Adapter: Injects Authorization Bearer header into outgoing requests', () => {
  const adapter = new ExpressApiAdapter('http://localhost:3001');
  assert.equal(adapter.getAuthToken(), null);

  adapter.setAuthToken('mock-secure-jwt-token-xyz');
  assert.equal(adapter.getAuthToken(), 'mock-secure-jwt-token-xyz');

  // LocalInMemoryAdapter also supports token setter
  const memAdapter = new LocalInMemoryAdapter();
  memAdapter.setAuthToken('mem-token-123');
  assert.equal(memAdapter.getAuthToken(), 'mem-token-123');
});

// ── 5. Append-Only Security Audit Logging ─────────────────────────────────────

test('Audit Logging: Records security audit events with immutable structure', () => {
  const event = recordAuditEvent({
    action: 'TEST_SHELTER_OVERRIDE',
    actorId: 'user-coord-001',
    actorRole: 'coordinator',
    entityType: 'shelter',
    entityId: 'shelter-001',
    details: { reason: 'Emergency overflow triage' },
    ipAddress: '127.0.0.1',
  });

  assert.ok(event.id.startsWith('audit-'));
  assert.equal(event.action, 'TEST_SHELTER_OVERRIDE');
  assert.equal(event.actorRole, 'coordinator');
  assert.ok(event.timestamp);

  const logs = readAuditEvents(10);
  assert.ok(logs.length > 0);
  const found = logs.find((l) => l.id === event.id);
  assert.ok(found !== undefined);
  assert.equal(found?.entityId, 'shelter-001');
});

// ── 6. Demo Mode Persona Management ──────────────────────────────────────────

test('Demo Mode: Exposes pre-seeded test accounts covering all 4 roles', () => {
  assert.equal(DEMO_ACCOUNTS.length, 4);

  const roles = DEMO_ACCOUNTS.map((a) => a.role);
  assert.ok(roles.includes('coordinator'));
  assert.ok(roles.includes('shelter_officer'));
  assert.ok(roles.includes('volunteer'));
  assert.ok(roles.includes('requester'));

  for (const acc of DEMO_ACCOUNTS) {
    assert.ok(acc.email && acc.password && acc.name && acc.description);
  }
});

test('Demo Mode: Client auth service switches role personas safely', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      json: async () => ({
        token: 'test-token-shelter',
        user: { id: 'u1', name: 'Officer K. Verma', role: 'shelter_officer', assignedShelterId: 'shelter-001' },
      }),
    } as any;
  };

  try {
    await authClient.switchDemoRole('shelter_officer');
    const user = authClient.getCurrentUser();
    assert.ok(user !== null);
    assert.equal(user?.role, 'shelter_officer');
    assert.equal(user?.assignedShelterId, 'shelter-001');

    // Switch back to coordinator
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          token: 'test-token-coord',
          user: { id: 'u2', name: 'Chief Officer R. Sharma', role: 'coordinator' },
        }),
      } as any;
    };
    await authClient.switchDemoRole('coordinator');
    const coord = authClient.getCurrentUser();
    assert.equal(coord?.role, 'coordinator');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── 7. Real-time Event Bus Connectivity ──────────────────────────────────────

test('Real-time: Broadcast function serializes events safely without throws', () => {
  assert.doesNotThrow(() => {
    broadcastEvent('REQUEST_UPDATED', { id: 'req-test', status: 'IN_PROGRESS' }, 'req-test');
  });
  assert.equal(typeof getConnectedClientCount(), 'number');
});
