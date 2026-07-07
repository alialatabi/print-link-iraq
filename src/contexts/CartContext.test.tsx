/**
 * Characterization tests for CartContext (add/remove/quantity/clear +
 * localStorage persistence).
 *
 * CartProvider now consumes useAuth() for server-sync, so we mock it as a logged-OUT guest: in
 * guest mode CartProvider does NO server I/O and behaves exactly as before (localStorage only),
 * which is what these characterization tests cover. No Supabase mock is required.
 * Tests use renderHook + act for direct hook access.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';

// Guest auth: keeps CartProvider on the pure-localStorage path (no server sync).
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

import { CartProvider, useCart } from './CartContext';
import type { CartItem } from './CartContext';
import type { CartVariantInfo, VariantTier } from '@/types/variants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CART_KEY = 'matbaati_cart';

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

/** Minimal valid CartItem for use in tests. Override only what matters. */
function makeItem(overrides: Partial<CartItem> = {}): Omit<CartItem, 'lineId'> {
  return {
    templateId: 'tmpl-1',
    templateName: 'Test Template',
    serviceType: 'business_card',
    previewUrl: null,
    quantity: 1000,
    unitPrice: 10000,
    minQuantity: 1000,
    ...overrides,
  };
}

/** Minimal valid CartVariantInfo for variant-line tests. Override only what matters. */
function makeVariantInfo(overrides: Partial<CartVariantInfo> = {}): CartVariantInfo {
  return {
    variantId: 'var-6x4',
    variantLabel: '6×4',
    tierQty: 500,
    tierPrice: 20000,
    ...overrides,
  };
}

/**
 * A variant-line CartItem consistent with the CART CONTRACT invariant: quantity = minQuantity =
 * tier.qty, unitPrice = CHARGED (post-discount) tier total. `variant.tierPrice` stays the
 * PRE-discount tier price for strikethrough display. Pass `variant` in overrides to control the
 * variant/tier used; any other CartItem field can be overridden on top.
 */
function makeVariantItem(overrides: Partial<CartItem> = {}): Omit<CartItem, 'lineId'> {
  const variant = overrides.variant ?? makeVariantInfo();
  return {
    templateId: 'tmpl-stamp',
    templateName: 'ختم مستطيل',
    serviceType: 'stamp',
    previewUrl: null,
    quantity: variant.tierQty,
    unitPrice: variant.tierPrice,
    minQuantity: variant.tierQty,
    ...overrides,
    variant,
  };
}

/** Minimal AI-design cart item: unique templateId, qty/minQty fixed at 1, no variant. */
function makeAiItem(overrides: Partial<CartItem> = {}): Omit<CartItem, 'lineId'> {
  return {
    templateId: `ai-${Math.random().toString(36).slice(2)}`,
    templateName: 'فلاير (تصميم AI)',
    serviceType: 'ai_design',
    previewUrl: 'https://example.com/ai.png',
    quantity: 1,
    unitPrice: 1000,
    minQuantity: 1,
    aiDesign: {
      brief: 'بريف تجريبي',
      productType: 'flyer',
      productLabel: 'فلاير',
      sizeLabel: 'A5',
      rewrittenPrompt: 'prompt',
      imageUrl: 'https://example.com/ai.png',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('starts with an empty cart when localStorage is empty', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.totalPrice).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// addItem
// ---------------------------------------------------------------------------

describe('addItem', () => {
  it('adds a new item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeItem());
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].templateId).toBe('tmpl-1');
    expect(result.current.itemCount).toBe(1);
  });

  it('does not duplicate — updates quantity of an existing templateId', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeItem({ quantity: 1000 })); });
    act(() => { result.current.addItem(makeItem({ quantity: 2000 })); });

    // Still one item, quantity replaced with 2000
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2000);
  });

  it('preserves existing item fields when re-adding (only quantity is replaced)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    const original = makeItem({ unitPrice: 10000, quantity: 1000 });
    act(() => { result.current.addItem(original); });

    // Re-add with different quantity but same templateId
    act(() => { result.current.addItem(makeItem({ quantity: 3000 })); });

    expect(result.current.items[0].unitPrice).toBe(10000); // preserved from original
    expect(result.current.items[0].quantity).toBe(3000);   // replaced from new call
  });

  it('can hold multiple items with different templateIds', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeItem({ templateId: 'a' }));
      result.current.addItem(makeItem({ templateId: 'b' }));
      result.current.addItem(makeItem({ templateId: 'c' }));
    });

    expect(result.current.itemCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// removeItem
// ---------------------------------------------------------------------------

describe('removeItem', () => {
  it('removes the matching item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeItem()); });
    expect(result.current.items).toHaveLength(1);

    act(() => { result.current.removeItem('tmpl-1'); });
    expect(result.current.items).toHaveLength(0);
  });

  it('removes only the targeted item when multiple exist', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeItem({ templateId: 'a' }));
      result.current.addItem(makeItem({ templateId: 'b' }));
    });

    act(() => { result.current.removeItem('a'); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].templateId).toBe('b');
  });

  it('is a no-op when templateId does not exist', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeItem()); });
    act(() => { result.current.removeItem('nonexistent'); });

    expect(result.current.items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// updateQuantity
// ---------------------------------------------------------------------------

describe('updateQuantity', () => {
  it('updates quantity when new quantity >= minQuantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeItem({ minQuantity: 1000, quantity: 1000 })); });
    act(() => { result.current.updateQuantity('tmpl-1', 2000); });

    expect(result.current.items[0].quantity).toBe(2000);
  });

  it('accepts a quantity exactly equal to minQuantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeItem({ minQuantity: 500, quantity: 500 })); });
    act(() => { result.current.updateQuantity('tmpl-1', 500); });

    expect(result.current.items[0].quantity).toBe(500);
  });

  it('silently ignores a quantity below minQuantity (no error thrown)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeItem({ minQuantity: 1000, quantity: 1000 })); });
    act(() => { result.current.updateQuantity('tmpl-1', 999); }); // one below min

    // Quantity unchanged
    expect(result.current.items[0].quantity).toBe(1000);
  });

  it('is a no-op when templateId does not exist', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.updateQuantity('nonexistent', 2000); });

    expect(result.current.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// clearCart
// ---------------------------------------------------------------------------

describe('clearCart', () => {
  it('empties all items', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeItem({ templateId: 'a' }));
      result.current.addItem(makeItem({ templateId: 'b' }));
    });
    expect(result.current.itemCount).toBe(2);

    act(() => { result.current.clearCart(); });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalPrice).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// totalPrice calculation
