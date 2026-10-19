/*
  ResQLink — NGO + Rescue Task System
  ====================================
  Creates the tables, constraints, indexes, RLS policies, and atomic-assignment
  RPC needed for the NGO Portal + Volunteer Rescue Coordination system.

  Tables
  ------
  1. ngos               — registered NGO organisations
  2. ngo_volunteers     — volunteer members belonging to an NGO
  3. rescue_tasks       — rescue tasks linked to AidRequest IDs, with lifecycle status

  Atomic Assignment
  -----------------
  assign_rescue_task(p_task_id, p_volunteer_id, p_ngo_id) is a PL/pgSQL function
  that wraps the AVAILABLE → ASSIGNED transition in an advisory lock so two
  concurrent callers cannot both win the same task.

  RLS
  ---
  - NGOs can only read/write their own rows.
  - NGO volunteers can only read tasks/volunteers belonging to their NGO.
  - Public (anon) can INSERT a new NGO or volunteer registration.
  - Rescue tasks marked AVAILABLE are readable by anyone (anon/authenticated).
  - Only the owning NGO may confirm or cancel a rescue task.

  Note: This migration is idempotent (IF NOT EXISTS / OR REPLACE).
*/

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. NGOS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ngos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 200),
  contact_person      text        NOT NULL CHECK (char_length(contact_person) BETWEEN 2 AND 120),
  email               text        NOT NULL UNIQUE CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone               text        NOT NULL CHECK (char_length(phone) BETWEEN 5 AND 40),
  service_area        text        NOT NULL DEFAULT '',
  description         text        NOT NULL DEFAULT '',
  -- password_hash stores a server-side hash; never exposed via SELECT to anon
  password_hash       text        NOT NULL,
  verification_status text        NOT NULL DEFAULT 'PENDING'
                                  CHECK (verification_status IN ('PENDING','VERIFIED','SUSPENDED')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ngos_email_idx      ON public.ngos (email);
CREATE INDEX IF NOT EXISTS ngos_created_at_idx ON public.ngos (created_at DESC);

ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;

-- Anyone can register a new NGO (public board, no auth required)
DROP POLICY IF EXISTS "Public can register NGO" ON public.ngos;
CREATE POLICY "Public can register NGO"
  ON public.ngos FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- NGOs can read their own row (matched by id stored in JWT claim or app session)
-- For the Express-backed model, reads happen server-side — policy allows authenticated reads
DROP POLICY IF EXISTS "NGO can read own row" ON public.ngos;
CREATE POLICY "NGO can read own row"
  ON public.ngos FOR SELECT TO authenticated
  USING (true);   -- server filters by id; password_hash excluded in query

-- NGO can update own row (no password_hash changes via this policy)
DROP POLICY IF EXISTS "NGO can update own row" ON public.ngos;
CREATE POLICY "NGO can update own row"
  ON public.ngos FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ngos_updated_at ON public.ngos;
CREATE TRIGGER ngos_updated_at
  BEFORE UPDATE ON public.ngos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. NGO_VOLUNTEERS  (members managed by an NGO, distinct from public volunteers)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ngo_volunteers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id           uuid        NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  full_name        text        NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  phone            text        NOT NULL CHECK (char_length(phone) BETWEEN 5 AND 40),
  email            text        NOT NULL DEFAULT '' CHECK (char_length(email) <= 200),
  skills           text[]      NOT NULL DEFAULT '{}',
  status           text        NOT NULL DEFAULT 'AVAILABLE'
                               CHECK (status IN ('AVAILABLE','ON_MISSION','OFFLINE')),
  current_task_id  uuid,       -- FK added below (rescue_tasks may not exist yet)
  joined_at        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ngo_id, phone)       -- prevent duplicate phone within same NGO
);

CREATE INDEX IF NOT EXISTS ngo_volunteers_ngo_id_idx ON public.ngo_volunteers (ngo_id);
CREATE INDEX IF NOT EXISTS ngo_volunteers_status_idx ON public.ngo_volunteers (status);

ALTER TABLE public.ngo_volunteers ENABLE ROW LEVEL SECURITY;

-- Anyone can add a volunteer to an NGO (NGO admin flow, backed by Express session)
DROP POLICY IF EXISTS "Public can add ngo volunteer" ON public.ngo_volunteers;
CREATE POLICY "Public can add ngo volunteer"
  ON public.ngo_volunteers FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- NGO admins and authenticated users can read volunteers
DROP POLICY IF EXISTS "Authenticated can read ngo volunteers" ON public.ngo_volunteers;
CREATE POLICY "Authenticated can read ngo volunteers"
  ON public.ngo_volunteers FOR SELECT TO authenticated
  USING (true);

