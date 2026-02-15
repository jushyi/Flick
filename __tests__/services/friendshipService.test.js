/**
 * Friendship Service Unit Tests
 *
 * Tests for friendship service including:
 * - Deterministic friendship ID generation (pure function)
 * - Send friend request
 * - Accept/decline friend requests
 * - Remove friend
 * - Get friendships, pending/sent requests
 * - Check friendship status
 * - Subscribe to friendship updates
 * - Get friend user IDs
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
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockServerTimestamp = jest.fn(() => ({ _seconds: Date.now() / 1000, _nanoseconds: 0 }));

// Mock document and collection references
const mockDocRef = { id: 'mock-doc-id' };
const mockCollectionRef = {};

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockDocRef),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  or: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  documentId: jest.fn(() => '__documentId__'),
  serverTimestamp: () => mockServerTimestamp(),
}));

// Import service AFTER mocks are set up
const {
  generateFriendshipId,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriendships,
  getPendingRequests,
  getSentRequests,
  checkFriendshipStatus,
  subscribeFriendships,
  getFriendUserIds,
} = require('../../src/services/firebase/friendshipService');

describe('friendshipService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // generateFriendshipId tests (PURE FUNCTION - no mocks needed)
  // ===========================================================================
  describe('generateFriendshipId', () => {
    it('should return same ID regardless of argument order', () => {
      const id1 = generateFriendshipId('alice', 'bob');
      const id2 = generateFriendshipId('bob', 'alice');

      expect(id1).toBe(id2);
    });

    it('should alphabetically sort user IDs with lower ID first', () => {
      const result = generateFriendshipId('zebra', 'apple');

      expect(result).toBe('apple_zebra');
    });

    it('should handle numeric-like user IDs', () => {
      const result = generateFriendshipId('user123', 'user456');

      expect(result).toBe('user123_user456');
    });

    it('should handle IDs that are already in alphabetical order', () => {
      const result = generateFriendshipId('aaa', 'zzz');

      expect(result).toBe('aaa_zzz');
    });

    it('should handle same user IDs (edge case)', () => {
      const result = generateFriendshipId('user1', 'user1');

      expect(result).toBe('user1_user1');
    });

    it('should handle mixed case IDs (sorts by ASCII)', () => {
      // Uppercase letters come before lowercase in ASCII
      const result = generateFriendshipId('Alice', 'bob');

      expect(result).toBe('Alice_bob');
    });

    it('should handle special characters in IDs', () => {
      const result = generateFriendshipId('user-1', 'user_2');

      // Underscore comes before hyphen in ASCII
      expect(result).toBe('user-1_user_2');
    });
  });

  // ===========================================================================
  // sendFriendRequest tests
  // ===========================================================================
  describe('sendFriendRequest', () => {
    it('should create friendship document with status pending', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValueOnce();

      const result = await sendFriendRequest('user-a', 'user-b');

      expect(result.success).toBe(true);
      expect(result.friendshipId).toBe('user-a_user-b');
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          user1Id: 'user-a',
          user2Id: 'user-b',
          status: 'pending',
          requestedBy: 'user-a',
          acceptedAt: null,
        })
      );
    });

    it('should set requestedBy to fromUserId', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValueOnce();

      await sendFriendRequest('sender-id', 'receiver-id');

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          requestedBy: 'sender-id',
        })
      );
    });

    it('should set user1Id/user2Id in alphabetical order', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValueOnce();

      await sendFriendRequest('zebra', 'apple');

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          user1Id: 'apple',
          user2Id: 'zebra',
        })
      );
    });

    it('should return error if friendship already exists as accepted', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'accepted' }),
      });

      const result = await sendFriendRequest('user-a', 'user-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Already friends');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should return error if request already pending', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'pending' }),
      });

      const result = await sendFriendRequest('user-a', 'user-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Friend request already sent');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should return error for self-request', async () => {
      const result = await sendFriendRequest('user-a', 'user-a');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot send friend request to yourself');
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('should return error if fromUserId is empty', async () => {
      const result = await sendFriendRequest('', 'user-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user IDs');
    });

    it('should return error if toUserId is empty', async () => {
      const result = await sendFriendRequest('user-a', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user IDs');
    });

    it('should return error if fromUserId is null', async () => {
      const result = await sendFriendRequest(null, 'user-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user IDs');
    });

    it('should return error if toUserId is null', async () => {
      const result = await sendFriendRequest('user-a', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user IDs');
    });

    it('should handle Firestore errors gracefully', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Firestore connection failed'));

      const result = await sendFriendRequest('user-a', 'user-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore connection failed');
    });
  });

  // ===========================================================================
  // acceptFriendRequest tests
  // ===========================================================================
  describe('acceptFriendRequest', () => {
    it('should update status from pending to accepted', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          requestedBy: 'other-user',
          user1Id: 'other-user',
          user2Id: 'user-a',
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await acceptFriendRequest('other-user_user-a', 'user-a');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'accepted',
        })
      );
    });

    it('should set acceptedAt timestamp', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          requestedBy: 'sender',
          user1Id: 'recipient',
          user2Id: 'sender',
        }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      await acceptFriendRequest('recipient_sender', 'recipient');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          acceptedAt: expect.anything(),
        })
      );
    });

    it('should return error if friendship does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await acceptFriendRequest('nonexistent_friendship', 'user-a');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Friend request not found');
    });

    it('should return error if already accepted', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'accepted',
          requestedBy: 'sender',
          user1Id: 'recipient',
          user2Id: 'sender',
        }),
      });

      const result = await acceptFriendRequest('recipient_sender', 'recipient');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Friend request already processed');
    });

    it('should return error if user tries to accept their own request', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          requestedBy: 'user-a', // User-a sent the request
          user1Id: 'user-a',
          user2Id: 'user-b',
        }),
      });

      const result = await acceptFriendRequest('user-a_user-b', 'user-a'); // User-a trying to accept

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot accept your own friend request');
    });

    it('should return error if user is not part of friendship', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          requestedBy: 'user-a',
          user1Id: 'user-a',
          user2Id: 'user-b',
        }),
      });

      const result = await acceptFriendRequest('user-a_user-b', 'user-c'); // User-c not involved

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should return error for null friendshipId', async () => {
      const result = await acceptFriendRequest(null, 'user-a');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameters');
    });

    it('should return error for null userId', async () => {
      const result = await acceptFriendRequest('friendship-id', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameters');
    });
  });

  // ===========================================================================
  // declineFriendRequest tests
  // ===========================================================================
  describe('declineFriendRequest', () => {
    it('should delete the friendship document', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          user1Id: 'user-a',
          user2Id: 'user-b',
        }),
      });
      mockDeleteDoc.mockResolvedValueOnce();

      const result = await declineFriendRequest('user-a_user-b', 'user-b');

      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should return error if friendship does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await declineFriendRequest('nonexistent', 'user-a');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Friend request not found');
    });

    it('should return error if user is not part of friendship', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          user1Id: 'user-a',
          user2Id: 'user-b',
        }),
      });

      const result = await declineFriendRequest('user-a_user-b', 'user-c');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should return error for null friendshipId', async () => {
      const result = await declineFriendRequest(null, 'user-a');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameters');
    });

    it('should return error for null userId', async () => {
      const result = await declineFriendRequest('friendship-id', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameters');
    });

    it('should allow either user to decline/cancel', async () => {
      // User A (sender) can cancel their own request
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          requestedBy: 'user-a',
          user1Id: 'user-a',
          user2Id: 'user-b',
        }),
      });
      mockDeleteDoc.mockResolvedValueOnce();

      const result = await declineFriendRequest('user-a_user-b', 'user-a');

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // removeFriend tests
  // ===========================================================================
  describe('removeFriend', () => {
    it('should delete accepted friendship', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'accepted',
          user1Id: 'user-a',
          user2Id: 'user-b',
        }),
      });
      mockDeleteDoc.mockResolvedValueOnce();

      const result = await removeFriend('user-a', 'user-b');

      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should return error if friendship does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await removeFriend('user-a', 'user-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Friendship not found');
    });

    it('should return error for empty userId1', async () => {
      const result = await removeFriend('', 'user-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user IDs');
    });

    it('should return error for empty userId2', async () => {
      const result = await removeFriend('user-a', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user IDs');
    });

    it('should work regardless of argument order', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'accepted',
          user1Id: 'apple',
          user2Id: 'zebra',
        }),
      });
      mockDeleteDoc.mockResolvedValueOnce();

      // Pass in reverse alphabetical order
      const result = await removeFriend('zebra', 'apple');

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // getFriendships tests
  // ===========================================================================
  describe('getFriendships', () => {
    it('should query friendships where user is user1Id or user2Id', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: callback => {
          callback({
            id: 'user-a_user-b',
            data: () => ({
              status: 'accepted',
              user1Id: 'user-a',
              user2Id: 'user-b',
              acceptedAt: { toMillis: () => Date.now() },
            }),
          });
        },
      });

      const result = await getFriendships('user-a');

      expect(result.success).toBe(true);
      expect(result.friendships).toHaveLength(1);
    });

    it('should filter by status accepted', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: callback => {
          // Accepted friendship
          callback({
            id: 'user-a_user-b',
            data: () => ({
              status: 'accepted',
              user1Id: 'user-a',
              user2Id: 'user-b',
              acceptedAt: { toMillis: () => Date.now() },
            }),
          });
          // Pending friendship - should be filtered out
          callback({
            id: 'user-a_user-c',
            data: () => ({
              status: 'pending',
              user1Id: 'user-a',
              user2Id: 'user-c',
            }),
          });
        },
      });

      const result = await getFriendships('user-a');

      expect(result.success).toBe(true);
      expect(result.friendships).toHaveLength(1);
      expect(result.friendships[0].status).toBe('accepted');
    });

    it('should return empty array when no friendships', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: jest.fn(), // No docs
      });

      const result = await getFriendships('user-a');

      expect(result.success).toBe(true);
      expect(result.friendships).toHaveLength(0);
    });

    it('should return error for invalid userId', async () => {
      const result = await getFriendships('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should return error for null userId', async () => {
      const result = await getFriendships(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should sort by acceptedAt descending', async () => {
      const now = Date.now();
      mockGetDocs.mockResolvedValueOnce({
        forEach: callback => {
          callback({
            id: 'user-a_user-b',
            data: () => ({
              status: 'accepted',
              user1Id: 'user-a',
              user2Id: 'user-b',
              acceptedAt: { toMillis: () => now - 10000 }, // Earlier
            }),
          });
          callback({
            id: 'user-a_user-c',
            data: () => ({
              status: 'accepted',
              user1Id: 'user-a',
              user2Id: 'user-c',
              acceptedAt: { toMillis: () => now }, // Later (should be first)
            }),
          });
        },
      });

      const result = await getFriendships('user-a');

      expect(result.success).toBe(true);
      expect(result.friendships[0].user2Id).toBe('user-c'); // Most recent first
    });
  });

  // ===========================================================================
  // getPendingRequests tests
  // ===========================================================================
  describe('getPendingRequests', () => {
    it('should return pending requests where user is NOT the sender', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: callback => {
          // Request TO user-a (should be included)
          callback({
            id: 'sender_user-a',
            data: () => ({
              status: 'pending',
              requestedBy: 'sender',
              user1Id: 'sender',
              user2Id: 'user-a',
              createdAt: { toMillis: () => Date.now() },
            }),
          });
          // Request FROM user-a (should be filtered out)
          callback({
            id: 'user-a_other',
            data: () => ({
              status: 'pending',
              requestedBy: 'user-a',
              user1Id: 'other',
              user2Id: 'user-a',
              createdAt: { toMillis: () => Date.now() },
            }),
          });
        },
      });

      const result = await getPendingRequests('user-a');

      expect(result.success).toBe(true);
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].requestedBy).toBe('sender');
    });

    it('should not return requests sent BY the user', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: callback => {
          // Request FROM user-a
          callback({
            id: 'user-a_user-b',
            data: () => ({
              status: 'pending',
              requestedBy: 'user-a',
              user1Id: 'user-a',
              user2Id: 'user-b',
            }),
          });
        },
      });

      const result = await getPendingRequests('user-a');

      expect(result.success).toBe(true);
      expect(result.requests).toHaveLength(0);
    });

    it('should return error for invalid userId', async () => {
      const result = await getPendingRequests('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });
  });

  // ===========================================================================
  // getSentRequests tests
  // ===========================================================================
  describe('getSentRequests', () => {
    it('should return pending requests where user IS the sender', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: callback => {
          // Request FROM user-a (should be included)
          callback({
            id: 'user-a_user-b',
            data: () => ({
              status: 'pending',
              requestedBy: 'user-a',
              user1Id: 'user-a',
              user2Id: 'user-b',
              createdAt: { toMillis: () => Date.now() },
            }),
          });
          // Request TO user-a (should be filtered out)
          callback({
            id: 'sender_user-a',
            data: () => ({
              status: 'pending',
              requestedBy: 'sender',
              user1Id: 'sender',
              user2Id: 'user-a',
            }),
          });
        },
      });

      const result = await getSentRequests('user-a');

      expect(result.success).toBe(true);
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].requestedBy).toBe('user-a');
    });

    it('should return error for invalid userId', async () => {
      const result = await getSentRequests('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });
  });

  // ===========================================================================
  // checkFriendshipStatus tests
  // ===========================================================================
  describe('checkFriendshipStatus', () => {
    it('should return "friends" when status is accepted', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'accepted' }),
      });

      const result = await checkFriendshipStatus('user-a', 'user-b');

      expect(result.success).toBe(true);
      expect(result.status).toBe('friends');
    });

    it('should return "pending_sent" when request sent by user1', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          requestedBy: 'user-a',
        }),
      });

      const result = await checkFriendshipStatus('user-a', 'user-b');

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending_sent');
    });

    it('should return "pending_received" when request received by user1', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'pending',
          requestedBy: 'user-b', // Other user sent it
        }),
      });

      const result = await checkFriendshipStatus('user-a', 'user-b');

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending_received');
    });

    it('should return "none" when no relationship exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await checkFriendshipStatus('user-a', 'user-b');

      expect(result.success).toBe(true);
      expect(result.status).toBe('none');
    });

    it('should return "self" when checking own user', async () => {
      const result = await checkFriendshipStatus('user-a', 'user-a');

      expect(result.success).toBe(true);
      expect(result.status).toBe('self');
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('should return friendshipId in result', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'accepted' }),
      });

      const result = await checkFriendshipStatus('user-a', 'user-b');

      expect(result.friendshipId).toBe('user-a_user-b');
    });

    it('should return error for invalid user IDs', async () => {
      const result = await checkFriendshipStatus('', 'user-b');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user IDs');
    });
  });

  // ===========================================================================
  // subscribeFriendships tests
  // ===========================================================================
  describe('subscribeFriendships', () => {
    it('should set up Firestore onSnapshot listener', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      subscribeFriendships('user-a', callback);

      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      const unsubscribe = subscribeFriendships('user-a', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should return empty function for invalid userId', () => {
      const callback = jest.fn();

      const unsubscribe = subscribeFriendships('', callback);

      expect(typeof unsubscribe).toBe('function');
      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it('should return empty function for null userId', () => {
      const callback = jest.fn();

      const unsubscribe = subscribeFriendships(null, callback);

      expect(typeof unsubscribe).toBe('function');
      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getFriendUserIds tests
  // ===========================================================================
  describe('getFriendUserIds', () => {
    it('should return array of friend user IDs (not full documents)', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: callback => {
          callback({
            id: 'user-a_user-b',
            data: () => ({
              status: 'accepted',
              user1Id: 'user-a',
              user2Id: 'user-b',
              acceptedAt: { toMillis: () => Date.now() },
            }),
          });
          callback({
            id: 'user-a_user-c',
            data: () => ({
              status: 'accepted',
              user1Id: 'user-a',
              user2Id: 'user-c',
              acceptedAt: { toMillis: () => Date.now() },
            }),
          });
        },
      });

      const result = await getFriendUserIds('user-a');

      expect(result.success).toBe(true);
      expect(result.friendUserIds).toEqual(['user-b', 'user-c']);
    });

    it('should exclude the requesting user ID from results', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: callback => {
          // user-a is user1Id
          callback({
            id: 'user-a_user-b',
            data: () => ({
              status: 'accepted',
              user1Id: 'user-a',
              user2Id: 'user-b',
              acceptedAt: { toMillis: () => Date.now() },
            }),
          });
          // user-a is user2Id
          callback({
            id: 'friend_user-a',
            data: () => ({
              status: 'accepted',
              user1Id: 'friend',
              user2Id: 'user-a',
              acceptedAt: { toMillis: () => Date.now() },
            }),
          });
        },
      });

      const result = await getFriendUserIds('user-a');

      expect(result.success).toBe(true);
      expect(result.friendUserIds).toEqual(['user-b', 'friend']);
      expect(result.friendUserIds).not.toContain('user-a');
    });

    it('should return empty array when no friends', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: jest.fn(),
      });

      const result = await getFriendUserIds('user-a');

      expect(result.success).toBe(true);
      expect(result.friendUserIds).toEqual([]);
    });

    it('should return error for invalid userId', async () => {
      const result = await getFriendUserIds('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });
  });
});
