/**
 * Callable Function Tests
 *
 * Tests for 6 callable/HTTPS functions exported from index.js:
 * 1. getMutualFriendSuggestions
 * 2. getMutualFriendsForComments
 * 3. deleteUserAccount
 * 4. scheduleUserAccountDeletion
 * 5. cancelUserAccountDeletion
 * 6. unsendMessage
 *
 * Callable functions are wrapped by onCall mock to return the handler directly.
 * The handler receives (request) where request has .auth and .data properties.
 */

const { initializeFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Get the singleton mock db
const mockDb = initializeFirestore();

// Require the functions (callable handlers are returned directly by onCall mock)
const {
  getMutualFriendSuggestions,
  getMutualFriendsForComments,
  deleteUserAccount,
  scheduleUserAccountDeletion,
  cancelUserAccountDeletion,
  unsendMessage,
} = require('../../index');

/**
 * Helper: configure mockDb for callable function tests
 */
function setupMockDb(config = {}) {
  const {
    users = {},
    friendships = { docs: [], empty: true, size: 0 },
    friendships2 = null,
    photos = { docs: [], empty: true, size: 0 },
  } = config;

  // Track calls to differentiate multiple friendship queries
  let friendshipQueryCount = 0;

  const mockDocGet = (collectionName, docId) => {
    if (collectionName === 'users' && users[docId]) {
      return Promise.resolve({
        exists: true,
        id: docId,
        data: () => users[docId],
        ref: {
          id: docId,
          delete: jest.fn().mockResolvedValue(),
        },
      });
    }
    if (collectionName === 'darkrooms') {
      return Promise.resolve({
        exists: true,
        id: docId,
        data: () => ({}),
        ref: {
          id: docId,
          delete: jest.fn().mockResolvedValue(),
        },
      });
    }
    return Promise.resolve({
      exists: false,
      id: docId,
      data: () => null,
      ref: {
        id: docId,
        delete: jest.fn().mockResolvedValue(),
      },
    });
  };

  mockDb.collection.mockImplementation(collectionName => {
    const collectionRef = {
      doc: jest.fn(docId => {
        const docRef = {
          get: jest.fn(() => mockDocGet(collectionName, docId)),
          set: jest.fn().mockResolvedValue(),
          update: jest.fn().mockResolvedValue(),
          delete: jest.fn().mockResolvedValue(),
          collection: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
          })),
          id: docId,
        };
        return docRef;
      }),
      add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(() => {
        if (collectionName === 'friendships') {
          friendshipQueryCount++;
          // Support multiple query calls returning different results
          if (config.friendshipQueries) {
            const idx = Math.min(friendshipQueryCount - 1, config.friendshipQueries.length - 1);
            return Promise.resolve(config.friendshipQueries[idx]);
          }
          if (friendships2 && friendshipQueryCount > 1) {
            return Promise.resolve(friendships2);
          }
          return Promise.resolve(friendships);
        }
        if (collectionName === 'photos') {
          return Promise.resolve(photos);
        }
        if (collectionName === 'users') {
          if (config.usersQuery) {
            return Promise.resolve(config.usersQuery);
          }
          return Promise.resolve({ docs: [], empty: true, size: 0 });
        }
        return Promise.resolve({ docs: [], empty: true, size: 0 });
      }),
    };

    return collectionRef;
  });

  mockDb.doc.mockImplementation(path => {
    const parts = path.split('/');
    return {
      get: jest.fn(() => mockDocGet(parts[0], parts[1])),
      set: jest.fn().mockResolvedValue(),
      update: jest.fn().mockResolvedValue(),
      delete: jest.fn().mockResolvedValue(),
    };
  });

  mockDb.batch.mockReturnValue({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
  });

  return { mockDb };
}

