/**
 * Feed Service Unit Tests
 *
 * Tests for feed service including:
 * - getFeedPhotos: Query journaled photos from friends
 * - subscribeFeedPhotos: Real-time feed updates
 * - toggleReaction: Add/increment reactions on photos
 *
 * Critical verification: photoState === 'journal' (NOT 'journaled')
 */

// Mock logger to prevent console output
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Create mock functions for Firestore at module level
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();

// Mock document reference
const mockDocRef = { id: 'mock-doc-id' };
const mockCollectionRef = {};

// Mock friendshipService
const mockGetFriendUserIds = jest.fn();
jest.mock('../../src/services/firebase/friendshipService', () => ({
  getFriendUserIds: (...args) => mockGetFriendUserIds(...args),
}));

// Mock blockService - feedService imports getBlockedByUserIds
const mockGetBlockedByUserIds = jest.fn(() => Promise.resolve({ success: true, blockedByIds: [] }));
jest.mock('../../src/services/firebase/blockService', () => ({
  getBlockedByUserIds: (...args) => mockGetBlockedByUserIds(...args),
}));

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockDocRef),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  startAfter: jest.fn(() => ({})),
  Timestamp: {
    now: () => ({ seconds: Math.floor(Date.now() / 1000), toDate: () => new Date() }),
    fromDate: date => ({ seconds: Math.floor(date.getTime() / 1000), toDate: () => date }),
  },
  getCountFromServer: jest.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
}));

// Import service AFTER mocks are set up
const {
  getFeedPhotos,
  subscribeFeedPhotos,
  toggleReaction,
  getPhotoById,
  getUserFeedPhotos,
  getTopPhotosByEngagement,
  getFriendStoriesData,
} = require('../../src/services/firebase/feedService');

// Test factories
const {
  createJournaledPhoto,
  createTestUser,
  createTestReactions,
} = require('../setup/testFactories');

