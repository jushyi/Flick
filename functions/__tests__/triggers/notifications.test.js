/**
 * Notification Trigger Tests
 *
 * Tests for notification trigger functions exported from index.js:
 * 1. sendFriendAcceptedNotification (onUpdate - friendships)
 * 2. sendReactionNotification (onUpdate - photos)
 * 3. sendTaggedPhotoNotification (onUpdate - photos)
 * 4. sendCommentNotification (onCreate - photos/{photoId}/comments)
 * 5. sendPhotoRevealNotification (onUpdate - darkrooms)
 *
 * Also verifies sendFriendRequestNotification (onCreate - friendships) from 49-05.
 */

// Mock the notifications/sender module BEFORE requiring index.js
// The trigger functions do require('./notifications/sender') internally
const mockSendPushNotification = jest.fn().mockResolvedValue({ success: true, tickets: [] });
jest.mock('../../notifications/sender', () => ({
  sendPushNotification: mockSendPushNotification,
  sendBatchNotifications: jest.fn().mockResolvedValue([]),
  expo: {
    sendPushNotificationsAsync: jest.fn(),
    chunkPushNotifications: jest.fn(msgs => [msgs]),
  },
}));

// Mock the notifications/batching module (used by sendReactionNotification)
const mockAddReactionToBatch = jest.fn().mockResolvedValue();
jest.mock('../../notifications/batching', () => ({
  addReactionToBatch: mockAddReactionToBatch,
  scheduleNotificationTask: jest.fn().mockResolvedValue(),
}));

const { initializeFirestore } = require('firebase-admin/firestore');

// Get the mock db that index.js will use
const mockDb = initializeFirestore();

// Require the functions (trigger handlers are returned directly by mock)
const {
  sendFriendRequestNotification,
  sendFriendAcceptedNotification,
  sendReactionNotification,
  sendTaggedPhotoNotification,
  sendCommentNotification,
  sendPhotoRevealNotification,
  onNewMessage,
} = require('../../index');

// Valid FCM token for tests
const VALID_TOKEN = 'ExponentPushToken[test-token-123]';

/**
 * Helper: configure mockDb.collection().doc().get() to return specific user data
 * based on the userId requested. Also handles collection queries.
 */