// ============================================================================
// getMutualFriendSuggestions
// ============================================================================
describe('getMutualFriendSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw unauthenticated error when no auth context', async () => {
    await expect(getMutualFriendSuggestions({ auth: null, data: {} })).rejects.toThrow(
      'User must be authenticated'
    );
  });

  it('should return empty suggestions when user has no friends', async () => {
    setupMockDb({
      friendshipQueries: [
        { docs: [], empty: true, size: 0 },
        { docs: [], empty: true, size: 0 },
      ],
    });

    const result = await getMutualFriendSuggestions({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result).toEqual({ suggestions: [] });
  });

  it('should return mutual friend suggestions when friends-of-friends exist', async () => {
    // user-1 is friends with friend-A
    // friend-A is friends with suggestion-B (not friends with user-1)
    setupMockDb({
      users: {
        'suggestion-B': {
          displayName: 'Suggestion B',
          username: 'suggestionb',
          profilePhotoURL: 'https://photo.b',
        },
      },
      friendshipQueries: [
        // Query 1: user-1's friendships (user1Id == user-1)
        {
          docs: [
            {
              data: () => ({
                user1Id: 'user-1',
                user2Id: 'friend-A',
                status: 'accepted',
              }),
            },
          ],
          empty: false,
          size: 1,
        },
        // Query 2: user-1's friendships (user2Id == user-1)
        { docs: [], empty: true, size: 0 },
        // Query 3: friend-A's friendships (user1Id == friend-A)
        {
          docs: [
            {
              data: () => ({
                user1Id: 'friend-A',
                user2Id: 'suggestion-B',
                status: 'accepted',
              }),
            },
          ],
          empty: false,
          size: 1,
        },
        // Query 4: friend-A's friendships (user2Id == friend-A)
        { docs: [], empty: true, size: 0 },
      ],
    });

    const result = await getMutualFriendSuggestions({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      userId: 'suggestion-B',
      displayName: 'Suggestion B',
      mutualCount: 1,
    });
  });

  it('should return empty when friends-of-friends are already connected', async () => {
    // user-1 friends with friend-A, friend-A only friends with user-1
    setupMockDb({
      friendshipQueries: [
        // Query 1: user-1's friendships (user1Id == user-1)
        {
          docs: [
            {
              data: () => ({
                user1Id: 'user-1',
                user2Id: 'friend-A',
                status: 'accepted',
              }),
            },
          ],
          empty: false,
          size: 1,
        },
        // Query 2: user-1's friendships (user2Id == user-1)
        { docs: [], empty: true, size: 0 },
        // Query 3: friend-A's friendships (user1Id == friend-A)
        {
          docs: [
            {
              data: () => ({
                user1Id: 'friend-A',
                user2Id: 'user-1',
                status: 'accepted',
              }),
            },
          ],
          empty: false,
          size: 1,
        },
        // Query 4: friend-A's friendships (user2Id == friend-A)
        { docs: [], empty: true, size: 0 },
      ],
    });

    const result = await getMutualFriendSuggestions({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result.suggestions).toEqual([]);
  });
});

// ============================================================================
// getMutualFriendsForComments
// ============================================================================
describe('getMutualFriendsForComments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw unauthenticated error when no auth context', async () => {
    await expect(
      getMutualFriendsForComments({ auth: null, data: { photoOwnerId: 'owner-1' } })
    ).rejects.toThrow('User must be authenticated');
  });

  it('should throw invalid-argument when photoOwnerId is missing', async () => {
    await expect(
      getMutualFriendsForComments({ auth: { uid: 'user-1' }, data: {} })
    ).rejects.toThrow('photoOwnerId is required');
  });

  it('should throw invalid-argument when photoOwnerId is not a string', async () => {
    await expect(
      getMutualFriendsForComments({ auth: { uid: 'user-1' }, data: { photoOwnerId: 123 } })
    ).rejects.toThrow('photoOwnerId is required');
  });

  it('should return mutual friends between caller and photo owner', async () => {
    // caller is friends with mutual-friend-1
    // owner is friends with mutual-friend-1
    // So mutual-friend-1 is in the intersection
    setupMockDb({
      users: {
        'owner-1': {
          displayName: 'Owner',
          username: 'owner',
          profilePhotoURL: 'https://owner.photo',
        },
        'mutual-friend-1': {
          displayName: 'Mutual Friend',
          username: 'mutualfriend',
          profilePhotoURL: 'https://mutual.photo',
        },
      },
      friendshipQueries: [
        // Query 1: caller's friendships (user1Id == caller)
        {
          docs: [
            {
              data: () => ({
                user1Id: 'caller-1',
                user2Id: 'mutual-friend-1',
                status: 'accepted',
              }),
            },
          ],
          empty: false,
          size: 1,
        },
        // Query 2: caller's friendships (user2Id == caller)
        { docs: [], empty: true, size: 0 },
        // Query 3: owner's friendships (user1Id == owner)
        {
          docs: [
            {
              data: () => ({
                user1Id: 'owner-1',
                user2Id: 'mutual-friend-1',
                status: 'accepted',
              }),
            },
          ],
          empty: false,
          size: 1,
        },
        // Query 4: owner's friendships (user2Id == owner)
        { docs: [], empty: true, size: 0 },
      ],
    });

    const result = await getMutualFriendsForComments({
      auth: { uid: 'caller-1' },
      data: { photoOwnerId: 'owner-1' },
    });

    // Should include mutual-friend-1 and the photo owner
    expect(result.mutualFriends.length).toBeGreaterThanOrEqual(1);
    const userIds = result.mutualFriends.map(f => f.userId);
    expect(userIds).toContain('mutual-friend-1');
    // Photo owner is always included
    expect(userIds).toContain('owner-1');
  });

  it('should return empty array when no mutual friends exist', async () => {
    setupMockDb({
      users: {
        'owner-1': {
          displayName: 'Owner',
          username: 'owner',
        },
      },
      friendshipQueries: [
        { docs: [], empty: true, size: 0 },
        { docs: [], empty: true, size: 0 },
        { docs: [], empty: true, size: 0 },
        { docs: [], empty: true, size: 0 },
      ],
    });

    const result = await getMutualFriendsForComments({
      auth: { uid: 'caller-1' },
      data: { photoOwnerId: 'owner-1' },
    });

    // Photo owner is always included even with no mutual friends
    const userIds = result.mutualFriends.map(f => f.userId);
    expect(userIds).toContain('owner-1');
    // Caller should NOT be in the list (don't tag yourself)
    expect(userIds).not.toContain('caller-1');
  });
});