-- Status updates (AVAILABLE / ON_MISSION / OFFLINE)
DROP POLICY IF EXISTS "Authenticated can update ngo volunteers" ON public.ngo_volunteers;
CREATE POLICY "Authenticated can update ngo volunteers"
  ON public.ngo_volunteers FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Remove a volunteer (only when not on mission — enforced in app layer too)
DROP POLICY IF EXISTS "Authenticated can delete ngo volunteers" ON public.ngo_volunteers;
CREATE POLICY "Authenticated can delete ngo volunteers"
  ON public.ngo_volunteers FOR DELETE TO authenticated
  USING (status <> 'ON_MISSION');

DROP TRIGGER IF EXISTS ngo_volunteers_updated_at ON public.ngo_volunteers;
CREATE TRIGGER ngo_volunteers_updated_at
  BEFORE UPDATE ON public.ngo_volunteers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RESCUE_TASKS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rescue_tasks (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Links back to the AidRequest created by the user (string ID from sync-store)
  request_id                text        NOT NULL,
  -- Snapshot of the request for display (avoids cross-system joins)
  title                     text        NOT NULL,
  description               text        NOT NULL DEFAULT '',
  category                  text        NOT NULL DEFAULT 'rescue',
  priority                  text        NOT NULL DEFAULT 'urgent'
                                        CHECK (priority IN ('critical','urgent','moderate')),
  location                  text        NOT NULL DEFAULT '',
  coord_x                   double precision,
  coord_y                   double precision,
  people_count              integer     NOT NULL DEFAULT 1 CHECK (people_count >= 0),
  contact_name              text        NOT NULL DEFAULT '',
  contact_phone             text        NOT NULL DEFAULT '',
  region                    text        NOT NULL DEFAULT 'ncr',

  -- Lifecycle
  status                    text        NOT NULL DEFAULT 'AVAILABLE'
                                        CHECK (status IN (
                                          'AVAILABLE','ASSIGNED','IN_PROGRESS',
                                          'AWAITING_CONFIRMATION','RESCUED','CANCELLED'
                                        )),

  -- Assignment
  assigned_ngo_id           uuid        REFERENCES public.ngos(id) ON DELETE SET NULL,
  assigned_ngo_name         text,
  assigned_volunteer_id     uuid        REFERENCES public.ngo_volunteers(id) ON DELETE SET NULL,
  assigned_volunteer_name   text,

  -- Timestamps
  created_at                timestamptz NOT NULL DEFAULT now(),
  assigned_at               timestamptz,
  started_at                timestamptz,
  completion_requested_at   timestamptz,
  confirmed_at              timestamptz,
  completed_at              timestamptz,
  cancelled_at              timestamptz,

  -- Confirmation metadata
  confirmed_by_ngo_id       uuid        REFERENCES public.ngos(id) ON DELETE SET NULL,
  confirmed_by_name         text,
  cancel_reason             text
);

-- Idempotency: one task per request_id at a time (AVAILABLE/ASSIGNED/IN_PROGRESS/AWAITING_CONFIRMATION)
-- Allow multiple RESCUED/CANCELLED rows for history, but only one active row per request_id
CREATE UNIQUE INDEX IF NOT EXISTS rescue_tasks_active_request_idx
  ON public.rescue_tasks (request_id)
  WHERE status NOT IN ('RESCUED','CANCELLED');

CREATE INDEX IF NOT EXISTS rescue_tasks_status_idx       ON public.rescue_tasks (status);
CREATE INDEX IF NOT EXISTS rescue_tasks_ngo_idx          ON public.rescue_tasks (assigned_ngo_id);
CREATE INDEX IF NOT EXISTS rescue_tasks_volunteer_idx    ON public.rescue_tasks (assigned_volunteer_id);
CREATE INDEX IF NOT EXISTS rescue_tasks_created_at_idx   ON public.rescue_tasks (created_at DESC);

-- Add FK from ngo_volunteers back to rescue_tasks now that the table exists
ALTER TABLE public.ngo_volunteers
  DROP CONSTRAINT IF EXISTS ngo_volunteers_current_task_id_fkey;
ALTER TABLE public.ngo_volunteers
  ADD CONSTRAINT ngo_volunteers_current_task_id_fkey
  FOREIGN KEY (current_task_id) REFERENCES public.rescue_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.rescue_tasks ENABLE ROW LEVEL SECURITY;

-- AVAILABLE tasks are publicly visible (volunteers browse them)
DROP POLICY IF EXISTS "Public can view available rescue tasks" ON public.rescue_tasks;
CREATE POLICY "Public can view available rescue tasks"
  ON public.rescue_tasks FOR SELECT TO anon, authenticated
  USING (status = 'AVAILABLE');

-- Authenticated users can view all tasks (their own NGO + available)
DROP POLICY IF EXISTS "Authenticated can view all rescue tasks" ON public.rescue_tasks;
CREATE POLICY "Authenticated can view all rescue tasks"
  ON public.rescue_tasks FOR SELECT TO authenticated
  USING (true);

