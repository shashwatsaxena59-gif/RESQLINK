# ResQLink — Offline PWA, IndexedDB & Sync Engine Architecture Guide

This document specifies the offline-first engineering architecture of ResQLink, detailing how the Progressive Web Application (PWA), IndexedDB local persistence engine, outbox synchronization queue, and truthful status indicators operate under austere and disconnected disaster conditions.

---

## 1. Executive Summary

During natural disasters (flash floods, earthquakes, landslides, grid blackouts), cellular towers and fiber backhauls are often severed. ResQLink is built on a **local-first, zero-data-loss invariant**:
1. Every emergency aid request, shelter capacity change, and volunteer task action is committed **synchronously to device IndexedDB** before any network operation is attempted.
2. When disconnected, operations remain safely preserved in an **offline outbox queue** with version tracking, idempotency keys, and bounded exponential backoff.
3. **Truthful telemetry**: A request created locally is never misrepresented as remotely acknowledged until a verified server response (`200 OK` with server timestamp) is received.
4. **Resilient App Shell**: The web application manifest, service worker, vector maps, and application shell allow reopening and full interaction without an active internet connection.

---

## 2. PWA & Service Worker Architecture

### 2.1 Web App Manifest (`public/manifest.json`)
- **Installability**: Declares `display: "standalone"`, `start_url: "/"`, `scope: "/"`, theme colors (`#0c1827`), categories (`["utilities", "emergency", "medical", "social"]`), and emergency shortcuts (`Emergency SOS`, `Shelter Directory`, `Command Center`).
- **Icons**: Provides high-contrast tactical SVG and PNG icons at 192×192, 512×512, and maskable formats (`public/icons/`).
- **Install Prompt Controller**: Managed via `src/pwa/pwa-manager.ts`, capturing `beforeinstallprompt` and exposing a 1-click install action in the connectivity telemetry modal.

### 2.2 Application Shell Caching (`public/sw.js`)
- **Cache Versioning**: Strictly versioned under `resqlink-static-resqlink-v1.0.0` and `resqlink-dynamic-resqlink-v1.0.0`. Obsolete caches are automatically evicted during the `activate` lifecycle hook (`caches.delete`).
- **Navigation Requests (`request.mode === 'navigate'`)**: Network-first with immediate cache fallback to precached `/index.html`, ensuring the previously visited application reopens instantly when offline.
- **Static Assets (JS, CSS, SVGs, Fonts, GeoJSON)**: Cache-first with background revalidation (`stale-while-revalidate`).
- **Security & Privacy Invariant**: **Never caches sensitive user-specific API responses** in shared browser caches. Endpoints matching `/api/auth`, `/api/confidential`, `/api/medical`, `/api/sync`, `/api/rescue-tasks`, and `/supabase/` bypass caching completely and pass directly to the network and client IndexedDB engine.

---

## 3. Local Database (IndexedDB v2 & Safe Migrations)

IndexedDB persistence is managed via `src/storage/indexeddb/indexed-db.ts` and `schema.ts`.

### 3.1 Object Stores
| Store Name | Key Path | Primary Indices | Purpose |
| :--- | :--- | :--- | :--- |
| `emergency_requests` | `id` | `incidentId`, `status`, `severity`, `createdAt`, `syncStatus`, `idempotencyKey` | Offline emergency SOS aid requests. |
| `shelters` | `id` | `status`, `name`, `updatedAt` | Cached shelter records, bed capacity, and inventories. |
| `volunteers` | `id` | `availabilityStatus`, `updatedAt` | Registered volunteers, responder skills, and consent. |
| `volunteer_tasks` | `id` | `emergencyRequestId`, `volunteerId`, `status`, `createdAt` | Responders dispatched to aid requests. |
| `resource_offers` | `id` | `category`, `status`, `donorId`, `createdAt` | Community supply and equipment offers. |
| `incidents` | `id` | `status`, `severity`, `type`, `createdAt` | Active disaster incidents and geographic boundaries. |
| `sync_queue` | `id` | `status`, `entityType`, `entityId`, `createdAt`, `idempotencyKey` | Outgoing operations outbox awaiting remote dispatch. |
| `sync_metadata` | `entityId` | `entityType`, `hasUnsyncedChanges`, `lastSyncedAt` | Entity version tracking and conflict state detection. |
| `audit_events` | `id` | `entityType`, `entityId`, `actorId`, `timestamp` | Immutable local operational audit log. |

### 3.2 Schema Versioning & Safe Migration Guarantee
- **Database Version**: `DB_VERSION = 2`.
- **Migration Runner (`runMigrations`)**: Executed inside `IDBOpenDBRequest.onupgradeneeded`.
- **Safety Invariant**: Stores declared in `PROTECTED_STORES` (`emergency_requests`, `sync_queue`) are **never deleted or dropped during an upgrade**. Migrations safely create missing stores and indices on existing stores without touching pending SOS records.

