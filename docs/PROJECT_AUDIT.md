# ResQLink — Master Codebase Audit

**Date:** October 2026  
**Auditor:** Senior Full-Stack Engineer, Software Architect, UI/UX Designer, PWA Engineer & QA Lead  
**Repository:** ResQLink Emergency Response Platform  
**Target Environment:** Node.js v24+, Vite 5.4+, React 18.3+, TypeScript 5.5+, Tailwind CSS 3.4+

---

## 1. Executive Summary

ResQLink is an emergency disaster-response and neighborhood resource-matching application built with a high-performance modern web stack. It currently features an impressive offline-first vector map architecture (using Leaflet and custom GeoJSON vector styling), dual-region disaster datasets (Delhi NCR and Badrinath/Joshimath), an AI-assisted triage parser (with offline rule-based fallback and optional Gemini backend), an Express local synchronization server, and an initial NGO/volunteer rescue workflow.

However, an exhaustive audit reveals critical architectural gaps that prevent it from functioning as a true offline-first, production-grade Progressive Web App (PWA) connecting the four mandatory stakeholder groups:
1. **PWA & Service Worker are completely absent**: No Web App Manifest (`manifest.json`), no Service Worker, no runtime cache strategies, and no application shell caching.
2. **Storage is constrained to synchronous `localStorage`**: No IndexedDB implementation exists. The "offline queue" is held in `localStorage` and merely wiped after a 2.5-second timer when online rather than transactionally flushed to the server.
3. **Hardcoded client-side networking endpoints**: Components (`triage-panel.tsx`, `help-bot.tsx`, `ngo-dashboard.tsx`) contain hardcoded `http://localhost:3001` URLs, breaking functionality when accessed from mobile devices over LAN or in production.
4. **Volunteer offers and shelter operations are incomplete or static**: The volunteer offer panel depends exclusively on Supabase with zero local/offline fallback (failing when Supabase keys are missing), while shelter bed capacity and inventory are read-only mock data with no management or dispatch capabilities.
5. **Lack of dedicated role-based entry**: Users land directly on the map/feed without a clear onboarding flow to guide Requesters, Volunteers, Shelter Managers, or Coordinators to their respective workflows.
6. **Geospatial distances are static mock numbers**: Distance calculations are hardcoded in mock records rather than dynamically calculated using real Haversine spherical trigonometry from the user's actual GPS or selected point of interest.

This audit provides a comprehensive breakdown of the existing architecture, files, dependencies, capabilities, deficiencies, and security considerations.

---

## 2. Tech Stack & Dependency Audit

### 2.1 Core Frameworks & Tooling
| Component | Technology | Version | Audit Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v24.21.0 | Compatible | Modern LTS environment |
| **Package Manager** | npm | 11.19.0 | Compatible | Lockfile v3 in place (`package-lock.json`) |
| **Build Tool** | Vite | 5.4.8 | Functional | Fast HMR, production build compiles in ~52s |
| **Language** | TypeScript | 5.5.3 | Strict & Valid | `tsc --noEmit` passes with 0 errors |
| **UI Library** | React & React DOM | 18.3.1 | Functional | Concurrent features supported |
| **CSS Framework** | Tailwind CSS | 3.4.13 | Functional | Configured with custom CSS variables & HSL themes |
| **Animation** | Framer Motion | 14.1.0 | Functional | Smooth spring physics & entrance animations |
| **Icons** | Lucide React | 0.446.0 | Functional | High-performance SVG icons |

