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
      'Flick',
      expect.stringContaining('Sender User'),
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
      'Flick',
      expect.stringContaining('Acceptor'),
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

  it('should send notification immediately when user is tagged', async () => {
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
        }),
      },
    };

    const context = { params: { photoId: 'photo-tag-1' } };

    await sendTaggedPhotoNotification(change, context);

    // Notification is sent immediately (no debouncing)
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Flick',
      expect.stringContaining('Tagger'),
      expect.objectContaining({ type: 'tagged', photoId: 'photo-tag-1' }),
      'tagged-1'
    );
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
      'Flick',
      expect.stringContaining('Commenter'),
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
      'Flick',
      expect.stringContaining('Commenter'),
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
      'Flick',
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
