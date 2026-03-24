/**
 * useFriendships Hook Tests
 *
 * Tests TanStack Query hooks wrapping friendshipService for reactive UI.
 * Covers 4 query hooks and 4 mutation hooks with cache invalidation.
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// =============================================================================
// Mock setup (hoisted by Jest)
// =============================================================================

jest.mock('../../src/services/supabase/friendshipService', () => ({
  getFriends: jest.fn(),
  getPendingRequests: jest.fn(),
  getSentRequests: jest.fn(),
  getFriendshipStatus: jest.fn(),
  getFriendIds: jest.fn(),
  sendFriendRequest: jest.fn(),
  acceptFriendRequest: jest.fn(),
  declineFriendRequest: jest.fn(),
  unfriend: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import {
  useFriends,
  usePendingRequests,
  useSentRequests,
  useFriendshipStatus,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useUnfriend,
} from '../../src/hooks/useFriendships';
import * as friendshipService from '../../src/services/supabase/friendshipService';

const mockGetFriends = friendshipService.getFriends as jest.Mock;
const mockGetPendingRequests = friendshipService.getPendingRequests as jest.Mock;
const mockGetSentRequests = friendshipService.getSentRequests as jest.Mock;
const mockGetFriendshipStatus = friendshipService.getFriendshipStatus as jest.Mock;
const mockSendFriendRequest = friendshipService.sendFriendRequest as jest.Mock;
const mockAcceptFriendRequest = friendshipService.acceptFriendRequest as jest.Mock;
const mockDeclineFriendRequest = friendshipService.declineFriendRequest as jest.Mock;
const mockUnfriend = friendshipService.unfriend as jest.Mock;

// =============================================================================
// Helpers
// =============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const testClient = createTestQueryClient();
  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: testClient }, children),
    client: testClient,
  };
}

// =============================================================================
// useFriends
// =============================================================================
describe('useFriends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns friend list when userId provided', async () => {
    const friends = [
      { id: 'f-1', friendUserId: 'user-2', createdAt: '2026-01-01' },
    ];
    mockGetFriends.mockResolvedValue(friends);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFriends('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(friends);
    expect(mockGetFriends).toHaveBeenCalledWith('user-1');
  });

  it('is disabled when userId is empty string', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFriends(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// =============================================================================
// usePendingRequests
// =============================================================================
describe('usePendingRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pending requests for user', async () => {
    const pending = [
      {
        id: 'f-2',
        user1Id: 'user-1',
        user2Id: 'user-3',
        initiatedBy: 'user-3',
        createdAt: '2026-01-01',
      },
    ];
    mockGetPendingRequests.mockResolvedValue(pending);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePendingRequests('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(pending);
    expect(mockGetPendingRequests).toHaveBeenCalledWith('user-1');
  });
});

// =============================================================================
// useSentRequests
// =============================================================================
describe('useSentRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sent requests for user', async () => {
    const sent = [
      {
        id: 'f-3',
        user1Id: 'user-1',
        user2Id: 'user-4',
        initiatedBy: 'user-1',
        createdAt: '2026-01-01',
      },
    ];
    mockGetSentRequests.mockResolvedValue(sent);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSentRequests('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sent);
    expect(mockGetSentRequests).toHaveBeenCalledWith('user-1');
  });
});

// =============================================================================
// useFriendshipStatus
// =============================================================================
describe('useFriendshipStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns status string between two users', async () => {
    mockGetFriendshipStatus.mockResolvedValue('accepted');

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useFriendshipStatus('user-1', 'user-2'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('accepted');
    expect(mockGetFriendshipStatus).toHaveBeenCalledWith('user-1', 'user-2');
  });
});

// =============================================================================
// useSendFriendRequest
// =============================================================================
describe('useSendFriendRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls sendFriendRequest and invalidates cache', async () => {
    const response = {
      id: 'f-new',
      user1Id: 'user-1',
      user2Id: 'user-5',
      status: 'pending',
      initiatedBy: 'user-1',
    };
    mockSendFriendRequest.mockResolvedValue(response);

    const { wrapper, client } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSendFriendRequest(), { wrapper });

    act(() => {
      result.current.mutate({ fromUserId: 'user-1', toUserId: 'user-5' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSendFriendRequest).toHaveBeenCalledWith('user-1', 'user-5');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friendships'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friends'] });
  });
});

// =============================================================================
// useAcceptFriendRequest
// =============================================================================
describe('useAcceptFriendRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls acceptFriendRequest and invalidates cache', async () => {
    mockAcceptFriendRequest.mockResolvedValue(undefined);

    const { wrapper, client } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useAcceptFriendRequest(), { wrapper });

    act(() => {
      result.current.mutate({ friendshipId: 'f-2' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAcceptFriendRequest).toHaveBeenCalledWith('f-2');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friendships'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friends'] });
  });
});

// =============================================================================
// useDeclineFriendRequest
// =============================================================================
describe('useDeclineFriendRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls declineFriendRequest and invalidates cache', async () => {
    mockDeclineFriendRequest.mockResolvedValue(undefined);

    const { wrapper, client } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeclineFriendRequest(), { wrapper });

    act(() => {
      result.current.mutate({ friendshipId: 'f-3' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeclineFriendRequest).toHaveBeenCalledWith('f-3');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friendships'] });
  });
});

// =============================================================================
// useUnfriend
// =============================================================================
describe('useUnfriend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls unfriend and invalidates cache', async () => {
    mockUnfriend.mockResolvedValue(undefined);

    const { wrapper, client } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUnfriend(), { wrapper });

    act(() => {
      result.current.mutate({ friendshipId: 'f-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUnfriend).toHaveBeenCalledWith('f-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friendships'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friends'] });
  });
});
