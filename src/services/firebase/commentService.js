/**
 * Comment Service
 *
 * Handles CRUD operations for comments on photos. Comments are stored as
 * a subcollection under each photo document for scalability.
 *
 * Key features:
 * - Threaded comments (single-level replies via parentId)
 * - User data joining for comment display
 * - Real-time comment subscriptions
 * - Preview comments with owner prioritization (caption behavior)
 * - Comment count maintenance via atomic increment
 *
 * Data structure:
 * photos/{photoId}/comments/{commentId}
 * {
 *   userId: string,
 *   text: string,
 *   mediaUrl: string | null,
 *   mediaType: 'image' | 'gif' | null,
 *   parentId: string | null,  // null = top-level, id = reply
 *   likeCount: number,
 *   createdAt: serverTimestamp(),
 * }
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  increment,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';

const db = getFirestore();

/**
 * Add a comment to a photo
 * Creates comment in subcollection and increments photo's commentCount
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID of commenter
 * @param {string} text - Comment text
 * @param {string|null} mediaUrl - URL of attached image/GIF (optional)
 * @param {string|null} mediaType - Type of media: 'image' | 'gif' | null
 * @param {string|null} parentId - Parent comment ID for replies (null = top-level)
 * @returns {Promise<{success: boolean, commentId?: string, error?: string}>}
 */
