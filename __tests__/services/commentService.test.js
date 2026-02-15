/**
 * Comment Service Unit Tests
 *
 * Tests for comment service including:
 * - Add comment (top-level, replies, reply-to-reply thread flattening)
 * - Delete comment (author, photo owner, unauthorized)
 * - Get comments with user data joining
 * - Subscribe to real-time comment updates
 * - Preview comments with owner prioritization
 * - Comment like checking, toggling, and batch lookup
 */

// Mock logger to prevent console output
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock validation utility
jest.mock('../../src/utils/validation', () => ({
  isValidUrl: jest.fn(url => url && url.startsWith('http')),
}));

// Create mock functions for Firestore at module level
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockServerTimestamp = jest.fn(() => ({ _seconds: Date.now() / 1000, _nanoseconds: 0 }));
const mockIncrement = jest.fn(n => ({ _increment: n }));

// Mock document and collection references
const mockDocRef = { id: 'mock-doc-id' };
const mockCollectionRef = {};

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((...args) => {
    // If called with only a collection ref (for auto-ID generation), return ref with id
    if (args.length === 1) {
      return { id: 'auto-generated-id' };
    }
    return mockDocRef;
  }),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  serverTimestamp: () => mockServerTimestamp(),
  increment: n => mockIncrement(n),
}));

// Import service AFTER mocks are set up
const {
  addComment,
  deleteComment,
  getComments,
  subscribeToComments,
  getPreviewComments,
  hasUserLikedComment,
  toggleCommentLike,
  getUserLikesForComments,
  generateCommentId,
} = require('../../src/services/firebase/commentService');

const { createTestUser, createTestPhoto } = require('../setup/testFactories');

