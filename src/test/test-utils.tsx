import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/** Fresh client per test: no retries, no caching between tests. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function TestProviders({ children, queryClient }: ProvidersProps) {
  const client = queryClient ?? createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Renders a component wrapped in the app-level providers used in tests. */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { queryClient?: QueryClient } = {},
) {
  const { queryClient, ...rest } = options;
  const client = queryClient ?? createTestQueryClient();
  return {
    queryClient: client,
    ...render(ui, {
      wrapper: ({ children }) => (
        <TestProviders queryClient={client}>{children}</TestProviders>
      ),
      ...rest,
    }),
  };
}

export * from "@testing-library/react";
export { renderWithProviders as render };