function setupMockDb(config = {}) {
  const {
    users = {},
    friendships = { docs: [], empty: true, size: 0 },
    friendships2 = null,
    photos = { docs: [], empty: true, size: 0 },
    notifications = { add: jest.fn().mockResolvedValue({ id: 'notif-id' }) },
  } = config;

  // Create a mock doc ref factory that returns correct data per path
  const mockDocGet = (collectionName, docId) => {
    if (collectionName === 'users' && users[docId]) {
      return Promise.resolve({
        exists: true,
        id: docId,
        data: () => users[docId],
        ref: { id: docId },
      });
    }
    if (collectionName === 'photos' && config.photoDoc) {
      return Promise.resolve(config.photoDoc);
    }
    if (collectionName === 'darkrooms') {
      return Promise.resolve({
        exists: true,
        id: docId,
        data: () => ({}),
        ref: { id: docId, update: jest.fn().mockResolvedValue() },
      });
    }
    return Promise.resolve({
      exists: false,
      id: docId,
      data: () => null,
    });
  };

  // Track collection access for query chains
  let currentCollection = null;
  let queryFilters = [];

  const mockDocRef = {
    get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
    set: jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
    delete: jest.fn().mockResolvedValue(),
  };

  // Create a mock collection that handles both doc access and queries
  mockDb.collection.mockImplementation(collectionName => {
    currentCollection = collectionName;
    queryFilters = [];

    const collectionRef = {
      doc: jest.fn(docId => {
        const docRef = {
          get: jest.fn(() => mockDocGet(collectionName, docId)),
          set: jest.fn().mockResolvedValue(),
          update: jest.fn().mockResolvedValue(),
          delete: jest.fn().mockResolvedValue(),
          collection: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
            doc: jest.fn(() => ({
              collection: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
              })),
            })),
          })),
          id: docId,
        };
        return docRef;
      }),
      add:
        collectionName === 'notifications'
          ? notifications.add
          : jest.fn().mockResolvedValue({ id: 'mock-id' }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(() => {
        if (collectionName === 'friendships') {
          // Support returning different results for second query
          if (friendships._callCount === undefined) {
            friendships._callCount = 0;
          }
          friendships._callCount++;
          if (friendships2 && friendships._callCount > 1) {
            return Promise.resolve(friendships2);
          }
          return Promise.resolve(friendships);
        }
        if (collectionName === 'photos') {
          return Promise.resolve(photos);
        }
        if (collectionName === 'users') {
          // For query-based user lookups (e.g., by username)
          if (config.userQueryResult) {
            return Promise.resolve(config.userQueryResult);
          }
          return Promise.resolve({ docs: [], empty: true });
        }
        return Promise.resolve({ docs: [], empty: true });
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

  return { mockDb, notifications };
}

// ============================================================================
// sendFriendRequestNotification (onCreate)
// ============================================================================
describe('sendFriendRequestNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send notification to recipient when friend request is created', async () => {
    setupMockDb({
      users: {
        'recipient-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Recipient User',
          notificationPreferences: {},
        },
        'sender-1': {
          displayName: 'Sender User',
          username: 'sender',
        },
      },
    });

    const snap = {
      data: () => ({
        requestedBy: 'sender-1',
        user1Id: 'sender-1',
        user2Id: 'recipient-1',
        status: 'pending',
      }),
    };

    const context = { params: { friendshipId: 'friendship-1' } };

    await sendFriendRequestNotification(snap, context);

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Sender User',
      'sent you a friend request',
      expect.objectContaining({ type: 'friend_request' }),
      'recipient-1'
    );
  });

  it('should skip notification when friendship status is not pending', async () => {
    const snap = {
      data: () => ({
        requestedBy: 'sender-1',
        user1Id: 'sender-1',
        user2Id: 'recipient-1',
        status: 'accepted',
      }),
    };

    const context = { params: { friendshipId: 'friendship-1' } };

    await sendFriendRequestNotification(snap, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip notification when recipient has no FCM token', async () => {
    setupMockDb({
      users: {
        'recipient-1': {
          fcmToken: null,
          displayName: 'Recipient User',
          notificationPreferences: {},
        },
        'sender-1': { displayName: 'Sender User' },
      },
    });

    const snap = {
      data: () => ({
        requestedBy: 'sender-1',
        user1Id: 'sender-1',
        user2Id: 'recipient-1',
        status: 'pending',
      }),
    };

    const context = { params: { friendshipId: 'friendship-1' } };

    await sendFriendRequestNotification(snap, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip notification for self-friendship', async () => {
    const snap = {
      data: () => ({
        requestedBy: 'user-1',
        user1Id: 'user-1',
        user2Id: 'user-1',
        status: 'pending',
      }),
    };

    const context = { params: { friendshipId: 'friendship-1' } };

    await sendFriendRequestNotification(snap, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });
});

// ============================================================================
// sendFriendAcceptedNotification (onUpdate)
// ============================================================================
describe('sendFriendAcceptedNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send notification when friendship changes to accepted', async () => {
    const notifMock = { add: jest.fn().mockResolvedValue({ id: 'n-1' }) };
    setupMockDb({
      users: {
        'requester-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Requester',
          notificationPreferences: {},
        },
        'acceptor-1': {
          displayName: 'Acceptor',
          username: 'acceptor',
          profilePhotoURL: 'https://photo.url',
        },
      },
      notifications: notifMock,
    });

    const change = {
      before: {
        data: () => ({
          status: 'pending',
          requestedBy: 'requester-1',
          user1Id: 'requester-1',
          user2Id: 'acceptor-1',
        }),
      },
      after: {
        data: () => ({
          status: 'accepted',
          requestedBy: 'requester-1',
          user1Id: 'requester-1',
          user2Id: 'acceptor-1',
        }),
      },
    };

    const context = { params: { friendshipId: 'fs-1' } };

    await sendFriendAcceptedNotification(change, context);

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Acceptor',
      'accepted your friend request',
      expect.objectContaining({ type: 'friend_accepted', friendshipId: 'fs-1' }),
      'requester-1'
    );

    // Should also write to notifications collection
    expect(notifMock.add).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'requester-1',
        type: 'friend_accepted',
        senderId: 'acceptor-1',
      })
    );
  });

  it('should skip when status did not change to accepted', async () => {
    const change = {
      before: {
        data: () => ({ status: 'pending', requestedBy: 'u1', user1Id: 'u1', user2Id: 'u2' }),
      },
      after: {
        data: () => ({ status: 'pending', requestedBy: 'u1', user1Id: 'u1', user2Id: 'u2' }),
      },
    };

    const context = { params: { friendshipId: 'fs-1' } };

    await sendFriendAcceptedNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when recipient has no FCM token', async () => {
    setupMockDb({
      users: {
        'requester-1': {
          fcmToken: null,
          displayName: 'Requester',
          notificationPreferences: {},
        },
        'acceptor-1': { displayName: 'Acceptor' },
      },
    });

    const change = {
      before: {
        data: () => ({
          status: 'pending',
          requestedBy: 'requester-1',
          user1Id: 'requester-1',
          user2Id: 'acceptor-1',
        }),
      },
      after: {
        data: () => ({
          status: 'accepted',
          requestedBy: 'requester-1',
          user1Id: 'requester-1',
          user2Id: 'acceptor-1',
        }),
      },
    };

    const context = { params: { friendshipId: 'fs-1' } };

    await sendFriendAcceptedNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when notifications are disabled by user preferences', async () => {
    setupMockDb({
      users: {
        'requester-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Requester',
          notificationPreferences: { enabled: false },
        },
        'acceptor-1': { displayName: 'Acceptor' },
      },
    });

    const change = {
      before: {
        data: () => ({
          status: 'pending',
          requestedBy: 'requester-1',
          user1Id: 'requester-1',
          user2Id: 'acceptor-1',
        }),
      },
      after: {
        data: () => ({
          status: 'accepted',
          requestedBy: 'requester-1',
          user1Id: 'requester-1',
          user2Id: 'acceptor-1',
        }),
      },
    };

    const context = { params: { friendshipId: 'fs-1' } };

    await sendFriendAcceptedNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when after data is invalid', async () => {
    const change = {
      before: { data: () => ({ status: 'pending' }) },
      after: { data: () => null },
    };

    const context = { params: { friendshipId: 'fs-1' } };

    const result = await sendFriendAcceptedNotification(change, context);

    expect(result).toBeNull();
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });
});

