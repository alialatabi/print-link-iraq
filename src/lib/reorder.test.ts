/**
 * Unit tests for src/lib/reorder.ts
 *
 * The core mapping (`buildReorderResult`) and discount resolution
 * (`resolveServiceDiscountPercent`) are pure and tested exhaustively.
 * The `resolveReorder` I/O wrapper is covered with the shared supabase mock,
 * driving the three table reads (templates / services / discounts) via
 * per-call query builders (same pattern as services/orders.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is in place.
import {
  buildReorderResult,
  resolveServiceDiscountPercent,
  resolveReorder,
  type ReorderTemplateRow,
} from './reorder';
import type { DbService } from '@/hooks/useServices';
import type { Discount } from '@/hooks/useDiscounts';

// ---------------------------------------------------------------------------
// Fixtures
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

const makeTemplate = (overrides: Partial<ReorderTemplateRow> = {}): ReorderTemplateRow => ({
  id: 'tpl-1',
  name: 'قالب كارت',
  service_type: 'svc-bc',
  preview_url: 'https://cdn/x.png',
  ...overrides,
});

const NOW = new Date('2026-07-02T12:00:00Z');

// ---------------------------------------------------------------------------
// buildReorderResult — happy path
// ---------------------------------------------------------------------------

describe('buildReorderResult', () => {
  it('maps a valid template item to a cart item at the CURRENT service price', () => {
    const { items, skipped } = buildReorderResult({
      source: [{ templateId: 'tpl-1', quantity: 2000, cellophane: null }],
      templates: [makeTemplate()],
      services: [makeService({ price: 12000 })], // price changed since the order
      now: NOW,
    });

    expect(skipped).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      templateId: 'tpl-1',
      templateName: 'قالب كارت',
      serviceType: 'svc-bc',
      previewUrl: 'https://cdn/x.png',
      quantity: 2000,
      unitPrice: 12000, // CURRENT price, not any stale snapshot
      minQuantity: 1000,
    });
    // 'none' cellophane services carry no cellophane
    expect(items[0].cellophane).toBeUndefined();
  });

  it('defaults quantity to the service minimum when the source omits it', () => {
    const { items } = buildReorderResult({
      source: [{ templateId: 'tpl-1' }],
      templates: [makeTemplate()],
      services: [makeService({ min_quantity: 500 })],
      now: NOW,
    });
    expect(items[0].quantity).toBe(500);
  });

  it('rounds/clamps quantity to a valid multiple of min_quantity', () => {
    const { items } = buildReorderResult({
      source: [{ templateId: 'tpl-1', quantity: 1400 }], // → nearest 1000 multiple = 1000
      templates: [makeTemplate()],
      services: [makeService({ min_quantity: 1000 })],
      now: NOW,
    });
    expect(items[0].quantity).toBe(1000);
  });

  // ---- cellophane resolution ------------------------------------------------

  it('forces the fixed cellophane type when the service pins one', () => {
    const { items } = buildReorderResult({
      source: [{ templateId: 'tpl-1', cellophane: null }],
      templates: [makeTemplate()],
      services: [makeService({ cellophane_type: 'glossy' })],
      now: NOW,
    });
    expect(items[0].cellophane).toBe('glossy');
  });

  it("preserves the customer's previous cellophane for a 'both' service, defaulting to matte", () => {
    const svc = [makeService({ cellophane_type: 'both' })];
    const keepGlossy = buildReorderResult({
      source: [{ templateId: 'tpl-1', cellophane: 'glossy' }],
      templates: [makeTemplate()], services: svc, now: NOW,
    });
    expect(keepGlossy.items[0].cellophane).toBe('glossy');

    const defaultMatte = buildReorderResult({
      source: [{ templateId: 'tpl-1', cellophane: null }],
      templates: [makeTemplate()], services: svc, now: NOW,
    });
    expect(defaultMatte.items[0].cellophane).toBe('matte');
  });

  // ---- skipping / filtering -------------------------------------------------

  it('skips a template that no longer exists (deleted) as unavailable', () => {
    const { items, skipped } = buildReorderResult({
      source: [{ templateId: 'ghost' }],
      templates: [], // not returned by the id query => deleted
      services: [makeService()],
      now: NOW,
    });
    expect(items).toEqual([]);
    expect(skipped).toEqual([{ templateId: 'ghost', reason: 'unavailable' }]);
  });

  it('skips a template whose service is gone (unpriceable) as unavailable', () => {
    const { items, skipped } = buildReorderResult({
      source: [{ templateId: 'tpl-1' }],
      templates: [makeTemplate({ service_type: 'svc-removed' })],
      services: [makeService({ id: 'svc-bc' })], // no 'svc-removed'
      now: NOW,
    });
    expect(items).toEqual([]);
    expect(skipped[0]).toEqual({ templateId: 'tpl-1', reason: 'unavailable' });
  });

  it('ignores non-template (AI/upload) items without counting them as skipped', () => {
    const { items, skipped } = buildReorderResult({
      source: [{ templateId: null }, { templateId: 'tpl-1' }],
      templates: [makeTemplate()],
      services: [makeService()],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it('dedupes a template referenced more than once (cart keys by templateId)', () => {
    const { items } = buildReorderResult({
      source: [
        { templateId: 'tpl-1', quantity: 1000 },
        { templateId: 'tpl-1', quantity: 3000 },
      ],
      templates: [makeTemplate()],
      services: [makeService()],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1000); // first occurrence wins
  });

  it('handles a mix of re-addable and unavailable items in one order', () => {
    const { items, skipped } = buildReorderResult({
      source: [{ templateId: 'tpl-1' }, { templateId: 'gone' }, { templateId: null }],
      templates: [makeTemplate()],
      services: [makeService()],
      now: NOW,
    });
    expect(items.map((i) => i.templateId)).toEqual(['tpl-1']);
    expect(skipped.map((s) => s.templateId)).toEqual(['gone']);
  });

  // ---- discounts (must mirror TemplateDetails so totals stay correct) --------

  it('applies an active sub_service discount to the unit price (ceil)', () => {
    const discounts: Discount[] = [
      { id: 'd1', discount_type: 'sub_service', target_id: 'svc-bc', percentage: 25, is_active: true, starts_at: null, ends_at: null, created_at: '' },
    ];
    const { items } = buildReorderResult({
      source: [{ templateId: 'tpl-1' }],
      templates: [makeTemplate()],
      services: [makeService({ price: 10001 })],
      discounts,
      now: NOW,
    });
    // ceil(10001 * 0.75) = ceil(7500.75) = 7501
    expect(items[0].unitPrice).toBe(7501);
  });

  it('ignores a discount that is outside its date window', () => {
    const discounts: Discount[] = [
      { id: 'd1', discount_type: 'global', target_id: null, percentage: 50, is_active: true, starts_at: null, ends_at: '2026-01-01T00:00:00Z', created_at: '' },
    ];
    const { items } = buildReorderResult({
      source: [{ templateId: 'tpl-1' }],
      templates: [makeTemplate()],
      services: [makeService({ price: 10000 })],
      discounts,
      now: NOW,
    });
    expect(items[0].unitPrice).toBe(10000); // expired => full price
  });
});

// ---------------------------------------------------------------------------
// resolveServiceDiscountPercent — priority + windowing
// ---------------------------------------------------------------------------

describe('resolveServiceDiscountPercent', () => {
  const svc = { id: 'svc-bc', parent_id: 'cat-cards' };

  it('prefers sub_service over parent_service over global', () => {
    const discounts: Discount[] = [
      { id: 'g', discount_type: 'global', target_id: null, percentage: 5, is_active: true, starts_at: null, ends_at: null, created_at: '' },
      { id: 'p', discount_type: 'parent_service', target_id: 'cat-cards', percentage: 10, is_active: true, starts_at: null, ends_at: null, created_at: '' },
      { id: 's', discount_type: 'sub_service', target_id: 'svc-bc', percentage: 20, is_active: true, starts_at: null, ends_at: null, created_at: '' },
    ];
    expect(resolveServiceDiscountPercent(svc, discounts, NOW)).toBe(20);
    // remove sub => parent wins
    expect(resolveServiceDiscountPercent(svc, discounts.filter((d) => d.id !== 's'), NOW)).toBe(10);
    // remove sub+parent => global wins
    expect(resolveServiceDiscountPercent(svc, discounts.filter((d) => d.discount_type === 'global'), NOW)).toBe(5);
  });

  it('ignores inactive discounts', () => {
    const discounts: Discount[] = [
      { id: 's', discount_type: 'sub_service', target_id: 'svc-bc', percentage: 30, is_active: false, starts_at: null, ends_at: null, created_at: '' },
    ];
    expect(resolveServiceDiscountPercent(svc, discounts, NOW)).toBe(0);
  });

  it('returns 0 when nothing applies', () => {
    expect(resolveServiceDiscountPercent(svc, [], NOW)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveReorder — I/O wrapper (mocked supabase)
// ---------------------------------------------------------------------------

/** Awaitable query builder that resolves to a fixed { data, error }. */
function tableBuilder(data: unknown, error: unknown = null) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'eq', 'order']) b[m] = vi.fn(() => b);
  b['then'] = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(res, rej);
  return b;
}

