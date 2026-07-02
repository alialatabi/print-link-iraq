/**
 * Service layer — Orders domain.
 *
 * Wraps every Supabase call related to orders, order_items and designs used by the
 * customer-facing pages (MyOrders, OrderTracking, UploadDesignPage,
 * DeliveryAddressPage, ResellerNewOrder).  All realtime channel management
 * (`supabase.channel / removeChannel`) stays in the page because it is not a query.
 */
import { supabase } from '@/integrations/supabase/client';
import type { OrderDetailsJson, OrderStatusEnum } from '@/types/db';
import type { Json } from '@/integrations/supabase/types';

// ---------------------------------------------------------------------------
// Shared shape used by MyOrders to enrich the order list
// ---------------------------------------------------------------------------

export interface OrderListRow {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  designer_id: string | null;
  details: OrderDetailsJson | null;
  templates?: { name?: string; service_type?: string; preview_url?: string | null } | null;
}

export interface OrderItemListRow {
  id: string;
  order_id: string;
  template_id: string | null;
  status: string;
  details: OrderDetailsJson | null;
  created_at: string | null;
  templates?: { name?: string; service_type?: string; preview_url?: string | null } | null;
}

export interface DesignBatchRow {
  order_id: string;
  file_url: string | null;
  version: number;
}

export interface DesignVersionRow {
  id: string;
  version: number;
  file_url: string | null;
  approved: boolean | null;
  uploaded_at: string;
  order_id: string;
  order_item_id: string | null;
}

// ---------------------------------------------------------------------------
// Read queries — MyOrders
// ---------------------------------------------------------------------------

/**
 * Fetch the customer's orders (or all orders for admins), newest-updated first.
 * Includes the linked template name/service_type/preview_url via a JOIN.
 */
export function queryMyOrders(userId: string, isAdmin: boolean) {
  let query = supabase
    .from('orders')
    .select('*, templates(name, service_type, preview_url)')
    .order('updated_at', { ascending: false });
  if (!isAdmin) query = query.eq('customer_id', userId);
  return query;
}

/**
 * Batch-fetch order items for a set of order ids, including template info.
 * Used in parallel with queryDesignsInBatch inside MyOrders' loadOrders.
 */
export function queryOrderItemsInBatch(orderIds: string[]) {
  return supabase
    .from('order_items')
    .select('*, templates(name, service_type, preview_url)')
    .in('order_id', orderIds);
}

/**
 * Batch-fetch the latest design file_url + version for a set of order ids.
 * Used to resolve the designer-finished thumbnail in MyOrders.
 */
export function queryDesignsInBatch(orderIds: string[]) {
  return supabase
    .from('designs')
    .select('order_id, file_url, version')
    .in('order_id', orderIds);
}

// ---------------------------------------------------------------------------
// Read queries — OrderTracking
// ---------------------------------------------------------------------------

/**
 * Fetch a single order by id together with its template name.
 * Returns null (not an error) when the order does not exist.
 */
export function getOrder(orderId: string) {
  return supabase
    .from('orders')
    .select('*, templates(name)')
    .eq('id', orderId)
    .maybeSingle();
}

/**
 * Fetch all order items for one order, in insertion order (for the per-item stepper).
 * Includes the linked template name and service_type.
 */
