/**
 * Reusable Supabase client mock for Vitest.
 *
 * Usage in a test file:
 *
 *   import { mockSupabase, mockSupabaseState, resetSupabaseMock } from '@/test/mocks/supabase';
 *
 *   vi.mock('@/integrations/supabase/client', async () => {
 *     const { mockSupabase } = await import('@/test/mocks/supabase');
 *     return { supabase: mockSupabase };
 *   });
 *
 *   beforeEach(() => {
 *     resetSupabaseMock();
 *     vi.clearAllMocks();
 *   });
 *
 * Then in individual tests:
 *   mockSupabaseState.session = { user: { id: 'u1' }, ... };
 *   mockSupabaseState.queryData = [{ role: 'admin' }];
 *   mockSupabaseState.invokeData = { token: 'abc' };
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Configurable state — mutate these in your tests before rendering
// ---------------------------------------------------------------------------

export interface MockSupabaseState {
  /** The session returned by auth.getSession() and auth.onAuthStateChange(). */
  session: Record<string, unknown> | null;
  /** Data returned by awaited query chains (e.g. from().select().eq()). */
  queryData: unknown;
  /** Error returned by awaited query chains. */
  queryError: unknown | null;
  /** Data returned by functions.invoke(). */
  invokeData: unknown | null;
  /** Error returned by functions.invoke(). */
  invokeError: unknown | null;
}

export const mockSupabaseState: MockSupabaseState = {
  session: null,
  queryData: null,
  queryError: null,
  invokeData: null,
  invokeError: null,
};

/** Reset state to safe defaults. Call this in beforeEach. */
export function resetSupabaseMock(): void {
  mockSupabaseState.session = null;
  mockSupabaseState.queryData = null;
  mockSupabaseState.queryError = null;
  mockSupabaseState.invokeData = null;
  mockSupabaseState.invokeError = null;
}

// ---------------------------------------------------------------------------
// Chainable query builder
// ---------------------------------------------------------------------------

/**
 * Creates a fresh chainable query builder that reads from mockSupabaseState
 * at resolution time. Each supabase.from() call gets a new builder so that
 * Promise.all([query1, query2]) doesn't interfere.
 */
function makeQueryBuilder() {
  // Lazy resolver — reads state at the time the promise is awaited
  const resolveArray = () =>
    Promise.resolve({
      data: mockSupabaseState.queryData ?? [],
      error: mockSupabaseState.queryError ?? null,
    });

  const resolveSingle = () =>
    Promise.resolve({
      data: mockSupabaseState.queryData ?? null,
      error: mockSupabaseState.queryError ?? null,
    });

  const builder: Record<string, unknown> = {};

  // All standard query methods return the same builder (fluent chaining)
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'in', 'is', 'contains',
    'filter', 'match', 'not', 'or',
    'order', 'limit', 'range',
  ] as const;

  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }

  // Terminal methods that actually return data
  builder['single'] = vi.fn(resolveSingle);
  builder['maybeSingle'] = vi.fn(resolveSingle);

  // Make the builder itself awaitable: `await supabase.from('t').select('*').eq('id', '1')`
  builder['then'] = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (r: unknown) => unknown,
  ) => resolveArray().then(onFulfilled, onRejected);

  return builder;
}

// ---------------------------------------------------------------------------
// Auth state-change listeners (lets tests trigger auth events)
// ---------------------------------------------------------------------------

const authChangeListeners: Array<(event: string, session: unknown) => void> = [];

/** Trigger an auth state change across all registered listeners. */
export function triggerAuthChange(event: string, session: unknown = null): void {
  authChangeListeners.forEach(cb => cb(event, session));
}

// ---------------------------------------------------------------------------
// The mock supabase object
// ---------------------------------------------------------------------------

export const mockSupabase = {
  from: vi.fn(() => makeQueryBuilder()),

  auth: {
    /** Returns the current mock session. */
    getSession: vi.fn(async () => ({
      data: { session: mockSupabaseState.session },
      error: null,
    })),

    /** Returns the user from the current mock session. */
    getUser: vi.fn(async () => ({
      data: { user: (mockSupabaseState.session as Record<string, unknown> | null)?.['user'] ?? null },
      error: null,
    })),

    /**
     * Registers the callback and fires INITIAL_SESSION asynchronously
     * (via setTimeout, so getSession().then() microtask runs first —
     * this mirrors real Supabase behaviour and lets AuthProvider's
     * `initialSessionHandled` flag work correctly).
     */
    onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
      authChangeListeners.push(callback);
      setTimeout(() => callback('INITIAL_SESSION', mockSupabaseState.session), 0);
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    }),

    signOut: vi.fn(async () => ({ error: null })),

    setSession: vi.fn(async (_tokens: unknown) => ({
      data: { session: null, user: null },
      error: null,
    })),
  },

  functions: {
    invoke: vi.fn(async (_name: string, _opts?: unknown) => ({
      data: mockSupabaseState.invokeData,
      error: mockSupabaseState.invokeError,
    })),
  },

  /** Minimal channel stub (used by realtime subscriptions). */
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  })),

  removeChannel: vi.fn(),
};