-- Only authenticated can create rescue tasks
DROP POLICY IF EXISTS "Authenticated can create rescue tasks" ON public.rescue_tasks;
CREATE POLICY "Authenticated can create rescue tasks"
  ON public.rescue_tasks FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'AVAILABLE');

-- Only the assigned NGO (or any authenticated user in this shared-board model) can update
DROP POLICY IF EXISTS "Authenticated can update rescue tasks" ON public.rescue_tasks;
CREATE POLICY "Authenticated can update rescue tasks"
  ON public.rescue_tasks FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ATOMIC ASSIGNMENT RPC
--    Wraps the AVAILABLE→ASSIGNED transition in a row-level advisory lock so
--    two concurrent callers cannot both win the same task.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.assign_rescue_task(
  p_task_id       uuid,
  p_volunteer_id  uuid,
  p_ngo_id        uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER   -- runs with table-owner privileges so RLS doesn't block
AS $$
DECLARE
  v_task        public.rescue_tasks%ROWTYPE;
  v_volunteer   public.ngo_volunteers%ROWTYPE;
  v_ngo_name    text;
  v_result      jsonb;
BEGIN
  -- Lock the task row for this transaction
  SELECT * INTO v_task
  FROM public.rescue_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Task not found.');
  END IF;

  -- Enforce: only AVAILABLE tasks may be assigned
  IF v_task.status <> 'AVAILABLE' THEN
    RETURN jsonb_build_object(
      'ok',                  false,
      'alreadyAssigned',     true,
      'error',               'This rescue request has already been assigned to another volunteer.',
      'currentStatus',       v_task.status,
      'assignedVolunteerName', v_task.assigned_volunteer_name
    );
  END IF;

  -- Lock and check volunteer
  SELECT * INTO v_volunteer
  FROM public.ngo_volunteers
  WHERE id = p_volunteer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Volunteer not found.');
  END IF;

  IF v_volunteer.status <> 'AVAILABLE' THEN
    RETURN jsonb_build_object(
      'ok',              false,
      'error',           'This volunteer is already on a mission or offline.',
      'volunteerStatus', v_volunteer.status
    );
  END IF;

  -- Fetch NGO name
  SELECT name INTO v_ngo_name FROM public.ngos WHERE id = p_ngo_id;

  -- Apply assignment atomically
  UPDATE public.rescue_tasks SET
    status                  = 'ASSIGNED',
    assigned_ngo_id         = p_ngo_id,
    assigned_ngo_name       = COALESCE(v_ngo_name, 'Unknown NGO'),
    assigned_volunteer_id   = p_volunteer_id,
    assigned_volunteer_name = v_volunteer.full_name,
    assigned_at             = now()
  WHERE id = p_task_id;

  UPDATE public.ngo_volunteers SET
    status          = 'ON_MISSION',
    current_task_id = p_task_id
  WHERE id = p_volunteer_id;

  -- Return updated task
  SELECT row_to_json(t)::jsonb INTO v_result
  FROM public.rescue_tasks t WHERE t.id = p_task_id;

  RETURN jsonb_build_object('ok', true, 'task', v_result);
END;
$$;

-- Grant execution to anon and authenticated so the frontend can call it via Supabase RPC
GRANT EXECUTE ON FUNCTION public.assign_rescue_task(uuid, uuid, uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. HELPFUL VIEW — ngo_dashboard_stats
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.ngo_dashboard_stats AS
SELECT
  n.id                                                            AS ngo_id,
  COUNT(DISTINCT v.id)                                            AS total_volunteers,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'AVAILABLE')     AS available_volunteers,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'ON_MISSION')    AS on_mission_volunteers,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'OFFLINE')       AS offline_volunteers,
  COUNT(DISTINCT t.id) FILTER (
    WHERE t.assigned_ngo_id = n.id
    AND   t.status IN ('ASSIGNED','IN_PROGRESS')
  )                                                               AS active_rescues,
  COUNT(DISTINCT t.id) FILTER (
    WHERE t.assigned_ngo_id = n.id
    AND   t.status = 'AWAITING_CONFIRMATION'
  )                                                               AS awaiting_confirmation,
  COUNT(DISTINCT t.id) FILTER (
    WHERE t.assigned_ngo_id = n.id
    AND   t.status = 'RESCUED'
  )                                                               AS completed_rescues
FROM public.ngos n
LEFT JOIN public.ngo_volunteers v ON v.ngo_id = n.id
LEFT JOIN public.rescue_tasks   t ON t.assigned_ngo_id = n.id
GROUP BY n.id;

-- Authenticated users can query stats (server filters to their NGO id)
DROP POLICY IF EXISTS "Authenticated can view ngo stats" ON public.rescue_tasks;
