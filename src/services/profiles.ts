/**
 * Service layer — Profiles domain.
 *
 * Wraps every Supabase call related to `profiles` and `saved_addresses` used by
 * ProfilePage.  No realtime subscriptions exist here; all calls are one-shot reads or writes.
 *
 * Note: `province_id` / `area_id` / `area_id` columns exist in the DB but are not yet
 * reflected in the generated types file.  We use `as never` casts (mirroring the page) to
 * keep TypeScript happy without drifting from the existing behaviour.
 */
import { supabase } from '@/integrations/supabase/client';

/** Update payload for the customer's profile (excludes phone — managed via OTP flow). */
export interface ProfileUpdatePayload {
  display_name: string;
  province: string;
  area: string;
  /** Not yet in generated types; cast internally. */
  province_id: number | null;
  /** Not yet in generated types; cast internally. */
  area_id: number | null;
  landmark: string;
}

/** Insert / update payload for a saved delivery address. */
export interface AddressPayload {
  user_id: string;
  label: string;
  phone: string;
  province: string;
  area: string;
  /** Not yet in generated types; cast internally. */
  province_id: number | null;
  /** Not yet in generated types; cast internally. */
  area_id: number | null;
  landmark: string | null;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Fetch the customer's profile row.
 * Returns `{ data: ProfileRow | null, error }` via maybeSingle (never throws on missing row).
 */
export function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
}

/**
 * Persist edits to the customer's profile.
 * Phone is intentionally excluded — it can only be changed via the OTP-verified dialog.
 * Returns `{ error }` so the caller can show specific Arabic error messages.
 */
export function updateProfile(userId: string, payload: ProfileUpdatePayload) {
  return supabase
    .from('profiles')
    .update(payload as never)
    .eq('user_id', userId);
}

// ---------------------------------------------------------------------------
// Saved addresses
// ---------------------------------------------------------------------------

/**
 * Fetch all saved delivery addresses for a user, ordered: default first, then oldest first.
 */
export function listSavedAddresses(userId: string) {
  return supabase
    .from('saved_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
}

/**
 * Update an existing saved address record.
 * Returns `{ error }` so the caller can show a specific Arabic error toast on failure.
 */
export function updateSavedAddress(id: string, payload: AddressPayload) {
  return supabase
    .from('saved_addresses')
    .update(payload as never)
    .eq('id', id);
}

/**
 * Insert a new saved address.
 * Pass `is_default: true` when there are no existing addresses (first address is always default).
 * Returns `{ error }` so the caller can show a specific Arabic error toast on failure.
 */
export function insertSavedAddress(payload: AddressPayload & { is_default: boolean }) {
  return supabase
    .from('saved_addresses')
    .insert(payload as never);
}

/**
 * Permanently delete a saved address.
 * Errors are silently ignored (caller does not check them).
 */
export async function deleteSavedAddress(id: string): Promise<void> {
  await supabase.from('saved_addresses').delete().eq('id', id);
}

/**
 * Set one address as the default for a user.
 * First clears the existing default from ALL addresses, then sets the chosen one.
 * Errors are silently ignored (the list is reloaded after this call).
 */
export async function setDefaultAddress(userId: string, id: string): Promise<void> {
  await supabase
    .from('saved_addresses')
    .update({ is_default: false } as never)
    .eq('user_id', userId);
  await supabase
    .from('saved_addresses')
    .update({ is_default: true } as never)
    .eq('id', id);
}

// ---------------------------------------------------------------------------
// AddressPicker helpers
// ---------------------------------------------------------------------------

/**
 * Fetch just the address-relevant fields from the customer's profile.
 * Used by AddressPicker to show the profile address as a synthetic default.
 */
export function getProfileAddress(userId: string) {
  return supabase
    .from('profiles')
    .select('phone, province, area, landmark')
    .eq('user_id', userId)
    .maybeSingle();
}

/**
 * Insert a new saved address and immediately return the created row.
 * Used by AddressPicker's "save for later" path so the new row id is known.
 * Returns `{ data, error }` where data is the full inserted row.
 */
export function insertAndReturnSavedAddress(
  payload: AddressPayload & { is_default: boolean },
) {
  return supabase
    .from('saved_addresses')
    .insert(payload as never)
    .select()
    .single();
}
