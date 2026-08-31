/**
 * App-wide data providers.
 *
 * Query defaults are tuned for Pakistani network conditions (docs/04 §6): venue data is
 * cached aggressively so a list survives a dead zone, and reads retry a few times with
 * backoff. Writes do NOT retry automatically — a booking retry has to reuse the same
 * intent id to stay safe, which is the caller's decision, not the query client's.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { ApiError, type MaidanApi } from './api';
import { createHttpApi } from './http-api';
import { createMockApi } from './mock-api';

/**
 * Which implementation the app talks to.
 *
 * Set `EXPO_PUBLIC_API_URL` and the app uses the real backend; leave it unset and it uses
 * the in-memory mock. Both satisfy `MaidanApi`, so no screen knows the difference — which
 * is what makes the mock worth keeping once the server exists: it runs the whole app with
 * no network, no database and no setup.
 *
 * On a device, `localhost` is the phone, not your Mac — use the LAN address Expo prints.
 */
export function resolveApi(): MaidanApi {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (baseUrl) {
    return createHttpApi({
      baseUrl: baseUrl.replace(/\/$/, ''),
      userId: process.env.EXPO_PUBLIC_API_USER ?? 'player-self',
    });
  }
  return createMockApi({ seedBookings: true });
}

const ApiContext = createContext<MaidanApi | null>(null);

export function useApi(): MaidanApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <DataProvider>');
  return api;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: (failureCount, error) => {
          // Nothing is gained by retrying a 404 or a taken slot.
          if (error instanceof ApiError && error.code !== 'network') return false;
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function DataProvider({
  children,
  api,
  queryClient,
}: {
  children: ReactNode;
  /** Injected in tests and swapped for the HTTP client in production. */
  api?: MaidanApi;
  queryClient?: QueryClient;
}) {
  const resolvedApi = useMemo(() => api ?? resolveApi(), [api]);
  const client = useMemo(() => queryClient ?? createQueryClient(), [queryClient]);

  return (
    <QueryClientProvider client={client}>
      <ApiContext.Provider value={resolvedApi}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );
}
