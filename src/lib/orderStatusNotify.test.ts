/**
 * Tests for the shared order-status push helper.
 *
 * 1. Table test — STATUS_PUSH has valid Arabic copy for EVERY status/event this app
 *    wires a customer push on (admin flow + designer flow), and internal statuses stay silent.
 * 2. notifyOrderStatusPush fires the send-push edge function only for valid target + copy.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is in place.
import { STATUS_PUSH, notifyOrderStatusPush } from './orderStatusNotify';

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
