import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { AppNav } from '@/components/app-nav';
import { LandingPage } from '@/components/landing-page';
import type { MapRegion } from '@/components/map-view';
import { EmergencySosDrawer } from '@/components/emergency-sos-drawer';
import type { EmergencyRequest } from '@/domain/models/emergency-request';
import { useShelterStore } from '@/hooks/use-shelter-store';
import type { AuthUser } from '@/auth/permissions';
import { MobileNav } from '@/components/mobile-nav';
import { useNetwork, useOfflineQueue } from '@/hooks/use-network';
import { useVolunteerOffers } from '@/hooks/use-volunteer-offers';
import { useTheme } from '@/hooks/use-theme';
import { REGION_DATA } from '@/mockData';
import type { RegionKey } from '@/mockData';
import type {
  FilterCategory,
  AidRequest,
  RequestCategory,
  RequestStatus,
  AppNavRoute,
  UserRole,
} from '@/types';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import type { NavDestination } from '@/hooks/use-navigation';
import { useCrossDeviceSync } from '@/hooks/use-cross-device-sync';
import {
  getNgoSession,
  getVolunteerSession,
  clearNgoSession,
  clearVolunteerSession,
} from '@/lib/ngo-auth';
import type { NgoProfile, VolunteerMember } from '@/types';

// ── Lazy-loaded secondary views for instant initial page startup ──
const OperationsDashboardView = lazy(() =>
  import('@/components/operations-dashboard-view').then((m) => ({ default: m.OperationsDashboardView }))
);
const EmergencyMapPage = lazy(() =>
  import('@/components/emergency-map-page').then((m) => ({ default: m.EmergencyMapPage }))
);
const VolunteerPortalView = lazy(() =>
  import('@/components/volunteer-portal-view').then((m) => ({ default: m.VolunteerPortalView }))
);
const ShelterDirectoryView = lazy(() =>
  import('@/components/shelter-directory-view').then((m) => ({ default: m.ShelterDirectoryView }))
);
const NgoDashboard = lazy(() =>
  import('@/components/ngo-dashboard').then((m) => ({ default: m.NgoDashboard }))
);
const VolunteerRescueDashboard = lazy(() =>
  import('@/components/volunteer-rescue-dashboard').then((m) => ({ default: m.VolunteerRescueDashboard }))
);
const NgoLoginModal = lazy(() =>
  import('@/components/ngo-login-modal').then((m) => ({ default: m.NgoLoginModal }))
);
const HelpBot = lazy(() =>
  import('@/components/help-bot').then((m) => ({ default: m.HelpBot }))
);
const TriagePanel = lazy(() =>
  import('@/components/triage-panel').then((m) => ({ default: m.TriagePanel }))
);
const ShelterWidget = lazy(() =>
  import('@/components/shelter-widget').then((m) => ({ default: m.ShelterWidget }))
);
const FindHelpPanel = lazy(() =>
  import('@/components/find-help-panel').then((m) => ({ default: m.FindHelpPanel }))
);
const OfferHelpPanel = lazy(() =>
  import('@/components/offer-help-panel').then((m) => ({ default: m.OfferHelpPanel }))
);
const VolunteerRegistrationModal = lazy(() =>
  import('@/components/volunteer-registration-modal').then((m) => ({ default: m.VolunteerRegistrationModal }))
);
const SyncStatusModal = lazy(() =>
  import('@/components/sync-status-modal').then((m) => ({ default: m.SyncStatusModal }))
);
const ProfileSettingsModal = lazy(() =>
  import('@/components/profile-settings-modal').then((m) => ({ default: m.ProfileSettingsModal }))
);
const RequestDetailsModal = lazy(() =>
  import('@/components/request-details-modal').then((m) => ({ default: m.RequestDetailsModal }))
);

const ViewFallback = () => (
  <div className="flex-1 flex items-center justify-center min-h-[50vh]">
    <div className="flex flex-col items-center gap-3 text-muted-foreground animate-pulse">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="text-xs font-mono tracking-wider uppercase">Loading tactical view...</span>
    </div>
  </div>
);