// ============================================================================
// sendReactionNotification (onUpdate - photos)
// ============================================================================
describe('sendReactionNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should add reaction to Firestore batch when reaction is added', async () => {
    const change = {
      before: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 0,
          reactions: {},
        }),
      },
      after: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 1,
          reactions: {
            'reactor-1': { '\u2764\uFE0F': 1 },
          },
        }),
      },
    };

    const context = { params: { photoId: 'photo-reaction-1' } };

    await sendReactionNotification(change, context);

    // Should batch via Firestore instead of sending immediately
    expect(mockAddReactionToBatch).toHaveBeenCalledWith('photo-reaction-1', 'reactor-1', {
      '\u2764\uFE0F': 1,
    });
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when reactor is the photo owner (self-reaction)', async () => {
    const change = {
      before: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 0,
          reactions: {},
        }),
      },
      after: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 1,
          reactions: {
            'owner-1': { '\u2764\uFE0F': 1 },
          },
        }),
      },
    };

    const context = { params: { photoId: 'photo-self-react' } };

    await sendReactionNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when reactionCount did not increase', async () => {
    const change = {
      before: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 5,
          reactions: { 'reactor-1': { '\u2764\uFE0F': 5 } },
        }),
      },
      after: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 5,
          reactions: { 'reactor-1': { '\u2764\uFE0F': 5 } },
        }),
      },
    };

    const context = { params: { photoId: 'photo-no-change' } };

    await sendReactionNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when owner has no FCM token', async () => {
    setupMockDb({
      users: {
        'owner-1': {
          fcmToken: null,
          displayName: 'Owner',
          notificationPreferences: {},
        },
        'reactor-1': { displayName: 'Reactor' },
      },
    });

    const change = {
      before: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 0,
          reactions: {},
        }),
      },
      after: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 1,
          reactions: {
            'reactor-1': { '\u2764\uFE0F': 1 },
          },
        }),
      },
    };

    const context = { params: { photoId: 'photo-no-token' } };

    await sendReactionNotification(change, context);

    jest.advanceTimersByTime(11000);
    await Promise.resolve();

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when notification preferences disable likes', async () => {
    setupMockDb({
      users: {
        'owner-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Owner',
          notificationPreferences: { likes: false },
        },
        'reactor-1': { displayName: 'Reactor' },
      },
    });

    const change = {
      before: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 0,
          reactions: {},
        }),
      },
      after: {
        data: () => ({
          userId: 'owner-1',
          reactionCount: 1,
          reactions: {
            'reactor-1': { '\u2764\uFE0F': 1 },
          },
        }),
      },
    };

    const context = { params: { photoId: 'photo-prefs-off' } };

    await sendReactionNotification(change, context);

    jest.advanceTimersByTime(11000);
    await Promise.resolve();

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });
});

// ============================================================================
// sendTaggedPhotoNotification (onUpdate - photos)
// ============================================================================
describe('sendTaggedPhotoNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create DM message when user is tagged (no direct push notification)', async () => {
    // The refactored function creates DM messages; onNewMessage handles push.
    // We verify it does NOT call sendPushNotification directly.
    setupMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
          profilePhotoURL: 'https://tagger.photo',
        },
        'tagged-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Tagged User',
          notificationPreferences: {},
        },
      },
    });

    const change = {
      before: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: [],
        }),
      },
      after: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagged-1'],
          imageURL: 'https://photo.url/test.jpg',
        }),
      },
    };

    const context = { params: { photoId: 'photo-tag-1' } };

    await sendTaggedPhotoNotification(change, context);

    // sendPushNotification should NOT be called directly (onNewMessage handles it)
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when no new tags are added', async () => {
    const change = {
      before: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagged-1'],
        }),
      },
      after: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagged-1'],
        }),
      },
    };

    const context = { params: { photoId: 'photo-tag-no-new' } };

    await sendTaggedPhotoNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip self-tags (tagger tags themselves)', async () => {
    setupMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
          fcmToken: VALID_TOKEN,
          notificationPreferences: {},
        },
      },
    });

    const change = {
      before: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: [],
        }),
      },
      after: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagger-1'],
        }),
      },
    };

    const context = { params: { photoId: 'photo-self-tag' } };

    await sendTaggedPhotoNotification(change, context);

    jest.advanceTimersByTime(31000);
    await Promise.resolve();

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when tagged user has no FCM token', async () => {
    setupMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
        },
        'tagged-1': {
          fcmToken: null,
          displayName: 'Tagged User',
          notificationPreferences: {},
        },
      },
    });

    const change = {
      before: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: [],
        }),
      },
      after: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagged-1'],
        }),
      },
    };

    const context = { params: { photoId: 'photo-tag-no-token' } };

    await sendTaggedPhotoNotification(change, context);

    jest.advanceTimersByTime(31000);
    await Promise.resolve();

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when photo is deleted', async () => {
    const change = {
      before: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: [],
          photoState: 'journal',
        }),
      },
      after: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagged-1'],
          photoState: 'deleted',
        }),
      },
    };

    const context = { params: { photoId: 'photo-tag-deleted' } };

    await sendTaggedPhotoNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when tags notification preference is disabled', async () => {
    setupMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
        },
        'tagged-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Tagged User',
          notificationPreferences: { tags: false },
        },
      },
    });

    const change = {
      before: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: [],
        }),
      },
      after: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagged-1'],
        }),
      },
    };

    const context = { params: { photoId: 'photo-tag-prefs-off' } };

    await sendTaggedPhotoNotification(change, context);

    jest.advanceTimersByTime(31000);
    await Promise.resolve();

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });
});

