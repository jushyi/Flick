import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  or,
  limit,
  onSnapshot,
  serverTimestamp,
  documentId,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import logger from '../../utils/logger';
import { withTrace } from './performanceService';

// Initialize Firestore once at module level
const db = getFirestore();

/**
 * friendshipService.js
 *
 * Handles all friendship-related operations:
 * - Send, accept, decline friend requests
 * - Get friendships, pending requests
 * - Check friendship status
 * - Real-time friendship listeners
 *
 * Friendship Data Model:
 * - friendshipId: deterministic [lowerUserId]_[higherUserId]
 * - user1Id: alphabetically first userId
 * - user2Id: alphabetically second userId
 * - status: 'pending' | 'accepted'
 * - requestedBy: userId who sent the request
 * - createdAt: timestamp
 * - acceptedAt: timestamp | null
 */

/**
 * Generate deterministic friendship ID from two user IDs
 * Ensures the same friendship document regardless of who sends the request
 *
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {string} Friendship ID in format: [lowerUserId]_[higherUserId]
 */
export const generateFriendshipId = (userId1, userId2) => {
  const [lowerUserId, higherUserId] = [userId1, userId2].sort();
  return `${lowerUserId}_${higherUserId}`;
};

/**
 * Send a friend request
 * Creates a new friendship document with status 'pending'
 *
 * @param {string} fromUserId - User sending the request
 * @param {string} toUserId - User receiving the request
 * @returns {Promise<{success: boolean, friendshipId?: string, error?: string}>}
 */
export const sendFriendRequest = async (fromUserId, toUserId) => {
  return withTrace('social/send_request', async () => {
    try {
      // Validation
      if (!fromUserId || !toUserId) {
        return { success: false, error: 'Invalid user IDs' };
      }

      if (fromUserId === toUserId) {
        return { success: false, error: 'Cannot send friend request to yourself' };
      }

      // Check if friendship already exists
      const friendshipId = generateFriendshipId(fromUserId, toUserId);
      const friendshipRef = doc(db, 'friendships', friendshipId);
      const friendshipDocSnap = await getDoc(friendshipRef);

      if (friendshipDocSnap.exists()) {
        const existingStatus = friendshipDocSnap.data().status;
        if (existingStatus === 'accepted') {
          return { success: false, error: 'Already friends' };
        } else if (existingStatus === 'pending') {
          return { success: false, error: 'Friend request already sent' };
        }
      }

      // Determine user1Id and user2Id (alphabetical order)
      const [user1Id, user2Id] = [fromUserId, toUserId].sort();

      // Create friendship document
      await setDoc(friendshipRef, {
        user1Id,
        user2Id,
        status: 'pending',
        requestedBy: fromUserId,
        createdAt: serverTimestamp(),
        acceptedAt: null,
      });

      return { success: true, friendshipId };
    } catch (error) {
      logger.error('Error sending friend request', error);
      return { success: false, error: error.message };
    }
  });
};

/**
 * Accept a friend request
 * Updates friendship status from 'pending' to 'accepted'
 *
 * @param {string} friendshipId - Friendship document ID
 * @param {string} userId - User accepting the request
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const acceptFriendRequest = async (friendshipId, userId) => {
  return withTrace('social/accept_request', async () => {
    try {
      if (!friendshipId || !userId) {
        return { success: false, error: 'Invalid parameters' };
      }

      const friendshipRef = doc(db, 'friendships', friendshipId);
      const friendshipDocSnap = await getDoc(friendshipRef);

      if (!friendshipDocSnap.exists()) {
        return { success: false, error: 'Friend request not found' };
      }

      const friendshipData = friendshipDocSnap.data();

      // Verify user is the recipient (not the sender)
      if (friendshipData.requestedBy === userId) {
        return { success: false, error: 'Cannot accept your own friend request' };
      }

      // Verify friendship involves this user
      if (friendshipData.user1Id !== userId && friendshipData.user2Id !== userId) {
        return { success: false, error: 'Unauthorized' };
      }

      // Verify status is pending
      if (friendshipData.status !== 'pending') {
        return { success: false, error: 'Friend request already processed' };
      }

      // Update to accepted
      await updateDoc(friendshipRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      logger.error('Error accepting friend request', error);
      return { success: false, error: error.message };
    }
  });
};

/**
 * Decline a friend request
 * Deletes the friendship document
 *
 * @param {string} friendshipId - Friendship document ID
 * @param {string} userId - User declining the request
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const declineFriendRequest = async (friendshipId, userId) => {
  try {
    if (!friendshipId || !userId) {
      return { success: false, error: 'Invalid parameters' };
    }

    const friendshipRef = doc(db, 'friendships', friendshipId);
    const friendshipDocSnap = await getDoc(friendshipRef);

    if (!friendshipDocSnap.exists()) {
      return { success: false, error: 'Friend request not found' };
    }

    const friendshipData = friendshipDocSnap.data();

    // Verify user is part of this friendship
    if (friendshipData.user1Id !== userId && friendshipData.user2Id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Delete friendship document
    await deleteDoc(friendshipRef);

    return { success: true };
  } catch (error) {
    logger.error('Error declining friend request', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove a friend (delete friendship)
 * Same as declining, but semantically for accepted friendships
 *
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const removeFriend = async (userId1, userId2) => {
  try {
    if (!userId1 || !userId2) {
      return { success: false, error: 'Invalid user IDs' };
    }

    const friendshipId = generateFriendshipId(userId1, userId2);
    const friendshipRef = doc(db, 'friendships', friendshipId);
    const friendshipDocSnap = await getDoc(friendshipRef);

    if (!friendshipDocSnap.exists()) {
      return { success: false, error: 'Friendship not found' };
    }

    // Delete friendship document
    await deleteDoc(friendshipRef);

    return { success: true };
  } catch (error) {
    logger.error('Error removing friend', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all accepted friendships for a user
 * Returns array of friendship documents with other user's data populated
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, friendships?: Array, error?: string}>}
 */
