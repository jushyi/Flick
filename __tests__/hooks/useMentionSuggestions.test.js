/**
 * useMentionSuggestions Hook Unit Tests
 *
 * Tests for the @-mention autocomplete hook including:
 * - Loading mutual friends on mount via mentionService
 * - Empty result handling
 * - Loading state transitions
 * - Error handling from service
 * - Null/undefined parameter guard
 * - Text change filtering
 * - Suggestion selection and text replacement
 * - Dismiss suggestions
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Import hook after mocks
import useMentionSuggestions from '../../src/hooks/useMentionSuggestions';

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

// Mock mentionService at module level
const mockGetMutualFriendsForTagging = jest.fn();
jest.mock('../../src/services/firebase/mentionService', () => ({
  getMutualFriendsForTagging: (...args) => mockGetMutualFriendsForTagging(...args),
}));

// Test data
const mockFriends = [
  {
    userId: 'friend-1',
    username: 'alice',
    displayName: 'Alice Smith',
    profilePhotoURL: 'https://example.com/alice.jpg',
  },
  {
    userId: 'friend-2',
    username: 'bob',
    displayName: 'Bob Jones',
    profilePhotoURL: 'https://example.com/bob.jpg',
  },
  {
    userId: 'friend-3',
    username: 'charlie',
    displayName: 'Charlie Brown',
    profilePhotoURL: 'https://example.com/charlie.jpg',
  },
];

describe('useMentionSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Loading mutual friends on mount
  // =========================================================================

  test('loads mutual friends on mount and returns suggestions array', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: true,
      data: mockFriends,
    });

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetMutualFriendsForTagging).toHaveBeenCalledWith('owner-123');
    expect(result.current.allMutualFriends).toHaveLength(3);
    expect(result.current.allMutualFriends).toEqual(mockFriends);
  });

  // =========================================================================
  // Empty result handling
  // =========================================================================

  test('returns empty array when no mutual friends', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: true,
      data: [],
    });

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.allMutualFriends).toEqual([]);
    expect(result.current.filteredSuggestions).toEqual([]);
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  test('handles loading state correctly (loading starts false, becomes true during fetch, then false)', async () => {
    let resolvePromise;
    mockGetMutualFriendsForTagging.mockReturnValue(
      new Promise(resolve => {
        resolvePromise = resolve;
      })
    );

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    // Loading should be true while fetching
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Resolve the promise
    await act(async () => {
      resolvePromise({ success: true, data: mockFriends });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.allMutualFriends).toHaveLength(3);
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  test('handles error from service gracefully', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should still have empty friends array (no crash)
    expect(result.current.allMutualFriends).toEqual([]);
    expect(result.current.filteredSuggestions).toEqual([]);
  });

  // =========================================================================
  // Null/undefined parameter guard
  // =========================================================================

  test('does not fetch if photoOwnerId is null', async () => {
    const { result } = await renderHook(() => useMentionSuggestions(null, 'current-456'));

    // Should not call the service
    expect(mockGetMutualFriendsForTagging).not.toHaveBeenCalled();
    expect(result.current.allMutualFriends).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  test('does not fetch if photoOwnerId is undefined', async () => {
    const { result } = await renderHook(() => useMentionSuggestions(undefined, 'current-456'));

    expect(mockGetMutualFriendsForTagging).not.toHaveBeenCalled();
    expect(result.current.allMutualFriends).toEqual([]);
  });

  test('does not fetch if currentUserId is null', async () => {
    const { result } = await renderHook(() => useMentionSuggestions('owner-123', null));

    expect(mockGetMutualFriendsForTagging).not.toHaveBeenCalled();
    expect(result.current.allMutualFriends).toEqual([]);
  });

  // =========================================================================
  // Text change filtering
  // =========================================================================

  test('filters suggestions when handleTextChange detects @ trigger', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: true,
      data: mockFriends,
    });

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate typing "@al" at position 3
    await act(async () => {
      result.current.handleTextChange('@al', 3);
    });

    expect(result.current.showSuggestions).toBe(true);
    expect(result.current.filteredSuggestions).toHaveLength(1);
    expect(result.current.filteredSuggestions[0].username).toBe('alice');
    expect(result.current.queryText).toBe('al');
  });

  test('shows all suggestions when @ is typed with no query', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: true,
      data: mockFriends,
    });

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate typing just "@" at position 1
    await act(async () => {
      result.current.handleTextChange('@', 1);
    });

    expect(result.current.showSuggestions).toBe(true);
    // All friends should match empty query (all start with "")
    expect(result.current.filteredSuggestions).toHaveLength(3);
  });

  test('hides suggestions when text has no active @ mention', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: true,
      data: mockFriends,
    });

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // First show suggestions
    await act(async () => {
      result.current.handleTextChange('@al', 3);
    });
    expect(result.current.showSuggestions).toBe(true);

    // Now type regular text without @
    await act(async () => {
      result.current.handleTextChange('hello', 5);
    });
    expect(result.current.showSuggestions).toBe(false);
    expect(result.current.filteredSuggestions).toEqual([]);
  });

  // =========================================================================
  // Suggestion selection
  // =========================================================================

  test('selectSuggestion replaces @query with @username and adds space', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: true,
      data: mockFriends,
    });

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate typing "@al"
    await act(async () => {
      result.current.handleTextChange('@al', 3);
    });

    // Select alice
    let selectionResult;
    await act(async () => {
      selectionResult = result.current.selectSuggestion(
        mockFriends[0], // alice
        '@al',
        3
      );
    });

    expect(selectionResult.newText).toBe('@alice ');
    expect(selectionResult.newCursorPosition).toBe(7); // "@alice " is 7 chars
    expect(result.current.showSuggestions).toBe(false);
  });

  // =========================================================================
  // Dismiss suggestions
  // =========================================================================

  test('dismissSuggestions clears all suggestion state', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: true,
      data: mockFriends,
    });

    const { result } = await renderHook(() => useMentionSuggestions('owner-123', 'current-456'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Show suggestions first
    await act(async () => {
      result.current.handleTextChange('@bo', 3);
    });
    expect(result.current.showSuggestions).toBe(true);

    // Dismiss
    await act(async () => {
      result.current.dismissSuggestions();
    });

    expect(result.current.showSuggestions).toBe(false);
    expect(result.current.filteredSuggestions).toEqual([]);
    expect(result.current.queryText).toBe('');
  });

  // =========================================================================
  // Caching by photoOwnerId
  // =========================================================================

  test('does not refetch if photoOwnerId has not changed', async () => {
    mockGetMutualFriendsForTagging.mockResolvedValue({
      success: true,
      data: mockFriends,
    });

    const { result, rerender } = await renderHook(
      ({ ownerId, userId }) => useMentionSuggestions(ownerId, userId),
      { initialProps: { ownerId: 'owner-123', userId: 'current-456' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetMutualFriendsForTagging).toHaveBeenCalledTimes(1);

    // Re-render with same ownerId
    await rerender({ ownerId: 'owner-123', userId: 'current-456' });

    // Should not have fetched again (cached by loadedForOwnerRef)
    expect(mockGetMutualFriendsForTagging).toHaveBeenCalledTimes(1);
  });
});
