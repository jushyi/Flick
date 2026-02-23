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
  limit,
  startAfter,
  onSnapshot,
  Timestamp,
  getCountFromServer,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';
import { getFriendUserIds } from './friendshipService';
import { getBlockedByUserIds, getBlockedUserIds } from './blockService';
import { withTrace } from './performanceService';

const db = getFirestore();

// Firestore `in` operator limit
const FIRESTORE_IN_LIMIT = 30;

/**
 * Chunk an array into batches for Firestore `in` operator (max 30 values)
 */
const chunkArray = (array, size = FIRESTORE_IN_LIMIT) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Batch fetch user data for a set of user IDs with deduplication
 * Returns a Map of userId -> userData for O(1) lookups
 * Eliminates N+1 reads by fetching each unique user only once
 *
 * @param {string[]} userIds - Array of user IDs (may contain duplicates)
 * @returns {Promise<Map<string, object>>} Map of userId to user data object
 */
const batchFetchUserData = async userIds => {
  const uniqueIds = [...new Set(userIds)];
  const userMap = new Map();

  if (uniqueIds.length === 0) return userMap;

  const userDocs = await Promise.all(uniqueIds.map(id => getDoc(doc(db, 'users', id))));

  userDocs.forEach((userDocSnap, index) => {
    const userData = userDocSnap.exists() ? userDocSnap.data() : {};
    userMap.set(uniqueIds[index], {
      uid: uniqueIds[index],
      username: userData.username || 'unknown',
      displayName: userData.displayName || 'Unknown User',
      profilePhotoURL: userData.profilePhotoURL || userData.photoURL || null,
      nameColor: userData.nameColor || null,
    });
  });

  return userMap;
};

// Content visibility duration constants
const STORIES_VISIBILITY_DAYS = 7; // Stories visible for 7 days
const FEED_VISIBILITY_DAYS = 1; // Feed posts visible for 1 day

/**
 * Get a Firestore Timestamp for the cutoff date
 * Used for visibility windows based on triage time (when user chose to share photo)
 * @param {number} days - Number of days back from now
 * @returns {Timestamp} - Firestore Timestamp for use in triagedAt queries
 */
const getCutoffTimestamp = days => {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return Timestamp.fromDate(cutoffDate);
};

/**
 * Get feed photos (journaled photos from friends only)
 * Feed shows friend activity from the last 1 day (FEED_VISIBILITY_DAYS)
 * Own posts excluded - feed is 100% friend activity
 *
 * Uses Firestore `in` operator for server-side friend filtering (chunked at 30).
 * Cursor-based pagination with DocumentSnapshot for efficient paging.
 *
 * @param {number} limitCount - Number of photos to fetch (default: 20)
 * @param {object} lastDoc - Last DocumentSnapshot for cursor pagination (optional)
 * @param {Array<string>} friendUserIds - Array of friend user IDs (optional)
 * @param {string} currentUserId - Current user ID (to exclude own photos)
 * @returns {Promise} - Feed photos array and last document snapshot
 */
