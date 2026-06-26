/**
 * Contract tests for the coupons service.
 *
 * Verifies that `listCoupons` calls the correct edge function with the right body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is in place.
import { listCoupons } from './coupons';

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

describe('listCoupons', () => {
  it('calls the validate-coupon edge function', async () => {
    mockSupabaseState.invokeData = { coupons: [] };
    await listCoupons();
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'validate-coupon',
      { body: { action: 'list' } },
    );
  });

  it('returns coupon data from the mock', async () => {
    const fakeCoupons = [{ id: 'c1', code: 'SAVE10', percentage: 10, expires_at: null }];
    mockSupabaseState.invokeData = { coupons: fakeCoupons };
    const { data } = await listCoupons();
    expect((data as { coupons: unknown[] }).coupons).toHaveLength(1);
    expect((data as { coupons: { code: string }[] }).coupons[0].code).toBe('SAVE10');
  });

  it('surfaces an error when the function fails', async () => {
    mockSupabaseState.invokeError = { message: 'Function error' };
    const { error } = await listCoupons();
    expect(error).toBeTruthy();
  });
});
