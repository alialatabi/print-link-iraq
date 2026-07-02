/**
 * Tests for useActiveDiscount (react-query migration).
 * Verifies the sub_service > parent_service > global priority and the
 * active-date-range filtering are preserved after the caching migration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is registered.
import { useActiveDiscount } from './useDiscounts';

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

function makeWrapper() {
  const qc = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const row = (over: Partial<Record<string, unknown>>) => ({
  id: Math.random().toString(),
  discount_type: 'global',
  target_id: null,
  percentage: 0,
  is_active: true,
  starts_at: null,
  ends_at: null,
  created_at: '2026-01-01',
  ...over,
});

describe('useActiveDiscount', () => {
  it('prefers a matching sub_service discount over parent and global', async () => {
    mockSupabaseState.queryData = [
      row({ discount_type: 'global', percentage: 5 }),
      row({ discount_type: 'parent_service', target_id: 'parent1', percentage: 10 }),
      row({ discount_type: 'sub_service', target_id: 'svc1', percentage: 20 }),
    ];

    const { result } = renderHook(() => useActiveDiscount('svc1', 'parent1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.discountPercent).toBe(20));
    expect(result.current.discountLabel).toBe('خصم 20%');
  });

  it('falls back to the global discount when no service match', async () => {
    mockSupabaseState.queryData = [row({ discount_type: 'global', percentage: 8 })];

    const { result } = renderHook(() => useActiveDiscount('svcX', 'parentX'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.discountPercent).toBe(8));
    expect(result.current.discountLabel).toBe('خصم عام 8%');
  });

  it('ignores discounts outside their active date window', async () => {
    mockSupabaseState.queryData = [
      // Expired (higher %) must be filtered out; the active 8% should win — which
      // also proves the query resolved (a non-zero result), so 0-because-unloaded
      // can't give a false pass.
      row({ discount_type: 'global', percentage: 50, ends_at: '2000-01-01T00:00:00Z' }),
      row({ discount_type: 'global', percentage: 8 }),
    ];

    const { result } = renderHook(() => useActiveDiscount('svc1', 'parent1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.discountPercent).toBe(8));
    expect(result.current.discountLabel).toBe('خصم عام 8%');
  });
});
