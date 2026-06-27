/**
 * Service layer — Designer domain.
 *
 * Wraps every Supabase call specific to the designer-facing pages
 * (DesignerOrders, DesignerOrderDetails). Realtime channel management
 * (`supabase.channel / removeChannel`) stays in the components.
 *
 * General-purpose order/design queries (getOrder, listDesignsForOrder, etc.)
 * live in orders.ts and are reused here via the components.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { OrderDetailsJson, OrderStatusEnum } from '@/types/db';

// ---------------------------------------------------------------------------
// Select string shared between DesignerOrders list queries
// ---------------------------------------------------------------------------
export const DESIGNER_ORDER_SELECT =
  'id, customer_id, designer_id, template_id, status, details, created_at, updated_at, templates(name, service_type)';

// ---------------------------------------------------------------------------
// Customer-name RPC (used by DesignerOrders hydrate + DesignerOrderDetails)
// ---------------------------------------------------------------------------

/**
 * Call the `get_customer_names_for_designer` RPC to resolve customer display names.
 * Returns `{ data: { user_id, display_name }[] | null, error }`.
 */
export function getCustomerNamesForDesigner(customerIds: string[]) {
  return supabase.rpc('get_customer_names_for_designer', {
    customer_ids: customerIds,
  });
}

// ---------------------------------------------------------------------------
// Order item batch (used by DesignerOrders hydrate)
// ---------------------------------------------------------------------------

/**
 * Fetch order items for a batch of order ids, including template name/service_type.
 * Used alongside getCustomerNamesForDesigner to hydrate the order list.
 */
export function queryDesignerOrderItemsBatch(orderIds: string[]) {
  return supabase
    .from('order_items')
    .select('*, templates(name, service_type)')
    .in('order_id', orderIds);
}

// ---------------------------------------------------------------------------
// Order list queries — DesignerOrders page
// ---------------------------------------------------------------------------

/**
 * Count how many of a designer's orders are in a completed status.
 * Returns `{ count: number | null, error }` via `{ count: 'exact', head: true }`.
 */
export function countDesignerArchivedOrders(
  userId: string,
  statuses: readonly string[],
) {
  return supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('designer_id', userId)
    .in('status', statuses as never);
}

/**
 * Fetch a page of active (non-completed) orders assigned to a designer.
 * The `excludeStatuses` string must be in PostgREST `in` value format: `(a,b,c)`.
 */
export function queryDesignerActiveOrders(
  userId: string,
  excludeStatuses: string,
  limit: number,
) {
  return supabase
    .from('orders')
    .select(DESIGNER_ORDER_SELECT)
    .eq('designer_id', userId)
    .not('status', 'in', excludeStatuses)
    .order('created_at', { ascending: false })
    .limit(limit);
}

/**
 * Fetch a page of completed (archived) orders for a designer, newest-updated first.
 */