// ---------------------------------------------------------------------------

describe('totalPrice', () => {
  it('calculates price for a single item at exact minQuantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    // unitPrice=10000, quantity=1000, minQuantity=1000
    // Math.ceil(10000 * (1000/1000)) = Math.ceil(10000) = 10000
    act(() => { result.current.addItem(makeItem({ unitPrice: 10000, quantity: 1000, minQuantity: 1000 })); });
    expect(result.current.totalPrice).toBe(10000);
  });

  it('scales totalPrice with quantity factor', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    // unitPrice=10000, quantity=1500, minQuantity=1000 → factor=1.5
    // Math.ceil(10000 * 1.5) = Math.ceil(15000) = 15000
    act(() => { result.current.addItem(makeItem({ unitPrice: 10000, quantity: 1500, minQuantity: 1000 })); });
    expect(result.current.totalPrice).toBe(15000);
  });

  it('uses Math.ceil — fractional amounts round UP (note: differs from Math.round)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    // unitPrice=10001, quantity=2, minQuantity=1000
    // 10001 * (2/1000) = 20.002 → Math.ceil(20.002) = 21
    act(() => { result.current.addItem(makeItem({ unitPrice: 10001, quantity: 2, minQuantity: 1000 })); });
    expect(result.current.totalPrice).toBe(21);
    // NOTE: this is Math.ceil, not Math.round — 20.002 rounds to 21, not 20.
  });

  it('sums all items in the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeItem({ templateId: 'a', unitPrice: 10000, quantity: 1000, minQuantity: 1000 }));
      result.current.addItem(makeItem({ templateId: 'b', unitPrice: 20000, quantity: 2000, minQuantity: 1000 }));
    });
    // a: Math.ceil(10000 * 1) = 10000
    // b: Math.ceil(20000 * 2) = 40000
    expect(result.current.totalPrice).toBe(50000);
  });

  it('uses (minQuantity || 1000) as the denominator', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    // minQuantity=0 → falls back to 1000; unitPrice=10000, qty=1000
    act(() => { result.current.addItem(makeItem({ unitPrice: 10000, quantity: 1000, minQuantity: 0 })); });
    // Math.ceil(10000 * (1000/1000)) = 10000
    expect(result.current.totalPrice).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

describe('localStorage', () => {
  it('saves cart to localStorage when items change', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeItem()); });

    const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]') as CartItem[];
    expect(stored).toHaveLength(1);
    expect(stored[0].templateId).toBe('tmpl-1');
  });

  it('restores cart from localStorage on mount', () => {
    const saved: Omit<CartItem, 'lineId'>[] = [makeItem({ quantity: 2000 })];
    localStorage.setItem(CART_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2000);
  });

  it('clears localStorage entry when cart is cleared', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeItem()); });
    act(() => { result.current.clearCart(); });

    const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]') as CartItem[];
    expect(stored).toHaveLength(0);
  });

  it('handles corrupt localStorage data gracefully (falls back to empty cart)', () => {
    localStorage.setItem(CART_KEY, 'INVALID { JSON [[[');

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Variant lines — lineId identity (CART CONTRACT)
// ---------------------------------------------------------------------------

describe('variant lines — lineId identity', () => {
  it('computes lineId as templateId::variantId:: for a variant with no attributes', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeVariantItem()); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].lineId).toBe('tmpl-stamp::var-6x4::');
    expect(result.current.items[0].variant?.variantId).toBe('var-6x4');
  });

  it('gives different variantIds (same templateId) distinct lines', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeVariantItem({ variant: makeVariantInfo({ variantId: 'var-a' }) }));
      result.current.addItem(makeVariantItem({ variant: makeVariantInfo({ variantId: 'var-b' }) }));
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.map(i => i.lineId)).toEqual([
      'tmpl-stamp::var-a::',
      'tmpl-stamp::var-b::',
    ]);
  });

  it('gives different attribute choices (same variant) distinct lines', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const blue = makeVariantInfo({ attributes: { ink_color: { label: 'لون الحبر', value: 'أزرق' } } });
    const red = makeVariantInfo({ attributes: { ink_color: { label: 'لون الحبر', value: 'أحمر' } } });

    act(() => {
      result.current.addItem(makeVariantItem({ variant: blue }));
      result.current.addItem(makeVariantItem({ variant: red }));
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].lineId).not.toBe(result.current.items[1].lineId);
  });

  it('sorts multi-attribute keys deterministically regardless of object key insertion order', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const a = makeVariantInfo({
      attributes: {
        ink_color: { label: 'لون الحبر', value: 'أزرق' },
        bag_color: { label: 'لون الكيس', value: 'أبيض' },
      },
    });
    const b = makeVariantInfo({
      attributes: {
        bag_color: { label: 'لون الكيس', value: 'أبيض' },
        ink_color: { label: 'لون الحبر', value: 'أزرق' },
      },
    });

    act(() => { result.current.addItem(makeVariantItem({ variant: a })); });
    const firstLineId = result.current.items[0].lineId;

    act(() => {
      // Same attribute CHOICES, different key insertion order + a different tier — must resolve
      // to the SAME line (replace), not a duplicate.
      result.current.addItem(makeVariantItem({
        variant: { ...b, tierQty: 1000, tierPrice: 35000 },
        quantity: 1000,
        minQuantity: 1000,
        unitPrice: 35000,
      }));
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].lineId).toBe(firstLineId);
    expect(result.current.items[0].quantity).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Variant lines — addItem replace semantics
// ---------------------------------------------------------------------------

describe('variant lines — addItem replace semantics', () => {
  it('re-adding the identical variant+attributes with a different tier replaces the whole line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(makeVariantItem()); }); // tier 500 @ 20000
    act(() => {
      result.current.addItem(makeVariantItem({
        variant: makeVariantInfo({ tierQty: 1000, tierPrice: 35000 }),
        quantity: 1000,
        minQuantity: 1000,
        unitPrice: 35000,
      }));
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1000);
    expect(result.current.items[0].minQuantity).toBe(1000);
    expect(result.current.items[0].unitPrice).toBe(35000);
    expect(result.current.items[0].variant?.tierQty).toBe(1000);
    expect(result.current.items[0].variant?.tierPrice).toBe(35000);
  });

  it('keeps a legacy line and a variant line of the same templateId as independent lines', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeItem({ templateId: 'a' }));
      result.current.addItem(makeVariantItem({ templateId: 'a' }));
    });

    expect(result.current.items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// updateTier
// ---------------------------------------------------------------------------

describe('updateTier', () => {
  it('recomputes quantity/minQuantity/unitPrice + variant tier fields (no discount)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeVariantItem()); }); // tier 500 @ 20000
    const lineId = result.current.items[0].lineId;
    const tier: VariantTier = { qty: 1000, price: 35000, cost: 15000, gift: 50 };

    act(() => { result.current.updateTier(lineId, tier); });

    const item = result.current.items[0];
    expect(item.quantity).toBe(1000);
    expect(item.minQuantity).toBe(1000);
    expect(item.unitPrice).toBe(35000); // no discount -> charged = tier price
    expect(item.variant?.tierQty).toBe(1000);
    expect(item.variant?.tierPrice).toBe(35000);
    expect(item.variant?.tierCost).toBe(15000);
    expect(item.variant?.gift).toBe(50);
  });

  it('applies a passed discountPct to the charged unitPrice and records it on the line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeVariantItem()); });
    const lineId = result.current.items[0].lineId;

    act(() => { result.current.updateTier(lineId, { qty: 500, price: 20000 }, 10); });

    const item = result.current.items[0];
    expect(item.discountPct).toBe(10);
    expect(item.unitPrice).toBe(18000); // round(20000 * 0.90)
    expect(item.variant?.tierPrice).toBe(20000); // PRE-discount price kept for strikethrough
  });

  it('reuses the line\'s previously-set discountPct when a later tier change omits it', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeVariantItem()); });
    const lineId = result.current.items[0].lineId;

    act(() => { result.current.updateTier(lineId, { qty: 500, price: 20000 }, 10); });
    act(() => { result.current.updateTier(lineId, { qty: 1000, price: 35000 }); }); // no discountPct arg

    const item = result.current.items[0];
    expect(item.discountPct).toBe(10); // preserved
    expect(item.unitPrice).toBe(31500); // round(35000 * 0.90)
  });

  it('is a no-op for a legacy (non-variant) line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); }); // legacy item, lineId === 'tmpl-1'

    act(() => { result.current.updateTier('tmpl-1', { qty: 2000, price: 99999 }); });

    const item = result.current.items[0];
    expect(item.quantity).toBe(1000); // untouched
    expect(item.unitPrice).toBe(10000); // untouched
  });

  it('is a no-op when lineId does not match any line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeVariantItem()); });

    act(() => { result.current.updateTier('does-not-exist', { qty: 2000, price: 99999 }); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(500); // untouched
  });
});

