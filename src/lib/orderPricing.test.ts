/**
 * Characterization tests for src/lib/orderPricing.ts
 *
 * These tests lock in the CURRENT behavior so that later refactors
 * (Phase 1/2) can be verified against this snapshot.  Surprising behaviors
 * are called out with NOTE comments rather than corrected.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCatalog,
  buildPricingSnapshot,
  computeLine,
} from './orderPricing';
import type { Catalog } from './orderPricing';
import type { DbService } from '@/hooks/useServices';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeService = (overrides: Partial<DbService> = {}): DbService => ({
  id: 'svc-bc',
  label: 'كارت شخصي',
  icon: '🖨',
  icon_url: null,
  description: '',
  sort_order: 1,
  price: 10000,
  cost: 5000,
  parent_id: null,
  completion_days: 3,
  min_quantity: 1000,
  cellophane_type: 'none',
  ...overrides,
});

/** A minimal test catalog used across snapshot tests. */
const catalog: Catalog = {
  'business_card': { price: 10000, cost: 5000, min_quantity: 1000 },
  'banner':        { price: 50000, cost: 25000, min_quantity: 1   },
  'flyer':         { price: 20000, cost: 8000,  min_quantity: 500  },
};

// ---------------------------------------------------------------------------
// buildCatalog
// ---------------------------------------------------------------------------

