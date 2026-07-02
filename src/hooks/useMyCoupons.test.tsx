/**
 * Tests for useMyCoupons — the customer-facing coupon list backed by the
 * `my_coupons()` SECURITY DEFINER RPC (Security Audit M3).
 *
 * Verifies (1) it surfaces the rows the RPC returns and (2) it swallows an RPC
 * error (RPC not deployed yet / RLS deny) and resolves to an empty list so the
 * /my-coupons page shows its empty state instead of throwing.
 *
 * The shared supabase mock has no `.rpc`, so this file provides a minimal
 * rpc-only client via vi.hoisted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: rpcMock },
}));

// Import AFTER the mock is registered.
import { useMyCoupons } from './useDiscounts';

beforeEach(() => {
  rpcMock.mockReset();
});

function makeWrapper() {
  const qc = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useMyCoupons', () => {
  it('returns the coupons the my_coupons RPC provides', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { id: 'c1', code: 'SAVE10', percentage: 10, expires_at: null },
        { id: 'c2', code: 'EID25', percentage: 25, expires_at: '2099-01-01T00:00:00Z' },
      ],
      error: null,
    });

    const { result } = renderHook(() => useMyCoupons(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.coupons).toHaveLength(2));
    expect(result.current.coupons[0].code).toBe('SAVE10');
    expect(result.current.coupons[1].percentage).toBe(25);
    expect(rpcMock).toHaveBeenCalledWith('my_coupons');
  });

  it('swallows an RPC error and resolves to an empty list (pre-migration / RLS deny)', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'function public.my_coupons() does not exist' },
    });

    const { result } = renderHook(() => useMyCoupons(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.coupons).toEqual([]);
  });
});
