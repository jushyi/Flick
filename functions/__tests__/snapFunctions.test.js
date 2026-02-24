/**
 * Snap Cloud Functions Tests
 *
 * Tests for snap-related Cloud Functions:
 * 1. getSignedSnapUrl - Callable: auth, path validation, signed URL generation
 * 2. onSnapViewed - Trigger: guard conditions, Storage file deletion
 * 3. cleanupExpiredSnaps - Scheduled: query construction, batch deletion
 * 4. onNewMessage snap handling - lastMessage preview and push notification
 */

// Mock the notifications/sender module BEFORE requiring index.js
const mockSendPushNotification = jest.fn().mockResolvedValue({ success: true, tickets: [] });
jest.mock('../notifications/sender', () => ({
  sendPushNotification: mockSendPushNotification,
  sendBatchNotifications: jest.fn().mockResolvedValue([]),
  expo: {
    sendPushNotificationsAsync: jest.fn(),
    chunkPushNotifications: jest.fn(msgs => [msgs]),
  },
}));

// Mock the notifications/batching module
jest.mock('../notifications/batching', () => ({
  addReactionToBatch: jest.fn().mockResolvedValue(),
  scheduleNotificationTask: jest.fn().mockResolvedValue(),
}));

const { initializeFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Get the singleton mock db and storage
const mockDb = initializeFirestore();
const mockStorage = getStorage();
const mockBucket = mockStorage.bucket();

// Require the functions (handlers are returned directly by mocks)
const { getSignedSnapUrl, onSnapViewed, cleanupExpiredSnaps, onNewMessage } = require('../index');

// Valid FCM token for tests
const VALID_TOKEN = 'ExponentPushToken[test-token-123]';

/**
 * Helper: configure mockDb for snap function tests
 */
function setupMockDb(config = {}) {
  const { users = {}, conversationDoc = null } = config;

  const mockDocGet = (collectionName, docId) => {
    if (collectionName === 'users' && users[docId]) {
      return Promise.resolve({
        exists: true,
        id: docId,
        data: () => users[docId],
        ref: { id: docId },
      });
    }
    if (collectionName === 'conversations' && conversationDoc) {
      return Promise.resolve(conversationDoc);
    }
    return Promise.resolve({
      exists: false,
      id: docId,
      data: () => null,
      ref: { id: docId },
    });
  };

  mockDb.collection.mockImplementation(collectionName => {
    const mockDocObj = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(),
      update: jest.fn().mockResolvedValue(),
      delete: jest.fn().mockResolvedValue(),
    };

    return {
      doc: jest.fn(docId => {
        mockDocObj.get.mockImplementation(() => mockDocGet(collectionName, docId));
        return mockDocObj;
      }),
      add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };
  });

  mockDb.doc.mockImplementation(path => {
    const parts = path.split('/');
    const collectionName = parts[0];
    const docId = parts[1];

    return {
      get: jest.fn(() => mockDocGet(collectionName, docId)),
      set: jest.fn().mockResolvedValue(),
      update: jest.fn().mockResolvedValue(),
      delete: jest.fn().mockResolvedValue(),
    };
  });

  return mockDb;
}