// ============================================================================
// sendCommentNotification (onCreate - comments subcollection)
// ============================================================================
describe('sendCommentNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send notification to photo owner when someone comments', async () => {
    const notifMock = { add: jest.fn().mockResolvedValue({ id: 'n-1' }) };
    setupMockDb({
      users: {
        'commenter-1': {
          displayName: 'Commenter',
          username: 'commenter',
          profilePhotoURL: 'https://commenter.photo',
        },
        'owner-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Owner',
          notificationPreferences: {},
        },
      },
      photoDoc: {
        exists: true,
        data: () => ({ userId: 'owner-1' }),
      },
      notifications: notifMock,
    });

    const snap = {
      data: () => ({
        userId: 'commenter-1',
        text: 'Great photo!',
      }),
    };

    const context = { params: { photoId: 'photo-comment-1', commentId: 'comment-1' } };

    await sendCommentNotification(snap, context);

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Commenter',
      expect.stringContaining('commented on your photo'),
      expect.objectContaining({ type: 'comment', photoId: 'photo-comment-1' }),
      'owner-1'
    );
  });

  it('should skip when commenter is the photo owner (self-comment)', async () => {
    setupMockDb({
      users: {
        'owner-1': {
          displayName: 'Owner',
          fcmToken: VALID_TOKEN,
          notificationPreferences: {},
        },
      },
      photoDoc: {
        exists: true,
        data: () => ({ userId: 'owner-1' }),
      },
    });

    const snap = {
      data: () => ({
        userId: 'owner-1',
        text: 'My own comment',
      }),
    };

    const context = { params: { photoId: 'photo-self-comment', commentId: 'comment-2' } };

    const result = await sendCommentNotification(snap, context);

    // sendPushNotification should NOT be called for comment notification
    // (it might be called for mentions though)
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when photo owner has no FCM token', async () => {
    setupMockDb({
      users: {
        'commenter-1': {
          displayName: 'Commenter',
          username: 'commenter',
        },
        'owner-1': {
          fcmToken: null,
          displayName: 'Owner',
          notificationPreferences: {},
        },
      },
      photoDoc: {
        exists: true,
        data: () => ({ userId: 'owner-1' }),
      },
    });

    const snap = {
      data: () => ({
        userId: 'commenter-1',
        text: 'Nice!',
      }),
    };

    const context = { params: { photoId: 'photo-no-token', commentId: 'comment-3' } };

    await sendCommentNotification(snap, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should process @mentions in comment text', async () => {
    const notifMock = { add: jest.fn().mockResolvedValue({ id: 'n-1' }) };
    setupMockDb({
      users: {
        'commenter-1': {
          displayName: 'Commenter',
          username: 'commenter',
          profilePhotoURL: 'https://commenter.photo',
        },
        'owner-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Owner',
          notificationPreferences: {},
        },
        'mentioned-1': {
          fcmToken: 'ExponentPushToken[mentioned-token]',
          displayName: 'Mentioned User',
          notificationPreferences: {},
        },
      },
      photoDoc: {
        exists: true,
        data: () => ({ userId: 'owner-1' }),
      },
      userQueryResult: {
        docs: [
          {
            id: 'mentioned-1',
            data: () => ({
              fcmToken: 'ExponentPushToken[mentioned-token]',
              displayName: 'Mentioned User',
              notificationPreferences: {},
            }),
          },
        ],
        empty: false,
      },
      notifications: notifMock,
    });

    const snap = {
      data: () => ({
        userId: 'commenter-1',
        text: 'Hey @mentioneduser check this out!',
      }),
    };

    const context = { params: { photoId: 'photo-mention', commentId: 'comment-4' } };

    await sendCommentNotification(snap, context);

    // Should be called twice: once for comment, once for mention
    expect(mockSendPushNotification).toHaveBeenCalledTimes(2);

    // Verify mention notification
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'ExponentPushToken[mentioned-token]',
      'Commenter',
      'mentioned you in a comment',
      expect.objectContaining({ type: 'mention' }),
      'mentioned-1'
    );
  });

  it('should handle GIF comments with no text', async () => {
    const notifMock = { add: jest.fn().mockResolvedValue({ id: 'n-1' }) };
    setupMockDb({
      users: {
        'commenter-1': {
          displayName: 'Commenter',
          username: 'commenter',
        },
        'owner-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Owner',
          notificationPreferences: {},
        },
      },
      photoDoc: {
        exists: true,
        data: () => ({ userId: 'owner-1' }),
      },
      notifications: notifMock,
    });

    const snap = {
      data: () => ({
        userId: 'commenter-1',
        text: '',
        mediaType: 'gif',
      }),
    };

    const context = { params: { photoId: 'photo-gif', commentId: 'comment-gif' } };

    await sendCommentNotification(snap, context);

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Commenter',
      expect.stringContaining('sent a GIF'),
      expect.objectContaining({ type: 'comment' }),
      'owner-1'
    );
  });

  it('should skip comment notification for replies but still process mentions', async () => {
    setupMockDb({
      users: {
        'commenter-1': {
          displayName: 'Commenter',
          username: 'commenter',
        },
        'owner-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Owner',
          notificationPreferences: {},
        },
      },
      photoDoc: {
        exists: true,
        data: () => ({ userId: 'owner-1' }),
      },
    });

    const snap = {
      data: () => ({
        userId: 'commenter-1',
        text: 'This is a reply',
        parentId: 'parent-comment-1',
      }),
    };

    const context = { params: { photoId: 'photo-reply', commentId: 'comment-reply' } };

    await sendCommentNotification(snap, context);

    // Should NOT send comment notification for replies
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should return null when comment data is invalid', async () => {
    const snap = {
      data: () => null,
    };

    const context = { params: { photoId: 'photo-invalid', commentId: 'comment-invalid' } };

    const result = await sendCommentNotification(snap, context);

    expect(result).toBeNull();
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });
});

