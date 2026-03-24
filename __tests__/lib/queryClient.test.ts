import { queryClient, asyncStoragePersister, persistOptions } from '../../src/lib/queryClient';

describe('queryClient', () => {
  it('has staleTime of 30 seconds', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
  });

  it('has gcTime of 10 minutes', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.gcTime).toBe(600_000);
  });

  it('has retry set to 3', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(3);
  });

  it('refetches on window focus', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true);
  });

  it('refetches on reconnect', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
  });
});

describe('asyncStoragePersister', () => {
  it('is defined', () => {
    expect(asyncStoragePersister).toBeDefined();
  });
});

describe('persistOptions', () => {
  it('has maxAge of 24 hours', () => {
    expect(persistOptions.maxAge).toBe(86_400_000);
  });

  it('only dehydrates queries with meta.persist=true and status success', () => {
    const { shouldDehydrateQuery } = persistOptions.dehydrateOptions;

    const persistableQuery = {
      queryKey: ['profile', '123'],
      state: { status: 'success' },
      meta: { persist: true },
    };
    expect(shouldDehydrateQuery(persistableQuery as any)).toBe(true);

    const nonPersistQuery = {
      queryKey: ['comments', 'list', '456'],
      state: { status: 'success' },
      meta: undefined,
    };
    expect(shouldDehydrateQuery(nonPersistQuery as any)).toBe(false);

    const failedQuery = {
      queryKey: ['profile', '789'],
      state: { status: 'error' },
      meta: { persist: true },
    };
    expect(shouldDehydrateQuery(failedQuery as any)).toBe(false);
  });
});
