/**
 * Display-level cleanup for the synced Al-Waseet city/region names. The upstream
 * catalog contains junk rows (`7647843`, `pd`, `_ ابوغريب مجمع كلية زراعة…`) that we
 * never want customers to see. Cleanup happens purely at read time — the DB rows stay
 * untouched and selection still saves the real Al-Waseet id.
 */

// Whitespace, underscores, and common Latin/Arabic punctuation stripped from the edges.
const EDGE_JUNK = /^[\s_.,،؛:;'"()[\]{}«»*+/\\|~^—–-]+|[\s_.,،؛:;'"()[\]{}«»*+/\\|~^—–-]+$/g;

// Arabic-script letters, including the Kurdish/Persian extensions used in Iraqi names
// (پ چ ڤ گ ک ۆ ێ ە …) but excluding the Arabic-Indic digits (٠-٩ / ۰-۹) so a
// digits-only row never counts as a real name.
const ARABIC_LETTER = /[ء-يٮ-ۓەۮۯۺ-ۿݐ-ݿ]/;

/** Trim whitespace, underscores, and stray punctuation from the edges of a name. */
export function cleanLocationName(raw: string): string {
  return raw.replace(EDGE_JUNK, '');
}

/** A name is displayable only if it contains at least one Arabic-script letter. */
export function isDisplayableLocationName(name: string): boolean {
  return ARABIC_LETTER.test(name);
}

/**
 * Sanitize a fetched locations list for display: clean each name, drop rows whose
 * cleaned name has no Arabic letters (pure digits / stray Latin like `pd`).
 * Ids are preserved untouched so selection keeps saving the real region id.
 */
export function sanitizeLocations<T extends { name: string }>(rows: T[]): T[] {
  return rows
    .map(row => ({ ...row, name: cleanLocationName(row.name) }))
    .filter(row => isDisplayableLocationName(row.name));
}
