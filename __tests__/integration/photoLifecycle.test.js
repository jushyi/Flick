/**
 * Photo Lifecycle Integration Tests
 *
 * Tests the complete photo lifecycle:
 * 1. Photo Capture → Developing flow
 * 2. Developing → Reveal flow
 * 3. Reveal → Triage flow
 * 4. Triage → Feed flow
 * 5. Delete flow
 *
 * These tests verify that services work correctly together
 * for the most critical user journey in the app.
 */

// Import test factories
const {
  createTestUser,
  createTestPhoto,
  createJournaledPhoto,
  createTestDarkroom,
  createTimestamp,
} = require('../setup/testFactories');

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Storage service mocks
const mockUploadPhoto = jest.fn();
const mockDeletePhoto = jest.fn();
jest.mock('../../src/services/firebase/storageService', () => ({
  uploadPhoto: (...args) => mockUploadPhoto(...args),
  deletePhoto: (...args) => mockDeletePhoto(...args),
}));

// Album service mock - photoService imports getUserAlbums, removePhotoFromAlbum, deleteAlbum
jest.mock('../../src/services/firebase/albumService', () => ({
  getUserAlbums: jest.fn(() => Promise.resolve({ success: true, albums: [] })),
  removePhotoFromAlbum: jest.fn(() => Promise.resolve({ success: true })),
  deleteAlbum: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock performanceService - photoService and feedService use withTrace
jest.mock('../../src/services/firebase/performanceService', () => ({
  withTrace: jest.fn((name, fn) => fn()),
}));

// Mock blockService - feedService imports getBlockedByUserIds
jest.mock('../../src/services/firebase/blockService', () => ({
  getBlockedByUserIds: jest.fn(() => Promise.resolve({ success: true, blockedByUserIds: [] })),
}));

// Firestore mocks
const mockAddDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockOnSnapshot = jest.fn();
const mockOr = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  or: (...args) => mockOr(...args),
  limit: jest.fn(() => ({})),
  serverTimestamp: () => ({ _serverTimestamp: true }),
  writeBatch: jest.fn(() => ({
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    commit: jest.fn(() => Promise.resolve()),
  })),
  Timestamp: {
    now: () => ({
      seconds: Math.floor(Date.now() / 1000),
      toDate: () => new Date(),
    }),
    fromDate: date => ({
      seconds: Math.floor(date.getTime() / 1000),
      toDate: () => date,
    }),
  },
  FieldValue: {
    serverTimestamp: () => ({ _serverTimestamp: true }),
    increment: n => ({ _increment: n }),
    arrayUnion: (...items) => ({ _arrayUnion: items }),
    arrayRemove: (...items) => ({ _arrayRemove: items }),
    delete: () => ({ _delete: true }),
  },
  getCountFromServer: jest.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
  startAfter: jest.fn(() => ({})),
}));

// Import services AFTER mocks are set up
const {
  createPhoto,
  revealPhotos,
  triagePhoto,
  batchTriagePhotos,
} = require('../../src/services/firebase/photoService');

const {
  getDarkroom,
  isDarkroomReadyToReveal,
  scheduleNextReveal,
  ensureDarkroomInitialized,
} = require('../../src/services/firebase/darkroomService');

const { getFeedPhotos } = require('../../src/services/firebase/feedService');