---

## 4. Synchronization Queue Engine

Managed by `SyncQueueManager` (`src/sync/sync-queue.ts`).

### 4.1 Outgoing Operation Data Model
Every outgoing queue item contains:
- `id`: Unique operation UUID (`op-<timestamp>-<hash>`).
- `operationId`: Alias for `id`.
- `entityId`: Identifier of the target record.
- `entityType`: `'emergency_request' | 'volunteer' | 'resource_offer' | 'shelter' | 'volunteer_task' | 'incident'`.
- `action` / `operationType`: `'create' | 'update' | 'delete'`.
- `payload`: Exact mutation payload.
- `idempotencyKey`: Client-assigned unique deduplication key.
- `clientTimestamp` / `createdAt`: ISO 8601 UTC creation time.
- `updatedAt`: ISO 8601 UTC last modification time.
- `attemptCount` / `retryCount`: Count of attempted transmissions.
- `maxAttempts`: Maximum retry attempts before transitioning to permanent failure (default 5).
- `nextAttemptAt`: ISO 8601 UTC timestamp calculated via bounded exponential backoff.
- `status`: Synchronization lifecycle state (`'pending' | 'synchronizing' | 'confirmed_by_server' | 'failed' | 'conflict'`).
- `baseVersion`: Client entity version when operation was authored.
- `serverVersion`: Latest known remote version.
- `lastError`: Error description if previous transmission failed.
- `serverAckTimestamp`: Verified remote timestamp upon successful acknowledgment.

### 4.2 Duplicate Prevention & Coalescing
- When `enqueue()` is invoked, it checks `syncQueueRepo.findByIdempotencyKey(key)`. If an item exists, it returns the existing queue item without inserting duplicates.
- If a pending `update` exists for an entity already in the outbox, the payload and `updatedAt` are merged, keeping the outbox lean.

### 4.3 Bounded Exponential Backoff
- Formula: $\text{delay} = \min(\text{maxMs}, \text{baseMs} \times 2^{\text{attemptCount} - 1}) + \text{jitter}$, with base delay $1\,000\,\text{ms}$, cap $30\,000\,\text{ms}$, and $10\%$ random jitter.
- During queue processing, items whose `lastAttemptAt` has not exceeded the backoff delay are skipped.

### 4.4 Truthful Connectivity Probing
- **Invariant**: The sync engine **never assumes the network is usable just because `navigator.onLine === true`** (guarding against captive portals, dead Wi-Fi hotspots, or carrier wall gardens).
- Before processing any queue items, `adapter.isAvailable()` probes a lightweight `/api/health` endpoint. If the probe fails, the state transitions to `offline` and outbox items remain untouched.

### 4.5 Permanent Failure Handling & User-Controlled Retry
- Client 4xx unrecoverable HTTP errors (400, 403, 404, 422) or reaching `maxAttempts` marks the operation status as `'failed'` (`permanentError: true`).
- Failed operations are displayed in `SyncStatusModal` with error details, an individual **"Retry"** button (`syncQueueManager.retryOperation(id)`), and a **"Retry All Failed"** button (`syncQueueManager.retryAllFailed()`).

### 4.6 Conflict Detection & Stale Edit Protection
- When an operation is sent to the server (or simulated adapter), if the client's `baseVersion` is strictly lower than the server's current version (or server returns `409 Conflict`), the operation transitions to `'conflict'`.
- Stale offline edits **never silently overwrite newer data**.
- The user is presented with two explicit review choices:
  - **Keep Local**: Re-bases the local mutation onto the new remote version and forces re-transmission.
  - **Accept Remote**: Discards the stale local change and fetches the latest confirmed remote record.

---

## 5. Truthful Status Indicators

ResQLink strictly enforces 6 truthful status indicators across all cards, modals, and tables:

| Truthful State | UI Label | Badge Color / Icon | Meaning |
| :--- | :--- | :--- | :--- |
| `saved_locally` | **Saved locally** | Slate / `HardDrive` | Record written to IndexedDB. Not yet transmitted. |
| `waiting_to_sync` / `pending` | **Waiting to sync** | Amber / `Clock` | Enqueued in outbox. Waiting for connectivity probe or backoff window. |
| `synchronizing` / `in_flight` | **Synchronizing** | Sky / `RefreshCw` (spin) | HTTP request currently in-flight to remote endpoint. |
| `confirmed_by_server` / `synced`| **Confirmed by server** | Emerald / `CheckCircle2` | **Verified remote acknowledgment received** with server timestamp. |
| `failed` | **Failed** | Rose / `AlertTriangle` | Max retries exceeded or 4xx error. User review & manual retry required. |
| `conflict` | **Conflict requires review** | Purple / `AlertCircle` | Remote version evolved ahead of client edit. User action required. |

