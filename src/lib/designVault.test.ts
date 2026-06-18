import { describe, it, expect } from 'vitest';
import { isImageUrl, buildVaultItems, RawOrder, RawOrderItem, RawDesign, RawVaultRow } from './designVault';

describe('isImageUrl', () => {
  it('accepts raster image extensions (with query/hash)', () => {
    expect(isImageUrl('https://x/y/a.png')).toBe(true);
    expect(isImageUrl('https://x/y/a.JPG?token=1')).toBe(true);
    expect(isImageUrl('https://x/y/a.webp#frag')).toBe(true);
  });
  it('rejects non-images and empties', () => {
    expect(isImageUrl('https://x/y/a.pdf')).toBe(false);
    expect(isImageUrl('https://x/y/a.psd')).toBe(false);
    expect(isImageUrl('')).toBe(false);
    expect(isImageUrl(null)).toBe(false);
  });
});

describe('buildVaultItems', () => {
  const vaultRows: RawVaultRow[] = [
    { id: 'V1', source: 'ai', image_url: 'https://b/vault/img1.png', service_type: 'stamp', label: 'ختمي', created_at: '2026-06-10T00:00:00Z' },
  ];
  const orders: RawOrder[] = [
    { id: 'O1', created_at: '2026-06-12T00:00:00Z', details: { order_type: 'ready_design', service_type: 'flyer', attachment_urls: ['https://b/o/u1.pdf'] }, templates: null },
    { id: 'O2', created_at: '2026-06-11T00:00:00Z', details: { order_type: 'ai_design' }, templates: { service_type: 'business_card' } },
  ];
  const orderItems: RawOrderItem[] = [
    { id: 'I1', order_id: 'O2', created_at: '2026-06-11T00:00:00Z', details: { is_ai_design: true, product_type: 'card_single', service_label: 'كارت', attachment_urls: ['https://b/o/ai1.png'] } },
    // a normal (non-AI) item must NOT appear in the vault
    { id: 'I2', order_id: 'O3', created_at: '2026-06-09T00:00:00Z', details: { attachment_urls: ['https://b/o/input.png'] } },
  ];
  const designs: RawDesign[] = [
    { id: 'D1', order_id: 'O2', order_item_id: 'I1', file_url: 'O2/I1/v1.png', version: 1, approved: false, uploaded_at: '2026-06-13T00:00:00Z' },
    { id: 'D2', order_id: 'O2', order_item_id: 'I1', file_url: 'O2/I1/v2.png', version: 2, approved: true, uploaded_at: '2026-06-14T00:00:00Z' },
  ];

  it('maps every source and keeps only the latest designer version', () => {
    const items = buildVaultItems({ vaultRows, orders, orderItems, designs });
    const bySource = (s: string) => items.filter((i) => i.source === s);

    // ai: 1 saved + 1 ordered = 2
    expect(bySource('ai')).toHaveLength(2);
    // uploaded: 1 (pdf)
    expect(bySource('uploaded')).toHaveLength(1);
    expect(bySource('uploaded')[0].publicUrl).toBe('https://b/o/u1.pdf');
    // designer: only the latest version (v2)
    const designer = bySource('designer');
    expect(designer).toHaveLength(1);
    expect(designer[0].designPath).toBe('O2/I1/v2.png');
    // the non-AI order_item input is excluded
    expect(items.some((i) => i.publicUrl === 'https://b/o/input.png')).toBe(false);
  });

  it('sorts newest first and de-dupes by public url', () => {
    const dupRows: RawVaultRow[] = [
      { id: 'V2', source: 'ai', image_url: 'https://b/o/ai1.png', service_type: null, label: null, created_at: '2026-06-20T00:00:00Z' },
    ];
    const items = buildVaultItems({ vaultRows: dupRows, orders, orderItems, designs });
    // the saved row and the ordered item share the same url -> only one survives
    expect(items.filter((i) => i.publicUrl === 'https://b/o/ai1.png')).toHaveLength(1);
    // newest createdAt is first
    expect(new Date(items[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(items[items.length - 1].createdAt).getTime());
  });

  it('marks vault_designs-backed items as deletable', () => {
    const items = buildVaultItems({ vaultRows, orders: [], orderItems: [], designs: [] });
    expect(items[0].vaultRowId).toBe('V1');
    expect(items[0].label).toBe('ختمي');
  });
});
