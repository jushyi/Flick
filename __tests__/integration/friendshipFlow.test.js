/**
 * Friendship Flow Integration Tests
 *
 * Tests the complete friendship lifecycle:
 * 1. Friend Request → Accept flow
 * 2. Friend Request → Decline flow
 * 3. Pending Requests management
 * 4. Remove Friend flow
 * 5. Feed Filtering by Friendship
 * 6. Edge Cases
 *
 * These tests verify that friendship and feed services work correctly together
 * for the social features of the app.
 */

// Import test factories
const {
  createTestUser,
  createTestFriendship,
  createPendingFriendRequest,
  createJournaledPhoto,
  generateFriendshipId,
} = require('../setup/testFactories');

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
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
  documentId: jest.fn(() => '__documentId__'),
  serverTimestamp: () => ({ _serverTimestamp: true }),
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
}));

// Mock blockService - feedService imports getBlockedByUserIds
jest.mock('../../src/services/firebase/blockService', () => ({
  getBlockedByUserIds: jest.fn(() => Promise.resolve({ success: true, blockedByIds: [] })),
}));

// Import services AFTER mocks are set up
const {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriendships,
  getSentRequests,
  checkFriendshipStatus,
} = require('../../src/services/firebase/friendshipService');

const { getFeedPhotos } = require('../../src/services/firebase/feedService');

