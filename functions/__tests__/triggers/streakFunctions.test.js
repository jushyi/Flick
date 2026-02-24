/**
 * Streak Cloud Functions Tests
 *
 * Tests for streak-related Cloud Functions:
 * 1. updateStreakOnSnap (via onNewMessage) - Mutual snap tracking, dayCount increment,
 *    tiered expiry windows, warning reset, race condition safety via transactions
 * 2. processStreakExpiry - Warning flag setting, push notifications, streak reset on expiry
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
jest.mock('../../notifications/batching', () => ({
  addReactionToBatch: jest.fn().mockResolvedValue(),
  scheduleNotificationTask: jest.fn().mockResolvedValue(),
}));

const { initializeFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Get the singleton mock db
const mockDb = initializeFirestore();

// Require the functions (handlers are returned directly by mocks)
const { onNewMessage, processStreakExpiry } = require('../../index');

// Valid FCM token for tests
const VALID_TOKEN = 'ExponentPushToken[test-token-123]';

// Fixed timestamp helpers
const FIXED_NOW_MS = 1700000000000; // Fixed point in time
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Create a mock Firestore Timestamp
 */
function mockTimestamp(ms) {
  return {
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
}

/**
 * Helper: create a mock streak document
 */
function createStreakDoc(overrides = {}) {
  return {
    participants: ['user-a', 'user-b'],
    dayCount: 0,
    lastSnapBy: { 'user-a': null, 'user-b': null },
    lastMutualAt: null,
    streakStartedAt: null,
    expiresAt: null,
    warningAt: null,
    warning: false,
    warningSentAt: null,
    updatedAt: mockTimestamp(FIXED_NOW_MS),
    ...overrides,
  };
}

/**
 * Helper: setup mockDb for onNewMessage tests
 * Configures collection/doc mocks for conversations, users, and streaks
 */
function setupOnNewMessageMocks(config = {}) {
  const { users = {}, streakDoc = null, streakExists = false } = config;

  // Track transaction operations
  const transactionOps = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
  };

  // Configure transaction get to return streak doc
  transactionOps.get.mockImplementation(() => {
    if (streakExists && streakDoc) {
      return Promise.resolve({
        exists: true,
        data: () => streakDoc,
        ref: { id: 'user-a_user-b' },
      });
    }
    return Promise.resolve({
      exists: false,
      data: () => null,
      ref: { id: 'user-a_user-b' },
    });
  });

  // Mock runTransaction to call fn with our tracked transaction
  mockDb.runTransaction.mockImplementation(async fn => {
    return fn(transactionOps);
  });

  // Setup doc mock for conversation updates and user lookups
  const mockConvUpdate = jest.fn().mockResolvedValue();

  mockDb.doc.mockImplementation(path => ({
    get: jest.fn(() => {
      if (path.includes('users/')) {
        const uid = path.split('/')[1];
        if (users[uid]) {
          return Promise.resolve({
            exists: true,
            id: uid,
            data: () => users[uid],
          });
        }
      }
      return Promise.resolve({ exists: false, data: () => null });
    }),
    update: mockConvUpdate,
    set: jest.fn().mockResolvedValue(),
  }));

  // Setup collection mock
  const mockStreakDocRef = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
  };

  mockDb.collection.mockImplementation(collectionName => {
    if (collectionName === 'streaks') {
      return {
        doc: jest.fn(() => mockStreakDocRef),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
      };
    }
    if (collectionName === 'users') {
      return {
        doc: jest.fn(uid => ({
          get: jest.fn(() => {
            if (users[uid]) {
              return Promise.resolve({
                exists: true,
                id: uid,
                data: () => users[uid],
              });
            }
            return Promise.resolve({ exists: false, data: () => null });
          }),
        })),
      };
    }
    return {
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        set: jest.fn().mockResolvedValue(),
        update: jest.fn().mockResolvedValue(),
      })),
      add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };
  });

  return { transactionOps, mockConvUpdate, mockStreakDocRef };
}

/**
 * Helper: create a snap message snapshot for onNewMessage trigger
 */
function createSnapSnapshot(senderId = 'user-b') {
  return {
    data: () => ({
      senderId,
      type: 'snap',
      text: null,
      snapStoragePath: `snap-photos/${senderId}/snap123.jpg`,
      createdAt: { _seconds: FIXED_NOW_MS / 1000 },
    }),
  };
}

/**
 * Helper: create an onNewMessage context
 */
function createMessageContext(conversationId = 'user-a_user-b', messageId = 'msg-123') {
  return { params: { conversationId, messageId } };
}

