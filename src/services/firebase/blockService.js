/**
 * Block Service
 *
 * Handles user blocking operations. When a user blocks another:
 * - Block makes the blocker invisible to the blocked user (not vice versa)
 * - Blocked user's comments and reactions are removed from blocker's photos
 * - Unblocking does NOT automatically restore removed content
 *
 * Block Data Model:
 * blocks/{blockerId}_{blockedId}
 * {
 *   blockerId: string,      // User who blocked
 *   blockedId: string,      // User who is blocked
 *   createdAt: serverTimestamp()
 * }
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';
import { getUserProfile } from './userService';

const db = getFirestore();

/**
 * Generate deterministic block ID from blocker and blocked user IDs
 * Note: Unlike friendships, block direction matters - {blockerId}_{blockedId}
 *
 * @param {string} blockerId - User who is blocking
 * @param {string} blockedId - User being blocked
 * @returns {string} Block ID in format: {blockerId}_{blockedId}
 */
const generateBlockId = (blockerId, blockedId) => {
  return `${blockerId}_${blockedId}`;
};

/**
 * Block a user
 * Creates block document and removes blocked user's content from blocker's photos
 *
 * @param {string} blockerId - User doing the blocking
 * @param {string} blockedId - User being blocked
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const blockUser = async (blockerId, blockedId) => {
  try {
    // Validation
    if (!blockerId || !blockedId) {
      return { success: false, error: 'Invalid user IDs' };
    }

    if (blockerId === blockedId) {
      return { success: false, error: 'Cannot block yourself' };
    }

    const blockId = generateBlockId(blockerId, blockedId);
    const blockRef = doc(db, 'blocks', blockId);
    const blockDocSnap = await getDoc(blockRef);

    if (blockDocSnap.exists()) {
      return { success: false, error: 'User already blocked' };
    }

    await setDoc(blockRef, {
      blockerId,
      blockedId,
      createdAt: serverTimestamp(),
    });

    // Cascade: Remove blocked user's content from blocker's photos
    await removeBlockedUserContent(blockerId, blockedId);

    logger.info(`User ${blockerId} blocked ${blockedId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error blocking user', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove blocked user's comments and reactions from blocker's photos
 * Internal helper function
 *
 * @param {string} blockerId - User who blocked (photo owner)
 * @param {string} blockedId - User whose content to remove
 */
const removeBlockedUserContent = async (blockerId, blockedId) => {
  try {
    const photosQuery = query(collection(db, 'photos'), where('userId', '==', blockerId));
    const photosSnapshot = await getDocs(photosQuery);

    if (photosSnapshot.empty) {
      return; // No photos, nothing to clean up
    }

    const deletePromises = [];

    for (const photoDoc of photosSnapshot.docs) {
      const photoId = photoDoc.id;
      const photoData = photoDoc.data();

      // 1. Delete blocked user's comments from this photo's subcollection
      const commentsQuery = query(
        collection(db, 'photos', photoId, 'comments'),
        where('userId', '==', blockedId)
      );
      const commentsSnapshot = await getDocs(commentsQuery);

      for (const commentDoc of commentsSnapshot.docs) {
        deletePromises.push(deleteDoc(doc(db, 'photos', photoId, 'comments', commentDoc.id)));
      }

      // 2. Remove blocked user's reactions from this photo
      const reactions = photoData.reactions || {};
      if (reactions[blockedId]) {
        delete reactions[blockedId];

        // Recalculate total reaction count
        let totalCount = 0;
        Object.values(reactions).forEach(userReactions => {
          if (typeof userReactions === 'object') {
            Object.values(userReactions).forEach(count => {
              totalCount += count || 0;
            });
          }
        });

        deletePromises.push(
          updateDoc(doc(db, 'photos', photoId), {
            reactions,
            reactionCount: totalCount,
          })
        );
      }
    }

    await Promise.all(deletePromises);
    logger.info(`Removed blocked user ${blockedId} content from ${blockerId}'s photos`);
  } catch (error) {
    // Log error but don't fail the block operation
    logger.error('Error removing blocked user content', error);
  }
};

