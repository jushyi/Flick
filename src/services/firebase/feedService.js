/**
 * Feed Service
 *
 * Handles feed queries and reaction management. Fetches journaled photos
 * from friends, provides real-time subscriptions, and manages emoji reactions.
 *
 * Key functions:
 * - getFeedPhotos: Fetch paginated feed with friend filtering
 * - subscribeFeedPhotos: Real-time feed listener
 * - getPhotoById: Fetch single photo with user data
 * - toggleReaction: Add/increment emoji reactions
 * - getFriendStoriesData: Get friend stories for Stories UI
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';
import { getFriendUserIds } from './friendshipService';

const db = getFirestore();

/**
 * Get feed photos (journaled photos from friends + current user)
 * Week 9: Filters by friendUserIds (friends-only + current user's own photos)
 *
 * @param {number} limitCount - Number of photos to fetch (default: 20)
 * @param {object} lastDoc - Last document for pagination (optional)
 * @param {Array<string>} friendUserIds - Array of friend user IDs (optional)
 * @param {string} currentUserId - Current user ID (to include own photos)
 * @returns {Promise} - Feed photos array and last document
 */
export const getFeedPhotos = async (
  limitCount = 20,
  lastDoc = null,
  friendUserIds = null,
  currentUserId = null
) => {
  try {
    // Simplified query: Only filter by photoState = 'journal'
    // Status will be implicitly 'triaged' since only triaged photos have photoState
    // We'll sort in JavaScript to avoid composite index requirement
    const q = query(collection(db, 'photos'), where('photoState', '==', 'journal'));
    const snapshot = await getDocs(q);

    // Fetch all photos with user data
    const allPhotos = await Promise.all(
      snapshot.docs.map(async photoDoc => {
        const photoData = photoDoc.data();

        // Fetch user data for each photo
        const userDocRef = doc(db, 'users', photoData.userId);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};

        return {
          id: photoDoc.id,
          ...photoData,
          user: {
            uid: photoData.userId,
            username: userData.username || 'unknown',
            displayName: userData.displayName || 'Unknown User',
            profilePhotoURL: userData.profilePhotoURL || null,
          },
        };
      })
    );

    // Filter by friends + current user if friendUserIds provided
    let filteredPhotos = allPhotos;
    if (friendUserIds !== null && currentUserId) {
      const allowedUserIds = [...friendUserIds, currentUserId];
      filteredPhotos = allPhotos.filter(photo => allowedUserIds.includes(photo.userId));
    }

    // Sort by capturedAt in descending order (newest first) - client-side
    const sortedPhotos = filteredPhotos.sort((a, b) => {
      const aTime = a.capturedAt?.seconds || 0;
      const bTime = b.capturedAt?.seconds || 0;
      return bTime - aTime;
    });

    // Handle pagination manually
    const startIndex = lastDoc ? lastDoc.paginationIndex + 1 : 0;
    const endIndex = startIndex + limitCount;
    const paginatedPhotos = sortedPhotos.slice(startIndex, endIndex);

    // Create pagination marker
    const lastVisible = paginatedPhotos.length > 0 ? { paginationIndex: endIndex - 1 } : null;

    return {
      success: true,
      photos: paginatedPhotos,
      lastDoc: lastVisible,
      hasMore: endIndex < sortedPhotos.length,
    };
  } catch (error) {
    logger.error('Error fetching feed photos', error);
    return { success: false, error: error.message, photos: [] };
  }
};

/**
 * Subscribe to real-time feed updates
 * Listens for new journaled photos (filtered by friends)
 *
 * @param {function} callback - Callback function to handle updates
 * @param {number} limitCount - Number of photos to watch (default: 20)
 * @param {Array<string>} friendUserIds - Array of friend user IDs (optional)
 * @param {string} currentUserId - Current user ID (to include own photos)
 * @returns {function} - Unsubscribe function
 */
