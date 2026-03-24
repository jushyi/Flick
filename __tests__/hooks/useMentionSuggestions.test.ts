/**
 * useMentionSuggestions Hook Tests
 *
 * Tests PowerSync local query for friend IDs and TanStack cache lookup.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock PowerSync
const mockGetAll = jest.fn();
jest.mock('@/lib/powersync/database', () => ({
  powerSyncDb: {
    getAll: (...args: any[]) => mockGetAll(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/queryKeys', () => ({
  __esModule: true,
  queryKeys: {
    profile: {
      all: ['profile'],
      detail: (userId: string) => ['profile', userId],
    },
  },
}));

const { useMentionSuggestions } = require('../../src/hooks/useMentionSuggestions.ts');

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe('useMentionSuggestions', () => {
  let testClient: QueryClient;

  function createWrapper() {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: testClient }, children);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    testClient = createTestQueryClient();
  });

  it('queries PowerSync with correct SQL for accepted friendships', async () => {
    mockGetAll.mockResolvedValue([]);

    renderHook(() => useMentionSuggestions('user-1', ''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.stringContaining('SELECT user1_id, user2_id FROM friendships'),
        expect.arrayContaining(['user-1', 'user-1'])
      );
    });
  });

  it('returns matching friends when searchText matches username', async () => {
    mockGetAll.mockResolvedValue([
      { user1_id: 'user-1', user2_id: 'friend-1' },
      { user1_id: 'friend-2', user2_id: 'user-1' },
    ]);

    // Pre-populate TanStack cache with profile data
    testClient.setQueryData(['profile', 'friend-1'], {
      id: 'friend-1',
      username: 'alice',
      display_name: 'Alice Smith',
      profile_photo_path: '/alice.webp',
    });
    testClient.setQueryData(['profile', 'friend-2'], {
      id: 'friend-2',
      username: 'bob',
      display_name: 'Bob Jones',
      profile_photo_path: null,
    });

    const { result } = renderHook(() => useMentionSuggestions('user-1', 'ali'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.length).toBe(1);
    });

    expect(result.current[0]).toMatchObject({
      id: 'friend-1',
      username: 'alice',
      displayName: 'Alice Smith',
    });
  });

  it('returns empty array when no matches', async () => {
    mockGetAll.mockResolvedValue([
      { user1_id: 'user-1', user2_id: 'friend-1' },
    ]);

    testClient.setQueryData(['profile', 'friend-1'], {
      id: 'friend-1',
      username: 'alice',
      display_name: 'Alice Smith',
      profile_photo_path: null,
    });

    const { result } = renderHook(() => useMentionSuggestions('user-1', 'zzz'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled();
    });

    expect(result.current).toEqual([]);
  });

  it('looks up profiles from TanStack cache', async () => {
    mockGetAll.mockResolvedValue([
      { user1_id: 'user-1', user2_id: 'friend-1' },
    ]);

    // Profile exists in cache
    testClient.setQueryData(['profile', 'friend-1'], {
      id: 'friend-1',
      username: 'cached_user',
      display_name: 'Cached User',
      profile_photo_path: '/cached.webp',
    });

    const { result } = renderHook(() => useMentionSuggestions('user-1', ''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.length).toBe(1);
    });

    expect(result.current[0]).toMatchObject({
      id: 'friend-1',
      username: 'cached_user',
      displayName: 'Cached User',
      profilePhotoPath: '/cached.webp',
    });
  });
});