describe('Snap Cloud Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // getSignedSnapUrl
  // ==========================================================================
  describe('getSignedSnapUrl', () => {
    it('should reject unauthenticated requests', async () => {
      const request = { auth: null, data: { snapStoragePath: 'snap-photos/user/snap.jpg' } };

      await expect(getSignedSnapUrl(request)).rejects.toThrow('User must be authenticated');
    });

    it('should reject missing snapStoragePath', async () => {
      const request = { auth: { uid: 'user-123' }, data: {} };

      await expect(getSignedSnapUrl(request)).rejects.toThrow('snapStoragePath is required');
    });

    it('should reject paths not starting with snap-photos/', async () => {
      const request = {
        auth: { uid: 'user-123' },
        data: { snapStoragePath: 'photos/user/photo.jpg' },
      };

      await expect(getSignedSnapUrl(request)).rejects.toThrow('Path must start with snap-photos/');
    });

    it('should generate signed URL for valid snap path', async () => {
      setupMockDb();

      // Mock file exists and getSignedUrl
      const mockFile = {
        exists: jest.fn().mockResolvedValue([true]),
        getSignedUrl: jest.fn().mockResolvedValue(['https://signed-snap-url.com']),
      };
      mockBucket.file.mockReturnValue(mockFile);

      const request = {
        auth: { uid: 'user-123' },
        data: { snapStoragePath: 'snap-photos/user-123/snap456.jpg' },
      };

      const result = await getSignedSnapUrl(request);

      expect(result.url).toBe('https://signed-snap-url.com');
      expect(mockFile.getSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'v4',
          action: 'read',
        })
      );
      // Verify 5-minute expiry (within reasonable tolerance)
      const callArgs = mockFile.getSignedUrl.mock.calls[0][0];
      const expectedExpiry = Date.now() + 5 * 60 * 1000;
      expect(callArgs.expires).toBeGreaterThan(expectedExpiry - 5000);
      expect(callArgs.expires).toBeLessThan(expectedExpiry + 5000);
    });

    it('should throw not-found when file does not exist', async () => {
      setupMockDb();

      const mockFile = {
        exists: jest.fn().mockResolvedValue([false]),
      };
      mockBucket.file.mockReturnValue(mockFile);

      const request = {
        auth: { uid: 'user-123' },
        data: { snapStoragePath: 'snap-photos/user-123/missing.jpg' },
      };

      await expect(getSignedSnapUrl(request)).rejects.toThrow('Snap photo not found');
    });
  });

  // ==========================================================================
  // onSnapViewed
  // ==========================================================================
  describe('onSnapViewed', () => {
    it('should skip non-snap message types', async () => {
      const change = {
        before: { data: () => ({ type: 'text', viewedAt: null }) },
        after: { data: () => ({ type: 'text', viewedAt: new Date() }) },
      };
      const context = { params: { conversationId: 'conv-123', messageId: 'msg-456' } };

      const result = await onSnapViewed(change, context);
      expect(result).toBeNull();
      expect(mockBucket.file).not.toHaveBeenCalled();
    });

    it('should skip when viewedAt was already set (not null -> timestamp transition)', async () => {
      const change = {
        before: { data: () => ({ type: 'snap', viewedAt: new Date('2026-01-01') }) },
        after: { data: () => ({ type: 'snap', viewedAt: new Date('2026-01-02') }) },
      };
      const context = { params: { conversationId: 'conv-123', messageId: 'msg-456' } };

      const result = await onSnapViewed(change, context);
      expect(result).toBeNull();
      expect(mockBucket.file).not.toHaveBeenCalled();
    });

    it('should skip when viewedAt remains null', async () => {
      const change = {
        before: { data: () => ({ type: 'snap', viewedAt: null, caption: null }) },
        after: { data: () => ({ type: 'snap', viewedAt: null, caption: 'updated' }) },
      };
      const context = { params: { conversationId: 'conv-123', messageId: 'msg-456' } };

      const result = await onSnapViewed(change, context);
      expect(result).toBeNull();
      expect(mockBucket.file).not.toHaveBeenCalled();
    });

    it('should delete Storage file when viewedAt transitions from null to timestamp', async () => {
      const mockDelete = jest.fn().mockResolvedValue();
      mockBucket.file.mockReturnValue({ delete: mockDelete });

      const change = {
        before: { data: () => ({ type: 'snap', viewedAt: null }) },
        after: {
          data: () => ({
            type: 'snap',
            viewedAt: new Date(),
            snapStoragePath: 'snap-photos/user-123/snap456.jpg',
          }),
        },
      };
      const context = { params: { conversationId: 'conv-123', messageId: 'msg-456' } };

      const result = await onSnapViewed(change, context);
      expect(result).toBeNull();
      expect(mockBucket.file).toHaveBeenCalledWith('snap-photos/user-123/snap456.jpg');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle Storage deletion failure gracefully (best-effort)', async () => {
      mockBucket.file.mockReturnValue({
        delete: jest.fn().mockRejectedValue(new Error('Storage error')),
      });

      const change = {
        before: { data: () => ({ type: 'snap', viewedAt: null }) },
        after: {
          data: () => ({
            type: 'snap',
            viewedAt: new Date(),
            snapStoragePath: 'snap-photos/user-123/snap456.jpg',
          }),
        },
      };
      const context = { params: { conversationId: 'conv-123', messageId: 'msg-456' } };

      // Should not throw
      const result = await onSnapViewed(change, context);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // cleanupExpiredSnaps
  // ==========================================================================
  describe('cleanupExpiredSnaps', () => {
    it('should handle empty results (no expired snaps)', async () => {
      mockDb.collectionGroup = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true, size: 0, docs: [] }),
      }));

      const result = await cleanupExpiredSnaps();
      expect(result).toBeNull();
    });

    it('should delete Storage files and Firestore docs for expired snaps', async () => {
      const mockDocDelete = jest.fn().mockResolvedValue();
      const mockFileDelete = jest.fn().mockResolvedValue();
      const mockFileExists = jest.fn().mockResolvedValue([true]);

      mockBucket.file.mockReturnValue({
        exists: mockFileExists,
        delete: mockFileDelete,
      });

      const expiredDocs = [
        {
          data: () => ({
            type: 'snap',
            viewedAt: null,
            snapStoragePath: 'snap-photos/user1/snap1.jpg',
          }),
          ref: { path: 'conversations/conv1/messages/msg1', delete: mockDocDelete },
        },
        {
          data: () => ({
            type: 'snap',
            viewedAt: null,
            snapStoragePath: 'snap-photos/user2/snap2.jpg',
          }),
          ref: { path: 'conversations/conv2/messages/msg2', delete: mockDocDelete },
        },
      ];

      mockDb.collectionGroup = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          size: 2,
          docs: expiredDocs,
        }),
      }));

      const result = await cleanupExpiredSnaps();
      expect(result).toBeNull();

      // Verify Storage files were checked and deleted
      expect(mockBucket.file).toHaveBeenCalledWith('snap-photos/user1/snap1.jpg');
      expect(mockBucket.file).toHaveBeenCalledWith('snap-photos/user2/snap2.jpg');
      expect(mockFileDelete).toHaveBeenCalledTimes(2);

      // Verify Firestore docs were deleted
      expect(mockDocDelete).toHaveBeenCalledTimes(2);
    });

    it('should query with correct filters', async () => {
      const mockWhere = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockGet = jest.fn().mockResolvedValue({ empty: true, size: 0, docs: [] });

      mockDb.collectionGroup = jest.fn(() => ({
        where: mockWhere,
        limit: mockLimit,
        get: mockGet,
      }));

      await cleanupExpiredSnaps();

      // Verify collection group query on 'messages'
      expect(mockDb.collectionGroup).toHaveBeenCalledWith('messages');

      // Verify where clauses: type=='snap', viewedAt==null, expiresAt<=now
      expect(mockWhere).toHaveBeenCalledWith('type', '==', 'snap');
      expect(mockWhere).toHaveBeenCalledWith('viewedAt', '==', null);
      expect(mockWhere).toHaveBeenCalledWith('expiresAt', '<=', expect.anything());

      // Verify limit
      expect(mockLimit).toHaveBeenCalledWith(100);
    });
  });

  // ==========================================================================
  // onNewMessage snap handling
  // ==========================================================================
  describe('onNewMessage - snap type', () => {
    it('should set lastMessage.text to null and type to snap', async () => {
      const db = setupMockDb({
        users: {
          'user-a': {
            displayName: 'Alice',
            username: 'alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': {
            displayName: 'Bob',
            username: 'bob',
            fcmToken: VALID_TOKEN,
          },
        },
      });

      // Track the update call on the conversation doc
      const mockConvUpdate = jest.fn().mockResolvedValue();
      db.doc.mockImplementation(path => ({
        get: jest.fn(() => {
          if (path.includes('users/user-a')) {
            return Promise.resolve({
              exists: true,
              data: () => ({
                displayName: 'Alice',
                fcmToken: VALID_TOKEN,
                notificationPreferences: { enabled: true, directMessages: true },
              }),
            });
          }
          if (path.includes('users/user-b')) {
            return Promise.resolve({
              exists: true,
              data: () => ({ displayName: 'Bob', username: 'bob', photoURL: null }),
            });
          }
          return Promise.resolve({ exists: false, data: () => null });
        }),
        update: mockConvUpdate,
      }));

      const snapshot = {
        data: () => ({
          senderId: 'user-b',
          type: 'snap',
          text: null,
          snapStoragePath: 'snap-photos/user-b/snap123.jpg',
          createdAt: { _seconds: Date.now() / 1000 },
        }),
      };
      const context = { params: { conversationId: 'user-a_user-b', messageId: 'msg-123' } };

      await onNewMessage(snapshot, context);

      // Verify conversation was updated with snap lastMessage
      expect(mockConvUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          lastMessage: expect.objectContaining({
            text: null,
            type: 'snap',
            senderId: 'user-b',
          }),
        })
      );
    });

    it('should send push notification with snap template', async () => {
      const db = setupMockDb({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': {
            displayName: 'Bob',
            username: 'bob',
            photoURL: 'https://photo.url',
          },
        },
      });

      db.doc.mockImplementation(path => ({
        get: jest.fn(() => {
          if (path.includes('users/user-a')) {
            return Promise.resolve({
              exists: true,
              data: () => ({
                displayName: 'Alice',
                fcmToken: VALID_TOKEN,
                notificationPreferences: { enabled: true, directMessages: true },
              }),
            });
          }
          if (path.includes('users/user-b')) {
            return Promise.resolve({
              exists: true,
              data: () => ({ displayName: 'Bob', username: 'bob', photoURL: 'https://photo.url' }),
            });
          }
          return Promise.resolve({ exists: false, data: () => null });
        }),
        update: jest.fn().mockResolvedValue(),
      }));

      db.collection.mockImplementation(() => ({
        doc: jest.fn(docId => ({
          get: jest.fn(() => {
            if (docId === 'user-a') {
              return Promise.resolve({
                exists: true,
                data: () => ({
                  displayName: 'Alice',
                  fcmToken: VALID_TOKEN,
                  notificationPreferences: { enabled: true, directMessages: true },
                }),
              });
            }
            if (docId === 'user-b') {
              return Promise.resolve({
                exists: true,
                data: () => ({
                  displayName: 'Bob',
                  username: 'bob',
                  photoURL: 'https://photo.url',
                }),
              });
            }
            return Promise.resolve({ exists: false, data: () => null });
          }),
        })),
      }));

      const snapshot = {
        data: () => ({
          senderId: 'user-b',
          type: 'snap',
          text: null,
          snapStoragePath: 'snap-photos/user-b/snap123.jpg',
          createdAt: { _seconds: Date.now() / 1000 },
        }),
      };
      const context = { params: { conversationId: 'user-a_user-b', messageId: 'msg-123' } };

      await onNewMessage(snapshot, context);

      // Verify push notification was sent
      expect(mockSendPushNotification).toHaveBeenCalled();
      const [token, title, body, data] = mockSendPushNotification.mock.calls[0];

      expect(token).toBe(VALID_TOKEN);
      expect(title).toBe('Bob');
      // Body should be one of the snap templates
      const validBodies = ['sent you a snap', 'just snapped you', 'New snap'];
      expect(validBodies).toContain(body);
      expect(data.type).toBe('direct_message');
      expect(data.conversationId).toBe('user-a_user-b');
    });
  });
});
