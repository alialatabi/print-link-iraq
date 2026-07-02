/**
 * Tests for useSearch lazy dataset loading.
 * The key behaviour: the services+templates dataset must NOT be fetched until
 * the user shows search intent (SearchBar focused/open, or a query typed).
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
import { useSearch } from './useSearch';

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

describe('useSearch (lazy)', () => {
  it('does not fetch when inactive and no query (mounted on every page)', () => {
    const { result } = renderHook(() => useSearch('', false), { wrapper: makeWrapper() });

    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('fetches the dataset once the SearchBar becomes active (focused)', async () => {
    mockSupabaseState.queryData = [];

    renderHook(() => useSearch('', true), { wrapper: makeWrapper() });

    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledWith('services'));
    expect(mockSupabase.from).toHaveBeenCalledWith('templates');
  });

  it('fetches when a query is typed even if not flagged active', async () => {
    mockSupabaseState.queryData = [];

    renderHook(() => useSearch('كروت', false), { wrapper: makeWrapper() });

    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledWith('services'));
  });
});