### 2.2 Installed Libraries Evaluation
- **UI System (`@radix-ui/*`, `class-variance-authority`, `tailwind-merge`)**: Full suite of accessible Radix primitives (Dialog, Sheet, Select, Tabs, Dropdown, Slider, etc.). Cleanly encapsulated in `src/components/ui/`.
- **Mapping (`leaflet`, `react-leaflet`, `leaflet.markercluster`)**: Leaflet 1.9.4 and MarkerCluster 1.5.3 installed. Leaflet is used directly via refs rather than declarative React-Leaflet in `map-view.tsx` to achieve fine-grained control over custom vector canvas panes.
- **Charts & 3D (`recharts`, `three`, `@react-three/fiber`, `@react-three/drei`)**: Recharts and Three.js are available. Recharts is ready for operations analytics; Three.js is partially referenced for 3D card tilt effects.
- **Backend & Cloud (`@supabase/supabase-js`, `@google/genai`, `express`, `cors`, `tsx`)**: Supabase client is present in `src/lib/supabase.ts`. Express backend in `server/index.ts` provides multi-device sync, NGO rescue workflow, and Gemini proxying.
- **Missing Critical Dependencies**:
  - `idb` or native IndexedDB wrapper: Not installed (storage currently relies on raw `localStorage`).
  - `vite-plugin-pwa`: Not installed.
  - Test runner (`vitest`): Not installed.

---

## 3. Configuration & Entry Point Audit

### 3.1 Vite Configuration (`vite.config.ts`)
- **Strengths**: 
  - Path alias `@` maps cleanly to `./src`.
  - Dev server proxy forwards `/api` requests to `http://localhost:3001`.
  - Dev server listens on `0.0.0.0` (`host: true`), enabling mobile LAN access.
- **Deficiencies**:
  - Missing PWA plugin configuration (`vite-plugin-pwa` or custom service worker build step).
  - Production build generates a single monolithic chunk (`1,184 kB index.js`), exceeding the 500 kB chunk warning threshold. Code splitting via `build.rollupOptions.output.manualChunks` is needed.

### 3.2 HTML & PWA Assets (`index.html`)
- **Strengths**: Proper viewport configuration with `viewport-fit=cover`, dark theme color, and descriptive metadata tags.
- **Deficiencies**:
  - `/vite.svg` referenced in `<link rel="icon">` does not exist (causes 404).
  - No `<link rel="manifest">` for PWA installation.
  - No `apple-touch-icon` or maskable icons for iOS/Android home-screen installs.
  - No Service Worker registration script.

### 3.3 TypeScript Configuration (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`)
- **Strengths**: Strict type checking enabled (`strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`). Clean separation between application files (`tsconfig.app.json`) and tooling/Vite config (`tsconfig.node.json`).
- **Deficiencies**: None. Typecheck passes cleanly.

### 3.4 Tailwind & Theme Configuration (`tailwind.config.js`, `src/index.css`)
- **Strengths**: Comprehensive token system supporting deep dark mode and high-contrast light mode with disaster-specific semantic tokens:
  - `--alert` (red / critical)
  - `--warning` (amber / urgent)
  - `--info` (sky / moderate)
  - `--success` (emerald / safe / operational)
- Glassmorphic backdrop filters and custom elevation tokens (`shadow-[0_8px_32px_rgba(0,0,0,0.4)]`).

---

## 4. Architectural & Component Audit

### 4.1 Root Orchestration (`src/App.tsx`)
`App.tsx` serves as the central hub:
- **Strengths**:
  - Manages active region (`ncr` vs `badrinath`).
  - Merges static regional mock requests with custom user-created requests.
  - Hosts modal sheets for SOS, AI Triage, Shelter directory, Find Help, Offer Help, Volunteer Registration, NGO Login, and NGO/Volunteer dashboards.
  - Provides dual-view layout: 3D perspective dashboard on desktop, tabbed layout (`map`, `feed`, `shelters`) on mobile.
- **Deficiencies**:
  - God-component pattern: `App.tsx` is over 610 lines and manages 16+ separate boolean modal flags directly.
  - No URL route-based or role-based landing screen: users are thrust immediately into a busy disaster map without choosing their role (Victim, Volunteer, Shelter Manager, Coordinator).
  - Coordinates parsing logic (`handleEnqueue`) contains arbitrary magic offsets and falls back to approximate region centers.