> [!IMPORTANT]
> **Strict Operational Invariant**: An emergency request created offline will **never appear remotely acknowledged (`acknowledged = true`)** until a verified backend server response is confirmed.

---

## 6. Offline Map Behavior & Graceful Fallbacks

1. **Cached Data**: Previously loaded emergency requests, shelter locations, volunteer consents, and GeoJSON vector assets (roads, rivers, flood zones, landslide zones for Badrinath/Joshimath and Delhi NCR) are bundled and cached in local memory.
2. **Offline Leaflet Markers**: Markers use inline SVG data URIs (`data:image/svg+xml;utf8,...`), removing external dependencies on `unpkg.com` or third-party image CDNs.
3. **Tile Service Unavailable Notice**: When running offline or when satellite/street tiles cannot be retrieved, a prominent banner appears:
   > *"Offline Mode Active: Online satellite tiles and turn-by-turn routing services are unavailable. Local cached vector data and saved disaster records remain accessible."*
4. **1-Click Accessible List Alternative**: The banner provides an immediate button to toggle into the **Accessible List View**, displaying all requests, shelters, and coordinates sorted by proximity without needing map tiles.
5. **Routing Fallback**: When the OSRM routing service is unreachable, `fetchRoute()` falls back to a straight-line Haversine distance with an explicit safety notice: it **never fabricates turn-by-turn maneuvers or represents straight-line paths as driving/walking routes**.

---

## 7. Capability Matrix: Offline vs. Online vs. Browser Support

| Capability | Completely Offline | Online Verified | Browser Dependency / Fallback |
| :--- | :---: | :---: | :--- |
| **PWA Launch from Home Screen / Desktop** | ✅ Works | ✅ Works | Supported in all modern browsers (Chromium, Safari, Firefox). |
| **Emergency SOS Creation & Persistence** | ✅ Works (IndexedDB) | ✅ Works | IndexedDB supported across 100% of modern browsers. |
| **Shelter Directory & Capacity Inspection** | ✅ Works (Cached) | ✅ Works (Live) | Real-time capacity syncs when online. |
| **Volunteer Task Review & Local Assignment** | ✅ Works | ✅ Works | Dispatched state syncs upon reconnection. |
| **Vector Map Viewing (Badrinath & NCR)** | ✅ Works (GeoJSON) | ✅ Works | Leaflet vector layers bundled in app shell. |
| **Satellite / Raster Map Tiles** | ❌ Unavailable | ✅ Works | Requires network connectivity. Displays offline notice. |
| **Turn-by-Turn Route Navigation** | ❌ Straight-Line Fallback | ✅ Works (OSRM) | Offline mode provides safe straight-line distance & bearing. |
| **Background Sync Execution** | ⚠️ Queued in Outbox | ✅ Flushed | **Chromium**: Background Sync API (`registration.sync.register`).<br>**Firefox/Safari/iOS**: Seamless fallback to foreground sync on `online`, `visibilitychange`, `focus`, and polling timer. |
| **Server Acknowledgment & Cloud Dispatch** | ⚠️ Waiting to sync | ✅ Confirmed by server | Strict invariant: confirmed badges only after verified response. |
| **Conflict Detection & Rebase** | ✅ Preserved locally | ✅ Reconciled | Local version compared against server version. |

---

## 8. Verification & Test Suite Summary

All 75 automated unit and invariant tests execute cleanly via `npx tsx --test src/tests/run-all.ts`:
- `src/tests/domain-rules.test.ts` (15 tests): Coordinate validity, capacity bounds, and lifecycle rules.
- `src/tests/sos-workflow.test.ts` (9 tests): SOS submission, offline persistence, and simulated refresh.
- `src/tests/geo-and-map.test.ts` (13 tests): Haversine distance, bearing calculations, and routing fallbacks.
- `src/tests/volunteer-matching.test.ts` (11 tests): Responder scoring, distance clamping, and skill compatibility.
- `src/tests/shelter-operations.test.ts` (11 tests): Capacity invariants, intake, reservations, and inventory.
- `src/tests/command-center-operations.test.ts` (5 tests): Operational dashboard metrics, map clustering, and privacy.
- `src/tests/pwa-and-sync.test.ts` (11 tests):
  * Web app manifest installability.
  * Service worker versioning & sensitive API exclusion.
  * IndexedDB v1 $\to$ v2 safe migration (never deleting pending SOS requests).
  * Truthful status indicator mappings.
  * Network probe verification (captive portal rejection).
  * Duplicate operation idempotency deduplication.
  * Bounded exponential backoff delay bounds.
  * Permanent failure states & user retry.
  * Stale offline edit conflict detection & user resolution.
  * Non-Background Sync browser fallback.
  * Offline map straight-line fallback with safety notice.