export const getFeedPhotos = async (
  limitCount = 20,
  lastDoc = null,
  friendUserIds = null,
  currentUserId = null
) => {
  return withTrace(
    'feed/load',
    async trace => {
      try {
        if (!friendUserIds || friendUserIds.length === 0) {
          return { success: true, photos: [], lastDoc: null, hasMore: false };
        }

        const cutoff = getCutoffTimestamp(FEED_VISIBILITY_DAYS);

        // Chunk friendIds into batches of 30 (Firestore `in` operator limit)
        const chunks = chunkArray(friendUserIds);

        // Query each chunk with server-side filtering
        const chunkPromises = chunks.map(chunk => {
          const constraints = [
            where('userId', 'in', chunk),
            where('photoState', '==', 'journal'),
            where('triagedAt', '>=', cutoff),
            orderBy('triagedAt', 'desc'),
            limit(limitCount),
          ];

          if (lastDoc) {
            constraints.push(startAfter(lastDoc));
          }

          return getDocs(query(collection(db, 'photos'), ...constraints));
        });

        const snapshots = await Promise.all(chunkPromises);

        // Collect all docs with their snapshots for cursor tracking
        const allDocsWithSnapshots = snapshots.flatMap(snapshot =>
          snapshot.docs.map(d => ({ docSnap: d, data: d.data() }))
        );

        // Sort by triagedAt desc across all chunks
        allDocsWithSnapshots.sort((a, b) => {
          const aTime = a.data.triagedAt?.seconds || 0;
          const bTime = b.data.triagedAt?.seconds || 0;
          return bTime - aTime;
        });

        // Apply limit across merged results
        const limitedDocs = allDocsWithSnapshots.slice(0, limitCount);

        // Get users who have blocked the current user AND users current user has blocked
        let blockedByUserIds = [];
        let blockedUserIds = [];
        if (currentUserId) {
          const [blockedByResult, blockedResult] = await Promise.all([
            getBlockedByUserIds(currentUserId),
            getBlockedUserIds(currentUserId),
          ]);
          blockedByUserIds = blockedByResult.success ? blockedByResult.blockedByUserIds : [];
          blockedUserIds = blockedResult.success ? blockedResult.blockedUserIds : [];
        }
        const allBlockedIds = [...new Set([...blockedByUserIds, ...blockedUserIds])];

        // Batch fetch user data with deduplication (eliminates N+1 reads)
        const userIds = limitedDocs.map(({ data: photoData }) => photoData.userId);
        const userMap = await batchFetchUserData(userIds);

        // Build photo objects using the lookup map
        const allPhotos = limitedDocs.map(({ docSnap: photoDocSnap, data: photoData }) => ({
          id: photoDocSnap.id,
          ...photoData,
          user: userMap.get(photoData.userId) || {
            uid: photoData.userId,
            username: 'unknown',
            displayName: 'Unknown User',
            profilePhotoURL: null,
            nameColor: null,
          },
        }));

        // Client-side: filter blocked users only (friend filtering done server-side)
        const filteredPhotos =
          allBlockedIds.length > 0
            ? allPhotos.filter(photo => !allBlockedIds.includes(photo.userId))
            : allPhotos;

        // Last document snapshot for cursor-based pagination
        const lastVisible =
          limitedDocs.length > 0 ? limitedDocs[limitedDocs.length - 1].docSnap : null;

        trace.putMetric('photo_count', filteredPhotos.length);
        trace.putMetric('friend_count', friendUserIds.length);

        return {
          success: true,
          photos: filteredPhotos,
          lastDoc: lastVisible,
          hasMore: limitedDocs.length === limitCount,
        };
      } catch (error) {
        logger.error('Error fetching feed photos', error);
        return { success: false, error: error.message, photos: [] };
      }
    },
    { cache_status: lastDoc ? 'paginated' : 'initial' }
  );
};

/**
 * Subscribe to real-time feed updates
 * Listens for friend posts from the last 1 day (FEED_VISIBILITY_DAYS)
 * Own posts excluded - feed is 100% friend activity
 *
 * Uses Firestore `in` operator for server-side friend filtering (chunked at 30).
 * Creates one onSnapshot listener per chunk, merges results client-side.
 *
 * @param {function} callback - Callback function to handle updates
 * @param {number} limitCount - Number of photos to watch (default: 20)
 * @param {Array<string>} friendUserIds - Array of friend user IDs (optional)
 * @param {string} currentUserId - Current user ID (to exclude own photos)
 * @returns {function} - Unsubscribe function that cleans up ALL chunk listeners
 */
