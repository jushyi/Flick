/**
 * Screenshot Notification Trigger Tests (RED - Wave 0)
 *
 * Tests for onNewMessage handling of system_screenshot message type:
 * 1. Push notification to snap sender (not screenshotter)
 * 2. Muted conversation skip
 * 3. Conversation lastMessage update with system text
 *
 * These tests are expected to FAIL (RED) because onNewMessage does not
 * handle system_screenshot type yet. Implementation comes in Plan 08-02.
 */

// Mock the notifications/sender module BEFORE requiring index.js
const mockSendPushNotification = jest.fn().mockResolvedValue({ success: true, tickets: [] });
jest.mock('../../notifications/sender', () => ({
  sendPushNotification: mockSendPushNotification,
  sendBatchNotifications: jest.fn().mockResolvedValue([]),
  expo: {
    sendPushNotificationsAsync: jest.fn(),
    chunkPushNotifications: jest.fn(msgs => [msgs]),
  },
}));

// Mock the notifications/batching module
const mockAddReactionToBatch = jest.fn().mockResolvedValue();
jest.mock('../../notifications/batching', () => ({
  addReactionToBatch: mockAddReactionToBatch,
  scheduleNotificationTask: jest.fn().mockResolvedValue(),
}));

const { initializeFirestore } = require('firebase-admin/firestore');

// Get the mock db that index.js will use
const mockDb = initializeFirestore();

// Require the functions
const { onNewMessage } = require('../../index');

// Valid FCM token for tests
const VALID_TOKEN = 'ExponentPushToken[test-token-123]';

/**
 * Helper: configure mockDb for onNewMessage system_screenshot tests.
 * Sets up user lookups and conversation document access.
 */
function setupMockDb(config = {}) {
  const { users = {}, conversations = {} } = config;

  const mockConvUpdate = jest.fn().mockResolvedValue();

  mockDb.doc.mockImplementation(path => {
    // Handle conversation doc path: conversations/{conversationId}
    if (path.startsWith('conversations/')) {
      const convId = path.split('/')[1];
      const convData = conversations[convId] || { participants: [] };
      return {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => convData,
        }),
        update: mockConvUpdate,
      };
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

// ============================================================================
// onNewMessage - system_screenshot type
// ============================================================================
describe('onNewMessage - system_screenshot type', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends push notification to snap sender (not screenshotter) for system_screenshot messages', async () => {
    const { mockConvUpdate } = setupMockDb({
      users: {
        user1: {
          fcmToken: VALID_TOKEN,
          displayName: 'SnapSender',
          notificationPreferences: {},
        },
        user2: {
          displayName: 'Alex',
          username: 'alex',
          photoURL: 'https://alex.photo',
        },
      },
      conversations: {
        user1_user2: {
          participants: ['user1', 'user2'],
        },
      },
    });

    // system_screenshot message: senderId is the screenshotter (user2),
    // but the notification should go to the snap sender (user1)
    const snapshot = {
      data: () => ({
        senderId: 'user2',
        type: 'system_screenshot',
        text: 'Alex screenshotted a snap',
        screenshotterId: 'user2',
        snapMessageId: 'snap1',
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'user1_user2',
        messageId: 'screenshot-msg-1',
      },
    };

    await onNewMessage(snapshot, context);

    // Should notify user1 (the snap sender / recipient of screenshot info)
    // The notification data type must be 'system_screenshot' (not 'direct_message')
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      expect.any(String),
      expect.stringContaining('screenshot'),
      expect.objectContaining({
        type: 'system_screenshot',
        conversationId: 'user1_user2',
      }),
      'user1'
    );
  });

  it('does NOT send notification if conversation is muted by recipient', async () => {
    setupMockDb({
      users: {
        user1: {
          fcmToken: VALID_TOKEN,
          displayName: 'SnapSender',
          notificationPreferences: {},
          // user1 has muted the conversation
        },
        user2: {
          displayName: 'Alex',
          username: 'alex',
        },
      },
      conversations: {
        user1_user2: {
          participants: ['user1', 'user2'],
          mutedBy: ['user1'],
        },
      },
    });

    const snapshot = {
      data: () => ({
        senderId: 'user2',
        type: 'system_screenshot',
        text: 'Alex screenshotted a snap',
        screenshotterId: 'user2',
        snapMessageId: 'snap1',
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'user1_user2',
        messageId: 'screenshot-msg-2',
      },
    };

    await onNewMessage(snapshot, context);

    // Should NOT send notification because user1 muted the conversation
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('updates conversation lastMessage preview with the system message text', async () => {
    const { mockConvUpdate } = setupMockDb({
      users: {
        user1: {
          fcmToken: VALID_TOKEN,
          displayName: 'SnapSender',
          notificationPreferences: {},
        },
        user2: {
          displayName: 'Alex',
          username: 'alex',
        },
      },
      conversations: {
        user1_user2: {
          participants: ['user1', 'user2'],
        },
      },
    });

    const snapshot = {
      data: () => ({
        senderId: 'user2',
        type: 'system_screenshot',
        text: 'Alex screenshotted a snap',
        screenshotterId: 'user2',
        snapMessageId: 'snap1',
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'user1_user2',
        messageId: 'screenshot-msg-3',
      },
    };

    await onNewMessage(snapshot, context);

    // Should update conversation lastMessage with screenshot text
    expect(mockConvUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lastMessage: expect.objectContaining({
          text: expect.stringContaining('screenshot'),
          type: 'system_screenshot',
          senderId: 'user2',
        }),
        updatedAt: expect.anything(),
      })
    );

    // system_screenshot should NOT increment unread count
    const updateArg = mockConvUpdate.mock.calls[0][0];
    const unreadKey = 'unreadCount.user1';
    expect(Object.keys(updateArg)).not.toContain(unreadKey);
  });
});
