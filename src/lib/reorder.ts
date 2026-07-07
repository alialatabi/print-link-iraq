// ─────────────────────────────────────────────────────────────────────────────
// Reorder helper — "إعادة الطلب"
//
// Turns the template-backed items of a past order into fresh cart items so a
// repeat customer can re-buy in one tap (My Orders / Order Tracking → cart).
//
// THE CONTRACT
//  - Prices are ALWAYS taken from the CURRENT services catalog (never the stale
//    snapshot stored on the old order), mirroring TemplateDetails: unit price is
//    the service price per `min_quantity`, after the current active discount
//    (sub_service > parent_service > global). Checkout later re-snapshots using
//    `priceOverride: item.unitPrice`, so keeping this current keeps totals right.
//  - A referenced template that no longer exists (deleted), or whose service is
//    gone (unpriceable), is reported as `skipped` instead of silently dropped.
//  - Non-template items (AI designs / uploads have `template_id: null`) are not
//    handled here — they are re-orderable from the Design Vault instead — and are
//    ignored (not counted as skipped).
//
// The core mapping (`buildReorderResult`) is pure so it is fully unit-testable;
// `resolveReorder` is the thin I/O wrapper the pages call.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';
import type { CartItem } from '@/contexts/CartContext';
import type { DbService } from '@/hooks/useServices';
import type { Discount } from '@/hooks/useDiscounts';

/** Minimal per-item input both pages can derive from an order's items. */
export interface ReorderSourceItem {
  /** `order_items.template_id` — null for AI/upload items (ignored by reorder). */
  templateId: string | null;
  /** `details.quantity` from the original line (re-used, normalized to catalog). */
  quantity?: number | null;
  /** `details.cellophane` from the original line ('matte' | 'glossy' | null). */
  cellophane?: string | null;
}

/** Current template row (existence + naming), fetched fresh at reorder time. */
export interface ReorderTemplateRow {
  id: string;
  name: string;
  service_type: string;
  preview_url: string | null;
}

export type SkipReason = 'unavailable';

export interface SkippedReorderItem {
  templateId: string;
  reason: SkipReason;
}

export interface ReorderResult {
  /** Cart-ready items priced at the CURRENT catalog, in source order. Fed directly into
   *  `useCart().addItem`, which computes `lineId` — reorder never resolves variant lines, so
   *  callers get the legacy (non-variant) shape. */
  items: Omit<CartItem, 'lineId'>[];
  /** Template items that could not be re-added (deleted / unpriceable). */
  skipped: SkippedReorderItem[];
}

const round = (n: number) => Math.round(n);

/**
 * Best applicable discount percent for a service, matching `useActiveDiscount`:
 * only active, in-window discounts count; priority sub_service > parent_service > global.
 */
export function resolveServiceDiscountPercent(
  service: Pick<DbService, 'id' | 'parent_id'>,
  discounts: Discount[],
  now: Date,
): number {
  const nowIso = now.toISOString();
  const active = discounts.filter((d) => {
    if (!d.is_active) return false;
    if (d.starts_at && d.starts_at > nowIso) return false;
    if (d.ends_at && d.ends_at < nowIso) return false;
    return true;
  });

  const bestOf = (pred: (d: Discount) => boolean): number =>
    active.reduce((best, d) => (pred(d) && d.percentage > best ? d.percentage : best), 0);

  const sub = bestOf((d) => d.discount_type === 'sub_service' && d.target_id === service.id);
  if (sub > 0) return sub;
  const parent = bestOf((d) => d.discount_type === 'parent_service' && d.target_id === service.parent_id);
  if (parent > 0) return parent;
  return bestOf((d) => d.discount_type === 'global');
}

/**
 * Resolve the cellophane choice to carry over. Mirrors TemplateDetails: 'none'
 * services carry no cellophane; fixed types are forced; 'both' keeps the
 * customer's previous choice when valid, else defaults to 'matte'.
 */