export function listOrderItems(orderId: string) {
  return supabase
    .from('order_items')
    .select('*, templates(name, service_type)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
}

/**
 * Fetch all design versions for one order, newest version first.
 * Used by the tracking page to show the designer's uploads and resolve signed URLs.
 */
export function listDesignsForOrder(orderId: string) {
  return supabase
    .from('designs')
    .select('*')
    .eq('order_id', orderId)
    .order('version', { ascending: false });
}

// ---------------------------------------------------------------------------
// Storage — OrderTracking / RevisionImages
// ---------------------------------------------------------------------------

/**
 * Create a short-lived signed URL for a revision-attachment path (private bucket).
 * Returns the URL string, or null when signing fails.
 */
export async function createRevisionSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from('order-attachments')
    .createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

/**
 * Upload a customer's revision reference image to the order-attachments bucket.
 * Returns the raw supabase storage result so the caller can check `error`.
 */
export function uploadRevisionAttachment(path: string, file: File) {
  return supabase.storage
    .from('order-attachments')
    .upload(path, file, { upsert: false });
}

// ---------------------------------------------------------------------------
// Mutations — OrderTracking
// ---------------------------------------------------------------------------

/**
 * Mark a designer's design version as customer-approved.
 * Errors are silently ignored (caller does not check them separately).
 */
export async function approveDesignVersion(designId: string): Promise<void> {
  await supabase.from('designs').update({ approved: true }).eq('id', designId);
}

/**
 * Update an order item's status and the full details JSON snapshot in one call.
 * Used both for approval (`status='approved'`) and revision requests (`status='assigned'`).
 */
export async function updateOrderItemDetails(
  itemId: string,
  status: OrderStatusEnum,
  details: OrderDetailsJson,
): Promise<void> {
  await supabase
    .from('order_items')
    .update({ status, details: details as Json })
    .eq('id', itemId);
}

/**
 * Cancel an order by setting its status to 'cancelled' and clearing the assigned designer.
 * Returns `{ error }` so the caller can show a specific Arabic error toast on failure.
 */
export function cancelOrder(orderId: string) {
  return supabase
    .from('orders')
    .update({ status: 'cancelled', designer_id: null })
    .eq('id', orderId);
}

// ---------------------------------------------------------------------------
// Mutations — UploadDesignPage / ResellerNewOrder
// ---------------------------------------------------------------------------

/**
 * Create a new order in 'submitted' status with the given details JSON.
 * Returns `{ data: { id } | null, error }` so the caller can get the order id.
 */
export function insertOrder(userId: string, details: Json) {
  return supabase
    .from('orders')
    .insert({ customer_id: userId, status: 'submitted', details })
    .select('id')
    .single();
}

/**
 * Upload a file to the order-attachments bucket.
 * Returns the raw storage result so the caller can check `error`.
 */
export function uploadOrderAttachment(path: string, file: File) {
  return supabase.storage.from('order-attachments').upload(path, file);
}

/**
 * Synchronously compute the public URL for a path in the order-attachments bucket.
 * This never fails — the URL is always derivable from the path.
 */
export function getOrderAttachmentPublicUrl(path: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from('order-attachments').getPublicUrl(path);
  return publicUrl;
}

/**
 * Overwrite the `details` JSON column of an existing order.
 * Used to patch in attachment_urls after uploading files.
 */
export function patchOrderDetails(orderId: string, details: Json) {
  return supabase.from('orders').update({ details }).eq('id', orderId);
}

// ---------------------------------------------------------------------------
// Checkout — idempotent cart order creation (CheckoutPage)
//
// Customers order on flaky mobile networks. The cart-submit flow reuses
// client-generated ids across retries so an interrupted submit can be re-run
// without creating duplicate orders/items, and uploads all attachments BEFORE
// creating the order so a submit never half-completes.
// ---------------------------------------------------------------------------

/**
 * True when a Postgres error is a unique-violation (23505). The cart-submit flow reuses a
 * client-generated id across retries, so a duplicate-key on insert means "this row was already
 * created by a previous (network-interrupted) attempt" — i.e. success, not a real failure.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: string } | null | undefined)?.code === '23505';
}

/**
 * True when a storage upload failed because the object already exists. With stable, retry-safe
 * upload paths that means a prior attempt already stored the file (its public URL is still valid),
 * so the caller can treat it as a successful upload. The `order-attachments` bucket has no UPDATE
 * policy (no `upsert` possible), so detecting the existing object is how retried uploads stay
 * idempotent instead of erroring out.
 */
export function isAlreadyExistsError(error: unknown): boolean {
  const e = error as { statusCode?: string | number; error?: string; message?: string } | null | undefined;
  if (!e) return false;
  if (String(e.statusCode) === '409') return true;
  const text = `${e.error ?? ''} ${e.message ?? ''}`.toLowerCase();
  return text.includes('already exists') || text.includes('duplicate') || text.includes('resource already');
}

/**
 * Create ONE cart order in 'submitted' status using a client-supplied id (the idempotency key).
 * Reusing the same id across retries makes re-submits after a dropped response safe: the second
 * insert fails with 23505 instead of creating a duplicate order. Returns the raw supabase result.
 */
export function createCartOrder(orderId: string, userId: string, details: Json) {
  return supabase
    .from('orders')
    .insert({ id: orderId, customer_id: userId, status: 'submitted', details })
    .select('id')
    .single();
}

/**
 * Insert one cart order_item in 'submitted' status using a client-supplied id (idempotency key).
 * `templateId` is null for AI-designed items. Returns the raw supabase result so the caller can
 * treat 23505 (duplicate) as an already-created item on retry.
 */
export function insertCartOrderItem(args: {
  id: string;
  orderId: string;
  templateId: string | null;
  details: Json;
}) {
  return supabase
    .from('order_items')
    .insert({
      id: args.id,
      order_id: args.orderId,
      template_id: args.templateId,
      details: args.details,
      status: 'submitted',
    })
    .select('id')
    .single();
}

/**
 * Upload one customer attachment for a cart order to the public `order-attachments` bucket.
 * The caller passes a STABLE path so a retried upload targets the same object; a second upload of
 * an already-stored file returns an "already exists" error the caller treats as success (the bucket
 * has no UPDATE policy, so `upsert` is not available). Returns the raw storage result.
 */
export function uploadCartAttachment(path: string, file: File) {
  return supabase.storage.from('order-attachments').upload(path, file);
}

// ---------------------------------------------------------------------------
// Queries / mutations — DeliveryAddressPage
// ---------------------------------------------------------------------------

/**
 * Fetch just the `details` JSON from an order (needed to merge delivery fields).
 */
export function getOrderDetailsOnly(orderId: string) {
  return supabase.from('orders').select('details').eq('id', orderId).single();
}

/**
 * Approve an order and save the merged delivery address into its details.
 * Returns `{ error }` so the caller can show a specific Arabic error toast on failure.
 */
export function approveOrderWithDelivery(orderId: string, details: Json) {
  return supabase
    .from('orders')
    .update({ status: 'approved', details })
    .eq('id', orderId);
}
