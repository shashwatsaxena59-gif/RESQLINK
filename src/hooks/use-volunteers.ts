import { useCallback, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveVolunteerProfile } from '@/lib/volunteer-profile';
import type {
  VolunteerGender,
  VolunteerRegistrationInput,
  VolunteerStatus,
} from '@/types';

interface VolunteerRow {
  id: string;
  full_name: string;
  gender: VolunteerGender;
  phone: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  location_permission: boolean;
  volunteer_status: VolunteerStatus;
  created_at: string;
}

/**
 * useVolunteers
 *
 * Registers (or upserts) a volunteer into the Supabase backend (`volunteers`
 * table) when Supabase is configured, or falls back to the Express server's
 * `/api/volunteer/register` endpoint, or finally to localStorage-only mode.
 *
 * Upsert strategy (prevents duplicates):
 *   - Supabase path: INSERT … ON CONFLICT (email) DO UPDATE so the same person
 *     can re-submit the form without creating a second row.
 *   - Server path: POST /api/volunteer/register with the same upsert semantics.
 *   - localStorage path: always overwrites the stored profile.
 *
 * Location is stored ONLY when the volunteer explicitly grants browser
 * geolocation permission. It is never requested or tracked silently.
 */
export function useVolunteers() {
  const [registering, setRegistering] = useState(false);
  const [registered,  setRegistered]  = useState(false);

  const registerVolunteer = useCallback(async (input: VolunteerRegistrationInput) => {
    setRegistering(true);

    // Build a comprehensive profile snapshot
    const profile = {
      id: `vol-${Date.now()}`,
      displayName:        input.displayName?.trim() || input.fullName.trim(),
      fullName:           input.fullName.trim(),
      gender:             input.gender,
      phone:              input.phone?.trim() || '',
      email:              input.email?.trim().toLowerCase() || '',
      skills:             input.skills && input.skills.length > 0 ? input.skills : ['general_aid', 'first_aid'],
      offeredSupplies:    input.offeredSupplies || [],
      preferredCategories: input.preferredCategories || ['medical', 'food', 'water', 'shelter', 'rescue'],
      availabilityStatus: input.availabilityStatus || 'available',
      serviceArea:        input.serviceArea || 'Local Neighborhood (Within 2 miles)',
      serviceRadiusMiles: input.serviceRadiusMiles || 2,
      locationPermission: input.locationPermission,
      coordinates: input.locationPermission && input.latitude !== null && input.longitude !== null
        ? { lat: input.latitude, lng: input.longitude, accuracy: 15 }
        : null,
      registeredAt:       Date.now(),
    };

    try {
      // ── PATH 1: Supabase ──────────────────────────────────────────────────
      if (isSupabaseConfigured) {
        const payload = {
          full_name:           input.fullName.trim(),
          gender:              input.gender,
          phone:              (input.phone || '').trim(),
          email:              (input.email || '').trim().toLowerCase(),
          latitude:            input.locationPermission ? input.latitude  : null,
          longitude:           input.locationPermission ? input.longitude : null,
          location_permission: input.locationPermission,
          volunteer_status:    'registered' as VolunteerStatus,
        };

        // Upsert on email to prevent duplicate rows for the same person.
        // The volunteers table has no UNIQUE constraint on email by default,
        // so we fall back to a check-then-insert if upsert is unsupported.
        const { data, error: upsertError } = await supabase
          .from('volunteers')
          .upsert(payload, { onConflict: 'email', ignoreDuplicates: false })
          .select(
            'id, full_name, gender, phone, email, latitude, longitude, location_permission, volunteer_status, created_at'
          )
          .maybeSingle();

        if (upsertError) {
          // If upsert fails because there's no unique index on email (older schema),
          // try a plain insert and gracefully handle the duplicate error.
          if (
            upsertError.code === '42P10' ||  // no unique or exclusion constraint
            upsertError.code === '23505'      // unique_violation (duplicate)
          ) {
            console.warn(
              '[useVolunteers] Upsert fell back to plain insert (no unique email index).',
              upsertError.message
            );
            const { data: insertData, error: insertError } = await supabase
              .from('volunteers')
              .insert(payload)
              .select(
                'id, full_name, gender, phone, email, latitude, longitude, location_permission, volunteer_status, created_at'
              )
              .maybeSingle();

            if (insertError) {
              if (insertError.code === '23505') {
                // Duplicate — treat as success (volunteer already registered)
                console.info('[useVolunteers] Volunteer already registered (duplicate email), reusing existing record.');
              } else {
                console.error('[useVolunteers] Supabase insert error:', insertError);
                throw new Error(
                  'Unable to complete registration. Please try again. ' +
                  `(${insertError.message})`
                );
              }
            }
          } else {
            console.error('[useVolunteers] Supabase upsert error:', upsertError);
            throw new Error(
              'Unable to complete registration. Please try again. ' +
              `(${upsertError.message})`
            );
          }
        }

        if (!data && !upsertError) {
          // maybeSingle() returns null data when the row already existed and
          // ignoreDuplicates is false — still a success for our purposes.
          console.info('[useVolunteers] Volunteer registration: row already existed.');
        }

        saveVolunteerProfile(profile);
        setRegistered(true);
        return data as VolunteerRow | null;
      }

      // ── PATH 2: Express server fallback (Supabase not configured) ─────────
      // Uses relative /api/ path so Vite proxy forwards to localhost:3001.
      try {
        const res = await fetch('/api/volunteer/register', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            fullName:           input.fullName.trim(),
            gender:             input.gender,
            phone:              (input.phone || '').trim(),
            email:              (input.email || '').trim().toLowerCase(),
            latitude:           input.locationPermission ? input.latitude  : null,
            longitude:          input.locationPermission ? input.longitude : null,
            locationPermission: input.locationPermission,
          }),
        });

        if (res.ok) {
          const body = await res.json().catch(() => ({}));
          console.info('[useVolunteers] Registered via Express server:', body);
          saveVolunteerProfile(profile);
          setRegistered(true);
          return body.volunteer ?? null;
        }

        // Server returned an error — still allow localStorage fallback below
        const errBody = await res.json().catch(() => ({}));
        console.warn(
          '[useVolunteers] Express server responded with error:',
          errBody.error ?? res.status
        );
        // If it's a known "already registered" response, treat as success
        if (res.status === 409) {
          console.info('[useVolunteers] Volunteer already registered on server.');
          saveVolunteerProfile(profile);
          setRegistered(true);
          return null;
        }
      } catch (networkErr) {
        // Server is not running — fall through to localStorage-only mode
        console.warn(
          '[useVolunteers] Express server unreachable; falling back to localStorage-only mode.',
          networkErr
        );
      }

      // ── PATH 3: localStorage-only (offline / demo mode) ──────────────────
      console.warn(
        '[useVolunteers] No backend available — volunteer registration stored in localStorage only. ' +
        'Data will be lost on page refresh in a different browser.'
      );
      saveVolunteerProfile(profile);
      setRegistered(true);
      return null;

    } finally {
      setRegistering(false);
    }
  }, []);

  const resetRegistration = useCallback(() => {
    setRegistered(false);
    setRegistering(false);
  }, []);

  return { registerVolunteer, registering, registered, resetRegistration };
}