function resolveCellophane(cellophaneType: string | undefined, prev: string | null | undefined): string | undefined {
  if (!cellophaneType || cellophaneType === 'none') return undefined;
  if (cellophaneType === 'matte') return 'matte';
  if (cellophaneType === 'glossy') return 'glossy';
  return prev === 'glossy' ? 'glossy' : 'matte';
}

/**
 * Clamp/round a re-used quantity to a valid multiple of the service min quantity
 * (mirrors the TemplateDetails quantity stepper), defaulting to the minimum.
 */
function normalizeQuantity(q: number | null | undefined, minQuantity: number): number {
  const minQ = minQuantity > 0 ? minQuantity : 1000;
  const raw = typeof q === 'number' && q > 0 ? q : minQ;
  return Math.max(minQ, round(raw / minQ) * minQ);
}

/**
 * Pure mapping from a past order's items + the CURRENT catalog to cart items.
 * Deterministic and I/O-free so it can be exhaustively unit-tested.
 */
export function buildReorderResult(input: {
  source: ReorderSourceItem[];
  templates: ReorderTemplateRow[];
  services: DbService[];
  discounts?: Discount[];
  now?: Date;
}): ReorderResult {
  const { source, templates, services, discounts = [], now = new Date() } = input;
  const templatesById = new Map(templates.map((t) => [t.id, t]));
  const servicesById = new Map(services.map((s) => [s.id, s]));

  const items: Omit<CartItem, 'lineId'>[] = [];
  const skipped: SkippedReorderItem[] = [];
  const seen = new Set<string>();

  for (const src of source) {
    const templateId = src.templateId;
    // Non-template items (AI/upload) are handled by the Design Vault, not here.
    if (!templateId) continue;
    // The cart keys by templateId, so a template can appear at most once.
    if (seen.has(templateId)) continue;
    seen.add(templateId);

    const tpl = templatesById.get(templateId);
    const svc = tpl ? servicesById.get(tpl.service_type) : undefined;
    if (!tpl || !svc) {
      skipped.push({ templateId, reason: 'unavailable' });
      continue;
    }

    const discountPct = resolveServiceDiscountPercent(svc, discounts, now);
    const basePrice = svc.price || 0;
    const unitPrice = discountPct > 0 ? Math.ceil(basePrice * (1 - discountPct / 100)) : basePrice;
    const minQuantity = svc.min_quantity || 1000;

    items.push({
      templateId: tpl.id,
      templateName: tpl.name,
      serviceType: tpl.service_type,
      previewUrl: tpl.preview_url,
      quantity: normalizeQuantity(src.quantity, minQuantity),
      unitPrice,
      minQuantity,
      cellophane: resolveCellophane(svc.cellophane_type, src.cellophane),
    });
  }

  return { items, skipped };
}

/**
 * Resolve a past order's items into cart-ready items using freshly-fetched
 * catalog data (templates by id, all services, active discounts). Throws on a
 * transient fetch error (so callers show a retry toast rather than a misleading
 * "no longer available"); a genuinely-deleted template resolves to `skipped`.
 */
export async function resolveReorder(source: ReorderSourceItem[]): Promise<ReorderResult> {
  const templateIds = [...new Set(source.map((s) => s.templateId).filter((id): id is string => !!id))];
  if (templateIds.length === 0) return { items: [], skipped: [] };

  const [templatesRes, servicesRes, discountsRes] = await Promise.all([
    supabase.from('templates').select('id, name, service_type, preview_url').in('id', templateIds),
    supabase.from('services').select('*'),
    // `discounts` is not in the generated types yet (type drift) — matches useDiscounts.
    supabase.from('discounts' as never).select('*').eq('is_active', true),
  ]);

  // Distinguish a transient failure from a genuinely-missing template.
  if (templatesRes.error) throw templatesRes.error;
  if (servicesRes.error) throw servicesRes.error;

  return buildReorderResult({
    source,
    templates: (templatesRes.data ?? []) as unknown as ReorderTemplateRow[],
    services: (servicesRes.data ?? []) as unknown as DbService[],
    discounts: (discountsRes.data ?? []) as unknown as Discount[],
    now: new Date(),
  });
}
