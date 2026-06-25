import { supabase } from '@/integrations/supabase/client';
import { getDesignSignedUrl } from '@/lib/storage';
import { buildCatalog, buildPricingSnapshot } from '@/lib/orderPricing';
import type { DbService } from '@/hooks/useServices';

/**
 * Design Vault ("خزنة التصاميم") helpers.
 *
 * The vault aggregates every design a customer owns, from three sources:
 *  - `ai`       — AI designs the customer saved (public.vault_designs) or ordered (order_items).
 *  - `uploaded` — finished designs the customer uploaded (orders.details.order_type='ready_design').
 *  - `designer` — designs our designer finished for them (public.designs, latest version per item).
 *
 * Each item can be re-ordered: `reorderVaultItem` creates a normal `ready_design` order
 * (mirroring the upload flow) so it flows to staff for printing again.
 */

export type VaultSource = 'ai' | 'uploaded' | 'designer';

export interface VaultItem {
  /** stable React key */
  id: string;
  source: VaultSource;
  serviceType: string | null;
  /** Arabic display label */
  label: string;
  createdAt: string;
  /** permanent public URL (order-attachments bucket) — present for ai/uploaded */
  publicUrl?: string;
  /** private designs-bucket path — present for designer designs (signed on read) */
  designPath?: string;
  /** set for items backed by a vault_designs row (deletable by the owner) */
  vaultRowId?: string;
  /** resolved viewable URL, filled in by the page (signed for designer designs) */
  displayUrl?: string;
}

const SOURCE_LABEL: Record<VaultSource, string> = {
  ai: 'تصميم بالذكاء الاصطناعي',
  uploaded: 'تصميم مرفوع',
  designer: 'تصميم صمّمناه لك',
};

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];

/** True when a URL/path points at a directly-renderable raster image (not pdf/psd/etc). */
export function isImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTS.includes(ext);
}

