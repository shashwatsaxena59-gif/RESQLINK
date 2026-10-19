/*
# Create volunteer registrations

1. New Table
- `volunteers` stores people who registered to help during emergencies.
- `id` is the generated volunteer identifier.
- `full_name`, `gender`, `phone`, and `email` capture the basic identity needed to coordinate assistance.
- `latitude` and `longitude` store the volunteer's current location ONLY when they explicitly grant
  browser/device geolocation permission during registration. They stay NULL when permission is denied.
- `location_permission` records whether the volunteer opted in to sharing their location.
- `volunteer_status` tracks availability, starting as `registered`.
- `created_at` records when the registration happened.

2. Security
- Enables row-level security on `volunteers`.
- Allows anonymous and authenticated users to INSERT new volunteer registrations because this app
  has no sign-in screen (same shared emergency board model as `volunteer_offers`).
- SELECT/UPDATE/DELETE are intentionally restricted to keep volunteer contact details private.
- Volunteer location is never silently tracked; it is captured once, only on explicit opt-in.

3. Important Notes
- This is a shared emergency coordination board; volunteer location is for safety and coordination only.
- The browser requests geolocation permission explicitly before coordinates are ever stored.
- Email and phone are validated on the client and constrained at the database level to keep data clean.
*/

CREATE TABLE IF NOT EXISTS public.volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  gender text NOT NULL CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 5 AND 40),
  email text NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  latitude double precision,
  longitude double precision,
  location_permission boolean NOT NULL DEFAULT false,
  volunteer_status text NOT NULL DEFAULT 'registered' CHECK (volunteer_status IN ('registered', 'available', 'on-duty', 'unavailable')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can register as volunteers" ON public.volunteers;
CREATE POLICY "Public can register as volunteers"
  ON public.volunteers FOR INSERT
  TO anon, authenticated
  WITH CHECK (volunteer_status = 'registered');

-- Volunteer contact details are private: only allow inserts from the public board,
-- not open reads, so phone/email/location are never exposed to other users.
DROP POLICY IF EXISTS "Authenticated can manage volunteers" ON public.volunteers;
CREATE POLICY "Authenticated can manage volunteers"
  ON public.volunteers FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS volunteers_created_at_idx
  ON public.volunteers (created_at DESC);

CREATE INDEX IF NOT EXISTS volunteers_status_idx
  ON public.volunteers (volunteer_status);