### 4.2 State Management & Networking Hooks
1. **`useNetwork` & `useOfflineQueue` (`src/hooks/use-network.ts`)**:
   - *Status*: **FLAWED & INCOMPLETE**
   - *Issue 1*: Network status is driven purely by a manual toggle stored in `localStorage`. It does not listen to browser `navigator.onLine` or window events (`online`, `offline`).
   - *Issue 2*: Offline queue is stored in `localStorage` under `resqlink-offline-queue`.
   - *Issue 3*: Lines 75–81 simulate sync by running `setTimeout(() => setQueue([]), 2500)`. It deletes the queue without ever dispatching HTTP requests to the backend! This violates the core rule: *"Never report a request as remotely delivered when it is only stored locally."*
2. **`useCrossDeviceSync` (`src/hooks/use-cross-device-sync.ts`)**:
   - *Status*: **FUNCTIONAL WITH CAVEATS**
   - *Strengths*: Employs `BroadcastChannel('resqlink-sync-v1')` for multi-tab synchronization and polls `/api/sync` every 2.5s.
   - *Deficiencies*: Polling is unthrottled during user inactivity; does not use WebSockets or Server-Sent Events; lacks exponential backoff when the server is unreachable.
3. **`useVolunteerOffers` (`src/hooks/use-volunteer-offers.ts`)**:
   - *Status*: **PARTIAL / FAILS OFFLINE**
   - Coupled entirely to Supabase. If `isSupabaseConfigured` is false, it returns empty arrays and throwing errors on offer submission, rendering the offer module completely dead in local or offline mode.
4. **`useVolunteers` (`src/hooks/use-volunteers.ts`)**:
   - *Status*: **FUNCTIONAL THREE-TIER FALLBACK**
   - Correctly attempts Supabase -> Express `/api/volunteer/register` -> `localStorage`.

### 4.3 Component-by-Component Review
| Component | Primary Function | Current State | Deficiencies to Address |
| :--- | :--- | :--- | :--- |
| **`TopNav`** | Header navigation, status pill, theme switcher, quick action buttons | Working | Cluttered on tablet; needs clear Role Switcher |
| **`StatusBanner`** | Incident counters, region selector, category chips | Working | Category counts are static; needs dynamic sync counters |
| **`MapView`** | Vector-rendered disaster map with hazard layers & clusters | Working (High Quality) | Distance to markers is static; needs dynamic Haversine calculation from user GPS |
| **`LiveFeed`** | Incident list, AI triage badges, resolve/help actions, outbox drawer | Working | Outbox needs transactional retry controls; requests need timeline history |
| **`SosDrawer`** | Emergency SOS form with GPS locator & voice input | Working | Needs offline queuing to IndexedDB; needs contact validation and tracking ID generation |
| **`TriagePanel`** | Emergency message triage (English, Hindi, Hinglish) | Working | Contains hardcoded `http://localhost:3001`; needs relative `/api/triage` |
| **`ShelterWidget`** | Shelter list, capacity stats, navigation launcher | Read-only Static UI | No shelter manager mode to update occupied bed count or inventory supplies |
| **`FindHelpPanel`** | Searchable directory of hospitals, food points, water | Working | Uses static mock data; needs dynamic nearby distance recalculation |
| **`OfferHelpPanel`** | Form to offer resources, goods, and assistance | Non-functional without Supabase | Fails in local/offline environment; needs IndexedDB + local API fallback |
| **`VolunteerRegistrationModal`** | Volunteer onboarding form with skills & location consent | Working | Works via localStorage/Express; needs direct tie-in to neighborhood task matching |
| **`NgoDashboard`** | Coordinator panel for NGO tasks, volunteer rosters | Working | Sheet modal; needs full-screen Coordinator Operations Dashboard option; hardcoded URL on line 218 |
| **`VolunteerRescueDashboard`** | NGO volunteer mission dashboard (accept/start/complete) | Working | Designed for NGO members; independent volunteers need a matching board |
| **`HelpBot`** | Context-aware AI disaster safety assistant | Working | Hardcoded `http://localhost:3001` URL; needs relative path |
| **`MobileNav`** | Bottom tab navigation for mobile viewports | Working | Lacks badge counts for pending outbox items and active missions |