export const getFriendships = async userId => {
  return withTrace('social/load_friends', async trace => {
    try {
      if (!userId) {
        return { success: false, error: 'Invalid user ID' };
      }

      // Query friendships where user is either user1Id or user2Id using modular or() function
      const q = query(
        collection(db, 'friendships'),
        or(where('user1Id', '==', userId), where('user2Id', '==', userId)),
        limit(500) // Practical bound on total friendships (all statuses)
      );
      const querySnapshot = await getDocs(q);

      // Filter for accepted status (client-side since we need OR query for users)
      const friendships = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'accepted') {
          friendships.push({
            id: doc.id,
            ...data,
          });
        }
      });

      // Sort by acceptedAt (most recent first)
      friendships.sort((a, b) => {
        const aTime = a.acceptedAt?.toMillis() || 0;
        const bTime = b.acceptedAt?.toMillis() || 0;
        return bTime - aTime;
      });

      trace.putMetric('friend_count', friendships.length);

      return { success: true, friendships };
    } catch (error) {
      logger.error('Error getting friendships', error);
      return { success: false, error: error.message };
    }
  });
};

/**
 * Get incoming pending friend requests for a user
 * Returns requests where user is NOT the sender
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, requests?: Array, error?: string}>}
 */
export const getPendingRequests = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    // Query friendships where user is either user1Id or user2Id using modular or() function
    const q = query(
      collection(db, 'friendships'),
      or(where('user1Id', '==', userId), where('user2Id', '==', userId)),
      limit(500) // Practical bound on total friendships (all statuses)
    );
    const querySnapshot = await getDocs(q);

    // Filter for pending requests where user is NOT the sender
    const requests = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'pending' && data.requestedBy !== userId) {
        requests.push({
          id: doc.id,
          ...data,
        });
      }
    });

    // Sort by createdAt (most recent first)
    requests.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });

    return { success: true, requests };
  } catch (error) {
    logger.error('Error getting pending requests', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get outgoing pending friend requests (sent by user)
 * Returns requests where user IS the sender
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, requests?: Array, error?: string}>}
 */