export function queryDesignerArchivedOrders(
  userId: string,
  statuses: readonly string[],
  limit: number,
) {
  return supabase
    .from('orders')
    .select(DESIGNER_ORDER_SELECT)
    .eq('designer_id', userId)
    .in('status', statuses as never)
    .order('updated_at', { ascending: false })
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Single-order read — DesignerOrderDetails page
// ---------------------------------------------------------------------------

/**
 * Fetch a single order with its linked template (including preview_url).
 * Returns `{ data | null, error }` via maybeSingle.
 */
export function getDesignerOrderDetail(orderId: string) {
  return supabase
    .from('orders')
    .select(
      'id, customer_id, designer_id, template_id, status, details, created_at, updated_at, templates(name, service_type, preview_url)',
    )
    .eq('id', orderId)
    .maybeSingle();
}

/**
 * Fetch all order items for one order, including template info, insertion order.
 * Used by DesignerOrderDetails to render each design item card.
 */
export function listOrderItemsForDesigner(orderId: string) {
  return supabase
    .from('order_items')
    .select('*, templates(name, service_type, preview_url)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
}

// ---------------------------------------------------------------------------
// Storage — designs bucket
// ---------------------------------------------------------------------------

/**
 * Upload a new design file version to the `designs` storage bucket.
 * Returns the raw storage result so the caller can check `error`.
 */
export function uploadDesignFile(filePath: string, file: File) {
  return supabase.storage.from('designs').upload(filePath, file, { upsert: false });
}

/**
 * Permanently delete a design file from the `designs` storage bucket.
 * Returns the raw storage result so the caller can check `error`.
 */
export function removeDesignFile(filePath: string) {
  return supabase.storage.from('designs').remove([filePath]);
}

// ---------------------------------------------------------------------------
// designs table mutations
// ---------------------------------------------------------------------------

/**
 * Insert a new design version record in the `designs` table.
 * Returns `{ error }` so the caller can show a toast on failure.
 */
export function insertDesignVersion(
  orderId: string,
  orderItemId: string,
  version: number,
  fileUrl: string,
) {
  return supabase.from('designs').insert({
    order_id: orderId,
    order_item_id: orderItemId,
    version,
    file_url: fileUrl,
  });
}

/**
 * Insert an ORDER-LEVEL design version (no order_item_id) for item-less orders —
 * template/ready-design orders that store their design on the order row instead of
 * in order_items. The customer's item-less tracking view resolves this via the
 * order-level design (`order_item_id IS NULL`), so the design surfaces to them too.
 */
export function insertOrderDesignVersion(
  orderId: string,
  version: number,
  fileUrl: string,
) {
  return supabase.from('designs').insert({
    order_id: orderId,
    order_item_id: null,
    version,
    file_url: fileUrl,
  });
}

/**
 * Delete a design version record from the `designs` table.
 * Errors are handled by the caller.
 */
export function deleteDesignRecord(designId: string) {
  return supabase.from('designs').delete().eq('id', designId);
}

// ---------------------------------------------------------------------------
// order_items status mutations
// ---------------------------------------------------------------------------

/**
 * Update an order item's status only (no details change).
 * Used e.g. when the designer uploads a file (`design_uploaded`) or the
 * Telegram send succeeds (`print_ready`).
 */
export function setOrderItemStatus(itemId: string, status: OrderStatusEnum) {
  return supabase
    .from('order_items')
    .update({ status })
    .eq('id', itemId);
}

/**
 * Update an order item's status AND details JSON in one call.
 * Used when sending a design for approval (status → `waiting_approval`).
 * Mirrors the signature of `updateOrderItemDetails` in orders.ts but returns
 * the raw result instead of `Promise<void>` so the caller has the flexibility
 * to inspect errors without re-throwing.
 */
export function setOrderItemStatusAndDetails(
  itemId: string,
  status: OrderStatusEnum,
  details: OrderDetailsJson,
) {
  return supabase
    .from('order_items')
    .update({ status, details: details as Json })
    .eq('id', itemId);
}

// ---------------------------------------------------------------------------
// orders status mutations
// ---------------------------------------------------------------------------

/**
 * Update an order's status only.
 * Used e.g. to flip the whole order to `waiting_approval` when all items are ready.
 */
export function setOrderStatus(orderId: string, status: OrderStatusEnum) {
  return supabase.from('orders').update({ status }).eq('id', orderId);
}

/**
 * Update an order's status AND details JSON in one call.
 * Used by the reseller-review flow (status + review note merged into details).
 */
export function updateOrderStatusAndDetails(
  orderId: string,
  status: OrderStatusEnum,
  details: OrderDetailsJson,
) {
  return supabase
    .from('orders')
    .update({ status, details: details as Json })
    .eq('id', orderId);
}

// ---------------------------------------------------------------------------
// Edge function — Telegram print dispatch
// ---------------------------------------------------------------------------

/**
 * Invoke the `send-to-telegram` edge function.
 * Returns `{ data, error }` — the caller is responsible for inspecting
 * `error.context` to extract the function's own error body (a FunctionsHttpError
 * wraps the real message).
 */
export function invokeSendToTelegram(body: Record<string, unknown>) {
  return supabase.functions.invoke('send-to-telegram', { body });
}
