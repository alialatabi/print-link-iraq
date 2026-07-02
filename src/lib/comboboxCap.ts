// Pure filter + cap logic for the LocationSelect comboboxes. Baghdad has ~750 مناطق;
// cmdk keeps every registered <CommandItem> mounted (it only hides non-matches via CSS),
// so a 750-item list janks the popover open on cheap Android. The only way to cut the
// mount cost is to own the filtering and render a small capped slice. Kept dependency-free
// and pure so it is unit-testable.

/**
 * Normalize Arabic text for forgiving substring search: fold alef/hamza/ya/ta-marbuta
 * variants, strip tashkeel (diacritics) + tatweel, and lowercase. This lets a user find
 * "الكرادة" by typing "كراده" (no hamza, ha for ta-marbuta) or an undiacritized name.
 */
export function normalizeArabic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, '') // tashkeel (fatha…sukun) + superscript alef
    .replace(/ـ/g, '') //               tatweel ـ
    .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ → ا
    .replace(/ى/g, 'ي') //          ى → ي
    .replace(/ة/g, 'ه') //          ة → ه
    .trim();
}

export interface CappedItems<T> {
  /** Items to actually render (length ≤ max). */
  items: T[];
  /** Total number of items matching the query, before the cap. */
  total: number;
  /** True when the cap hid some matches (total > max). */
  capped: boolean;
}

/**
 * Filter `all` by `query` (Arabic-normalized substring on `name`) and cap the result to
 * `max` rendered items. The currently-selected item (`currentId`) is kept in the rendered
 * slice whenever it still matches the query, so an existing selection stays visible and
 * re-selectable even when the list is truncated.
 */
export function capMatches<T extends { id: number; name: string }>(
  all: T[],
  query: string,
  currentId: number | null,
  max: number,
): CappedItems<T> {
  const q = normalizeArabic(query);
  const matches = q ? all.filter((it) => normalizeArabic(it.name).includes(q)) : all;

  const total = matches.length;
  const capped = total > max;
  if (!capped) return { items: matches, total, capped };

  let items = matches.slice(0, max);
  // Keep the current selection visible/selectable when it matched but the cap truncated
  // it out — pin it first and drop the last slot so the rendered length stays `max`.
  if (currentId != null && !items.some((it) => it.id === currentId)) {
    const current = matches.find((it) => it.id === currentId);
    if (current) items = [current, ...items.slice(0, max - 1)];
  }
  return { items, total, capped };
}
