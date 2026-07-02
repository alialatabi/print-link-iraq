/**
 * Unit test for cartItemsSignature — the pure content-identity that keys CheckoutPage's reusable
 * idempotency UUIDs.
 *
 * The invariant: an UNCHANGED cart yields a STABLE signature (so a retried submit reuses the same
 * order/item ids and reconciles via create_order_with_items' ON CONFLICT DO NOTHING), while ANY
 * content change — crucially including an edit that keeps the same item COUNT — yields a DIFFERENT
 * signature (so fresh ids are minted and the RPC can't silently no-op new content onto stale ids).
 * The old count-only key missed exactly that same-length case.
 */
import { describe, it, expect, vi } from 'vitest';

// CheckoutPage transitively imports the real supabase client (which throws without env vars); mock
// it so we can import the pure helper it exports. (Same pattern as services/orders.test.ts.)
vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

import { cartItemsSignature } from './CheckoutPage';
import type { CartItem } from '@/contexts/CartContext';

const item = (over: Partial<CartItem>): CartItem => ({
  templateId: 't1',
  templateName: 'Business Card',
  serviceType: 'business_card',
  previewUrl: null,
  quantity: 1000,
  unitPrice: 25000,
  minQuantity: 1000,
  ...over,
});

const aiItem = (imageUrl: string): CartItem =>
  item({
    templateId: 'ai-x',
    serviceType: 'ai_design',
    quantity: 1,
    aiDesign: {
      brief: 'b',
      productType: 'logo',
      productLabel: 'Logo',
      sizeLabel: '1:1',
      rewrittenPrompt: 'p',
      imageUrl,
    },
  });

describe('cartItemsSignature', () => {
  it('is stable for identical cart content (retry reuses the same ids)', () => {
    const a = [item({ templateId: 't1' }), item({ templateId: 't2' })];
    const b = [item({ templateId: 't1' }), item({ templateId: 't2' })];
    expect(cartItemsSignature(a)).toBe(cartItemsSignature(b));
  });

  it('changes when a template changes but the item COUNT stays the same (the bug this closes)', () => {
    const before = [item({ templateId: 't1' }), item({ templateId: 't2' })];
    const after = [item({ templateId: 't1' }), item({ templateId: 't3' })];
    expect(cartItemsSignature(after)).not.toBe(cartItemsSignature(before));
  });

  it('changes when a quantity changes', () => {
    const before = [item({ templateId: 't1', quantity: 1000 })];
    const after = [item({ templateId: 't1', quantity: 2000 })];
    expect(cartItemsSignature(after)).not.toBe(cartItemsSignature(before));
  });

  it('changes when cellophane changes', () => {
    const before = [item({ templateId: 't1', cellophane: 'matte' })];
    const after = [item({ templateId: 't1', cellophane: 'glossy' })];
    expect(cartItemsSignature(after)).not.toBe(cartItemsSignature(before));
  });

  it('changes when the AI design image reference changes (same slot count)', () => {
    expect(cartItemsSignature([aiItem('u/1.png')])).not.toBe(cartItemsSignature([aiItem('u/2.png')]));
  });

  it('is order-sensitive — reordering mints fresh ids since ids bind positionally', () => {
    const ab = [item({ templateId: 'a' }), item({ templateId: 'b' })];
    const ba = [item({ templateId: 'b' }), item({ templateId: 'a' })];
    expect(cartItemsSignature(ab)).not.toBe(cartItemsSignature(ba));
  });

  it('distinguishes same-length carts that differ only in one slot', () => {
    const before = [item({ templateId: 't1' }), item({ templateId: 't1' })];
    const after = [item({ templateId: 't1' }), item({ templateId: 't2' })];
    expect(cartItemsSignature(after)).not.toBe(cartItemsSignature(before));
  });

  it('ignores non-identity display fields (templateName/previewUrl/unitPrice) — retry stays stable', () => {
    const before = [item({ templateId: 't1', templateName: 'Old', previewUrl: null, unitPrice: 25000 })];
    const after = [item({ templateId: 't1', templateName: 'New', previewUrl: 'x.png', unitPrice: 25000 })];
    expect(cartItemsSignature(after)).toBe(cartItemsSignature(before));
  });
});
