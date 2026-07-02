/**
 * Tests for useHeartbeat — the presence heartbeat.
 *
 * Invariants under test (UX audit §D P2):
 *   - NO immediate on-mount beat (keeps it off the post-login load path).
 *   - The first beat fires after ONE 60s interval, crediting 60s via the single atomic RPC.
 *   - Steady 60s cadence, one RPC per beat.
 *   - A tab regaining visibility refreshes last_seen WITHOUT crediting time (0 seconds).
 *   - Any RPC failure (incl. the pre-migration "function does not exist") is swallowed — a heartbeat
 *     must never surface to the UI.
 *   - Disabled / no user id => never beats; unmount stops the interval.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { mockSupabase, resetSupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

import { useHeartbeat } from './useHeartbeat';

// The RPC is not on the default mock (like services/orders.test.ts, install a spy per test).
const rpc = () => (mockSupabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;

beforeEach(() => {
  resetSupabaseMock();
  vi.clearAllMocks();
  vi.useFakeTimers();
  (mockSupabase as Record<string, unknown>).rpc = vi.fn(async () => ({ data: null, error: null }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useHeartbeat', () => {
  it('does NOT beat immediately on mount', () => {
    renderHook(() => useHeartbeat('u1', true));
    expect(rpc()).not.toHaveBeenCalled();
  });

  it('fires the first atomic beat only after one 60s interval, crediting 60 seconds', () => {
    renderHook(() => useHeartbeat('u1', true));
    vi.advanceTimersByTime(60_000);
    expect(rpc()).toHaveBeenCalledTimes(1);
    expect(rpc()).toHaveBeenCalledWith('heartbeat_increment', { p_seconds: 60 });
  });

  it('keeps a steady 60s cadence — one beat per interval', () => {
    renderHook(() => useHeartbeat('u1', true));
    vi.advanceTimersByTime(180_000);
    expect(rpc()).toHaveBeenCalledTimes(3);
  });

  it('refreshes last_seen without crediting time when the tab becomes visible', () => {
    renderHook(() => useHeartbeat('u1', true));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rpc()).toHaveBeenCalledWith('heartbeat_increment', { p_seconds: 0 });
  });

  it('never beats when disabled or without a user id', () => {
    renderHook(() => useHeartbeat(undefined, true));
    renderHook(() => useHeartbeat('u1', false));
    vi.advanceTimersByTime(120_000);
    expect(rpc()).not.toHaveBeenCalled();
  });

  it('swallows RPC failures so a heartbeat never surfaces to the UI (pre-migration resilience)', () => {
    (mockSupabase as Record<string, unknown>).rpc = vi.fn(async () => {
      throw new Error('function public.heartbeat_increment(integer) does not exist');
    });
    renderHook(() => useHeartbeat('u1', true));
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow();
  });

  it('stops beating after unmount', () => {
    const { unmount } = renderHook(() => useHeartbeat('u1', true));
    unmount();
    vi.advanceTimersByTime(120_000);
    expect(rpc()).not.toHaveBeenCalled();
  });
});