// ============================================================================
// sendPhotoRevealNotification (onUpdate - darkrooms)
// ============================================================================
describe('sendPhotoRevealNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send notification when photos are revealed', async () => {
    setupMockDb({
      users: {
        'user-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'User',
          notificationPreferences: {},
        },
      },
      photos: {
        docs: [
          {
            data: () => ({
              status: 'revealed',
              revealedAt: { toMillis: () => 5000 },
            }),
          },
          {
            data: () => ({
              status: 'revealed',
              revealedAt: { toMillis: () => 5001 },
            }),
          },
        ],
        empty: false,
        size: 2,
      },
    });

    const change = {
      before: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 1000 },
          lastNotifiedAt: null,
        }),
      },
      after: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 5000 },
          lastNotifiedAt: null,
        }),
      },
    };

    const context = { params: { userId: 'user-1' } };

    await sendPhotoRevealNotification(change, context);

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Flick',
      expect.stringContaining('photos are ready to reveal'),
      expect.objectContaining({ type: 'photo_reveal' }),
      'user-1'
    );
  });

  it('should send singular message when only one photo is revealed', async () => {
    setupMockDb({
      users: {
        'user-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'User',
          notificationPreferences: {},
        },
      },
      photos: {
        docs: [
          {
            data: () => ({
              status: 'revealed',
              revealedAt: { toMillis: () => 5000 },
            }),
          },
        ],
        empty: false,
        size: 1,
      },
    });

    const change = {
      before: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 1000 },
          lastNotifiedAt: null,
        }),
      },
      after: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 5000 },
          lastNotifiedAt: null,
        }),
      },
    };

    const context = { params: { userId: 'user-1' } };

    await sendPhotoRevealNotification(change, context);

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Flick',
      'Your photo is ready to reveal!',
      expect.objectContaining({ type: 'photo_reveal' }),
      'user-1'
    );
  });

  it('should skip when lastRevealedAt did not change', async () => {
    const change = {
      before: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 5000 },
          lastNotifiedAt: null,
        }),
      },
      after: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 5000 },
          lastNotifiedAt: null,
        }),
      },
    };

    const context = { params: { userId: 'user-1' } };

    await sendPhotoRevealNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when already notified for this batch', async () => {
    const change = {
      before: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 1000 },
          lastNotifiedAt: null,
        }),
      },
      after: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 5000 },
          lastNotifiedAt: { toMillis: () => 6000 },
        }),
      },
    };

    const context = { params: { userId: 'user-1' } };

    await sendPhotoRevealNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when user has no FCM token', async () => {
    setupMockDb({
      users: {
        'user-1': {
          fcmToken: null,
          displayName: 'User',
          notificationPreferences: {},
        },
      },
      photos: {
        docs: [
          {
            data: () => ({
              status: 'revealed',
              revealedAt: { toMillis: () => 5000 },
            }),
          },
        ],
        empty: false,
        size: 1,
      },
    });

    const change = {
      before: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 1000 },
          lastNotifiedAt: null,
        }),
      },
      after: {
        data: () => ({
          lastRevealedAt: { toMillis: () => 5000 },
          lastNotifiedAt: null,
        }),
      },
    };

    const context = { params: { userId: 'user-1' } };

    await sendPhotoRevealNotification(change, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('should skip when after data is invalid', async () => {
    const change = {
      before: { data: () => ({ lastRevealedAt: { toMillis: () => 1000 } }) },
      after: { data: () => null },
    };

    const context = { params: { userId: 'user-1' } };

    const result = await sendPhotoRevealNotification(change, context);

    expect(result).toBeNull();
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });
});

