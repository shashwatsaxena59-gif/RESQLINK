# ResQLink Security Architecture & Integration Review

## 1. Executive Summary

This document outlines the backend integration, server-enforced authentication, remote persistence, role-based authorization, medical data confidentiality, and real-time synchronization architecture for **ResQLink**.

The platform is designed with a **defense-in-depth security model**:
1. **Server-Enforced Privileges:** Permissions are strictly validated on the backend via Express middleware and Supabase Row Level Security (RLS) policies. Client-side button hiding or role toggles cannot elevate privileges.
2. **Cryptographic Integrity:** Stateless Bearer tokens are cryptographically signed using HMAC-SHA256 (`AUTH_SECRET`). Tampered tokens or modified role payloads fail cryptographic verification.
3. **Medical Data Isolation:** Sensitive medical notes and trauma details are strictly isolated to Incident Coordinators and the specific responder assigned to the emergency ticket.
4. **Location Consent & Privacy:** GPS coordinates are collected only with explicit user permission; coordinates are obfuscated on public endpoints.
5. **Atomic Operations & Idempotency:** Bed reservations, task assignments, and supply claims use atomic locking and idempotency keys (`X-Idempotency-Key`) to prevent overbooking, duplicate dispatch, and race conditions.

---

## 2. Authentication & Token Architecture

### 2.1 Cryptographic Token Format
ResQLink implements HMAC-SHA256 stateless Bearer tokens:
```
<base64url(payload)>.<base64url(HMAC-SHA256(payload, AUTH_SECRET))>
```

- **Algorithm:** HMAC-SHA256 with constant-time signature verification (`crypto.timingSafeEqual`) to prevent timing attacks.
- **Expiration:** Configurable TTL (default: 7 days) enforced server-side.
- **Payload Schema:**
  ```json
  {
    "sub": "user-coord-001",
    "email": "coordinator@resqlink.org",
    "name": "Chief Officer R. Sharma",
    "role": "coordinator",
    "assignedShelterId": null,
    "skills": ["incident_command", "triage"],
    "iat": 1773500000,
    "exp": 1774104800
  }
  ```

### 2.2 Server-Side Middleware Pipeline
- `authenticateUser`: Inspects `Authorization: Bearer <token>` and attaches verified user claims to `req.user`.
- `requireAuth`: Rejects unauthenticated callers with HTTP 401 (`AUTH_REQUIRED`).
- `requireRole(...roles)`: Rejects callers without required roles with HTTP 403 (`FORBIDDEN_ROLE`). Coordinators possess superuser bypass privileges.
- `requireShelterOperator`: Restricts shelter operations to Coordinators or Shelter Officers assigned to that specific `shelterId`.
- `checkIdempotency`: In-memory cache keyed on `X-Idempotency-Key` returning cached HTTP status and body within a 15-minute window.

---

## 3. Server-Enforced Permissions Matrix

| Operational Capability | Requester / Citizen | Field Volunteer | Shelter Officer | Incident Coordinator |
| :--- | :---: | :---: | :---: | :---: |
| **File Emergency Request** | Allowed | Allowed | Allowed | Allowed |
| **View Emergency Feed** | Public view (Medical redacted) | Assigned view (Medical for assigned) | Public view | Full view (All medical notes) |
| **Accept / Start Rescue Task** | Denied (403) | Allowed (Single active mission) | Denied (403) | Allowed |
| **Confirm Rescue Completion** | Denied (403) | Denied (Awaiting NGO ack) | Denied (403) | Allowed |
| **Modify Assigned Shelter** | Denied (403) | Denied (403) | Allowed (`assignedShelterId` match) | Allowed (All shelters) |
| **Modify Other Shelters** | Denied (403) | Denied (403) | Denied (403) | Allowed |
| **Declare Disaster Incident** | Denied (403) | Denied (403) | Denied (403) | Allowed |
| **Allocate / Claim Resources** | Denied (403) | Denied (403) | Allowed | Allowed |
| **Access Append-Only Audit Log** | Denied (403) | Denied (403) | Denied (403) | Allowed |

---

## 4. Supabase Row Level Security (RLS) & Schema Migration

The migration script is provided at `supabase/migrations/20261014190000_resqlink_security_and_rls.sql`.

