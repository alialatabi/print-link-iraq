/**
 * Characterization tests for CartContext (add/remove/quantity/clear +
 * localStorage persistence).
 *
 * CartProvider has no Supabase dependency — no supabase mock required.
 * Tests use renderHook + act for direct hook access.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { CartProvider, useCart } from './CartContext';
import type { CartItem } from './CartContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CART_KEY = 'matbaati_cart';

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

/** Minimal valid CartItem for use in tests. Override only what matters. */
function makeItem(overrides: Partial<CartItem> = {}): CartItem {
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
    const saved: CartItem[] = [makeItem({ quantity: 2000 })];
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