describe('Photo Lifecycle Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock returns
    mockQuery.mockReturnValue({ _query: true });
    mockCollection.mockReturnValue({ _collection: true });
    mockDoc.mockReturnValue({ _doc: true, id: 'test-doc-id' });
  });

  describe('1. Photo Capture → Developing flow', () => {
    it('should create photo with developing status and call ensureDarkroomInitialized', async () => {
      // Arrange
      const mockPhotoId = 'new-photo-123';
      const mockUser = createTestUser({ uid: 'user-capture-1' });

      mockAddDoc.mockResolvedValueOnce({ id: mockPhotoId });
      mockUploadPhoto.mockResolvedValueOnce({
        success: true,
        url: 'https://mock-storage.com/photo.jpg',
        size: 1024,
      });
      mockUpdateDoc.mockResolvedValueOnce();

      // For ensureDarkroomInitialized - darkroom exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestDarkroom({ userId: mockUser.uid }),
      });

      // Act
      const result = await createPhoto(mockUser.uid, 'file://local-photo.jpg');

      // Assert
      expect(result.success).toBe(true);
      expect(result.photoId).toBe(mockPhotoId);
      expect(mockUploadPhoto).toHaveBeenCalledWith(
        mockUser.uid,
        mockPhotoId,
        'file://local-photo.jpg'
      );
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should roll back photo document if storage upload fails', async () => {
      // Arrange
      const photoRef = { id: 'rollback-photo-123' };
      mockAddDoc.mockResolvedValueOnce(photoRef);
      mockUploadPhoto.mockResolvedValueOnce({
        success: false,
        error: 'Upload failed',
      });
      mockDeleteDoc.mockResolvedValueOnce();

      // Act
      const result = await createPhoto('user-123', 'file://local-photo.jpg');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
      expect(mockDeleteDoc).toHaveBeenCalledWith(photoRef);
    });

    it('should create photo with correct initial fields', async () => {
      // Arrange
      const mockPhotoId = 'init-fields-photo';
      let capturedDocData = null;

      mockAddDoc.mockImplementationOnce(async (collectionRef, data) => {
        capturedDocData = data;
        return { id: mockPhotoId };
      });
      mockUploadPhoto.mockResolvedValueOnce({
        success: true,
        url: 'https://example.com/photo.jpg',
      });
      mockUpdateDoc.mockResolvedValueOnce();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestDarkroom({ userId: 'user-init' }),
      });

      // Act
      await createPhoto('user-init', 'file://photo.jpg');

      // Assert
      expect(capturedDocData).toMatchObject({
        userId: 'user-init',
        status: 'developing',
        photoState: null,
        visibility: 'friends-only',
        reactions: {},
        reactionCount: 0,
      });
    });
  });

  describe('2. Developing → Reveal flow', () => {
    it('should reveal all developing photos', async () => {
      // Arrange
      const mockUser = createTestUser({ uid: 'user-reveal-1' });
      const developingPhotos = [
        createTestPhoto({ id: 'photo-1', userId: mockUser.uid }),
        createTestPhoto({ id: 'photo-2', userId: mockUser.uid }),
        createTestPhoto({ id: 'photo-3', userId: mockUser.uid }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: developingPhotos.map(photo => ({
          id: photo.id,
          ref: { id: photo.id },
          data: () => photo,
        })),
        size: 3,
      });
      mockUpdateDoc.mockResolvedValue();

      // Act
      const result = await revealPhotos(mockUser.uid);

      // Assert
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(3);
    });

    it('should handle empty developing photos gracefully', async () => {
      // Arrange
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
        size: 0,
      });

      // Act
      const result = await revealPhotos('user-empty');

      // Assert
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });

    it('should check darkroom readiness before reveal', async () => {
      // Arrange - Darkroom ready (nextRevealAt in the past)
      // Use a timestamp that's definitely in the past (1 hour ago)
      const pastTime = Math.floor(Date.now() / 1000) - 3600;
      const readyDarkroom = {
        userId: 'user-ready',
        nextRevealAt: { seconds: pastTime, toDate: () => new Date(pastTime * 1000) },
        lastRevealedAt: null,
        createdAt: { seconds: pastTime - 3600 },
      };
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => readyDarkroom,
      });

      // Act
      const isReady = await isDarkroomReadyToReveal('user-ready');

      // Assert
      expect(isReady).toBe(true);
    });

    it('should return false when darkroom is not ready', async () => {
      // Arrange - Darkroom with future nextRevealAt
      const futureDarkroom = createTestDarkroom({
        userId: 'user-future',
        nextRevealAt: createTimestamp(Date.now() + 5 * 60 * 1000),
      });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => futureDarkroom,
      });

      // Act
      const isReady = await isDarkroomReadyToReveal('user-future');

      // Assert
      expect(isReady).toBe(false);
    });

    it('should schedule next reveal after revealing photos', async () => {
      // Arrange
      mockUpdateDoc.mockResolvedValueOnce();

      // Act
      const result = await scheduleNextReveal('user-schedule');

      // Assert
      expect(result.success).toBe(true);
      expect(result.nextRevealAt).toBeDefined();
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('3. Reveal → Triage flow', () => {
    it('should triage photo to journal state', async () => {
      // Arrange - journal action needs to read photo first for month calculation
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ capturedAt: { seconds: Date.now() / 1000, toDate: () => new Date() } }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      // Act
      const result = await triagePhoto('photo-triage-1', 'journal');

      // Assert
      expect(result.success).toBe(true);
      expect(mockGetDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'triaged',
          photoState: 'journal',
          month: expect.any(String),
        })
      );
    });

    it('should triage photo to archive state', async () => {
      // Arrange - archive action needs to read photo first for month calculation
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ capturedAt: { seconds: Date.now() / 1000, toDate: () => new Date() } }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      // Act
      const result = await triagePhoto('photo-triage-2', 'archive');

      // Assert
      expect(result.success).toBe(true);
      expect(mockGetDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'triaged',
          photoState: 'archive',
        })
      );
    });

    it('should soft delete photo when action is delete', async () => {
      // Arrange - delete action does NOT call getDoc, just updates with soft delete fields
      mockUpdateDoc.mockResolvedValueOnce();

      // Act
      const result = await triagePhoto('photo-delete-1', 'delete');

      // Assert
      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'triaged',
          photoState: 'deleted',
          scheduledForPermanentDeletionAt: expect.anything(),
        })
      );
      // Soft delete does NOT call deletePhoto or deleteDoc
      expect(mockDeletePhoto).not.toHaveBeenCalled();
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('should batch triage multiple photos', async () => {
      // Arrange
      const decisions = [
        { photoId: 'batch-1', action: 'journal' },
        { photoId: 'batch-2', action: 'archive' },
        { photoId: 'batch-3', action: 'journal' },
      ];
      // Mock getDoc for each journal/archive action (3 calls)
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ capturedAt: { seconds: Date.now() / 1000, toDate: () => new Date() } }),
      });
      mockUpdateDoc.mockResolvedValue();

      // Act
      const result = await batchTriagePhotos(decisions);

      // Assert
      expect(result.success).toBe(true);
      // Each triage action calls getDoc (for month) and updateDoc
      expect(mockGetDoc).toHaveBeenCalledTimes(3);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(3);
    });
  });

  describe('4. Triage → Feed flow', () => {
    it('should show journaled photos in feed for friends', async () => {
      // Arrange
      const userA = createTestUser({ uid: 'user-a-feed' });
      const userAPhoto = createJournaledPhoto({
        id: 'feed-photo-1',
        userId: userA.uid,
      });

      // Query returns journaled photos
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: userAPhoto.id,
            data: () => userAPhoto,
          },
        ],
        size: 1,
      });

      // getDoc for user data
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => userA,
      });

      // Act
      const result = await getFeedPhotos(20, null, [userA.uid], 'user-b-feed');

      // Assert
      expect(result.success).toBe(true);
      expect(result.photos.length).toBe(1);
      expect(result.photos[0].userId).toBe(userA.uid);
      expect(result.photos[0].photoState).toBe('journal');
    });

    it('should NOT show archived photos in feed', async () => {
      // Arrange - Query for journal photos returns empty
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
        size: 0,
      });

      // Act
      const result = await getFeedPhotos(20, null, ['user-archived'], 'viewer-user');

      // Assert
      expect(result.success).toBe(true);
      expect(result.photos.length).toBe(0);
    });

    it('should filter feed by friendship status - non-friends excluded', async () => {
      // Arrange
      const nonFriendPhoto = createJournaledPhoto({
        id: 'nonfriend-photo',
        userId: 'user-not-friend',
      });

      // Query returns photo from non-friend
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: nonFriendPhoto.id,
            data: () => nonFriendPhoto,
          },
        ],
        size: 1,
      });

      // getDoc for user data
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestUser({ uid: 'user-not-friend' }),
      });

      // Act - Get feed with empty friend list
      const result = await getFeedPhotos(20, null, [], 'user-viewer');

      // Assert - Non-friend's photo NOT in feed
      expect(result.success).toBe(true);
      expect(result.photos.length).toBe(0);
    });

    it('should return empty feed when user has no friends', async () => {
      // Arrange - getFeedPhotos returns early when friendUserIds is empty
      const user = createTestUser({ uid: 'self-user' });

      // Act - empty friend list means no feed content (feed is 100% friend activity)
      const result = await getFeedPhotos(20, null, [], user.uid);

      // Assert
      expect(result.success).toBe(true);
      expect(result.photos.length).toBe(0);
      expect(result.hasMore).toBe(false);
      // getDocs should not be called when friendUserIds is empty
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('should sort feed photos by triagedAt descending (newest first)', async () => {
      // Arrange
      const userA = createTestUser({ uid: 'friend-a' });
      const userB = createTestUser({ uid: 'viewer-b' });
      const olderPhoto = createJournaledPhoto({
        id: 'older-photo',
        userId: userA.uid,
        triagedAt: { seconds: 1000 },
      });
      const newerPhoto = createJournaledPhoto({
        id: 'newer-photo',
        userId: userA.uid,
        triagedAt: { seconds: 2000 },
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: olderPhoto.id, data: () => olderPhoto },
          { id: newerPhoto.id, data: () => newerPhoto },
        ],
        size: 2,
      });

      mockGetDoc
        .mockResolvedValueOnce({ exists: () => true, data: () => userA })
        .mockResolvedValueOnce({ exists: () => true, data: () => userA });

      // Act - User B viewing friend A's feed
      const result = await getFeedPhotos(20, null, [userA.uid], userB.uid);

      // Assert - Newer photo should be first (sorted by triagedAt)
      expect(result.success).toBe(true);
      expect(result.photos.length).toBe(2);
      expect(result.photos[0].id).toBe('newer-photo');
      expect(result.photos[1].id).toBe('older-photo');
    });
  });

  describe('5. Delete flow', () => {
    it('should soft delete photo with 30-day grace period', async () => {
      // Arrange - delete action uses soft delete (updateDoc, not deleteDoc/deletePhoto)
      mockUpdateDoc.mockResolvedValueOnce();

      // Act
      const result = await triagePhoto('delete-full-1', 'delete');

      // Assert
      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'triaged',
          photoState: 'deleted',
          scheduledForPermanentDeletionAt: expect.anything(),
        })
      );
      // Soft delete does NOT immediately call deletePhoto or deleteDoc
      expect(mockDeletePhoto).not.toHaveBeenCalled();
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('should handle delete update failure', async () => {
      // Arrange
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update error'));

      // Act
      const result = await triagePhoto('delete-fail-1', 'delete');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Update error');
    });
  });

  describe('End-to-End Photo Lifecycle', () => {
    it('should complete full lifecycle: capture → develop → reveal → triage → feed', async () => {
      const userId = 'e2e-user-1';
      const photoId = 'e2e-photo-1';

      // Step 1: Create photo (developing status)
      mockAddDoc.mockResolvedValueOnce({ id: photoId });
      mockUploadPhoto.mockResolvedValueOnce({
        success: true,
        url: 'https://storage.example.com/photo.jpg',
        size: 1024,
      });
      mockUpdateDoc.mockResolvedValue();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestDarkroom({ userId }),
      });

      const createResult = await createPhoto(userId, 'file://e2e-photo.jpg');
      expect(createResult.success).toBe(true);
      expect(createResult.photoId).toBe(photoId);

      // Step 2: Reveal photos
      const developingPhoto = createTestPhoto({ id: photoId, userId, status: 'developing' });
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: photoId, ref: { id: photoId }, data: () => developingPhoto }],
        size: 1,
      });

      const revealResult = await revealPhotos(userId);
      expect(revealResult.success).toBe(true);
      expect(revealResult.count).toBe(1);

      // Step 3: Triage to journal - needs getDoc for month calculation
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ capturedAt: { seconds: Date.now() / 1000, toDate: () => new Date() } }),
      });
      const triageResult = await triagePhoto(photoId, 'journal');
      expect(triageResult.success).toBe(true);

      // Step 4: Photo appears in feed (for a friend, not self - feed excludes own photos)
      const friendId = 'friend-of-e2e-user';
      const journaledPhoto = createJournaledPhoto({ id: photoId, userId });
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: photoId, data: () => journaledPhoto }],
        size: 1,
      });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestUser({ uid: userId }),
      });

      // Friend viewing the feed (userId's photo in friend's feed)
      const feedResult = await getFeedPhotos(20, null, [userId], friendId);
      expect(feedResult.success).toBe(true);
      expect(feedResult.photos.length).toBe(1);
      expect(feedResult.photos[0].id).toBe(photoId);
      expect(feedResult.photos[0].photoState).toBe('journal');
    });
  });

  describe('Darkroom Integration', () => {
    it('should create darkroom when it does not exist', async () => {
      // Arrange - darkroom doesn't exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });
      mockSetDoc.mockResolvedValueOnce();

      // Act
      const result = await getDarkroom('new-user');

      // Assert
      expect(result.success).toBe(true);
      expect(result.darkroom).toBeDefined();
      expect(result.darkroom.userId).toBe('new-user');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should return existing darkroom', async () => {
      // Arrange - darkroom exists
      const existingDarkroom = createTestDarkroom({ userId: 'existing-user' });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingDarkroom,
      });

      // Act
      const result = await getDarkroom('existing-user');

      // Assert
      expect(result.success).toBe(true);
      expect(result.darkroom.userId).toBe('existing-user');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should reveal overdue photos when initializing stale darkroom', async () => {
      // Arrange - stale darkroom (nextRevealAt definitely in the past)
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const staleDarkroom = {
        userId: 'stale-user',
        nextRevealAt: {
          seconds: pastTime,
          toDate: () => new Date(pastTime * 1000),
        },
        lastRevealedAt: null,
        createdAt: { seconds: pastTime - 3600 },
      };
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => staleDarkroom,
      });

      // Developing photos to reveal
      const overduePhoto = createTestPhoto({ id: 'overdue-1', userId: 'stale-user' });
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: overduePhoto.id, ref: { id: overduePhoto.id }, data: () => overduePhoto }],
        size: 1,
      });

      mockUpdateDoc.mockResolvedValue();

      // Act
      const result = await ensureDarkroomInitialized('stale-user');

      // Assert
      expect(result.success).toBe(true);
      expect(result.refreshed).toBe(true);
      expect(result.revealed).toBe(1);
    });
  });
});
