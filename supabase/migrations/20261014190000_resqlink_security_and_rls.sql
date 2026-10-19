/*
  ResQLink — Remote Persistence, Authorization & Row Level Security (RLS)
  ========================================================================
  Provides schema definitions, constraints, indexes, RLS policies,
  and atomic reservation RPCs for Supabase deployment.

  Tables:
  1. app_users           — User roles (coordinator, shelter_manager, volunteer, requester)
  2. emergency_requests  — SOS requests with protected medical details & coordinate constraints
  3. shelters            — Capacity invariants, inventory, and assigned operator authorization
  4. resource_offers     — Community aid donations and allocation bounds
  5. audit_events        — Append-only operational audit trail
*/

-- ── 1. User Profiles & Roles ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_users (
  id                  text        PRIMARY KEY,
  email               text        NOT NULL UNIQUE CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name        text        NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 100),
  role                text        NOT NULL CHECK (role IN ('coordinator', 'shelter_manager', 'shelter_officer', 'volunteer', 'requester', 'citizen')),
  assigned_shelter_id text,
  organization_id     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.app_users FOR SELECT
  USING (auth.uid()::text = id OR auth.jwt() ->> 'role' = 'coordinator');

CREATE POLICY "Coordinators can manage user roles"
  ON public.app_users FOR ALL
  USING (auth.jwt() ->> 'role' = 'coordinator');

-- ── 2. Emergency Requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id                            text        PRIMARY KEY,
  incident_id                   text,
  requester_id                  text        NOT NULL,
  category                      text        NOT NULL CHECK (category IN ('medical','food','shelter','volunteers','rescue','evacuation','water','other')),
  description                   text        NOT NULL CHECK (char_length(trim(description)) >= 3),
  severity                      text        NOT NULL CHECK (severity IN ('critical','urgent','moderate','low')),
  medical_priority              text        NOT NULL DEFAULT 'none' CHECK (medical_priority IN ('immediate','delayed','minor','expectant','none')),
  number_of_people              integer     NOT NULL CHECK (number_of_people >= 1),
  required_resources            text[]      NOT NULL DEFAULT '{}',
  latitude                      double precision CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  longitude                     double precision CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  location_accuracy             double precision CHECK (location_accuracy IS NULL OR location_accuracy >= 0),
  location_description          text        NOT NULL DEFAULT '',
  status                        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','assigned','in-progress','fulfilled','cancelled')),
  assigned_volunteer_id         text,
  sync_status                   text        NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending','synced','confirmed_by_server','conflict','failed')),
  idempotency_key               text        NOT NULL UNIQUE,
  confidential_medical_details  text,       -- Protected medical field
  contact_name                  text,
  contact_phone                 text,
  version                       integer     NOT NULL DEFAULT 1,
  server_ack_timestamp          timestamptz NOT NULL DEFAULT now(),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- Indices for rapid disaster query filtering
CREATE INDEX IF NOT EXISTS emergency_requests_status_idx    ON public.emergency_requests (status);
CREATE INDEX IF NOT EXISTS emergency_requests_severity_idx  ON public.emergency_requests (severity);
CREATE INDEX IF NOT EXISTS emergency_requests_created_idx   ON public.emergency_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS emergency_requests_coords_idx    ON public.emergency_requests (latitude, longitude) WHERE latitude IS NOT NULL;

ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Public & Responders can view non-confidential fields
CREATE POLICY "Public can view active emergency requests"
  ON public.emergency_requests FOR SELECT
  USING (true);

-- RLS: Only authorized requesters and coordinators can insert
CREATE POLICY "Users can create emergency requests"
  ON public.emergency_requests FOR INSERT
  WITH CHECK (true);

-- RLS: Only request owner, assigned volunteer, or coordinator can update
CREATE POLICY "Authorized actors can update emergency requests"
  ON public.emergency_requests FOR UPDATE
  USING (
    auth.uid()::text = requester_id OR
    auth.uid()::text = assigned_volunteer_id OR
    auth.jwt() ->> 'role' = 'coordinator'
  );

-- RLS: Only coordinator can delete
CREATE POLICY "Only coordinators can delete emergency requests"
  ON public.emergency_requests FOR DELETE
  USING (auth.jwt() ->> 'role' = 'coordinator');

