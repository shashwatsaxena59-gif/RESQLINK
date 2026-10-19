# ResQLink — System Architecture & Data Layer Specification

> **Disaster-Response & Peer-to-Peer Neighborhood Resource-Matching Progressive Web App**

---

## 1. Architectural Philosophy

ResQLink is built for disaster zones where network infrastructure is brittle, intermittent, or completely severed. The application employs an **Offline-First, Zero-Data-Loss Architecture** where all user interactions (submitting emergency SOS alerts, claiming volunteer tasks, logging shelter occupancy, updating relief inventory) are committed synchronously to a durable local storage layer and reconciled asynchronously with upstream emergency servers when connectivity is available.

### Decoupled Layering

```mermaid
graph TD
    UI[Presentation Layer<br/>React Components & Views] --> Domain[Domain Layer<br/>Pure Services & Validators]
    UI --> Repos[Repository Abstraction<br/>Typed Data Access Interfaces]
    Repos --> IDB[(Local Storage<br/>IndexedDB + In-Memory Fallback)]
    Repos --> SyncQueue[Offline Sync Engine<br/>Outbox Queue & Backoff Processor]
    SyncQueue --> Adapters[Remote Backend Adapters<br/>Express API / Remote Endpoints]
    Adapters --> Server[(Express / Central Disaster Hub)]
    UI --> Auth[Auth & Permissions<br/>RBAC & Confidentiality Guards]
```

---

## 2. Layered Responsibilities

| Layer | Directory | Responsibilities | Dependencies |
| :--- | :--- | :--- | :--- |
| **Presentation** | `src/components/`, `src/App.tsx` | UI rendering, user interaction, alerts, responsive layouts, audio broadcast playback. | Consumes Repositories, Domain Services, Auth. |
| **Domain Models** | `src/domain/models/` | Strictly typed interfaces: `EmergencyRequest`, `Volunteer`, `ResourceOffer`, `Shelter`, `VolunteerTask`, `Incident`, `SyncMetadata`, `AuditEvent`. | Zero runtime dependencies. |
| **Domain Services & Logic** | `src/domain/services/` | Business rules: bed reservations, resource allocations, atomic task assignment, coordinate obfuscation, medical isolation. | Domain models, validators. |
| **Domain Validators** | `src/domain/validation/` | Pure validation functions: coordinate boundaries, severity ratings, state machine transitions, capacity constraints. | Domain models. |
| **Local Storage** | `src/storage/indexeddb/` | Promise-wrapped IndexedDB engine (`resqlink_offline_db`) with schema versions, multi-index support, and in-memory fallback. | Browser IDB API. |
| **Repositories** | `src/storage/repositories/` | Decoupled query access: `EmergencyRequestRepository`, `ShelterRepository`, `VolunteerRepository`, `ResourceOfferRepository`, `VolunteerTaskRepository`, `SyncQueueRepository`, `AuditEventRepository`. | Storage engine. |
| **Synchronization** | `src/sync/` | Outbox FIFO processing, exponential backoff, network status subscriptions, remote backend adapters. | Repositories, Domain models. |
| **Security & Auth** | `src/auth/` | Role-based authorization (`coordinator`, `volunteer`, `shelter_manager`, `requester`, `guest`), medical note restriction. | Domain models. |

---