export const subscribeFeedPhotos = (
  callback,
  limitCount = 20,
  friendUserIds = null,
  currentUserId = null
) => {
  try {
    // Set up real-time listener
    const q = query(collection(db, 'photos'), where('photoState', '==', 'journal'));
    const unsubscribe = onSnapshot(
      q,
      async snapshot => {
        const allPhotos = await Promise.all(
          snapshot.docs.map(async photoDoc => {
            const photoData = photoDoc.data();

            // Fetch user data for each photo
            const userDocRef = doc(db, 'users', photoData.userId);
            const userDocSnap = await getDoc(userDocRef);
            const userData = userDocSnap.exists() ? userDocSnap.data() : {};

            return {
              id: photoDoc.id,
              ...photoData,
              user: {
                uid: photoData.userId,
                username: userData.username || 'unknown',
                displayName: userData.displayName || 'Unknown User',
                profilePhotoURL: userData.profilePhotoURL || null,
              },
            };
          })
        );

        // Filter by friends + current user if friendUserIds provided
        let filteredPhotos = allPhotos;
        if (friendUserIds !== null && currentUserId) {
          const allowedUserIds = [...friendUserIds, currentUserId];
          filteredPhotos = allPhotos.filter(photo => allowedUserIds.includes(photo.userId));
        }

        // Sort by capturedAt in descending order (newest first)
        const sortedPhotos = filteredPhotos.sort((a, b) => {
          const aTime = a.capturedAt?.seconds || 0;
          const bTime = b.capturedAt?.seconds || 0;
          return bTime - aTime;
        });

        // Limit to requested count
        const limitedPhotos = sortedPhotos.slice(0, limitCount);

        callback({ success: true, photos: limitedPhotos });
      },
      error => {
        logger.error('Error in feed subscription', error);
        callback({ success: false, error: error.message, photos: [] });
      }
    );

    return unsubscribe;
  } catch (error) {
    logger.error('Error subscribing to feed photos', error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Get a single photo by ID with user data
 * Used for photo detail modal
 *
 * @param {string} photoId - Photo document ID
 * @returns {Promise} - Photo data with user info
 */
export const getPhotoById = async photoId => {
  try {
    const photoRef = doc(db, 'photos', photoId);
    const photoDocSnap = await getDoc(photoRef);

    if (!photoDocSnap.exists()) {
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDocSnap.data();

    // Fetch user data
    const userDocRef = doc(db, 'users', photoData.userId);
    const userDocSnap = await getDoc(userDocRef);
    const userData = userDocSnap.exists() ? userDocSnap.data() : {};

    return {
      success: true,
      photo: {
        id: photoDocSnap.id,
        ...photoData,
        user: {
          uid: photoData.userId,
          username: userData.username || 'unknown',
          displayName: userData.displayName || 'Unknown User',
          profilePhotoURL: userData.profilePhotoURL || null,
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching photo by ID', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all photos from a specific user (for Friend Photo Viewer)
 * Includes both journaled AND archived photos
 *
 * @param {string} userId - User ID
 * @returns {Promise} - Array of user's photos
 */
export const getUserFeedPhotos = async userId => {
  try {
    // Query for all triaged photos (journaled + archived)
    const q = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'triaged'),
      orderBy('capturedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    // Fetch user data once
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    const userData = userDocSnap.exists() ? userDocSnap.data() : {};

    const photos = snapshot.docs.map(photoDoc => ({
      id: photoDoc.id,
      ...photoDoc.data(),
      user: {
        uid: userId,
        username: userData.username || 'unknown',
        displayName: userData.displayName || 'Unknown User',
        profilePhotoURL: userData.profilePhotoURL || null,
      },
    }));

    return { success: true, photos };
  } catch (error) {
    logger.error('Error fetching user feed photos', error);
    return { success: false, error: error.message, photos: [] };
  }
};

/**
 * Get feed statistics for debugging/testing
 *
 * @returns {Promise} - Feed stats object
 */
export const getFeedStats = async () => {
  try {
    const journaledQuery = query(
      collection(db, 'photos'),
      where('status', '==', 'triaged'),
      where('photoState', '==', 'journaled')
    );
    const archivedQuery = query(
      collection(db, 'photos'),
      where('status', '==', 'triaged'),
      where('photoState', '==', 'archived')
    );
    const developingQuery = query(collection(db, 'photos'), where('status', '==', 'developing'));

    const [journaledSnapshot, archivedSnapshot, developingSnapshot] = await Promise.all([
      getDocs(journaledQuery),
      getDocs(archivedQuery),
      getDocs(developingQuery),
    ]);

    return {
      success: true,
      stats: {
        journaledCount: journaledSnapshot.size,
        archivedCount: archivedSnapshot.size,
        developingCount: developingSnapshot.size,
        totalPhotos: journaledSnapshot.size + archivedSnapshot.size + developingSnapshot.size,
      },
    };
  } catch (error) {
    logger.error('Error fetching feed stats', error);
    return { success: false, error: error.message };
  }
};

/**
 * Toggle a reaction on a photo (increment count)
 * New data structure: reactions[userId][emoji] = count
 * Users can react multiple times with the same emoji
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID who is reacting
 * @param {string} emoji - Emoji reaction
 * @param {number} currentCount - Current count for this emoji (to increment)
 * @returns {Promise} - Success/error result
 */
export const toggleReaction = async (photoId, userId, emoji, currentCount) => {
  try {
    const photoRef = doc(db, 'photos', photoId);
    const photoDocSnap = await getDoc(photoRef);

    if (!photoDocSnap.exists()) {
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDocSnap.data();
    const reactions = photoData.reactions || {};

    // Initialize user's reactions if not exists
    if (!reactions[userId]) {
      reactions[userId] = {};
    }

    // Increment reaction count
    const newCount = currentCount + 1;
    reactions[userId][emoji] = newCount;

    // Calculate total reaction count
    let totalCount = 0;
    Object.values(reactions).forEach(userReactions => {
      if (typeof userReactions === 'object') {
        Object.values(userReactions).forEach(count => {
          totalCount += count;
        });
      }
    });

    // Update photo document
    await updateDoc(photoRef, {
      reactions,
      reactionCount: totalCount,
    });

    return { success: true, reactions, reactionCount: totalCount };
  } catch (error) {
    logger.error('Error toggling reaction', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get top photos by engagement (reaction count) for a specific user
 * Used for Stories feature - shows most engaging photos first
 *
 * @param {string} userId - User ID to fetch photos for
 * @param {number} limit - Maximum number of photos to return (default: 5)
 * @returns {Promise<{success: boolean, photos?: Array, error?: string}>}
 */
export const getTopPhotosByEngagement = async (userId, limit = 5) => {
  logger.debug('feedService.getTopPhotosByEngagement: Starting', { userId, limit });

  try {
    if (!userId) {
      logger.warn('feedService.getTopPhotosByEngagement: Missing userId');
      return { success: false, error: 'Invalid user ID' };
    }

    // Query photos where userId matches AND photoState == 'journal' (feed-visible only)
    // Using simple query to avoid composite index requirement
    const q = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('photoState', '==', 'journal')
    );
    const snapshot = await getDocs(q);

    logger.debug('feedService.getTopPhotosByEngagement: Query complete', {
      userId,
      totalPhotos: snapshot.size,
    });

    // Map to photo objects
    const photos = snapshot.docs.map(photoDoc => ({
      id: photoDoc.id,
      ...photoDoc.data(),
    }));

    // Sort client-side by reactionCount descending (highest engagement first)
    photos.sort((a, b) => {
      const aCount = a.reactionCount || 0;
      const bCount = b.reactionCount || 0;
      return bCount - aCount;
    });

    // Return top N photos
    const topPhotos = photos.slice(0, limit);

    logger.info('feedService.getTopPhotosByEngagement: Success', {
      userId,
      requested: limit,
      returned: topPhotos.length,
    });

    return { success: true, photos: topPhotos };
  } catch (error) {
    logger.error('feedService.getTopPhotosByEngagement: Failed', {
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get friend stories data for the Stories UI
 * Fetches all friends with ALL their journal photos in chronological order
 *
 * @param {string} currentUserId - Current user's ID
 * @returns {Promise<{success: boolean, friendStories?: Array, error?: string}>}
 */
export const getFriendStoriesData = async currentUserId => {
  logger.debug('feedService.getFriendStoriesData: Starting', { currentUserId });

  try {
    if (!currentUserId) {
      logger.warn('feedService.getFriendStoriesData: Missing currentUserId');
      return { success: false, error: 'Invalid user ID' };
    }

    // Step 1: Get friend user IDs
    const friendsResult = await getFriendUserIds(currentUserId);
    if (!friendsResult.success) {
      logger.error('feedService.getFriendStoriesData: Failed to get friend IDs', {
        error: friendsResult.error,
      });
      return { success: false, error: friendsResult.error };
    }

    const friendUserIds = friendsResult.friendUserIds || [];
    logger.debug('feedService.getFriendStoriesData: Got friend IDs', {
      friendCount: friendUserIds.length,
    });

    if (friendUserIds.length === 0) {
      logger.info('feedService.getFriendStoriesData: No friends found');
      return { success: true, friendStories: [] };
    }

    // Step 2: Fetch user profile and ALL photos for each friend in parallel
    const friendDataPromises = friendUserIds.map(async friendId => {
      // Fetch user profile
      const userDocRef = doc(db, 'users', friendId);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};

      // Fetch ALL journal photos for this friend (not just top 5)
      const photosQuery = query(
        collection(db, 'photos'),
        where('userId', '==', friendId),
        where('photoState', '==', 'journal')
      );
      const photosSnapshot = await getDocs(photosQuery);

      // Map and sort photos by capturedAt ASCENDING (oldest first for timeline viewing)
      const allPhotos = photosSnapshot.docs
        .map(photoDoc => ({
          id: photoDoc.id,
          ...photoDoc.data(),
        }))
        .sort((a, b) => {
          const aTime = a.capturedAt?.seconds || 0;
          const bTime = b.capturedAt?.seconds || 0;
          return aTime - bTime; // Ascending - oldest first
        });

      const totalPhotoCount = allPhotos.length;

      // Thumbnail URL is the MOST RECENT photo (last in sorted array)
      const thumbnailURL = allPhotos.length > 0 ? allPhotos[allPhotos.length - 1].imageURL : null;

      // Most recent capturedAt for friend row sorting (newest friend first)
      const mostRecentCapturedAt =
        allPhotos.length > 0 ? allPhotos[allPhotos.length - 1].capturedAt?.seconds || 0 : 0;

      logger.debug('feedService.getFriendStoriesData: Friend photos loaded', {
        friendId,
        photoCount: totalPhotoCount,
        firstPhotoTime: allPhotos[0]?.capturedAt?.seconds,
        lastPhotoTime: mostRecentCapturedAt,
      });

      return {
        userId: friendId,
        username: userData.username || 'unknown',
        displayName: userData.displayName || 'Unknown User',
        profilePhotoURL: userData.profilePhotoURL || null,
        topPhotos: allPhotos, // All photos in chronological order (backwards compatible name)
        thumbnailURL, // Most recent photo for story card preview
        totalPhotoCount,
        hasPhotos: totalPhotoCount > 0,
        mostRecentCapturedAt,
      };
    });

    const friendDataResults = await Promise.all(friendDataPromises);

    // Step 3: Filter out friends with zero photos
    const friendsWithPhotos = friendDataResults.filter(friend => friend.hasPhotos);

    logger.debug('feedService.getFriendStoriesData: Filtered friends', {
      totalFriends: friendDataResults.length,
      friendsWithPhotos: friendsWithPhotos.length,
    });

    // Step 4: Sort by most recent photo (newest first)
    friendsWithPhotos.sort((a, b) => {
      const aTime = a.mostRecentCapturedAt || 0;
      const bTime = b.mostRecentCapturedAt || 0;
      return bTime - aTime;
    });

    // Clean up the sorting helper field but keep thumbnailURL
    const friendStories = friendsWithPhotos.map(({ mostRecentCapturedAt, ...friend }) => friend);

    logger.info('feedService.getFriendStoriesData: Success', {
      currentUserId,
      friendStoriesCount: friendStories.length,
    });

    return { success: true, friendStories };
  } catch (error) {
    logger.error('feedService.getFriendStoriesData: Failed', {
      currentUserId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
