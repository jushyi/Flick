/**
 * useComments Hook Unit Tests
 *
 * Tests for the comment state management hook including:
 * - Real-time subscription to comments on mount
 * - Returns comments array from subscription
 * - addComment calls commentService.addComment with correct params
 * - deleteComment calls commentService.deleteComment
 * - toggleLike calls commentService.toggleCommentLike
 * - Unsubscribes on unmount
 * - Handles empty photoId (no subscription)
 * - Reply state management
 * - canDeleteComment and isOwnerComment utilities
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Import hook after mocks
import useComments from '../../src/hooks/useComments';

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

// Mock commentService at module level
const mockSubscribeToComments = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockToggleCommentLike = jest.fn();
const mockGetUserLikesForComments = jest.fn();
const mockGenerateCommentId = jest.fn();

jest.mock('../../src/services/firebase/commentService', () => ({
  subscribeToComments: (...args) => mockSubscribeToComments(...args),
  addComment: (...args) => mockAddComment(...args),
  deleteComment: (...args) => mockDeleteComment(...args),
  toggleCommentLike: (...args) => mockToggleCommentLike(...args),
  getUserLikesForComments: (...args) => mockGetUserLikesForComments(...args),
  generateCommentId: (...args) => mockGenerateCommentId(...args),
}));

// Test data
const mockComments = [
  {
    id: 'comment-1',
    photoId: 'photo-123',
    userId: 'user-a',
    text: 'Great photo!',
    parentId: null,
    likeCount: 2,
    createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
    user: { uid: 'user-a', username: 'alice', displayName: 'Alice' },
  },
  {
    id: 'comment-2',
    photoId: 'photo-123',
    userId: 'user-b',
    text: 'Love it!',
    parentId: null,
    likeCount: 0,
    createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
    user: { uid: 'user-b', username: 'bob', displayName: 'Bob' },
  },
];

describe('useComments', () => {
  let mockUnsubscribe;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUnsubscribe = jest.fn();
    mockGetUserLikesForComments.mockResolvedValue({});
    mockGenerateCommentId.mockReturnValue('generated-comment-id');

    // Default: subscribeToComments immediately calls callback with test data
    mockSubscribeToComments.mockImplementation((photoId, callback) => {
      // Call callback asynchronously to simulate real behavior
      Promise.resolve().then(() => {
        callback({ success: true, comments: mockComments });
      });
      return mockUnsubscribe;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // Subscription on mount
  // =========================================================================

  test('subscribes to comments on mount via subscribeToComments', async () => {
    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSubscribeToComments).toHaveBeenCalledWith('photo-123', expect.any(Function));
  });

  // =========================================================================
  // Returns comments from subscription
  // =========================================================================

  test('returns comments array from subscription', async () => {
    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(2);
    });

    expect(result.current.comments[0].text).toBe('Great photo!');
    expect(result.current.comments[1].text).toBe('Love it!');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // =========================================================================
  // addComment
  // =========================================================================

  test('addComment calls commentService.addComment with correct params', async () => {
    mockAddComment.mockResolvedValue({
      success: true,
      commentId: 'generated-comment-id',
    });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let addResult;
    await act(async () => {
      addResult = await result.current.addComment('Nice photo!');
    });

    expect(mockAddComment).toHaveBeenCalledWith(
      'photo-123', // photoId
      'current-user', // userId
      'Nice photo!', // text
      null, // mediaUrl
      null, // mediaType
      null, // parentId (no reply)
      null, // mentionedCommentId
      'generated-comment-id' // pre-generated ID
    );
    expect(addResult.success).toBe(true);
  });

  test('addComment with media passes mediaUrl and mediaType', async () => {
    mockAddComment.mockResolvedValue({
      success: true,
      commentId: 'generated-comment-id',
    });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addComment('Check this', 'https://gif.com/test.gif', 'gif');
    });

    expect(mockAddComment).toHaveBeenCalledWith(
      'photo-123',
      'current-user',
      'Check this',
      'https://gif.com/test.gif',
      'gif',
      null,
      null,
      'generated-comment-id'
    );
  });

  test('addComment returns error when missing required fields', async () => {
    const { result } = await renderHook(() => useComments(null, 'current-user', 'owner-user'));

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let addResult;
    await act(async () => {
      addResult = await result.current.addComment('Test');
    });

    expect(addResult.success).toBe(false);
    expect(addResult.error).toBe('Missing required fields');
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  // =========================================================================
  // deleteComment
  // =========================================================================

  test('deleteComment calls commentService.deleteComment', async () => {
    mockDeleteComment.mockResolvedValue({ success: true });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(2);
    });

    let deleteResult;
    await act(async () => {
      deleteResult = await result.current.deleteComment('comment-1');
    });

    expect(mockDeleteComment).toHaveBeenCalledWith('photo-123', 'comment-1', 'current-user');
    expect(deleteResult.success).toBe(true);
  });

  test('deleteComment reverts on failure', async () => {
    mockDeleteComment.mockResolvedValue({
      success: false,
      error: 'Unauthorized',
    });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteComment('comment-1');
    });

    // Comments should be reverted after failed delete
    await waitFor(() => {
      expect(result.current.comments).toHaveLength(2);
    });
  });

  // =========================================================================
  // toggleLike
  // =========================================================================

  test('toggleLike calls commentService.toggleCommentLike', async () => {
    mockToggleCommentLike.mockResolvedValue({ success: true, liked: true });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let likeResult;
    await act(async () => {
      likeResult = await result.current.toggleLike('comment-1');
    });

    expect(mockToggleCommentLike).toHaveBeenCalledWith('photo-123', 'comment-1', 'current-user');
    expect(likeResult.success).toBe(true);
  });

  test('toggleLike performs optimistic update', async () => {
    mockToggleCommentLike.mockResolvedValue({ success: true, liked: true });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Initially not liked
    expect(result.current.isLikedByUser('comment-1')).toBe(false);

    await act(async () => {
      await result.current.toggleLike('comment-1');
    });

    // Should be optimistically liked
    expect(result.current.isLikedByUser('comment-1')).toBe(true);
  });

  test('toggleLike reverts on failure', async () => {
    mockToggleCommentLike.mockResolvedValue({
      success: false,
      error: 'Server error',
    });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleLike('comment-1');
    });

    // Should revert to not liked
    expect(result.current.isLikedByUser('comment-1')).toBe(false);
  });

  // =========================================================================
  // Unsubscribes on unmount
  // =========================================================================

  test('unsubscribes on unmount', async () => {
    const { unmount } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(mockSubscribeToComments).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  // =========================================================================
  // Handles empty photoId
  // =========================================================================

  test('handles empty photoId - no subscription', async () => {
    const { result } = await renderHook(() => useComments(null, 'current-user', 'owner-user'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSubscribeToComments).not.toHaveBeenCalled();
    expect(result.current.comments).toEqual([]);
  });

  test('handles undefined photoId - no subscription', async () => {
    const { result } = await renderHook(() => useComments(undefined, 'current-user', 'owner-user'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSubscribeToComments).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Subscription error handling
  // =========================================================================

  test('handles subscription error', async () => {
    mockSubscribeToComments.mockImplementation((photoId, callback) => {
      Promise.resolve().then(() => {
        callback({ success: false, error: 'Firestore error' });
      });
      return mockUnsubscribe;
    });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Firestore error');
    expect(result.current.comments).toEqual([]);
  });

  // =========================================================================
  // Reply state management
  // =========================================================================

  test('setReplyingTo and cancelReply manage reply state', async () => {
    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Initially no reply target
    expect(result.current.replyingTo).toBeNull();

    // Set reply target
    const replyTarget = {
      id: 'comment-1',
      user: { username: 'alice', displayName: 'Alice' },
    };
    await act(async () => {
      result.current.setReplyingTo(replyTarget);
    });

    expect(result.current.replyingTo).toEqual(replyTarget);
    expect(result.current.initialMention).toBe('alice');

    // Cancel reply
    await act(async () => {
      result.current.cancelReply();
    });

    expect(result.current.replyingTo).toBeNull();
    expect(result.current.initialMention).toBeNull();
  });

  // =========================================================================
  // canDeleteComment utility
  // =========================================================================

  test('canDeleteComment returns true for comment author', async () => {
    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const comment = { userId: 'current-user', text: 'My comment' };
    expect(result.current.canDeleteComment(comment)).toBe(true);
  });

  test('canDeleteComment returns true for photo owner', async () => {
    const { result } = await renderHook(() => useComments('photo-123', 'owner-user', 'owner-user'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const comment = { userId: 'other-user', text: 'Someone else comment' };
    expect(result.current.canDeleteComment(comment)).toBe(true);
  });

  test('canDeleteComment returns false for non-author non-owner', async () => {
    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const comment = { userId: 'other-user', text: 'Someone comment' };
    expect(result.current.canDeleteComment(comment)).toBe(false);
  });

  // =========================================================================
  // isOwnerComment utility
  // =========================================================================

  test('isOwnerComment returns true for photo owner comments', async () => {
    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const comment = { userId: 'owner-user', text: 'Owner comment' };
    expect(result.current.isOwnerComment(comment)).toBe(true);
  });

  test('isOwnerComment returns false for non-owner comments', async () => {
    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const comment = { userId: 'other-user', text: 'Other comment' };
    expect(result.current.isOwnerComment(comment)).toBe(false);
  });

  // =========================================================================
  // threadedComments
  // =========================================================================

  test('threadedComments organizes replies under parents', async () => {
    const commentsWithReplies = [
      {
        id: 'comment-1',
        userId: 'user-a',
        text: 'Parent',
        parentId: null,
        likeCount: 0,
        createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
        user: { uid: 'user-a', username: 'alice' },
      },
      {
        id: 'comment-2',
        userId: 'user-b',
        text: 'Reply',
        parentId: 'comment-1',
        likeCount: 0,
        createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
        user: { uid: 'user-b', username: 'bob' },
      },
    ];

    mockSubscribeToComments.mockImplementation((photoId, callback) => {
      Promise.resolve().then(() => {
        callback({ success: true, comments: commentsWithReplies });
      });
      return mockUnsubscribe;
    });

    const { result } = await renderHook(() =>
      useComments('photo-123', 'current-user', 'owner-user')
    );

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(2);
    });

    const threaded = result.current.threadedComments;
    expect(threaded).toHaveLength(1); // Only 1 top-level
    expect(threaded[0].id).toBe('comment-1');
    expect(threaded[0].replies).toHaveLength(1);
    expect(threaded[0].replies[0].id).toBe('comment-2');
  });
});
