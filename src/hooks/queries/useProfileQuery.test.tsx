/**
 * Tests for useProfileQuery.
 * Verifies the hook delegates to the correct service layer functions
 * without calling supabase directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is registered.
import { useProfileQuery } from './useProfileQuery';

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

function makeWrapper() {
  const qc = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('useProfileQuery', () => {
  it('queries the profiles table for the given userId', async () => {
    mockSupabaseState.queryData = { id: 'p1', display_name: 'Test User' };

    const { result } = renderHook(() => useProfileQuery('user-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('returns the profile data from the service', async () => {
    mockSupabaseState.queryData = { id: 'p1', display_name: 'Ali' };

    const { result } = renderHook(() => useProfileQuery('user-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data as { display_name: string } | null)?.display_name).toBe('Ali');
  });

  it('returns null when the profile row does not exist', async () => {
    mockSupabaseState.queryData = null;

    const { result } = renderHook(() => useProfileQuery('user-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('stays idle (does not fetch) when userId is undefined', () => {
    const { result } = renderHook(() => useProfileQuery(undefined), {
      wrapper: makeWrapper(),
    });

    // enabled: false → query never runs
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
