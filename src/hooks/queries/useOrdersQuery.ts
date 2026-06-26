/**
 * React Query hooks for the Orders domain.
 *
 * All data access goes through `src/services/orders` — this module never
 * calls supabase directly.  Options are deliberately conservative so that
 * the migrated pages behave identically to the previous useEffect approach:
 * no auto-refetch on window focus / reconnect, 30-second stale time.
 *
 * Signed-URL resolution for designer thumbnails is intentionally omitted
 * from useMyOrdersQuery — MyOrders.tsx handles it in a derived useEffect
 * so that the initial render is not blocked waiting on storage.
 *
 * loadDesigns in OrderTracking is intentionally left as a manual useCallback
 * because it resolves multiple signed URLs into several useState maps;
 * converting that into a queryFn would change the progressive-reveal
 * behavior.  The realtime handler for designs therefore still calls
 * loadDesigns() directly — only the order + order_items handlers
 * call invalidateQueries.
 */

import { useQuery } from '@tanstack/react-query';
import {
  queryMyOrders,
  queryOrderItemsInBatch,
  queryDesignsInBatch,
  getOrder,
  listOrderItems,
} from '@/services/orders';
import type { OrderItemListRow, DesignBatchRow } from '@/services/orders';
import type { OrderDetailsJson } from '@/types/db';
import type { OrderStatus } from '@/data/mockData';
import { isImageUrl } from '@/lib/designVault';

// ---------------------------------------------------------------------------
// Shared query options — behaviour-preserving one-shot-fetch config
// ---------------------------------------------------------------------------

const BASE_OPTS = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const ordersKeys = {
  /** Key for the current user's order list (or all orders for admins). */
  myOrders: (userId: string, isAdmin: boolean) =>
    ['orders', 'my', userId, isAdmin] as const,
  /** Key for a single order by id. */
  order: (orderId: string) => ['orders', 'detail', orderId] as const,
  /** Key for the items belonging to a single order. */
  orderItems: (orderId: string) => ['orders', 'items', orderId] as const,
};

// ---------------------------------------------------------------------------
// Shared type — OrderRow (previously local to MyOrders)
// ---------------------------------------------------------------------------

/**
 * Enriched order row used by MyOrders to render the order list.
 * Mirrors the original local OrderRow interface in MyOrders.tsx — status is
 * narrowed to OrderStatus so StatusBadge and orderTotal work without casts.
 * `_thumb` holds a public URL initially; the page swaps in a signed URL
 * asynchronously via a derived useEffect once the designer's file is resolved.
 */
export interface OrderRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  customer_id: string;
  designer_id: string | null;
  details: OrderDetailsJson | null;
  templates?: { name?: string; service_type?: string; preview_url?: string | null } | null;
  _items: OrderItemListRow[];
  _thumb: string | null;
  _designPath: string | null;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const firstImage = (urls: unknown): string | null => {
  if (!Array.isArray(urls)) return null;
  return urls.find((u): u is string => typeof u === 'string' && isImageUrl(u)) || null;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches the customer's (or admin's) orders, batch items, and batch designs,
 * then enriches them into OrderRow[].
 *
 * Intentionally omits signed-URL resolution — the page keeps a
 * `thumbOverrides` state and a derived useEffect to preserve the original
 * progressive-update thumbnail behaviour.
 */
export function useMyOrdersQuery(userId: string | undefined, isAdmin: boolean) {
  return useQuery<OrderRow[]>({
    queryKey: ordersKeys.myOrders(userId ?? '', isAdmin),
    queryFn: async () => {
      const { data: ordersData } = await queryMyOrders(userId!, isAdmin);
      if (!ordersData || ordersData.length === 0) return [];

      const orderIds = ordersData.map(o => o.id);
      const [{ data: itemsData }, { data: designsData }] = await Promise.all([
        queryOrderItemsInBatch(orderIds),
        queryDesignsInBatch(orderIds),
      ]);

      const itemsByOrder = new Map<string, OrderItemListRow[]>();
      ((itemsData as unknown as OrderItemListRow[]) || []).forEach((item) => {
        const list = itemsByOrder.get(item.order_id) || [];
        list.push(item);
        itemsByOrder.set(item.order_id, list);
      });

      const designByOrder = new Map<string, { file_url: string; version: number }>();
      ((designsData as DesignBatchRow[]) || []).forEach((d) => {
        if (!d.file_url) return;
        const cur = designByOrder.get(d.order_id);
        if (!cur || d.version > cur.version) {
          designByOrder.set(d.order_id, { file_url: d.file_url, version: d.version });
        }
      });

      return ordersData.map((o): OrderRow => {
        const items = itemsByOrder.get(o.id) || [];
        const det = (o.details || {}) as OrderDetailsJson;
        const itemImg =
          items.map(it => firstImage(it.details?.attachment_urls)).find(Boolean) || null;
        // `o.templates` shape from the join may differ slightly; cast to match.
        const tpl = o.templates as { preview_url?: string | null } | null;
        const tmplPrev =
          tpl?.preview_url ||
          items.find(it => it.templates?.preview_url)?.templates?.preview_url ||
          null;
        // Supabase status enum === OrderStatus union at runtime; cast is safe.
        return {
          id: o.id,
          status: o.status as unknown as OrderStatus,
          created_at: o.created_at,
          updated_at: o.updated_at,
          customer_id: o.customer_id,
          designer_id: o.designer_id,
          details: o.details as OrderDetailsJson | null,
          templates: o.templates as OrderRow['templates'],
          _items: items,
          _thumb: firstImage(det.attachment_urls) || itemImg || tmplPrev || null,
          _designPath: designByOrder.get(o.id)?.file_url || null,
        };
      });
    },
    enabled: !!userId,
    ...BASE_OPTS,
  });
}

/**
 * Fetches a single order by id together with its template name.
 * Returns null when the order does not exist.
 */
export function useOrderQuery(orderId: string | undefined) {
  return useQuery({
    queryKey: ordersKeys.order(orderId ?? ''),
    queryFn: async () => {
      const { data } = await getOrder(orderId!);
      return data ?? null;
    },
    enabled: !!orderId,
    ...BASE_OPTS,
  });
}

/**
 * Fetches all order items for one order in insertion order.
 * Returns the raw Supabase rows; callers cast to their local OrderItem type.
 */
export function useOrderItemsQuery(orderId: string | undefined) {
  return useQuery({
    queryKey: ordersKeys.orderItems(orderId ?? ''),
    queryFn: async () => {
      const { data } = await listOrderItems(orderId!);
      return data ?? [];
    },
    enabled: !!orderId,
    ...BASE_OPTS,
  });
}
