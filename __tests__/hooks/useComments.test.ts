/**
 * useComments Hook Tests (Supabase version)
 *
 * Tests TanStack Query integration and Supabase Realtime subscription.
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock supabase before importing hook
const mockChannelOn = jest.fn().mockReturnThis();
const mockChannelSubscribe = jest.fn().mockReturnThis();
const mockChannel = {
  on: mockChannelOn,
  subscribe: mockChannelSubscribe,
};

const mockRemoveChannel = jest.fn();
const mockSupabaseChannel = jest.fn(() => mockChannel);

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  supabase: {
    from: jest.fn(),
    channel: mockSupabaseChannel,
    removeChannel: mockRemoveChannel,
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

const mockGetComments = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockLikeComment = jest.fn();
const mockUnlikeComment = jest.fn();

jest.mock('@/services/supabase/commentService', () => ({
  __esModule: true,
  getComments: (...args: any[]) => mockGetComments(...args),
  addComment: (...args: any[]) => mockAddComment(...args),
  deleteComment: (...args: any[]) => mockDeleteComment(...args),
  likeComment: (...args: any[]) => mockLikeComment(...args),
  unlikeComment: (...args: any[]) => mockUnlikeComment(...args),
  getCommentLikes: jest.fn(),
}));

jest.mock('@/lib/queryKeys', () => ({
  __esModule: true,
  queryKeys: {
    comments: {
      all: ['comments'],
      list: (photoId: string) => ['comments', 'list', photoId],
      likes: (photoId: string) => ['comments', 'likes', photoId],
    },
  },
}));

// Import the .ts hook explicitly
const { useComments, useAddComment, useDeleteComment } = require('../../src/hooks/useComments.ts');

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function createWrapper(client?: QueryClient) {
  const testClient = client || createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: testClient }, children);
}

describe('useComments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetComments.mockResolvedValue([]);
    // Re-configure channel mock after clearAllMocks
    mockChannelOn.mockReturnThis();
    mockChannelSubscribe.mockReturnThis();
    mockSupabaseChannel.mockReturnValue(mockChannel);
  });

  it('creates Realtime channel subscription with correct filter', async () => {
    const { result } = renderHook(() => useComments('photo-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSupabaseChannel).toHaveBeenCalledWith('comments:photo-123');
    expect(mockChannelOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: 'photo_id=eq.photo-123',
      }),
      expect.any(Function)
    );
    expect(mockChannelSubscribe).toHaveBeenCalled();
  });

  it('cleans up channel on unmount', async () => {
    const { result, unmount } = renderHook(() => useComments('photo-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      unmount();
    });

    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it('fetches comments via commentService.getComments', async () => {
    const mockComments = [
      { id: 'c1', photoId: 'photo-123', userId: 'u1', text: 'Hello' },
    ];
    mockGetComments.mockResolvedValue(mockComments);

    const { result } = renderHook(() => useComments('photo-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetComments).toHaveBeenCalledWith('photo-123');
    expect(result.current.data).toEqual(mockComments);
  });
});

describe('useAddComment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates comments list on success', async () => {
    const mockComment = { id: 'new-c', photoId: 'photo-1', text: 'Test' };
    mockAddComment.mockResolvedValue(mockComment);

    const testClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(testClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddComment(), {
      wrapper: createWrapper(testClient),
    });

    await act(async () => {
      result.current.mutate({
        photoId: 'photo-1',
        userId: 'user-1',
        text: 'Test comment',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAddComment).toHaveBeenCalledWith({
      photoId: 'photo-1',
      userId: 'user-1',
      text: 'Test comment',
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['comments', 'list', 'photo-1'],
      })
    );
  });
});
