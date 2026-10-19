import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { VolunteerOffer, VolunteerOfferCategory } from '@/types';

interface OfferRow {
  id: string;
  category: VolunteerOfferCategory;
  title: string;
  details: string;
  quantity: string;
  contact_name: string;
  contact_phone: string;
  location: string;
  photo_path: string | null;
  status: VolunteerOffer['status'];
  created_at: string;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function toOffer(row: OfferRow, photoUrl: string | null): VolunteerOffer {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    details: row.details,
    quantity: row.quantity,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    location: row.location,
    photoPath: row.photo_path,
    photoUrl,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function withPhotoUrl(row: OfferRow): Promise<VolunteerOffer> {
  if (!row.photo_path) return toOffer(row, null);
  const { data } = await supabase.storage.from('volunteer-offers').createSignedUrl(row.photo_path, 3600);
  return toOffer(row, data?.signedUrl ?? null);
}

export function useVolunteerOffers() {
  const [offers, setOffers] = useState<VolunteerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('volunteer_offers')
      .select('id, category, title, details, quantity, contact_name, contact_phone, location, photo_path, status, created_at')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('volunteer offers load failed', queryError);
      setError('Offers could not be loaded right now.');
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as OfferRow[];
    setOffers(await Promise.all(rows.map(withPhotoUrl)));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  const createOffer = useCallback(async (input: {
    category: VolunteerOfferCategory;
    title: string;
    details: string;
    quantity: string;
    contactName: string;
    contactPhone: string;
    location: string;
    photo: File | null;
  }) => {
    if (input.photo && (!ALLOWED_PHOTO_TYPES.includes(input.photo.type) || input.photo.size > MAX_PHOTO_BYTES)) {
      throw new Error('Please choose a JPG, PNG, or WebP image under 5 MB.');
    }

    let photoPath: string | null = null;
    if (input.photo) {
      photoPath = `${crypto.randomUUID()}-${input.photo.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const { error: uploadError } = await supabase.storage
        .from('volunteer-offers')
        .upload(photoPath, input.photo, { contentType: input.photo.type, upsert: false });
      if (uploadError) {
        console.error('volunteer offer photo upload failed', uploadError);
        throw new Error('The photo could not be uploaded. Please try again.');
      }
    }

    const { data, error: insertError } = await supabase
      .from('volunteer_offers')
      .insert({
        category: input.category,
        title: input.title.trim(),
        details: input.details.trim(),
        quantity: input.quantity.trim(),
        contact_name: input.contactName.trim(),
        contact_phone: input.contactPhone.trim(),
        location: input.location.trim(),
        photo_path: photoPath,
      })
      .select('id, category, title, details, quantity, contact_name, contact_phone, location, photo_path, status, created_at')
      .maybeSingle();

    if (insertError || !data) {
      if (photoPath) await supabase.storage.from('volunteer-offers').remove([photoPath]);
      console.error('volunteer offer create failed', insertError);
      throw new Error('Your offer could not be posted. Please try again.');
    }

    const offer = await withPhotoUrl(data as OfferRow);
    setOffers((current) => [offer, ...current]);
    return offer;
  }, []);

  return { offers, loading, error, createOffer, reload: loadOffers };
}
