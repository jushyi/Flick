import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Get feed photos (all journaled photos from all users)
 * For MVP: Shows ALL users' journaled photos
 * Week 9: Will be filtered to friends-only
 *
 * @param {number} limitCount - Number of photos to fetch (default: 20)
 * @param {object} lastDoc - Last document for pagination (optional)
 * @returns {Promise} - Feed photos array and last document
 */
export const getFeedPhotos = async (limitCount = 20, lastDoc = null) => {
  try {
    // Simplified query: Only filter by photoState = 'journal'
    // Status will be implicitly 'triaged' since only triaged photos have photoState
    // We'll sort in JavaScript to avoid composite index requirement
    let feedQuery = query(
      collection(db, 'photos'),
      where('photoState', '==', 'journal')
    );

    const snapshot = await getDocs(feedQuery);

    // Fetch all photos with user data
    const allPhotos = await Promise.all(
      snapshot.docs.map(async (photoDoc) => {
        const photoData = photoDoc.data();

        // Fetch user data for each photo
        const userDoc = await getDoc(doc(db, 'users', photoData.userId));
        const userData = userDoc.exists() ? userDoc.data() : {};

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

    // Sort by capturedAt in descending order (newest first) - client-side
    const sortedPhotos = allPhotos.sort((a, b) => {
      const aTime = a.capturedAt?.seconds || 0;
      const bTime = b.capturedAt?.seconds || 0;
      return bTime - aTime;
    });

    // Handle pagination manually
    const startIndex = lastDoc ? lastDoc.paginationIndex + 1 : 0;
    const endIndex = startIndex + limitCount;
    const paginatedPhotos = sortedPhotos.slice(startIndex, endIndex);

    // Create pagination marker
    const lastVisible = paginatedPhotos.length > 0
      ? { paginationIndex: endIndex - 1 }
      : null;

    return {
      success: true,
      photos: paginatedPhotos,
      lastDoc: lastVisible,
      hasMore: endIndex < sortedPhotos.length,
    };
  } catch (error) {
    console.error('Error fetching feed photos:', error);
    return { success: false, error: error.message, photos: [] };
  }
};

/**
 * Subscribe to real-time feed updates
 * Listens for new journaled photos
 *
 * @param {function} callback - Callback function to handle updates
 * @param {number} limitCount - Number of photos to watch (default: 20)
 * @returns {function} - Unsubscribe function
 */
export const subscribeFeedPhotos = (callback, limitCount = 20) => {
  try {
    // Simplified query to avoid composite index
    const feedQuery = query(
      collection(db, 'photos'),
      where('photoState', '==', 'journal')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      feedQuery,
      async (snapshot) => {
        const allPhotos = await Promise.all(
          snapshot.docs.map(async (photoDoc) => {
            const photoData = photoDoc.data();

            // Fetch user data for each photo
            const userDoc = await getDoc(doc(db, 'users', photoData.userId));
            const userData = userDoc.exists() ? userDoc.data() : {};

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

        // Sort by capturedAt in descending order (newest first)
        const sortedPhotos = allPhotos.sort((a, b) => {
          const aTime = a.capturedAt?.seconds || 0;
          const bTime = b.capturedAt?.seconds || 0;
          return bTime - aTime;
        });

        // Limit to requested count
        const limitedPhotos = sortedPhotos.slice(0, limitCount);

        callback({ success: true, photos: limitedPhotos });
      },
      (error) => {
        console.error('Error in feed subscription:', error);
        callback({ success: false, error: error.message, photos: [] });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to feed photos:', error);
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
export const getPhotoById = async (photoId) => {
  try {
    const photoDoc = await getDoc(doc(db, 'photos', photoId));

    if (!photoDoc.exists()) {
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDoc.data();

    // Fetch user data
    const userDoc = await getDoc(doc(db, 'users', photoData.userId));
    const userData = userDoc.exists() ? userDoc.data() : {};

    return {
      success: true,
      photo: {
        id: photoDoc.id,
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
    console.error('Error fetching photo by ID:', error);
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
export const getUserFeedPhotos = async (userId) => {
  try {
    // Query for all triaged photos (journaled + archived)
    const photosQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'triaged'),
      orderBy('capturedAt', 'desc')
    );

    const snapshot = await getDocs(photosQuery);

    // Fetch user data once
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : {};

    const photos = snapshot.docs.map((photoDoc) => ({
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
    console.error('Error fetching user feed photos:', error);
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

    const developingQuery = query(
      collection(db, 'photos'),
      where('status', '==', 'developing')
    );

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
    console.error('Error fetching feed stats:', error);
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
    const photoDoc = await getDoc(photoRef);

    if (!photoDoc.exists()) {
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDoc.data();
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
    Object.values(reactions).forEach((userReactions) => {
      if (typeof userReactions === 'object') {
        Object.values(userReactions).forEach((count) => {
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
    console.error('Error toggling reaction:', error);
    return { success: false, error: error.message };
  }
};