describe('buildCatalog', () => {
  it('maps each service to a price/cost/min_quantity entry', () => {
    const services = [
      makeService({ id: 'bc', price: 10000, cost: 5000, min_quantity: 1000 }),
      makeService({ id: 'banner', price: 50000, cost: 25000, min_quantity: 1 }),
    ];
    const cat = buildCatalog(services);
    expect(cat['bc']).toEqual({ price: 10000, cost: 5000, min_quantity: 1000 });
    expect(cat['banner']).toEqual({ price: 50000, cost: 25000, min_quantity: 1 });
  });

  it('coerces null price/cost to 0 (|| 0)', () => {
    const services = [
      makeService({ id: 'free', price: null as unknown as number, cost: null as unknown as number }),
    ];
    const cat = buildCatalog(services);
    expect(cat['free'].price).toBe(0);
    expect(cat['free'].cost).toBe(0);
  });

  it('coerces null/0 min_quantity to 1000 (|| 1000)', () => {
    const s1 = makeService({ id: 'z', min_quantity: null as unknown as number });
    const s2 = makeService({ id: 'z2', min_quantity: 0 });
    const cat = buildCatalog([s1, s2]);
    expect(cat['z'].min_quantity).toBe(1000);
    expect(cat['z2'].min_quantity).toBe(1000);
  });

  it('returns an empty catalog for an empty services list', () => {
    expect(buildCatalog([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// buildPricingSnapshot
// ---------------------------------------------------------------------------

describe('buildPricingSnapshot', () => {
  // --- Basic shape ---

  it('returns the correct shape at exact min_quantity (factor=1)', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 1000);
    expect(snap).toMatchObject({
      service_type: 'business_card',
      quantity: 1000,
      min_quantity: 1000,
      unit_price: 10000,
      unit_cost: 5000,
      line_total: 10000,
      line_cost: 5000,
    });
    // No discount → discount_pct field absent
    expect(snap.discount_pct).toBeUndefined();
  });

  it('scales line_total and line_cost by quantity factor (2× minQ)', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 2000);
    expect(snap.quantity).toBe(2000);
    expect(snap.line_total).toBe(20000); // 10000 * 2
    expect(snap.line_cost).toBe(10000);  // 5000 * 2
  });

  it('scales fractional quantities correctly (1.5× minQ)', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 1500);
    // factor = 1500/1000 = 1.5; Math.round(10000 * 1.5) = 15000
    expect(snap.quantity).toBe(1500);
    expect(snap.line_total).toBe(15000);
    expect(snap.line_cost).toBe(7500); // Math.round(5000 * 1.5)
  });

  it('handles min_quantity=1 services (e.g. banner — ordered 10 units)', () => {
    const snap = buildPricingSnapshot(catalog, 'banner', 10);
    // factor = 10/1 = 10; line_total = 50000 * 10 = 500000
    expect(snap.min_quantity).toBe(1);
    expect(snap.line_total).toBe(500000);
    expect(snap.line_cost).toBe(250000);
  });

  it('handles a non-round min_quantity (flyer: minQ=500, order 750)', () => {
    const snap = buildPricingSnapshot(catalog, 'flyer', 750);
    // factor = 750/500 = 1.5; line_total = round(20000 * 1.5) = 30000
    expect(snap.min_quantity).toBe(500);
    expect(snap.line_total).toBe(30000);
    expect(snap.line_cost).toBe(12000); // round(8000 * 1.5)
  });

  // --- Discount ---

  it('applies discountPct to unit_price and records discount_pct field', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 1000, { discountPct: 10 });
    // unitPrice = round(10000 * (1 - 0.10)) = round(9000) = 9000
    expect(snap.unit_price).toBe(9000);
    expect(snap.line_total).toBe(9000);
    expect(snap.discount_pct).toBe(10);
    // cost is NOT discounted
    expect(snap.unit_cost).toBe(5000);
    expect(snap.line_cost).toBe(5000);
  });

  it('applies 25% discount across a 2× order', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 2000, { discountPct: 25 });
    // unitPrice = round(10000 * 0.75) = 7500
    // line_total = round(7500 * 2) = 15000
    expect(snap.unit_price).toBe(7500);
    expect(snap.line_total).toBe(15000);
    expect(snap.discount_pct).toBe(25);
  });

  it('discountPct=0 leaves unit_price unchanged and discount_pct absent', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 1000, { discountPct: 0 });
    expect(snap.unit_price).toBe(10000);
    expect(snap.discount_pct).toBeUndefined();
  });

  // --- priceOverride ---

  it('priceOverride substitutes the catalog price entirely', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 1000, { priceOverride: 8000 });
    expect(snap.unit_price).toBe(8000);
    expect(snap.line_total).toBe(8000);
    expect(snap.discount_pct).toBeUndefined();
  });

  it('discount is applied ON TOP of priceOverride', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 1000, {
      priceOverride: 10000,
      discountPct: 20,
    });
    // unitPrice = round(10000 * 0.80) = 8000
    expect(snap.unit_price).toBe(8000);
    expect(snap.discount_pct).toBe(20);
  });

  // --- Edge: unknown service ---

  it('falls back to zero price/cost for unknown service type', () => {
    const snap = buildPricingSnapshot(catalog, 'nonexistent', 1000);
    expect(snap.unit_price).toBe(0);
    expect(snap.unit_cost).toBe(0);
    expect(snap.line_total).toBe(0);
    expect(snap.line_cost).toBe(0);
    // min_quantity defaults to 1000 for unknown service
    expect(snap.min_quantity).toBe(1000);
  });

  // --- Edge: quantity=0 falls back to min_quantity ---

  it('quantity=0 falls back to min_quantity (|| minQ)', () => {
    const snap = buildPricingSnapshot(catalog, 'business_card', 0);
    // NOTE: quantity=0 is treated as "use minQ" — equivalent to ordering minQ
    expect(snap.quantity).toBe(1000);
    expect(snap.line_total).toBe(10000);
  });

  // --- Edge: quantity below min_quantity ---

  it('quantity below min_quantity produces a sub-unit factor (no minimum enforcement)', () => {
    // NOTE: buildPricingSnapshot does NOT enforce a quantity floor.
    // Ordering 500 with minQ=1000 gives factor=0.5.
    const snap = buildPricingSnapshot(catalog, 'business_card', 500);
    expect(snap.quantity).toBe(500);
    expect(snap.line_total).toBe(5000); // Math.round(10000 * 0.5)
    expect(snap.line_cost).toBe(2500);
  });

  // --- Edge: catalog entry has min_quantity=0 (coerced to 1000) ---

  it('catalog entry with min_quantity=0 is treated as 1000', () => {
    const cat2: Catalog = { weird: { price: 5000, cost: 2000, min_quantity: 0 } };
    const snap = buildPricingSnapshot(cat2, 'weird', 1000);
    // minQ = 0 || 1000 = 1000; factor = 1000/1000 = 1
    expect(snap.min_quantity).toBe(1000);
    expect(snap.line_total).toBe(5000);
  });

  // --- Rounding ---

  it('rounds line_total with Math.round (nearest integer)', () => {
    // unitPrice=3, quantity=2, minQ=3 → factor=2/3; line_total=round(3 * 2/3)=round(2)=2
    const cat3: Catalog = { 'svc': { price: 3, cost: 1, min_quantity: 3 } };
    const snap = buildPricingSnapshot(cat3, 'svc', 2);
    expect(snap.line_total).toBe(2); // Math.round(2.0)
  });

  it('rounds 0.5 up (Math.round behaviour)', () => {
    // price=1001, quantity=1, minQ=2 → factor=0.5; line_total=round(1001*0.5)=round(500.5)=501
    const cat4: Catalog = { 'svc': { price: 1001, cost: 100, min_quantity: 2 } };
    const snap = buildPricingSnapshot(cat4, 'svc', 1);
    expect(snap.line_total).toBe(501);
  });
});

// ---------------------------------------------------------------------------
// computeLine
// ---------------------------------------------------------------------------

