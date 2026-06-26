/**
 * React Query hooks for the Profiles domain.
 *
 * All data access goes through `src/services/profiles` — this module never
 * calls supabase directly.  Options are deliberately conservative so that
 * the migrated pages behave identically to the previous useEffect approach:
 * no auto-refetch on window focus / reconnect, 30-second stale time.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  updateProfile,
  listSavedAddresses,
  insertSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
  setDefaultAddress,
} from '@/services/profiles';
import type { ProfileUpdatePayload, AddressPayload } from '@/services/profiles';

// ---------------------------------------------------------------------------
// Shared query options — behaviour-preserving one-shot-fetch config
// ---------------------------------------------------------------------------

const BASE_OPTS = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const profileKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  savedAddresses: (userId: string) => ['savedAddresses', userId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches the customer's profile row.
 * Returns null when the profile is not found or a Supabase error occurs
 * (matching the original useEffect behaviour where errors silently left
 * the form blank).
 */
export function useProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.profile(userId ?? ''),
    queryFn: async () => {
      const { data } = await getProfile(userId!);
      return data ?? null;
    },
    enabled: !!userId,
    ...BASE_OPTS,
  });
}

/**
 * Fetches the user's saved delivery addresses.
 * Pass `enabled = false` to defer loading (e.g. until the Addresses tab is
 * opened), exactly mirroring the original tab-gated useEffect.
 */
export function useSavedAddressesQuery(
  userId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: profileKeys.savedAddresses(userId ?? ''),
    queryFn: async () => {
      const { data } = await listSavedAddresses(userId!);
      return (data ?? []) as unknown[];
    },
    enabled: !!userId && enabled,
    ...BASE_OPTS,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Update the customer's profile (phone excluded — managed via OTP flow). */
export function useUpdateProfileMutation() {
  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: ProfileUpdatePayload;
    }) => {
      // Wrap in async so React Query receives a real Promise (not just PromiseLike).
      return updateProfile(userId, payload);
    },
  });
}

/**
 * Insert or update a saved address, then invalidate the addresses list so
 * it automatically refreshes.
 */
export function useSaveAddressMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      editingId,
      payload,
      isDefault,
    }: {
      editingId: string | null;
      payload: AddressPayload;
      isDefault: boolean;
    }) => {
      if (editingId) {
        return updateSavedAddress(editingId, payload);
      }
      return insertSavedAddress({ ...payload, is_default: isDefault });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.savedAddresses(userId) });
    },
  });
}

/** Delete a saved address, then invalidate the addresses list. */
export function useDeleteAddressMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSavedAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.savedAddresses(userId) });
    },
  });
}

/** Set one address as default, then invalidate the addresses list. */
export function useSetDefaultAddressMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultAddress(userId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.savedAddresses(userId) });
    },
  });
}