export const getSentRequests = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    // Query friendships where user is either user1Id or user2Id using modular or() function
    // (Firestore security rules only allow queries where user is user1Id or user2Id)
    const q = query(
      collection(db, 'friendships'),
      or(where('user1Id', '==', userId), where('user2Id', '==', userId)),
      limit(500) // Practical bound on total friendships (all statuses)
    );
    const querySnapshot = await getDocs(q);

    // Filter for pending requests WHERE USER IS THE SENDER (client-side)
    const requests = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'pending' && data.requestedBy === userId) {
        requests.push({
          id: doc.id,
          ...data,
        });
      }
    });

    // Sort by createdAt (most recent first)
    requests.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });

    return { success: true, requests };
  } catch (error) {
    logger.error('Error getting sent requests', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check friendship status between two users
 * Returns: 'none' | 'pending_sent' | 'pending_received' | 'friends'
 *
 * @param {string} userId1 - First user ID (typically current user)
 * @param {string} userId2 - Second user ID (user being checked)
 * @returns {Promise<{success: boolean, status?: string, friendshipId?: string, error?: string}>}
 */
export const checkFriendshipStatus = async (userId1, userId2) => {
  try {
    if (!userId1 || !userId2) {
      return { success: false, error: 'Invalid user IDs' };
    }

    if (userId1 === userId2) {
      return { success: true, status: 'self' };
    }

    const friendshipId = generateFriendshipId(userId1, userId2);
    const friendshipRef = doc(db, 'friendships', friendshipId);
    const friendshipDocSnap = await getDoc(friendshipRef);

    if (!friendshipDocSnap.exists()) {
      return { success: true, status: 'none', friendshipId };
    }

    const data = friendshipDocSnap.data();

    if (data.status === 'accepted') {
      return { success: true, status: 'friends', friendshipId };
    }

    if (data.status === 'pending') {
      if (data.requestedBy === userId1) {
        return { success: true, status: 'pending_sent', friendshipId };
      } else {
        return { success: true, status: 'pending_received', friendshipId };
      }
    }

    return { success: true, status: 'none', friendshipId };
  } catch (error) {
    logger.error('Error checking friendship status', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to real-time friendship updates for a user
 * Listens to all friendships where user is involved
 *
 * @param {string} userId - User ID
 * @param {function} callback - Callback function receiving friendship updates
 * @returns {function} Unsubscribe function
 */
export const subscribeFriendships = (userId, callback) => {
  if (!userId) {
    logger.error('Cannot subscribe: Invalid user ID');
    return () => {};
  }

  // Query using modular or() function
  const q = query(
    collection(db, 'friendships'),
    or(where('user1Id', '==', userId), where('user2Id', '==', userId)),
    limit(500) // Practical bound on friend count for real-time listener
  );

  const unsubscribe = onSnapshot(
    q,
    snapshot => {
      const friendships = [];
      snapshot.forEach(docSnap => {
        friendships.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      callback(friendships);
    },
    error => {
      logger.error('Error in friendship subscription', error);
      callback([]);
    }
  );

  return unsubscribe;
};

/**
 * Get friend user IDs for a user (accepted friendships only)
 * Returns array of user IDs who are friends with the given user
 * Useful for filtering feed photos
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, friendUserIds?: Array<string>, error?: string}>}
 */
export const getFriendUserIds = async userId => {
  try {
    const result = await getFriendships(userId);

    if (!result.success) {
      return result;
    }

    // Extract the "other user" ID from each friendship
    const friendUserIds = result.friendships.map(friendship => {
      if (friendship.user1Id === userId) {
        return friendship.user2Id;
      } else {
        return friendship.user1Id;
      }
    });

    return { success: true, friendUserIds };
  } catch (error) {
    logger.error('Error getting friend user IDs', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get mutual friend suggestions based on friends-of-friends
 * Calls Cloud Function that uses admin SDK to bypass security rules
 * (users can't read other users' friendships client-side)
 *
 * @param {string} userId - User ID to get suggestions for
 * @returns {Promise<{success: boolean, suggestions?: Array<{userId: string, displayName: string, username: string, profilePhotoURL: string|null, mutualCount: number}>, error?: string}>}
 */
export const getMutualFriendSuggestions = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    const functions = getFunctions();
    const getMutualSuggestions = httpsCallable(functions, 'getMutualFriendSuggestions');
    const result = await getMutualSuggestions();

    return { success: true, suggestions: result.data.suggestions || [] };
  } catch (error) {
    logger.error('Error getting mutual friend suggestions', error);
    return { success: false, error: error.message };
  }
};

/**
 * Batch fetch user documents by IDs
 * Chunks IDs into groups of 30 (Firestore `in` operator limit) and queries in parallel.
 * Returns a Map of userId -> userData for O(1) lookups.
 *
 * @param {string[]} userIds - Array of user IDs to fetch
 * @returns {Promise<Map<string, object>>} Map of userId -> user data
 */
export const batchGetUsers = async userIds => {
  if (!userIds || userIds.length === 0) {
    return new Map();
  }

  // Deduplicate IDs
  const uniqueIds = [...new Set(userIds)];

  // Chunk into groups of 30 (Firestore 'in' operator limit)
  const CHUNK_SIZE = 30;
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE));
  }

  try {
    // Run all chunk queries in parallel
    const chunkResults = await Promise.all(
      chunks.map(async chunk => {
        const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
        return getDocs(q);
      })
    );

    // Build Map from results
    const userMap = new Map();
    chunkResults.forEach(snapshot => {
      snapshot.forEach(docSnap => {
        userMap.set(docSnap.id, {
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
    });

    return userMap;
  } catch (error) {
    logger.error('Error in batchGetUsers', error);
    return new Map();
  }
};
