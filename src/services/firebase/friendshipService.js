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
  onSnapshot,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';

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
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    // Query friendships where user is either user1Id or user2Id using modular or() function
    const q = query(
      collection(db, 'friendships'),
      or(where('user1Id', '==', userId), where('user2Id', '==', userId))
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

    return { success: true, friendships };
  } catch (error) {
    logger.error('Error getting friendships', error);
    return { success: false, error: error.message };
  }
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
      or(where('user1Id', '==', userId), where('user2Id', '==', userId))
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
      or(where('user1Id', '==', userId), where('user2Id', '==', userId))
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
    or(where('user1Id', '==', userId), where('user2Id', '==', userId))
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
 * Computes users who share mutual connections with the given user
 * but are not already friends or have pending requests
 *
 * @param {string} userId - User ID to get suggestions for
 * @returns {Promise<{success: boolean, suggestions?: Array<{userId: string, displayName: string, username: string, profilePhotoURL: string|null, mutualCount: number}>, error?: string}>}
 */
export const getMutualFriendSuggestions = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    // Step 1: Query ALL friendships involving this user
    const q = query(
      collection(db, 'friendships'),
      or(where('user1Id', '==', userId), where('user2Id', '==', userId))
    );
    const querySnapshot = await getDocs(q);

    // Step 2: Build friendIds (accepted) and excludeIds (all connected + self)
    const friendIds = new Set();
    const excludeIds = new Set([userId]);

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const otherId = data.user1Id === userId ? data.user2Id : data.user1Id;

      // Exclude all connected users regardless of status
      excludeIds.add(otherId);

      // Only add accepted friends to friendIds for mutual lookups
      if (data.status === 'accepted') {
        friendIds.add(otherId);
      }
    });

    // Edge case: no friends means no mutual suggestions
    if (friendIds.size === 0) {
      return { success: true, suggestions: [] };
    }

    // Step 3: Cap at 30 friends to limit query volume
    const friendIdsToProcess = Array.from(friendIds).slice(0, 30);

    // Step 4: Query each friend's friendships in parallel
    const friendQueries = friendIdsToProcess.map(async friendId => {
      const friendQ = query(
        collection(db, 'friendships'),
        or(where('user1Id', '==', friendId), where('user2Id', '==', friendId))
      );
      return getDocs(friendQ);
    });
    const friendSnapshots = await Promise.all(friendQueries);

    // Step 5: Count mutual connections
    const mutualCounts = new Map();

    friendSnapshots.forEach(snapshot => {
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status !== 'accepted') return;

        // Get both user IDs from the friendship
        const ids = [data.user1Id, data.user2Id];
        ids.forEach(id => {
          if (!excludeIds.has(id)) {
            mutualCounts.set(id, (mutualCounts.get(id) || 0) + 1);
          }
        });
      });
    });

    // Edge case: no mutual connections found
    if (mutualCounts.size === 0) {
      return { success: true, suggestions: [] };
    }

    // Step 6: Sort by count descending, take top 20
    const sortedEntries = Array.from(mutualCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    // Step 7: Fetch user profiles in parallel
    const profileFetches = sortedEntries.map(async ([suggestionUserId, mutualCount]) => {
      const userDocSnap = await getDoc(doc(db, 'users', suggestionUserId));
      if (!userDocSnap.exists()) return null;

      const userData = userDocSnap.data();
      return {
        userId: suggestionUserId,
        displayName: userData.displayName || null,
        username: userData.username || null,
        profilePhotoURL: userData.profilePhotoURL || null,
        mutualCount,
      };
    });
    const profiles = await Promise.all(profileFetches);

    // Filter out any users whose profiles couldn't be fetched
    const suggestions = profiles.filter(p => p !== null);

    // Step 8: Return suggestions
    return { success: true, suggestions };
  } catch (error) {
    logger.error('Error getting mutual friend suggestions', error);
    return { success: false, error: error.message };
  }
};
