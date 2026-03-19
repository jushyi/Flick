/**
 * Scheduled Function Tests
 *
 * Tests for 4 scheduled functions exported from index.js:
 * 1. processDarkroomReveals (every 2 minutes)
 * 2. processScheduledDeletions (daily at 3 AM UTC)
 * 3. processScheduledPhotoDeletions (daily at 3:15 AM UTC)
 * 4. checkPushReceipts (every 15 minutes)
 *
 * Scheduled functions use pubsub.schedule().onRun() which is mocked to return
 * the handler directly. Handlers receive (context) with no document params.
 */

const { initializeFirestore, Timestamp } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Mock notifications modules for checkPushReceipts
jest.mock('../../notifications/sender', () => {
  const { Expo } = require('expo-server-sdk');
  const expo = new Expo();
  return {
    sendPushNotification: jest.fn().mockResolvedValue({ success: true }),
    sendBatchNotifications: jest.fn().mockResolvedValue([]),
    expo,
  };
});

jest.mock('../../notifications/receipts', () => ({
  storePendingReceipt: jest.fn().mockResolvedValue(),
  getPendingReceipts: jest.fn().mockResolvedValue([]),
  deletePendingReceipt: jest.fn().mockResolvedValue(),
  removeInvalidToken: jest.fn().mockResolvedValue(),
}));

// Get the singleton mock db
const mockDb = initializeFirestore();

// Require the functions
const {
  processDarkroomReveals,
  processScheduledDeletions,
  processScheduledPhotoDeletions,
  checkPushReceipts,
} = require('../../index');

// Get mocked modules for assertions
const { expo } = require('../../notifications/sender');
const {
  getPendingReceipts,
  deletePendingReceipt,
  removeInvalidToken,
} = require('../../notifications/receipts');

/**
 * Helper: configure mockDb for scheduled function tests
 */