// ============================================================================
// onNewMessage - Reaction handling (onCreate - messages subcollection)
// ============================================================================
describe('onNewMessage - reaction handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper: set up mockDb for onNewMessage trigger tests.
   * Configures the conversation doc update mock and user lookups.
   */
  function setupOnNewMessageMockDb({ users = {} } = {}) {
    const mockConvUpdate = jest.fn().mockResolvedValue();
    const mockConvRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
      update: mockConvUpdate,
    };

    mockDb.doc.mockImplementation(path => {
      if (path.startsWith('conversations/')) {
        return mockConvRef;
      }
      return {
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
      };
    });

    mockDb.collection.mockImplementation(collectionName => ({
      doc: jest.fn(docId => {
        if (collectionName === 'users' && users[docId]) {
          return {
            get: jest.fn().mockResolvedValue({
              exists: true,
              id: docId,
              data: () => users[docId],
            }),
          };
        }
        return {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        };
      }),
    }));

    return { mockConvUpdate };
  }

  it('should not update lastMessage or unreadCount for reaction messages', async () => {
    const { mockConvUpdate } = setupOnNewMessageMockDb({
      users: {
        'recipient-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Recipient',
          notificationPreferences: {},
        },
        'sender-1': {
          displayName: 'Sender',
          username: 'sender',
        },
      },
    });

    const snapshot = {
      data: () => ({
        senderId: 'sender-1',
        type: 'reaction',
        emoji: 'heart',
        targetMessageId: 'target-msg-1',
        text: null,
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'recipient-1_sender-1',
        messageId: 'reaction-msg-1',
      },
    };

    await onNewMessage(snapshot, context);

    // convRef.update should NOT have been called (no lastMessage/unreadCount update)
    expect(mockConvUpdate).not.toHaveBeenCalled();
  });

  it('should send push notification with emoji character for reaction messages', async () => {
    setupOnNewMessageMockDb({
      users: {
        'recipient-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Recipient',
          notificationPreferences: {},
        },
        'sender-1': {
          displayName: 'Sender',
          username: 'sender',
          photoURL: 'https://sender.photo',
        },
      },
    });

    const snapshot = {
      data: () => ({
        senderId: 'sender-1',
        type: 'reaction',
        emoji: 'heart',
        targetMessageId: 'target-msg-1',
        text: null,
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'recipient-1_sender-1',
        messageId: 'reaction-msg-1',
      },
    };

    await onNewMessage(snapshot, context);

    // Should send notification with emoji in body
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Sender',
      expect.stringContaining('Reacted'),
      expect.objectContaining({
        type: 'direct_message',
        conversationId: 'recipient-1_sender-1',
      }),
      'recipient-1'
    );

    // Verify the body contains the heart emoji character
    const callArgs = mockSendPushNotification.mock.calls[0];
    expect(callArgs[2]).toContain('\u2764\uFE0F');
  });

  it('should return early for reaction removal (emoji: null) without sending notification', async () => {
    setupOnNewMessageMockDb({
      users: {
        'recipient-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Recipient',
          notificationPreferences: {},
        },
        'sender-1': {
          displayName: 'Sender',
        },
      },
    });

    const snapshot = {
      data: () => ({
        senderId: 'sender-1',
        type: 'reaction',
        emoji: null,
        targetMessageId: 'target-msg-1',
        text: null,
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'recipient-1_sender-1',
        messageId: 'reaction-removal-1',
      },
    };

    const result = await onNewMessage(snapshot, context);

    expect(result).toBeNull();
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });
});

