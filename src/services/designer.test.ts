/**
 * Contract tests for the designer service.
 *
 * Verifies that each function targets the correct Supabase table/RPC/function
 * and applies the expected filters.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is in place.
import {
  getCustomerNamesForDesigner,
  queryDesignerOrderItemsBatch,
  countDesignerArchivedOrders,
  queryDesignerActiveOrders,
  queryDesignerActiveOrderCounts,
  queryDesignerArchivedOrders,
  getDesignerOrderDetail,
  listOrderItemsForDesigner,
  insertDesignVersion,
  setOrderItemStatus,
  setOrderStatus,
  updateOrderStatusAndDetails,
  deleteDesignRecord,
  invokeSendToTelegram,
  parseSortKey,
  orderHasRevision,
  isNewAssignedOrder,
  isOrderOverdue,
  aggregateActiveCounts,
  oldestActiveAgeDays,
  overdueFirst,
  type CountableOrder,
  type RevisionItemLike,
} from './designer';

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getCustomerNamesForDesigner
// ---------------------------------------------------------------------------

describe('getCustomerNamesForDesigner', () => {
  it('calls the get_customer_names_for_designer RPC', async () => {
    mockSupabaseState.queryData = [];
    const rpcSpy = vi.fn(async () => ({ data: [], error: null }));
    (mockSupabase as Record<string, unknown>)['rpc'] = rpcSpy;
    await getCustomerNamesForDesigner(['u1', 'u2']);
    expect(rpcSpy).toHaveBeenCalledWith('get_customer_names_for_designer', {
      customer_ids: ['u1', 'u2'],
    });
  });
});

// ---------------------------------------------------------------------------
// queryDesignerOrderItemsBatch
// ---------------------------------------------------------------------------

describe('queryDesignerOrderItemsBatch', () => {
  it('queries the order_items table', async () => {
    mockSupabaseState.queryData = [];
    await queryDesignerOrderItemsBatch(['o1', 'o2']);
    expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
  });
});

// ---------------------------------------------------------------------------
// countDesignerArchivedOrders
// ---------------------------------------------------------------------------

describe('countDesignerArchivedOrders', () => {
  it('queries the orders table', async () => {
    mockSupabaseState.queryData = null;
    await countDesignerArchivedOrders('designer-1', ['print_ready', 'printed', 'delivered']);
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });
});

// ---------------------------------------------------------------------------
// queryDesignerActiveOrders
// ---------------------------------------------------------------------------

describe('queryDesignerActiveOrders', () => {
  it('queries the orders table', async () => {
    mockSupabaseState.queryData = [];
    await queryDesignerActiveOrders('designer-1', '(print_ready,printed,delivered)', 20);
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });
});

// ---------------------------------------------------------------------------
// queryDesignerArchivedOrders
// ---------------------------------------------------------------------------

describe('queryDesignerArchivedOrders', () => {
  it('queries the orders table', async () => {
    mockSupabaseState.queryData = [];
    await queryDesignerArchivedOrders('designer-1', ['print_ready', 'printed', 'delivered'], 20);
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });
});

// ---------------------------------------------------------------------------
// getDesignerOrderDetail
// ---------------------------------------------------------------------------

describe('getDesignerOrderDetail', () => {
  it('queries the orders table via maybeSingle', async () => {
    mockSupabaseState.queryData = null;
    await getDesignerOrderDetail('order-1');
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });

  it('returns order data when found', async () => {
    mockSupabaseState.queryData = { id: 'o1', status: 'assigned' };
    const { data } = await getDesignerOrderDetail('o1');
    expect(data?.id).toBe('o1');
  });
});

// ---------------------------------------------------------------------------
// listOrderItemsForDesigner
// ---------------------------------------------------------------------------

describe('listOrderItemsForDesigner', () => {
  it('queries the order_items table', async () => {
    mockSupabaseState.queryData = [];
    await listOrderItemsForDesigner('order-1');
    expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
  });
});

// ---------------------------------------------------------------------------
// insertDesignVersion
// ---------------------------------------------------------------------------

describe('insertDesignVersion', () => {
  it('inserts into the designs table', async () => {
    mockSupabaseState.queryData = null;
    await insertDesignVersion('o1', 'item-1', 1, 'o1/item-1/v1.pdf');
    expect(mockSupabase.from).toHaveBeenCalledWith('designs');
  });
});

// ---------------------------------------------------------------------------
// setOrderItemStatus
// ---------------------------------------------------------------------------

describe('setOrderItemStatus', () => {
  it('updates the order_items table', async () => {
    mockSupabaseState.queryData = null;
    await setOrderItemStatus('item-1', 'design_uploaded');
    expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
  });
});

// ---------------------------------------------------------------------------
// setOrderStatus
// ---------------------------------------------------------------------------

describe('setOrderStatus', () => {
  it('updates the orders table', async () => {
    mockSupabaseState.queryData = null;
    await setOrderStatus('o1', 'waiting_approval');
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });
});

// ---------------------------------------------------------------------------
// updateOrderStatusAndDetails
// ---------------------------------------------------------------------------

describe('updateOrderStatusAndDetails', () => {
  it('updates the orders table', async () => {
    mockSupabaseState.queryData = null;
    await updateOrderStatusAndDetails('o1', 'approved', { review: { result: 'approved' } });
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });
});

// ---------------------------------------------------------------------------
// deleteDesignRecord
// ---------------------------------------------------------------------------

describe('deleteDesignRecord', () => {
  it('deletes from the designs table', async () => {
    mockSupabaseState.queryData = null;
    await deleteDesignRecord('d1');
    expect(mockSupabase.from).toHaveBeenCalledWith('designs');
  });
});

// ---------------------------------------------------------------------------
// invokeSendToTelegram
// ---------------------------------------------------------------------------

describe('invokeSendToTelegram', () => {
  it('invokes the send-to-telegram edge function', async () => {
    mockSupabaseState.invokeData = null;
    await invokeSendToTelegram({ orderId: 'o1', designFileUrls: [] });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'send-to-telegram',
      { body: { orderId: 'o1', designFileUrls: [] } },
    );
  });

  it('returns error when function fails', async () => {
    mockSupabaseState.invokeError = { message: 'Telegram not configured' };
    const { error } = await invokeSendToTelegram({ orderId: 'o1' });
    expect(error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// queryDesignerActiveOrderCounts (count dataset) + active-order ordering
// ---------------------------------------------------------------------------

describe('queryDesignerActiveOrderCounts', () => {
  it('queries the orders table', async () => {
    mockSupabaseState.queryData = [];
    await queryDesignerActiveOrderCounts('designer-1', '(print_ready,printed,delivered)', 500);
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });
});

describe('queryDesignerActiveOrders ordering', () => {
  const lastBuilder = () => {
    const { results } = mockSupabase.from.mock;
    return results[results.length - 1].value as unknown as Record<string, ReturnType<typeof vi.fn>>;
  };

  it('defaults to created_at descending (newest first)', async () => {
    mockSupabaseState.queryData = [];
    await queryDesignerActiveOrders('d1', '(x)', 20);
    expect(lastBuilder().order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('orders created_at ascending when ascending=true (oldest first)', async () => {
    mockSupabaseState.queryData = [];
    await queryDesignerActiveOrders('d1', '(x)', 20, true);
    expect(lastBuilder().order).toHaveBeenCalledWith('created_at', { ascending: true });
  });
});

// ---------------------------------------------------------------------------
// Pure count/sort helpers
// ---------------------------------------------------------------------------

const NOW = Date.parse('2026-07-03T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const revItem: RevisionItemLike = { status: 'assigned', details: { revisions: [{ note: 'fix logo' }] } };
const emptyRevItem: RevisionItemLike = { status: 'assigned', details: { revisions: [] } };
const plainItem: RevisionItemLike = { status: 'assigned', details: null };

const makeOrder = (o: Partial<CountableOrder>): CountableOrder => ({
  status: 'assigned',
  created_at: hoursAgo(1),
  updated_at: null,
  items: [],
  ...o,
});

describe('parseSortKey', () => {
  it('accepts each valid key', () => {
    expect(parseSortKey('newest')).toBe('newest');
    expect(parseSortKey('oldest')).toBe('oldest');
    expect(parseSortKey('overdue')).toBe('overdue');
  });

  it('falls back to newest for unknown/empty values', () => {
    expect(parseSortKey(null)).toBe('newest');
    expect(parseSortKey(undefined)).toBe('newest');
    expect(parseSortKey('')).toBe('newest');
    expect(parseSortKey('bogus')).toBe('newest');
  });
});

describe('orderHasRevision', () => {
  it('is true for an assigned item with a non-empty revisions array', () => {
    expect(orderHasRevision([revItem])).toBe(true);
  });

  it('is false for an empty revisions array', () => {
    expect(orderHasRevision([emptyRevItem])).toBe(false);
  });

  it('is false when the revision item is not in assigned status', () => {
    expect(
      orderHasRevision([{ status: 'waiting_approval', details: { revisions: [{ note: 'x' }] } }]),
    ).toBe(false);
  });

  it('is false for null/empty/plain item lists', () => {
    expect(orderHasRevision(null)).toBe(false);
    expect(orderHasRevision([])).toBe(false);
    expect(orderHasRevision([plainItem])).toBe(false);
  });
});

describe('isNewAssignedOrder', () => {
  it('is true for an assigned order with no revision items', () => {
    expect(isNewAssignedOrder('assigned', [plainItem])).toBe(true);
    expect(isNewAssignedOrder('assigned', [])).toBe(true);
  });

  it('is false for an assigned order that has a revision item', () => {
    expect(isNewAssignedOrder('assigned', [revItem])).toBe(false);
  });

  it('is false for any non-assigned status', () => {
    expect(isNewAssignedOrder('waiting_approval', [])).toBe(false);
    expect(isNewAssignedOrder('approved', [])).toBe(false);
  });
});

describe('isOrderOverdue', () => {
  it('is true when a new-assigned order is untouched for > 24h', () => {
    expect(isOrderOverdue(makeOrder({ status: 'assigned', updated_at: hoursAgo(30) }), NOW)).toBe(true);
  });

  it('is false when the new-assigned order is younger than 24h', () => {
    expect(isOrderOverdue(makeOrder({ status: 'assigned', updated_at: hoursAgo(5) }), NOW)).toBe(false);
  });

  it('falls back to created_at when updated_at is null', () => {
    expect(
      isOrderOverdue(makeOrder({ status: 'assigned', updated_at: null, created_at: hoursAgo(30) }), NOW),
    ).toBe(true);
  });

  it('is never overdue when the order has a revision item (not new-assigned)', () => {
    expect(
      isOrderOverdue(makeOrder({ status: 'assigned', updated_at: hoursAgo(72), items: [revItem] }), NOW),
    ).toBe(false);
  });

  it('is never overdue for non-assigned statuses', () => {
    expect(isOrderOverdue(makeOrder({ status: 'approved', updated_at: hoursAgo(72) }), NOW)).toBe(false);
  });
});

describe('aggregateActiveCounts', () => {
  it('buckets a mixed queue correctly and keeps revision orders out of "assigned"', () => {
    const orders: CountableOrder[] = [
      makeOrder({ status: 'assigned', updated_at: hoursAgo(1) }),   // new-assigned, fresh
      makeOrder({ status: 'assigned', updated_at: hoursAgo(30) }),  // new-assigned, overdue
      makeOrder({ status: 'assigned', items: [revItem] }),          // assigned + revision -> revisions only
      makeOrder({ status: 'waiting_approval', items: [revItem] }),  // waiting + revision -> both buckets
      makeOrder({ status: 'approved' }),                            // approved
      makeOrder({ status: 'design_uploaded' }),                     // counts only in "all"
    ];
    expect(aggregateActiveCounts(orders, NOW)).toEqual({
      all: 6,
      assigned: 2,
      revisions: 2,
      waiting_approval: 1,
      approved: 1,
      overdue: 1,
    });
  });

  it('returns all-zero for an empty queue', () => {
    expect(aggregateActiveCounts([], NOW)).toEqual({
      all: 0,
      assigned: 0,
      revisions: 0,
      waiting_approval: 0,
      approved: 0,
      overdue: 0,
    });
  });
});

describe('oldestActiveAgeDays', () => {
  it('returns null for an empty queue', () => {
    expect(oldestActiveAgeDays([], NOW)).toBeNull();
  });

  it('returns the whole-day age of the oldest created_at', () => {
    expect(
      oldestActiveAgeDays(
        [{ created_at: hoursAgo(10) }, { created_at: hoursAgo(50) }, { created_at: hoursAgo(3) }],
        NOW,
      ),
    ).toBe(2); // 50h -> 2 whole days
  });

  it('returns 0 when the oldest order is under a day old', () => {
    expect(oldestActiveAgeDays([{ created_at: hoursAgo(5) }], NOW)).toBe(0);
  });
});

describe('overdueFirst', () => {
  it('floats overdue rows to the top, stable within each group', () => {
    const rows = [
      { id: 'a', hot: false },
      { id: 'b', hot: true },
      { id: 'c', hot: false },
      { id: 'd', hot: true },
    ];
    expect(overdueFirst(rows, (r) => r.hot).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('returns a new array and leaves the input untouched', () => {
    const rows = [{ id: 'a', hot: false }];
    const out = overdueFirst(rows, (r) => r.hot);
    expect(out).not.toBe(rows);
    expect(rows.map((r) => r.id)).toEqual(['a']);
  });
});