describe('commentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // addComment tests
  // ===========================================================================
  describe('addComment', () => {
    it('should create a top-level comment with correct fields', async () => {
      // Photo exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestPhoto(),
      });
      mockSetDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await addComment('photo-123', 'user-456', 'Great photo!');

      expect(result.success).toBe(true);
      expect(result.commentId).toBeDefined();
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-456',
          text: 'Great photo!',
          parentId: null,
          mentionedCommentId: null,
          likeCount: 0,
          mediaUrl: null,
          mediaType: null,
        })
      );
    });

    it('should increment photo commentCount after adding comment', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestPhoto(),
      });
      mockSetDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      await addComment('photo-123', 'user-456', 'Nice!');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          commentCount: expect.anything(),
        })
      );
      expect(mockIncrement).toHaveBeenCalledWith(1);
    });

    it('should use pre-generated commentId when provided', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestPhoto(),
      });
      mockSetDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await addComment(
        'photo-123',
        'user-456',
        'Hello!',
        null,
        null,
        null,
        null,
        'pre-generated-id'
      );

      expect(result.success).toBe(true);
      expect(result.commentId).toBe('pre-generated-id');
    });

    it('should create a reply with correct parentId and mentionedCommentId', async () => {
      // Photo exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestPhoto(),
      });
      // Target comment exists (top-level, no parentId)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ parentId: null, userId: 'other-user' }),
      });
      mockSetDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await addComment(
        'photo-123',
        'user-456',
        'I agree!',
        null,
        null,
        'parent-comment-id',
        null
      );

      expect(result.success).toBe(true);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          parentId: 'parent-comment-id',
          mentionedCommentId: 'parent-comment-id',
        })
      );
    });

    it('should flatten reply-to-reply to use original thread parent', async () => {
      // Photo exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestPhoto(),
      });
      // Target comment is itself a reply (has parentId)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ parentId: 'original-parent-id', userId: 'other-user' }),
      });
      mockSetDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await addComment(
        'photo-123',
        'user-456',
        'Replying to reply',
        null,
        null,
        'reply-comment-id', // This is a reply itself
        null
      );

      expect(result.success).toBe(true);
      // Should resolve to the original thread parent
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          parentId: 'original-parent-id',
          mentionedCommentId: 'reply-comment-id',
        })
      );
    });

    it('should return error when missing photoId', async () => {
      const result = await addComment(null, 'user-456', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should return error when missing userId', async () => {
      const result = await addComment('photo-123', null, 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should return error when text and media are both empty', async () => {
      const result = await addComment('photo-123', 'user-456', '', null, null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Comment must have text or media');
    });

    it('should return error when text exceeds max length', async () => {
      const longText = 'a'.repeat(2001);

      const result = await addComment('photo-123', 'user-456', longText);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Comment text is too long');
    });

    it('should return error when photo does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await addComment('nonexistent-photo', 'user-456', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Photo not found');
    });

    it('should return error when target comment for reply does not exist', async () => {
      // Photo exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestPhoto(),
      });
      // Target comment does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await addComment(
        'photo-123',
        'user-456',
        'Reply',
        null,
        null,
        'nonexistent-comment'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target comment not found');
    });

    it('should return error for invalid media URL', async () => {
      const result = await addComment('photo-123', 'user-456', '', 'not-a-url', 'image');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid media URL');
    });

    it('should return error for invalid media type', async () => {
      const result = await addComment(
        'photo-123',
        'user-456',
        '',
        'https://example.com/image.jpg',
        'video' // not in VALID_MEDIA_TYPES
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid media type');
    });

    it('should handle Firestore write errors gracefully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestPhoto(),
      });
      mockSetDoc.mockRejectedValueOnce(new Error('Write failed'));

      const result = await addComment('photo-123', 'user-456', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Write failed');
    });

    it('should allow comment with media URL and no text', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestPhoto(),
      });
      mockSetDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await addComment(
        'photo-123',
        'user-456',
        '',
        'https://example.com/image.gif',
        'gif'
      );

      expect(result.success).toBe(true);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          text: '',
          mediaUrl: 'https://example.com/image.gif',
          mediaType: 'gif',
        })
      );
    });
  });

  // ===========================================================================
  // deleteComment tests
  // ===========================================================================
  describe('deleteComment', () => {
    it('should delete comment when requested by comment author', async () => {
      // Comment exists, authored by requesting user
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'user-456', parentId: 'some-parent' }),
      });
      // Photo exists, owned by another user
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'photo-owner' }),
      });
      mockDeleteDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await deleteComment('photo-123', 'comment-456', 'user-456');

      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should delete comment when requested by photo owner', async () => {
      // Comment exists, authored by someone else
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'comment-author', parentId: 'some-parent' }),
      });
      // Photo exists, owned by requesting user
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'photo-owner' }),
      });
      mockDeleteDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await deleteComment('photo-123', 'comment-456', 'photo-owner');

      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should delete replies when deleting a top-level comment', async () => {
      // Comment exists, top-level (no parentId)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'user-456', parentId: null }),
      });
      // Photo exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'user-456' }),
      });
      // Replies query returns 2 replies
      mockGetDocs.mockResolvedValueOnce({
        size: 2,
        docs: [{ ref: { id: 'reply-1' } }, { ref: { id: 'reply-2' } }],
      });
      mockDeleteDoc.mockResolvedValue();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await deleteComment('photo-123', 'comment-456', 'user-456');

      expect(result.success).toBe(true);
      // 2 replies + 1 parent = 3 deletes
      expect(mockDeleteDoc).toHaveBeenCalledTimes(3);
      // Comment count should decrement by 3
      expect(mockIncrement).toHaveBeenCalledWith(-3);
    });

    it('should return error when unauthorized user tries to delete', async () => {
      // Comment exists, authored by someone else
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'comment-author' }),
      });
      // Photo exists, owned by someone else
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'photo-owner' }),
      });

      const result = await deleteComment('photo-123', 'comment-456', 'random-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized to delete this comment');
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('should return error when comment does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await deleteComment('photo-123', 'nonexistent', 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Comment not found');
    });

    it('should return error when photo does not exist', async () => {
      // Comment exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId: 'user-456' }),
      });
      // Photo does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await deleteComment('nonexistent-photo', 'comment-456', 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Photo not found');
    });

    it('should return error when missing required fields', async () => {
      const result = await deleteComment(null, 'comment-456', 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should return error when commentId is missing', async () => {
      const result = await deleteComment('photo-123', null, 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should return error when requestingUserId is missing', async () => {
      const result = await deleteComment('photo-123', 'comment-456', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should handle Firestore errors gracefully', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Firestore unavailable'));

      const result = await deleteComment('photo-123', 'comment-456', 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore unavailable');
    });
  });

  // ===========================================================================
  // getComments tests
  // ===========================================================================
  describe('getComments', () => {
    it('should return array of comments with user data', async () => {
      const mockUserData = createTestUser({ uid: 'user-123' });
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        size: 2,
        docs: [
          {
            id: 'comment-1',
            data: () => ({
              userId: 'user-123',
              text: 'First comment',
              parentId: null,
              likeCount: 0,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
          {
            id: 'comment-2',
            data: () => ({
              userId: 'user-123',
              text: 'Second comment',
              parentId: null,
              likeCount: 1,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
        ],
      });
      // User data fetch for joined user info
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockUserData,
      });

      const result = await getComments('photo-123');

      expect(result.success).toBe(true);
      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].id).toBe('comment-1');
      expect(result.comments[0].user).toBeDefined();
      expect(result.comments[0].user.uid).toBe('user-123');
    });

    it('should return empty array when no comments exist', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        size: 0,
        docs: [],
      });

      const result = await getComments('photo-123');

      expect(result.success).toBe(true);
      expect(result.comments).toEqual([]);
    });

    it('should return error when photoId is missing', async () => {
      const result = await getComments('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing photoId');
    });

    it('should return error when photoId is null', async () => {
      const result = await getComments(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing photoId');
    });

    it('should handle Firestore errors gracefully', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Query failed'));

      const result = await getComments('photo-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });

    it('should provide fallback user data for deleted users', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        size: 1,
        docs: [
          {
            id: 'comment-1',
            data: () => ({
              userId: 'deleted-user-id',
              text: 'Comment from deleted user',
              parentId: null,
              likeCount: 0,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
        ],
      });
      // User doc does not exist (deleted account)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getComments('photo-123');

      expect(result.success).toBe(true);
      expect(result.comments[0].user.isDeleted).toBe(true);
      expect(result.comments[0].user.username).toBe('deleted');
      expect(result.comments[0].user.displayName).toBe('Deleted User');
    });
  });

  // ===========================================================================
  // subscribeToComments tests
  // ===========================================================================
  describe('subscribeToComments', () => {
    it('should set up onSnapshot listener and return unsubscribe function', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      const unsubscribe = subscribeToComments('photo-123', callback);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback with comments when snapshot fires', async () => {
      const callback = jest.fn();
      let snapshotCallback;

      mockOnSnapshot.mockImplementationOnce((q, onNext, onError) => {
        snapshotCallback = onNext;
        return jest.fn();
      });

      subscribeToComments('photo-123', callback);

      // Simulate snapshot with comments
      // User data fetch
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestUser({ uid: 'user-123' }),
      });

      await snapshotCallback({
        empty: false,
        size: 1,
        docs: [
          {
            id: 'comment-1',
            data: () => ({
              userId: 'user-123',
              text: 'Real-time comment',
              parentId: null,
              likeCount: 0,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
        ],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          comments: expect.arrayContaining([
            expect.objectContaining({
              id: 'comment-1',
              text: 'Real-time comment',
            }),
          ]),
        })
      );
    });

    it('should call callback with empty array on empty snapshot', async () => {
      const callback = jest.fn();
      let snapshotCallback;

      mockOnSnapshot.mockImplementationOnce((q, onNext, onError) => {
        snapshotCallback = onNext;
        return jest.fn();
      });

      subscribeToComments('photo-123', callback);

      await snapshotCallback({
        empty: true,
        size: 0,
        docs: [],
      });

      expect(callback).toHaveBeenCalledWith({
        success: true,
        comments: [],
      });
    });

    it('should call callback with error on snapshot error', () => {
      const callback = jest.fn();
      let errorCallback;

      mockOnSnapshot.mockImplementationOnce((q, onNext, onError) => {
        errorCallback = onError;
        return jest.fn();
      });

      subscribeToComments('photo-123', callback);

      // Simulate snapshot error
      errorCallback(new Error('Snapshot failed'));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Snapshot failed',
          comments: [],
        })
      );
    });

    it('should return noop function and call callback with error for missing photoId', () => {
      const callback = jest.fn();

      const unsubscribe = subscribeToComments('', callback);

      expect(typeof unsubscribe).toBe('function');
      expect(mockOnSnapshot).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing photoId',
        })
      );
    });

    it('should return noop function for null photoId', () => {
      const callback = jest.fn();

      const unsubscribe = subscribeToComments(null, callback);

      expect(typeof unsubscribe).toBe('function');
      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getPreviewComments tests
  // ===========================================================================
  describe('getPreviewComments', () => {
    it('should return owner comment first when present', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        size: 3,
        docs: [
          {
            id: 'comment-other',
            data: () => ({
              userId: 'other-user',
              text: 'Nice!',
              parentId: null,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
          {
            id: 'comment-owner',
            data: () => ({
              userId: 'photo-owner-id',
              text: 'My caption',
              parentId: null,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
          {
            id: 'comment-third',
            data: () => ({
              userId: 'third-user',
              text: 'Cool photo',
              parentId: null,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
        ],
      });
      // User data fetches
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestUser({ uid: 'photo-owner-id', username: 'owner' }),
      });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestUser({ uid: 'other-user', username: 'other' }),
      });

      const result = await getPreviewComments('photo-123', 'photo-owner-id');

      expect(result.success).toBe(true);
      expect(result.previewComments).toHaveLength(2);
      // Owner comment should be first
      expect(result.previewComments[0].userId).toBe('photo-owner-id');
    });

    it('should return up to 2 comments when no owner comment', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        size: 3,
        docs: [
          {
            id: 'comment-1',
            data: () => ({
              userId: 'user-a',
              text: 'First',
              parentId: null,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
          {
            id: 'comment-2',
            data: () => ({
              userId: 'user-b',
              text: 'Second',
              parentId: null,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
          {
            id: 'comment-3',
            data: () => ({
              userId: 'user-c',
              text: 'Third',
              parentId: null,
              createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
            }),
          },
        ],
      });
      // User data fetches
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestUser({ uid: 'user-a' }),
      });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestUser({ uid: 'user-b' }),
      });

      const result = await getPreviewComments('photo-123', 'nonexistent-owner');

      expect(result.success).toBe(true);
      expect(result.previewComments.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no comments exist', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        size: 0,
        docs: [],
      });

      const result = await getPreviewComments('photo-123', 'owner-id');

      expect(result.success).toBe(true);
      expect(result.previewComments).toEqual([]);
    });

    it('should return error when photoId is missing', async () => {
      const result = await getPreviewComments('', 'owner-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing photoId');
    });

    it('should handle Firestore errors gracefully', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Query failed'));

      const result = await getPreviewComments('photo-123', 'owner-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });
  });

  // ===========================================================================
  // hasUserLikedComment tests
  // ===========================================================================
  describe('hasUserLikedComment', () => {
    it('should return true when user has liked the comment', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      });

      const result = await hasUserLikedComment('photo-123', 'comment-456', 'user-789');

      expect(result).toBe(true);
    });

    it('should return false when user has not liked the comment', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await hasUserLikedComment('photo-123', 'comment-456', 'user-789');

      expect(result).toBe(false);
    });

    it('should return false on Firestore error', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Read failed'));

      const result = await hasUserLikedComment('photo-123', 'comment-456', 'user-789');

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // toggleCommentLike tests
  // ===========================================================================
  describe('toggleCommentLike', () => {
    it('should add like when not already liked', async () => {
      // Like doc does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await toggleCommentLike('photo-123', 'comment-456', 'user-789');

      expect(result.success).toBe(true);
      expect(result.liked).toBe(true);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-789',
        })
      );
      expect(mockIncrement).toHaveBeenCalledWith(1);
    });

    it('should remove like when already liked', async () => {
      // Like doc exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      });
      mockDeleteDoc.mockResolvedValueOnce();
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await toggleCommentLike('photo-123', 'comment-456', 'user-789');

      expect(result.success).toBe(true);
      expect(result.liked).toBe(false);
      expect(mockDeleteDoc).toHaveBeenCalled();
      expect(mockIncrement).toHaveBeenCalledWith(-1);
    });

    it('should return error when missing required fields', async () => {
      const result = await toggleCommentLike(null, 'comment-456', 'user-789');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should return error when commentId is missing', async () => {
      const result = await toggleCommentLike('photo-123', null, 'user-789');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should return error when userId is missing', async () => {
      const result = await toggleCommentLike('photo-123', 'comment-456', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should handle Firestore errors gracefully', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await toggleCommentLike('photo-123', 'comment-456', 'user-789');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection lost');
    });
  });

  // ===========================================================================
  // getUserLikesForComments tests
  // ===========================================================================
  describe('getUserLikesForComments', () => {
    it('should return map of liked comment IDs', async () => {
      // First comment liked
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      });
      // Second comment not liked
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      // Third comment liked
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      });

      const result = await getUserLikesForComments(
        'photo-123',
        ['comment-1', 'comment-2', 'comment-3'],
        'user-789'
      );

      expect(result['comment-1']).toBe(true);
      expect(result['comment-2']).toBe(false);
      expect(result['comment-3']).toBe(true);
    });

    it('should return empty object when no commentIds provided', async () => {
      const result = await getUserLikesForComments('photo-123', [], 'user-789');

      expect(result).toEqual({});
    });

    it('should return empty object when commentIds is null', async () => {
      const result = await getUserLikesForComments('photo-123', null, 'user-789');

      expect(result).toEqual({});
    });

    it('should return empty object when photoId is missing', async () => {
      const result = await getUserLikesForComments('', ['comment-1'], 'user-789');

      expect(result).toEqual({});
    });

    it('should return empty object when userId is missing', async () => {
      const result = await getUserLikesForComments('photo-123', ['comment-1'], '');

      expect(result).toEqual({});
    });

    it('should handle errors gracefully and return empty object', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Batch failed'));

      const result = await getUserLikesForComments('photo-123', ['comment-1'], 'user-789');

      // hasUserLikedComment returns false on error, so the result should still be an object
      expect(typeof result).toBe('object');
    });
  });

  // ===========================================================================
  // generateCommentId tests
  // ===========================================================================
  describe('generateCommentId', () => {
    it('should return a string ID', () => {
      const id = generateCommentId('photo-123');

      expect(typeof id).toBe('string');
      expect(id).toBeDefined();
    });
  });
});
