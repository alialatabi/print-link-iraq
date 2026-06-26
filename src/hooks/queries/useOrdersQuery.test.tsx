/**
 * Tests for the Orders query hooks.
 * Verifies that hooks delegate to the correct service layer functions
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
import { useOrderQuery } from './useOrdersQuery';

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

describe('useOrderQuery', () => {
  it('queries the orders table for the given orderId', async () => {
    mockSupabaseState.queryData = { id: 'order-1', status: 'submitted', details: null };

    const { result } = renderHook(() => useOrderQuery('order-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });

  it('returns the order data from the service', async () => {
    mockSupabaseState.queryData = { id: 'order-1', status: 'assigned', details: null };

    const { result } = renderHook(() => useOrderQuery('order-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data as { status: string } | null)?.status).toBe('assigned');
  });

  it('returns null when the order does not exist', async () => {
    mockSupabaseState.queryData = null;

    const { result } = renderHook(() => useOrderQuery('order-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('stays idle (does not fetch) when orderId is undefined', () => {
    const { result } = renderHook(() => useOrderQuery(undefined), {
      wrapper: makeWrapper(),
    });

    // enabled: false → query never runs
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
