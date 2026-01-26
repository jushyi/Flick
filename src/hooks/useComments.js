/**
 * useComments Hook
 *
 * Manages comment state for a photo including:
 * - Real-time subscription to comments
 * - Loading and error states
 * - Add and delete comment functionality
 * - Reply state management
 * - User data joining
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeToComments,
  addComment,
  deleteComment,
} from '../services/firebase/commentService';
import logger from '../utils/logger';

/**
 * useComments Hook
 *
 * @param {string} photoId - Photo ID to load comments for
 * @param {string} currentUserId - Current user's ID
 * @param {string} photoOwnerId - Photo owner's user ID (for delete permissions)
 * @returns {object} - Comment state and control functions
 */
const useComments = (photoId, currentUserId, photoOwnerId) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const unsubscribeRef = useRef(null);

  logger.debug('useComments: Hook initialized', {
    photoId,
    currentUserId,
    photoOwnerId,
  });

  /**
   * Subscribe to real-time comment updates
   */
  useEffect(() => {
    if (!photoId) {
      logger.warn('useComments: No photoId provided');
      setLoading(false);
      return;
    }

    logger.debug('useComments: Setting up subscription', { photoId });
    setLoading(true);
    setError(null);

    // Subscribe to comments
    unsubscribeRef.current = subscribeToComments(photoId, result => {
      logger.debug('useComments: Subscription callback', {
        photoId,
        success: result.success,
        commentCount: result.comments?.length,
      });

      if (result.success) {
        setComments(result.comments || []);
        setError(null);
      } else {
        logger.error('useComments: Subscription error', { error: result.error });
        setError(result.error);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      logger.debug('useComments: Cleaning up subscription', { photoId });
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [photoId]);

  /**
   * Add a new comment
   *
   * @param {string} text - Comment text
   * @param {string|null} mediaUrl - URL of attached media
   * @param {string|null} mediaType - Type of media ('image' | 'gif')
   * @returns {Promise<{success: boolean, commentId?: string, error?: string}>}
   */
  const handleAddComment = useCallback(
    async (text, mediaUrl = null, mediaType = null) => {
      if (!photoId || !currentUserId) {
        logger.warn('useComments.addComment: Missing required fields', {
          photoId,
          currentUserId,
        });
        return { success: false, error: 'Missing required fields' };
      }

      const parentId = replyingTo?.id || null;

      logger.info('useComments.addComment: Adding comment', {
        photoId,
        textLength: text?.length,
        hasMedia: !!mediaUrl,
        isReply: !!parentId,
      });

      const result = await addComment(photoId, currentUserId, text, mediaUrl, mediaType, parentId);

      if (result.success) {
        logger.info('useComments.addComment: Success', {
          commentId: result.commentId,
        });
        // Clear reply state after successful comment
        setReplyingTo(null);
      } else {
        logger.error('useComments.addComment: Failed', {
          error: result.error,
        });
      }

      return result;
    },
    [photoId, currentUserId, replyingTo]
  );

  /**
   * Delete a comment
   *
   * @param {string} commentId - Comment ID to delete
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const handleDeleteComment = useCallback(
    async commentId => {
      if (!photoId || !currentUserId || !commentId) {
        logger.warn('useComments.deleteComment: Missing required fields');
        return { success: false, error: 'Missing required fields' };
      }

      logger.info('useComments.deleteComment: Deleting comment', {
        photoId,
        commentId,
        currentUserId,
      });

      const result = await deleteComment(photoId, commentId, currentUserId);

      if (result.success) {
        logger.info('useComments.deleteComment: Success', { commentId });
      } else {
        logger.error('useComments.deleteComment: Failed', {
          error: result.error,
        });
      }

      return result;
    },
    [photoId, currentUserId]
  );

  /**
   * Set reply target
   *
   * @param {object|null} comment - Comment to reply to, or null to cancel
   */
  const handleSetReplyingTo = useCallback(comment => {
    logger.debug('useComments.setReplyingTo', {
      commentId: comment?.id,
      isCancel: !comment,
    });
    setReplyingTo(comment);
  }, []);

  /**
   * Cancel reply mode
   */
  const handleCancelReply = useCallback(() => {
    logger.debug('useComments.cancelReply');
    setReplyingTo(null);
  }, []);

  /**
   * Check if current user can delete a comment
   *
   * @param {object} comment - Comment object
   * @returns {boolean}
   */
  const canDeleteComment = useCallback(
    comment => {
      if (!comment || !currentUserId) return false;
      // User can delete if they are the comment author or photo owner
      return comment.userId === currentUserId || photoOwnerId === currentUserId;
    },
    [currentUserId, photoOwnerId]
  );

  /**
   * Check if a comment is from the photo owner
   *
   * @param {object} comment - Comment object
   * @returns {boolean}
   */
  const isOwnerComment = useCallback(
    comment => {
      if (!comment || !photoOwnerId) return false;
      return comment.userId === photoOwnerId;
    },
    [photoOwnerId]
  );

  /**
   * Organize comments into threads (top-level + replies)
   * Returns top-level comments with nested replies
   */
  const threadedComments = useCallback(() => {
    if (!comments || comments.length === 0) return [];

    // Separate top-level and replies
    const topLevel = [];
    const repliesByParent = {};

    comments.forEach(comment => {
      if (!comment.parentId) {
        topLevel.push(comment);
      } else {
        if (!repliesByParent[comment.parentId]) {
          repliesByParent[comment.parentId] = [];
        }
        repliesByParent[comment.parentId].push(comment);
      }
    });

    // Attach replies to their parent comments
    const threaded = topLevel.map(comment => ({
      ...comment,
      replies: repliesByParent[comment.id] || [],
    }));

    return threaded;
  }, [comments]);

  return {
    // State
    comments,
    threadedComments: threadedComments(),
    loading,
    error,
    replyingTo,
    // Actions
    addComment: handleAddComment,
    deleteComment: handleDeleteComment,
    setReplyingTo: handleSetReplyingTo,
    cancelReply: handleCancelReply,
    // Utilities
    canDeleteComment,
    isOwnerComment,
  };
};

export default useComments;