export const subscribeFeedPhotos = (
  callback,
  limitCount = 20,
  friendUserIds = null,
  currentUserId = null
) => {
  try {
    if (!friendUserIds || friendUserIds.length === 0) {
      callback({ success: true, photos: [] });
      return () => {};
    }

    const cutoff = getCutoffTimestamp(FEED_VISIBILITY_DAYS);

    // Chunk friendIds into batches of 30 (Firestore `in` operator limit)
    const chunks = chunkArray(friendUserIds);

    // Map to store photos by chunk index for merging across listeners
    const photosByChunk = new Map();
    const unsubscribes = [];

    // Merge all chunk results, filter, sort, and notify caller
    const mergeAndNotify = async () => {
      const mergedMap = new Map();
      photosByChunk.forEach(chunkMap => {
        chunkMap.forEach((photo, id) => mergedMap.set(id, photo));
      });

      // Get users who have blocked the current user AND users current user has blocked
      let blockedByUserIds = [];
      let blockedUserIds = [];
      if (currentUserId) {
        const [blockedByResult, blockedResult] = await Promise.all([
          getBlockedByUserIds(currentUserId),
          getBlockedUserIds(currentUserId),
        ]);
        blockedByUserIds = blockedByResult.success ? blockedByResult.blockedByUserIds : [];
        blockedUserIds = blockedResult.success ? blockedResult.blockedUserIds : [];
      }
      const allBlockedIds = [...new Set([...blockedByUserIds, ...blockedUserIds])];

      // Convert to array, filter blocked users, sort by triagedAt desc, apply limit
      let photos = Array.from(mergedMap.values());
      if (allBlockedIds.length > 0) {
        photos = photos.filter(photo => !allBlockedIds.includes(photo.userId));
      }

      photos.sort((a, b) => {
        const aTime = a.triagedAt?.seconds || 0;
        const bTime = b.triagedAt?.seconds || 0;
        return bTime - aTime;
      });

      callback({ success: true, photos: photos.slice(0, limitCount) });
    };

    // Create one listener per chunk
    chunks.forEach((chunk, chunkIndex) => {
      const q = query(
        collection(db, 'photos'),
        where('userId', 'in', chunk),
        where('photoState', '==', 'journal'),
        where('triagedAt', '>=', cutoff),
        orderBy('triagedAt', 'desc'),
        limit(limitCount)
      );

      const unsubscribe = onSnapshot(
        q,
        async snapshot => {
          try {
            const chunkPhotos = new Map();

            // Batch fetch user data with deduplication (eliminates N+1 reads)
            const chunkUserIds = snapshot.docs.map(photoDoc => photoDoc.data().userId);
            const userMap = await batchFetchUserData(chunkUserIds);

            snapshot.docs.forEach(photoDoc => {
              const photoData = photoDoc.data();
              chunkPhotos.set(photoDoc.id, {
                id: photoDoc.id,
                ...photoData,
                user: userMap.get(photoData.userId) || {
                  uid: photoData.userId,
                  username: 'unknown',
                  displayName: 'Unknown User',
                  profilePhotoURL: null,
                  nameColor: null,
                },
              });
            });

            photosByChunk.set(chunkIndex, chunkPhotos);
            await mergeAndNotify();
          } catch (err) {
            logger.error('Error processing feed snapshot chunk', {
              chunkIndex,
              error: err.message,
            });
          }
        },
        error => {
          logger.error('Error in feed subscription chunk', { chunkIndex, error });
          callback({ success: false, error: error.message, photos: [] });
        }
      );

      unsubscribes.push(unsubscribe);
    });

    // Return cleanup that unsubscribes ALL chunk listeners
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  } catch (error) {
    logger.error('Error subscribing to feed photos', error);
    return () => {};
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
          profilePhotoURL: userData.profilePhotoURL || userData.photoURL || null,
          nameColor: userData.nameColor || null,
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching photo by ID', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get photos from a specific user (for Friend Photo Viewer)
 * Includes both journaled AND archived photos
 * Supports cursor-based pagination with limit
 *
 * @param {string} userId - User ID
 * @param {number} limitCount - Number of photos to fetch (default: 50)
 * @param {object} lastDoc - Last DocumentSnapshot for cursor pagination (optional)
 * @returns {Promise} - Array of user's photos with pagination info
 */
export const getUserFeedPhotos = async (userId, limitCount = 50, lastDoc = null) => {
  return withTrace('feed/refresh', async trace => {
    try {
      const constraints = [
        where('userId', '==', userId),
        where('status', '==', 'triaged'),
        orderBy('capturedAt', 'desc'),
        limit(limitCount),
      ];

      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(collection(db, 'photos'), ...constraints);
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
          profilePhotoURL: userData.profilePhotoURL || userData.photoURL || null,
          nameColor: userData.nameColor || null,
        },
      }));

      const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

      trace.putMetric('photo_count', photos.length);

      return {
        success: true,
        photos,
        lastDoc: lastVisible,
        hasMore: snapshot.docs.length === limitCount,
      };
    } catch (error) {
      logger.error('Error fetching user feed photos', error);
      return { success: false, error: error.message, photos: [] };
    }
  });
};

