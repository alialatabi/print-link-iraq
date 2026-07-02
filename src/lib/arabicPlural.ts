/**
 * Arabic number–noun agreement for "منتج" (product) counts.
 *
 * Arabic agreement is not a binary singular/plural — the noun form depends on
 * the count bucket:
 *   1     → bare singular + واحد                ("منتج واحد")
 *   2     → dual, no numeral                    ("منتجان")
 *   3–10  → numeral + sound plural              ("5 منتجات")
 *   11+   → numeral + accusative singular       ("15 منتجاً")
 *
 * Counts outside the callers' domain (0, negatives, fractions) fall through to
 * the 11+ tamyeez form — every current caller guards for count ≥ 1.
 */
export function formatProductCount(n: number): string {
  if (n === 1) return 'منتج واحد';
  if (n === 2) return 'منتجان';
  if (n >= 3 && n <= 10) return `${n} منتجات`;
  return `${n} منتجاً`;
}
