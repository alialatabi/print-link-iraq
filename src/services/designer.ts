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
 *
 * `ascending` controls the `created_at` order: `false` (default) = newest first,
 * `true` = oldest first. Oldest-first is used by the "الأقدم أولاً" and
 * "المتأخرة أولاً" sort modes so the oldest (hence overdue) orders always land
 * inside the page cap instead of hiding beyond it.
 */
export function queryDesignerActiveOrders(
  userId: string,
  excludeStatuses: string,
  limit: number,
  ascending = false,
) {
  return supabase
    .from('orders')
    .select(DESIGNER_ORDER_SELECT)
    .eq('designer_id', userId)
    .not('status', 'in', excludeStatuses)
    .order('created_at', { ascending })
    .limit(limit);
}

/**
 * Lightweight projection used to compute TRUE tab counts + the workload strip,
 * independent of the paginated list. Selects only the columns needed to bucket
 * each active order (order status/timestamps + each item's status & revision
 * signal) so the counts never lie once the queue exceeds one page.
 */
export const DESIGNER_COUNT_SELECT =
  'id, status, created_at, updated_at, order_items(status, details)';

/**
 * Fetch the lightweight count dataset for ALL of a designer's active orders
 * (up to `cap`, a safety valve — a real queue is dozens, never thousands).
 * Ordered oldest-first so the oldest order is always retained when capped
 * (keeps the "أقدم طلب" age accurate). Parallelise this with the list fetch.
 */
export function queryDesignerActiveOrderCounts(
  userId: string,
  excludeStatuses: string,
  cap: number,
) {
  return supabase
    .from('orders')
    .select(DESIGNER_COUNT_SELECT)
    .eq('designer_id', userId)
    .not('status', 'in', excludeStatuses)
    .order('created_at', { ascending: true })
    .limit(cap);
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

// ---------------------------------------------------------------------------
// Active-queue counting & sorting — PURE helpers (no Supabase, unit-tested)
//
// Shared by DesignerOrders for BOTH the paginated list (card rendering +
// client-side "overdue first" ordering) and the un-paginated count dataset
// (true tab badges + workload strip). Keeping the bucket logic here means the
// list and the badges can never disagree.
// ---------------------------------------------------------------------------

/** A day-and-a-bit old, still awaiting the designer's first action → "متأخر". */
const OVERDUE_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimal item shape needed to detect a pending (customer-requested) revision. */
export interface RevisionItemLike {
  status: string | null;
  details: { revisions?: unknown } | null;
}

/** Minimal order shape needed to bucket an active order. */
export interface CountableOrder {
  status: string;
  created_at: string;
  updated_at: string | null;
  items: RevisionItemLike[];
}

/** Persisted sort choices for the active queue. */
export const DESIGNER_SORT_KEYS = ['newest', 'oldest', 'overdue'] as const;
export type DesignerSortKey = (typeof DESIGNER_SORT_KEYS)[number];

/** Coerce an untrusted (localStorage) value to a valid sort key. */
export function parseSortKey(raw: string | null | undefined): DesignerSortKey {
  return (DESIGNER_SORT_KEYS as readonly string[]).includes(raw ?? '')
    ? (raw as DesignerSortKey)
    : 'newest';
}

/**
 * True when the order has at least one item that is back in `assigned` with a
 * non-empty revision history — i.e. the customer asked for a change. A revision
 * only flips the ITEM status (the order row is untouched), so this cannot be
 * derived from `orders.status` alone.
 */
export function orderHasRevision(items: readonly RevisionItemLike[] | null | undefined): boolean {
  return (items ?? []).some((it) => {
    const revs = it.details?.revisions;
    return it.status === 'assigned' && Array.isArray(revs) && revs.length > 0;
  });
}

/** A freshly assigned order still awaiting its first upload (excludes revisions). */
export function isNewAssignedOrder(
  status: string,
  items: readonly RevisionItemLike[] | null | undefined,
): boolean {
  return status === 'assigned' && !orderHasRevision(items);
}

/** A new-assigned order left untouched for more than a day. */
export function isOrderOverdue(order: CountableOrder, now: number): boolean {
  if (!isNewAssignedOrder(order.status, order.items)) return false;
  const ts = new Date(order.updated_at || order.created_at).getTime();
  return now - ts > OVERDUE_MS;
}

export interface ActiveQueueCounts {
  all: number;
  assigned: number;
  revisions: number;
  waiting_approval: number;
  approved: number;
  overdue: number;
}

/** Bucket the full active dataset into the tab/strip counts in one pass. */
export function aggregateActiveCounts(
  orders: readonly CountableOrder[],
  now: number,
): ActiveQueueCounts {
  const counts: ActiveQueueCounts = {
    all: 0,
    assigned: 0,
    revisions: 0,
    waiting_approval: 0,
    approved: 0,
    overdue: 0,
  };
  for (const o of orders) {
    counts.all += 1;
    if (orderHasRevision(o.items)) counts.revisions += 1;
    if (isNewAssignedOrder(o.status, o.items)) counts.assigned += 1;
    if (o.status === 'waiting_approval') counts.waiting_approval += 1;
    if (o.status === 'approved') counts.approved += 1;
    if (isOrderOverdue(o, now)) counts.overdue += 1;
  }
  return counts;
}

/** Whole-day age of the oldest active order (by created_at); null when empty. */
export function oldestActiveAgeDays(
  orders: readonly { created_at: string }[],
  now: number,
): number | null {
  let oldest = Infinity;
  for (const o of orders) {
    const t = new Date(o.created_at).getTime();
    if (Number.isFinite(t) && t < oldest) oldest = t;
  }
  if (oldest === Infinity) return null;
  return Math.max(0, Math.floor((now - oldest) / DAY_MS));
}

/**
 * Stable partition that floats overdue rows to the top while preserving the
 * incoming order within each group. Server-side ordering already handles
 * newest/oldest; this is the only client-side step, applied over the loaded
 * page for the "overdue first" mode (which fetches oldest-first, so overdue
 * items are guaranteed to be inside the page).
 */
export function overdueFirst<T>(orders: readonly T[], isOverdue: (o: T) => boolean): T[] {
  const hot: T[] = [];
  const cold: T[] = [];
  for (const o of orders) (isOverdue(o) ? hot : cold).push(o);
  return [...hot, ...cold];
}
