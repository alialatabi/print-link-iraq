/**
 * Boundary tests for the Arabic product-count agreement helper used by the
 * reorder toasts (MyOrders / OrderTracking): 1 singular, 2 dual, 3–10 plural,
 * 11+ accusative singular.
 */
import { describe, it, expect } from 'vitest';
import { formatProductCount } from './arabicPlural';

describe('formatProductCount', () => {
  it('1 → bare singular + واحد', () => {
    expect(formatProductCount(1)).toBe('منتج واحد');
  });

  it('2 → dual, no numeral', () => {
    expect(formatProductCount(2)).toBe('منتجان');
  });

  it('3 → numeral + plural (lower bound of 3–10)', () => {
    expect(formatProductCount(3)).toBe('3 منتجات');
  });

  it('10 → numeral + plural (upper bound of 3–10)', () => {
    expect(formatProductCount(10)).toBe('10 منتجات');
  });

  it('11 → numeral + accusative singular (lower bound of 11+)', () => {
    expect(formatProductCount(11)).toBe('11 منتجاً');
  });

  it('100 → numeral + accusative singular', () => {
    expect(formatProductCount(100)).toBe('100 منتجاً');
  });
});
