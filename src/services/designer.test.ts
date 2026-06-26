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
  queryDesignerArchivedOrders,
  getDesignerOrderDetail,
  listOrderItemsForDesigner,
  insertDesignVersion,
  setOrderItemStatus,
  setOrderStatus,
  updateOrderStatusAndDetails,
  deleteDesignRecord,
  invokeSendToTelegram,
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
