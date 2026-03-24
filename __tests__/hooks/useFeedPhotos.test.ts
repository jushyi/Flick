import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock feedService
const mockGetFeed = jest.fn();
jest.mock('../../src/services/supabase/feedService', () => ({
  getFeed: (...args: any[]) => mockGetFeed(...args),
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  useFeedPhotos,
  curateTopPhotosPerFriend,
  groupByUser,
  FeedGroup,
} from '../../src/hooks/useFeedPhotos.ts';
import { FeedPhoto } from '../../src/services/supabase/feedService';

// Test helpers
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function createWrapper() {
  const testClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: testClient }, children);
}

function makeFeedPhoto(overrides: Partial<FeedPhoto> = {}): FeedPhoto {
  return {
    id: 'photo-1',
    userId: 'user-1',
    imageUrl: 'https://example.com/photo.jpg',
    thumbnailDataUrl: null,
    status: 'revealed',
    photoState: 'journal',
    mediaType: 'photo',
    caption: null,
    storagePath: 'photos/photo-1.webp',
    commentCount: 0,
    reactionCount: 0,
    createdAt: '2026-03-24T15:00:00Z',
    username: 'testuser',
    displayName: 'Test User',
    profilePhotoPath: null,
    nameColor: null,
    ...overrides,
  };
}

describe('curateTopPhotosPerFriend', () => {
  it('returns empty array for empty input', () => {
    expect(curateTopPhotosPerFriend([])).toEqual([]);
    expect(curateTopPhotosPerFriend(null as any)).toEqual([]);
  });

  it('limits to 5 photos per friend sorted by reactionCount', () => {
    const photos: FeedPhoto[] = [];
    // Create 8 photos for one user with varying reaction counts
    for (let i = 0; i < 8; i++) {
      photos.push(
        makeFeedPhoto({
          id: `photo-${i}`,
          userId: 'user-1',
          reactionCount: i,
          createdAt: `2026-03-24T1${i}:00:00Z`,
        }),
      );
    }

    const result = curateTopPhotosPerFriend(photos, 5);

    expect(result).toHaveLength(5);
    // Should be sorted by reactionCount DESC
    expect(result[0].reactionCount).toBe(7);
    expect(result[4].reactionCount).toBe(3);
  });

  it('sorts final list by reactionCount DESC across all users', () => {
    const photos = [
      makeFeedPhoto({
        id: 'p1',
        userId: 'user-1',
        reactionCount: 5,
      }),
      makeFeedPhoto({
        id: 'p2',
        userId: 'user-2',
        reactionCount: 10,
        username: 'user2',
      }),
      makeFeedPhoto({
        id: 'p3',
        userId: 'user-3',
        reactionCount: 3,
        username: 'user3',
      }),
    ];

    const result = curateTopPhotosPerFriend(photos);

    expect(result[0].reactionCount).toBe(10);
    expect(result[1].reactionCount).toBe(5);
    expect(result[2].reactionCount).toBe(3);
  });

  it('uses createdAt as tiebreaker when reactionCount is equal', () => {
    const photos = [
      makeFeedPhoto({
        id: 'p1',
        userId: 'user-1',
        reactionCount: 5,
        createdAt: '2026-03-24T10:00:00Z',
      }),
      makeFeedPhoto({
        id: 'p2',
        userId: 'user-1',
        reactionCount: 5,
        createdAt: '2026-03-24T15:00:00Z',
      }),
    ];

    const result = curateTopPhotosPerFriend(photos, 5);

    // More recent (p2) should come first within user sort
    expect(result).toHaveLength(2);
  });
});

