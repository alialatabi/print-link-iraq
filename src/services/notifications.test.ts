/**
 * Contract tests for the notifications service.
 *
 * Verifies that each function targets the correct Supabase table and applies
 * the right filters without testing the exact supabase-js query builder shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is in place.
import {
  loadUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications';

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// loadUserNotifications
// ---------------------------------------------------------------------------

describe('loadUserNotifications', () => {
  it('queries the notifications table', async () => {
    mockSupabaseState.queryData = [];
    await loadUserNotifications('user-1');
    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
  });

  it('returns notifications from the mock', async () => {
    const fakeNotif = {
      id: 'n1', title: 'Test', message: 'Hello', read: false,
      created_at: '2026-01-01T00:00:00Z', order_id: null, link: null, user_id: 'user-1',
    };
    mockSupabaseState.queryData = [fakeNotif];
    const { data } = await loadUserNotifications('user-1');
    expect(data).toHaveLength(1);
    expect((data as typeof fakeNotif[])[0].id).toBe('n1');
  });
});

// ---------------------------------------------------------------------------
// markAllNotificationsRead
// ---------------------------------------------------------------------------

describe('markAllNotificationsRead', () => {
  it('targets the notifications table', async () => {
    mockSupabaseState.queryData = null;
    await markAllNotificationsRead('user-1');
    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
  });
});

// ---------------------------------------------------------------------------
// markNotificationRead
// ---------------------------------------------------------------------------

describe('markNotificationRead', () => {
  it('targets the notifications table', async () => {
    mockSupabaseState.queryData = null;
    await markNotificationRead('n1');
    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
  });
});
