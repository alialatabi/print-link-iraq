/**
 * Pure cart merge + sanitization logic, extracted from CartContext so it can be unit-tested
 * without React or Supabase.
 *
 * localStorage stays the source of truth for instant UX. On login we MERGE the server cart into the
 * local one (LOCAL WINS on conflict — local is exactly what the user sees), and we sanitize whatever
 * the server returns before it can reach checkout (never trust a jsonb blob blindly).
 *
 * This module has NO runtime imports (both imports are type-only), so it stays free of React /
 * Supabase and is trivially testable.
 */
import type { CartItem } from '@/contexts/CartContext';
import type { AiCartPayload } from '@/lib/aiDesign';

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Minimal validation of the AI-design payload carried on an AI cart item. */
function isAiPayload(v: unknown): v is AiCartPayload {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  // imageUrl + productType are the load-bearing fields the checkout/designer pipeline relies on.
  return typeof p.imageUrl === 'string' && typeof p.productType === 'string';
}

/**
 * Coerce one untrusted entry into a valid CartItem (minus `lineId`, which the caller derives —
 * see CartContext's `withLineId`), or return null when it is malformed. The numeric fields feed
 * checkout pricing, so anything non-finite / out-of-range is rejected. Unknown extra properties
 * are dropped (only the known CartItem fields are copied).
 */
function normalizeItem(entry: unknown): Omit<CartItem, 'lineId'> | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;

  const templateId = e.templateId;
  if (typeof templateId !== 'string' || templateId.length === 0) return null;
  if (!isFiniteNumber(e.quantity) || e.quantity <= 0) return null;
  if (!isFiniteNumber(e.unitPrice) || e.unitPrice < 0) return null;
  if (!isFiniteNumber(e.minQuantity) || e.minQuantity <= 0) return null;

  const item: Omit<CartItem, 'lineId'> = {
    templateId,
    templateName: typeof e.templateName === 'string' ? e.templateName : '',
    serviceType: typeof e.serviceType === 'string' ? e.serviceType : '',
    previewUrl: typeof e.previewUrl === 'string' ? e.previewUrl : null,
    quantity: e.quantity,
    unitPrice: e.unitPrice,
    minQuantity: e.minQuantity,
  };
  if (typeof e.cellophane === 'string') item.cellophane = e.cellophane;
  // An entry that declares an aiDesign but whose payload is broken is dropped ENTIRELY — treating it
  // as a normal template item would corrupt the order (an AI item has no real template behind it).
  if (e.aiDesign !== undefined) {
    if (!isAiPayload(e.aiDesign)) return null;
    item.aiDesign = e.aiDesign;
  }
  return item;
}

/**
 * Validate + de-duplicate an untrusted `items` payload (e.g. the jsonb read from `public.carts`).
 * Never throws; returns [] for anything that is not an array of well-formed CartItems. On duplicate
 * templateIds the FIRST occurrence wins (mirrors the cart's key-by-templateId invariant).
 */
export function sanitizeCartItems(raw: unknown): Omit<CartItem, 'lineId'>[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Omit<CartItem, 'lineId'>[] = [];
  for (const entry of raw) {
    const item = normalizeItem(entry);
    if (item && !seen.has(item.templateId)) {
      seen.add(item.templateId);
      out.push(item);
    }
  }
  return out;
}

/**
 * Merge a local cart with a server cart, keyed by templateId. LOCAL WINS on conflict because local
 * is exactly what the user currently sees; server-only items (added on another device) are appended
 * after, preserving the user's current ordering. The result is de-duplicated by templateId. Inputs
 * are treated defensively (a non-array collapses to []).
 *
 * Generic so callers can pass full `CartItem[]` (has `lineId`) for `local` and the `lineId`-less
 * shape `sanitizeCartItems` returns for `server` — the caller (CartContext) re-derives `lineId` for
 * whichever items came from `server` via `withLineId` after merging.
 */
export function mergeCarts<T extends Omit<CartItem, 'lineId'>>(local: T[], server: T[]): T[] {
  const localArr = Array.isArray(local) ? local : [];
  const serverArr = Array.isArray(server) ? server : [];
  const byId = new Map<string, T>();
  for (const it of localArr) byId.set(it.templateId, it);                       // local first → local wins + keeps order
  for (const it of serverArr) if (!byId.has(it.templateId)) byId.set(it.templateId, it); // append server-only
  return Array.from(byId.values());
}