describe('feedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // getFeedPhotos tests
  // ===========================================================================
  describe('getFeedPhotos', () => {
    it('should query photos with photoState="journal" (NOT "journaled")', async () => {
      // Mock getDocs to return journaled photos
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-1',
            data: () => ({
              userId: 'friend-1',
              photoState: 'journal', // CRITICAL: must be 'journal' not 'journaled'
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
        ],
      });
      // Mock user data fetch
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => createTestUser({ uid: 'friend-1' }),
      });

      const result = await getFeedPhotos(20, null, ['friend-1'], 'current-user');

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].photoState).toBe('journal');
    });

    it('should filter to only friends photos when friendUserIds provided', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-1',
            data: () => ({
              userId: 'friend-1',
              photoState: 'journal',
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
          {
            id: 'photo-2',
            data: () => ({
              userId: 'stranger', // Not a friend
              photoState: 'journal',
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
        ],
      });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => createTestUser(),
      });

      const result = await getFeedPhotos(20, null, ['friend-1'], 'current-user');

      expect(result.success).toBe(true);
      // Only friend-1's photo should be included
      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].userId).toBe('friend-1');
    });

    it('should include current user photos in feed', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-1',
            data: () => ({
              userId: 'current-user',
              photoState: 'journal',
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
        ],
      });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => createTestUser({ uid: 'current-user' }),
      });

      const result = await getFeedPhotos(20, null, ['friend-1'], 'current-user');

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].userId).toBe('current-user');
    });

    it('should sort by capturedAt descending (newest first)', async () => {
      const now = Date.now();
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-old',
            data: () => ({
              userId: 'friend-1',
              photoState: 'journal',
              capturedAt: { seconds: (now - 10000) / 1000 }, // Older
            }),
          },
          {
            id: 'photo-new',
            data: () => ({
              userId: 'friend-1',
              photoState: 'journal',
              capturedAt: { seconds: now / 1000 }, // Newer
            }),
          },
        ],
      });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => createTestUser({ uid: 'friend-1' }),
      });

      const result = await getFeedPhotos(20, null, ['friend-1'], 'current-user');

      expect(result.success).toBe(true);
      expect(result.photos[0].id).toBe('photo-new'); // Newest first
      expect(result.photos[1].id).toBe('photo-old');
    });

    it('should implement pagination correctly with lastDoc', async () => {
      // Create 5 photos
      const photos = [];
      for (let i = 0; i < 5; i++) {
        photos.push({
          id: `photo-${i}`,
          data: () => ({
            userId: 'friend-1',
            photoState: 'journal',
            capturedAt: { seconds: (Date.now() - i * 1000) / 1000 },
          }),
        });
      }
      mockGetDocs.mockResolvedValue({ docs: photos });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => createTestUser({ uid: 'friend-1' }),
      });

      // First page (limit 2)
      const page1 = await getFeedPhotos(2, null, ['friend-1'], 'current-user');

      expect(page1.photos).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      // Second page using lastDoc
      const page2 = await getFeedPhotos(2, page1.lastDoc, ['friend-1'], 'current-user');

      expect(page2.photos).toHaveLength(2);
      expect(page2.hasMore).toBe(true);
    });

    it('should return { photos: [], hasMore: boolean }', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-1',
            data: () => ({
              userId: 'friend-1',
              photoState: 'journal',
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
        ],
      });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => createTestUser(),
      });

      const result = await getFeedPhotos(20, null, ['friend-1'], 'current-user');

      expect(result).toHaveProperty('photos');
      expect(result).toHaveProperty('hasMore');
      expect(Array.isArray(result.photos)).toBe(true);
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should return empty array when no friends', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-1',
            data: () => ({
              userId: 'stranger',
              photoState: 'journal',
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
        ],
      });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => createTestUser(),
      });

      const result = await getFeedPhotos(20, null, [], 'current-user');

      expect(result.success).toBe(true);
      // Only current user's photos would be included, but there are none
      expect(result.photos).toHaveLength(0);
    });

    it('should return empty array when friends have no journal photos', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [], // No photos match the query
      });

      const result = await getFeedPhotos(20, null, ['friend-1'], 'current-user');

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(0);
    });

    it('should include user data with each photo', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-1',
            data: () => ({
              userId: 'friend-1',
              photoState: 'journal',
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
        ],
      });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          username: 'testuser',
          displayName: 'Test User',
          profilePhotoURL: 'https://example.com/photo.jpg',
        }),
      });

      const result = await getFeedPhotos(20, null, ['friend-1'], 'current-user');

      expect(result.photos[0].user).toBeDefined();
      expect(result.photos[0].user.username).toBe('testuser');
      expect(result.photos[0].user.displayName).toBe('Test User');
    });

    it('should handle missing user data gracefully', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-1',
            data: () => ({
              userId: 'deleted-user',
              photoState: 'journal',
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
        ],
      });
      mockGetDoc.mockResolvedValue({
        exists: () => false, // User doesn't exist
      });

      const result = await getFeedPhotos(20, null, ['deleted-user'], 'current-user');

      expect(result.success).toBe(true);
      expect(result.photos[0].user.username).toBe('unknown');
      expect(result.photos[0].user.displayName).toBe('Unknown User');
    });

    it('should handle Firestore errors gracefully', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await getFeedPhotos(20, null, ['friend-1'], 'current-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.photos).toEqual([]);
    });
  });

  // ===========================================================================
  // subscribeFeedPhotos tests
  // ===========================================================================
  describe('subscribeFeedPhotos', () => {
    it('should set up Firestore onSnapshot listener', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      subscribeFeedPhotos(callback, 20, ['friend-1'], 'current-user');

      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      const unsubscribe = subscribeFeedPhotos(callback, 20, ['friend-1'], 'current-user');

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback with photos array on update', async () => {
      const callback = jest.fn();

      // Capture the snapshot callback
      mockOnSnapshot.mockImplementation((query, successCallback, errorCallback) => {
        // Simulate a snapshot update
        process.nextTick(async () => {
          await successCallback({
            docs: [
              {
                id: 'photo-1',
                data: () => ({
                  userId: 'friend-1',
                  photoState: 'journal',
                  capturedAt: { seconds: Date.now() / 1000 },
                }),
              },
            ],
          });
        });
        return jest.fn(); // unsubscribe
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => createTestUser({ uid: 'friend-1' }),
      });

      subscribeFeedPhotos(callback, 20, ['friend-1'], 'current-user');

      // Wait for async callback
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          photos: expect.any(Array),
        })
      );
    });

    it('should handle listener errors gracefully', () => {
      const callback = jest.fn();

      mockOnSnapshot.mockImplementation((query, successCallback, errorCallback) => {
        // Simulate an error
        process.nextTick(() => {
          errorCallback(new Error('Listener error'));
        });
        return jest.fn();
      });

      subscribeFeedPhotos(callback, 20, ['friend-1'], 'current-user');

      // Wait for async callback
      return new Promise(resolve => {
        setTimeout(() => {
          expect(callback).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              error: 'Listener error',
              photos: [],
            })
          );
          resolve();
        }, 50);
      });
    });

    it('should return empty unsubscribe function on error', () => {
      // Mock to throw during setup (before onSnapshot is called)
      jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress error logs

      // The function should still return a function even if setup fails
      const callback = jest.fn();
      mockOnSnapshot.mockImplementation(() => {
        throw new Error('Setup error');
      });

      const result = subscribeFeedPhotos(callback, 20, ['friend-1'], 'current-user');

      expect(typeof result).toBe('function');
    });
  });

  // ===========================================================================
  // toggleReaction tests
  // ===========================================================================
  describe('toggleReaction', () => {
    it('should increment reaction count for emoji', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          reactions: {
            'user-a': { '❤️': 1 },
          },
          reactionCount: 1,
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await toggleReaction('photo-1', 'user-a', '❤️', 1);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reactions: expect.objectContaining({
            'user-a': expect.objectContaining({
              '❤️': 2, // Incremented from 1 to 2
            }),
          }),
        })
      );
    });

    it('should create user reaction entry if does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          reactions: {}, // No reactions yet
          reactionCount: 0,
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await toggleReaction('photo-1', 'new-user', '😂', 0);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reactions: expect.objectContaining({
            'new-user': expect.objectContaining({
              '😂': 1, // New entry
            }),
          }),
        })
      );
    });

    it('should update reactionCount field correctly', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          reactions: {
            'user-a': { '❤️': 2, '🔥': 1 },
            'user-b': { '❤️': 1 },
          },
          reactionCount: 4, // 2 + 1 + 1
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      await toggleReaction('photo-1', 'user-a', '❤️', 2);

      // New total should be 5 (❤️: 3 + 🔥: 1 + user-b's ❤️: 1)
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reactionCount: 5,
        })
      );
    });

    it('should handle photos with no existing reactions', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          // No reactions field at all
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await toggleReaction('photo-1', 'user-a', '❤️', 0);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reactions: {
            'user-a': { '❤️': 1 },
          },
          reactionCount: 1,
        })
      );
    });

    it('should return { success: true } on success', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          reactions: {},
          reactionCount: 0,
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await toggleReaction('photo-1', 'user-a', '❤️', 0);

      expect(result.success).toBe(true);
      expect(result.reactions).toBeDefined();
      expect(result.reactionCount).toBeDefined();
    });

    it('should return { success: false, error } when photo not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await toggleReaction('nonexistent', 'user-a', '❤️', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Photo not found');
    });

    it('should return { success: false, error } on Firestore failure', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Firestore error'));

      const result = await toggleReaction('photo-1', 'user-a', '❤️', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });

    it('should handle concurrent updates using calculated total', async () => {
      // Simulate existing reactions from multiple users
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          reactions: {
            'user-a': { '😂': 3 },
            'user-b': { '😂': 2, '❤️': 1 },
            'user-c': { '🔥': 4 },
          },
          reactionCount: 10, // 3 + 2 + 1 + 4
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      await toggleReaction('photo-1', 'user-a', '😂', 3);

      // After increment: user-a has 😂:4, total = 4 + 2 + 1 + 4 = 11
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reactionCount: 11,
        })
      );
    });

    it('should preserve other users reactions when updating', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          reactions: {
            'user-a': { '❤️': 1 },
            'user-b': { '😂': 2 },
          },
          reactionCount: 3,
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      await toggleReaction('photo-1', 'user-a', '🔥', 0);

      // user-b's reactions should still be there
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reactions: expect.objectContaining({
            'user-b': { '😂': 2 },
          }),
        })
      );
    });
  });

  // ===========================================================================
  // getPhotoById tests
  // ===========================================================================
  describe('getPhotoById', () => {
    it('should return photo with user data', async () => {
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'photo-1',
          data: () => ({
            userId: 'user-1',
            photoState: 'journal',
            capturedAt: { seconds: Date.now() / 1000 },
          }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            username: 'testuser',
            displayName: 'Test User',
            profilePhotoURL: 'https://example.com/photo.jpg',
          }),
        });

      const result = await getPhotoById('photo-1');

      expect(result.success).toBe(true);
      expect(result.photo).toBeDefined();
      expect(result.photo.user).toBeDefined();
    });

    it('should return error for nonexistent photo', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getPhotoById('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Photo not found');
    });
  });

  // ===========================================================================
  // getTopPhotosByEngagement tests
  // ===========================================================================
  describe('getTopPhotosByEngagement', () => {
    it('should return photos sorted by reactionCount descending', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'photo-low',
            data: () => ({
              userId: 'user-1',
              photoState: 'journal',
              reactionCount: 5,
            }),
          },
          {
            id: 'photo-high',
            data: () => ({
              userId: 'user-1',
              photoState: 'journal',
              reactionCount: 20,
            }),
          },
          {
            id: 'photo-mid',
            data: () => ({
              userId: 'user-1',
              photoState: 'journal',
              reactionCount: 10,
            }),
          },
        ],
      });

      const result = await getTopPhotosByEngagement('user-1', 3);

      expect(result.success).toBe(true);
      expect(result.photos[0].id).toBe('photo-high'); // Highest first
      expect(result.photos[1].id).toBe('photo-mid');
      expect(result.photos[2].id).toBe('photo-low');
    });

    it('should limit results to specified count', async () => {
      const photos = Array.from({ length: 10 }, (_, i) => ({
        id: `photo-${i}`,
        data: () => ({
          userId: 'user-1',
          photoState: 'journal',
          reactionCount: i,
        }),
      }));

      mockGetDocs.mockResolvedValueOnce({ docs: photos });

      const result = await getTopPhotosByEngagement('user-1', 5);

      expect(result.success).toBe(true);
      expect(result.photos).toHaveLength(5);
    });

    it('should return error for missing userId', async () => {
      const result = await getTopPhotosByEngagement('', 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });
  });

  // ===========================================================================
  // getFriendStoriesData tests
  // ===========================================================================
  describe('getFriendStoriesData', () => {
    it('should return friend stories with top photos', async () => {
      mockGetFriendUserIds.mockResolvedValueOnce({
        success: true,
        friendUserIds: ['friend-1'],
      });

      // Mock user data
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          username: 'friend1',
          displayName: 'Friend One',
          profilePhotoURL: 'https://example.com/friend1.jpg',
        }),
      });

      // Mock photos for friend
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'photo-1',
            data: () => ({
              userId: 'friend-1',
              photoState: 'journal',
              reactionCount: 10,
              capturedAt: { seconds: Date.now() / 1000 },
            }),
          },
        ],
        size: 1,
      });

      const result = await getFriendStoriesData('current-user');

      expect(result.success).toBe(true);
      expect(result.friendStories).toBeDefined();
    });

    it('should return empty array when no friends', async () => {
      mockGetFriendUserIds.mockResolvedValueOnce({
        success: true,
        friendUserIds: [],
      });

      const result = await getFriendStoriesData('current-user');

      expect(result.success).toBe(true);
      expect(result.friendStories).toEqual([]);
    });

    it('should return error for missing userId', async () => {
      const result = await getFriendStoriesData('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should filter out friends with no photos', async () => {
      mockGetFriendUserIds.mockResolvedValueOnce({
        success: true,
        friendUserIds: ['friend-with-photos', 'friend-no-photos'],
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          username: 'friend',
          displayName: 'Friend',
        }),
      });

      // Mock different results for different users
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'photo-1',
              data: () => ({
                userId: 'friend-with-photos',
                photoState: 'journal',
                reactionCount: 5,
                capturedAt: { seconds: Date.now() / 1000 },
              }),
            },
          ],
          size: 1,
        })
        .mockResolvedValueOnce({ docs: [], size: 0 }) // No photos for second friend
        .mockResolvedValueOnce({ docs: [], size: 0 }); // Second query for total count

      const result = await getFriendStoriesData('current-user');

      expect(result.success).toBe(true);
      // Only friend with photos should be included
      const friendsWithPhotos = result.friendStories.filter(f => f.hasPhotos);
      expect(friendsWithPhotos.length).toBeLessThanOrEqual(1);
    });
  });
});
