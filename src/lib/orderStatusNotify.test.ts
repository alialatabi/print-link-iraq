/**
 * Tests for the shared order-status push helper.
 *
 * 1. Table test — STATUS_PUSH has valid Arabic copy for EVERY status/event this app
 *    wires a customer push on (admin flow + designer flow), and internal statuses stay silent.
 * 2. notifyOrderStatusPush fires the send-push edge function only for valid target + copy.
 * 3. notifyDesignerOfCustomerAction — the reverse (customer → designer) direction wired
 *    from OrderTracking approve/revision actions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is in place.
import {
  STATUS_PUSH,
  CUSTOMER_ACTION_PUSH,
  notifyOrderStatusPush,
  notifyDesignerOfCustomerAction,
} from './orderStatusNotify';

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

// Every status/logical-event key we call notifyOrderStatusPush() with, anywhere in the app.
// AdminPanel: waiting_approval, approved, print_ready, printed, delivered, cancelled.
// DesignerOrderDetails: waiting_approval, approved, revision, print_ready.
const WIRED_KEYS = [
  'waiting_approval',
  'approved',
  'revision',
  'print_ready',
  'printed',
  'delivered',
  'cancelled',
] as const;

// Internal statuses that must NOT notify the customer (no call-to-action for them).
const SILENT_STATUSES = ['draft', 'submitted', 'assigned', 'design_uploaded'] as const;

describe('STATUS_PUSH map completeness', () => {
  it.each(WIRED_KEYS)('has non-empty title + body for "%s"', (key) => {
    const entry = STATUS_PUSH[key];
    expect(entry, `STATUS_PUSH is missing copy for wired key "${key}"`).toBeTruthy();
    expect(entry!.title.trim().length).toBeGreaterThan(0);
    expect(entry!.body.trim().length).toBeGreaterThan(0);
  });

  it.each(SILENT_STATUSES)('stays silent for internal status "%s"', (status) => {
    expect(STATUS_PUSH[status]).toBeUndefined();
  });

  it('defines no keys beyond the wired set', () => {
    expect(Object.keys(STATUS_PUSH).sort()).toEqual([...WIRED_KEYS].sort());
  });
});

describe('notifyOrderStatusPush', () => {
  it('invokes send-push with the mapped copy for a valid status', () => {
    notifyOrderStatusPush('order-1', 'cust-1', 'waiting_approval');
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-push', {
      body: {
        userId: 'cust-1',
        title: STATUS_PUSH.waiting_approval!.title,
        body: STATUS_PUSH.waiting_approval!.body,
        data: { orderId: 'order-1', status: 'waiting_approval' },
      },
    });
  });

  it('no-ops when the customer id is missing', () => {
    notifyOrderStatusPush('order-1', null, 'waiting_approval');
    notifyOrderStatusPush('order-1', undefined, 'approved');
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('no-ops for a status with no customer-facing copy', () => {
    notifyOrderStatusPush('order-1', 'cust-1', 'assigned');
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('swallows a rejected invoke (push is non-critical)', async () => {
    mockSupabaseState.invokeError = { message: 'boom' };
    expect(() => notifyOrderStatusPush('order-1', 'cust-1', 'approved')).not.toThrow();
    // let the internal .catch() settle
    await Promise.resolve();
  });
});

describe('CUSTOMER_ACTION_PUSH map completeness', () => {
  it.each(['approved', 'revision'] as const)('has non-empty title + body for "%s"', (key) => {
    const entry = CUSTOMER_ACTION_PUSH[key];
    expect(entry).toBeTruthy();
    expect(entry.title.trim().length).toBeGreaterThan(0);
    expect(entry.body.trim().length).toBeGreaterThan(0);
  });

  it('stays out of STATUS_PUSH — customer-facing map keeps its exact key set', () => {
    // 'approved' exists in both maps but with DIFFERENT copy (customer vs designer audience).
    expect(STATUS_PUSH.approved!.title).not.toBe(CUSTOMER_ACTION_PUSH.approved.title);
  });
});

describe('notifyDesignerOfCustomerAction', () => {
  it('invokes send-push with the approved copy targeting the designer', () => {
    notifyDesignerOfCustomerAction('order-1', 'designer-1', 'approved');
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-push', {
      body: {
        userId: 'designer-1',
        title: CUSTOMER_ACTION_PUSH.approved.title,
        body: CUSTOMER_ACTION_PUSH.approved.body,
        data: { orderId: 'order-1', action: 'approved' },
      },
    });
  });

  it('invokes send-push with the revision copy targeting the designer', () => {
    notifyDesignerOfCustomerAction('order-1', 'designer-1', 'revision');
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-push', {
      body: {
        userId: 'designer-1',
        title: CUSTOMER_ACTION_PUSH.revision.title,
        body: CUSTOMER_ACTION_PUSH.revision.body,
        data: { orderId: 'order-1', action: 'revision' },
      },
    });
  });

  it('no-ops when the order has no assigned designer (designer_id NULL)', () => {
    notifyDesignerOfCustomerAction('order-1', null, 'approved');
    notifyDesignerOfCustomerAction('order-1', undefined, 'revision');
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('no-ops when the order id is missing', () => {
    notifyDesignerOfCustomerAction(null, 'designer-1', 'approved');
    notifyDesignerOfCustomerAction(undefined, 'designer-1', 'revision');
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('swallows a rejected invoke (push must never block the customer flow)', async () => {
    mockSupabase.functions.invoke.mockRejectedValueOnce(new Error('network down'));
    expect(() => notifyDesignerOfCustomerAction('order-1', 'designer-1', 'approved')).not.toThrow();
    // let the internal .catch() settle
    await Promise.resolve();
    await Promise.resolve();
  });
});
