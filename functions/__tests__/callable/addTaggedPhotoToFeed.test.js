/**
 * addTaggedPhotoToFeed Callable Function Tests
 *
 * Tests for the addTaggedPhotoToFeed callable Cloud Function:
 * 1. Auth check (unauthenticated)
 * 2. Input validation (missing required fields)
 * 3. Creates new photo document with attribution fields
 * 4. Idempotency (returns existing newPhotoId if already added)
 * 5. Updates message doc with addedToFeedBy map
 * 6. Sends push notification to photographer
 * 7. Does not notify if photographer is the recipient
 * 8. Throws not-found if original photo is deleted
 */

const { initializeFirestore } = require('firebase-admin/firestore');

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

// Get the singleton mock db
const mockDb = initializeFirestore();

// Require the function under test
const { addTaggedPhotoToFeed } = require('../../index');

// Valid FCM token for tests
const VALID_TOKEN = 'ExponentPushToken[test-token-123]';

/**
 * Helper: set up mockDb for addTaggedPhotoToFeed tests.
 */
function setupMockDb(config = {}) {
  const { users = {}, conversationDoc = null, messageDoc = null, photoDoc = null } = config;

  // Track created photo documents
  const mockPhotoAdd = jest.fn().mockResolvedValue({ id: 'new-photo-id' });
  const mockMessageUpdate = jest.fn().mockResolvedValue();

  mockDb.doc.mockImplementation(path => {
    // Handle conversation path: conversations/{id}
    if (path.startsWith('conversations/') && !path.includes('/messages/')) {
      return {
        get: jest.fn().mockResolvedValue(
          conversationDoc || {
            exists: true,
            data: () => ({
              participants: ['tagger-1', 'recipient-1'],
            }),
          }
        ),
        update: jest.fn().mockResolvedValue(),
      };
    }
    return {
      get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
      set: jest.fn().mockResolvedValue(),
      update: jest.fn().mockResolvedValue(),
    };
  });

  mockDb.collection.mockImplementation(collectionName => {
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
        if (collectionName === 'photos') {
          if (photoDoc) {
            return {
              get: jest.fn().mockResolvedValue(photoDoc),
            };
          }
          return {
            get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
          };
        }
        if (collectionName === 'conversations') {
          return {
            get: jest.fn().mockResolvedValue(
              conversationDoc || {
                exists: true,
                data: () => ({ participants: ['tagger-1', 'recipient-1'] }),
              }
            ),
            collection: jest.fn(subName => {
              if (subName === 'messages') {
                return {
                  doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue(
                      messageDoc || {
                        exists: true,
                        data: () => ({
                          type: 'tagged_photo',
                          photoId: 'original-photo-1',
                          senderId: 'tagger-1',
                        }),
                      }
                    ),
                    update: mockMessageUpdate,
                  })),
                };
              }
              return { doc: jest.fn() };
            }),
          };
        }
        return {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        };
      }),
      add:
        collectionName === 'photos' ? mockPhotoAdd : jest.fn().mockResolvedValue({ id: 'mock-id' }),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    };
    return collectionRef;
  });

  return { mockPhotoAdd, mockMessageUpdate };
}

