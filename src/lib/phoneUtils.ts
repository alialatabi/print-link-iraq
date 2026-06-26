/**
 * Shared phone-number utilities for the print-link-iraq app.
 *
 * All functions are pure (no I/O) and trivially unit-testable.
 * The canonical copy lives here; old inline copies in biometric.ts,
 * ChangePhoneDialog, AdminPanel, and AdminCustomers delegate to these.
 */

/**
 * Strip whitespace and normalise the Iraq dialling prefix:
 *   - removes ALL whitespace (spaces, tabs, newlines)
 *   - replaces a single leading `0` with `964`
 *
 * Identical to every inlined copy in the codebase.
 */
export const normalizePhone = (p: string): string =>
  p.replace(/\s+/g, '').replace(/^0/, '964');

/**
 * Format a raw phone number for use in tel: and wa.me links.
 * Strips spaces/dashes/parens, converts Iraqi local `0…` to `964…`,
 * then prepends `+` so browsers and WhatsApp can dial directly.
 *
 * Derived verbatim from `formatPhone` in AdminCustomers.tsx.
 * Accepts null (returns '') because it is always called with nullable DB values.
 */
export const formatPhoneDisplay = (phone: string | null): string => {
  if (!phone) return '';
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('0')) p = '964' + p.slice(1); // Iraqi local → country code
  if (!p.startsWith('+')) p = '+' + p;
  return p;
};

/**
 * True when `phone` belongs to the single super-admin number (07838774435).
 * Accepts any common representation: 07838774435, 9647838774435, +9647838774435.
 *
 * Derived verbatim from `isSuperAdminPhone` in AdminPanel.tsx:
 *   strip non-digits → normalise 964 prefix to 0 → normalise 00 prefix to 0
 *   → compare to the canonical local format '07838774435'.
 */
export const isSuperAdminPhone = (phone: string | null): boolean => {
  if (!phone) return false;
  const norm = (p: string) =>
    p.replace(/\D/g, '').replace(/^964/, '0').replace(/^00/, '0');
  return norm(phone) === '07838774435';
};
