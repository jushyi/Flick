/**
 * Screenshot Notification Trigger Tests (RED)
 *
 * Tests for onNewMessage handling of system_screenshot message type:
 * 1. Push notification sent to snap sender with type:'screenshot' in notification data
 * 2. Notification preferences respected
 * 3. Conversation metadata updated without incrementing unread count
 *
 * These tests are RED — onNewMessage does not have explicit system_screenshot handling yet.
 * The current fallback treats it as a generic text message (type: 'direct_message' in
 * notification data, increments unreadCount). Plan 08-02 will add dedicated handling.
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

// Mock the notifications/batching module (used by other message types)
const mockAddReactionToBatch = jest.fn().mockResolvedValue();
jest.mock('../../notifications/batching', () => ({
  addReactionToBatch: mockAddReactionToBatch,
  scheduleNotificationTask: jest.fn().mockResolvedValue(),
}));

const { initializeFirestore } = require('firebase-admin/firestore');

// Get the mock db that index.js will use
const mockDb = initializeFirestore();

// Require the onNewMessage handler from index.js
const { onNewMessage } = require('../../index');

// Valid FCM token for tests
const VALID_TOKEN = 'ExponentPushToken[test-token-123]';

/**
 * Helper: set up mockDb for onNewMessage system_screenshot tests.
 * Configures conversation doc, user lookups, and optional notification prefs.
 */
function setupMockDb({ users = {} } = {}) {
  const mockConvUpdate = jest.fn().mockResolvedValue();
  const mockConvRef = {
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({}),
    }),
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

describe('onNewMessage — system_screenshot type', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends push notification to snap sender with type:screenshot in notification data', async () => {
    // user1 = snap sender (should receive notification)
    // user2 = screenshotter (senderId on the system message)
    setupMockDb({
      users: {
        user1: {
          fcmToken: VALID_TOKEN,
          displayName: 'SnapSender',
          notificationPreferences: {},
        },
        user2: {
          displayName: 'Alex',
          username: 'alex',
          photoURL: 'https://photo.example.com/alex.jpg',
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
        gifUrl: null,
        imageUrl: null,
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'user1_user2',
        messageId: 'sys-msg-1',
      },
    };

    await onNewMessage(snapshot, context);

    // Push notification should be sent to user1 (snap sender)
    // with type:'screenshot' in notification data (not 'direct_message')
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      expect.any(String),
      expect.stringContaining('screenshotted'),
      expect.objectContaining({
        type: 'screenshot',
        conversationId: 'user1_user2',
      }),
      'user1'
    );
  });

  it('does NOT send notification if recipient has notifications disabled', async () => {
    // user1 = snap sender with notifications disabled
    // user2 = screenshotter
    setupMockDb({
      users: {
        user1: {
          fcmToken: VALID_TOKEN,
          displayName: 'SnapSender',
          notificationPreferences: {
            enabled: false,
          },
        },
        user2: {
          displayName: 'Alex',
          username: 'alex',
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
        gifUrl: null,
        imageUrl: null,
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'user1_user2',
        messageId: 'sys-msg-2',
      },
    };

    await onNewMessage(snapshot, context);

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('updates conversation lastMessage but does NOT increment unreadCount for system_screenshot', async () => {
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
    });

    const snapshot = {
      data: () => ({
        senderId: 'user2',
        type: 'system_screenshot',
        text: 'Alex screenshotted a snap',
        screenshotterId: 'user2',
        snapMessageId: 'snap1',
        gifUrl: null,
        imageUrl: null,
        createdAt: { toDate: () => new Date() },
      }),
    };

    const context = {
      params: {
        conversationId: 'user1_user2',
        messageId: 'sys-msg-3',
      },
    };

    await onNewMessage(snapshot, context);

    // Conversation should be updated with lastMessage
    expect(mockConvUpdate).toHaveBeenCalled();
    const updateArg = mockConvUpdate.mock.calls[0][0];

    // lastMessage should contain the screenshot text
    expect(updateArg.lastMessage).toBeDefined();
    expect(updateArg.lastMessage.type).toBe('system_screenshot');

    // unreadCount should NOT be incremented (system messages are informational)
    expect(updateArg['unreadCount.user1']).toBeUndefined();
  });
});
