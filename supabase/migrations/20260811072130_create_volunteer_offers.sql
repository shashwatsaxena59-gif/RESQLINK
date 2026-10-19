/*
# Create volunteer offers and photo storage

1. New Tables
- `volunteer_offers` stores publicly visible volunteer resource offers.
- `id` is the generated offer identifier.
- `category` describes the offer type.
- `title` and `details` describe what is available.
- `quantity` records the available amount.
- `contact_name` and `contact_phone` let people coordinate pickup or delivery.
- `location` records the NCR area without requiring an account.
- `coords` stores optional map positioning as JSON.
- `photo_path` stores the private storage object path when a photo is attached.
- `status` and `created_at` track availability and recency.

2. Storage
- Creates a private `volunteer-offers` bucket for uploaded offer photos.
- Allows anonymous and authenticated users to upload and read offer photos because this app has no sign-in screen.
- Limits uploads at the database bucket level to 5 MB and common image MIME types.

3. Security
- Enables row-level security on `volunteer_offers`.
- Adds separate SELECT, INSERT, UPDATE, and DELETE policies for the intentionally shared, no-auth volunteer board.
- Adds separate storage policies scoped to the `volunteer-offers` bucket.

4. Important Notes
- This is a shared emergency coordination board; do not post sensitive personal documents.
- The browser validates file type and size before upload, while the storage bucket also enforces the same limits.
*/

CREATE TABLE IF NOT EXISTS public.volunteer_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('medical', 'food', 'water', 'shelter', 'transport', 'rescue', 'other')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  details text NOT NULL CHECK (char_length(details) BETWEEN 3 AND 1000),
  quantity text NOT NULL CHECK (char_length(quantity) BETWEEN 1 AND 80),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 80),
  contact_phone text NOT NULL CHECK (char_length(contact_phone) BETWEEN 5 AND 40),
  location text NOT NULL CHECK (char_length(location) BETWEEN 2 AND 120),
  coords jsonb,
  photo_path text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'limited', 'fulfilled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.volunteer_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view volunteer offers" ON public.volunteer_offers;
CREATE POLICY "Public can view volunteer offers"
  ON public.volunteer_offers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can create volunteer offers" ON public.volunteer_offers;
CREATE POLICY "Public can create volunteer offers"
  ON public.volunteer_offers FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'available');

DROP POLICY IF EXISTS "Public can update volunteer offers" ON public.volunteer_offers;
CREATE POLICY "Public can update volunteer offers"
  ON public.volunteer_offers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (status IN ('available', 'limited', 'fulfilled'));

DROP POLICY IF EXISTS "Public can delete volunteer offers" ON public.volunteer_offers;
CREATE POLICY "Public can delete volunteer offers"
  ON public.volunteer_offers FOR DELETE
  TO anon, authenticated
  USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'volunteer-offers',
  'volunteer-offers',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Public can upload volunteer offer photos" ON storage.objects;
CREATE POLICY "Public can upload volunteer offer photos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'volunteer-offers');

DROP POLICY IF EXISTS "Public can view volunteer offer photos" ON storage.objects;
CREATE POLICY "Public can view volunteer offer photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'volunteer-offers');

DROP POLICY IF EXISTS "Public can update volunteer offer photos" ON storage.objects;
CREATE POLICY "Public can update volunteer offer photos"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'volunteer-offers')
  WITH CHECK (bucket_id = 'volunteer-offers');

DROP POLICY IF EXISTS "Public can delete volunteer offer photos" ON storage.objects;
CREATE POLICY "Public can delete volunteer offer photos"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'volunteer-offers');

CREATE INDEX IF NOT EXISTS volunteer_offers_created_at_idx
  ON public.volunteer_offers (created_at DESC);

CREATE INDEX IF NOT EXISTS volunteer_offers_category_idx
  ON public.volunteer_offers (category);