// ============================================================================
// sendTaggedPhotoNotification - DM message creation (Phase 05)
// ============================================================================
describe('sendTaggedPhotoNotification - DM message creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper: set up mockDb for the refactored sendTaggedPhotoNotification.
   * The function now creates DM messages instead of activity notifications.
   * It queries blocks, gets/creates conversations, and adds messages to subcollections.
   */
  function setupTagDmMockDb(config = {}) {
    const {
      users = {},
      blockQueryResult = { empty: true, docs: [] },
      conversationExists = false,
    } = config;

    // Track message creation calls
    const mockMessageAdd = jest.fn().mockResolvedValue({ id: 'mock-message-id' });
    const mockConvSet = jest.fn().mockResolvedValue();

    // Track conversation doc refs for assertion
    const convDocRef = {
      get: jest.fn().mockResolvedValue({
        exists: conversationExists,
        data: () => (conversationExists ? { participants: [] } : null),
      }),
      set: mockConvSet,
      update: jest.fn().mockResolvedValue(),
    };

    // Mock db.doc() for conversation path
    mockDb.doc.mockImplementation(path => {
      if (path.startsWith('conversations/')) {
        return convDocRef;
      }
      return {
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        set: jest.fn().mockResolvedValue(),
        update: jest.fn().mockResolvedValue(),
      };
    });

    // Track where().where().limit().get() for blocks collection
    let currentCollection = null;

    mockDb.collection.mockImplementation(collectionName => {
      currentCollection = collectionName;

      const mockMessagesSubcollection = {
        add: mockMessageAdd,
      };

      const collectionRef = {
        doc: jest.fn(docId => {
          if (collectionName === 'users' && users[docId]) {
            return {
              get: jest.fn().mockResolvedValue({
                exists: true,
                id: docId,
                data: () => users[docId],
              }),
            };
          }
          if (collectionName === 'conversations') {
            return {
              get: convDocRef.get,
              set: mockConvSet,
              update: jest.fn().mockResolvedValue(),
              collection: jest.fn(subName => {
                if (subName === 'messages') {
                  return mockMessagesSubcollection;
                }
                return { add: jest.fn().mockResolvedValue({ id: 'mock-id' }) };
              }),
            };
          }
          return {
            get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
          };
        }),
        add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(() => {
          if (currentCollection === 'blocks') {
            return Promise.resolve(blockQueryResult);
          }
          return Promise.resolve({ empty: true, docs: [] });
        }),
      };

      return collectionRef;
    });

    return { mockMessageAdd, mockConvSet };
  }

  it('creates DM message for each newly tagged user', async () => {
    const { mockMessageAdd } = setupTagDmMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
          profilePhotoURL: 'https://tagger.photo',
        },
        'tagged-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Tagged User',
          notificationPreferences: {},
        },
      },
    });

    const change = {
      before: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: [],
        }),
      },
      after: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagged-1'],
          imageURL: 'https://photo.url/test.jpg',
        }),
      },
    };

    const context = { params: { photoId: 'photo-dm-1' } };

    await sendTaggedPhotoNotification(change, context);

    // Should create a message in the conversation
    expect(mockMessageAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: 'tagger-1',
        type: 'tagged_photo',
        text: null,
        gifUrl: null,
        imageUrl: null,
        photoId: 'photo-dm-1',
        photoURL: 'https://photo.url/test.jpg',
        photoOwnerId: 'tagger-1',
      })
    );
  });

  it('auto-creates conversation if none exists', async () => {
    const { mockConvSet } = setupTagDmMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
        },
        'tagged-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Tagged User',
          notificationPreferences: {},
        },
      },
      conversationExists: false,
    });

    const change = {
      before: { data: () => ({ userId: 'tagger-1', taggedUserIds: [] }) },
      after: {
        data: () => ({ userId: 'tagger-1', taggedUserIds: ['tagged-1'], imageURL: null }),
      },
    };

    const context = { params: { photoId: 'photo-conv-create' } };

    await sendTaggedPhotoNotification(change, context);

    // Should create the conversation doc since it does not exist
    expect(mockConvSet).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: expect.arrayContaining(['tagger-1', 'tagged-1']),
        lastMessage: null,
      })
    );
  });

  it('skips blocked users', async () => {
    const { mockMessageAdd } = setupTagDmMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
        },
        'tagged-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Tagged User',
          notificationPreferences: {},
        },
      },
      blockQueryResult: {
        empty: false,
        docs: [{ id: 'block-1', data: () => ({ blockerId: 'tagged-1', blockedId: 'tagger-1' }) }],
      },
    });

    const change = {
      before: { data: () => ({ userId: 'tagger-1', taggedUserIds: [] }) },
      after: {
        data: () => ({ userId: 'tagger-1', taggedUserIds: ['tagged-1'], imageURL: null }),
      },
    };

    const context = { params: { photoId: 'photo-blocked' } };

    await sendTaggedPhotoNotification(change, context);

    // Should NOT create a message for blocked user
    expect(mockMessageAdd).not.toHaveBeenCalled();
  });

  it('does NOT write to notifications collection', async () => {
    const notifAdd = jest.fn().mockResolvedValue({ id: 'notif-id' });

    setupTagDmMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
        },
        'tagged-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Tagged User',
          notificationPreferences: {},
        },
      },
    });

    // Override the notifications collection to track add calls
    const originalImpl = mockDb.collection.getMockImplementation();
    mockDb.collection.mockImplementation(name => {
      if (name === 'notifications') {
        return { add: notifAdd };
      }
      return originalImpl(name);
    });

    const change = {
      before: { data: () => ({ userId: 'tagger-1', taggedUserIds: [] }) },
      after: {
        data: () => ({ userId: 'tagger-1', taggedUserIds: ['tagged-1'], imageURL: null }),
      },
    };

    const context = { params: { photoId: 'photo-no-notif' } };

    await sendTaggedPhotoNotification(change, context);

    // notifications.add should NOT be called (DM messages replace activity notifications)
    expect(notifAdd).not.toHaveBeenCalled();
  });

  it('does NOT call sendPushNotification directly', async () => {
    setupTagDmMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
        },
        'tagged-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Tagged User',
          notificationPreferences: {},
        },
      },
    });

    const change = {
      before: { data: () => ({ userId: 'tagger-1', taggedUserIds: [] }) },
      after: {
        data: () => ({ userId: 'tagger-1', taggedUserIds: ['tagged-1'], imageURL: null }),
      },
    };

    const context = { params: { photoId: 'photo-no-push' } };

    await sendTaggedPhotoNotification(change, context);

    // sendPushNotification should NOT be called (onNewMessage handles it)
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('processes tagged users concurrently with Promise.allSettled', async () => {
    // Set up two tagged users, one of which will fail
    const mockMessageAdd = jest.fn();
    let callCount = 0;
    mockMessageAdd.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Simulated failure'));
      }
      return Promise.resolve({ id: 'mock-message-id' });
    });

    const users = {
      'tagger-1': { displayName: 'Tagger', username: 'tagger' },
      'tagged-1': {
        fcmToken: VALID_TOKEN,
        displayName: 'Tagged 1',
        notificationPreferences: {},
      },
      'tagged-2': {
        fcmToken: VALID_TOKEN,
        displayName: 'Tagged 2',
        notificationPreferences: {},
      },
    };

    // Manual mock setup for concurrent test
    mockDb.doc.mockImplementation(path => ({
      get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
      set: jest.fn().mockResolvedValue(),
      update: jest.fn().mockResolvedValue(),
    }));

    mockDb.collection.mockImplementation(collectionName => ({
      doc: jest.fn(docId => {
        if (collectionName === 'users' && users[docId]) {
          return {
            get: jest.fn().mockResolvedValue({
              exists: true,
              id: docId,
              data: () => users[docId],
            }),
          };
        }
        if (collectionName === 'conversations') {
          return {
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
            set: jest.fn().mockResolvedValue(),
            update: jest.fn().mockResolvedValue(),
            collection: jest.fn(() => ({
              add: mockMessageAdd,
            })),
          };
        }
        return {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        };
      }),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    }));

    const change = {
      before: { data: () => ({ userId: 'tagger-1', taggedUserIds: [] }) },
      after: {
        data: () => ({
          userId: 'tagger-1',
          taggedUserIds: ['tagged-1', 'tagged-2'],
          imageURL: null,
        }),
      },
    };

    const context = { params: { photoId: 'photo-concurrent' } };

    // Should not throw even though one user fails
    await sendTaggedPhotoNotification(change, context);

    // Both users should have been attempted (Promise.allSettled processes all)
    expect(mockMessageAdd).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// onNewMessage - tagged_photo handling (Phase 05)
