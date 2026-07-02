import { describe, it, expect } from 'vitest';
import { capMatches, normalizeArabic } from './comboboxCap';

/** Build N throwaway locations with unique ids 1..N. */
const mk = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `منطقة ${i + 1}` }));

describe('normalizeArabic', () => {
  it('folds alef/hamza variants to a bare alef', () => {
    expect(normalizeArabic('أحمد')).toBe(normalizeArabic('احمد'));
    expect(normalizeArabic('إسراء')).toBe(normalizeArabic('اسراء'));
    expect(normalizeArabic('آدم')).toBe(normalizeArabic('ادم'));
  });

  it('strips diacritics and tatweel', () => {
    expect(normalizeArabic('بَغْدَاد')).toBe('بغداد');
    expect(normalizeArabic('بغـــداد')).toBe('بغداد');
  });

  it('folds ta-marbuta → ha and alef-maksura → ya', () => {
    expect(normalizeArabic('كرادة')).toBe(normalizeArabic('كراده'));
    expect(normalizeArabic('مصطفى')).toBe(normalizeArabic('مصطفي'));
  });
});

describe('capMatches', () => {
  it('returns everything, uncapped, when under the cap', () => {
    const r = capMatches(mk(10), '', null, 60);
    expect(r.items).toHaveLength(10);
    expect(r.total).toBe(10);
    expect(r.capped).toBe(false);
  });

  it('caps to max and still reports the true total when over the cap', () => {
    const r = capMatches(mk(750), '', null, 60);
    expect(r.items).toHaveLength(60);
    expect(r.total).toBe(750);
    expect(r.capped).toBe(true);
  });

  it('filters by normalized substring (hamza/ta-marbuta insensitive)', () => {
    const items = [
      { id: 1, name: 'الكرادة' },
      { id: 2, name: 'المنصور' },
      { id: 3, name: 'الكاظمية' },
    ];
    const r = capMatches(items, 'كراده', null, 60);
    expect(r.items.map((i) => i.id)).toEqual([1]);
    expect(r.total).toBe(1);
    expect(r.capped).toBe(false);
  });

  it('returns no items when nothing matches (so the empty state can show)', () => {
    const r = capMatches(mk(750), 'zzzzz', null, 60);
    expect(r.items).toHaveLength(0);
    expect(r.total).toBe(0);
    expect(r.capped).toBe(false);
  });

  it('keeps the current selection visible when the cap would truncate it', () => {
    const r = capMatches(mk(750), '', 700, 60); // id 700 is far past the first 60
    expect(r.items).toHaveLength(60);
    expect(r.items[0]?.id).toBe(700);
    expect(r.items.some((i) => i.id === 700)).toBe(true);
  });

  it('does not duplicate the current selection when it already shows', () => {
    const r = capMatches(mk(750), '', 5, 60); // id 5 is within the first 60
    expect(r.items.filter((i) => i.id === 5)).toHaveLength(1);
    expect(r.items).toHaveLength(60);
  });
});
