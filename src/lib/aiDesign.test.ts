import { describe, it, expect } from 'vitest';
import { sizeForProduct, buildAiOrderItemDetails, resolveRequest, dbRowToAiProduct, dbServiceToAiProduct, AiProductRow, AiServiceRow, AI_PRODUCT_TYPES } from './aiDesign';

const ALLOWED_CANVASES = new Set(['1024x1024', '1536x1024', '1024x1536']);

describe('sizeForProduct', () => {
  it('returns landscape for business cards', () => {
    expect(sizeForProduct('business_card')).toBe('1536x1024');
  });
  it('returns portrait for flyers/menus', () => {
    expect(sizeForProduct('flyer')).toBe('1024x1536');
    expect(sizeForProduct('menu')).toBe('1024x1536');
  });
  it('falls back to square for unknown/logo/social', () => {
    expect(sizeForProduct('logo')).toBe('1024x1024');
    expect(sizeForProduct('something-else')).toBe('1024x1024');
  });
  it('maps every catalog product type to a valid canvas', () => {
    for (const p of AI_PRODUCT_TYPES) {
      if (p.options) {
        for (const o of p.options) {
          expect(ALLOWED_CANVASES.has(o.canvas)).toBe(true);
        }
      } else {
        expect(ALLOWED_CANVASES.has(p.canvas)).toBe(true);
      }
    }
  });
});

describe('resolveRequest', () => {
  const byId = (id: string) => {
    const p = AI_PRODUCT_TYPES.find((x) => x.id === id);
    if (!p) throw new Error(`missing product ${id}`);
    return p;
  };

  it('resolves an option product (stamp / rect_6x4)', () => {
    const r = resolveRequest(byId('stamp'), 'rect_6x4');
    expect(r.canvasSize).toBe('1536x1024');
    expect(r.sizeLabel).toBe('6×4 سم');
  });

  it('resolves an orientation product (card_single / portrait)', () => {
    const r = resolveRequest(byId('card_single'), 'portrait');
    expect(r.canvasSize).toBe('1024x1536');
  });

  it('resolves a customSize product (flex)', () => {
    const r = resolveRequest(byId('flex'), undefined, '3 × 2 متر');
    expect(r.sizeLabel).toBe('3 × 2 متر');
    expect(r.canvasSize).toBe('1536x1024');
  });

  it('resolves a fixed product (doctor_rx)', () => {
    const r = resolveRequest(byId('doctor_rx'));
    expect(r.canvasSize).toBe('1024x1536');
    expect(r.sizeLabel).toBe('A5 (14.8×21 سم)');
    expect(r.directives.length).toBeGreaterThan(0);
  });

  it('falls back to product.canvas when an option product has no optionId', () => {
    const product = byId('stamp');
    const r = resolveRequest(product);
    expect(r.canvasSize).toBe(product.canvas);
  });
});

describe('buildAiOrderItemDetails', () => {
  it('shapes the order_item details so the designer view renders it', () => {
    const details = buildAiOrderItemDetails({
      brief: '  كارت لمطعم النخيل  ',
      productType: 'business_card',
      productLabel: 'كارت شخصي',
      rewrittenPrompt: 'flat vector business card ...',
      imageUrls: ['https://x/y.png'],
    });
    expect(details.details).toBe('كارت لمطعم النخيل'); // trimmed
    expect(details.attachment_urls).toEqual(['https://x/y.png']);
    expect(details.is_ai_design).toBe(true);
    expect(details.ai_prompt).toContain('flat vector');
    expect(details.product_type).toBe('business_card');
    expect(details.service_label).toBe('كارت شخصي');
    expect(details.quantity).toBe(1); // default
  });

  it('honors an explicit quantity', () => {
    const details = buildAiOrderItemDetails({
      brief: 'x',
      productType: 'flyer',
      productLabel: 'فلاير',
      rewrittenPrompt: 'p',
      imageUrls: [],
      quantity: 1000,
    });
    expect(details.quantity).toBe(1000);
    expect(details.attachment_urls).toEqual([]);
  });

  it('records the per-product unit price, defaulting to the flat fee', () => {
    expect(buildAiOrderItemDetails({ brief: 'x', productType: 'stamp', productLabel: 'ختم', rewrittenPrompt: 'p', imageUrls: [], unitPrice: 25000 }).unit_price).toBe(25000);
    expect(buildAiOrderItemDetails({ brief: 'x', productType: 'stamp', productLabel: 'ختم', rewrittenPrompt: 'p', imageUrls: [] }).unit_price).toBe(1000);
  });
});