// ---------------------------------------------------------------------------
// totalPrice — mixed legacy + variant + AI lines
// ---------------------------------------------------------------------------

describe('totalPrice — mixed legacy + variant + AI lines', () => {
  it('sums legacy, variant (tier-priced) and AI-design lines correctly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      // Legacy: unitPrice=10000, qty=minQty=1000 -> ceil(10000*1) = 10000
      result.current.addItem(makeItem({ templateId: 'legacy-1', unitPrice: 10000, quantity: 1000, minQuantity: 1000 }));
      // Variant: charged unitPrice=18000 (already discounted), qty=minQty=500 (tier IS the unit) -> ceil(18000*1) = 18000
      result.current.addItem(makeVariantItem({ unitPrice: 18000 }));
      // AI: unitPrice=1000, qty=minQty=1 -> ceil(1000*1) = 1000
      result.current.addItem(makeAiItem({ unitPrice: 1000 }));
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.totalPrice).toBe(10000 + 18000 + 1000);
    expect(result.current.itemCount).toBe(3);
  });

  it("a variant line's gift quantity does not affect totalPrice (gift is free, priced at the tier total)", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeVariantItem({
        unitPrice: 20000,
        variant: makeVariantInfo({ tierQty: 500, tierPrice: 20000, gift: 100 }),
      }));
    });

    expect(result.current.totalPrice).toBe(20000);
  });
});

