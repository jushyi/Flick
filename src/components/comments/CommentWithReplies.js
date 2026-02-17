/**
 * CommentWithReplies Component
 *
 * Wrapper component for displaying a top-level comment with its replies.
 * Handles expand/collapse state for the replies section.
 * Extracted from CommentsBottomSheet to allow useState for reply visibility.
 */
import React, { useState, useCallback, useEffect } from 'react';
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
 * @param {function} onMentionPress - Callback when @mention is tapped
 * @param {string|null} highlightedCommentId - ID of comment to highlight
 * @param {boolean} forceExpanded - Force replies section to expand (for @mention navigation)
 * @param {function} isNewComment - Function to check if comment should show entrance animation
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
  onMentionPress,
  highlightedCommentId,
  forceExpanded = false,
  isNewComment,
  onHighlightedReplyLayout,
}) => {
  const [showReplies, setShowReplies] = useState(false);

  // Auto-expand replies when forceExpanded becomes true (e.g., @mention navigation)
  useEffect(() => {
    if (forceExpanded && !showReplies) {
      setShowReplies(true);
    }
  }, [forceExpanded]);

  const replies = comment.replies || [];
  const hasReplies = replies.length > 0;
  const replyCount = replies.length;

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
        onMentionPress={onMentionPress}
        isHighlighted={highlightedCommentId === comment.id}
        isNewComment={isNewComment(comment.id)}
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

          {/* Replies (when expanded) - reply button enabled for nested replies */}
          {showReplies &&
            replies.map(reply => (
              <View
                key={reply.id}
                style={styles.replyItem}
                onLayout={
                  reply.id === highlightedCommentId && onHighlightedReplyLayout
                    ? e => onHighlightedReplyLayout(e.nativeEvent.layout.y)
                    : undefined
                }
              >
                <CommentRow
                  comment={reply}
                  user={reply.user}
                  onReply={onReply}
                  onLike={onLike}
                  onDelete={onDelete}
                  onAvatarPress={onAvatarPress}
                  currentUserId={currentUserId}
                  isOwnerComment={isOwnerComment(reply)}
                  canDelete={canDeleteComment(reply)}
                  isLiked={isLikedByUser(reply.id)}
                  isTopLevel={false}
                  onMentionPress={onMentionPress}
                  isHighlighted={highlightedCommentId === reply.id}
                  isNewComment={isNewComment(reply.id)}
                />
              </View>
            ))}
        </View>
      )}
    </View>
  );
};

export default CommentWithReplies;
