/**
 * Tests for useServices / useSpecializations (react-query migration).
 * Verifies the public API is preserved: the services array, the derived
 * parentServices / getSubServices (print_enabled filtering), and loading flag.
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
import { useServices, useSpecializations } from './useServices';

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

describe('useServices', () => {
  it('queries the services table and returns the rows', async () => {
    mockSupabaseState.queryData = [
      { id: 'p1', label: 'Cards', parent_id: null, print_enabled: true, sort_order: 0 },
      { id: 's1', label: 'Sub', parent_id: 'p1', print_enabled: true, sort_order: 1 },
    ];

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSupabase.from).toHaveBeenCalledWith('services');
    expect(result.current.services).toHaveLength(2);
  });

  it('derives parentServices excluding print-disabled parents', async () => {
    mockSupabaseState.queryData = [
      { id: 'p1', label: 'Cards', parent_id: null, print_enabled: true, sort_order: 0 },
      { id: 's1', label: 'Sub', parent_id: 'p1', print_enabled: true, sort_order: 1 },
      { id: 'p2', label: 'AI only', parent_id: null, print_enabled: false, sort_order: 2 },
    ];

    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.parentServices.map(s => s.id)).toEqual(['p1']);
    expect(result.current.getSubServices('p1').map(s => s.id)).toEqual(['s1']);
  });

  it('starts empty (loading) before data arrives', () => {
    mockSupabaseState.queryData = [];
    const { result } = renderHook(() => useServices(), { wrapper: makeWrapper() });
    // Synchronous first render: no data yet.
    expect(result.current.services).toEqual([]);
    expect(result.current.parentServices).toEqual([]);
  });
});

describe('useSpecializations', () => {
  it('queries the specializations table', async () => {
    mockSupabaseState.queryData = [{ id: 'spec1', label: 'Doctors', sort_order: 0 }];

    const { result } = renderHook(() => useSpecializations(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSupabase.from).toHaveBeenCalledWith('specializations');
    expect(result.current.specializations).toHaveLength(1);
  });
});