## 3. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    INCIDENT ||--o{ EMERGENCY_REQUEST : contains
    EMERGENCY_REQUEST ||--o| VOLUNTEER_TASK : assigned_to
    VOLUNTEER ||--o{ VOLUNTEER_TASK : fulfills
    RESOURCE_OFFER ||--o{ VOLUNTEER_TASK : allocates
    SHELTER ||--o{ VOLUNTEER_TASK : receives_evacuees
    EMERGENCY_REQUEST ||--o{ SYNC_QUEUE : enqueues
    VOLUNTEER_TASK ||--o{ SYNC_QUEUE : enqueues
    EMERGENCY_REQUEST ||--o{ AUDIT_EVENT : logs
    SHELTER ||--o{ AUDIT_EVENT : logs

    INCIDENT {
        string id PK
        string name
        string hazardType
        string severityLevel
        string status
        string startedAt
        string resolvedAt
    }

    EMERGENCY_REQUEST {
        string id PK
        string incidentId FK
        string requesterId
        string category
        string description
        string severity
        string medicalPriority
        int numberOfPeople
        float latitude
        float longitude
        string status
        string assignedVolunteerId FK
        string syncStatus
        string idempotencyKey
        string confidentialMedicalDetails
    }

    VOLUNTEER {
        string id PK
        string displayName
        string availabilityStatus
        boolean locationSharingPermission
        float latitude
        float longitude
        float serviceRadius
        string ngoAffiliationId
    }

    VOLUNTEER_TASK {
        string id PK
        string emergencyRequestId FK
        string volunteerId FK
        string status
        string createdAt
        string acceptedAt
        string completedAt
        string cancelledAt
        string deliveryNotes
    }

    SHELTER {
        string id PK
        string name
        string address
        float latitude
        float longitude
        int totalCapacity
        int occupiedBeds
        int reservedBeds
        string operatingStatus
        string lastUpdatedAt
    }

    RESOURCE_OFFER {
        string id PK
        string providerId
        string resourceType
        int quantityAvailable
        int quantityAllocated
        string unit
        string availabilityStatus
    }

    SYNC_QUEUE {
        string id PK
        string entityType
        string entityId
        string action
        string idempotencyKey
        string status
        int retryCount
        string clientTimestamp
    }

    AUDIT_EVENT {
        string id PK
        string action
        string entityType
        string entityId
        string actorId
        string actorRole
        string timestamp
    }
```

---

## 4. Finite State Machines

### Emergency Request Lifecycle

```mermaid
stateDiagram-v2
    [*] --> active : Submit Request (with IdempotencyKey)
    active --> assigned : Dispatch to Volunteer
    active --> cancelled : Cancelled by Requester/Coordinator
    assigned --> active : Volunteer Unassigned / Declined
    assigned --> in_progress : Responder In-Transit
    assigned --> cancelled : Cancelled
    in_progress --> assigned : Mission Aborted (Needs Reassignment)
    in_progress --> fulfilled : Aid Delivered / Evacuation Verified
    in_progress --> cancelled : Cancelled
    fulfilled --> [*] : Terminal State
    cancelled --> [*] : Terminal State
```

### Volunteer Task Lifecycle

```mermaid
stateDiagram-v2
    [*] --> proposed : Mission Proposed
    proposed --> accepted : Volunteer Accepts Mission
    proposed --> cancelled : Declined or Cancelled
    accepted --> in_transit : Responder En Route to Scene
    accepted --> cancelled : Aborted with Reason
    in_transit --> at_scene : Arrived at Location
    in_transit --> cancelled : Road Blocked / Aborted
    at_scene --> completed : Mission Completed with Notes
    at_scene --> cancelled : Escalation / Medical Evacuation
    completed --> [*] : Terminal State
    cancelled --> [*] : Terminal State
```

---

## 5. Critical Domain Invariants & Rules

1. **Unique Identifiers & UTC Timestamps**:
   - All records have cryptographic UUIDs (`crypto.randomUUID()`).
   - All timestamps are ISO 8601 UTC strings ending in `Z` (`new Date().toISOString()`).

2. **Strict Coordinate Handling**:
   - Missing GPS data (`null` or `undefined`) is explicitly **VALID** per emergency standards.
   - Coordinates are **NEVER fabricated** to placeholder values like `(0, 0)`.
   - Valid coordinates are bounded: Latitude `[-90, 90]`, Longitude `[-180, 180]`.

3. **Shelter Capacity Invariant**:
   $$\text{occupiedBeds} + \text{reservedBeds} \le \text{totalCapacity}$$
   Attempting to reserve or intake beds exceeding this invariant throws a `ShelterDomainError`.

4. **Resource Allocation Bound**:
   $$\text{quantityAllocated} \le \text{quantityAvailable}$$
   Over-allocation is strictly prohibited. Resources are returned to the pool upon mission cancellation.

5. **Atomic Volunteer Assignment**:
   - An emergency request cannot have multiple non-terminal tasks concurrently.
   - A volunteer cannot be dispatched to multiple concurrent in-flight missions (`accepted`, `in_transit`, `at_scene`).

6. **Medical Privacy & Geographic Obfuscation**:
   - Confidential medical notes (`confidentialMedicalDetails`) are accessible only to coordinators and the specifically assigned field responder.
   - Public unauthenticated views receive obfuscated coordinates (rounded to 3 decimal places / ~500m) and sanitized summaries.

---

## 6. Offline Synchronization Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as Citizen / Responder
    participant UI as Presentation (React)
    participant Repo as EmergencyRequestRepository
    participant IDB as IndexedDB (resqlink_offline_db)
    participant Queue as SyncQueueManager
    participant Adapter as ExpressApiAdapter
    participant Server as Express Remote API (/api/*)

    User->>UI: Submit SOS / Action
    UI->>Repo: save(validatedEntity)
    Repo->>IDB: put(entity) [Instant local write]
    UI->>Queue: enqueue('emergency_request', entityId, 'create', payload, idempotencyKey)
    Queue->>IDB: put(queueItem) [Status: 'pending']
    UI-->>User: Instant optimistic confirmation

    alt Browser is Online
        Queue->>Adapter: isAvailable()
        Adapter->>Server: GET /api/health
        Server-->>Adapter: 200 OK
        Queue->>Queue: mark item 'in_flight'
        Queue->>Adapter: pushQueueItem(queueItem)
        Adapter->>Server: POST /api/sync/request (X-Idempotency-Key)
        Server-->>Adapter: 200 { ok: true, version }
        Adapter-->>Queue: { success: true, serverAckTimestamp }
        Queue->>IDB: delete(queueItemId)
        Queue->>Repo: mark syncStatus = 'synced'
        Queue-->>UI: emit SyncStatusEvent(state: 'idle', pendingCount: 0)
    else Browser is Offline / Server Unreachable
        Adapter-->>Queue: Network Error / Timeout
        Queue->>Queue: retryCount++, status = 'pending'
        Queue->>Queue: calculate exponential backoff (1s, 2s, 4s, 8s...)
        Queue-->>UI: emit SyncStatusEvent(state: 'offline', pendingCount: N)
    end
```

---

## 7. Storage Schema (`resqlink_offline_db`)

| Object Store | Primary Key | Indices |
| :--- | :--- | :--- |
| `emergency_requests` | `id` | `incidentId`, `status`, `severity`, `createdAt`, `syncStatus`, `idempotencyKey` |
| `volunteers` | `id` | `availabilityStatus`, `updatedAt` |
| `resource_offers` | `id` | `category`, `status`, `donorId`, `createdAt` |
| `shelters` | `id` | `status`, `name`, `updatedAt` |
| `volunteer_tasks` | `id` | `emergencyRequestId`, `volunteerId`, `status`, `createdAt` |
| `incidents` | `id` | `status`, `severity`, `type`, `createdAt` |
| `sync_queue` | `id` | `status`, `entityType`, `entityId`, `createdAt` |
| `audit_events` | `id` | `entityType`, `entityId`, `actorId`, `timestamp` |

---

## 8. Verification & Test Suite

All domain rules, capacity invariants, state machines, and synchronization queues are verified using the automated test suite (`src/tests/domain-rules.test.ts`):

- **15 passed, 0 failed** across all core invariant checks.
- Zero external test runner conflicts (executing via native Node test runner with `npx tsx`).
- 100% clean TypeScript compilation (`npm run typecheck`).