// ============================================================================
// deleteUserAccount
// ============================================================================
describe('deleteUserAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw unauthenticated error when no auth context', async () => {
    await expect(deleteUserAccount({ auth: null, data: {} })).rejects.toThrow(
      'Must be authenticated to delete account'
    );
  });

  it('should delete all user data and auth account', async () => {
    const photoRef = { ref: { id: 'photo-1' }, data: () => ({ imageURL: '' }) };
    const friendshipRef1 = { ref: { id: 'fs-1' } };

    // Set up a stable mock for admin.auth() so we can track deleteUser calls
    const mockDeleteUser = jest.fn().mockResolvedValue();
    admin.auth.mockReturnValue({
      getUser: jest.fn(),
      deleteUser: mockDeleteUser,
    });

    setupMockDb({
      users: {
        'user-1': { displayName: 'User' },
      },
      photos: {
        docs: [photoRef],
        empty: false,
        size: 1,
      },
      friendships: {
        docs: [friendshipRef1],
        empty: false,
        size: 1,
      },
      friendships2: {
        docs: [],
        empty: true,
        size: 0,
      },
    });

    const result = await deleteUserAccount({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result).toEqual({ success: true });
    expect(mockDeleteUser).toHaveBeenCalledWith('user-1');
  });

  it('should handle user with no photos gracefully', async () => {
    const mockDeleteUser = jest.fn().mockResolvedValue();
    admin.auth.mockReturnValue({
      getUser: jest.fn(),
      deleteUser: mockDeleteUser,
    });

    setupMockDb({
      users: {
        'user-1': { displayName: 'User' },
      },
      photos: { docs: [], empty: true, size: 0 },
      friendships: { docs: [], empty: true, size: 0 },
      friendships2: { docs: [], empty: true, size: 0 },
    });

    const result = await deleteUserAccount({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result).toEqual({ success: true });
    expect(mockDeleteUser).toHaveBeenCalledWith('user-1');
  });

  it('should delete storage files for photos with imageURL', async () => {
    const encodedUrl =
      'https://storage.googleapis.com/bucket/o/photos%2Fuser-1%2Fphoto1.jpg?alt=media';

    setupMockDb({
      users: {
        'user-1': { displayName: 'User' },
      },
      photos: {
        docs: [
          {
            ref: { id: 'photo-1' },
            data: () => ({ imageURL: encodedUrl }),
          },
        ],
        empty: false,
        size: 1,
      },
      friendships: { docs: [], empty: true, size: 0 },
      friendships2: { docs: [], empty: true, size: 0 },
    });

    const result = await deleteUserAccount({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result).toEqual({ success: true });

    // Verify storage file deletion was attempted
    const { getStorage } = require('firebase-admin/storage');
    const bucket = getStorage().bucket();
    expect(bucket.file).toHaveBeenCalled();
  });
});

// ============================================================================
// scheduleUserAccountDeletion
// ============================================================================
describe('scheduleUserAccountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw unauthenticated error when no auth context', async () => {
    await expect(scheduleUserAccountDeletion({ auth: null, data: {} })).rejects.toThrow(
      'Must be authenticated to schedule deletion'
    );
  });

  it('should schedule deletion 30 days from now', async () => {
    setupMockDb({
      users: {
        'user-1': { displayName: 'User' },
      },
    });

    const result = await scheduleUserAccountDeletion({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result.success).toBe(true);
    expect(result.scheduledDate).toBeDefined();

    // Verify the scheduled date is approximately 30 days from now
    const scheduledDate = new Date(result.scheduledDate);
    const now = new Date();
    const daysDiff = (scheduledDate - now) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(29);
    expect(daysDiff).toBeLessThan(31);
  });

  it('should update user document with scheduled deletion fields', async () => {
    // Track the update call on the specific doc ref
    const mockUpdate = jest.fn().mockResolvedValue();
    const mockDocRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ displayName: 'User' }) }),
      set: jest.fn().mockResolvedValue(),
      update: mockUpdate,
      delete: jest.fn().mockResolvedValue(),
    };

    mockDb.collection.mockImplementation(collectionName => ({
      doc: jest.fn(() => mockDocRef),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
    }));

    await scheduleUserAccountDeletion({
      auth: { uid: 'user-1' },
      data: {},
    });

    // Verify update was called with scheduled deletion fields
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deletionScheduledAt: 'mock-timestamp',
      })
    );
  });
});