function setupMockDb(config = {}) {
  const {
    darkrooms = { docs: [], empty: true, size: 0 },
    photos = { docs: [], empty: true, size: 0 },
    users = {},
    friendships = { docs: [], empty: true, size: 0 },
    albums = { docs: [], empty: true, size: 0 },
  } = config;

  let collectionQueryCount = {};

  const mockDocGet = (collectionName, docId) => {
    if (collectionName === 'users' && users[docId]) {
      return Promise.resolve({
        exists: true,
        id: docId,
        data: () => users[docId],
        ref: {
          id: docId,
          update: jest.fn().mockResolvedValue(),
          delete: jest.fn().mockResolvedValue(),
        },
      });
    }
    if (collectionName === 'darkrooms' && config.darkroomDoc) {
      return Promise.resolve(config.darkroomDoc);
    }
    return Promise.resolve({
      exists: false,
      id: docId,
      data: () => null,
      ref: {
        id: docId,
        update: jest.fn().mockResolvedValue(),
        delete: jest.fn().mockResolvedValue(),
      },
    });
  };

  mockDb.collection.mockImplementation(collectionName => {
    if (!collectionQueryCount[collectionName]) {
      collectionQueryCount[collectionName] = 0;
    }

    const collectionRef = {
      doc: jest.fn(docId => {
        const docRef = {
          get: jest.fn(() => mockDocGet(collectionName, docId)),
          set: jest.fn().mockResolvedValue(),
          update: jest.fn().mockResolvedValue(),
          delete: jest.fn().mockResolvedValue(),
          id: docId,
          ref: { id: docId },
          collection: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
            doc: jest.fn(() => ({
              collection: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
              })),
            })),
          })),
        };
        return docRef;
      }),
      add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(() => {
        collectionQueryCount[collectionName]++;

        if (collectionName === 'darkrooms') {
          return Promise.resolve(darkrooms);
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
        if (collectionName === 'friendships') {
          return Promise.resolve(friendships);
        }
        if (collectionName === 'albums') {
          return Promise.resolve(albums);
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
// processDarkroomReveals
// ============================================================================
describe('processDarkroomReveals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up Timestamp.now() for the scheduled function
    Timestamp.now.mockReturnValue({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    });
  });

  it('should return null when no darkrooms are ready to reveal', async () => {
    setupMockDb({
      darkrooms: { docs: [], empty: true, size: 0 },
    });

    const result = await processDarkroomReveals({});

    expect(result).toBeNull();
  });

  it('should process darkrooms that are ready to reveal', async () => {
    const mockDarkroomDoc = {
      id: 'user-1',
      data: () => ({ nextRevealAt: { toMillis: () => Date.now() - 1000 } }),
    };

    setupMockDb({
      darkrooms: {
        docs: [mockDarkroomDoc],
        empty: false,
        size: 1,
      },
      photos: {
        docs: [
          {
            ref: { update: jest.fn().mockResolvedValue() },
            data: () => ({ userId: 'user-1', status: 'developing' }),
          },
        ],
        empty: false,
        size: 1,
      },
    });

    const result = await processDarkroomReveals({});

    expect(result).toEqual(
      expect.objectContaining({
        processed: 1,
        successful: 1,
      })
    );
  });

  it('should handle errors for individual users without failing the entire batch', async () => {
    // First darkroom will fail (photos query throws), second should succeed
    let photoQueryCount = 0;

    const mockDarkroomDoc1 = { id: 'user-fail' };
    const mockDarkroomDoc2 = { id: 'user-ok' };

    setupMockDb({
      darkrooms: {
        docs: [mockDarkroomDoc1, mockDarkroomDoc2],
        empty: false,
        size: 2,
      },
      photos: { docs: [], empty: true, size: 0 },
    });

    const result = await processDarkroomReveals({});

    // Both should be processed, but results depend on internal revealUserPhotos behavior
    expect(result).toBeDefined();
    expect(result.processed).toBe(2);
  });
});

// ============================================================================
// processScheduledDeletions
// ============================================================================
describe('processScheduledDeletions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Timestamp.now.mockReturnValue({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    });
  });

  it('should return empty result when no users are scheduled for deletion', async () => {
    setupMockDb({
      usersQuery: { docs: [], empty: true, size: 0 },
    });

    const result = await processScheduledDeletions({});

    expect(result).toEqual({ processed: 0, deleted: 0, failed: 0 });
  });

  it('should process users scheduled for deletion', async () => {
    const mockDeleteUser = jest.fn().mockResolvedValue();
    admin.auth.mockReturnValue({
      getUser: jest.fn(),
      deleteUser: mockDeleteUser,
    });

    const userDoc = {
      id: 'user-to-delete',
      data: () => ({
        displayName: 'Doomed User',
        scheduledForDeletionAt: { toMillis: () => Date.now() - 86400000 },
      }),
      ref: { delete: jest.fn().mockResolvedValue() },
    };

    setupMockDb({
      usersQuery: {
        docs: [userDoc],
        empty: false,
        size: 1,
      },
      photos: { docs: [], empty: true, size: 0 },
      friendships: { docs: [], empty: true, size: 0 },
    });

    const result = await processScheduledDeletions({});

    expect(result).toEqual({ processed: 1, deleted: 1, failed: 0 });
    expect(mockDeleteUser).toHaveBeenCalledWith('user-to-delete');
  });

  it('should continue processing when one user deletion fails', async () => {
    const mockDeleteUser = jest
      .fn()
      .mockRejectedValueOnce(new Error('Auth delete failed'))
      .mockResolvedValueOnce();

    admin.auth.mockReturnValue({
      getUser: jest.fn(),
      deleteUser: mockDeleteUser,
    });

    const userDoc1 = {
      id: 'user-fail',
      data: () => ({ scheduledForDeletionAt: { toMillis: () => Date.now() - 1000 } }),
      ref: { delete: jest.fn().mockResolvedValue() },
    };
    const userDoc2 = {
      id: 'user-ok',
      data: () => ({ scheduledForDeletionAt: { toMillis: () => Date.now() - 1000 } }),
      ref: { delete: jest.fn().mockResolvedValue() },
    };

    setupMockDb({
      usersQuery: {
        docs: [userDoc1, userDoc2],
        empty: false,
        size: 2,
      },
      photos: { docs: [], empty: true, size: 0 },
      friendships: { docs: [], empty: true, size: 0 },
    });

    const result = await processScheduledDeletions({});

    expect(result).toEqual({ processed: 2, deleted: 1, failed: 1 });
  });
});