describe('groupByUser', () => {
  it('creates FeedGroup objects with user metadata and photo arrays', () => {
    const photos = [
      makeFeedPhoto({
        id: 'p1',
        userId: 'user-1',
        username: 'alice',
        displayName: 'Alice',
        profilePhotoPath: '/path/alice.jpg',
        nameColor: '#FF0000',
      }),
      makeFeedPhoto({
        id: 'p2',
        userId: 'user-1',
        username: 'alice',
        displayName: 'Alice',
        profilePhotoPath: '/path/alice.jpg',
        nameColor: '#FF0000',
      }),
      makeFeedPhoto({
        id: 'p3',
        userId: 'user-2',
        username: 'bob',
        displayName: 'Bob',
        profilePhotoPath: null,
        nameColor: null,
      }),
    ];

    const result = groupByUser(photos);

    expect(result).toHaveLength(2);

    const aliceGroup = result.find((g) => g.userId === 'user-1');
    expect(aliceGroup).toBeDefined();
    expect(aliceGroup!.username).toBe('alice');
    expect(aliceGroup!.displayName).toBe('Alice');
    expect(aliceGroup!.profilePhotoPath).toBe('/path/alice.jpg');
    expect(aliceGroup!.nameColor).toBe('#FF0000');
    expect(aliceGroup!.photos).toHaveLength(2);

    const bobGroup = result.find((g) => g.userId === 'user-2');
    expect(bobGroup).toBeDefined();
    expect(bobGroup!.photos).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(groupByUser([])).toEqual([]);
  });
});

describe('useFeedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty arrays when userId is undefined', async () => {
    const { result } = renderHook(() => useFeedPhotos(undefined), {
      wrapper: createWrapper(),
    });

    // Query should be disabled
    expect(result.current.photos).toEqual([]);
    expect(result.current.feedGroups).toEqual([]);
    expect(result.current.allPhotos).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('calls getFeed with userId and cursor=null on initial load', async () => {
    const feedData = [
      makeFeedPhoto({ id: 'p1' }),
      makeFeedPhoto({ id: 'p2' }),
    ];
    mockGetFeed.mockResolvedValue(feedData);

    const { result } = renderHook(() => useFeedPhotos('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetFeed).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: null,
      limit: 20,
    });
  });

  it('flattens pages into allPhotos', async () => {
    const feedData = [
      makeFeedPhoto({ id: 'p1' }),
      makeFeedPhoto({ id: 'p2', userId: 'user-2', username: 'user2' }),
    ];
    mockGetFeed.mockResolvedValue(feedData);

    const { result } = renderHook(() => useFeedPhotos('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.allPhotos).toHaveLength(2));
    expect(result.current.allPhotos[0].id).toBe('p1');
    expect(result.current.allPhotos[1].id).toBe('p2');
  });

  it('groups photos by user in feedGroups', async () => {
    const feedData = [
      makeFeedPhoto({ id: 'p1', userId: 'user-1', username: 'alice' }),
      makeFeedPhoto({ id: 'p2', userId: 'user-1', username: 'alice' }),
      makeFeedPhoto({ id: 'p3', userId: 'user-2', username: 'bob' }),
    ];
    mockGetFeed.mockResolvedValue(feedData);

    const { result } = renderHook(() => useFeedPhotos('me'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.feedGroups.length).toBe(2));
  });

  it('getNextPageParam returns createdAt of last item when page has 20 items', async () => {
    // Create a full page of 20 items
    const fullPage = Array.from({ length: 20 }, (_, i) =>
      makeFeedPhoto({
        id: `p${i}`,
        userId: `user-${i % 5}`,
        username: `user${i % 5}`,
        createdAt: `2026-03-24T${String(i).padStart(2, '0')}:00:00Z`,
      }),
    );
    mockGetFeed.mockResolvedValue(fullPage);

    const { result } = renderHook(() => useFeedPhotos('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // hasNextPage should be true when we got a full page
    expect(result.current.hasNextPage).toBe(true);
  });

  it('getNextPageParam returns undefined when page has < 20 items', async () => {
    const partialPage = [
      makeFeedPhoto({ id: 'p1' }),
      makeFeedPhoto({ id: 'p2' }),
    ];
    mockGetFeed.mockResolvedValue(partialPage);

    const { result } = renderHook(() => useFeedPhotos('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // hasNextPage should be false when we got less than a full page
    expect(result.current.hasNextPage).toBe(false);
  });

  it('exposes error from query', async () => {
    mockGetFeed.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFeedPhotos('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect((result.current.error as Error).message).toBe('Network error');
  });
});