// ============================================================================
// cancelUserAccountDeletion
// ============================================================================
describe('cancelUserAccountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw unauthenticated error when no auth context', async () => {
    await expect(cancelUserAccountDeletion({ auth: null, data: {} })).rejects.toThrow(
      'Must be authenticated to cancel deletion'
    );
  });

  it('should clear deletion schedule fields from user document', async () => {
    // Track the update call on the specific doc ref
    const mockUpdate = jest.fn().mockResolvedValue();
    const mockDocRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          displayName: 'User',
          scheduledForDeletionAt: 'some-timestamp',
          deletionScheduledAt: 'some-timestamp',
        }),
      }),
      set: jest.fn().mockResolvedValue(),
      update: mockUpdate,
      delete: jest.fn().mockResolvedValue(),
    };

    mockDb.collection.mockImplementation(collectionName => ({
      doc: jest.fn(() => mockDocRef),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
    }));

    const result = await cancelUserAccountDeletion({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result).toEqual({ success: true });

    // Verify update was called with FieldValue.delete() for both fields
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledForDeletionAt: expect.anything(),
        deletionScheduledAt: expect.anything(),
      })
    );
  });

  it('should return success even if fields did not exist', async () => {
    setupMockDb({
      users: {
        'user-1': { displayName: 'User' },
      },
    });

    const result = await cancelUserAccountDeletion({
      auth: { uid: 'user-1' },
      data: {},
    });

    expect(result).toEqual({ success: true });
  });
});

