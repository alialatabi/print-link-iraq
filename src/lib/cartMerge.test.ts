/**
 * Unit tests for the pure cart merge + sanitization logic (src/lib/cartMerge.ts).
 *
 * No React / Supabase — both imports in cartMerge.ts are type-only, so this suite is fully pure.
 * Covers: union, local-wins-on-conflict, dedupe-by-templateId, malformed-server-entry filtering,
 * and the empty cases.
 */
import { describe, it, expect } from 'vitest';
import { mergeCarts, sanitizeCartItems } from './cartMerge';
import type { CartItem } from '@/contexts/CartContext';

/** Minimal valid CartItem; override only what a test cares about. */
const makeItem = (o: Partial<CartItem> = {}): CartItem => ({
  templateId: 'tmpl-1',
  templateName: 'Card',
  serviceType: 'business_card',
  previewUrl: null,
  quantity: 1000,
  unitPrice: 10000,
  minQuantity: 1000,
  ...o,
});

// ---------------------------------------------------------------------------
// sanitizeCartItems — non-array / empty
// ---------------------------------------------------------------------------

describe('sanitizeCartItems: non-array & empty inputs', () => {
  it.each([null, undefined, {}, 'string', 42, true, NaN])(
    'returns [] for non-array input %p',
    (input) => {
      expect(sanitizeCartItems(input as unknown)).toEqual([]);
    },
  );

  it('returns [] for an empty array', () => {
    expect(sanitizeCartItems([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// sanitizeCartItems — valid items
// ---------------------------------------------------------------------------

describe('sanitizeCartItems: valid items', () => {
  it('keeps a fully-valid item unchanged', () => {
    const item = makeItem();
    expect(sanitizeCartItems([item])).toEqual([item]);
  });

  it('keeps a valid cellophane string', () => {
    const [out] = sanitizeCartItems([makeItem({ cellophane: 'glossy' })]);
    expect(out.cellophane).toBe('glossy');
  });

  it('allows unitPrice of 0 (a free / zero-fee item)', () => {
    const [out] = sanitizeCartItems([makeItem({ unitPrice: 0 })]);
    expect(out.unitPrice).toBe(0);
  });

  it('keeps a valid AI item with a well-formed aiDesign payload', () => {
    const ai = makeItem({
      templateId: 'ai-abc',
      quantity: 1,
      minQuantity: 1,
      aiDesign: {
        brief: 'b',
        productType: 'flyer',
        productLabel: 'فلاير',
        sizeLabel: 'A5',
        rewrittenPrompt: 'p',
        imageUrl: 'https://cdn/x.png',
      },
    });
    const out = sanitizeCartItems([ai]);
    expect(out).toHaveLength(1);
    expect(out[0].aiDesign?.imageUrl).toBe('https://cdn/x.png');
  });

  it('strips unknown/extra properties (only known CartItem fields survive)', () => {
    const dirty = { ...makeItem(), evil: 'DROP TABLE', __proto__hack: 1 };
    const [out] = sanitizeCartItems([dirty]);
    expect(out).not.toHaveProperty('evil');
    expect(Object.keys(out).sort()).toEqual(
      ['minQuantity', 'previewUrl', 'quantity', 'serviceType', 'templateId', 'templateName', 'unitPrice'].sort(),
    );
  });

  it('defaults missing/mistyped string fields (templateName, serviceType, previewUrl)', () => {
    const [out] = sanitizeCartItems([
      { templateId: 't1', quantity: 1000, unitPrice: 10000, minQuantity: 1000 },
    ]);
    expect(out.templateName).toBe('');
    expect(out.serviceType).toBe('');
    expect(out.previewUrl).toBeNull();
  });

  it('coerces a non-string previewUrl to null', () => {
    const [out] = sanitizeCartItems([makeItem({ previewUrl: 123 as unknown as null })]);
    expect(out.previewUrl).toBeNull();
  });

  it('drops a non-string cellophane rather than the whole item', () => {
    const [out] = sanitizeCartItems([makeItem({ cellophane: 7 as unknown as string })]);
    expect(out).not.toHaveProperty('cellophane');
    expect(out.templateId).toBe('tmpl-1');
  });
});

// ---------------------------------------------------------------------------
// sanitizeCartItems — malformed filtering
// ---------------------------------------------------------------------------

describe('sanitizeCartItems: filters malformed entries', () => {
  it.each([
    ['null entry', null],
    ['primitive entry', 5],
    ['missing templateId', { quantity: 1000, unitPrice: 10000, minQuantity: 1000 }],
    ['empty templateId', { templateId: '', quantity: 1000, unitPrice: 10000, minQuantity: 1000 }],
    ['non-string templateId', { templateId: 42, quantity: 1000, unitPrice: 10000, minQuantity: 1000 }],
    ['NaN quantity', makeItem({ quantity: NaN })],
    ['Infinity quantity', makeItem({ quantity: Infinity })],
    ['zero quantity', makeItem({ quantity: 0 })],
    ['negative quantity', makeItem({ quantity: -1 })],
    ['string quantity', { ...makeItem(), quantity: '1000' }],
    ['negative unitPrice', makeItem({ unitPrice: -5 })],
    ['NaN unitPrice', makeItem({ unitPrice: NaN })],
    ['zero minQuantity', makeItem({ minQuantity: 0 })],
    ['negative minQuantity', makeItem({ minQuantity: -100 })],
  ])('drops a %s', (_label, bad) => {
    expect(sanitizeCartItems([bad])).toEqual([]);
  });

  it('drops an item that declares an aiDesign but whose payload is broken', () => {
    const brokenObj = makeItem({ templateId: 'ai-1', aiDesign: {} as unknown as CartItem['aiDesign'] });
    const brokenPrim = makeItem({ templateId: 'ai-2', aiDesign: 'nope' as unknown as CartItem['aiDesign'] });
    const missingImg = makeItem({
      templateId: 'ai-3',
      aiDesign: { productType: 'flyer' } as unknown as CartItem['aiDesign'],
    });
    expect(sanitizeCartItems([brokenObj, brokenPrim, missingImg])).toEqual([]);
  });

  it('keeps only the valid entries from a mixed array (preserving order)', () => {
    const good1 = makeItem({ templateId: 'a' });
    const good2 = makeItem({ templateId: 'b' });
    const result = sanitizeCartItems([good1, { templateId: '' }, good2, null, 3]);
    expect(result.map((i) => i.templateId)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// sanitizeCartItems — dedupe
// ---------------------------------------------------------------------------

describe('sanitizeCartItems: de-duplicates by templateId (first wins)', () => {
  it('keeps the first occurrence of a duplicated templateId', () => {
    const result = sanitizeCartItems([
      makeItem({ templateId: 'dup', quantity: 1000 }),
      makeItem({ templateId: 'dup', quantity: 5000 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// mergeCarts
// ---------------------------------------------------------------------------

describe('mergeCarts', () => {
  it('returns [] when both carts are empty', () => {
    expect(mergeCarts([], [])).toEqual([]);
  });

  it('returns the local cart when the server cart is empty', () => {
    const local = [makeItem({ templateId: 'a' })];
    expect(mergeCarts(local, [])).toEqual(local);
  });

  it('returns the server cart when the local cart is empty', () => {
    const server = [makeItem({ templateId: 'b' })];
    expect(mergeCarts([], server)).toEqual(server);
  });

  it('unions distinct items, local first then server-only appended', () => {
    const local = [makeItem({ templateId: 'a' })];
    const server = [makeItem({ templateId: 'b' })];
    const merged = mergeCarts(local, server);
    expect(merged.map((i) => i.templateId)).toEqual(['a', 'b']);
  });

  it('LOCAL WINS on a templateId conflict (keeps the local value)', () => {
    const local = [makeItem({ templateId: 'x', quantity: 2000, unitPrice: 111 })];
    const server = [makeItem({ templateId: 'x', quantity: 9000, unitPrice: 999 })];
    const merged = mergeCarts(local, server);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2000);
    expect(merged[0].unitPrice).toBe(111);
  });

  it('de-duplicates by templateId in the merged result', () => {
    const local = [makeItem({ templateId: 'x' }), makeItem({ templateId: 'y' })];
    const server = [makeItem({ templateId: 'x' }), makeItem({ templateId: 'z' })];
    const merged = mergeCarts(local, server);
    expect(merged.map((i) => i.templateId)).toEqual(['x', 'y', 'z']);
  });

  it('preserves local ordering and appends server-only items after', () => {
    const local = [makeItem({ templateId: 'b' }), makeItem({ templateId: 'a' })];
    const server = [makeItem({ templateId: 'c' }), makeItem({ templateId: 'a' })];
    const merged = mergeCarts(local, server);
    // local order (b, a) first; only the truly server-only 'c' is appended.
    expect(merged.map((i) => i.templateId)).toEqual(['b', 'a', 'c']);
  });

  it('treats a non-array local input defensively as empty', () => {
    const server = [makeItem({ templateId: 'b' })];
    expect(mergeCarts(null as unknown as CartItem[], server)).toEqual(server);
  });

  it('treats a non-array server input defensively as empty', () => {
    const local = [makeItem({ templateId: 'a' })];
    expect(mergeCarts(local, undefined as unknown as CartItem[])).toEqual(local);
  });
});