describe('removed AI products', () => {
  it('no longer offers business_card / invitation / banner / logo / social', () => {
    const ids = new Set(AI_PRODUCT_TYPES.map(p => p.id));
    for (const removed of ['business_card', 'invitation', 'banner', 'logo', 'social']) {
      expect(ids.has(removed)).toBe(false);
    }
  });
});

describe('dbRowToAiProduct', () => {
  const baseRow: AiProductRow = {
    id: 'stamp', label: 'تصميم ختم', canvas: '1024x1024', size_label: null, option_label: 'قياس الختم',
    options: [{ id: 'rect_6x4', label: 'مستطيل 6×4', sizeLabel: '6×4 سم', canvas: '1536x1024' }],
    custom_size: null, directives: 'blue only', price: 25000, sort_order: 9, active: true,
  };

  it('maps an options product (with price + directives)', () => {
    const p = dbRowToAiProduct(baseRow);
    expect(p.id).toBe('stamp');
    expect(p.price).toBe(25000);
    expect(p.optionLabel).toBe('قياس الختم');
    expect(p.options).toHaveLength(1);
    expect(p.options![0].canvas).toBe('1536x1024');
    expect(p.directives).toBe('blue only');
    expect(p.customSize).toBeUndefined();
  });

  it('maps a custom-size product and drops empty options', () => {
    const p = dbRowToAiProduct({ ...baseRow, id: 'flex', option_label: null, options: [], custom_size: { label: 'القياس', placeholder: '3×2 م' } });
    expect(p.options).toBeUndefined();
    expect(p.customSize).toEqual({ label: 'القياس', placeholder: '3×2 م' });
  });

  it('coerces an unknown canvas to a safe default', () => {
    const p = dbRowToAiProduct({ ...baseRow, canvas: 'weird' as never, options: [] });
    expect(p.canvas).toBe('1024x1024');
  });
});

describe('dbServiceToAiProduct', () => {
  const baseRow: AiServiceRow = {
    id: 'aip_stamp', label: 'تصميم ختم',
    ai_enabled: true, ai_fee: 25000, ai_canvas: '1024x1024',
    ai_size_label: null, ai_option_label: 'قياس الختم',
    ai_options: [{ id: 'rect_6x4', label: 'مستطيل 6×4', sizeLabel: '6×4 سم', canvas: '1536x1024' }],
    ai_custom_size: null, ai_directives: 'blue only',
  };

  it('maps an AI-enabled service with options + fee + directives', () => {
    const p = dbServiceToAiProduct(baseRow);
    expect(p.id).toBe('aip_stamp');
    expect(p.price).toBe(25000);
    expect(p.optionLabel).toBe('قياس الختم');
    expect(p.options).toHaveLength(1);
    expect(p.options![0].canvas).toBe('1536x1024');
    expect(p.directives).toBe('blue only');
    expect(p.customSize).toBeUndefined();
  });

  it('maps a custom-size service and drops empty options', () => {
    const p = dbServiceToAiProduct({ ...baseRow, id: 'aip_flex', ai_option_label: null, ai_options: [], ai_custom_size: { label: 'القياس', placeholder: '3×2 م' } });
    expect(p.options).toBeUndefined();
    expect(p.customSize).toEqual({ label: 'القياس', placeholder: '3×2 م' });
  });

  it('coerces an unknown ai_canvas and leaves price undefined when ai_fee is missing', () => {
    const p = dbServiceToAiProduct({ ...baseRow, ai_canvas: 'weird', ai_options: [], ai_fee: null });
    expect(p.canvas).toBe('1024x1024');
    expect(p.price).toBeUndefined();
  });
});