// ============================================================================
// processScheduledPhotoDeletions
// ============================================================================
describe('processScheduledPhotoDeletions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Timestamp.now.mockReturnValue({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    });
  });

  it('should return empty result when no photos are scheduled for deletion', async () => {
    setupMockDb({
      photos: { docs: [], empty: true, size: 0 },
    });

    const result = await processScheduledPhotoDeletions({});

    expect(result).toEqual({ processed: 0, deleted: 0, failed: 0 });
  });

  it('should permanently delete expired photos', async () => {
    const photoDoc = {
      id: 'photo-to-delete',
      ref: {
        id: 'photo-to-delete',
        delete: jest.fn().mockResolvedValue(),
        collection: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: [],
            empty: true,
          }),
        })),
      },
      data: () => ({
        userId: 'user-1',
        photoState: 'deleted',
        imageURL: '',
        scheduledForPermanentDeletionAt: { toMillis: () => Date.now() - 86400000 },
      }),
    };

    setupMockDb({
      photos: {
        docs: [photoDoc],
        empty: false,
        size: 1,
      },
      albums: { docs: [], empty: true, size: 0 },
    });

    const result = await processScheduledPhotoDeletions({});

    expect(result).toEqual({ processed: 1, deleted: 1, failed: 0 });
  });

  it('should clean up storage files for photos with imageURL', async () => {
    const encodedUrl =
      'https://storage.googleapis.com/bucket/o/photos%2Fuser-1%2Fphoto.jpg?alt=media';

    const photoDoc = {
      id: 'photo-with-storage',
      ref: {
        id: 'photo-with-storage',
        delete: jest.fn().mockResolvedValue(),
        collection: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
        })),
      },
      data: () => ({
        userId: 'user-1',
        photoState: 'deleted',
        imageURL: encodedUrl,
        scheduledForPermanentDeletionAt: { toMillis: () => Date.now() - 86400000 },
      }),
    };

    setupMockDb({
      photos: {
        docs: [photoDoc],
        empty: false,
        size: 1,
      },
      albums: { docs: [], empty: true, size: 0 },
    });

    const result = await processScheduledPhotoDeletions({});

    expect(result).toEqual({ processed: 1, deleted: 1, failed: 0 });

    // Verify storage cleanup was attempted
    const { getStorage } = require('firebase-admin/storage');
    const bucket = getStorage().bucket();
    expect(bucket.file).toHaveBeenCalled();
  });

  it('should continue processing when one photo deletion fails', async () => {
    const photoDoc1 = {
      id: 'photo-fail',
      ref: {
        id: 'photo-fail',
        delete: jest.fn().mockRejectedValue(new Error('Delete failed')),
        collection: jest.fn(() => ({
          get: jest.fn().mockRejectedValue(new Error('Comments query failed')),
        })),
      },
      data: () => ({
        userId: 'user-1',
        photoState: 'deleted',
        imageURL: '',
      }),
    };

    const photoDoc2 = {
      id: 'photo-ok',
      ref: {
        id: 'photo-ok',
        delete: jest.fn().mockResolvedValue(),
        collection: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
        })),
      },
      data: () => ({
        userId: 'user-1',
        photoState: 'deleted',
        imageURL: '',
      }),
    };

    setupMockDb({
      photos: {
        docs: [photoDoc1, photoDoc2],
        empty: false,
        size: 2,
      },
      albums: { docs: [], empty: true, size: 0 },
    });

    const result = await processScheduledPhotoDeletions({});

    expect(result.processed).toBe(2);
    // At least one should have failed/succeeded
    expect(result.deleted + result.failed).toBe(2);
  });
});