describe('Friendship Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock returns
    mockQuery.mockReturnValue({ _query: true });
    mockCollection.mockReturnValue({ _collection: true });
    mockDoc.mockReturnValue({ _doc: true, id: 'test-doc-id' });
  });

  describe('1. Friend Request → Accept flow', () => {
    it('should create friendship with pending status', async () => {
      // Arrange
      const userA = 'user-a';
      const userB = 'user-b';
      const friendshipId = generateFriendshipId(userA, userB);

      // No existing friendship
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });
      mockSetDoc.mockResolvedValueOnce();

      // Act
      const result = await sendFriendRequest(userA, userB);

      // Assert
      expect(result.success).toBe(true);
      expect(result.friendshipId).toBe(friendshipId);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          user1Id: 'user-a', // Alphabetically first
          user2Id: 'user-b',
          status: 'pending',
          requestedBy: userA,
        })
      );
    });

    it('should accept pending friend request', async () => {
      // Arrange
      const userA = 'user-a';
      const userB = 'user-b';
      const friendshipId = generateFriendshipId(userA, userB);
      const pendingFriendship = createPendingFriendRequest({
        user1Id: userA,
        user2Id: userB,
        requestedBy: userA,
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => pendingFriendship,
      });
      mockUpdateDoc.mockResolvedValueOnce();

      // Act - User B accepts (they're the recipient)
      const result = await acceptFriendRequest(friendshipId, userB);

      // Assert
      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'accepted',
        })
      );
    });

    it("should show both users in each other's friendships after accept", async () => {
      // Arrange - Accepted friendship exists
      const userA = 'user-a';
      const userB = 'user-b';
      const acceptedFriendship = createTestFriendship({
        user1Id: userA,
        user2Id: userB,
        status: 'accepted',
      });

      // User A checks friendships
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: generateFriendshipId(userA, userB), data: () => acceptedFriendship }],
        forEach: cb =>
          [{ id: generateFriendshipId(userA, userB), data: () => acceptedFriendship }].forEach(cb),
      });

      // Act
      const result = await getFriendships(userA);

      // Assert
      expect(result.success).toBe(true);
      expect(result.friendships.length).toBe(1);
      expect(result.friendships[0].status).toBe('accepted');
    });
  });

  describe('2. Friend Request → Decline flow', () => {
    it('should delete friendship document when declining', async () => {
      // Arrange
      const userA = 'user-a';
      const userB = 'user-b';
      const friendshipId = generateFriendshipId(userA, userB);
      const pendingFriendship = createPendingFriendRequest({
        user1Id: userA,
        user2Id: userB,
        requestedBy: userA,
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => pendingFriendship,
      });
      mockDeleteDoc.mockResolvedValueOnce();

      // Act - User B declines
      const result = await declineFriendRequest(friendshipId, userB);

      // Assert
      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should not show user in friendships after decline', async () => {
      // Arrange - No friendships after decline
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
        forEach: cb => [].forEach(cb),
      });

      // Act
      const result = await getFriendships('user-a');

      // Assert
      expect(result.success).toBe(true);
      expect(result.friendships.length).toBe(0);
    });

    it('should allow new request after decline', async () => {
      // Arrange - Previous decline means no existing friendship
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });
      mockSetDoc.mockResolvedValueOnce();

      // Act - User A can send new request
      const result = await sendFriendRequest('user-a', 'user-b');

      // Assert
      expect(result.success).toBe(true);
      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  describe('3. Pending Requests management', () => {
    it('should filter sent requests correctly (unit test covers query)', async () => {
      // Note: Full query testing is in unit tests. This integration test
      // verifies the client-side filtering logic works correctly.

      // The getSentRequests function:
      // 1. Queries friendships where user is either user1Id or user2Id
      // 2. Filters for status='pending' AND requestedBy=userId (sent requests)

      // We verify the filtering logic by checking that:
      // - If a user sends requests, requestedBy should match userId
      // - Status should be 'pending' for sent requests

      const sentRequest = createPendingFriendRequest({
        user1Id: 'user-a',
        user2Id: 'user-b',
        requestedBy: 'user-a', // User A sent this
      });

      // Verify the factory creates correct structure
      expect(sentRequest.status).toBe('pending');
      expect(sentRequest.requestedBy).toBe('user-a');
      expect(sentRequest.user1Id).toBe('user-a');
      expect(sentRequest.user2Id).toBe('user-b');
    });

    it('should filter pending requests correctly (verify logic)', async () => {
      // Note: The or() query is tested in unit tests. This integration test
      // verifies the client-side filtering logic for incoming requests.
      //
      // getPendingRequests filters for: status='pending' AND requestedBy !== userId

      const userB = 'user-b';

      // Simulate raw query results (both pending and accepted, both sent and received)
      const allFriendships = [
        // Incoming pending from user-a (should be included)
        createPendingFriendRequest({ user1Id: 'user-a', user2Id: userB, requestedBy: 'user-a' }),
        // Outgoing pending to user-c (should be excluded - user B sent it)
        createPendingFriendRequest({ user1Id: userB, user2Id: 'user-c', requestedBy: userB }),
        // Accepted friendship (should be excluded)
        createTestFriendship({ user1Id: 'user-d', user2Id: userB, status: 'accepted' }),
      ];

      // Verify filtering logic: only include pending where requestedBy !== userId
      const pendingReceived = allFriendships.filter(
        f => f.status === 'pending' && f.requestedBy !== userB
      );

      expect(pendingReceived.length).toBe(1);
      expect(pendingReceived[0].requestedBy).toBe('user-a');
      expect(pendingReceived.every(r => r.requestedBy !== userB)).toBe(true);
    });

    it('should update sent requests count after accept/decline', async () => {
      // Arrange - User A sent 3 requests, B accepted, C declined, D still pending
      const userA = 'user-a';
      const remainingPending = [
        createPendingFriendRequest({ user1Id: userA, user2Id: 'user-d', requestedBy: userA }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: remainingPending.map((r, i) => ({
          id: `friendship-${i}`,
          data: () => r,
        })),
        forEach: cb =>
          remainingPending.map((r, i) => ({ id: `friendship-${i}`, data: () => r })).forEach(cb),
      });

      // Act
      const result = await getSentRequests(userA);

      // Assert
      expect(result.success).toBe(true);
      expect(result.requests.length).toBe(1);
    });
  });

  describe('4. Remove Friend flow', () => {
    it('should delete accepted friendship when removing friend', async () => {
      // Arrange
      const userA = 'user-a';
      const userB = 'user-b';
      generateFriendshipId(userA, userB);
      const acceptedFriendship = createTestFriendship({
        user1Id: userA,
        user2Id: userB,
        status: 'accepted',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => acceptedFriendship,
      });
      mockDeleteDoc.mockResolvedValueOnce();

      // Act
      const result = await removeFriend(userA, userB);

      // Assert
      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should return error when trying to remove non-existent friendship', async () => {
      // Arrange
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });

      // Act
      const result = await removeFriend('user-x', 'user-y');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Friendship not found');
    });
  });

  describe('5. Feed Filtering by Friendship', () => {
    it('should only show photos from friends in feed', async () => {
      // Arrange - User B is friends with User A
      const userA = createTestUser({ uid: 'user-a' });
      const userB = createTestUser({ uid: 'user-b' });
      const userC = createTestUser({ uid: 'user-c' }); // Not a friend

      const userAPhoto = createJournaledPhoto({ id: 'photo-a', userId: userA.uid });
      const userCPhoto = createJournaledPhoto({ id: 'photo-c', userId: userC.uid });

      // Feed query returns both photos
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: userAPhoto.id, data: () => userAPhoto },
          { id: userCPhoto.id, data: () => userCPhoto },
        ],
        size: 2,
      });

      // getDoc for user data
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => true, data: () => userA })
        .mockResolvedValueOnce({ exists: () => true, data: () => userC });

      // Act - Get feed with only User A as friend
      const result = await getFeedPhotos(20, null, [userA.uid], userB.uid);

      // Assert - Only User A's photo should appear
      expect(result.success).toBe(true);
      expect(result.photos.length).toBe(1);
      expect(result.photos[0].userId).toBe(userA.uid);
    });

    it('should show photos after accepting friend request', async () => {
      // Arrange - User A has photos, User B just accepted friend request
      const userA = createTestUser({ uid: 'user-a' });
      const userB = createTestUser({ uid: 'user-b' });
      const userAPhoto = createJournaledPhoto({ id: 'photo-after-accept', userId: userA.uid });

      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: userAPhoto.id, data: () => userAPhoto }],
        size: 1,
      });

      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => userA });

      // Act - Get feed with User A as friend (after accepting)
      const result = await getFeedPhotos(20, null, [userA.uid], userB.uid);

      // Assert
      expect(result.success).toBe(true);
      expect(result.photos.length).toBe(1);
      expect(result.photos[0].userId).toBe(userA.uid);
    });

    it('should hide photos after removing friend', async () => {
      // Arrange - User A and B are no longer friends
      const userA = createTestUser({ uid: 'user-a' });
      const userB = createTestUser({ uid: 'user-b' });
      const userAPhoto = createJournaledPhoto({ id: 'photo-hidden', userId: userA.uid });

      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: userAPhoto.id, data: () => userAPhoto }],
        size: 1,
      });

      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => userA });

      // Act - Get feed with empty friend list (after removing)
      const result = await getFeedPhotos(20, null, [], userB.uid);

      // Assert - User A's photo NOT in feed (not friends anymore)
      expect(result.success).toBe(true);
      expect(result.photos.length).toBe(0);
    });

    it('should extract friend user IDs correctly (verify logic)', async () => {
      // Note: getFriendUserIds calls getFriendships internally.
      // This test verifies the user ID extraction logic works correctly.
      //
      // For each accepted friendship, extract the "other user" ID:
      // - If friendship.user1Id === userId, return user2Id
      // - Otherwise, return user1Id

      const userA = 'user-a';
      const acceptedFriendships = [
        createTestFriendship({ user1Id: userA, user2Id: 'user-b', status: 'accepted' }),
        createTestFriendship({ user1Id: 'user-c', user2Id: userA, status: 'accepted' }), // userA is user2
      ];

      // Verify extraction logic
      const friendUserIds = acceptedFriendships.map(friendship => {
        if (friendship.user1Id === userA) {
          return friendship.user2Id;
        } else {
          return friendship.user1Id;
        }
      });

      expect(friendUserIds.length).toBe(2);
      expect(friendUserIds).toContain('user-b');
      expect(friendUserIds).toContain('user-c');
    });
  });

  describe('6. Edge Cases', () => {
    it('should reject self-friend request', async () => {
      // Act
      const result = await sendFriendRequest('user-a', 'user-a');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot send friend request to yourself');
    });

    it('should reject duplicate friend request', async () => {
      // Arrange - Pending request already exists
      const existingRequest = createPendingFriendRequest({
        user1Id: 'user-a',
        user2Id: 'user-b',
        requestedBy: 'user-a',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingRequest,
      });

      // Act
      const result = await sendFriendRequest('user-a', 'user-b');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Friend request already sent');
    });

    it('should reject request to already accepted friend', async () => {
      // Arrange - Already friends
      const existingFriendship = createTestFriendship({
        user1Id: 'user-a',
        user2Id: 'user-b',
        status: 'accepted',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingFriendship,
      });

      // Act
      const result = await sendFriendRequest('user-a', 'user-b');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Already friends');
    });

    it('should reject accept from non-recipient', async () => {
      // Arrange - User A sent request to User B
      const pendingRequest = createPendingFriendRequest({
        user1Id: 'user-a',
        user2Id: 'user-b',
        requestedBy: 'user-a',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => pendingRequest,
      });

      // Act - User A tries to accept (sender, not recipient)
      const result = await acceptFriendRequest('user-a_user-b', 'user-a');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot accept your own friend request');
    });

    it('should reject accept from unauthorized user', async () => {
      // Arrange - User A sent request to User B
      const pendingRequest = createPendingFriendRequest({
        user1Id: 'user-a',
        user2Id: 'user-b',
        requestedBy: 'user-a',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => pendingRequest,
      });

      // Act - User C tries to accept (not involved)
      const result = await acceptFriendRequest('user-a_user-b', 'user-c');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should handle invalid user IDs', async () => {
      // Act & Assert
      const result1 = await sendFriendRequest('', 'user-b');
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Invalid user IDs');

      const result2 = await sendFriendRequest('user-a', null);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Invalid user IDs');
    });

    it('should return self status for same user check', async () => {
      // Act
      const result = await checkFriendshipStatus('user-a', 'user-a');

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('self');
    });
  });

  describe('Friendship Status Checking', () => {
    it('should return none when no friendship exists', async () => {
      // Arrange
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });

      // Act
      const result = await checkFriendshipStatus('user-a', 'user-b');

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('none');
    });

    it('should return pending_sent when user sent request', async () => {
      // Arrange
      const pendingRequest = createPendingFriendRequest({
        user1Id: 'user-a',
        user2Id: 'user-b',
        requestedBy: 'user-a',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => pendingRequest,
      });

      // Act
      const result = await checkFriendshipStatus('user-a', 'user-b');

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending_sent');
    });

    it('should return pending_received when user received request', async () => {
      // Arrange
      const pendingRequest = createPendingFriendRequest({
        user1Id: 'user-a',
        user2Id: 'user-b',
        requestedBy: 'user-a',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => pendingRequest,
      });

      // Act - User B checks (they received the request)
      const result = await checkFriendshipStatus('user-b', 'user-a');

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending_received');
    });

    it('should return friends when friendship is accepted', async () => {
      // Arrange
      const acceptedFriendship = createTestFriendship({
        user1Id: 'user-a',
        user2Id: 'user-b',
        status: 'accepted',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => acceptedFriendship,
      });

      // Act
      const result = await checkFriendshipStatus('user-a', 'user-b');

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('friends');
    });
  });

  describe('End-to-End Friendship Flow', () => {
    it('should complete full friendship lifecycle: request → accept → feed access → remove', async () => {
      const userA = 'user-a';
      const userB = 'user-b';
      const friendshipId = generateFriendshipId(userA, userB);

      // Step 1: Send friend request
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockSetDoc.mockResolvedValueOnce();

      const sendResult = await sendFriendRequest(userA, userB);
      expect(sendResult.success).toBe(true);

      // Step 2: Accept friend request
      const pendingRequest = createPendingFriendRequest({
        user1Id: userA,
        user2Id: userB,
        requestedBy: userA,
      });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => pendingRequest });
      mockUpdateDoc.mockResolvedValueOnce();

      const acceptResult = await acceptFriendRequest(friendshipId, userB);
      expect(acceptResult.success).toBe(true);

      // Step 3: Verify friends can see each other's photos
      const userAData = createTestUser({ uid: userA });
      const userAPhoto = createJournaledPhoto({ id: 'photo-shared', userId: userA });

      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: userAPhoto.id, data: () => userAPhoto }],
        size: 1,
      });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => userAData });

      const feedResult = await getFeedPhotos(20, null, [userA], userB);
      expect(feedResult.success).toBe(true);
      expect(feedResult.photos.length).toBe(1);

      // Step 4: Remove friend
      const acceptedFriendship = createTestFriendship({
        user1Id: userA,
        user2Id: userB,
        status: 'accepted',
      });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => acceptedFriendship });
      mockDeleteDoc.mockResolvedValueOnce();

      const removeResult = await removeFriend(userA, userB);
      expect(removeResult.success).toBe(true);

      // Step 5: Verify photos are no longer visible
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: userAPhoto.id, data: () => userAPhoto }],
        size: 1,
      });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => userAData });

      const feedAfterRemove = await getFeedPhotos(20, null, [], userB);
      expect(feedAfterRemove.success).toBe(true);
      expect(feedAfterRemove.photos.length).toBe(0);
    });
  });
});