/**
 * Unblock a user
 * Removes block document. Does NOT restore previously removed content.
 *
 * @param {string} blockerId - User who blocked
 * @param {string} blockedId - User to unblock
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const unblockUser = async (blockerId, blockedId) => {
  try {
    if (!blockerId || !blockedId) {
      return { success: false, error: 'Invalid user IDs' };
    }

    const blockId = generateBlockId(blockerId, blockedId);
    const blockRef = doc(db, 'blocks', blockId);
    const blockDocSnap = await getDoc(blockRef);

    if (!blockDocSnap.exists()) {
      return { success: false, error: 'Block not found' };
    }

    await deleteDoc(blockRef);

    logger.info(`User ${blockerId} unblocked ${blockedId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error unblocking user', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if a user has blocked another user
 *
 * @param {string} blockerId - User who might have blocked
 * @param {string} blockedId - User who might be blocked
 * @returns {Promise<{success: boolean, isBlocked?: boolean, error?: string}>}
 */
export const isBlocked = async (blockerId, blockedId) => {
  try {
    if (!blockerId || !blockedId) {
      return { success: false, error: 'Invalid user IDs' };
    }

    const blockId = generateBlockId(blockerId, blockedId);
    const blockRef = doc(db, 'blocks', blockId);
    const blockDocSnap = await getDoc(blockRef);

    return { success: true, isBlocked: blockDocSnap.exists() };
  } catch (error) {
    logger.error('Error checking block status', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get list of user IDs who have blocked this user
 * Used to filter content from people who blocked current user
 *
 * @param {string} userId - User ID to check who blocked them
 * @returns {Promise<{success: boolean, blockedByUserIds?: string[], error?: string}>}
 */
export const getBlockedByUserIds = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    // Query blocks where this user is the blocked party
    const blocksQuery = query(collection(db, 'blocks'), where('blockedId', '==', userId));
    const blocksSnapshot = await getDocs(blocksQuery);

    const blockedByUserIds = [];
    blocksSnapshot.forEach(docSnap => {
      blockedByUserIds.push(docSnap.data().blockerId);
    });

    return { success: true, blockedByUserIds };
  } catch (error) {
    logger.error('Error getting blocked by user IDs', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get list of user IDs that this user has blocked
 * Used to show "Unblock" option on profiles and filter content
 *
 * @param {string} userId - User ID to get blocked users for
 * @returns {Promise<{success: boolean, blockedUserIds?: string[], error?: string}>}
 */
export const getBlockedUserIds = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    // Query blocks where this user is the blocker
    const blocksQuery = query(collection(db, 'blocks'), where('blockerId', '==', userId));
    const blocksSnapshot = await getDocs(blocksQuery);

    const blockedUserIds = [];
    blocksSnapshot.forEach(docSnap => {
      blockedUserIds.push(docSnap.data().blockedId);
    });

    return { success: true, blockedUserIds };
  } catch (error) {
    logger.error('Error getting blocked user IDs', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get blocked users with their profile information
 * Fetches blocked user IDs and resolves each to a profile object
 *
 * @param {string} userId - User ID to get blocked users for
 * @returns {Promise<{success: boolean, blockedUsers?: object[], error?: string}>}
 */
export const getBlockedUsersWithProfiles = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    const blockedResult = await getBlockedUserIds(userId);
    if (!blockedResult.success) {
      return { success: false, error: blockedResult.error };
    }

    const { blockedUserIds } = blockedResult;

    if (blockedUserIds.length === 0) {
      return { success: true, blockedUsers: [] };
    }

    const blockedUsers = [];
    for (const blockedUserId of blockedUserIds) {
      const profileResult = await getUserProfile(blockedUserId);

      // Skip users that no longer exist (deleted accounts)
      if (!profileResult.success) {
        logger.debug('getBlockedUsersWithProfiles: Skipping non-existent user', {
          blockedUserId,
        });
        continue;
      }

      blockedUsers.push(profileResult.profile);
    }

    logger.info('getBlockedUsersWithProfiles: Fetched profiles', {
      userId,
      blockedCount: blockedUsers.length,
    });

    return { success: true, blockedUsers };
  } catch (error) {
    logger.error('Error getting blocked users with profiles', error);
    return { success: false, error: error.message };
  }
};