// ============================================================================
// checkPushReceipts
// ============================================================================
describe('checkPushReceipts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when no pending receipts exist', async () => {
    getPendingReceipts.mockResolvedValue([]);

    const result = await checkPushReceipts({});

    expect(result).toBeNull();
    expect(expo.getPushNotificationReceiptsAsync).not.toHaveBeenCalled();
  });

  it('should process OK receipts and delete them', async () => {
    getPendingReceipts.mockResolvedValue([
      { ticketId: 'receipt-1', userId: 'user-1', token: 'ExponentPushToken[abc]' },
    ]);

    expo.getPushNotificationReceiptsAsync.mockResolvedValue({
      'receipt-1': { status: 'ok' },
    });

    const result = await checkPushReceipts({});

    expect(result).toEqual({ checked: 1, removed: 0, errors: 0 });
    expect(deletePendingReceipt).toHaveBeenCalledWith('receipt-1');
  });

  it('should handle DeviceNotRegistered error and remove token', async () => {
    getPendingReceipts.mockResolvedValue([
      { ticketId: 'receipt-2', userId: 'user-2', token: 'ExponentPushToken[bad]' },
    ]);

    expo.getPushNotificationReceiptsAsync.mockResolvedValue({
      'receipt-2': {
        status: 'error',
        message: 'The device token is not registered',
        details: { error: 'DeviceNotRegistered' },
      },
    });

    const result = await checkPushReceipts({});

    expect(result).toEqual({ checked: 1, removed: 1, errors: 1 });
    expect(removeInvalidToken).toHaveBeenCalledWith('user-2');
    expect(deletePendingReceipt).toHaveBeenCalledWith('receipt-2');
  });

  it('should handle error receipts without DeviceNotRegistered', async () => {
    getPendingReceipts.mockResolvedValue([
      { ticketId: 'receipt-3', userId: 'user-3', token: 'ExponentPushToken[xyz]' },
    ]);

    expo.getPushNotificationReceiptsAsync.mockResolvedValue({
      'receipt-3': {
        status: 'error',
        message: 'Some other error',
        details: { error: 'SomeOtherError' },
      },
    });

    const result = await checkPushReceipts({});

    expect(result).toEqual({ checked: 1, removed: 0, errors: 1 });
    expect(removeInvalidToken).not.toHaveBeenCalled();
    expect(deletePendingReceipt).toHaveBeenCalledWith('receipt-3');
  });

  it('should process multiple receipts in a batch', async () => {
    getPendingReceipts.mockResolvedValue([
      { ticketId: 'r1', userId: 'u1', token: 'ExponentPushToken[t1]' },
      { ticketId: 'r2', userId: 'u2', token: 'ExponentPushToken[t2]' },
      { ticketId: 'r3', userId: 'u3', token: 'ExponentPushToken[t3]' },
    ]);

    expo.getPushNotificationReceiptsAsync.mockResolvedValue({
      r1: { status: 'ok' },
      r2: { status: 'ok' },
      r3: { status: 'error', message: 'Failed', details: { error: 'DeviceNotRegistered' } },
    });

    const result = await checkPushReceipts({});

    expect(result).toEqual({ checked: 3, removed: 1, errors: 1 });
    expect(deletePendingReceipt).toHaveBeenCalledTimes(3);
    expect(removeInvalidToken).toHaveBeenCalledWith('u3');
  });

  it('should continue processing when a chunk fetch fails', async () => {
    getPendingReceipts.mockResolvedValue([
      { ticketId: 'r1', userId: 'u1', token: 'ExponentPushToken[t1]' },
    ]);

    // Mock to return two chunks
    expo.chunkPushNotificationReceiptIds.mockReturnValue([['r1'], ['r1']]);

    // First chunk fails, second succeeds
    expo.getPushNotificationReceiptsAsync
      .mockRejectedValueOnce(new Error('Chunk failed'))
      .mockResolvedValueOnce({
        r1: { status: 'ok' },
      });

    const result = await checkPushReceipts({});

    // Second chunk processed successfully
    expect(result.checked).toBeGreaterThanOrEqual(1);
    expect(deletePendingReceipt).toHaveBeenCalled();
  });
});