describe('computeLine', () => {
  // --- Snapshot path ---

  it('returns snapshot values (hasSnapshot=true) when pricing is present', () => {
    const details = {
      pricing: {
        service_type: 'business_card',
        quantity: 1000,
        min_quantity: 1000,
        unit_price: 10000,
        unit_cost: 5000,
        line_total: 10000,
        line_cost: 5000,
      },
    };
    const line = computeLine(details, catalog);
    expect(line).toEqual({
      revenue: 10000,
      cost: 5000,
      serviceType: 'business_card',
      quantity: 1000,
      hasSnapshot: true,
    });
  });

  it('uses snapshot even when a fallbackServiceType is provided', () => {
    const details = {
      pricing: {
        service_type: 'flyer',
        quantity: 500,
        min_quantity: 500,
        unit_price: 20000,
        unit_cost: 8000,
        line_total: 20000,
        line_cost: 8000,
      },
    };
    const line = computeLine(details, catalog, 'business_card');
    expect(line.serviceType).toBe('flyer'); // snapshot wins
    expect(line.hasSnapshot).toBe(true);
  });

  it('handles snapshot with discount_pct (discount does not affect computeLine output)', () => {
    const details = {
      pricing: {
        service_type: 'business_card',
        quantity: 1000,
        min_quantity: 1000,
        unit_price: 9000,
        unit_cost: 5000,
        line_total: 9000,
        line_cost: 5000,
        discount_pct: 10,
      },
    };
    const line = computeLine(details, catalog);
    expect(line.revenue).toBe(9000);
    expect(line.hasSnapshot).toBe(true);
  });

  // --- Legacy (no snapshot) path ---

  it('derives revenue from catalog when no snapshot (legacy row)', () => {
    const details = { service_type: 'business_card', quantity: 2000 };
    const line = computeLine(details, catalog);
    // factor = 2000/1000 = 2; revenue = round(10000*2) = 20000
    expect(line.revenue).toBe(20000);
    expect(line.cost).toBe(10000);
    expect(line.serviceType).toBe('business_card');
    expect(line.quantity).toBe(2000);
    expect(line.hasSnapshot).toBe(false);
  });

  it('uses fallbackServiceType when details has no service_type', () => {
    const details = { quantity: 1000 };
    const line = computeLine(details, catalog, 'business_card');
    expect(line.serviceType).toBe('business_card');
    expect(line.revenue).toBe(10000);
    expect(line.hasSnapshot).toBe(false);
  });

  it('details.service_type takes precedence over fallbackServiceType', () => {
    const details = { service_type: 'flyer', quantity: 500 };
    const line = computeLine(details, catalog, 'business_card');
    expect(line.serviceType).toBe('flyer'); // details wins
  });

  it('returns zeros when service_type not in catalog (legacy unknown)', () => {
    const details = { service_type: 'unknown_svc', quantity: 1000 };
    const line = computeLine(details, catalog);
    expect(line.revenue).toBe(0);
    expect(line.cost).toBe(0);
    expect(line.hasSnapshot).toBe(false);
  });

  it('returns zeros when quantity is 0 (legacy)', () => {
    const details = { service_type: 'business_card', quantity: 0 };
    const line = computeLine(details, catalog);
    // c exists but quantity is 0 → `c && quantity` is falsy
    expect(line.revenue).toBe(0);
    expect(line.quantity).toBe(0);
    expect(line.hasSnapshot).toBe(false);
  });

  it('returns zeros for empty details object', () => {
    const line = computeLine({}, catalog);
    expect(line.revenue).toBe(0);
    expect(line.cost).toBe(0);
    expect(line.serviceType).toBe('');
    expect(line.quantity).toBe(0);
    expect(line.hasSnapshot).toBe(false);
  });

  it('returns zeros for null details', () => {
    const line = computeLine(null, catalog);
    expect(line.revenue).toBe(0);
    expect(line.hasSnapshot).toBe(false);
  });

  it('ignores a snapshot whose line_total is not a number', () => {
    const details = {
      pricing: {
        service_type: 'business_card',
        quantity: 1000,
        line_total: 'NaN', // invalid
        line_cost: 5000,
      },
    };
    const line = computeLine(details, catalog);
    // Falls through to legacy path (typeof line_total !== 'number')
    expect(line.hasSnapshot).toBe(false);
  });

  it('uses fallback from catalog when pricing.line_total is missing', () => {
    const details = {
      service_type: 'business_card',
      quantity: 1000,
      pricing: { service_type: 'business_card' }, // no line_total
    };
    const line = computeLine(details, catalog);
    expect(line.hasSnapshot).toBe(false);
    expect(line.revenue).toBe(10000); // derived from catalog
  });
});