// ---------------------------------------------------------------------------
// localStorage hydration back-compat (lineId)
// ---------------------------------------------------------------------------

describe('localStorage hydration back-compat (lineId)', () => {
  it('derives lineId = templateId for a legacy item persisted before lineId existed', () => {
    const oldShapeItem = makeItem({ quantity: 2000 }); // no lineId field
    localStorage.setItem(CART_KEY, JSON.stringify([oldShapeItem]));

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].lineId).toBe('tmpl-1');
    expect(result.current.items[0].quantity).toBe(2000);
  });

  it('derives lineId for a variant item persisted before lineId existed', () => {
    const oldShapeItem = makeVariantItem({ variant: makeVariantInfo({ variantId: 'var-9', attributes: undefined }) });
    localStorage.setItem(CART_KEY, JSON.stringify([oldShapeItem]));

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].lineId).toBe('tmpl-stamp::var-9::');
  });

  it('preserves an already-present lineId as-is (does not recompute it)', () => {
    const stored = { ...makeItem(), lineId: 'custom-line-id' };
    localStorage.setItem(CART_KEY, JSON.stringify([stored]));

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items[0].lineId).toBe('custom-line-id');
  });

  it('never crashes on a non-array localStorage payload (falls back to empty cart)', () => {
    localStorage.setItem(CART_KEY, JSON.stringify({ not: 'an array' }));

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toEqual([]);
  });

  it('drops non-object entries instead of crashing (e.g. totalPrice reading .unitPrice off them)', () => {
    localStorage.setItem(CART_KEY, JSON.stringify([null, 42, 'str', makeItem()]));

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].lineId).toBe('tmpl-1');
    expect(result.current.totalPrice).toBe(10000);
  });
});