// ============================================================================
describe('onNewMessage - tagged_photo handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper: set up mockDb for onNewMessage tagged_photo tests.
   */
  function setupOnNewMessageTaggedMockDb({ users = {} } = {}) {
    const mockConvUpdate = jest.fn().mockResolvedValue();
    const mockConvRef = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
      update: mockConvUpdate,
    };

    mockDb.doc.mockImplementation(path => {
      if (path.startsWith('conversations/')) {
        return mockConvRef;
      }
      return {
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
      };
    });

    mockDb.collection.mockImplementation(collectionName => ({
      doc: jest.fn(docId => {
        if (collectionName === 'users' && users[docId]) {
          return {
            get: jest.fn().mockResolvedValue({
              exists: true,
              id: docId,
              data: () => users[docId],
            }),
          };
        }
        return {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        };
      }),
    }));

    return { mockConvUpdate };
  }

  it('sets lastMessage text to "Tagged you in a photo" for tagged_photo type', async () => {
    const { mockConvUpdate } = setupOnNewMessageTaggedMockDb({
      users: {
        'recipient-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Recipient',
          notificationPreferences: {},
        },
        'sender-1': {
          displayName: 'Sender',
          username: 'sender',
          photoURL: null,
        },
      },
    });

    const snapshot = {
      data: () => ({
        senderId: 'sender-1',
        type: 'tagged_photo',
        text: null,
        photoId: 'photo-123',
        photoURL: 'https://photo.url',
        photoOwnerId: 'sender-1',
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'recipient-1_sender-1',
        messageId: 'tagged-msg-1',
      },
    };

    await onNewMessage(snapshot, context);

    expect(mockConvUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lastMessage: expect.objectContaining({
          text: 'Tagged you in a photo',
          type: 'tagged_photo',
          senderId: 'sender-1',
        }),
      })
    );
  });

  it('sends push notification with "Tagged you in a photo" body for tagged_photo type', async () => {
    setupOnNewMessageTaggedMockDb({
      users: {
        'recipient-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Recipient',
          notificationPreferences: {},
        },
        'sender-1': {
          displayName: 'Sender',
          username: 'sender',
          photoURL: 'https://sender.photo',
        },
      },
    });

    const snapshot = {
      data: () => ({
        senderId: 'sender-1',
        type: 'tagged_photo',
        text: null,
        photoId: 'photo-123',
        photoURL: 'https://photo.url',
        photoOwnerId: 'sender-1',
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'recipient-1_sender-1',
        messageId: 'tagged-msg-2',
      },
    };

    await onNewMessage(snapshot, context);

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Sender',
      'Tagged you in a photo',
      expect.objectContaining({
        type: 'tagged_photo',
        conversationId: 'recipient-1_sender-1',
      }),
      'recipient-1'
    );
  });

  it('sets notification data type to "tagged_photo"', async () => {
    setupOnNewMessageTaggedMockDb({
      users: {
        'recipient-1': {
          fcmToken: VALID_TOKEN,
          displayName: 'Recipient',
          notificationPreferences: {},
        },
        'sender-1': {
          displayName: 'Sender',
          username: 'sender',
          photoURL: null,
        },
      },
    });

    const snapshot = {
      data: () => ({
        senderId: 'sender-1',
        type: 'tagged_photo',
        text: null,
        photoId: 'photo-456',
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'recipient-1_sender-1',
        messageId: 'tagged-msg-3',
      },
    };

    await onNewMessage(snapshot, context);

    // Verify the notification data has type 'tagged_photo' (not 'direct_message')
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ type: 'tagged_photo' }),
      expect.anything()
    );
  });
});