---

## 5. Backend & Server Audit (`server/index.ts`)

The Express server (`server/index.ts`, port 3001) implements:
- Shared memory + JSON persistence (`sync-store.json`, `ngo-store.json`).
- Atomic task assignment with pessimistic locking (`/api/rescue-tasks/:taskId/assign`).
- Full rescue lifecycle: `AVAILABLE` -> `ASSIGNED` -> `IN_PROGRESS` -> `AWAITING_CONFIRMATION` -> `RESCUED` / `CANCELLED`.
- Google Gemini 2.0 Flash integration for safety assistance (`/api/chat`) and structured emergency triage (`/api/triage`).
- Public volunteer registration fallback (`/api/volunteer/register`).

**Backend Deficiencies**:
1. No endpoints exist for Shelter inventory management (updating beds, logging water, food, medicine).
2. No endpoints exist for Volunteer Resource Offers (creating, claiming, fulfilling offers without Supabase).
3. The server runs as a separate process; setup requires manual `cd server && npm install`.

---

## 6. Security, Privacy & Data Integrity Audit

1. **Location Privacy**:
   - Geolocation is only requested upon explicit user interaction ("Detect GPS" button).
   - In accordance with the prompt rules: Unknown locations must NEVER be hardcoded to `(0, 0)`. Regional fallback centroids are used instead.
   - Exact user coordinates must be fuzzable/coarsenable for public feeds to protect victim safety in vulnerable disaster zones.
2. **Credential Safety**:
   - `server/.env` is excluded in `.gitignore`.
   - Frontend accesses Gemini strictly through the Express proxy; API keys are never bundled in browser code.
   - Supabase client gracefully defaults to mock placeholders when environment variables are omitted.
3. **Data Integrity & Simulated Data**:
   - Bundled mock data must be explicitly labeled so emergency responders do not mistake test drills for real-world incidents.
   - Outbox requests must clearly show their transmission state: `QUEUED_OFFLINE`, `TRANSMITTING`, `SYNCED_REMOTE`, or `FAILED`.

---

## 7. Audit Summary: What Works vs What Needs Work

| Area | What Works | What is Incomplete / Broken |
| :--- | :--- | :--- |
| **Build & Tooling** | Vite build, strict TypeScript, Tailwind, Lucide icons | Monolithic bundle chunking, missing PWA plugin |
| **Entry & UX** | Responsive layout, dark mode, top/mobile navigation | No role-based landing entry or guided role switcher |
| **Map & Geospatial** | Vector offline map, GeoJSON roads/rivers/hazards, marker clusters | Distances are static; no dynamic Haversine distance calculations |
| **Emergency SOS** | Form validation, GPS grabber, voice-to-text input | Outbox queue is fake-synced; no IndexedDB; no tracking screen |
| **Volunteers** | Registration modal, NGO member rescue dashboard | Neighborhood volunteer offers fail without Supabase; no offer fulfillment flow |
| **Shelters** | Directory listing, occupancy percentage bar, directions button | Read-only; cannot update bed counts or manage supply inventory |
| **Operations Center** | NGO Sheet dashboard with task assignment | Needs full Emergency Operations Dashboard (EOD) for incident commanders |
| **Offline & Storage** | LocalStorage persistence of user requests | No IndexedDB; no Service Worker; no app shell caching |
| **Networking** | Multi-tab BroadcastChannel, Express sync endpoints | Manual network toggle only; hardcoded `localhost:3001` URLs |
