// ─────────────────────────────────────────────────────────────────────────────
// Order pricing snapshots — single source of truth for what an order/line was
// actually charged, so accounting never has to re-derive money from the *current*
// (mutable) services catalog.
//
// THE CONTRACT
// Every order-creation path stores an immutable `pricing` snapshot inside the
// row's `details` JSON (on `orders` for single-item/reseller/upload/AI-direct
// orders, and on each `order_items` row for cart orders). Existing `details`
// fields are preserved — `pricing` is purely additive.
//
//   details.pricing: PricingSnapshot
//
// Accounting reads `pricing` when present and ONLY falls back to the live catalog
// for legacy rows that predate snapshots (best-effort, clearly flagged via
// `hasSnapshot: false`).
// ─────────────────────────────────────────────────────────────────────────────

import type { DbService } from '@/hooks/useServices';

/** Immutable record of what a single order line was charged at order time. */
export interface PricingSnapshot {
  service_type: string;
  quantity: number;
  /** Catalog min order quantity that `unit_price`/`unit_cost` are expressed per. */
  min_quantity: number;
  /** Charged price per `min_quantity`, AFTER any discount. */
  unit_price: number;
  /** Production cost per `min_quantity` at order time. */
  unit_cost: number;
  /** Revenue for this line = unit_price / min_quantity × quantity (rounded). */
  line_total: number;
  /** COGS for this line = unit_cost / min_quantity × quantity (rounded). */
  line_cost: number;
  /** Discount percent applied to reach `unit_price` (0–100), if any. */
  discount_pct?: number;
}

interface CatalogEntry { price: number; cost: number; min_quantity: number; }
export type Catalog = Record<string, CatalogEntry>;

/** Build a fast {serviceId → price/cost/minQ} map from the services list. */
export function buildCatalog(services: DbService[]): Catalog {
  return Object.fromEntries(
    services.map(s => [s.id, {
      price: s.price || 0,
      cost: s.cost || 0,
      min_quantity: s.min_quantity || 1000,
    }]),
  );
}

const round = (n: number) => Math.round(n);

/**
 * Build an immutable snapshot from the catalog at order time.
 * `discountPct` (0–100) reduces the unit price; `priceOverride` lets reseller /
 * negotiated flows substitute their own charged unit price (per min_quantity).
 */
export function buildPricingSnapshot(
  catalog: Catalog,
  serviceType: string,
  quantity: number,
  opts: { discountPct?: number; priceOverride?: number } = {},
): PricingSnapshot {
  const c = catalog[serviceType] || { price: 0, cost: 0, min_quantity: 1000 };
  const minQ = c.min_quantity || 1000;
  const qty = quantity || minQ;
  const factor = qty / minQ;
  const discountPct = opts.discountPct ?? 0;
  const base = opts.priceOverride ?? c.price;
  const unitPrice = discountPct > 0 ? round(base * (1 - discountPct / 100)) : base;
  return {
    service_type: serviceType,
    quantity: qty,
    min_quantity: minQ,
    unit_price: unitPrice,
    unit_cost: c.cost,
    line_total: round(unitPrice * factor),
    line_cost: round(c.cost * factor),
    discount_pct: discountPct > 0 ? discountPct : undefined,
  };
}

/** A resolved revenue/cost line for accounting aggregation. */
export interface RevenueLine {
  revenue: number;
  cost: number;
  serviceType: string;
  quantity: number;
  /** false when values were estimated from the live catalog (legacy row). */
  hasSnapshot: boolean;
}

/**
 * Resolve one revenue line from a row's `details`, preferring the stored
 * snapshot and falling back to the live catalog for legacy rows.
 * `fallbackServiceType` is the service resolved from a template join (used when
 * the legacy row has no snapshot and no `details.service_type`).
 */
export function computeLine(
  details: any,
  catalog: Catalog,
  fallbackServiceType = '',
): RevenueLine {
  const snap = details?.pricing as PricingSnapshot | undefined;
  if (snap && typeof snap.line_total === 'number') {
    return {
      revenue: snap.line_total,
      cost: snap.line_cost || 0,
      serviceType: snap.service_type || fallbackServiceType,
      quantity: snap.quantity || 0,
      hasSnapshot: true,
    };
  }
  // Legacy fallback: derive from catalog using resolved service type + quantity.
  const serviceType = details?.service_type || fallbackServiceType || '';
  const quantity = details?.quantity || 0;
  const c = catalog[serviceType];
  if (c && quantity) {
    const factor = quantity / (c.min_quantity || 1000);
    return {
      revenue: round(c.price * factor),
      cost: round(c.cost * factor),
      serviceType,
      quantity,
      hasSnapshot: false,
    };
  }
  return { revenue: 0, cost: 0, serviceType, quantity, hasSnapshot: false };
}
