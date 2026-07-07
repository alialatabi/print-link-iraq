/**
 * Tests for the resilient server I/O layer (src/lib/cartSync.ts).
 *
 * The focus is PRE-MIGRATION / failure resilience: a returned `{ error }` (missing table, 404) and
 * a thrown client error must both be swallowed so the cart keeps working. Uses the shared supabase
 * mock. cartSync's only non-supabase import (CartItem) is type-only, so no React is pulled in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

import { loadServerCart, saveServerCart, deleteServerCart } from './cartSync';
import type { CartItem } from '@/contexts/CartContext';

const fromMock = () => mockSupabase.from as ReturnType<typeof vi.fn>;

const item: CartItem = {
  lineId: 't1',
  templateId: 't1',
  templateName: 'Card',
  serviceType: 'business_card',
  previewUrl: null,
  quantity: 1000,
  unitPrice: 10000,
  minQuantity: 1000,
};

/** Awaitable builder that records upsert/delete/eq args so we can assert the wire payload. */
function makeCapture() {
  const calls: { upsert?: unknown[]; eq?: unknown[]; deleted?: boolean } = {};
  const b: Record<string, unknown> = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn((...args: unknown[]) => { calls.eq = args; return b; });
  b.delete = vi.fn(() => { calls.deleted = true; return b; });
  b.upsert = vi.fn((...args: unknown[]) => { calls.upsert = args; return b; });
  b.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res);
  return { b, calls };
}

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// loadServerCart
// ---------------------------------------------------------------------------

describe('loadServerCart', () => {
  it('queries the carts table for the user', async () => {
    await loadServerCart('u1');
    expect(fromMock()).toHaveBeenCalledWith('carts');
  });

  it("returns the row's items array when present", async () => {
    mockSupabaseState.queryData = { items: [item] }; // maybeSingle resolves to this object
    await expect(loadServerCart('u1')).resolves.toEqual([item]);
  });

  it('returns [] when the row is absent (no cart yet)', async () => {
    mockSupabaseState.queryData = null;
    await expect(loadServerCart('u1')).resolves.toEqual([]);
  });

  it('returns [] on a returned query error (e.g. table missing pre-migration)', async () => {
    mockSupabaseState.queryError = { message: 'relation "carts" does not exist' };
    await expect(loadServerCart('u1')).resolves.toEqual([]);
  });

  it('returns [] (never throws) when the client throws synchronously', async () => {
    fromMock().mockImplementationOnce(() => { throw new Error('boom'); });
    await expect(loadServerCart('u1')).resolves.toEqual([]);
  });

  it('returns [] when the row exists but has no items field', async () => {
    mockSupabaseState.queryData = { user_id: 'u1' };
    await expect(loadServerCart('u1')).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveServerCart
// ---------------------------------------------------------------------------

describe('saveServerCart', () => {
  it('upserts the full items array keyed on user_id', async () => {
    const { b, calls } = makeCapture();
    fromMock().mockReturnValueOnce(b);

    await saveServerCart('u1', [item]);

    expect(fromMock()).toHaveBeenCalledWith('carts');
    expect(calls.upsert?.[0]).toMatchObject({ user_id: 'u1', items: [item] });
    expect(calls.upsert?.[0]).toHaveProperty('updated_at');
    expect(calls.upsert?.[1]).toMatchObject({ onConflict: 'user_id' });
  });

  it('does not throw when the client throws synchronously', async () => {
    fromMock().mockImplementationOnce(() => { throw new Error('boom'); });
    await expect(saveServerCart('u1', [item])).resolves.toBeUndefined();
  });

  it('does not throw on an empty cart', async () => {
    await expect(saveServerCart('u1', [])).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deleteServerCart
// ---------------------------------------------------------------------------

describe('deleteServerCart', () => {
  it('deletes the row for the user', async () => {
    const { b, calls } = makeCapture();
    fromMock().mockReturnValueOnce(b);

    await deleteServerCart('u1');

    expect(fromMock()).toHaveBeenCalledWith('carts');
    expect(calls.deleted).toBe(true);
    expect(calls.eq).toEqual(['user_id', 'u1']);
  });

  it('does not throw when the client throws synchronously', async () => {
    fromMock().mockImplementationOnce(() => { throw new Error('boom'); });
    await expect(deleteServerCart('u1')).resolves.toBeUndefined();
  });
});