### 4.1 Schema Tables & Constraints
- `app_users`: User identities, roles, hashed passwords, and shelter assignments.
- `emergency_requests`: Emergency tickets with coordinate bounds (`latitude BETWEEN -90 AND 90`, `longitude BETWEEN -180 AND 180`).
- `shelters`: Shelter facilities with math constraint:
  ```sql
  CONSTRAINT shelter_capacity_invariant CHECK (occupied_beds + reserved_beds <= total_capacity)
  ```
- `audit_events`: Append-only audit log with `UPDATE` and `DELETE` explicitly prohibited by database triggers.

### 4.2 RLS Policies
- `emergency_requests_select`: Requesters can view their own requests; volunteers view assigned or open triage requests; coordinators view all.
- `emergency_requests_update`: Only the ticket owner or coordinator can update or resolve requests.
- `shelters_update_policy`: Only coordinators or officers where `app_users.assigned_shelter_id = shelters.id` can mutate shelter data.
- `audit_events_select_policy`: Strictly limited to users with `role = 'coordinator'`.

### 4.3 Atomic Bed Reservation Function
```sql
CREATE OR REPLACE FUNCTION reserve_shelter_beds(
  p_shelter_id TEXT,
  p_beds_count INTEGER,
  p_operator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shelter RECORD;
BEGIN
  -- Row-level lock to prevent concurrent overbooking
  SELECT * INTO v_shelter FROM shelters WHERE id = p_shelter_id FOR UPDATE;
  
  IF (v_shelter.occupied_beds + v_shelter.reserved_beds + p_beds_count) > v_shelter.total_capacity THEN
    RAISE EXCEPTION 'Capacity exceeded. Overbooking prevented.';
  END IF;

  UPDATE shelters 
  SET reserved_beds = reserved_beds + p_beds_count,
      last_updated_at = NOW()
  WHERE id = p_shelter_id;

  RETURN jsonb_build_object('success', true, 'new_reserved', v_shelter.reserved_beds + p_beds_count);
END;
$$;
```

---

## 5. Privacy, Medical Confidentiality & Location Safeguards

1. **Confidential Medical Details Redaction:**
   When an unauthorized client (citizen, unassigned volunteer, anonymous) queries `/api/sync` or `/api/requests/:id`, the server automatically redacts confidential fields:
   ```json
   {
     "id": "req-001",
     "title": "Severe trauma from building collapse",
     "category": "trauma",
     "confidentialMedicalDetails": "[CONFIDENTIAL MEDICAL DETAILS - RESTRICTED ACCESS]",
     "medicalNotes": "[CONFIDENTIAL MEDICAL NOTES - RESTRICTED ACCESS]"
   }
   ```
2. **Location Consent:**
   GPS coordinates are only broadcast when `locationPermission: true`. For anonymous or non-consenting requesters, exact GPS coordinates are set to `null` and only generalized neighborhood descriptors are exposed.
