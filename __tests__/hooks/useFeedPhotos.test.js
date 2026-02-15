/**
 * useFeedPhotos Hook Unit Tests
 *
 * Tests for the feed photo management hook including:
 * - Fetches feed photos on mount
 * - Handles enableRealtime subscription vs one-time fetch
 * - Handles hotOnly filter for high-engagement photos
 * - Returns loading/error states
 * - Handles empty feed (no friends, no photos)
 * - Cleans up subscription on unmount
 * - Pull-to-refresh functionality
 * - Optimistic photo state updates
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Import hook after mocks
import useFeedPhotos from '../../src/hooks/useFeedPhotos';

// Mock logger to prevent console output
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock feedService at module level
const mockGetFeedPhotos = jest.fn();
const mockSubscribeFeedPhotos = jest.fn();

jest.mock('../../src/services/firebase/feedService', () => ({
  getFeedPhotos: (...args) => mockGetFeedPhotos(...args),
  subscribeFeedPhotos: (...args) => mockSubscribeFeedPhotos(...args),
}));

// Mock friendshipService at module level
const mockGetFriendUserIds = jest.fn();

jest.mock('../../src/services/firebase/friendshipService', () => ({
  getFriendUserIds: (...args) => mockGetFriendUserIds(...args),
}));

// Mock AuthContext
const mockUser = { uid: 'test-user-123' };
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Test data
const mockPhotos = [
  {
    id: 'photo-1',
    userId: 'friend-1',
    imageURL: 'https://storage.example.com/photo-1.jpg',
    reactionCount: 5,
    capturedAt: { seconds: Date.now() / 1000 },
    user: { uid: 'friend-1', username: 'alice' },
  },
  {
    id: 'photo-2',
    userId: 'friend-2',
    imageURL: 'https://storage.example.com/photo-2.jpg',
    reactionCount: 1,
    capturedAt: { seconds: (Date.now() - 60000) / 1000 },
    user: { uid: 'friend-2', username: 'bob' },
  },
  {
    id: 'photo-3',
    userId: 'friend-1',
    imageURL: 'https://storage.example.com/photo-3.jpg',
    reactionCount: 10,
    capturedAt: { seconds: (Date.now() - 120000) / 1000 },
    user: { uid: 'friend-1', username: 'alice' },
  },
];

const mockFriendIds = ['friend-1', 'friend-2', 'friend-3'];

describe('useFeedPhotos', () => {
  let mockUnsubscribe;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();

    // Default successful responses
    mockGetFriendUserIds.mockResolvedValue({
      success: true,
      friendUserIds: mockFriendIds,
    });

    mockGetFeedPhotos.mockResolvedValue({
      success: true,
      photos: mockPhotos,
      lastDoc: 'mock-last-doc',
      hasMore: true,
    });

    // Default: subscribeFeedPhotos returns unsubscribe function
    mockSubscribeFeedPhotos.mockReturnValue(mockUnsubscribe);
  });

  // =========================================================================
  // Fetches feed photos on mount
  // =========================================================================

  test('fetches feed photos on mount and returns photos array', async () => {
    const { result } = await renderHook(() => useFeedPhotos(false, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetFriendUserIds).toHaveBeenCalledWith('test-user-123');
    expect(mockGetFeedPhotos).toHaveBeenCalled();
    // Photos are curated (top 5 per friend) so check it returned photos
    expect(result.current.photos.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  test('returns loading state correctly', async () => {
    let resolveFeedPhotos;
    mockGetFeedPhotos.mockReturnValue(
      new Promise(resolve => {
        resolveFeedPhotos = resolve;
      })
    );

    const { result } = await renderHook(() => useFeedPhotos(false, false));

    // Loading should be true while fetching
    // Note: initial loading state is true
    expect(result.current.loading).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolveFeedPhotos({
        success: true,
        photos: mockPhotos,
        lastDoc: 'mock-last-doc',
        hasMore: true,
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  // =========================================================================
  // Error state
  // =========================================================================

  test('returns error state when feed fetch fails', async () => {
    mockGetFeedPhotos.mockResolvedValue({
      success: false,
      error: 'Network error',
      photos: [],
    });

    const { result } = await renderHook(() => useFeedPhotos(false, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  // =========================================================================
  // Empty feed
  // =========================================================================

  test('handles empty feed when no friends', async () => {
    mockGetFriendUserIds.mockResolvedValue({
      success: true,
      friendUserIds: [],
    });

    mockGetFeedPhotos.mockResolvedValue({
      success: true,
      photos: [],
      lastDoc: null,
      hasMore: false,
    });

    const { result } = await renderHook(() => useFeedPhotos(false, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
  });

  test('handles empty feed when no photos from friends', async () => {
    mockGetFeedPhotos.mockResolvedValue({
      success: true,
      photos: [],
      lastDoc: null,
      hasMore: false,
    });

    const { result } = await renderHook(() => useFeedPhotos(false, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  // =========================================================================
  // enableRealtime subscription
  // =========================================================================

  test('sets up real-time subscription when enableRealtime is true', async () => {
    const { result } = await renderHook(() => useFeedPhotos(true, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // subscribeFeedPhotos should be called for real-time mode
    expect(mockSubscribeFeedPhotos).toHaveBeenCalledWith(
      expect.any(Function), // callback
      20, // limitCount
      expect.any(Array), // friendUserIds
      'test-user-123' // currentUserId
    );
  });

  test('does not set up subscription when enableRealtime is false', async () => {
    const { result } = await renderHook(() => useFeedPhotos(false, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // subscribeFeedPhotos should NOT be called
    expect(mockSubscribeFeedPhotos).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Cleans up subscription on unmount
  // =========================================================================

  test('cleans up subscription on unmount when realtime enabled', async () => {
    const { result, unmount } = await renderHook(() => useFeedPhotos(true, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  // =========================================================================
  // hotOnly filter
  // =========================================================================

  test('filters photos by hotOnly when enabled', async () => {
    // Provide photos with varying reaction counts
    const photosWithReactions = [
      {
        id: 'photo-hot',
        userId: 'friend-1',
        imageURL: 'https://storage.example.com/hot.jpg',
        reactionCount: 5, // Above MIN_REACTIONS_FOR_HOT (2)
        capturedAt: { seconds: Date.now() / 1000 },
        user: { uid: 'friend-1', username: 'alice' },
      },
      {
        id: 'photo-cold',
        userId: 'friend-2',
        imageURL: 'https://storage.example.com/cold.jpg',
        reactionCount: 0, // Below MIN_REACTIONS_FOR_HOT
        capturedAt: { seconds: Date.now() / 1000 },
        user: { uid: 'friend-2', username: 'bob' },
      },
      {
        id: 'photo-warm',
        userId: 'friend-3',
        imageURL: 'https://storage.example.com/warm.jpg',
        reactionCount: 2, // At MIN_REACTIONS_FOR_HOT threshold
        capturedAt: { seconds: Date.now() / 1000 },
        user: { uid: 'friend-3', username: 'charlie' },
      },
    ];

    mockGetFeedPhotos.mockResolvedValue({
      success: true,
      photos: photosWithReactions,
      lastDoc: null,
      hasMore: false,
    });

    const { result } = await renderHook(() => useFeedPhotos(false, true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Only photos with reactionCount >= 2 should remain
    expect(result.current.photos.length).toBe(2);
    const photoIds = result.current.photos.map(p => p.id);
    expect(photoIds).toContain('photo-hot');
    expect(photoIds).toContain('photo-warm');
    expect(photoIds).not.toContain('photo-cold');
  });

  // =========================================================================
  // updatePhotoInState
  // =========================================================================

  test('updatePhotoInState updates a single photo optimistically', async () => {
    const { result } = await renderHook(() => useFeedPhotos(false, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const originalPhotos = result.current.photos;
    expect(originalPhotos.length).toBeGreaterThan(0);

    const photoToUpdate = originalPhotos[0];
    const updatedPhoto = { ...photoToUpdate, reactionCount: 99 };

    await act(async () => {
      result.current.updatePhotoInState(photoToUpdate.id, updatedPhoto);
    });

    const updatedInState = result.current.photos.find(p => p.id === photoToUpdate.id);
    expect(updatedInState.reactionCount).toBe(99);
  });

  // =========================================================================
  // refreshFeed
  // =========================================================================

  test('refreshFeed re-fetches friendships and photos', async () => {
    const { result } = await renderHook(() => useFeedPhotos(false, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear call counts from initial load
    mockGetFriendUserIds.mockClear();
    mockGetFeedPhotos.mockClear();

    mockGetFriendUserIds.mockResolvedValue({
      success: true,
      friendUserIds: mockFriendIds,
    });

    mockGetFeedPhotos.mockResolvedValue({
      success: true,
      photos: mockPhotos,
      lastDoc: 'new-last-doc',
      hasMore: false,
    });

    await act(async () => {
      await result.current.refreshFeed();
    });

    // Should have fetched friendships and photos again
    expect(mockGetFriendUserIds).toHaveBeenCalled();
    expect(mockGetFeedPhotos).toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });
});
