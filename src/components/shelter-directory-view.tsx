import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Filter,
  MapPin,
  BedDouble,
  Droplets,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Plus,
  RefreshCw,
  Edit3,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Phone,
  Compass,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn, buildGoogleMapsUrl } from '@/lib/utils';
import type { Shelter, ShelterOperatingStatus, IncomingDelivery } from '@/types';
import { calculateAvailableBeds } from '@/domain/services/shelter-service';
import type { AuthUser } from '@/auth/permissions';
import { canUpdateShelter } from '@/auth/permissions';
import { toast } from 'sonner';

interface ShelterDirectoryViewProps {
  shelters: Shelter[];
  currentUser?: AuthUser | null;
  onNavigateToMapWithShelter: (shelterId: string) => void;
  onUpdateCapacity: (shelterId: string, totalCapacity: number) => Promise<boolean>;
  onRecordIntake: (shelterId: string, newOccupiedBeds: number) => Promise<boolean>;
  onReserveBeds: (shelterId: string, bedsToReserve: number) => Promise<boolean>;
  onReleaseBeds: (shelterId: string, bedsToRelease: number, convertedToOccupied?: boolean) => Promise<boolean>;
  onUpdateStatus: (shelterId: string, newStatus: ShelterOperatingStatus) => Promise<boolean>;
  onUpdateInventory: (
    shelterId: string,
    itemKey: string,
    quantity: number,
    unit?: string,
    minThreshold?: number
  ) => Promise<boolean>;
  onScheduleDelivery: (shelterId: string, delivery: Omit<IncomingDelivery, 'id'>) => Promise<boolean>;
  onReceiveDelivery: (shelterId: string, deliveryId: string) => Promise<boolean>;
  onReportShortage: (shelterId: string, itemKey: string) => Promise<boolean>;
  onResolveShortage: (shelterId: string, itemKey: string) => Promise<boolean>;
}