describe('addTaggedPhotoToFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws unauthenticated if no auth context', async () => {
    const request = {
      auth: null,
      data: { photoId: 'photo-1', messageId: 'msg-1', conversationId: 'conv-1' },
    };

    await expect(addTaggedPhotoToFeed(request)).rejects.toThrow('Must be authenticated');
  });

  it('throws invalid-argument for missing photoId, messageId, or conversationId', async () => {
    const request = {
      auth: { uid: 'recipient-1' },
      data: { photoId: 'photo-1' }, // missing messageId and conversationId
    };

    await expect(addTaggedPhotoToFeed(request)).rejects.toThrow(
      'photoId, messageId, and conversationId are required strings'
    );
  });

  it('creates new photo document with attribution fields', async () => {
    const { mockPhotoAdd } = setupMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger User',
          username: 'tagger',
          fcmToken: VALID_TOKEN,
          notificationPreferences: {},
        },
        'recipient-1': {
          displayName: 'Recipient User',
          username: 'recipient',
        },
      },
      conversationDoc: {
        exists: true,
        data: () => ({
          participants: ['recipient-1', 'tagger-1'],
        }),
      },
      messageDoc: {
        exists: true,
        data: () => ({
          type: 'tagged_photo',
          photoId: 'original-photo-1',
          senderId: 'tagger-1',
        }),
      },
      photoDoc: {
        exists: true,
        id: 'original-photo-1',
        data: () => ({
          userId: 'tagger-1',
          imageURL: 'https://photo.url/original.jpg',
          storagePath: 'photos/tagger-1/original.jpg',
          capturedAt: { toDate: () => new Date('2026-02-20') },
          caption: 'Great photo!',
          status: 'triaged',
          photoState: 'journal',
        }),
      },
    });

    const request = {
      auth: { uid: 'recipient-1' },
      data: {
        photoId: 'original-photo-1',
        messageId: 'msg-1',
        conversationId: 'recipient-1_tagger-1',
      },
    };

    const result = await addTaggedPhotoToFeed(request);

    expect(result.success).toBe(true);
    expect(result.newPhotoId).toBe('new-photo-id');

    // Verify the photo document has correct fields
    expect(mockPhotoAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'recipient-1',
        imageURL: 'https://photo.url/original.jpg',
        storagePath: 'photos/tagger-1/original.jpg',
        status: 'triaged',
        photoState: 'journal',
        visibility: 'friends-only',
        reactions: {},
        reactionCount: 0,
        caption: 'Great photo!',
        taggedUserIds: [],
        attribution: expect.objectContaining({
          originalPhotoId: 'original-photo-1',
          photographerId: 'tagger-1',
          photographerUsername: 'tagger',
          photographerDisplayName: 'Tagger User',
        }),
      })
    );
  });

  it('returns existing newPhotoId if already added (idempotency)', async () => {
    setupMockDb({
      users: {
        'tagger-1': { displayName: 'Tagger', username: 'tagger' },
        'recipient-1': { displayName: 'Recipient', username: 'recipient' },
      },
      conversationDoc: {
        exists: true,
        data: () => ({ participants: ['recipient-1', 'tagger-1'] }),
      },
      messageDoc: {
        exists: true,
        data: () => ({
          type: 'tagged_photo',
          photoId: 'original-photo-1',
          senderId: 'tagger-1',
          addedToFeedBy: {
            'recipient-1': {
              newPhotoId: 'existing-photo-id',
              addedAt: new Date(),
            },
          },
        }),
      },
    });

    const { mockPhotoAdd } = setupMockDb({
      users: {
        'tagger-1': { displayName: 'Tagger', username: 'tagger' },
        'recipient-1': { displayName: 'Recipient', username: 'recipient' },
      },
      conversationDoc: {
        exists: true,
        data: () => ({ participants: ['recipient-1', 'tagger-1'] }),
      },
      messageDoc: {
        exists: true,
        data: () => ({
          type: 'tagged_photo',
          photoId: 'original-photo-1',
          senderId: 'tagger-1',
          addedToFeedBy: {
            'recipient-1': {
              newPhotoId: 'existing-photo-id',
              addedAt: new Date(),
            },
          },
        }),
      },
    });

    const request = {
      auth: { uid: 'recipient-1' },
      data: {
        photoId: 'original-photo-1',
        messageId: 'msg-1',
        conversationId: 'recipient-1_tagger-1',
      },
    };

    const result = await addTaggedPhotoToFeed(request);

    // Should return existing photo ID without creating a new one
    expect(result.success).toBe(true);
    expect(result.newPhotoId).toBe('existing-photo-id');
    expect(mockPhotoAdd).not.toHaveBeenCalled();
  });

  it('updates message doc with addedToFeedBy map', async () => {
    const { mockMessageUpdate } = setupMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
          fcmToken: VALID_TOKEN,
          notificationPreferences: {},
        },
        'recipient-1': {
          displayName: 'Recipient',
          username: 'recipient',
        },
      },
      conversationDoc: {
        exists: true,
        data: () => ({ participants: ['recipient-1', 'tagger-1'] }),
      },
      messageDoc: {
        exists: true,
        data: () => ({
          type: 'tagged_photo',
          photoId: 'original-photo-1',
          senderId: 'tagger-1',
        }),
      },
      photoDoc: {
        exists: true,
        id: 'original-photo-1',
        data: () => ({
          userId: 'tagger-1',
          imageURL: 'https://photo.url/original.jpg',
          storagePath: 'photos/tagger-1/original.jpg',
          capturedAt: { toDate: () => new Date() },
          status: 'triaged',
          photoState: 'journal',
        }),
      },
    });

    const request = {
      auth: { uid: 'recipient-1' },
      data: {
        photoId: 'original-photo-1',
        messageId: 'msg-1',
        conversationId: 'recipient-1_tagger-1',
      },
    };

    await addTaggedPhotoToFeed(request);

    // Verify messageRef.update was called with addedToFeedBy
    expect(mockMessageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'addedToFeedBy.recipient-1': expect.objectContaining({
          newPhotoId: 'new-photo-id',
        }),
      })
    );
  });

  it('sends push notification to photographer with exact text', async () => {
    setupMockDb({
      users: {
        'tagger-1': {
          displayName: 'Tagger',
          username: 'tagger',
          fcmToken: VALID_TOKEN,
          notificationPreferences: {},
        },
        'recipient-1': {
          displayName: 'Recipient User',
          username: 'recipient',
        },
      },
      conversationDoc: {
        exists: true,
        data: () => ({ participants: ['recipient-1', 'tagger-1'] }),
      },
      messageDoc: {
        exists: true,
        data: () => ({
          type: 'tagged_photo',
          photoId: 'original-photo-1',
          senderId: 'tagger-1',
        }),
      },
      photoDoc: {
        exists: true,
        id: 'original-photo-1',
        data: () => ({
          userId: 'tagger-1',
          imageURL: 'https://photo.url/original.jpg',
          storagePath: 'photos/tagger-1/original.jpg',
          capturedAt: { toDate: () => new Date() },
          status: 'triaged',
          photoState: 'journal',
        }),
      },
    });

    const request = {
      auth: { uid: 'recipient-1' },
      data: {
        photoId: 'original-photo-1',
        messageId: 'msg-1',
        conversationId: 'recipient-1_tagger-1',
      },
    };

    await addTaggedPhotoToFeed(request);

    // Verify exact notification text (not randomized)
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      VALID_TOKEN,
      'Flick',
      'Recipient User added your photo to their feed',
      expect.objectContaining({
        type: 'photo_reshared',
        originalPhotoId: 'original-photo-1',
      }),
      'tagger-1'
    );
  });

  it('does not notify if photographer is the recipient', async () => {
    setupMockDb({
      users: {
        'user-1': {
          displayName: 'Self User',
          username: 'self',
          fcmToken: VALID_TOKEN,
          notificationPreferences: {},
        },
      },
      conversationDoc: {
        exists: true,
        data: () => ({ participants: ['user-1', 'other-1'] }),
      },
      messageDoc: {
        exists: true,
        data: () => ({
          type: 'tagged_photo',
          photoId: 'original-photo-1',
          senderId: 'other-1',
        }),
      },
      photoDoc: {
        exists: true,
        id: 'original-photo-1',
        data: () => ({
          userId: 'user-1', // Photographer is same as recipient
          imageURL: 'https://photo.url/original.jpg',
          storagePath: 'photos/user-1/original.jpg',
          capturedAt: { toDate: () => new Date() },
          status: 'triaged',
          photoState: 'journal',
        }),
      },
    });

    const request = {
      auth: { uid: 'user-1' },
      data: {
        photoId: 'original-photo-1',
        messageId: 'msg-1',
        conversationId: 'other-1_user-1',
      },
    };

    await addTaggedPhotoToFeed(request);

    // Should NOT send notification when photographer === recipientId
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it('throws not-found if original photo is deleted', async () => {
    setupMockDb({
      users: {
        'tagger-1': { displayName: 'Tagger', username: 'tagger' },
        'recipient-1': { displayName: 'Recipient', username: 'recipient' },
      },
      conversationDoc: {
        exists: true,
        data: () => ({ participants: ['recipient-1', 'tagger-1'] }),
      },
      messageDoc: {
        exists: true,
        data: () => ({
          type: 'tagged_photo',
          photoId: 'deleted-photo-1',
          senderId: 'tagger-1',
        }),
      },
      photoDoc: {
        exists: true,
        id: 'deleted-photo-1',
        data: () => ({
          userId: 'tagger-1',
          imageURL: 'https://photo.url/deleted.jpg',
          photoState: 'deleted',
          status: 'triaged',
        }),
      },
    });

    const request = {
      auth: { uid: 'recipient-1' },
      data: {
        photoId: 'deleted-photo-1',
        messageId: 'msg-1',
        conversationId: 'recipient-1_tagger-1',
      },
    };

    await expect(addTaggedPhotoToFeed(request)).rejects.toThrow('Original photo has been deleted');
  });
});
