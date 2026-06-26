/**
 * Characterization tests for the phone utility functions in `src/lib/phoneUtils.ts`.
 *
 * Previously the normalization function was inlined in several places across
 * the codebase (biometric.ts `normPhone`, ChangePhoneDialog, AdminPanel, etc.)
 * as:   p.replace(/\s+/g, '').replace(/^0/, '964')
 *
 * Phase 1.2 extracted them into `phoneUtils.ts`; these tests verify the
 * canonical implementations.
 */

import { describe, it, expect } from 'vitest';
import { normalizePhone, formatPhoneDisplay, isSuperAdminPhone } from '@/lib/phoneUtils';

// ---------------------------------------------------------------------------
// normalizePhone
// ---------------------------------------------------------------------------

describe('normalizePhone', () => {
  it('converts a leading 0 to 964 (standard Iraqi format)', () => {
    expect(normalizePhone('07712345678')).toBe('9647712345678');
  });

  it('strips internal spaces before replacing the leading zero', () => {
    expect(normalizePhone('0 77 12 34 56 78')).toBe('9647712345678');
  });

  it('strips leading and trailing spaces', () => {
    expect(normalizePhone('  07712345678  ')).toBe('9647712345678');
  });

  it('leaves a number already prefixed with 964 unchanged', () => {
    expect(normalizePhone('9647712345678')).toBe('9647712345678');
  });

  it('strips spaces from a 964-prefixed number', () => {
    expect(normalizePhone('964 771 234 5678')).toBe('9647712345678');
  });

  // --- Edge cases ---

  it('returns an empty string unchanged', () => {
    expect(normalizePhone('')).toBe('');
  });

  it('turns a string of only spaces into an empty string', () => {
    expect(normalizePhone('   ')).toBe('');
  });

  it('converts a single zero to the string "964"', () => {
    expect(normalizePhone('0')).toBe('964');
  });

  it('leaves a number with no leading zero and no 964 prefix unchanged', () => {
    // NOTE: the function only converts a leading 0; it does NOT force-add 964.
    // A bare number like '7712345678' passes through unmodified.
    expect(normalizePhone('7712345678')).toBe('7712345678');
  });

  it('only replaces the first leading zero (not subsequent zeros)', () => {
    // '0077123' → strip spaces → '0077123' → /^0/ replaces one char → '964' + '077123'
    // NOTE: a double-zero prefix produces '964077123', not '96477123'.
    // This is a known characterization of the regex: /^0/ matches exactly one char.
    expect(normalizePhone('0077123')).toBe('964077123');
    // '00' → /^0/ → '964' + '0' = '9640'
    expect(normalizePhone('00')).toBe('9640');
  });

  it('handles tab separators — tabs are whitespace (\\s+) so stripped', () => {
    // '077\t123\t456' → strip \s+ → '077123456' → replace /^0/ → '96477123456'
    expect(normalizePhone('077\t123\t456')).toBe('96477123456');
  });

  it('handles a 10-digit number starting with 7 (no country prefix needed)', () => {
    // Users may enter without country code and without leading 0
    // — the function returns it as-is (no 964 addition)
    expect(normalizePhone('7501234567')).toBe('7501234567');
  });
});

// ---------------------------------------------------------------------------
// formatPhoneDisplay
// ---------------------------------------------------------------------------

describe('formatPhoneDisplay', () => {
  it('returns empty string for null', () => {
    expect(formatPhoneDisplay(null)).toBe('');
  });

  it('converts Iraqi local format (0…) to international with + prefix', () => {
    expect(formatPhoneDisplay('07712345678')).toBe('+9647712345678');
  });

  it('adds + prefix to a 964-prefixed number that lacks it', () => {
    expect(formatPhoneDisplay('9647712345678')).toBe('+9647712345678');
  });

  it('keeps + prefix on an already-formatted number', () => {
    expect(formatPhoneDisplay('+9647712345678')).toBe('+9647712345678');
  });

  it('strips spaces and dashes', () => {
    expect(formatPhoneDisplay('0771-234-5678')).toBe('+9647712345678');
    expect(formatPhoneDisplay('077 1234 5678')).toBe('+9647712345678');
  });

  it('strips parentheses', () => {
    // '(077)12345678' → strip () → '07712345678' → local 0→964 → '+9647712345678'
    expect(formatPhoneDisplay('(077)12345678')).toBe('+9647712345678');
  });

  it('returns empty string for empty input', () => {
    expect(formatPhoneDisplay('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// isSuperAdminPhone
// ---------------------------------------------------------------------------

describe('isSuperAdminPhone', () => {
  it('returns false for null', () => {
    expect(isSuperAdminPhone(null)).toBe(false);
  });

  it('returns true for the local Iraqi format', () => {
    expect(isSuperAdminPhone('07838774435')).toBe(true);
  });

  it('returns true for the 964-prefixed format', () => {
    expect(isSuperAdminPhone('9647838774435')).toBe(true);
  });

  it('returns true for the + international format', () => {
    expect(isSuperAdminPhone('+9647838774435')).toBe(true);
  });

  it('returns false for a different number', () => {
    expect(isSuperAdminPhone('07712345678')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isSuperAdminPhone('')).toBe(false);
  });
});