// ============================================================================
// unsendMessage
// ============================================================================
describe('unsendMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper: set up mock for unsendMessage-specific Firestore operations.
   * Supports nested doc().collection().doc().get() pattern for messages subcollection.
   */
  function setupUnsendMockDb({
    messageData = null,
    messageExists = true,
    conversationData = null,
    reactionDocs = [],
    replyDocs = [],
    recentMessageDocs = [],
  } = {}) {
    const mockBatchUpdate = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue();
    mockDb.batch.mockReturnValue({
      set: jest.fn(),
      update: mockBatchUpdate,
      delete: jest.fn(),
      commit: mockBatchCommit,
    });

    // Mock for the message doc ref (conversations/{id}/messages/{id})
    const mockMessageRef = {
      get: jest.fn().mockResolvedValue({
        exists: messageExists,
        data: () => messageData,
        ref: { id: 'msg-1' },
      }),
      update: jest.fn().mockResolvedValue(),
      id: 'msg-1',
    };

    // Mock for the messages subcollection queries (reactions, replies, recent)
    let queryCallCount = 0;
    const mockMessagesCollection = {
      doc: jest.fn(() => mockMessageRef),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(() => {
        queryCallCount++;
        if (queryCallCount === 1) {
          // First query: reactions (where targetMessageId == messageId)
          return Promise.resolve({
            docs: reactionDocs.map((d, i) => ({
              ref: { id: `reaction-${i}` },
              data: () => d,
            })),
            size: reactionDocs.length,
          });
        } else if (queryCallCount === 2) {
          // Second query: replies (where replyTo.messageId == messageId)
          return Promise.resolve({
            docs: replyDocs.map((d, i) => ({
              ref: { id: `reply-${i}` },
              data: () => d,
            })),
            size: replyDocs.length,
          });
        } else {
          // Third query: recent messages for lastMessage fallback
          return Promise.resolve({
            docs: recentMessageDocs.map((d, i) => ({
              id: d._id || `recent-${i}`,
              ref: { id: d._id || `recent-${i}` },
              data: () => d,
            })),
            size: recentMessageDocs.length,
          });
        }
      }),
    };

    // Mock conversation doc ref
    const mockConvRef = {
      get: jest.fn().mockResolvedValue({
        exists: !!conversationData,
        data: () => conversationData,
      }),
      update: jest.fn().mockResolvedValue(),
    };

    // Wire up mockDb.collection and mockDb.doc
    mockDb.collection.mockImplementation(collectionName => {
      if (collectionName === 'conversations') {
        return {
          doc: jest.fn(() => ({
            collection: jest.fn(() => mockMessagesCollection),
            get: mockConvRef.get,
            update: mockConvRef.update,
          })),
        };
      }
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        })),
      };
    });

    mockDb.doc.mockImplementation(path => {
      if (path.startsWith('conversations/')) {
        return mockConvRef;
      }
      return {
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
      };
    });

    return { mockBatchUpdate, mockBatchCommit, mockMessageRef, mockConvRef };
  }

  it('should return success when called with valid params and message within 15-minute window', async () => {
    const recentCreatedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const { mockBatchCommit } = setupUnsendMockDb({
      messageData: {
        senderId: 'user-1',
        text: 'Hello',
        type: 'text',
        createdAt: { toDate: () => recentCreatedAt },
      },
      conversationData: {
        lastMessage: {
          timestamp: { toMillis: () => recentCreatedAt.getTime() },
        },
      },
      recentMessageDocs: [
        {
          _id: 'msg-1',
          senderId: 'user-1',
          text: 'Hello',
          unsent: false,
          type: 'text',
          createdAt: recentCreatedAt,
        },
      ],
    });

    const result = await unsendMessage({
      auth: { uid: 'user-1' },
      data: { conversationId: 'user-1_user-2', messageId: 'msg-1' },
    });

    expect(result).toEqual({ success: true });
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('should throw unauthenticated when no auth context', async () => {
    await expect(
      unsendMessage({
        auth: null,
        data: { conversationId: 'conv-1', messageId: 'msg-1' },
      })
    ).rejects.toThrow('Must be authenticated to unsend a message');
  });

  it('should throw permission-denied when userId does not match senderId', async () => {
    const recentCreatedAt = new Date(Date.now() - 5 * 60 * 1000);
    setupUnsendMockDb({
      messageData: {
        senderId: 'other-user',
        text: 'Hello',
        type: 'text',
        createdAt: { toDate: () => recentCreatedAt },
      },
    });

    await expect(
      unsendMessage({
        auth: { uid: 'user-1' },
        data: { conversationId: 'conv-1', messageId: 'msg-1' },
      })
    ).rejects.toThrow('Can only unsend your own messages');
  });

  it('should throw failed-precondition when message is older than 15 minutes', async () => {
    const oldCreatedAt = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    setupUnsendMockDb({
      messageData: {
        senderId: 'user-1',
        text: 'Hello',
        type: 'text',
        createdAt: { toDate: () => oldCreatedAt },
      },
    });

    await expect(
      unsendMessage({
        auth: { uid: 'user-1' },
        data: { conversationId: 'conv-1', messageId: 'msg-1' },
      })
    ).rejects.toThrow('Unsend window has expired');
  });

  it('should set unsent:true on the message document via batch update', async () => {
    const recentCreatedAt = new Date(Date.now() - 5 * 60 * 1000);
    const { mockBatchUpdate } = setupUnsendMockDb({
      messageData: {
        senderId: 'user-1',
        text: 'Hello',
        type: 'text',
        createdAt: { toDate: () => recentCreatedAt },
      },
      conversationData: null,
    });

    await unsendMessage({
      auth: { uid: 'user-1' },
      data: { conversationId: 'user-1_user-2', messageId: 'msg-1' },
    });

    // First batch.update call should be the message soft-delete
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        unsent: true,
        unsentAt: 'mock-timestamp',
      })
    );
  });
});
