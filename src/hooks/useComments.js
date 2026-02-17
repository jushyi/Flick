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
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  subscribeToComments,
  addComment,
  deleteComment,
  toggleCommentLike,
  getUserLikesForComments,
  generateCommentId,
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
  const [initialMention, setInitialMention] = useState(null); // @username to pre-fill in input
  const [userLikes, setUserLikes] = useState({}); // { [commentId]: boolean }
  const [highlightedCommentId, setHighlightedCommentId] = useState(null); // Comment ID to highlight
  const [justAddedReplyTo, setJustAddedReplyTo] = useState(null); // Parent comment ID that just received a reply (for auto-expand)
  const [newCommentIds, setNewCommentIds] = useState(new Set()); // Track newly added comment IDs for entrance animation
  const unsubscribeRef = useRef(null);
  const highlightTimeoutRef = useRef(null); // Timeout ref for auto-clear

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

    unsubscribeRef.current = subscribeToComments(photoId, async result => {
      logger.debug('useComments: Subscription callback', {
        photoId,
        success: result.success,
        commentCount: result.comments?.length,
      });

      if (result.success) {
        const newComments = result.comments || [];
        setComments(newComments);
        setError(null);

        // Fetch user likes for all comments (including replies)
        if (currentUserId && newComments.length > 0) {
          const commentIds = newComments.map(c => c.id);
          const likes = await getUserLikesForComments(photoId, commentIds, currentUserId);
          setUserLikes(likes);
        }
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
      // mentionedCommentId is the same as parentId for replies (tracks which comment was replied to)
      const mentionedCommentId = parentId;

      // Track if this is a top-level comment (affects count)
      const isTopLevel = !parentId;

      // Generate comment ID BEFORE write and mark as new IMMEDIATELY
      // This prevents flash when real-time subscription fires
      const commentId = generateCommentId(photoId);
      setNewCommentIds(prev => new Set(prev).add(commentId));

      logger.info('useComments.addComment: Adding comment', {
        photoId,
        commentId,
        textLength: text?.length,
        hasMedia: !!mediaUrl,
        isReply: !!parentId,
        mentionedCommentId,
      });

      const result = await addComment(
        photoId,
        currentUserId,
        text,
        mediaUrl,
        mediaType,
        parentId,
        mentionedCommentId,
        commentId // Pass pre-generated ID
      );

      if (result.success) {
        logger.info('useComments.addComment: Success', {
          commentId: result.commentId,
        });

        // Clear "new" flag after animation completes (350ms delay + 150ms duration + buffer)
        setTimeout(() => {
          setNewCommentIds(prev => {
            const next = new Set(prev);
            next.delete(result.commentId);
            return next;
          });
        }, 600);

        // Trigger highlight after entrance animation completes to show which comment was just posted
        setTimeout(() => {
          highlightComment(result.commentId);
        }, 500); // Start highlight when entrance animation finishes

        // Track which parent received reply for auto-expand
        // For nested replies, use the ultimate parent (flat thread structure)
        const parentCommentId = replyingTo?.parentId || replyingTo?.id;
        if (parentCommentId) {
          setJustAddedReplyTo(parentCommentId);
          // Auto-clear after 500ms (enough time for React to render with expanded state)
          setTimeout(() => setJustAddedReplyTo(null), 500);
        }

        // Clear reply state and initial mention after successful comment
        setReplyingTo(null);
        setInitialMention(null);
      } else {
        logger.error('useComments.addComment: Failed', {
          error: result.error,
        });
      }

      // Return result + metadata for optimistic update
      return {
        ...result,
        isTopLevel, // Caller uses this to decide if count increments
      };
    },
    [photoId, currentUserId, replyingTo]
  );

  /**
   * Delete a comment
   * Optimistic UI removal with Firestore sync
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

      // Store original comments for potential revert
      const originalComments = [...comments];

      // Optimistic removal: remove comment and its replies from UI
      setComments(prev => {
        // Find if this is a parent comment with replies
        const commentToDelete = prev.find(c => c.id === commentId);
        const isParent = commentToDelete && !commentToDelete.parentId;

        if (isParent) {
          // Remove parent and all replies to this parent
          return prev.filter(c => c.id !== commentId && c.parentId !== commentId);
        } else {
          // Just remove this single comment
          return prev.filter(c => c.id !== commentId);
        }
      });

      const result = await deleteComment(photoId, commentId, currentUserId);

      if (result.success) {
        logger.info('useComments.deleteComment: Success', { commentId });
      } else {
        logger.error('useComments.deleteComment: Failed, reverting', {
          error: result.error,
        });
        // Revert on failure
        setComments(originalComments);
      }

      return result;
    },
    [photoId, currentUserId, comments]
  );

  /**
   * Toggle like on a comment
   * Optimistic UI update with Firestore sync
   *
   * @param {string} commentId - Comment ID to like/unlike
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const handleToggleLike = useCallback(
    async commentId => {
      if (!photoId || !currentUserId || !commentId) {
        logger.warn('useComments.toggleLike: Missing required fields');
        return { success: false, error: 'Missing required fields' };
      }

      const wasLiked = userLikes[commentId] || false;

      logger.info('useComments.toggleLike: Toggling', {
        photoId,
        commentId,
        wasLiked,
      });

      // Optimistic update for userLikes state
      setUserLikes(prev => ({
        ...prev,
        [commentId]: !wasLiked,
      }));

      // Optimistic update for comment likeCount
      setComments(prev =>
        prev.map(c =>
          c.id === commentId ? { ...c, likeCount: (c.likeCount || 0) + (wasLiked ? -1 : 1) } : c
        )
      );

      // Sync to Firestore
      const result = await toggleCommentLike(photoId, commentId, currentUserId);

      if (!result.success) {
        logger.error('useComments.toggleLike: Failed, reverting', {
          error: result.error,
        });

        // Revert on failure
        setUserLikes(prev => ({
          ...prev,
          [commentId]: wasLiked,
        }));

        setComments(prev =>
          prev.map(c =>
            c.id === commentId ? { ...c, likeCount: (c.likeCount || 0) + (wasLiked ? 1 : -1) } : c
          )
        );

        return { success: false, error: result.error };
      }

      logger.info('useComments.toggleLike: Success', {
        commentId,
        newLikedState: !wasLiked,
      });

      return { success: true };
    },
    [photoId, currentUserId, userLikes]
  );

  /**
   * Check if user has liked a comment
   *
   * @param {string} commentId - Comment ID to check
   * @returns {boolean}
   */
  const isLikedByUser = useCallback(
    commentId => {
      return userLikes[commentId] || false;
    },
    [userLikes]
  );

  /**
   * Set reply target and initial @mention for input
   *
   * @param {object|null} comment - Comment to reply to, or null to cancel
   */
  const handleSetReplyingTo = useCallback(comment => {
    logger.debug('useComments.setReplyingTo', {
      commentId: comment?.id,
      isCancel: !comment,
      username: comment?.user?.username,
    });
    setReplyingTo(comment);

    // Set initial mention for auto-fill in input
    if (comment) {
      const username = comment.user?.username || comment.user?.displayName;
      setInitialMention(username || null);
    } else {
      setInitialMention(null);
    }
  }, []);

  /**
   * Cancel reply mode and clear initial mention
   */
  const handleCancelReply = useCallback(() => {
    logger.debug('useComments.cancelReply');
    setReplyingTo(null);
    setInitialMention(null);
  }, []);

  /**
   * Highlight a comment temporarily
   * Sets highlightedCommentId and auto-clears after 1.5s
   *
   * @param {string} commentId - Comment ID to highlight
   */
  const highlightComment = useCallback(commentId => {
    logger.debug('useComments.highlightComment', { commentId });

    // Clear any existing timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // Set the highlighted comment
    setHighlightedCommentId(commentId);

    // Auto-clear after 1.5s
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedCommentId(null);
      highlightTimeoutRef.current = null;
    }, 1500);
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
   * Check if a comment is newly added (should show entrance animation)
   * Checks both newCommentIds set AND if created within last 500ms
   *
   * @param {string} commentId - Comment ID to check
   * @returns {boolean}
   */
  const isNewComment = useCallback(
    commentId => {
      // Check if in newCommentIds set (marked when added)
      if (newCommentIds.has(commentId)) return true;

      // Also check if created very recently (within last 500ms)
      // This handles the case where real-time subscription fires before setNewCommentIds
      const comment = comments.find(c => c.id === commentId);
      if (comment?.createdAt) {
        const now = Date.now();
        const createdAt = comment.createdAt.toDate?.() || new Date(comment.createdAt);
        const age = now - createdAt.getTime();
        return age < 500; // Treat as new if less than 500ms old
      }

      return false;
    },
    [newCommentIds, comments]
  );

  /**
   * Organize comments into threads (top-level + replies)
   * Returns top-level comments with nested replies.
   * useMemo ensures the array reference is stable across re-renders when
   * comments haven't changed, preventing spurious auto-scroll effect re-runs.
   */
  const threadedComments = useMemo(() => {
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
    threadedComments,
    loading,
    error,
    replyingTo,
    initialMention,
    userLikes,
    highlightedCommentId, // Currently highlighted comment
    justAddedReplyTo, // Parent comment ID that just received a reply
    // Actions
    addComment: handleAddComment,
    deleteComment: handleDeleteComment,
    toggleLike: handleToggleLike,
    setReplyingTo: handleSetReplyingTo,
    cancelReply: handleCancelReply,
    highlightComment, // Set highlighted comment with auto-clear
    // Utilities
    canDeleteComment,
    isOwnerComment,
    isLikedByUser,
    isNewComment, // Check if comment should show entrance animation
  };
};

export default useComments;