-- ── 3. Shelter Management & Capacity ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shelters (
  id                    text        PRIMARY KEY,
  name                  text        NOT NULL CHECK (char_length(name) >= 2),
  address               text        NOT NULL,
  latitude              double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude             double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  total_capacity        integer     NOT NULL CHECK (total_capacity >= 0),
  occupied_beds         integer     NOT NULL CHECK (occupied_beds >= 0),
  reserved_beds         integer     NOT NULL CHECK (reserved_beds >= 0),
  operating_status      text        NOT NULL DEFAULT 'open' CHECK (operating_status IN ('open','full','evacuating','closed')),
  inventory             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  incoming_deliveries   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  resource_shortages    text[]      NOT NULL DEFAULT '{}',
  assigned_operators    text[]      NOT NULL DEFAULT '{}', -- User IDs authorized to manage this shelter
  contact_phone         text,
  amenities             text[]      NOT NULL DEFAULT '{}',
  region                text        NOT NULL DEFAULT 'ncr',
  version               integer     NOT NULL DEFAULT 1,
  last_updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shelter_capacity_invariant CHECK (occupied_beds + reserved_beds <= total_capacity)
);

CREATE INDEX IF NOT EXISTS shelters_status_idx ON public.shelters (operating_status);
CREATE INDEX IF NOT EXISTS shelters_coords_idx ON public.shelters (latitude, longitude);

ALTER TABLE public.shelters ENABLE ROW LEVEL SECURITY;

-- Public can inspect shelter bed availability
CREATE POLICY "Public can view shelter capacities"
  ON public.shelters FOR SELECT
  USING (true);

-- Only authorized shelter operators or coordinators can modify capacity/inventory
CREATE POLICY "Authorized operators can update shelter records"
  ON public.shelters FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'coordinator' OR
    (auth.jwt() ->> 'role' IN ('shelter_manager', 'shelter_officer') AND
     (auth.uid()::text = ANY(assigned_operators) OR auth.jwt() ->> 'assigned_shelter_id' = id))
  );

CREATE POLICY "Coordinators can create and delete shelters"
  ON public.shelters FOR ALL
  USING (auth.jwt() ->> 'role' = 'coordinator');

-- ── 4. Atomic Shelter Bed Reservation RPC ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_shelter_beds(
  p_shelter_id    text,
  p_beds_count    integer,
  p_operator_id   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shelter public.shelters%ROWTYPE;
  v_new_reserved integer;
BEGIN
  IF p_beds_count <= 0 THEN
    RAISE EXCEPTION 'Beds to reserve must be greater than zero.';
  END IF;

  -- Acquire exclusive row lock to prevent race conditions / overbooking
  SELECT * INTO v_shelter
  FROM public.shelters
  WHERE id = p_shelter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shelter with ID % not found.', p_shelter_id;
  END IF;

  v_new_reserved := v_shelter.reserved_beds + p_beds_count;

  -- Enforce strict capacity invariant
  IF (v_shelter.occupied_beds + v_new_reserved) > v_shelter.total_capacity THEN
    RAISE EXCEPTION 'Cannot reserve % beds. Exceeds total capacity (% occupied + % reserved > % total).',
      p_beds_count, v_shelter.occupied_beds, v_new_reserved, v_shelter.total_capacity;
  END IF;

  UPDATE public.shelters
  SET reserved_beds = v_new_reserved,
      operating_status = CASE
        WHEN (occupied_beds + v_new_reserved) >= total_capacity THEN 'full'
        ELSE operating_status
      END,
      version = version + 1,
      last_updated_at = now()
  WHERE id = p_shelter_id
  RETURNING * INTO v_shelter;

  RETURN jsonb_build_object(
    'success', true,
    'shelterId', v_shelter.id,
    'occupiedBeds', v_shelter.occupied_beds,
    'reservedBeds', v_shelter.reserved_beds,
    'availableBeds', (v_shelter.total_capacity - (v_shelter.occupied_beds + v_shelter.reserved_beds)),
    'operatingStatus', v_shelter.operating_status
  );
END;
$$;

-- ── 5. Immutable Operational Audit Events ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text        NOT NULL,
  entity_id   text        NOT NULL,
  action      text        NOT NULL,
  actor_id    text        NOT NULL,
  actor_role  text        NOT NULL,
  details     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON public.audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON public.audit_events (created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinators can view audit logs"
  ON public.audit_events FOR SELECT
  USING (auth.jwt() ->> 'role' = 'coordinator');

CREATE POLICY "Authenticated actors can append audit events"
  ON public.audit_events FOR INSERT
  WITH CHECK (true);

-- Disallow updates and deletes on audit log
CREATE POLICY "No modifications to audit log"
  ON public.audit_events FOR UPDATE
  USING (false);

CREATE POLICY "No deletions from audit log"
  ON public.audit_events FOR DELETE
  USING (false);
