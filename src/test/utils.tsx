/**
 * Test utilities — renderWithProviders + re-exports from @testing-library/react.
 *
 * IMPORTANT: any test file that uses renderWithProviders must mock
 * `@/integrations/supabase/client` BEFORE this import resolves, because
 * AuthProvider (wrapped inside renderWithProviders) calls supabase at mount.
 *
 * Recommended pattern:
 *
 *   vi.mock('@/integrations/supabase/client', async () => {
 *     const { mockSupabase } = await import('@/test/mocks/supabase');
 *     return { supabase: mockSupabase };
 *   });
 *
 *   beforeEach(() => { resetSupabaseMock(); vi.clearAllMocks(); });
 *
 * For tests that only need CartProvider (no auth), import CartProvider
 * and build a wrapper directly — no supabase mock required.
 */

import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { render, RenderOptions } from '@testing-library/react';

// Re-export everything from RTL so tests can import from one place
// eslint-disable-next-line react-refresh/only-export-components -- test utility re-export, not a component file
export * from '@testing-library/react';

// ---------------------------------------------------------------------------
// QueryClient factory — fresh instance per render prevents cache bleed
// ---------------------------------------------------------------------------

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Prevent "act(...)" warnings from background refetches
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// renderWithProviders
// ---------------------------------------------------------------------------

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL for MemoryRouter (default: '/'). */
  initialRoute?: string;
  /** Pre-built QueryClient to reuse across renders (optional). */
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends ReturnType<typeof render> {
  queryClient: QueryClient;
}

/**
 * Renders `ui` inside:
 *   MemoryRouter → QueryClientProvider → AuthProvider → CartProvider
 *
 * Returns the standard RTL result plus `queryClient` for direct cache inspection.
 *
 * @example
 * const { getByText } = renderWithProviders(<MyPage />, { initialRoute: '/orders' });
 */
export function renderWithProviders(
  ui: ReactNode,
  {
    initialRoute = '/',
    queryClient,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const client = queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialRoute]}>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <CartProvider>{children}</CartProvider>
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  return {
    queryClient: client,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