// ---- Raw row shapes (loosely typed; the DB columns are JSON-ish) ----
export interface RawOrder {
  id: string;
  created_at: string;
  details: Record<string, unknown> | null;
  templates?: { service_type?: string | null; name?: string | null } | null;
}
export interface RawOrderItem {
  id: string;
  order_id: string;
  created_at: string;
  details: Record<string, unknown> | null;
}
export interface RawDesign {
  id: string;
  order_id: string;
  order_item_id: string | null;
  file_url: string | null;
  version: number;
  approved: boolean | null;
  uploaded_at: string;
}
export interface RawVaultRow {
  id: string;
  source: string;
  image_url: string;
  service_type: string | null;
  label: string | null;
  created_at: string;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Build the flat, de-duplicated list of vault items from the four raw sources. Pure (no I/O)
 * so it is unit-testable. Designer designs are reduced to the latest version per item/order.
 */
export function buildVaultItems(input: {
  vaultRows: RawVaultRow[];
  orders: RawOrder[];
  orderItems: RawOrderItem[];
  designs: RawDesign[];
}): VaultItem[] {
  const { vaultRows, orders, orderItems, designs } = input;

  // order_id -> service type (best effort) for labelling designer designs.
  const serviceByOrder = new Map<string, string | null>();
  for (const o of orders) {
    const svc = o.templates?.service_type ?? (o.details?.service_type as string | undefined) ?? null;
    serviceByOrder.set(o.id, svc ?? null);
  }

  const items: VaultItem[] = [];

  // 1. Explicitly-saved designs (vault_designs).
  for (const row of vaultRows) {
    const source = (['ai', 'uploaded', 'designer'].includes(row.source) ? row.source : 'ai') as VaultSource;
    items.push({
      id: `v_${row.id}`,
      source,
      serviceType: row.service_type,
      label: row.label || SOURCE_LABEL[source],
      createdAt: row.created_at,
      publicUrl: row.image_url,
      vaultRowId: row.id,
    });
  }

  // 2. Uploaded finished designs (ready_design / reorder orders).
  for (const o of orders) {
    const type = o.details?.order_type;
    if (type !== 'ready_design' && type !== 'reorder') continue;
    asStringArray(o.details?.attachment_urls).forEach((url, idx) => {
      items.push({
        id: `o_${o.id}_${idx}`,
        source: 'uploaded',
        serviceType: serviceByOrder.get(o.id) ?? null,
        label: SOURCE_LABEL.uploaded,
        createdAt: o.created_at,
        publicUrl: url,
      });
    });
  }

  // 3. AI designs that were ordered (order_items flagged is_ai_design).
  for (const it of orderItems) {
    if (!it.details?.is_ai_design) continue;
    const svc = (it.details?.product_type as string | undefined) ?? serviceByOrder.get(it.order_id) ?? null;
    const label = (it.details?.service_label as string | undefined) || SOURCE_LABEL.ai;
    asStringArray(it.details?.attachment_urls).forEach((url, idx) => {
      items.push({
        id: `oi_${it.id}_${idx}`,
        source: 'ai',
        serviceType: svc,
        label,
        createdAt: it.created_at,
        publicUrl: url,
      });
    });
  }

  // 4. Designer-finished designs — latest version per item (or per order when item-less).
  const latestDesign = new Map<string, RawDesign>();
  for (const d of designs) {
    if (!d.file_url) continue;
    const key = d.order_item_id || d.order_id;
    const cur = latestDesign.get(key);
    if (!cur || d.version > cur.version) latestDesign.set(key, d);
  }
  for (const d of latestDesign.values()) {
    items.push({
      id: `d_${d.id}`,
      source: 'designer',
      serviceType: serviceByOrder.get(d.order_id) ?? null,
      label: SOURCE_LABEL.designer,
      createdAt: d.uploaded_at,
      designPath: d.file_url || undefined,
    });
  }

  // De-dupe by public URL (a design that was both saved and ordered appears once).
  const seen = new Set<string>();
  const deduped = items.filter((it) => {
    if (!it.publicUrl) return true;
    if (seen.has(it.publicUrl)) return false;
    seen.add(it.publicUrl);
    return true;
  });

  deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return deduped;
}

/** Load and assemble the full vault for a customer (RLS scopes order_items/designs to them). */
export async function loadVault(userId: string): Promise<VaultItem[]> {
  const [vaultRes, ordersRes, itemsRes, designsRes] = await Promise.all([
    supabase.from('vault_designs' as never).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('orders').select('id, created_at, details, templates(service_type, name)').eq('customer_id', userId),
    supabase.from('order_items' as never).select('id, order_id, created_at, details'),
    supabase.from('designs').select('id, order_id, order_item_id, file_url, version, approved, uploaded_at'),
  ]);

  return buildVaultItems({
    vaultRows: (vaultRes.data as RawVaultRow[] | null) || [],
    orders: (ordersRes.data as unknown as RawOrder[] | null) || [],
    orderItems: (itemsRes.data as unknown as RawOrderItem[] | null) || [],
    designs: (designsRes.data as unknown as RawDesign[] | null) || [],
  });
}

/** Resolve a viewable URL for a vault item (signs private designer paths). */
export async function resolveVaultDisplayUrl(item: VaultItem): Promise<string | null> {
  if (item.publicUrl) return item.publicUrl;
  if (item.designPath) return getDesignSignedUrl(item.designPath);
  return null;
}

/** Persist a generated AI design to the customer's vault (without placing an order). */
export async function saveAiDesignToVault(args: {
  userId: string;
  imageDataUrl: string;
  serviceType: string;
  label: string;
  brief: string;
  aiPrompt: string;
}): Promise<void> {
  const blob = await (await fetch(args.imageDataUrl)).blob();
  const path = `vault/${args.userId}/${Date.now()}.png`;
  const { error: upErr } = await supabase.storage
    .from('order-attachments')
    .upload(path, blob, { contentType: 'image/png' });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(path);

  const { error } = await supabase.from('vault_designs' as never).insert({
    user_id: args.userId,
    source: 'ai',
    image_url: publicUrl,
    service_type: args.serviceType,
    label: args.label,
    brief: args.brief,
    ai_prompt: args.aiPrompt,
  } as never);
  if (error) throw error;
}

/** Delete a saved (vault_designs-backed) design. */
export async function deleteVaultDesign(vaultRowId: string): Promise<void> {
  const { error } = await supabase.from('vault_designs' as never).delete().eq('id', vaultRowId);
  if (error) throw error;
}

/**
 * Re-order a vault design: create a normal finished-design order (`order_type='ready_design'`)
 * so it flows to staff for printing — mirrors the upload-design path. For private designer
 * designs the file is copied into the public order-attachments bucket first. Returns the order id.
 */
export async function reorderVaultItem(userId: string, item: VaultItem): Promise<string> {
  // Best-effort immutable pricing snapshot. A reorder has no quantity input, so we order the
  // service's min_quantity at the current catalog price; if the service is unknown the snapshot
  // resolves to zeros (still a valid, hasSnapshot:true row for accounting).
  const { data: svcRows } = await supabase.from('services').select('*');
  const catalog = buildCatalog((svcRows as DbService[] | null) || []);
  const serviceType = item.serviceType || '';
  const quantity = catalog[serviceType]?.min_quantity || 1000;
  const pricing = buildPricingSnapshot(catalog, serviceType, quantity);

  const baseDetails = {
    order_type: 'ready_design',
    service_type: item.serviceType,
    reorder: true,
    reorder_source: item.source,
    quantity,
    pricing,
  };

  // 1. Create the parent order.
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id: userId,
      status: 'submitted' as never,
      details: { ...baseDetails, attachment_urls: [] } as never,
    })
    .select('id')
    .single();
  if (orderErr || !order) throw orderErr || new Error('فشل إنشاء الطلب');

  // 2. Resolve a permanent public URL for the design.
  let publicUrl = item.publicUrl;
  if (!publicUrl && item.designPath) {
    const signed = await getDesignSignedUrl(item.designPath);
    if (!signed) throw new Error('تعذّر الوصول إلى التصميم');
    const blob = await (await fetch(signed)).blob();
    const ext = (item.designPath.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${order.id}/reorder-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('order-attachments').upload(path, blob);
    if (upErr) throw upErr;
    publicUrl = supabase.storage.from('order-attachments').getPublicUrl(path).data.publicUrl;
  }

  // 3. Attach the design URL to the order.
  await supabase
    .from('orders')
    .update({ details: { ...baseDetails, attachment_urls: publicUrl ? [publicUrl] : [] } as never })
    .eq('id', order.id);

  return order.id as string;
}
