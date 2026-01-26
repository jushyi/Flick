/**
 * CommentRow Component
 *
 * Displays a single comment in the comment thread with:
 * - Profile photo (40x40) on left with fallback to initials
 * - Name (bold), comment text, and Reply button in middle
 * - Heart icon on right for likes
 * - Support for media comments (thumbnail)
 * - Author badge for photo owner's comments
 * - Long-press to delete when canDelete
 */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getTimeAgo } from '../../utils/timeUtils';
import { colors } from '../../constants/colors';
import logger from '../../utils/logger';
import { styles } from '../../styles/CommentRow.styles';

/**
 * CommentRow Component
 *
 * @param {object} comment - Comment object with text, mediaUrl, mediaType, likeCount, createdAt
 * @param {object} user - User object with displayName, profilePhotoURL
 * @param {function} onReply - Callback when Reply button pressed (receives comment)
 * @param {function} onLike - Callback when heart pressed (Plan 04)
 * @param {function} onDelete - Callback when delete confirmed
 * @param {boolean} isOwnerComment - Whether this is photo owner's comment (show Author badge)
 * @param {boolean} canDelete - Whether current user can delete this comment
 * @param {boolean} isLiked - Whether current user liked this comment (Plan 04)
 */
const CommentRow = ({
  comment,
  user,
  onReply,
  onLike,
  onDelete,
  isOwnerComment = false,
  canDelete = false,
  isLiked = false,
}) => {
  logger.debug('CommentRow: Rendering', {
    commentId: comment?.id,
    hasMedia: !!comment?.mediaUrl,
    isOwnerComment,
    canDelete,
  });

  /**
   * Handle reply button press
   */
  const handleReplyPress = useCallback(() => {
    logger.info('CommentRow: Reply pressed', { commentId: comment?.id });
    if (onReply) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReply(comment);
    }
  }, [comment, onReply]);

  /**
   * Handle heart button press
   */
  const handleLikePress = useCallback(() => {
    logger.info('CommentRow: Like pressed', { commentId: comment?.id, isLiked });
    if (onLike) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onLike(comment);
    }
  }, [comment, isLiked, onLike]);

  /**
   * Handle long press for delete
   */
  const handleLongPress = useCallback(() => {
    if (!canDelete) return;

    logger.info('CommentRow: Long press for delete', { commentId: comment?.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            logger.info('CommentRow: Delete confirmed', { commentId: comment?.id });
            if (onDelete) {
              onDelete(comment);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [canDelete, comment, onDelete]);

  // Validate props
  if (!comment || !user) {
    logger.warn('CommentRow: Missing comment or user data');
    return null;
  }

  const { text, mediaUrl, mediaType, likeCount, createdAt } = comment;
  const { displayName, profilePhotoURL } = user;

  // Get initials for profile photo fallback
  const initials = displayName ? displayName[0].toUpperCase() : '?';

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={canDelete ? 0.7 : 1}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      {/* Profile Photo */}
      <View style={styles.profilePhotoContainer}>
        {profilePhotoURL ? (
          <Image
            source={{ uri: profilePhotoURL }}
            style={styles.profilePhoto}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.profilePhotoPlaceholder}>
            <Text style={styles.profilePhotoInitial}>{initials}</Text>
          </View>
        )}
      </View>

      {/* Content - Name, Text, Reply */}
      <View style={styles.contentContainer}>
        {/* Name Row with optional Author badge */}
        <View style={styles.nameRow}>
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName || 'Unknown User'}
          </Text>
          {isOwnerComment && (
            <View style={styles.authorBadge}>
              <Text style={styles.authorBadgeText}>Author</Text>
            </View>
          )}
        </View>

        {/* Comment Text */}
        {text ? <Text style={styles.commentText}>{text}</Text> : null}

        {/* Media Thumbnail (if exists) */}
        {mediaUrl && (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.mediaThumbnail}
            contentFit="cover"
            transition={200}
          />
        )}

        {/* Footer Row - Reply and Timestamp */}
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.replyButton} onPress={handleReplyPress}>
            <Text style={styles.replyButtonText}>Reply</Text>
          </TouchableOpacity>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.timestamp}>{getTimeAgo(createdAt)}</Text>
        </View>
      </View>

      {/* Heart Icon */}
      <TouchableOpacity style={styles.heartContainer} onPress={handleLikePress}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={18}
          color={isLiked ? colors.status.danger : colors.text.secondary}
        />
        {likeCount > 0 && <Text style={styles.likeCount}>{likeCount}</Text>}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default CommentRow;