export function ShelterDirectoryView({
  shelters,
  currentUser,
  onNavigateToMapWithShelter,
  onUpdateCapacity,
  onRecordIntake,
  onReserveBeds,
  onReleaseBeds,
  onUpdateStatus,
  onUpdateInventory,
  onScheduleDelivery,
  onReceiveDelivery,
  onReportShortage,
  onResolveShortage,
}: ShelterDirectoryViewProps) {
  // ── Filters & Search State ──
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | 'ncr' | 'badrinath'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ShelterOperatingStatus>('all');
  const [availableBedsOnly, setAvailableBedsOnly] = useState(false);
  const [supplyFilter, setSupplyFilter] = useState<'all' | 'has_water' | 'has_meals' | 'has_blankets' | 'has_shortage'>('all');
  const [viewLayout, setViewLayout] = useState<'dense-table' | 'cards'>('dense-table');

  // ── Modal State ──
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);

  // Operator Form State
  const [formTotalCapacity, setFormTotalCapacity] = useState<number>(0);
  const [formOccupiedBeds, setFormOccupiedBeds] = useState<number>(0);
  const [formReservedBeds, setFormReservedBeds] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<ShelterOperatingStatus>('open');
  const [quickReserveAmount, setQuickReserveAmount] = useState<number>(5);
  const [quickReleaseAmount, setQuickReleaseAmount] = useState<number>(5);
  const [formSupplyKey, setFormSupplyKey] = useState<string>('water_liters');
  const [formSupplyQty, setFormSupplyQty] = useState<number>(500);
  const [formSupplyUnit, setFormSupplyUnit] = useState<string>('liters');
  const [formSupplyMinThreshold, setFormSupplyMinThreshold] = useState<number>(100);

  // New Delivery Form
  const [deliveryItem, setDeliveryItem] = useState('blankets');
  const [deliveryQty, setDeliveryQty] = useState(50);
  const [deliveryUnit, setDeliveryUnit] = useState('units');
  const [deliverySource, setDeliverySource] = useState('Central Disaster Relief Depot');

  // Shortage Declaration Form
  const [shortageItem, setShortageItem] = useState('');

  const activeShelter = useMemo(
    () => shelters.find((s) => s.id === selectedShelterId) || null,
    [shelters, selectedShelterId]
  );

  const isOperatorAuthorized = useMemo(() => {
    return canUpdateShelter(currentUser, activeShelter?.id);
  }, [currentUser, activeShelter]);

  // Open Details Modal
  const handleOpenDetails = (shelter: Shelter) => {
    setSelectedShelterId(shelter.id);
    setDetailsModalOpen(true);
  };

  // Open Operator Update Modal
  const handleOpenOperatorModal = (shelter: Shelter) => {
    setSelectedShelterId(shelter.id);
    setFormTotalCapacity(shelter.totalCapacity ?? shelter.capacity ?? 0);
    setFormOccupiedBeds(shelter.occupiedBeds ?? shelter.occupied ?? 0);
    setFormReservedBeds(shelter.reservedBeds ?? 0);
    setFormStatus((shelter.operatingStatus ?? shelter.status ?? 'open') as ShelterOperatingStatus);
    setOperatorModalOpen(true);
  };

  // ── Regional Summary Analytics ──
  const stats = useMemo(() => {
    let totalCap = 0;
    let totalOcc = 0;
    let totalRsv = 0;
    let openCount = 0;
    let shortageCount = 0;

    shelters.forEach((s) => {
      const cap = s.totalCapacity ?? s.capacity ?? 0;
      const occ = s.occupiedBeds ?? s.occupied ?? 0;
      const rsv = s.reservedBeds ?? 0;
      totalCap += cap;
      totalOcc += occ;
      totalRsv += rsv;
      if (s.operatingStatus === 'open' || s.status === 'open') openCount++;
      if (s.resourceShortages && s.resourceShortages.length > 0) shortageCount++;
    });

    const totalAvailable = Math.max(0, totalCap - (totalOcc + totalRsv));
    const occupancyRate = Math.round((totalOcc / Math.max(1, totalCap)) * 100);

    return { totalCap, totalOcc, totalRsv, totalAvailable, occupancyRate, openCount, shortageCount };
  }, [shelters]);

  // ── Filtered Shelters ──
  const filteredShelters = useMemo(() => {
    return shelters.filter((s) => {
      const available = calculateAvailableBeds(s);

      // Search match
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.address.toLowerCase().includes(search.toLowerCase()) ||
        (s.amenities && s.amenities.some((a) => a.toLowerCase().includes(search.toLowerCase())));

      // Region match
      const matchRegion = regionFilter === 'all' || s.region === regionFilter;

      // Status match
      const currStatus = s.operatingStatus ?? s.status ?? 'open';
      const matchStatus = statusFilter === 'all' || currStatus === statusFilter;

      // Available beds match
      const matchAvailable = !availableBedsOnly || available > 0;

      // Supplies match
      let matchSupply = true;
      if (supplyFilter === 'has_water') {
        const water = s.inventory?.water_liters?.quantity ?? 0;
        matchSupply = water > 0;
      } else if (supplyFilter === 'has_meals') {
        const meals = s.inventory?.meals?.quantity ?? 0;
        matchSupply = meals > 0;
      } else if (supplyFilter === 'has_blankets') {
        const blankets = s.inventory?.blankets?.quantity ?? 0;
        matchSupply = blankets > 0;
      } else if (supplyFilter === 'has_shortage') {
        matchSupply = Boolean(s.resourceShortages && s.resourceShortages.length > 0);
      }

      return matchSearch && matchRegion && matchStatus && matchAvailable && matchSupply;
    });
  }, [shelters, search, regionFilter, statusFilter, availableBedsOnly, supplyFilter]);

  // Handle Capacity Commit with strict validation
  const handleSaveCapacityAndIntake = async () => {
    if (!activeShelter) return;
    const committed = formOccupiedBeds + formReservedBeds;

    if (formTotalCapacity < committed) {
      toast.error('Invalid Capacity Rule', {
        description: `Total capacity (${formTotalCapacity}) cannot be less than occupied (${formOccupiedBeds}) + reserved (${formReservedBeds}) = ${committed}.`,
      });
      return;
    }

    try {
      if (formTotalCapacity !== (activeShelter.totalCapacity ?? activeShelter.capacity)) {
        await onUpdateCapacity(activeShelter.id, formTotalCapacity);
      }
      if (formOccupiedBeds !== (activeShelter.occupiedBeds ?? activeShelter.occupied)) {
        await onRecordIntake(activeShelter.id, formOccupiedBeds);
      }
      if (formStatus !== (activeShelter.operatingStatus ?? activeShelter.status)) {
        await onUpdateStatus(activeShelter.id, formStatus);
      }
      setOperatorModalOpen(false);
    } catch {
      // Error is toasted in useShelterStore
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Top Header Banner ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-info animate-ping-slow" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-info font-bold">
              Facility Command · Evacuation Management
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono px-2 py-0 border-info/40 text-info bg-info/10">
              Live Verified Ledger
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Shelter Directory & Capacity Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            Real-time bed allocation, essential rations, incoming deliveries, and strict invariant validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-xl border border-border text-xs font-mono">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span>
                Logged in: <strong className="text-foreground">{currentUser.displayName}</strong> ({currentUser.role})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-warning/10 px-3 py-1.5 rounded-xl border border-warning/30 text-xs font-mono text-warning">
              <Lock className="h-3.5 w-3.5" />
              <span>Operator permissions required to modify beds</span>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Command Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Available Beds */}
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-success mb-2">
            <span className="text-xs font-bold font-mono uppercase tracking-wider">Calculated Free Beds</span>
            <BedDouble className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="text-3xl font-extrabold font-mono text-success">
                {stats.totalAvailable}
              </span>
              <span className="text-xs text-muted-foreground font-mono">available</span>
            </div>
            <span className="text-[11px] text-muted-foreground block mt-1">
              {stats.totalOcc} occupied · {stats.totalRsv} reserved
            </span>
          </div>
        </div>

        {/* Total Capacity & Occupancy % */}
        <div className="rounded-2xl border border-info/30 bg-info/5 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-info mb-2">
            <span className="text-xs font-bold font-mono uppercase tracking-wider">Regional Capacity</span>
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="text-3xl font-extrabold font-mono text-info">
                {stats.totalCap}
              </span>
              <span className="text-xs text-muted-foreground font-mono">total beds</span>
            </div>
            <div className="mt-2.5 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  stats.occupancyRate > 85 ? 'bg-alert' : stats.occupancyRate > 65 ? 'bg-warning' : 'bg-success'
                )}
                style={{ width: `${stats.occupancyRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Operating Facilities */}
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-foreground mb-2">
            <span className="text-xs font-bold font-mono uppercase tracking-wider">Open Facilities</span>
            <ShieldCheck className="h-4 w-4 text-info" />
          </div>
          <div>
            <span className="text-3xl font-extrabold font-mono text-foreground leading-none">
              {stats.openCount} / {shelters.length}
            </span>
            <span className="text-xs text-muted-foreground block mt-1 font-mono">Active receiving centers</span>
          </div>
        </div>

        {/* Resource Shortages Alert */}
        <div
          className={cn(
            'rounded-2xl border p-4 flex flex-col justify-between',
            stats.shortageCount > 0 ? 'border-alert/30 bg-alert/5' : 'border-border bg-card'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-alert">
              Resource Shortages
            </span>
            <AlertTriangle className={cn('h-4 w-4', stats.shortageCount > 0 ? 'text-alert' : 'text-muted-foreground')} />
          </div>
          <div>
            <span className="text-3xl font-extrabold font-mono text-alert leading-none">
              {stats.shortageCount}
            </span>
            <span className="text-xs text-muted-foreground block mt-1 font-mono">
              Facilities reporting low supplies
            </span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolstrip ── */}
      <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search shelters by name, address, or amenities (e.g. 'generator', 'meals', 'hospital')..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border shrink-0">
            <button
              type="button"
              onClick={() => setViewLayout('dense-table')}
              className={cn(
                'px-2.5 py-1 text-xs font-mono rounded-lg transition-all',
                viewLayout === 'dense-table'
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Dense Table
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('cards')}
              className={cn(
                'px-2.5 py-1 text-xs font-mono rounded-lg transition-all',
                viewLayout === 'cards'
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Cards
            </button>
          </div>
        </div>

        {/* Filter Badges Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filters:
          </span>

          {/* Region filter */}
          <div className="flex items-center gap-1">
            {(['all', 'ncr', 'badrinath'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase font-bold transition-all',
                  regionFilter === r
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                )}
              >
                {r === 'all' ? 'All Territories' : r === 'ncr' ? 'Delhi NCR' : 'Chamoli / Badrinath'}
              </button>
            ))}
          </div>

          <span className="h-3 w-px bg-border mx-1" />

          {/* Operating Status */}
          <div className="flex items-center gap-1">
            {(['all', 'open', 'full', 'evacuating', 'closed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase font-bold transition-all',
                  statusFilter === st
                    ? 'bg-info text-white'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                )}
              >
                {st}
              </button>
            ))}
          </div>

          <span className="h-3 w-px bg-border mx-1" />

          {/* Available Beds Only Toggle */}
          <button
            type="button"
            onClick={() => setAvailableBedsOnly(!availableBedsOnly)}
            className={cn(
              'px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all',
              availableBedsOnly
                ? 'bg-success text-white'
                : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
            )}
          >
            <BedDouble className="h-3 w-3" />
            Has Available Beds (&gt;0)
          </button>

          {/* Supply Type Filter */}
          <div className="flex items-center gap-1 ml-auto">
            {(['all', 'has_water', 'has_meals', 'has_blankets', 'has_shortage'] as const).map((sup) => (
              <button
                key={sup}
                type="button"
                onClick={() => setSupplyFilter(sup)}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[10px] font-mono capitalize transition-all',
                  supplyFilter === sup
                    ? 'bg-warning/20 text-warning border border-warning/40 font-bold'
                    : 'bg-secondary/30 text-muted-foreground hover:text-foreground'
                )}
              >
                {sup === 'all'
                  ? 'All Supplies'
                  : sup === 'has_water'
                  ? 'Water Stock'
                  : sup === 'has_meals'
                  ? 'Meals'
                  : sup === 'has_blankets'
                  ? 'Blankets'
                  : '⚠️ Shortages'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Shelter Directory Content (Dense Table / Cards) ── */}
      {viewLayout === 'dense-table' ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                  <th className="py-3 px-4 font-bold">Facility Name & Address</th>
                  <th className="py-3 px-3 font-bold">Status</th>
                  <th className="py-3 px-3 font-bold">Total Cap</th>
                  <th className="py-3 px-3 font-bold">Occupied</th>
                  <th className="py-3 px-3 font-bold">Reserved</th>
                  <th className="py-3 px-3 font-bold">Available Beds</th>
                  <th className="py-3 px-3 font-bold">Essential Stock</th>
                  <th className="py-3 px-3 font-bold">Last Updated</th>
                  <th className="py-3 px-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredShelters.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground font-mono">
                      No shelters matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredShelters.map((shelter) => {
                    const cap = shelter.totalCapacity ?? shelter.capacity ?? 0;
                    const occ = shelter.occupiedBeds ?? shelter.occupied ?? 0;
                    const rsv = shelter.reservedBeds ?? 0;
                    const available = calculateAvailableBeds(shelter);
                    const isFull = (shelter.operatingStatus ?? shelter.status) === 'full' || available === 0;
                    const hasShortage = shelter.resourceShortages && shelter.resourceShortages.length > 0;
                    const waterQty = shelter.inventory?.water_liters?.quantity;
                    const mealsQty = shelter.inventory?.meals?.quantity;
                    const blanketsQty = shelter.inventory?.blankets?.quantity;

                    return (
                      <tr
                        key={shelter.id}
                        onClick={() => handleOpenDetails(shelter)}
                        className={cn(
                          'hover:bg-secondary/30 transition-colors cursor-pointer',
                          hasShortage ? 'bg-alert/[0.02]' : isFull ? 'bg-warning/[0.02]' : ''
                        )}
                      >
                        {/* Name & Address */}
                        <td className="py-3 px-4 max-w-[280px]">
                          <div className="font-bold text-foreground truncate">{shelter.name}</div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                            <span className="truncate">{shelter.address}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <span
                            className={cn(
                              'inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                              isFull
                                ? 'bg-alert/15 text-alert border border-alert/30'
                                : shelter.operatingStatus === 'evacuating'
                                ? 'bg-warning/15 text-warning border border-warning/30'
                                : shelter.operatingStatus === 'closed'
                                ? 'bg-secondary text-muted-foreground border border-border'
                                : 'bg-success/15 text-success border border-success/30'
                            )}
                          >
                            {shelter.operatingStatus || shelter.status || 'open'}
                          </span>
                        </td>

                        {/* Total Capacity */}
                        <td className="py-3 px-3 font-mono font-bold text-foreground">
                          {cap}
                        </td>

                        {/* Occupied */}
                        <td className="py-3 px-3 font-mono text-foreground">
                          {occ}
                        </td>

                        {/* Reserved */}
                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          {rsv > 0 ? (
                            <span className="text-warning font-semibold">+{rsv} rsv</span>
                          ) : (
                            '0'
                          )}
                        </td>

                        {/* Calculated Available Beds */}
                        <td className="py-3 px-3">
                          <div className="flex items-baseline gap-1">
                            <span
                              className={cn(
                                'font-mono font-extrabold text-sm',
                                available === 0
                                  ? 'text-alert'
                                  : available < 10
                                  ? 'text-warning'
                                  : 'text-success'
                              )}
                            >
                              {available}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">beds</span>
                          </div>
                          {/* Mini capacity bar */}
                          <div className="w-16 h-1 rounded-full bg-secondary overflow-hidden mt-1">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                isFull ? 'bg-alert' : occ / cap > 0.75 ? 'bg-warning' : 'bg-success'
                              )}
                              style={{ width: `${Math.min(100, (occ / Math.max(1, cap)) * 100)}%` }}
                            />
                          </div>
                        </td>

                        {/* Essential Stock Highlights */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                            {waterQty !== undefined && (
                              <span className="text-[9px] font-mono bg-info/10 text-info border border-info/20 px-1 rounded">
                                {waterQty}L H2O
                              </span>
                            )}
                            {mealsQty !== undefined && (
                              <span className="text-[9px] font-mono bg-warning/10 text-warning border border-warning/20 px-1 rounded">
                                {mealsQty} meals
                              </span>
                            )}
                            {blanketsQty !== undefined && (
                              <span className="text-[9px] font-mono bg-secondary text-foreground px-1 rounded">
                                {blanketsQty} blk
                              </span>
                            )}
                            {hasShortage && (
                              <span className="text-[9px] font-mono bg-alert/20 text-alert border border-alert/30 px-1 rounded font-bold">
                                ⚠️ SHORTAGE
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Last Updated */}
                        <td className="py-3 px-3 font-mono text-[10px] text-muted-foreground">
                          {shelter.lastUpdatedAt ? (
                            new Date(shelter.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          ) : (
                            'Just now'
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onNavigateToMapWithShelter(shelter.id)}
                              className="h-7 px-2 text-[11px] font-mono text-primary hover:bg-primary/10"
                              title="Focus shelter marker on the interactive map"
                            >
                              <Compass className="h-3.5 w-3.5 mr-1" />
                              Map
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenOperatorModal(shelter)}
                              className="h-7 px-2 text-[11px] font-mono border-border hover:bg-secondary"
                              title="Update capacity, bed intake, and supply inventory"
                            >
                              <Edit3 className="h-3.5 w-3.5 mr-1 text-info" />
                              Manage
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Cards View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShelters.map((shelter) => {
            const cap = shelter.totalCapacity ?? shelter.capacity ?? 0;
            const occ = shelter.occupiedBeds ?? shelter.occupied ?? 0;
            const rsv = shelter.reservedBeds ?? 0;
            const available = calculateAvailableBeds(shelter);
            const isFull = (shelter.operatingStatus ?? shelter.status) === 'full' || available === 0;
            const hasShortage = shelter.resourceShortages && shelter.resourceShortages.length > 0;

            return (
              <div
                key={shelter.id}
                onClick={() => handleOpenDetails(shelter)}
                className={cn(
                  'rounded-2xl border p-4 bg-card transition-all hover:border-primary/50 cursor-pointer space-y-3',
                  hasShortage ? 'border-alert/30 bg-alert/[0.02]' : 'border-border'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-foreground truncate">{shelter.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{shelter.address}</span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                      isFull
                        ? 'bg-alert/15 text-alert border border-alert/30'
                        : 'bg-success/15 text-success border border-success/30'
                    )}
                  >
                    {shelter.operatingStatus || shelter.status || 'open'}
                  </span>
                </div>

                {/* Capacity Invariant Formula Display */}
                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/80 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Available Beds:</span>
                    <span
                      className={cn(
                        'text-base font-extrabold',
                        available === 0 ? 'text-alert' : 'text-success'
                      )}
                    >
                      {available} free
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex justify-between">
                    <span>Capacity: {cap}</span>
                    <span>Occupied: {occ}</span>
                    <span>Reserved: {rsv}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isFull ? 'bg-alert' : occ / cap > 0.75 ? 'bg-warning' : 'bg-success'
                      )}
                      style={{ width: `${Math.min(100, (occ / Math.max(1, cap)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Amenities / Supplies */}
                {shelter.inventory && (
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                    {Object.entries(shelter.inventory).map(([k, item]) => (
                      <span key={k} className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {k.replace('_', ' ')}: {item.quantity} {item.unit}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onNavigateToMapWithShelter(shelter.id)}
                    className="h-8 text-xs font-mono text-primary hover:bg-primary/10"
                  >
                    <Compass className="h-3.5 w-3.5 mr-1" />
                    Focus on Map
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenOperatorModal(shelter)}
                    className="h-8 text-xs font-mono border-border"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1 text-info" />
                    Update Intake
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SHELTER DETAILS MODAL ── */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-2xl">
          {activeShelter && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-info font-bold">
                      Evacuation Shelter Dossier
                    </span>
                    <DialogTitle className="text-xl font-bold text-foreground mt-0.5">
                      {activeShelter.name}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3.5 w-3.5 text-info shrink-0" />
                      {activeShelter.address}
                    </DialogDescription>
                  </div>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-mono font-bold uppercase',
                      activeShelter.operatingStatus === 'open'
                        ? 'bg-success/15 text-success border border-success/30'
                        : 'bg-alert/15 text-alert border border-alert/30'
                    )}
                  >
                    {activeShelter.operatingStatus || activeShelter.status || 'open'}
                  </span>
                </div>
              </DialogHeader>

              {/* Verified Capacity Formula Card */}
              <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground font-bold">Capacity Math Rule:</span>
                  <span className="text-foreground font-bold">
                    Capacity ({activeShelter.totalCapacity ?? activeShelter.capacity}) − [Occupied ({activeShelter.occupiedBeds ?? activeShelter.occupied}) + Reserved ({activeShelter.reservedBeds ?? 0})]
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Available beds right now:</span>
                  <span className="text-2xl font-mono font-extrabold text-success">
                    {calculateAvailableBeds(activeShelter)} Beds
                  </span>
                </div>
              </div>

              {/* Essential Supplies Inventory Grid */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-mono uppercase font-bold text-foreground flex items-center justify-between">
                  <span>Essential Supplies & Rations</span>
                  {activeShelter.resourceShortages && activeShelter.resourceShortages.length > 0 && (
                    <span className="text-alert text-[10px] font-bold">
                      ⚠️ {activeShelter.resourceShortages.length} Shortages Declared
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeShelter.inventory && Object.keys(activeShelter.inventory).length > 0 ? (
                    Object.entries(activeShelter.inventory).map(([k, item]) => {
                      const isLow = item.minThreshold !== undefined && item.quantity <= item.minThreshold;
                      return (
                        <div
                          key={k}
                          className={cn(
                            'p-2.5 rounded-xl border text-xs font-mono space-y-1',
                            isLow ? 'border-alert/40 bg-alert/10' : 'border-border bg-card'
                          )}
                        >
                          <div className="text-[10px] text-muted-foreground uppercase truncate">
                            {k.replace('_', ' ')}
                          </div>
                          <div className="text-sm font-bold text-foreground">
                            {item.quantity} <span className="text-[10px] text-muted-foreground font-normal">{item.unit}</span>
                          </div>
                          {item.minThreshold !== undefined && (
                            <div className="text-[9px] text-muted-foreground">
                              Reserve min: {item.minThreshold} {item.unit}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground col-span-3">No inventory records logged.</p>
                  )}
                </div>
              </div>

              {/* Incoming Deliveries */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-mono uppercase font-bold text-foreground flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-info" />
                  <span>Incoming Deliveries & Shipments</span>
                </h4>
                {activeShelter.incomingDeliveries && activeShelter.incomingDeliveries.length > 0 ? (
                  <div className="space-y-2">
                    {activeShelter.incomingDeliveries.map((del) => (
                      <div
                        key={del.id}
                        className="p-3 rounded-xl border border-border bg-card flex items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div>
                          <div className="font-bold text-foreground">
                            {del.quantity} {del.unit} of {del.item}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Source: {del.source} · ETA: {new Date(del.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {del.status === 'delivered' ? (
                          <Badge variant="outline" className="text-success border-success/30 bg-success/10 text-[10px]">
                            Delivered
                          </Badge>
                        ) : isOperatorAuthorized ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await onReceiveDelivery(activeShelter.id, del.id);
                            }}
                            className="h-7 text-[10px] font-mono border-success/40 text-success hover:bg-success/10"
                          >
                            Confirm Receipt
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10 text-[10px]">
                            In Transit
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">No incoming supply shipments scheduled.</p>
                )}
              </div>

              {/* Modal Footer Actions */}
              <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    onNavigateToMapWithShelter(activeShelter.id);
                  }}
                  className="text-xs font-mono"
                >
                  <Compass className="h-3.5 w-3.5 mr-1 text-primary" />
                  View on Map
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    handleOpenOperatorModal(activeShelter);
                  }}
                  className="bg-primary text-primary-foreground text-xs font-mono font-bold"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  Operator Console
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── SHELTER OPERATOR UPDATE MODAL ── */}
      <Dialog open={operatorModalOpen} onOpenChange={setOperatorModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl">
          {activeShelter && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-info/20 text-info">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <DialogTitle className="text-lg font-bold text-foreground">
                      Shelter Operations Console: {activeShelter.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Authorized operator updates for capacity, bed intake, emergency stock, and deliveries.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Permission Check Notice */}
              {!isOperatorAuthorized && (
                <div className="p-3 rounded-xl border border-warning/30 bg-warning/10 text-warning text-xs font-mono flex items-start gap-2">
                  <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Restricted Access:</strong> You are viewing in read-only preview. Modifying records requires
                    logging in with role <code>shelter_officer</code> or <code>coordinator</code>.
                  </div>
                </div>
              )}

              {/* Section 1: Capacity & Occupancy Form */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <h4 className="text-xs font-mono uppercase font-bold text-foreground flex items-center justify-between">
                  <span>1. Capacity & Intake Rules</span>
                  <span className="text-[11px] text-info">
                    Calculated Available: {Math.max(0, formTotalCapacity - (formOccupiedBeds + formReservedBeds))} Beds
                  </span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                      Total Capacity (Max Beds)
                    </label>
                    <Input
                      type="number"
                      min={formOccupiedBeds + formReservedBeds}
                      value={formTotalCapacity}
                      onChange={(e) => setFormTotalCapacity(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                    <span className="text-[9px] text-muted-foreground mt-0.5 block">
                      Cannot be &lt; {formOccupiedBeds + formReservedBeds}
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                      Occupied Beds (Current Intake)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={formTotalCapacity - formReservedBeds}
                      value={formOccupiedBeds}
                      onChange={(e) => setFormOccupiedBeds(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                      Reserved Beds
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={formReservedBeds}
                      disabled
                      className="font-mono text-xs bg-secondary/50"
                    />
                    <span className="text-[9px] text-muted-foreground mt-0.5 block">
                      Updated via reserve / release actions
                    </span>
                  </div>
                </div>

                {/* Operating Status select */}
                <div>
                  <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                    Operating Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['open', 'full', 'evacuating', 'closed'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={!isOperatorAuthorized}
                        onClick={() => setFormStatus(st)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs font-mono uppercase font-bold transition-all border',
                          formStatus === st
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary/40 text-muted-foreground border-border hover:text-foreground'
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Bed Reservation & Release Buttons */}
                <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={Math.max(1, formTotalCapacity - (formOccupiedBeds + formReservedBeds))}
                      value={quickReserveAmount}
                      onChange={(e) => setQuickReserveAmount(parseInt(e.target.value) || 1)}
                      disabled={!isOperatorAuthorized}
                      className="w-16 h-8 text-xs font-mono"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!isOperatorAuthorized || formOccupiedBeds + formReservedBeds >= formTotalCapacity}
                      onClick={async () => {
                        await onReserveBeds(activeShelter.id, quickReserveAmount);
                        setFormReservedBeds((r) => r + quickReserveAmount);
                      }}
                      className="h-8 text-xs font-mono border-warning/40 text-warning hover:bg-warning/10"
                    >
                      Reserve Beds
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={Math.max(1, formReservedBeds)}
                      value={quickReleaseAmount}
                      onChange={(e) => setQuickReleaseAmount(parseInt(e.target.value) || 1)}
                      disabled={!isOperatorAuthorized || formReservedBeds === 0}
                      className="w-16 h-8 text-xs font-mono"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!isOperatorAuthorized || formReservedBeds === 0}
                      onClick={async () => {
                        await onReleaseBeds(activeShelter.id, quickReleaseAmount, false);
                        setFormReservedBeds((r) => Math.max(0, r - quickReleaseAmount));
                      }}
                      className="h-8 text-xs font-mono border-border hover:bg-secondary"
                    >
                      Release Beds
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={!isOperatorAuthorized}
                  onClick={handleSaveCapacityAndIntake}
                  className="w-full bg-primary text-primary-foreground font-mono text-xs font-bold"
                >
                  Save Capacity & Operating Status
                </Button>
              </div>

              {/* Section 2: Supply Inventory Updates */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h4 className="text-xs font-mono uppercase font-bold text-foreground">
                  2. Update Essential Supplies & Reserve Thresholds
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground block mb-1">Item Key</label>
                    <select
                      value={formSupplyKey}
                      onChange={(e) => setFormSupplyKey(e.target.value)}
                      disabled={!isOperatorAuthorized}
                      className="w-full py-1.5 px-2 rounded-lg border border-border bg-background text-xs font-mono text-foreground"
                    >
                      <option value="water_liters">water_liters (Water)</option>
                      <option value="meals">meals (Meals)</option>
                      <option value="blankets">blankets (Blankets)</option>
                      <option value="cots">cots (Cots)</option>
                      <option value="first_aid_kits">first_aid_kits (Medical)</option>
                      <option value="baby_supplies">baby_supplies (Baby Care)</option>
                      <option value="oxygen_cylinders">oxygen_cylinders (O2)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground block mb-1">Quantity</label>
                    <Input
                      type="number"
                      min={0}
                      value={formSupplyQty}
                      onChange={(e) => setFormSupplyQty(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground block mb-1">Unit</label>
                    <Input
                      type="text"
                      value={formSupplyUnit}
                      onChange={(e) => setFormSupplyUnit(e.target.value)}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground block mb-1">Min Threshold</label>
                    <Input
                      type="number"
                      min={0}
                      value={formSupplyMinThreshold}
                      onChange={(e) => setFormSupplyMinThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!isOperatorAuthorized}
                  onClick={async () => {
                    await onUpdateInventory(
                      activeShelter.id,
                      formSupplyKey,
                      formSupplyQty,
                      formSupplyUnit,
                      formSupplyMinThreshold
                    );
                  }}
                  className="w-full text-xs font-mono border-info/40 text-info hover:bg-info/10 font-bold"
                >
                  Adjust Supply Stock
                </Button>
              </div>

              {/* Section 3: Schedule Incoming Delivery */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h4 className="text-xs font-mono uppercase font-bold text-foreground flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-warning" />
                  <span>3. Schedule Incoming Delivery</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground block mb-1">Item</label>
                    <Input
                      type="text"
                      placeholder="e.g. blankets"
                      value={deliveryItem}
                      onChange={(e) => setDeliveryItem(e.target.value)}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground block mb-1">Quantity</label>
                    <Input
                      type="number"
                      min={1}
                      value={deliveryQty}
                      onChange={(e) => setDeliveryQty(parseInt(e.target.value) || 1)}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground block mb-1">Unit</label>
                    <Input
                      type="text"
                      value={deliveryUnit}
                      onChange={(e) => setDeliveryUnit(e.target.value)}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground block mb-1">Source</label>
                    <Input
                      type="text"
                      value={deliverySource}
                      onChange={(e) => setDeliverySource(e.target.value)}
                      disabled={!isOperatorAuthorized}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isOperatorAuthorized || !deliveryItem.trim()}
                  onClick={async () => {
                    await onScheduleDelivery(activeShelter.id, {
                      item: deliveryItem.trim(),
                      quantity: deliveryQty,
                      unit: deliveryUnit,
                      source: deliverySource,
                      expectedAt: new Date(Date.now() + 2 * 3600000).toISOString(),
                      status: 'scheduled',
                    });
                  }}
                  className="w-full text-xs font-mono border-warning/40 text-warning hover:bg-warning/10 font-bold"
                >
                  Schedule Delivery
                </Button>
              </div>

              {/* Section 4: Resource Shortages */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h4 className="text-xs font-mono uppercase font-bold text-foreground flex items-center justify-between">
                  <span>4. Declare / Resolve Resource Shortages</span>
                  {activeShelter.resourceShortages && (
                    <span className="text-alert font-mono text-[10px]">
                      {activeShelter.resourceShortages.length} Active Shortages
                    </span>
                  )}
                </h4>

                {activeShelter.resourceShortages && activeShelter.resourceShortages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeShelter.resourceShortages.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-1 rounded bg-alert/15 text-alert border border-alert/30 text-xs font-mono flex items-center gap-1.5"
                      >
                        ⚠️ {s}
                        {isOperatorAuthorized && (
                          <button
                            type="button"
                            onClick={async () => onResolveShortage(activeShelter.id, s)}
                            className="hover:text-foreground text-alert font-bold"
                            title="Resolve shortage"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Declare new shortage item (e.g. oxygen_cylinders, drinking_water)"
                    value={shortageItem}
                    onChange={(e) => setShortageItem(e.target.value)}
                    disabled={!isOperatorAuthorized}
                    className="font-mono text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={!isOperatorAuthorized || !shortageItem.trim()}
                    onClick={async () => {
                      await onReportShortage(activeShelter.id, shortageItem.trim());
                      setShortageItem('');
                    }}
                    className="text-xs font-mono font-bold"
                  >
                    Report Shortage
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOperatorModalOpen(false)}
                  className="font-mono text-xs"
                >
                  Close Console
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