/**
 * Get feed statistics for debugging/testing
 *
 * @returns {Promise} - Feed stats object
 */
export const getFeedStats = async () => {
  try {
    // Use count() aggregation to avoid downloading documents — just returns counts
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

    const [journaledCount, archivedCount, developingCount] = await Promise.all([
      getCountFromServer(journaledQuery),
      getCountFromServer(archivedQuery),
      getCountFromServer(developingQuery),
    ]);

    const journaled = journaledCount.data().count;
    const archived = archivedCount.data().count;
    const developing = developingCount.data().count;

    return {
      success: true,
      stats: {
        journaledCount: journaled,
        archivedCount: archived,
        developingCount: developing,
        totalPhotos: journaled + archived + developing,
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
 * @param {number} maxCount - Maximum number of photos to return (default: 5)
 * @returns {Promise<{success: boolean, photos?: Array, error?: string}>}
 */
export const getTopPhotosByEngagement = async (userId, maxCount = 5) => {
  logger.debug('feedService.getTopPhotosByEngagement: Starting', { userId, maxCount });

  try {
    if (!userId) {
      logger.warn('feedService.getTopPhotosByEngagement: Missing userId');
      return { success: false, error: 'Invalid user ID' };
    }

    // Query photos where userId matches AND photoState == 'journal' (feed-visible only)
    // Sorts by engagement client-side since reactionCount ordering varies per request
    const q = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('photoState', '==', 'journal'),
      limit(100) // Safety bound; client-side sort picks top N from this set
    );
    const snapshot = await getDocs(q);

    logger.debug('feedService.getTopPhotosByEngagement: Query complete', {
      userId,
      totalPhotos: snapshot.size,
    });

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

    const topPhotos = photos.slice(0, maxCount);

    logger.info('feedService.getTopPhotosByEngagement: Success', {
      userId,
      requested: maxCount,
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
 * Get current user's own stories data for the Stories UI
 * Fetches journaled photos from the last 7 days (STORIES_VISIBILITY_DAYS)
 *
 * @param {string} userId - User's ID
 * @param {Object} [userProfile] - Optional user profile from AuthContext (skips Firestore read)
 * @returns {Promise<{success: boolean, userStory?: Object, error?: string}>}
 */
export const getUserStoriesData = async (userId, userProfile = null) => {
  logger.debug('feedService.getUserStoriesData: Starting', { userId, hasProfile: !!userProfile });

  try {
    if (!userId) {
      logger.warn('feedService.getUserStoriesData: Missing userId');
      return { success: false, error: 'Invalid user ID' };
    }

    // Use provided profile if available, otherwise fetch from Firestore
    let userData;
    if (userProfile) {
      userData = userProfile;
    } else {
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      userData = userDocSnap.exists() ? userDocSnap.data() : {};
    }

    // Query photos where userId matches AND photoState == 'journal' AND within visibility window
    // Uses triagedAt so visibility window starts from when user shared the photo
    const cutoff = getCutoffTimestamp(STORIES_VISIBILITY_DAYS);
    const photosQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('photoState', '==', 'journal'),
      where('triagedAt', '>=', cutoff),
      orderBy('triagedAt', 'desc'),
      limit(100) // Safety bound on user's own stories within 7-day window
    );
    const photosSnapshot = await getDocs(photosQuery);

    // Create user object for attaching to each photo
    const userObj = {
      uid: userId,
      username: userData.username || 'unknown',
      displayName: userData.displayName || 'Me',
      profilePhotoURL: userData.profilePhotoURL || userData.photoURL || null,
      nameColor: userData.nameColor || null,
    };

    // Map and sort photos by capturedAt ASCENDING (oldest first for timeline viewing)
    // Attach user data to each photo so PhotoDetailScreen can display it
    const allPhotos = photosSnapshot.docs
      .map(photoDoc => ({
        id: photoDoc.id,
        ...photoDoc.data(),
        user: userObj, // Attach user data for PhotoDetailScreen display
      }))
      .sort((a, b) => {
        const aTime = a.capturedAt?.seconds || 0;
        const bTime = b.capturedAt?.seconds || 0;
        return aTime - bTime; // Ascending - oldest first
      });

    const totalPhotoCount = allPhotos.length;

    // Thumbnail URL is the MOST RECENT photo (last in sorted array)
    const thumbnailURL = allPhotos.length > 0 ? allPhotos[allPhotos.length - 1].imageURL : null;

    logger.info('feedService.getUserStoriesData: Success', {
      userId,
      photoCount: totalPhotoCount,
    });

    return {
      success: true,
      userStory: {
        userId,
        displayName: userObj.displayName,
        profilePhotoURL: userObj.profilePhotoURL,
        nameColor: userObj.nameColor,
        topPhotos: allPhotos, // All photos in chronological order
        thumbnailURL, // Most recent photo for story card preview
        totalPhotoCount,
        hasPhotos: totalPhotoCount > 0,
      },
    };
  } catch (error) {
    logger.error('feedService.getUserStoriesData: Failed', {
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get friend stories data for the Stories UI
 * Fetches friends with photos from the last 7 days (STORIES_VISIBILITY_DAYS)
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
      return { success: false, error: friendsResult.error, totalFriendCount: 0 };
    }

    const friendUserIds = friendsResult.friendUserIds || [];
    logger.debug('feedService.getFriendStoriesData: Got friend IDs', {
      friendCount: friendUserIds.length,
    });

    if (friendUserIds.length === 0) {
      logger.info('feedService.getFriendStoriesData: No friends found');
      return { success: true, friendStories: [], totalFriendCount: 0 };
    }

    // Get users who have blocked the current user AND users current user has blocked
    const [blockedByResult, blockedResult] = await Promise.all([
      getBlockedByUserIds(currentUserId),
      getBlockedUserIds(currentUserId),
    ]);
    const blockedByUserIds = blockedByResult.success ? blockedByResult.blockedByUserIds : [];
    const blockedUserIds = blockedResult.success ? blockedResult.blockedUserIds : [];
    const allBlockedIds = [...new Set([...blockedByUserIds, ...blockedUserIds])];
    const visibleFriendIds = friendUserIds.filter(fid => !allBlockedIds.includes(fid));

    logger.debug('feedService.getFriendStoriesData: Filtered blocked users', {
      originalCount: friendUserIds.length,
      blockedCount: blockedByUserIds.length,
      visibleCount: visibleFriendIds.length,
    });

    if (visibleFriendIds.length === 0) {
      logger.info('feedService.getFriendStoriesData: No visible friends after block filter');
      return { success: true, friendStories: [], totalFriendCount: friendUserIds.length };
    }

    // Calculate cutoff timestamp once for all queries
    const cutoff = getCutoffTimestamp(STORIES_VISIBILITY_DAYS);

    // Step 2: Fetch user profile and photos within visibility window for each visible friend in parallel
    const friendDataPromises = visibleFriendIds.map(async friendId => {
      // Fetch user profile
      const userDocRef = doc(db, 'users', friendId);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};

      // Fetch journal photos from last 7 days for this friend
      // Uses triagedAt so visibility window starts from when user shared the photo
      const photosQuery = query(
        collection(db, 'photos'),
        where('userId', '==', friendId),
        where('photoState', '==', 'journal'),
        where('triagedAt', '>=', cutoff),
        orderBy('triagedAt', 'desc'),
        limit(100) // Safety bound on friend's stories within 7-day window
      );
      const photosSnapshot = await getDocs(photosQuery);

      // Create user object for attaching to each photo
      const userObj = {
        uid: friendId,
        username: userData.username || 'unknown',
        displayName: userData.displayName || 'Unknown User',
        profilePhotoURL: userData.profilePhotoURL || userData.photoURL || null,
        nameColor: userData.nameColor || null,
      };

      // Map and sort photos by capturedAt ASCENDING (oldest first for timeline viewing)
      // Attach user data to each photo so PhotoDetailScreen can display it
      const allPhotos = photosSnapshot.docs
        .map(photoDoc => ({
          id: photoDoc.id,
          ...photoDoc.data(),
          user: userObj, // Attach user data for PhotoDetailScreen display
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
        username: userObj.username,
        displayName: userObj.displayName,
        profilePhotoURL: userObj.profilePhotoURL,
        nameColor: userObj.nameColor,
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

    return { success: true, friendStories, totalFriendCount: friendUserIds.length };
  } catch (error) {
    logger.error('feedService.getFriendStoriesData: Failed', {
      currentUserId,
      error: error.message,
    });
    return { success: false, error: error.message, totalFriendCount: 0 };
  }
};

/**
 * Get random friend photos for empty feed fallback
 * Returns historical photos from friends when no recent posts exist
 * No time filter - gets all journaled photos from friends
 *
 * Uses Firestore `in` operator for server-side friend filtering (chunked at 30).
 * Limited to 50 docs per chunk to avoid unbounded reads.
 *
 * @param {Array<string>} friendUserIds - Array of friend user IDs
 * @param {number} limitCount - Maximum number of photos to return (default: 10)
 * @param {string} currentUserId - Current user ID (to exclude blocked users)
 * @returns {Promise<{success: boolean, photos?: Array, error?: string}>}
 */
export const getRandomFriendPhotos = async (
  friendUserIds,
  limitCount = 10,
  currentUserId = null
) => {
  logger.debug('feedService.getRandomFriendPhotos: Starting', {
    friendCount: friendUserIds?.length,
    limitCount,
    currentUserId,
  });

  try {
    if (!friendUserIds || friendUserIds.length === 0) {
      return { success: true, photos: [] };
    }

    // Get users who have blocked the current user AND users current user has blocked
    let allBlockedIds = [];
    if (currentUserId) {
      const [blockedByResult, blockedResult] = await Promise.all([
        getBlockedByUserIds(currentUserId),
        getBlockedUserIds(currentUserId),
      ]);
      const blockedByUserIds = blockedByResult.success ? blockedByResult.blockedByUserIds : [];
      const blockedUserIds = blockedResult.success ? blockedResult.blockedUserIds : [];
      allBlockedIds = [...new Set([...blockedByUserIds, ...blockedUserIds])];
    }

    // Filter out blocked users before querying
    const visibleFriendIds =
      allBlockedIds.length > 0
        ? friendUserIds.filter(id => !allBlockedIds.includes(id))
        : friendUserIds;

    if (visibleFriendIds.length === 0) {
      return { success: true, photos: [] };
    }

    // Chunk friendIds into batches of 30 (Firestore `in` operator limit)
    const chunks = chunkArray(visibleFriendIds);

    // Query each chunk with server-side filtering and limit
    const chunkPromises = chunks.map(chunk => {
      const q = query(
        collection(db, 'photos'),
        where('userId', 'in', chunk),
        where('photoState', '==', 'journal'),
        limit(50)
      );
      return getDocs(q);
    });

    const snapshots = await Promise.all(chunkPromises);

    // Merge results and batch fetch user data with deduplication
    const allDocs = snapshots.flatMap(snapshot => snapshot.docs);
    const randomUserIds = allDocs.map(photoDoc => photoDoc.data().userId);
    const userMap = await batchFetchUserData(randomUserIds);

    const friendPhotos = allDocs.map(photoDoc => {
      const photoData = photoDoc.data();
      return {
        id: photoDoc.id,
        ...photoData,
        user: userMap.get(photoData.userId) || {
          uid: photoData.userId,
          username: 'unknown',
          displayName: 'Unknown User',
          profilePhotoURL: null,
        },
        isArchivePhoto: true,
      };
    });

    // Shuffle randomly using Fisher-Yates algorithm
    const shuffled = [...friendPhotos];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const result = shuffled.slice(0, limitCount);

    logger.info('feedService.getRandomFriendPhotos: Success', {
      totalFriendPhotos: friendPhotos.length,
      returned: result.length,
    });

    return { success: true, photos: result };
  } catch (error) {
    logger.error('feedService.getRandomFriendPhotos: Failed', { error: error.message });
    return { success: false, error: error.message, photos: [] };
  }
};
