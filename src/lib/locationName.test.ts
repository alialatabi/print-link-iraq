/**
 * Tests for the Al-Waseet location-name display sanitizer used by the
 * محافظة/منطقة selectors (LocationSelect via useAlwaseetLocations): edge junk is
 * trimmed, non-Arabic rows are hidden, and ids are always preserved.
 */
import { describe, it, expect } from 'vitest';
import { cleanLocationName, isDisplayableLocationName, sanitizeLocations } from './locationName';

describe('cleanLocationName', () => {
  it('strips a leading underscore + space (real synced row)', () => {
    expect(cleanLocationName('_ ابوغريب مجمع كلية زراعةابوغريب')).toBe('ابوغريب مجمع كلية زراعةابوغريب');
  });

  it('trims surrounding whitespace and punctuation', () => {
    expect(cleanLocationName('  - حي الجامعة . ')).toBe('حي الجامعة');
  });

  it('leaves a clean name untouched', () => {
    expect(cleanLocationName('الكرادة داخل')).toBe('الكرادة داخل');
  });

  it('keeps internal separators (only edges are trimmed)', () => {
    expect(cleanLocationName('حي القادسية - شارع 14')).toBe('حي القادسية - شارع 14');
  });
});

describe('isDisplayableLocationName', () => {
  it('rejects digits-only junk (real synced row)', () => {
    expect(isDisplayableLocationName('7647843')).toBe(false);
  });

  it('rejects short Latin junk (real synced row)', () => {
    expect(isDisplayableLocationName('pd')).toBe(false);
  });

  it('rejects Arabic-Indic digits with no letters', () => {
    expect(isDisplayableLocationName('٧٦٤٧٨٤٣')).toBe(false);
  });

  it('accepts a normal Arabic name', () => {
    expect(isDisplayableLocationName('المنصور')).toBe(true);
  });

  it('accepts Kurdish-script names (extended Arabic letters)', () => {
    expect(isDisplayableLocationName('گەرمیان')).toBe(true);
  });

  it('accepts mixed Arabic + digits', () => {
    expect(isDisplayableLocationName('حي 14 تموز')).toBe(true);
  });
});

describe('sanitizeLocations', () => {
  it('cleans names, drops junk rows, and preserves ids', () => {
    const rows = [
      { id: 1, name: '7647843' },
      { id: 2, name: 'pd' },
      { id: 3, name: '_ ابوغريب مجمع كلية زراعةابوغريب' },
      { id: 4, name: 'الكرادة داخل' },
    ];
    expect(sanitizeLocations(rows)).toEqual([
      { id: 3, name: 'ابوغريب مجمع كلية زراعةابوغريب' },
      { id: 4, name: 'الكرادة داخل' },
    ]);
  });

  it('returns an empty array unchanged', () => {
    expect(sanitizeLocations([])).toEqual([]);
  });
});
