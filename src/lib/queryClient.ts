import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 3, // 3 retries with exponential backoff (1s, 2s, 4s)
      refetchOnWindowFocus: true, // Refetch on app foreground
      refetchOnReconnect: true, // Refetch when network reconnects
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'FLICK_QUERY_CACHE',
  throttleTime: 1000, // Write at most once per second
});

export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: 24 * 60 * 60 * 1000, // 24-hour cache expiry
  dehydrateOptions: {
    shouldDehydrateQuery: (query: {
      queryKey: unknown[];
      state: { status: string };
      meta?: Record<string, unknown>;
    }) => {
      return query.state.status === 'success' && query.meta?.persist === true;
    },
  },
};