const fromMock = () => mockSupabase.from as ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

describe('resolveReorder', () => {
  it('short-circuits with no query when there are no template ids', async () => {
    const result = await resolveReorder([{ templateId: null }]);
    expect(result).toEqual({ items: [], skipped: [] });
    expect(fromMock()).not.toHaveBeenCalled();
  });

  it('fetches templates/services/discounts and builds cart items at current price', async () => {
    fromMock()
      .mockReturnValueOnce(tableBuilder([makeTemplate()]))              // templates
      .mockReturnValueOnce(tableBuilder([makeService({ price: 15000 })])) // services
      .mockReturnValueOnce(tableBuilder([]));                            // discounts

    const { items, skipped } = await resolveReorder([{ templateId: 'tpl-1', quantity: 2000 }]);

    expect(fromMock()).toHaveBeenNthCalledWith(1, 'templates');
    expect(fromMock()).toHaveBeenNthCalledWith(2, 'services');
    expect(skipped).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].unitPrice).toBe(15000);
    expect(items[0].quantity).toBe(2000);
  });

  it('reports a deleted template as skipped (empty templates result)', async () => {
    fromMock()
      .mockReturnValueOnce(tableBuilder([]))                 // templates: none found
      .mockReturnValueOnce(tableBuilder([makeService()]))    // services
      .mockReturnValueOnce(tableBuilder([]));                // discounts

    const { items, skipped } = await resolveReorder([{ templateId: 'gone' }]);
    expect(items).toEqual([]);
    expect(skipped).toEqual([{ templateId: 'gone', reason: 'unavailable' }]);
  });

  it('throws on a transient template fetch error (not treated as unavailable)', async () => {
    fromMock()
      .mockReturnValueOnce(tableBuilder(null, { message: 'network' })) // templates error
      .mockReturnValueOnce(tableBuilder([makeService()]))
      .mockReturnValueOnce(tableBuilder([]));

    await expect(resolveReorder([{ templateId: 'tpl-1' }])).rejects.toBeTruthy();
  });
});