export const addComment = async (
  photoId,
  userId,
  text,
  mediaUrl = null,
  mediaType = null,
  parentId = null
) => {
  logger.debug('commentService.addComment: Starting', {
    photoId,
    userId,
    textLength: text?.length,
    hasMedia: !!mediaUrl,
    mediaType,
    isReply: !!parentId,
  });

  try {
    // Validation
    if (!photoId || !userId) {
      logger.warn('commentService.addComment: Missing required fields', { photoId, userId });
      return { success: false, error: 'Missing required fields' };
    }

    if (!text && !mediaUrl) {
      logger.warn('commentService.addComment: Comment must have text or media');
      return { success: false, error: 'Comment must have text or media' };
    }

    // Verify photo exists
    const photoRef = doc(db, 'photos', photoId);
    const photoDocSnap = await getDoc(photoRef);

    if (!photoDocSnap.exists()) {
      logger.warn('commentService.addComment: Photo not found', { photoId });
      return { success: false, error: 'Photo not found' };
    }

    // If this is a reply, verify parent comment exists
    if (parentId) {
      const parentCommentRef = doc(db, 'photos', photoId, 'comments', parentId);
      const parentCommentSnap = await getDoc(parentCommentRef);

      if (!parentCommentSnap.exists()) {
        logger.warn('commentService.addComment: Parent comment not found', { parentId });
        return { success: false, error: 'Parent comment not found' };
      }

      // Prevent nested replies (replies to replies)
      const parentData = parentCommentSnap.data();
      if (parentData.parentId) {
        logger.warn('commentService.addComment: Cannot reply to a reply', { parentId });
        return { success: false, error: 'Cannot reply to a reply' };
      }
    }

    // Create comment document
    const commentsRef = collection(db, 'photos', photoId, 'comments');
    const commentData = {
      userId,
      text: text || '',
      mediaUrl,
      mediaType,
      parentId,
      likeCount: 0,
      createdAt: serverTimestamp(),
    };

    const commentDocRef = await addDoc(commentsRef, commentData);
    const commentId = commentDocRef.id;

    logger.debug('commentService.addComment: Comment created', { commentId, photoId });

    // Increment photo's comment count
    await updateDoc(photoRef, {
      commentCount: increment(1),
    });

    logger.info('commentService.addComment: Success', {
      commentId,
      photoId,
      userId,
      isReply: !!parentId,
    });

    return { success: true, commentId };
  } catch (error) {
    logger.error('commentService.addComment: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Delete a comment from a photo
 * Only comment author or photo owner can delete
 * If comment has replies, deletes those too
 *
 * @param {string} photoId - Photo document ID
 * @param {string} commentId - Comment document ID
 * @param {string} requestingUserId - User ID requesting deletion
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteComment = async (photoId, commentId, requestingUserId) => {
  logger.debug('commentService.deleteComment: Starting', {
    photoId,
    commentId,
    requestingUserId,
  });

  try {
    // Validation
    if (!photoId || !commentId || !requestingUserId) {
      logger.warn('commentService.deleteComment: Missing required fields');
      return { success: false, error: 'Missing required fields' };
    }

    // Get comment data
    const commentRef = doc(db, 'photos', photoId, 'comments', commentId);
    const commentDocSnap = await getDoc(commentRef);

    if (!commentDocSnap.exists()) {
      logger.warn('commentService.deleteComment: Comment not found', { commentId });
      return { success: false, error: 'Comment not found' };
    }

    const commentData = commentDocSnap.data();

    // Get photo data to check ownership
    const photoRef = doc(db, 'photos', photoId);
    const photoDocSnap = await getDoc(photoRef);

    if (!photoDocSnap.exists()) {
      logger.warn('commentService.deleteComment: Photo not found', { photoId });
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDocSnap.data();

    // Authorization: comment author OR photo owner can delete
    const isCommentAuthor = commentData.userId === requestingUserId;
    const isPhotoOwner = photoData.userId === requestingUserId;

    if (!isCommentAuthor && !isPhotoOwner) {
      logger.warn('commentService.deleteComment: Unauthorized', {
        requestingUserId,
        commentAuthor: commentData.userId,
        photoOwner: photoData.userId,
      });
      return { success: false, error: 'Unauthorized to delete this comment' };
    }

    // Count comments to delete (including replies)
    let deleteCount = 1;

    // If this is a top-level comment, find and delete all replies
    if (!commentData.parentId) {
      const repliesQuery = query(
        collection(db, 'photos', photoId, 'comments'),
        where('parentId', '==', commentId)
      );
      const repliesSnapshot = await getDocs(repliesQuery);

      logger.debug('commentService.deleteComment: Found replies', {
        replyCount: repliesSnapshot.size,
      });

      // Delete all replies
      const deletePromises = repliesSnapshot.docs.map(replyDoc => deleteDoc(replyDoc.ref));
      await Promise.all(deletePromises);
      deleteCount += repliesSnapshot.size;
    }

    // Delete the comment itself
    await deleteDoc(commentRef);

    // Decrement photo's comment count
    await updateDoc(photoRef, {
      commentCount: increment(-deleteCount),
    });

    logger.info('commentService.deleteComment: Success', {
      photoId,
      commentId,
      deletedCount: deleteCount,
    });

    return { success: true };
  } catch (error) {
    logger.error('commentService.deleteComment: Failed', {
      photoId,
      commentId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Fetch user data for a list of user IDs
 * Uses caching to avoid duplicate fetches
 *
 * @param {Array<string>} userIds - Array of user IDs to fetch
 * @returns {Promise<Object>} Map of userId to user data
 */
const fetchUserData = async userIds => {
  const uniqueUserIds = [...new Set(userIds)];
  const userDataMap = {};

  await Promise.all(
    uniqueUserIds.map(async userId => {
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          userDataMap[userId] = {
            uid: userId,
            username: userData.username || 'unknown',
            displayName: userData.displayName || 'Unknown User',
            profilePhotoURL: userData.profilePhotoURL || null,
          };
        } else {
          userDataMap[userId] = {
            uid: userId,
            username: 'unknown',
            displayName: 'Unknown User',
            profilePhotoURL: null,
          };
        }
      } catch (err) {
        logger.warn('commentService.fetchUserData: Failed to fetch user', {
          userId,
          error: err.message,
        });
        userDataMap[userId] = {
          uid: userId,
          username: 'unknown',
          displayName: 'Unknown User',
          profilePhotoURL: null,
        };
      }
    })
  );

  return userDataMap;
};

/**
 * Get comments for a photo
 * Returns comments with user data joined
 *
 * @param {string} photoId - Photo document ID
 * @param {number} limitCount - Maximum number of comments to fetch (default: 50)
 * @returns {Promise<{success: boolean, comments?: Array, error?: string}>}
 */
export const getComments = async (photoId, limitCount = 50) => {
  logger.debug('commentService.getComments: Starting', { photoId, limitCount });

  try {
    if (!photoId) {
      logger.warn('commentService.getComments: Missing photoId');
      return { success: false, error: 'Missing photoId' };
    }

    // Query comments ordered by createdAt ascending (oldest first)
    const commentsRef = collection(db, 'photos', photoId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'), firestoreLimit(limitCount));

    const snapshot = await getDocs(q);

    logger.debug('commentService.getComments: Query complete', {
      photoId,
      commentCount: snapshot.size,
    });

    if (snapshot.empty) {
      return { success: true, comments: [] };
    }

    // Extract all unique user IDs
    const userIds = snapshot.docs.map(docSnap => docSnap.data().userId);

    // Fetch user data for all commenters
    const userDataMap = await fetchUserData(userIds);

    // Map comments with user data
    const comments = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        user: userDataMap[data.userId] || {
          uid: data.userId,
          username: 'unknown',
          displayName: 'Unknown User',
          profilePhotoURL: null,
        },
      };
    });

    logger.info('commentService.getComments: Success', {
      photoId,
      commentCount: comments.length,
    });

    return { success: true, comments };
  } catch (error) {
    logger.error('commentService.getComments: Failed', {
      photoId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to real-time comment updates for a photo
 * Callback receives array of comments with user data
 *
 * @param {string} photoId - Photo document ID
 * @param {function} callback - Callback function receiving comment updates
 * @param {number} limitCount - Maximum number of comments to watch (default: 50)
 * @returns {function} Unsubscribe function
 */
export const subscribeToComments = (photoId, callback, limitCount = 50) => {
  logger.debug('commentService.subscribeToComments: Starting', { photoId, limitCount });

  if (!photoId) {
    logger.error('commentService.subscribeToComments: Missing photoId');
    callback({ success: false, error: 'Missing photoId', comments: [] });
    return () => {};
  }

  try {
    const commentsRef = collection(db, 'photos', photoId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'), firestoreLimit(limitCount));

    const unsubscribe = onSnapshot(
      q,
      async snapshot => {
        logger.debug('commentService.subscribeToComments: Snapshot received', {
          photoId,
          commentCount: snapshot.size,
        });

        if (snapshot.empty) {
          callback({ success: true, comments: [] });
          return;
        }

        // Extract all unique user IDs
        const userIds = snapshot.docs.map(docSnap => docSnap.data().userId);

        // Fetch user data for all commenters
        const userDataMap = await fetchUserData(userIds);

        // Map comments with user data
        const comments = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            user: userDataMap[data.userId] || {
              uid: data.userId,
              username: 'unknown',
              displayName: 'Unknown User',
              profilePhotoURL: null,
            },
          };
        });

        callback({ success: true, comments });
      },
      error => {
        logger.error('commentService.subscribeToComments: Error', {
          photoId,
          error: error.message,
        });
        callback({ success: false, error: error.message, comments: [] });
      }
    );

    logger.info('commentService.subscribeToComments: Subscription active', { photoId });

    return unsubscribe;
  } catch (error) {
    logger.error('commentService.subscribeToComments: Failed to setup', {
      photoId,
      error: error.message,
    });
    callback({ success: false, error: error.message, comments: [] });
    return () => {};
  }
};

/**
 * Get preview comments for a photo
 * Prioritizes owner's comment first (acts as caption), then most recent
 * Returns 1-2 comments for preview display
 *
 * @param {string} photoId - Photo document ID
 * @param {string} photoOwnerId - User ID of the photo owner
 * @returns {Promise<{success: boolean, previewComments?: Array, error?: string}>}
 */
export const getPreviewComments = async (photoId, photoOwnerId) => {
  logger.debug('commentService.getPreviewComments: Starting', { photoId, photoOwnerId });

  try {
    if (!photoId) {
      logger.warn('commentService.getPreviewComments: Missing photoId');
      return { success: false, error: 'Missing photoId' };
    }

    // Fetch top-level comments using composite index (UAT-006 fix)
    // Index: parentId ASC + createdAt DESC defined in firestore.indexes.json
    const commentsRef = collection(db, 'photos', photoId, 'comments');
    const q = query(
      commentsRef,
      where('parentId', '==', null),
      orderBy('createdAt', 'desc'),
      firestoreLimit(10) // Only need a few for preview
    );

    const snapshot = await getDocs(q);

    logger.debug('commentService.getPreviewComments: Query complete', {
      photoId,
      topLevelCount: snapshot.size,
    });

    if (snapshot.empty) {
      return { success: true, previewComments: [] };
    }

    // Convert to array with IDs (already filtered by query)
    const allComments = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    if (allComments.length === 0) {
      return { success: true, previewComments: [] };
    }

    // Find owner's comment (first top-level comment by photo owner)
    const ownerComment = photoOwnerId ? allComments.find(c => c.userId === photoOwnerId) : null;

    // Get other recent comments (excluding owner's comment)
    const otherComments = allComments.filter(c => c.id !== ownerComment?.id);

    // Build preview: owner comment first (if exists), then 1-2 recent
    let previewList = [];

    if (ownerComment) {
      previewList.push(ownerComment);
      // Add 1 more comment if owner comment exists
      if (otherComments.length > 0) {
        previewList.push(otherComments[0]);
      }
    } else {
      // No owner comment, show up to 2 recent comments
      previewList = otherComments.slice(0, 2);
    }

    // Fetch user data for preview comments
    const userIds = previewList.map(c => c.userId);
    const userDataMap = await fetchUserData(userIds);

    // Add user data to comments
    const previewComments = previewList.map(comment => ({
      ...comment,
      user: userDataMap[comment.userId] || {
        uid: comment.userId,
        username: 'unknown',
        displayName: 'Unknown User',
        profilePhotoURL: null,
      },
    }));

    logger.info('commentService.getPreviewComments: Success', {
      photoId,
      previewCount: previewComments.length,
      hasOwnerComment: !!ownerComment,
    });

    return { success: true, previewComments };
  } catch (error) {
    logger.error('commentService.getPreviewComments: Failed', {
      photoId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Check if user has liked a comment
 * Uses deterministic like ID for direct lookup without query
 *
 * @param {string} photoId - Photo document ID
 * @param {string} commentId - Comment document ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user has liked the comment
 */
export const hasUserLikedComment = async (photoId, commentId, userId) => {
  logger.debug('commentService.hasUserLikedComment: Checking', {
    photoId,
    commentId,
    userId,
  });

  try {
    const likeId = `${photoId}_${commentId}_${userId}`;
    const likeRef = doc(db, 'photos', photoId, 'comments', commentId, 'likes', likeId);
    const likeDoc = await getDoc(likeRef);

    const liked = likeDoc.exists();
    logger.debug('commentService.hasUserLikedComment: Result', { liked });

    return liked;
  } catch (error) {
    logger.error('commentService.hasUserLikedComment: Failed', {
      photoId,
      commentId,
      userId,
      error: error.message,
    });
    return false;
  }
};

/**
 * Toggle like on a comment
 * Creates or removes like document and updates comment's likeCount
 *
 * @param {string} photoId - Photo document ID
 * @param {string} commentId - Comment document ID
 * @param {string} userId - User ID liking/unliking
 * @returns {Promise<{success: boolean, liked?: boolean, error?: string}>}
 */
export const toggleCommentLike = async (photoId, commentId, userId) => {
  logger.debug('commentService.toggleCommentLike: Starting', {
    photoId,
    commentId,
    userId,
  });

  try {
    if (!photoId || !commentId || !userId) {
      logger.warn('commentService.toggleCommentLike: Missing required fields');
      return { success: false, error: 'Missing required fields' };
    }

    const likeId = `${photoId}_${commentId}_${userId}`;
    const likeRef = doc(db, 'photos', photoId, 'comments', commentId, 'likes', likeId);
    const commentRef = doc(db, 'photos', photoId, 'comments', commentId);

    const likeDoc = await getDoc(likeRef);

    if (likeDoc.exists()) {
      // Unlike: delete like doc, decrement count
      await deleteDoc(likeRef);
      await updateDoc(commentRef, { likeCount: increment(-1) });

      logger.info('commentService.toggleCommentLike: Unliked', {
        photoId,
        commentId,
        userId,
      });

      return { success: true, liked: false };
    } else {
      // Like: create like doc, increment count
      await setDoc(likeRef, {
        userId,
        createdAt: serverTimestamp(),
      });
      await updateDoc(commentRef, { likeCount: increment(1) });

      logger.info('commentService.toggleCommentLike: Liked', {
        photoId,
        commentId,
        userId,
      });

      return { success: true, liked: true };
    }
  } catch (error) {
    logger.error('commentService.toggleCommentLike: Failed', {
      photoId,
      commentId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get user's likes for multiple comments (batch check)
 * Used to populate isLiked state for all visible comments
 *
 * @param {string} photoId - Photo document ID
 * @param {Array<string>} commentIds - Array of comment IDs to check
 * @param {string} userId - User ID to check likes for
 * @returns {Promise<Object>} Map of { [commentId]: boolean }
 */
export const getUserLikesForComments = async (photoId, commentIds, userId) => {
  logger.debug('commentService.getUserLikesForComments: Starting', {
    photoId,
    commentCount: commentIds?.length,
    userId,
  });

  try {
    if (!photoId || !userId || !commentIds || commentIds.length === 0) {
      logger.debug('commentService.getUserLikesForComments: No comments to check');
      return {};
    }

    const likes = {};

    await Promise.all(
      commentIds.map(async commentId => {
        likes[commentId] = await hasUserLikedComment(photoId, commentId, userId);
      })
    );

    logger.info('commentService.getUserLikesForComments: Complete', {
      photoId,
      checkedCount: commentIds.length,
      likedCount: Object.values(likes).filter(Boolean).length,
    });

    return likes;
  } catch (error) {
    logger.error('commentService.getUserLikesForComments: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return {};
  }
};