describe('Streak Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Timestamp.now to return a stable value
    admin.firestore.Timestamp.now.mockReturnValue(mockTimestamp(FIXED_NOW_MS));
    admin.firestore.Timestamp.fromMillis.mockImplementation(ms => mockTimestamp(ms));
  });

  // ==========================================================================
  // updateStreakOnSnap (via onNewMessage)
  // ==========================================================================
  describe('updateStreakOnSnap (via onNewMessage)', () => {
    it('creates new streak document when none exists on first snap', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': {
            displayName: 'Bob',
            username: 'bob',
            photoURL: null,
          },
        },
        streakExists: false,
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // Verify transaction.set was called to create new streak doc
      expect(transactionOps.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          participants: ['user-a', 'user-b'],
          dayCount: 0,
          lastMutualAt: null,
          streakStartedAt: null,
          expiresAt: null,
          warningAt: null,
          warning: false,
          warningSentAt: null,
        })
      );

      // Verify sender's lastSnapBy is set
      const setCallArgs = transactionOps.set.mock.calls[0][1];
      expect(setCallArgs.lastSnapBy['user-b']).toBeDefined();
      expect(setCallArgs.lastSnapBy['user-b'].toMillis()).toBe(FIXED_NOW_MS);
      expect(setCallArgs.lastSnapBy['user-a']).toBeNull();
    });

    it('updates lastSnapBy for sender without incrementing dayCount (one-sided snap)', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          lastSnapBy: { 'user-a': null, 'user-b': null },
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // Should call transaction.update (not set) with just lastSnapBy + updatedAt
      expect(transactionOps.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'lastSnapBy.user-b': expect.objectContaining({ toMillis: expect.any(Function) }),
          updatedAt: expect.anything(),
        })
      );

      // dayCount should NOT be in the update (no increment)
      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      expect(updateCallArgs.dayCount).toBeUndefined();
    });

    it('increments dayCount when mutual snaps complete (both users have snapped)', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 0,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000), // user-a already snapped 1 min ago
            'user-b': null,
          },
          lastMutualAt: null,
        }),
      });

      // user-b sends snap, completing the mutual exchange
      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // Should increment dayCount to 1
      expect(transactionOps.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          dayCount: 1,
          lastMutualAt: expect.objectContaining({ toMillis: expect.any(Function) }),
          warning: false,
          warningSentAt: null,
        })
      );
    });

    it('does NOT increment dayCount if less than 24h since lastMutualAt', async () => {
      const recentMutualMs = FIXED_NOW_MS - 12 * 60 * 60 * 1000; // 12h ago

      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 3,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000), // user-a snapped recently
            'user-b': null,
          },
          lastMutualAt: mockTimestamp(recentMutualMs), // 12h ago (< 24h)
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // Should update lastSnapBy but NOT increment dayCount
      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      expect(updateCallArgs.dayCount).toBeUndefined();
      expect(updateCallArgs['lastSnapBy.user-b']).toBeDefined();
    });

    it('DOES increment dayCount if >= 24h since lastMutualAt', async () => {
      const oldMutualMs = FIXED_NOW_MS - 25 * 60 * 60 * 1000; // 25h ago

      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 5,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000),
            'user-b': null,
          },
          lastMutualAt: mockTimestamp(oldMutualMs), // 25h ago (>= 24h)
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // Should increment dayCount from 5 to 6
      expect(transactionOps.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          dayCount: 6,
        })
      );
    });

    it('clears lastSnapBy for both users after mutual exchange completes', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 2,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000),
            'user-b': null,
          },
          lastMutualAt: mockTimestamp(FIXED_NOW_MS - 26 * 60 * 60 * 1000),
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // After mutual exchange, both lastSnapBy entries should be cleared
      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      expect(updateCallArgs.lastSnapBy).toEqual({
        'user-a': null,
        'user-b': null,
      });
    });

    it('sets streakStartedAt on first mutual exchange (dayCount 0->1)', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 0,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000),
            'user-b': null,
          },
          lastMutualAt: null,
          streakStartedAt: null,
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // streakStartedAt should be set
      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      expect(updateCallArgs.streakStartedAt).toBeDefined();
      expect(updateCallArgs.streakStartedAt.toMillis()).toBe(FIXED_NOW_MS);
    });

    it('calculates correct expiresAt using base tier (36h) for dayCount < 10', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 5,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000),
            'user-b': null,
          },
          lastMutualAt: mockTimestamp(FIXED_NOW_MS - 25 * 60 * 60 * 1000),
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      // dayCount goes from 5 to 6, still base tier (36h)
      const expectedExpiresAt = FIXED_NOW_MS + 36 * 60 * 60 * 1000;
      expect(updateCallArgs.expiresAt.toMillis()).toBe(expectedExpiresAt);
    });

    it('calculates correct expiresAt using tier10 (48h) for dayCount 10-49', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 9,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000),
            'user-b': null,
          },
          lastMutualAt: mockTimestamp(FIXED_NOW_MS - 25 * 60 * 60 * 1000),
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      // dayCount goes from 9 to 10, enters tier10 (48h)
      const expectedExpiresAt = FIXED_NOW_MS + 48 * 60 * 60 * 1000;
      expect(updateCallArgs.expiresAt.toMillis()).toBe(expectedExpiresAt);
    });

    it('calculates correct expiresAt using tier50 (72h) for dayCount >= 50', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 49,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000),
            'user-b': null,
          },
          lastMutualAt: mockTimestamp(FIXED_NOW_MS - 25 * 60 * 60 * 1000),
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      // dayCount goes from 49 to 50, enters tier50 (72h)
      const expectedExpiresAt = FIXED_NOW_MS + 72 * 60 * 60 * 1000;
      expect(updateCallArgs.expiresAt.toMillis()).toBe(expectedExpiresAt);
    });

    it('resets warning and warningSentAt on new mutual exchange', async () => {
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 5,
          warning: true,
          warningSentAt: mockTimestamp(FIXED_NOW_MS - 60000),
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000),
            'user-b': null,
          },
          lastMutualAt: mockTimestamp(FIXED_NOW_MS - 30 * 60 * 60 * 1000),
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      expect(updateCallArgs.warning).toBe(false);
      expect(updateCallArgs.warningSentAt).toBeNull();
    });

    it('uses Firestore transaction for atomicity (race condition safety)', async () => {
      setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: false,
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // Verify runTransaction was called (ensuring atomic read-then-write)
      expect(mockDb.runTransaction).toHaveBeenCalled();
    });

    it('best-effort: streak error does not fail onNewMessage', async () => {
      // Make runTransaction throw
      mockDb.runTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

      setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
      });

      // Override runTransaction to throw
      mockDb.runTransaction.mockRejectedValue(new Error('Transaction failed'));

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      // Should NOT throw — streak failure is caught and logged
      const result = await onNewMessage(snapshot, context);
      expect(result).toBeNull();
    });

    it('does not trigger streak update for non-snap message types', async () => {
      setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
      });

      // Send a text message, not a snap
      const snapshot = {
        data: () => ({
          senderId: 'user-b',
          type: 'text',
          text: 'Hello!',
          createdAt: { _seconds: FIXED_NOW_MS / 1000 },
        }),
      };
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      // runTransaction should NOT have been called (no streak update for text)
      expect(mockDb.runTransaction).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // processStreakExpiry
  // ==========================================================================
  describe('processStreakExpiry', () => {
    it('sets warning=true for streaks where warningAt <= now and warning is false', async () => {
      const mockStreakRef = {
        update: jest.fn().mockResolvedValue(),
      };

      const streakDoc = {
        id: 'user-a_user-b',
        ref: mockStreakRef,
        data: () =>
          createStreakDoc({
            dayCount: 5,
            warning: false,
            warningSentAt: null,
            warningAt: mockTimestamp(FIXED_NOW_MS - 1000), // warningAt is in the past
            expiresAt: mockTimestamp(FIXED_NOW_MS + 4 * 60 * 60 * 1000), // still 4h from expiry
          }),
      };

      // Use a shared streaks collection mock so both queries use the same .get() sequence
      const sharedStreaksMock = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValueOnce({ docs: [streakDoc], empty: false }) // warnings query
          .mockResolvedValueOnce({ docs: [], empty: true }), // expiry query
      };

      mockDb.collection.mockImplementation(name => {
        if (name === 'streaks') return sharedStreaksMock;
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  displayName: 'TestUser',
                  fcmToken: VALID_TOKEN,
                  notificationPreferences: { enabled: true },
                }),
              }),
            })),
          };
        }
        return {
          doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
        };
      });

      await processStreakExpiry();

      // Verify warning flag was set
      expect(mockStreakRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          warning: true,
          warningSentAt: expect.anything(),
        })
      );
    });

    it('sends push notification to both participants on warning', async () => {
      const mockStreakRef = {
        update: jest.fn().mockResolvedValue(),
      };

      const streakDoc = {
        id: 'user-a_user-b',
        ref: mockStreakRef,
        data: () =>
          createStreakDoc({
            dayCount: 5,
            warning: false,
            warningAt: mockTimestamp(FIXED_NOW_MS - 1000),
            expiresAt: mockTimestamp(FIXED_NOW_MS + 4 * 60 * 60 * 1000),
          }),
      };

      const userAData = {
        displayName: 'Alice',
        fcmToken: 'ExponentPushToken[alice-token]',
        notificationPreferences: { enabled: true },
      };
      const userBData = {
        displayName: 'Bob',
        fcmToken: 'ExponentPushToken[bob-token]',
        notificationPreferences: { enabled: true },
      };

      const sharedStreaksMock = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValueOnce({ docs: [streakDoc], empty: false })
          .mockResolvedValueOnce({ docs: [], empty: true }),
      };

      mockDb.collection.mockImplementation(name => {
        if (name === 'streaks') return sharedStreaksMock;
        if (name === 'users') {
          return {
            doc: jest.fn(uid => ({
              get: jest.fn(() => {
                if (uid === 'user-a') {
                  return Promise.resolve({ exists: true, data: () => userAData });
                }
                if (uid === 'user-b') {
                  return Promise.resolve({ exists: true, data: () => userBData });
                }
                return Promise.resolve({ exists: false, data: () => null });
              }),
            })),
          };
        }
        return {
          doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
        };
      });

      await processStreakExpiry();

      // Should have sent push notifications to both users
      expect(mockSendPushNotification).toHaveBeenCalledTimes(2);

      // Verify Alice received notification about Bob
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        'ExponentPushToken[alice-token]',
        'Flick',
        expect.stringContaining('Bob'),
        expect.objectContaining({
          type: 'streak_warning',
          conversationId: 'user-a_user-b',
        }),
        'user-a'
      );

      // Verify Bob received notification about Alice
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        'ExponentPushToken[bob-token]',
        'Flick',
        expect.stringContaining('Alice'),
        expect.objectContaining({
          type: 'streak_warning',
          conversationId: 'user-a_user-b',
        }),
        'user-b'
      );
    });

    it('skips notification when user has streakWarnings preference disabled', async () => {
      const mockStreakRef = {
        update: jest.fn().mockResolvedValue(),
      };

      const streakDoc = {
        id: 'user-a_user-b',
        ref: mockStreakRef,
        data: () =>
          createStreakDoc({
            dayCount: 5,
            warning: false,
            warningAt: mockTimestamp(FIXED_NOW_MS - 1000),
            expiresAt: mockTimestamp(FIXED_NOW_MS + 4 * 60 * 60 * 1000),
          }),
      };

      const sharedStreaksMock = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValueOnce({ docs: [streakDoc], empty: false })
          .mockResolvedValueOnce({ docs: [], empty: true }),
      };

      mockDb.collection.mockImplementation(name => {
        if (name === 'streaks') return sharedStreaksMock;
        if (name === 'users') {
          return {
            doc: jest.fn(uid => ({
              get: jest.fn(() => {
                if (uid === 'user-a') {
                  return Promise.resolve({
                    exists: true,
                    data: () => ({
                      displayName: 'Alice',
                      fcmToken: VALID_TOKEN,
                      notificationPreferences: { enabled: true, streakWarnings: false },
                    }),
                  });
                }
                if (uid === 'user-b') {
                  return Promise.resolve({
                    exists: true,
                    data: () => ({
                      displayName: 'Bob',
                      fcmToken: VALID_TOKEN,
                      notificationPreferences: { enabled: true, streakWarnings: false },
                    }),
                  });
                }
                return Promise.resolve({ exists: false, data: () => null });
              }),
            })),
          };
        }
        return {
          doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
        };
      });

      await processStreakExpiry();

      // Warning flag should still be set
      expect(mockStreakRef.update).toHaveBeenCalledWith(expect.objectContaining({ warning: true }));

      // But NO push notifications should have been sent
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it('skips already-expired streaks when processing warnings', async () => {
      const mockStreakRef = {
        update: jest.fn().mockResolvedValue(),
      };

      // This streak's expiresAt is already past (expired)
      const expiredStreakDoc = {
        id: 'user-a_user-b',
        ref: mockStreakRef,
        data: () =>
          createStreakDoc({
            dayCount: 5,
            warning: false,
            warningAt: mockTimestamp(FIXED_NOW_MS - 5 * 60 * 60 * 1000), // 5h ago
            expiresAt: mockTimestamp(FIXED_NOW_MS - 1000), // Already expired
          }),
      };

      // Use a shared streaks collection mock so both queries use the same .get() sequence
      const sharedStreaksMock = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValueOnce({ docs: [expiredStreakDoc], empty: false }) // warnings query
          .mockResolvedValueOnce({ docs: [], empty: true }), // expiry query
      };

      mockDb.collection.mockImplementation(name => {
        if (name === 'streaks') return sharedStreaksMock;
        if (name === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest
                .fn()
                .mockResolvedValue({
                  exists: true,
                  data: () => ({ displayName: 'Test', fcmToken: VALID_TOKEN }),
                }),
            })),
          };
        }
        return {
          doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
        };
      });

      await processStreakExpiry();

      // The expired streak should be FILTERED OUT of warning processing
      // (the filter checks expiresAt > nowMs, which is false for expired streaks)
      // mockStreakRef.update should NOT be called from the warning path
      // (but it might be called from expiry path since the expiry query returned empty)
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it('resets expired streaks: dayCount=0, expiresAt=null, lastMutualAt=null', async () => {
      const mockStreakRef = {
        update: jest.fn().mockResolvedValue(),
      };

      const expiredStreakDoc = {
        id: 'user-a_user-b',
        ref: mockStreakRef,
        data: () =>
          createStreakDoc({
            dayCount: 15,
            lastMutualAt: mockTimestamp(FIXED_NOW_MS - 50 * 60 * 60 * 1000),
            streakStartedAt: mockTimestamp(FIXED_NOW_MS - 15 * DAY_MS),
            expiresAt: mockTimestamp(FIXED_NOW_MS - 1000), // Expired
            warningAt: mockTimestamp(FIXED_NOW_MS - 5 * 60 * 60 * 1000),
            warning: true,
            warningSentAt: mockTimestamp(FIXED_NOW_MS - 4 * 60 * 60 * 1000),
          }),
      };

      // Use a shared streaks collection mock so both queries use the same .get() sequence
      const sharedStreaksMock = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValueOnce({ docs: [], empty: true }) // warnings query (empty)
          .mockResolvedValueOnce({ docs: [expiredStreakDoc], empty: false }), // expiry query
      };

      mockDb.collection.mockImplementation(name => {
        if (name === 'streaks') return sharedStreaksMock;
        return {
          doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
        };
      });

      await processStreakExpiry();

      // Verify streak was reset
      expect(mockStreakRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          dayCount: 0,
          lastMutualAt: null,
          streakStartedAt: null,
          expiresAt: null,
          warningAt: null,
          warning: false,
          warningSentAt: null,
          lastSnapBy: {
            'user-a': null,
            'user-b': null,
          },
        })
      );
    });

    it('handles empty query results gracefully', async () => {
      const sharedStreaksMock = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
      };

      mockDb.collection.mockImplementation(() => sharedStreaksMock);

      // Should not throw
      const result = await processStreakExpiry();
      expect(result).toBeNull();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    it('calculates warningAt as expiresAt minus 4 hours', async () => {
      // This test verifies the warningAt field is set correctly during mutual snap processing
      const { transactionOps } = setupOnNewMessageMocks({
        users: {
          'user-a': {
            displayName: 'Alice',
            fcmToken: VALID_TOKEN,
            notificationPreferences: { enabled: true, directMessages: true },
          },
          'user-b': { displayName: 'Bob', username: 'bob' },
        },
        streakExists: true,
        streakDoc: createStreakDoc({
          dayCount: 3,
          lastSnapBy: {
            'user-a': mockTimestamp(FIXED_NOW_MS - 60000),
            'user-b': null,
          },
          lastMutualAt: mockTimestamp(FIXED_NOW_MS - 25 * 60 * 60 * 1000),
        }),
      });

      const snapshot = createSnapSnapshot('user-b');
      const context = createMessageContext();

      await onNewMessage(snapshot, context);

      const updateCallArgs = transactionOps.update.mock.calls[0][1];
      // dayCount goes from 3 to 4 (base tier, 36h)
      const expectedExpiresAtMs = FIXED_NOW_MS + 36 * 60 * 60 * 1000;
      const expectedWarningAtMs = expectedExpiresAtMs - 4 * 60 * 60 * 1000;

      expect(updateCallArgs.expiresAt.toMillis()).toBe(expectedExpiresAtMs);
      expect(updateCallArgs.warningAt.toMillis()).toBe(expectedWarningAtMs);
    });
  });
});