function App() {
  const { status, toggle, isOnline } = useNetwork();
  const { queue, enqueue, clearQueue, removeFromQueue, queueCount } = useOfflineQueue(isOnline);
  const { offers, loading: offersLoading, error: offersError, createOffer } = useVolunteerOffers();
  const { theme, toggle: toggleTheme } = useTheme();

  // Navigation & User Role state
  const [currentRoute, setCurrentRoute] = useState<AppNavRoute>('home');
  const [userRole, setUserRole] = useState<UserRole>('citizen');
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [filter, setFilter] = useState<FilterCategory>('all');
  const [region, setRegion] = useState<MapRegion>('ncr');
  const [sosOpen, setSosOpen] = useState(false);
  const [shelterOpen, setShelterOpen] = useState(false);
  const [findHelpOpen, setFindHelpOpen] = useState(false);
  const [offerHelpOpen, setOfferHelpOpen] = useState(false);
  const [volunteerRegOpen, setVolunteerRegOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestDetailsOpen, setRequestDetailsOpen] = useState(false);
  const [detailsRequestId, setDetailsRequestId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'map' | 'feed' | 'shelters'>('map');
  const [navDest, setNavDest] = useState<NavDestination | null>(null);

  // ── NGO / Rescue Management state ─────────────────────────────────────────
  const [ngoLoginOpen, setNgoLoginOpen] = useState(false);
  const [ngoDashOpen, setNgoDashOpen] = useState(false);
  const [volunteerDashOpen, setVolunteerDashOpen] = useState(false);
  const [ngoSession, setNgoSessionState] = useState<Omit<NgoProfile, 'passwordHash'> | null>(
    () => getNgoSession()?.ngo ?? null
  );
  const [volunteerSession, setVolunteerSessionState] = useState<{
    volunteer: VolunteerMember;
    ngoId: string;
    ngoName: string;
  } | null>(() => {
    const s = getVolunteerSession();
    return s ? { volunteer: s.volunteer, ngoId: s.ngoId, ngoName: s.ngoName } : null;
  });

  // Sync session state when localStorage changes
  function refreshSessionState() {
    const ngo = getNgoSession();
    const vol = getVolunteerSession();
    setNgoSessionState(ngo?.ngo ?? null);
    setVolunteerSessionState(
      vol ? { volunteer: vol.volunteer, ngoId: vol.ngoId, ngoName: vol.ngoName } : null
    );
  }

  function handleNgoLoggedIn() {
    refreshSessionState();
    setUserRole('coordinator');
    setNgoDashOpen(true);
    toast.success('NGO logged in', { description: 'Welcome to your NGO dashboard.' });
  }

  function handleVolunteerLoggedIn() {
    refreshSessionState();
    setUserRole('volunteer');
    setVolunteerDashOpen(true);
    toast.success('Volunteer logged in', { description: 'View available rescue requests.' });
  }

  function handleNgoLogout() {
    clearNgoSession();
    refreshSessionState();
    toast('NGO session ended.');
  }

  function handleVolunteerLogout() {
    clearVolunteerSession();
    refreshSessionState();
    toast('Volunteer session ended.');
  }

  function openNgoOrLogin() {
    if (ngoSession) {
      setNgoDashOpen(true);
    } else if (volunteerSession) {
      setVolunteerDashOpen(true);
    } else {
      setNgoLoginOpen(true);
    }
  }

  // ── Real-Time Cross-Device Sync State ─────────────────────────────────────
  const {
    customRequests,
    resolvedRequestIds,
    helpingRequestIds,
    addCustomRequest,
    resolveRequest: handleResolveRequest,
    helpRequest: handleHelpRequest,
    cancelHelpRequest: handleCancelHelp,
    restoreRequests: handleRestoreRequests,
  } = useCrossDeviceSync();

  // ── Region data ───────────────────────────────────────────────────────────
  const regionKey = region === 'ncr' ? 'ncr' : 'badrinath';
  const regionData = useMemo(() => REGION_DATA[regionKey], [regionKey]);

  // Combined requests
  const requests = useMemo(() => {
    const regionCustom = customRequests.filter((r) =>
      r.region ? r.region === regionKey : true
    );
    const combined = [...regionCustom, ...regionData.requests];
    return combined
      .filter((r) => !resolvedRequestIds.includes(r.id))
      .map((r) => ({
        ...r,
        status: (helpingRequestIds.includes(r.id)
          ? 'in-progress'
          : r.status || 'active') as RequestStatus,
      }));
  }, [customRequests, regionKey, regionData.requests, resolvedRequestIds, helpingRequestIds]);

  const authActor: AuthUser = useMemo(() => {
    if (ngoSession) {
      return {
        id: ngoSession.id,
        displayName: ngoSession.name,
        role: 'coordinator',
        organizationId: ngoSession.id,
        organizationName: ngoSession.name,
      };
    }
    if (volunteerSession) {
      return {
        id: volunteerSession.volunteer.id,
        displayName: volunteerSession.volunteer.fullName,
        role: 'volunteer',
        organizationId: volunteerSession.ngoId,
        organizationName: volunteerSession.ngoName,
      };
    }
    return {
      id: 'active-actor',
      displayName:
        userRole === 'coordinator'
          ? 'Disaster Coordinator'
          : userRole === 'shelter_officer'
          ? 'Shelter Manager'
          : userRole === 'volunteer'
          ? 'Community Volunteer'
          : 'Citizen Requester',
      role: userRole,
    };
  }, [ngoSession, volunteerSession, userRole]);

  // ── Unified Shelter Store ──
  const {
    shelters: storeShelters,
    updateCapacity,
    recordIntake,
    reserveBeds,
    releaseBeds,
    updateStatus: updateShelterStatus,
    updateInventory,
    scheduleDelivery,
    receiveDelivery,
    reportShortage,
    resolveShortage,
  } = useShelterStore(authActor, regionData.shelters);

  // Filter shelters for region or use active list
  const shelters = useMemo(() => {
    if (storeShelters && storeShelters.length > 0) {
      const regionFiltered = storeShelters.filter((s) => (s.region ? s.region === regionKey : true));
      return regionFiltered.length > 0 ? regionFiltered : storeShelters;
    }
    return regionData.shelters;
  }, [storeShelters, regionKey, regionData.shelters]);

  const volunteers = regionData.volunteers;
  const resources = regionData.resources;
  const locationLabel = regionData.locationLabel;

  const handleEnqueue = (req: Parameters<typeof enqueue>[0]) => {
    // 1. Add to offline outbox/sync queue
    enqueue(req);

    // 2. Parse coordinates:
    let coords = { x: 50, y: 50 };
    if (req.coords) {
      const parts = req.coords.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coords = { y: parts[0], x: parts[1] };
      }
    } else {
      coords = region === 'badrinath' ? { y: 30.556, x: 79.564 } : { y: 28.6139, x: 77.209 };
    }

    // 3. Parse contact info:
    let contactName = '';
    let contactPhone = '';
    if (req.contact && req.contact.trim()) {
      const phoneMatch = req.contact.match(/(\+?\d[\d\s\-]{8,})/);
      if (phoneMatch) {
        contactPhone = phoneMatch[0].trim();
        const namePart = req.contact.replace(phoneMatch[0], '').trim();
        contactName = namePart || 'Emergency Requester';
      } else {
        contactName = req.contact.trim();
      }
    }
    if (!contactName) {
      contactName = req.triage ? 'AI Triage Request' : 'Emergency Requester';
    }

    // 4. Create active AidRequest
    const category: RequestCategory = (
      ['medical', 'food', 'shelter', 'volunteers', 'rescue'].includes(req.category)
        ? req.category
        : 'rescue'
    ) as RequestCategory;

    const title = req.triage?.incidentType
      ? `SOS: ${req.triage.incidentType} Emergency`
      : req.details
      ? req.details.length > 48
        ? req.details.slice(0, 46) + '…'
        : req.details
      : 'Emergency SOS Aid Request';

    const newAidRequest: AidRequest = {
      id: req.id,
      category,
      priority:
        req.triage?.priority === 'LOW'
          ? 'moderate'
          : req.triage?.priority === 'MEDIUM'
          ? 'urgent'
          : 'critical',
      status: 'active',
      title,
      details: req.details || req.triage?.rawMessage || 'Urgent emergency assistance requested.',
      items: req.items
        ? req.items.split(',').map((s) => s.trim()).filter(Boolean)
        : req.triage?.requiredResources || ['Emergency Assistance', 'Rescue / Aid'],
      contactName,
      contactPhone,
      distanceMiles: 0.1,
      createdAt: req.createdAt || Date.now(),
      coords,
      peopleCount: req.triage?.people || 1,
      isUserCreated: true,
      region: (req.region as RegionKey) || regionKey,
      triage: req.triage,
    };

    addCustomRequest(newAidRequest);
    setSelectedId(newAidRequest.id);

    if (!isOnline) {
      toast.success('SOS Request Saved & Queued Offline', {
        description: 'Your request is recorded locally and will synchronize when you reconnect.',
      });
    } else {
      toast.success('🚨 SOS Request Broadcast Live!', {
        description: `${newAidRequest.title} broadcast to local responders and synchronized.`,
      });
    }
  };

  const handleEmergencySosSuccess = (req: EmergencyRequest) => {
    const coords =
      req.latitude !== null && req.longitude !== null
        ? { y: req.latitude, x: req.longitude }
        : region === 'badrinath'
        ? { y: 30.556, x: 79.564 }
        : { y: 28.6139, x: 77.209 };

    const newAidRequest: AidRequest = {
      id: req.id,
      category: (['medical', 'food', 'shelter', 'volunteers', 'rescue'].includes(req.category)
        ? req.category
        : 'rescue') as RequestCategory,
      priority:
        req.severity === 'critical' ? 'critical' : req.severity === 'urgent' ? 'urgent' : 'moderate',
      status: 'active',
      title: `${req.category.toUpperCase()} SOS: ${req.description.slice(0, 42)}...`,
      details: req.description,
      items: req.requiredResources.length > 0 ? req.requiredResources : ['Emergency Aid'],
      contactName: req.contactName || 'Emergency Requester',
      contactPhone: req.contactPhone || '',
      distanceMiles: 0.1,
      createdAt: new Date(req.createdAt).getTime(),
      coords,
      latitude: req.latitude ?? coords.y,
      longitude: req.longitude ?? coords.x,
      locationDescription: req.locationDescription || locationLabel,
      peopleCount: req.numberOfPeople || 1,
      isUserCreated: true,
      region: (region as RegionKey) || 'ncr',
      syncStatus: isOnline ? 'synced' : 'pending',
    };

    addCustomRequest(newAidRequest);
    setSelectedId(newAidRequest.id);
    setFilter('all');

    if (!isOnline) {
      toast.warning('📱 Saved on this device — awaiting transmission', {
        description: 'Preserved in local IndexedDB. Will sync automatically when connectivity returns.',
      });
    } else {
      toast.success('🚨 SOS Broadcast Live & Registered!', {
        description: 'Signal recorded in persistent ledger and broadcast to local coordinators.',
      });
    }
  };

  const handleRequestStatusUpdated = (updated: EmergencyRequest) => {
    if (updated.status === 'fulfilled' || updated.status === 'cancelled') {
      handleResolveRequest(updated.id);
    } else if (updated.status === 'in-progress') {
      handleHelpRequest(updated.id);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id || null);
    if (id) {
      setCurrentRoute('map');
      setMobileTab('map');
    }
  };

  const handleRegionChange = (r: MapRegion) => {
    setRegion(r);
    setSelectedId(null);
    setFilter('all');
    setNavDest(null);
  };

  const handleNavigate = (dest: NavDestination) => {
    setNavDest(dest);
    setCurrentRoute('map');
    setMobileTab('map');
    setShelterOpen(false);
    setFindHelpOpen(false);
  };

  const handleRouteChange = (route: AppNavRoute) => {
    if (route === 'sos') {
      setSosOpen(true);
      return;
    }
    if (route === 'sync') {
      setSyncModalOpen(true);
      return;
    }
    if (route === 'profile') {
      setProfileModalOpen(true);
      return;
    }
    if (route === 'shelters') {
      setCurrentRoute('shelters');
      return;
    }
    if (route === 'resources') {
      setFindHelpOpen(true);
      return;
    }
    if (route === 'volunteer') {
      setCurrentRoute('volunteer');
      return;
    }
    setCurrentRoute(route);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-foreground">
      {/* ── Refined Application Navigation ── */}
      <AppNav
        currentRoute={currentRoute}
        onRouteChange={handleRouteChange}
        status={status}
        queueCount={queueCount}
        userRole={userRole}
        region={region}
        locationLabel={locationLabel}
        onOpenSos={() => setSosOpen(true)}
        onOpenSyncModal={() => setSyncModalOpen(true)}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        onOpenTriage={() => setTriageOpen(true)}
      />

      {/* ── Main View Router ── */}
      <main className="flex-1 flex flex-col relative w-full overflow-x-hidden">
        {/* VIEW 1: LANDING PAGE */}
        {currentRoute === 'home' && (
          <LandingPage
            region={region}
            locationLabel={locationLabel}
            requests={requests}
            shelters={shelters}
            volunteers={volunteers}
            resources={resources}
            isOnline={isOnline}
            onRequestHelp={() => setSosOpen(true)}
            onBecomeVolunteer={() => setVolunteerRegOpen(true)}
            onOpenVolunteerPortal={() => setCurrentRoute('volunteer')}
            onExploreMap={() => setCurrentRoute('map')}
            onOpenShelters={() => setCurrentRoute('shelters')}
            onOpenResources={() => setFindHelpOpen(true)}
            onOpenOperations={() => setCurrentRoute('operations')}
            onOpenSync={() => setSyncModalOpen(true)}
            onNavigate={handleNavigate}
            onSelectRequest={handleSelect}
            onHelpRequest={handleHelpRequest}
          />
        )}

        {/* VIEW 2: OPERATIONS COMMAND DASHBOARD */}
        {currentRoute === 'operations' && (
          <Suspense fallback={<ViewFallback />}>
            <OperationsDashboardView
              requests={requests}
              shelters={shelters}
              volunteers={volunteers}
              resources={resources}
              region={region}
              locationLabel={locationLabel}
              pendingSyncCount={queueCount}
              isOnline={isOnline}
              currentUser={authActor}
              selectedId={selectedId}
              onOpenSyncModal={() => setSyncModalOpen(true)}
              onNavigateToMap={() => {
                setCurrentRoute('map');
                setMobileTab('map');
              }}
              onOpenSos={() => setSosOpen(true)}
              onOpenShelters={() => setCurrentRoute('shelters')}
              onOpenNgoPortal={() => openNgoOrLogin()}
              onSelectRequest={handleSelect}
              onOpenDetailsModal={(id) => {
                setDetailsRequestId(id);
                setRequestDetailsOpen(true);
              }}
              onAcknowledgeRequest={(id) => {
                toast.success('Incident Acknowledged', { description: `Ticket ${id} prioritized in command stream.` });
              }}
              onAssignVolunteerTask={(reqId) => {
                toast.success('Volunteer Dispatched', { description: `Mission active for ticket ${reqId}.` });
              }}
              onResolveRequest={(id) => handleResolveRequest(id)}
              onOpenShelterOperatorModal={() => {
                setCurrentRoute('shelters');
              }}
            />
          </Suspense>
        )}

        {/* VIEW 3: DEDICATED INTERACTIVE EMERGENCY MAP & GEOLOCATION ENGINE */}
        {currentRoute === 'map' && (
          <Suspense fallback={<ViewFallback />}>
            <EmergencyMapPage
              requests={requests}
              shelters={shelters}
              volunteers={volunteers}
              resources={resources}
              isOnline={isOnline}
              selectedId={selectedId}
              onSelect={handleSelect}
              region={region}
              onRegionChange={handleRegionChange}
              theme={theme}
              userRole={userRole}
              navDestination={navDest}
              onClearNavDestination={() => setNavDest(null)}
              onNavigate={handleNavigate}
              onOpenDetailsModal={(id) => {
                setDetailsRequestId(id);
                setRequestDetailsOpen(true);
              }}
              onHelpRequest={handleHelpRequest}
              onResolveRequest={handleResolveRequest}
              onRestoreRequests={handleRestoreRequests}
            />
          </Suspense>
        )}

        {/* VIEW 4: VOLUNTEER DISPATCH PORTAL & INTELLIGENT MATCHING */}
        {currentRoute === 'volunteer' && (
          <Suspense fallback={<ViewFallback />}>
            <VolunteerPortalView
              requests={requests}
              region={region}
              locationLabel={locationLabel}
              isOnline={isOnline}
              onHelpRequest={handleHelpRequest}
              onResolveRequest={handleResolveRequest}
              onOpenDetailsModal={(id) => {
                setDetailsRequestId(id);
                setRequestDetailsOpen(true);
              }}
              onNavigateToMap={() => setCurrentRoute('map')}
              onNavigate={handleNavigate}
              onOpenVolunteerReg={() => setVolunteerRegOpen(true)}
            />
          </Suspense>
        )}

        {/* VIEW 5: SHELTER DIRECTORY & CAPACITY MANAGEMENT */}
        {currentRoute === 'shelters' && (
          <Suspense fallback={<ViewFallback />}>
            <ShelterDirectoryView
              shelters={shelters}
              currentUser={authActor}
              onNavigateToMapWithShelter={(shelterId) => {
                setSelectedId(shelterId);
                setCurrentRoute('map');
                setMobileTab('map');
              }}
              onUpdateCapacity={updateCapacity}
              onRecordIntake={recordIntake}
              onReserveBeds={reserveBeds}
              onReleaseBeds={releaseBeds}
              onUpdateStatus={updateShelterStatus}
              onUpdateInventory={updateInventory}
              onScheduleDelivery={scheduleDelivery}
              onReceiveDelivery={receiveDelivery}
              onReportShortage={reportShortage}
              onResolveShortage={resolveShortage}
            />
          </Suspense>
        )}
      </main>

      {/* ── Compact Mobile Bottom Navigation ── */}
      <MobileNav
        active={currentRoute}
        onChange={handleRouteChange}
        onSos={() => setSosOpen(true)}
      />

      {/* ── Drawers, Panels & Modals ── */}
      <EmergencySosDrawer
        open={sosOpen}
        onOpenChange={setSosOpen}
        isOnline={isOnline}
        region={region}
        locationLabel={locationLabel}
        onSuccess={handleEmergencySosSuccess}
        onViewDetails={(id) => {
          setDetailsRequestId(id);
          setRequestDetailsOpen(true);
        }}
        onTrackOnMap={(req) => {
          const lat = req.latitude ?? (region === 'badrinath' ? 30.556 : 28.6139);
          const lng = req.longitude ?? (region === 'badrinath' ? 79.564 : 77.209);
          handleNavigate({
            id: req.id,
            name: `${req.category.toUpperCase()} SOS: ${req.description.slice(0, 36)}...`,
            address: req.locationDescription || locationLabel,
            coords: [lat, lng],
            phone: req.contactPhone,
            type: req.category,
          });
        }}
      />

      <Suspense fallback={null}>
        {requestDetailsOpen && (
          <RequestDetailsModal
            requestId={detailsRequestId}
            open={requestDetailsOpen}
            onOpenChange={setRequestDetailsOpen}
            isOnline={isOnline}
            onStatusUpdated={handleRequestStatusUpdated}
          />
        )}

        {triageOpen && (
          <TriagePanel
            open={triageOpen}
            onOpenChange={setTriageOpen}
            region={regionKey}
            locationLabel={locationLabel}
            resources={resources}
            isOnline={isOnline}
            onEnqueue={handleEnqueue}
            onNavigate={handleNavigate}
          />
        )}

        {shelterOpen && (
          <ShelterWidget
            shelters={shelters}
            open={shelterOpen}
            onOpenChange={setShelterOpen}
            locationLabel={locationLabel}
            onNavigate={handleNavigate}
          />
        )}

        {findHelpOpen && (
          <FindHelpPanel
            open={findHelpOpen}
            onOpenChange={setFindHelpOpen}
            resources={resources}
            locationLabel={locationLabel}
            onNavigate={handleNavigate}
          />
        )}

        {volunteerRegOpen && (
          <VolunteerRegistrationModal
            open={volunteerRegOpen}
            onOpenChange={setVolunteerRegOpen}
            onComplete={() => {
              setUserRole('volunteer');
              setCurrentRoute('volunteer');
              toast.success('Volunteer Profile Registered', {
                description: 'Welcome to ResQLink! Dispatch recommendations and resource matching are active.',
              });
            }}
          />
        )}

        {offerHelpOpen && (
          <OfferHelpPanel
            open={offerHelpOpen}
            onOpenChange={setOfferHelpOpen}
            offers={offers}
            loading={offersLoading}
            error={offersError}
            onCreate={async (input) => {
              await createOffer(input);
              toast.success('Help offer posted', {
                description: 'Neighbors can now see your available resources.',
              });
            }}
          />
        )}

        {/* Sync Status Telemetry Modal */}
        {syncModalOpen && (
          <SyncStatusModal
            open={syncModalOpen}
            onOpenChange={setSyncModalOpen}
            status={status}
            onToggleNetwork={toggle}
            queue={queue}
            onClearQueue={clearQueue}
            onRemoveFromQueue={removeFromQueue}
            customRequestsCount={customRequests.length}
          />
        )}

        {/* Profile & Role Settings Modal */}
        {profileModalOpen && (
          <ProfileSettingsModal
            open={profileModalOpen}
            onOpenChange={setProfileModalOpen}
            role={userRole}
            onRoleChange={setUserRole}
            region={region}
            onRegionChange={handleRegionChange}
            theme={theme}
            onToggleTheme={toggleTheme}
            onRestoreRequests={handleRestoreRequests}
            ngoSessionName={ngoSession?.name ?? volunteerSession?.ngoName}
            onLogoutNgo={ngoSession ? handleNgoLogout : handleVolunteerLogout}
          />
        )}

        {/* Context-aware Help Bot */}
        <HelpBot
          region={region}
          locationLabel={locationLabel}
          shelters={shelters}
          resources={resources}
          requests={requests}
          isOnline={isOnline}
        />

        {/* ── NGO Portal Modals ── */}
        {ngoLoginOpen && (
          <NgoLoginModal
            open={ngoLoginOpen}
            onOpenChange={setNgoLoginOpen}
            onNgoLoggedIn={handleNgoLoggedIn}
            onVolunteerLoggedIn={handleVolunteerLoggedIn}
          />
        )}

        {ngoSession && (
          <NgoDashboard
            open={ngoDashOpen}
            onOpenChange={setNgoDashOpen}
            ngo={ngoSession}
            onLogout={handleNgoLogout}
          />
        )}

        {volunteerSession && (
          <VolunteerRescueDashboard
            open={volunteerDashOpen}
            onOpenChange={setVolunteerDashOpen}
            volunteer={volunteerSession.volunteer}
            ngoId={volunteerSession.ngoId}
            ngoName={volunteerSession.ngoName}
            onLogout={handleVolunteerLogout}
          />
        )}
      </Suspense>

      <Toaster />
    </div>
  );
}

export default App;
