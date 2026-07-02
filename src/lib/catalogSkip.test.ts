import { describe, it, expect } from 'vitest';
import { singleSubServiceTarget } from './catalogSkip';

describe('singleSubServiceTarget', () => {
  it('returns null for an empty category (nothing to skip to)', () => {
    expect(singleSubServiceTarget([])).toBeNull();
  });

  it('returns the lone sub-service id when a category has exactly one', () => {
    expect(singleSubServiceTarget([{ id: 'business_card_matte' }])).toBe('business_card_matte');
  });

  it('returns null when a category has more than one sub-service', () => {
    expect(
      singleSubServiceTarget([{ id: 'a' }, { id: 'b' }]),
    ).toBeNull();
    expect(
      singleSubServiceTarget([{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
    ).toBeNull();
  });

  it('ignores extra fields on the sub-service objects', () => {
    const subs = [{ id: 'only', label: 'كروت', price: 15000 }];
    expect(singleSubServiceTarget(subs)).toBe('only');
  });
});
