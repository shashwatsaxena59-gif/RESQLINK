# ResQLink — Hackathon Demonstration Guide

This guide provides a step-by-step walkthrough for evaluating and demonstrating **ResQLink**, an offline-first decentralized emergency response and disaster mutual-aid platform.

---

## 1. Quick Start & Prerequisites

### 1.1 Local Server Launch
ResQLink runs with a dual-service architecture: a Vite frontend and an Express backend API.

1. **Start Vite Dev Server** (Port `5173`):
   ```bash
   npm run dev
   ```
2. **Start Express Backend API** (Port `3001`):
   ```bash
   npm run dev:server
   ```
   *Or start both concurrently:*
   ```bash
   npm run dev:all
   ```

3. Open **[http://localhost:5173](http://localhost:5173)** in your modern web browser (Chrome, Edge, Firefox, or Safari).

---

## 2. Pre-Seeded Demo Accounts

ResQLink includes 4 pre-configured operational personas covering each role in the system. You can switch personas with one click in the **Profile & Settings Modal** (click the User icon in the top header) or log in via `POST /api/auth/login`.

| Role | Persona Name | Email | Password | Assigned Scope & Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Incident Coordinator** | Chief Officer R. Sharma | `coordinator@resqlink.org` | `Coord@123` | Full Incident Commander. Unrestricted access to all shelters, unmasked medical records, audit logs, and incident declarations. |
| **Shelter Operator** | Officer K. Verma | `shelter.officer@resqlink.org` | `Shelter@123` | Authorized operator for *Rajkiya Sarvodaya Bal Vidyalaya (shelter-001)* only. Cannot modify unassigned shelters. |
| **Field Volunteer** | A. Patel | `volunteer@resqlink.org` | `Volunteer@123` | Certified responder (first aid, triage, water rescue). Views medical notes only for currently assigned missions. Cannot accept multiple active tasks concurrently. |
| **Citizen / Requester** | P. Kumar | `citizen@resqlink.org` | `Citizen@123` | Civilian evacuee. Can submit emergency SOS requests. Privileged operational commands return HTTP 403. |

---

## 3. Recommended 15-Step Demonstration Scenario

**Scenario Narrative:** A severe monsoon storm hits East Delhi (Mayur Vihar). Residents are stranded due to waterlogging and water contamination. Volunteers carry clean drinking water and medical kits, while a local shelter manages surge bed capacity.

```
[1. Open Landing Page] ──> [2. File High-Priority SOS] ──> [3. Verify Persistence]
           │
           ▼
[4. Locate Map Marker] ──> [5. Inspect Volunteer Match] ──> [6. Accept Mission]
           │
           ▼
[7. Verify Dual Dashboard] ──> [8. Complete Delivery] ──> [9. Update Shelter Beds]
           │
           ▼
[10. Verify Unified Metrics] ──> [11. Toggle Offline Mode] ──> [12. Submit Offline SOS]
           │
           ▼
[13. Confirm Outbox Retention] ──> [14. Restore Network] ──> [15. Server Acknowledgment]
```

### Step 1: Open the Landing Page
- Navigate to `http://localhost:5173`.
- Observe the command center layout: navigation bar, live summary metrics cards, active requests feed, and truthful safety disclaimers.
- Note the design system: Graphite background (`#0b0f17`), crisp off-white typography (`#f8fafc`), lime indicators (`#84cc16`), cyan accents (`#06b6d4`), and restrained emergency amber/red.

### Step 2: Submit a High-Priority SOS Request
- Click the glowing red **SOS Emergency** button in the header.
- In the drawer:
  - **Category**: Select `Medical`.
  - **Priority / Severity**: Select `Critical`.
  - **People Count**: `5`.
  - **Description**: `"Severe storm aftermath: 5 residents stranded with water contamination, lacerations needing first aid and potable water."`
  - **Location**: Enter manual location descriptor or enable GPS permission (`Pocket 1, Block C, Mayur Vihar Phase 1`).
  - **Confidential Medical Details**: `"Elderly resident with deep leg laceration; children dehydrated."`
- Click **Submit Emergency SOS**.

### Step 3: Verify Request ID, Local Persistence & Initial Status
- Verify the generated unique request ID (e.g. `req-...`).
- Observe that the request immediately appears in the emergency feed.
- Note the initial status badge: **Active** and **Saved Locally** / **Synced** depending on network status.
- Confidential medical notes are restricted server-side based on the active persona.

### Step 4: Locate Request Marker on the Interactive Map
- Switch to the **Map** tab.
- Observe the map centered on the active disaster area (e.g., Delhi NCR / Mayur Vihar).
- Locate the red emergency marker for the newly created SOS request.
- Click the marker to open the popup showing category, severity, distance in miles, and people count.

### Step 5: Inspect a Compatible Volunteer Offer
- Switch to the **Volunteers** tab.
- Inspect the AI / algorithmic matching score for volunteer **A. Patel**.
- Notice the high compatibility score (>= 70%) calculated from:
  - Skill alignment (`first_aid`, `triage`, `water_rescue`).
  - Proximity to Mayur Vihar (< 1.0 mile).
  - Severity priority weighting.

### Step 6: Accept Eligible Task as Volunteer
- Click **Accept Mission** on the candidate task.
- The system verifies the single-active-mission constraint:
  - The volunteer is assigned to the task.
  - 5 units of potable water from the East Delhi Seva Trust resource offer are allocated atomically.
  - Attempting to accept a second concurrent mission will display a clear warning.

### Step 7: Verify Dual View (Volunteer Dashboard & Coordinator Feed)
- In the Volunteer Portal, view the active mission in the **My Active Tasks** tab with ETA, patient notes, and navigation buttons.
- Switch personas to **Incident Coordinator** in the Profile Modal.
- Open the **Command Center** tab: observe the task transition to `assigned` in the live triage feed.

### Step 8: Complete Fictional Delivery & Confirm Statuses
- In the Volunteer Portal, step through the mission progression:
  1. Click **Start Transit** (status: `in_transit`).
  2. Click **Arrived at Scene** (status: `at_scene`).
  3. Click **Complete Delivery** (status: `completed`).
- Verify that the emergency request status automatically transitions to **Fulfilled / Resolved**.

### Step 9: Update Shelter Occupancy & Inventory
- Switch to the **Shelters** tab.
- Locate **Rajkiya Sarvodaya Bal Vidyalaya, Mayur Vihar** (`shelter-001`).
- Switch persona to **Shelter Officer (Officer K. Verma)**.
- Perform Bed Intake:
  - Record intake of 10 storm evacuees (occupancy updates from 72 to 82).
- Update Inventory:
  - Restock 50 blankets from incoming emergency relief delivery (stock updates from 150 to 200).

### Step 10: Verify Capacity Calculation & Metrics Agreement
- Inspect the capacity math on the shelter card:
  $$\text{Available Beds} = \text{Total Capacity (100)} - (\text{Occupied (82)} + \text{Reserved (3)}) = 15$$
- Verify that the shelter directory, map shelter badge, and top Command Center metrics cards all reflect the exact same available beds count (15 beds).
- Operating status remains **Open**.

### Step 11: Simulate a Network Outage
- Open your browser's Developer Tools (F12) -> **Network** tab.
- Select **Offline** from the throttling dropdown.
- Alternatively, disable Wi-Fi/Ethernet.
- Observe the ResQLink connection badge in the header transition to **Offline** (amber indicator).

### Step 12: Create Another Emergency Request Offline & Refresh
- Click **SOS Emergency** while offline.
- Fill in:
  - **Category**: `Rescue`.
  - **Description**: `"Downed power line & flooding near Mayur Vihar Pocket 4, water level rising."`
  - **People Count**: `3`.
- Click **Submit Emergency SOS**.
- Reload / refresh the browser (Ctrl+R / F5).

### Step 13: Verify Offline Storage & Pending Status
- Upon page reload, the app re-opens immediately from Service Worker cache.
- Open the **Sync Status** modal from the header:
  - Verify that the request survives reload in IndexedDB.
  - Status is truthfully labeled **Pending Send / In Outbox** (never falsely claimed as delivered).
  - Outbox counter shows `1 Pending Operation`.

### Step 14: Restore Connectivity & Test Synchronization
- In Developer Tools -> Network tab, switch throttling back to **Online** (or **No Throttling**).
- Within seconds, the sync engine network probe confirms real internet connectivity.
- The outbox automatically drains: the pending operation is transmitted to `/api/sync/request`.
- Outbox counter drops to `0`.

### Step 15: Verify Server Confirmation Required for Remote Receipt
- Inspect the request card in the Feed:
  - The badge transitions to **Confirmed by Server** with an authentic server timestamp.
  - The server broadcast event is pushed across all active browser windows via Server-Sent Events (`/api/events`).

---

## 4. Testing the Interactive Map

1. **Multi-Entity Markers**:
   - Red: Emergency SOS requests.
   - Blue / Cyan: Relief shelters.
   - Green: Consenting field volunteers.
   - Purple / Amber: Staged resource offers.
2. **Category & Priority Filters**:
   - Use the category chips (Medical, Rescue, Water, Food) to isolate specific needs.
   - Filter by severity (Critical, Urgent, Moderate).
3. **Missing or Denied GPS**:
   - When geolocation permission is denied, the map gracefully defaults to the regional bounds (e.g. Delhi NCR) and prompts the user to enter a text landmark.
   - Distances for requests without GPS are displayed as `Location approximate / manual address` without fabricating bogus coordinates.
4. **Tile Failure & Offline Fallback**:
   - If map tiles fail to load (or while offline), a structured card list view remains available so responders can continue triage without an active tile provider.

---

## 5. How to Reset Demo Records

To restore the demo state to its clean seed data without wiping configuration:
1. Open the **Profile & Settings Modal** (User icon in header).
2. Click **Reset Demo Data**.
3. All local IndexedDB stores and mock outbox items will be re-initialized to initial disaster drill records.
4. Server stores in `server/data/*.json` can also be reset by restarting `npx tsx watch server/index.ts`.

---

## 6. Known Limitations & Operational Boundaries

1. **Not an Official 911 / 112 Dispatch Center**: ResQLink is a decentralized mutual-aid coordination tool. It is not integrated with government PSAP emergency dispatch systems.
2. **No Guaranteed Rescue**: Dispatch recommendations and volunteer availability are informational. Responder response times cannot be guaranteed.
3. **No Carrier SMS Gateway**: The application operates over Web/PWA protocols and does not include carrier-grade cellular cell-broadcast transmitters.
4. **Local Hardware GPS Accuracy**: Device location accuracy varies based on hardware and indoor obstructions. Accurate distance calculations require valid satellite or Wi-Fi triangulation.
