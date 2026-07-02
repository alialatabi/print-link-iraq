/**
 * Contract tests for the orders service.
 *
 * These tests verify:
 *  - The correct Supabase table / storage paths are called.
 *  - The customer_id filter is applied (or skipped) based on the isAdmin flag.
 *  - Mutation helpers pass the right arguments through.
 *
 * We use the shared mockSupabase at @/test/mocks/supabase so that every test starts
 * from a clean state and the mock never leaks between specs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is in place.
import {
  queryMyOrders,
  queryOrderItemsInBatch,
  queryDesignsInBatch,
  getOrder,
  listOrderItems,
  listDesignsForOrder,
  createRevisionSignedUrl,
  approveDesignVersion,
  updateOrderItemDetails,
  cancelOrder,
  isDuplicateKeyError,
  isAlreadyExistsError,
  createCartOrder,
  insertCartOrderItem,
  uploadCartAttachment,
} from './orders';

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// queryMyOrders
// ---------------------------------------------------------------------------

describe('queryMyOrders', () => {
  it('queries the orders table', async () => {
    mockSupabaseState.queryData = [];
    await queryMyOrders('user-1', false);
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });

  it('returns order data provided by the mock', async () => {
    const fakeOrder = { id: 'o1', status: 'submitted', customer_id: 'user-1' };
    mockSupabaseState.queryData = [fakeOrder];
    const { data } = await queryMyOrders('user-1', false);
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe('o1');
  });

  it('applies the eq filter with customer_id when isAdmin is false', async () => {
    // Track which .eq() calls are made on the query builder returned by from('orders').
    const eqSpy = vi.fn().mockReturnThis();
    const b: Record<string, unknown> = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), eq: eqSpy };
    b['then'] = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res, rej);
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(b);

    await queryMyOrders('user-1', false);

    // When not an admin, the service must filter by customer_id.
    expect(eqSpy).toHaveBeenCalledWith('customer_id', 'user-1');
  });

  it('skips the customer_id eq filter when isAdmin is true', async () => {
    const eqSpy = vi.fn().mockReturnThis();
    const b: Record<string, unknown> = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), eq: eqSpy };
    b['then'] = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res, rej);
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce(b);

    await queryMyOrders('user-1', true);

    expect(eqSpy).not.toHaveBeenCalledWith('customer_id', 'user-1');
  });
});

// ---------------------------------------------------------------------------
// queryOrderItemsInBatch
// ---------------------------------------------------------------------------

describe('queryOrderItemsInBatch', () => {
  it('queries the order_items table', async () => {
    mockSupabaseState.queryData = [];
    await queryOrderItemsInBatch(['o1', 'o2']);
    expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
  });

  it('returns data from the mock', async () => {
    mockSupabaseState.queryData = [{ id: 'item-1', order_id: 'o1' }];
    const { data } = await queryOrderItemsInBatch(['o1']);
    expect(data![0].id).toBe('item-1');
  });
});

// ---------------------------------------------------------------------------
// queryDesignsInBatch
// ---------------------------------------------------------------------------

describe('queryDesignsInBatch', () => {
  it('queries the designs table', async () => {
    mockSupabaseState.queryData = [];
    await queryDesignsInBatch(['o1']);
    expect(mockSupabase.from).toHaveBeenCalledWith('designs');
  });
});

// ---------------------------------------------------------------------------
// getOrder
// ---------------------------------------------------------------------------

describe('getOrder', () => {
  it('returns null data when order is not found', async () => {
    mockSupabaseState.queryData = null;
    const { data } = await getOrder('nonexistent');
    expect(data).toBeNull();
  });

  it('returns order data when found', async () => {
    mockSupabaseState.queryData = { id: 'o1', status: 'submitted' };
    const { data } = await getOrder('o1');
    expect(data?.id).toBe('o1');
  });

  it('queries the orders table via maybeSingle', async () => {
    mockSupabaseState.queryData = null;
    await getOrder('o1');
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });
});

// ---------------------------------------------------------------------------
// listOrderItems
// ---------------------------------------------------------------------------

describe('listOrderItems', () => {
  it('queries the order_items table for the given order', async () => {
    mockSupabaseState.queryData = [];
    await listOrderItems('o1');
    expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
  });
});

// ---------------------------------------------------------------------------
// listDesignsForOrder
// ---------------------------------------------------------------------------

describe('listDesignsForOrder', () => {
  it('queries the designs table', async () => {
    mockSupabaseState.queryData = [];
    await listDesignsForOrder('o1');
    expect(mockSupabase.from).toHaveBeenCalledWith('designs');
  });

  it('returns design rows from the mock', async () => {
    mockSupabaseState.queryData = [{ id: 'd1', version: 2, file_url: 'path/to/design.png' }];
    const { data } = await listDesignsForOrder('o1');
    expect(data![0].version).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// createRevisionSignedUrl
// ---------------------------------------------------------------------------

describe('createRevisionSignedUrl', () => {
  it('returns the signed URL from storage', async () => {
    const fakeStorage = {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: 'https://example.com/signed-url' },
          error: null,
        })),
      })),
    };
    (mockSupabase as Record<string, unknown>).storage = fakeStorage;
    const url = await createRevisionSignedUrl('orders/123/img.png');
    expect(url).toBe('https://example.com/signed-url');
  });

  it('returns null when signing fails', async () => {
    const fakeStorage = {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({ data: null, error: { message: 'not found' } })),
      })),
    };
    (mockSupabase as Record<string, unknown>).storage = fakeStorage;
    const url = await createRevisionSignedUrl('orders/123/missing.png');
    expect(url).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// approveDesignVersion
// ---------------------------------------------------------------------------

describe('approveDesignVersion', () => {
  it('calls update on the designs table', async () => {
    mockSupabaseState.queryData = null;
    await approveDesignVersion('d1');
    expect(mockSupabase.from).toHaveBeenCalledWith('designs');
  });
});

// ---------------------------------------------------------------------------
// updateOrderItemDetails
// ---------------------------------------------------------------------------

describe('updateOrderItemDetails', () => {
  it('calls update on the order_items table', async () => {
    mockSupabaseState.queryData = null;
    await updateOrderItemDetails('item-1', 'approved', { approved_at: '2026-01-01T00:00:00Z' });
    expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
  });
});

// ---------------------------------------------------------------------------
// cancelOrder
// ---------------------------------------------------------------------------

describe('cancelOrder', () => {
  it('calls update on the orders table', async () => {
    mockSupabaseState.queryData = null;
    await cancelOrder('o1');
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
  });

  it('returns { data, error } so the caller can check for failures', async () => {
    mockSupabaseState.queryData = null;
    mockSupabaseState.queryError = null;
    const result = await cancelOrder('o1');
    // The result should be awaitable and contain an error field
    expect(result).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// isDuplicateKeyError / isAlreadyExistsError (idempotency predicates)
// ---------------------------------------------------------------------------

describe('isDuplicateKeyError', () => {
  it('is true only for Postgres unique-violation (23505)', () => {
    expect(isDuplicateKeyError({ code: '23505' })).toBe(true);
    expect(isDuplicateKeyError({ code: '23503' })).toBe(false);
    expect(isDuplicateKeyError({ message: 'duplicate key value' })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError(undefined)).toBe(false);
  });
});

describe('isAlreadyExistsError', () => {
  it('detects storage "already exists" by 409 status', () => {
    expect(isAlreadyExistsError({ statusCode: '409' })).toBe(true);
    expect(isAlreadyExistsError({ statusCode: 409 })).toBe(true);
  });
  it('detects storage "already exists" by message/error text', () => {
    expect(isAlreadyExistsError({ error: 'Duplicate', message: 'The resource already exists' })).toBe(true);
    expect(isAlreadyExistsError({ message: 'already exists' })).toBe(true);
  });
  it('is false for transient/other errors and nullish input', () => {
    expect(isAlreadyExistsError({ statusCode: '500', message: 'network error' })).toBe(false);
    expect(isAlreadyExistsError(null)).toBe(false);
    expect(isAlreadyExistsError(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createCartOrder
// ---------------------------------------------------------------------------

describe('createCartOrder', () => {
  it('inserts into the orders table and returns { data, error }', async () => {
    mockSupabaseState.queryData = { id: 'order-1' };
    const result = await createCartOrder('order-1', 'user-1', { item_count: 2 });
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
    expect(result).toHaveProperty('error');
    expect(result.data?.id).toBe('order-1');
  });

  it('surfaces a duplicate-key error so the caller can treat it as already-created', async () => {
    mockSupabaseState.queryData = null;
    mockSupabaseState.queryError = { code: '23505' };
    const { error } = await createCartOrder('order-1', 'user-1', { item_count: 1 });
    expect(isDuplicateKeyError(error)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// insertCartOrderItem
// ---------------------------------------------------------------------------

describe('insertCartOrderItem', () => {
  it('inserts into the order_items table and returns { data, error }', async () => {
    mockSupabaseState.queryData = { id: 'item-1' };
    const result = await insertCartOrderItem({ id: 'item-1', orderId: 'order-1', templateId: 't1', details: { details: 'x' } });
    expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
    expect(result.data?.id).toBe('item-1');
  });

  it('accepts a null templateId (AI-designed items)', async () => {
    mockSupabaseState.queryData = { id: 'item-ai' };
    const result = await insertCartOrderItem({ id: 'item-ai', orderId: 'order-1', templateId: null, details: { is_ai_design: true } });
    expect(result.data?.id).toBe('item-ai');
  });
});

// ---------------------------------------------------------------------------
// uploadCartAttachment
// ---------------------------------------------------------------------------

describe('uploadCartAttachment', () => {
  it('uploads to the order-attachments bucket at the given path', async () => {
    const uploadSpy = vi.fn(async () => ({ data: { path: 'order-1/0/0.png' }, error: null }));
    const fromSpy = vi.fn(() => ({ upload: uploadSpy }));
    (mockSupabase as Record<string, unknown>).storage = { from: fromSpy };
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await uploadCartAttachment('order-1/0/0.png', file);
    expect(fromSpy).toHaveBeenCalledWith('order-attachments');
    expect(uploadSpy).toHaveBeenCalledWith('order-1/0/0.png', file);
  });
});