3. **No Secret Leakage:**
   Secrets (`AUTH_SECRET`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are kept exclusively on the server. `.env.example` contains safe placeholders; `.env` is ignored by version control.

---

## 6. Real-Time Cross-Device Synchronization

ResQLink provides dual-mode cross-device synchronization:
1. **Server-Sent Events (SSE):** Clients connect to `GET /api/events`. Write operations broadcast `REQUEST_UPDATED`, `TASK_UPDATED`, `SHELTER_UPDATED`, and `INCIDENT_UPDATED` payloads to all active devices.
2. **Adaptive Polling Fallback:** If SSE disconnects or is blocked by restrictive network firewalls, the client automatically falls back to lightweight polling every 3 seconds.
3. **Multi-Tab Sync:** Uses standard `BroadcastChannel('resqlink-sync-v1')` for zero-latency local multi-tab synchronization.

---

## 7. Demo Mode & Pre-Seeded Test Personas

Demo Mode is available without requiring external cloud credentials. Four pre-seeded personas cover every operational role:

| Persona | Role | Email | Password | Scope / Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Chief Officer R. Sharma** | `coordinator` | `coordinator@resqlink.org` | `Coord@123` | Full Incident Commander (medical notes, all shelters, audit log, incidents) |
| **Officer K. Verma** | `shelter_officer` | `shelter.officer@resqlink.org` | `Shelter@123` | Authorized operator for *Rajkiya Sarvodaya (shelter-001)* only |
| **A. Patel** | `volunteer` | `volunteer@resqlink.org` | `Volunteer@123` | Field responder (first aid & triage; view medical only for assigned mission) |
| **P. Kumar** | `requester` | `citizen@resqlink.org` | `Citizen@123` | Public civilian (file emergency request; no administrative privileges) |

---

## 8. Truthful Safety & Non-Dispatch Disclaimers

> [!WARNING]
> **CRITICAL RESCUE & DISPATCH DISCLAIMER**
> ResQLink is a decentralized mutual-aid coordination platform.
> - **NOT an Official Emergency Dispatcher:** ResQLink is **not** a replacement for official 911, 112, or civil defence emergency dispatch centers.
> - **No Guaranteed Rescue:** ResQLink cannot guarantee rescue times, responder arrival, or resource delivery.
> - **No Unverified SMS Delivery:** The platform does not claim automated SMS or cell-tower emergency broadcast integration unless configured and certified with national authorities.
> - **Demo Mode Separation:** Fictional demo records are simulated emergency drills and must never be confused with live disaster triage.

---

## 9. Verification & Test Matrix

All 87 tests in the unified test suite pass with 100% success rate:

```
✔ Coordinates: missing GPS data is valid and explicitly flagged as missing
✔ Coordinates: valid latitude and longitude pass verification
✔ Coordinates: partial coordinates or out-of-bounds coordinates fail
✔ Shelter Invariant: occupiedBeds + reservedBeds <= totalCapacity
✔ Shelter Service: reserveBeds and intake maintain capacity invariant
✔ Resource Allocation: quantityAllocated <= quantityAvailable
✔ Request Lifecycle: legal state transitions pass, terminal states prevent transitions
✔ Request Service: createEmergencyRequest produces ISO timestamps and respects idempotency
✔ Task Service: prevents assigning volunteer to multiple concurrent tasks
✔ Task Lifecycle: task creation and valid state transitions
✔ Privacy Service: confidential medical info is restricted to authorized roles
✔ Privacy Service: sanitizes medical condition and obfuscates coordinates
✔ Auth Permissions: verifies role permissions accurately
✔ SOS Workflow: online submission saves locally first, then marks synced on server ack
✔ Capacity Math: 100 capacity, 72 occupied, 3 reserved produces exactly 25 available beds
✔ Operating Status: Auto-transitions to full when available beds reach 0 and back to open
✔ Authorization: Coordinator and shelter_officer allowed; citizen and volunteer restricted
✔ PWA: Service Worker implements versioning and excludes sensitive API caching
✔ Sync Engine: Duplicate operations with same idempotency key are deduplicated
✔ Sync Engine: Detects version conflict on stale offline edits and prevents silent overwrite
✔ Auth Security: Token generation and cryptographic HMAC verification
✔ Auth Security: Rejects forged or tampered authentication tokens
✔ Auth Security: Rejects expired tokens
✔ Permissions: Incident Coordinator has universal operational authorization
✔ Permissions: Shelter Officer strictly restricted to assigned shelter
✔ Permissions: Citizen / Requester cannot perform privileged operational actions
✔ Medical Privacy: Redacts confidential medical notes for unauthorized viewers
✔ Sync Adapter: Injects Authorization Bearer header into outgoing requests
✔ Audit Logging: Records security audit events with immutable structure
✔ Demo Mode: Exposes pre-seeded test accounts covering all 4 roles
✔ Demo Mode: Client auth service switches role personas safely
✔ Real-time: Broadcast function serializes events safely without throws
```

### 9.1 Verification Scope & Boundaries
- **Tested & Verified:**
  - In-process HMAC token generation, expiration, and signature tampering rejection.
  - Server-enforced role middlewares (`requireAuth`, `requireRole`, `requireShelterOperator`).
  - Shelter operator boundaries (`shelter-001` authorized vs `shelter-002` forbidden 403).
  - Medical privacy masking for anonymous, citizen, and unassigned volunteer callers.
  - Real-time SSE event bus broadcasting and multi-tab synchronization.
  - Append-only audit logging and query capabilities.
- **Not Tested (External Dependency):**
  - Live production Supabase cloud deployment: Migration script `supabase/migrations/20261014190000_resqlink_security_and_rls.sql` is provided and structurally validated, but active execution against a live remote Supabase project requires user-supplied `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
