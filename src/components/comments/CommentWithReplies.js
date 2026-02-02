/**
 * CommentWithReplies Component
 *
 * Wrapper component for displaying a top-level comment with its replies.
 * Handles expand/collapse state for the replies section.
 * Extracted from CommentsBottomSheet to allow useState for reply visibility.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import CommentRow from './CommentRow';
import { colors } from '../../constants/colors';
import logger from '../../utils/logger';
import { styles } from '../../styles/CommentsBottomSheet.styles';

/**
 * CommentWithReplies Component
 *
 * @param {object} comment - Top-level comment with optional replies array
 * @param {function} onReply - Callback when Reply button pressed
 * @param {function} onLike - Callback when heart pressed
 * @param {function} onDelete - Callback when delete confirmed
 * @param {function} onAvatarPress - Callback when avatar pressed (userId, displayName) -> navigate to profile
 * @param {string} currentUserId - Current user's ID (to disable tap on own avatar)
 * @param {function} isOwnerComment - Function to check if comment is from photo owner
 * @param {function} canDeleteComment - Function to check if user can delete comment
 * @param {function} isLikedByUser - Function to check if user liked comment
 */
const CommentWithReplies = ({
  comment,
  onReply,
  onLike,
  onDelete,
  onAvatarPress,
  currentUserId,
  isOwnerComment,
  canDeleteComment,
  isLikedByUser,
}) => {
  const [showReplies, setShowReplies] = useState(false);

  const replies = comment.replies || [];
  const hasReplies = replies.length > 0;
  const replyCount = replies.length;

  /**
   * Toggle replies visibility
   */
  const handleToggleReplies = useCallback(() => {
    logger.debug('CommentWithReplies: Toggle replies', {
      commentId: comment.id,
      showReplies: !showReplies,
      replyCount,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReplies(prev => !prev);
  }, [comment.id, showReplies, replyCount]);

  const isOwner = isOwnerComment(comment);
  const canDelete = canDeleteComment(comment);

  return (
    <View>
      {/* Main comment */}
      <CommentRow
        comment={comment}
        user={comment.user}
        onReply={onReply}
        onLike={onLike}
        onDelete={onDelete}
        onAvatarPress={onAvatarPress}
        currentUserId={currentUserId}
        isOwnerComment={isOwner}
        canDelete={canDelete}
        isLiked={isLikedByUser(comment.id)}
        isTopLevel={true}
      />

      {/* Replies section */}
      {hasReplies && (
        <View style={styles.repliesSection}>
          {/* Toggle button */}
          <TouchableOpacity
            style={styles.viewRepliesButton}
            onPress={handleToggleReplies}
            activeOpacity={0.7}
          >
            <View style={styles.viewRepliesLine} />
            <Text style={styles.viewRepliesText}>
              {showReplies
                ? 'Hide replies'
                : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
            </Text>
          </TouchableOpacity>

          {/* Replies (when expanded) */}
          {showReplies &&
            replies.map(reply => (
              <View key={reply.id} style={styles.replyItem}>
                <CommentRow
                  comment={reply}
                  user={reply.user}
                  onReply={null}
                  onLike={onLike}
                  onDelete={onDelete}
                  onAvatarPress={onAvatarPress}
                  currentUserId={currentUserId}
                  isOwnerComment={isOwnerComment(reply)}
                  canDelete={canDeleteComment(reply)}
                  isLiked={isLikedByUser(reply.id)}
                  isTopLevel={false}
                />
              </View>
            ))}
        </View>
      )}
    </View>
  );
};

export default CommentWithReplies;
