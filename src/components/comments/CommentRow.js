/**
 * CommentRow Component
 *
 * Displays a single comment in the comment thread with:
 * - Profile photo (40x40) on left with fallback to initials
 * - Name (bold), comment text, and Reply button in middle
 * - Heart icon on right for likes
 * - Support for media comments (thumbnail)
 * - Author badge for photo owner's comments
 * - Swipe left to delete when canDelete
 */
import React, { useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import PixelIcon from '../PixelIcon';
import * as Haptics from 'expo-haptics';
import { getTimeAgo } from '../../utils/timeUtils';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';
import logger from '../../utils/logger';
import { styles } from '../../styles/CommentRow.styles';
import MentionText from './MentionText';

/**
 * CommentRow Component
 *
 * @param {object} comment - Comment object with text, mediaUrl, mediaType, likeCount, createdAt
 * @param {object} user - User object with displayName, profilePhotoURL
 * @param {function} onReply - Callback when Reply button pressed (receives comment)
 * @param {function} onLike - Callback when heart pressed
 * @param {function} onDelete - Callback when delete confirmed
 * @param {function} onAvatarPress - Callback when avatar pressed (userId, displayName) -> navigate to profile
 * @param {string} currentUserId - Current user's ID (to disable tap on own avatar)
 * @param {boolean} isOwnerComment - Whether this is photo owner's comment (show Author badge)
 * @param {boolean} canDelete - Whether current user can delete this comment
 * @param {boolean} isLiked - Whether current user liked this comment
 * @param {boolean} isTopLevel - Whether this is a top-level comment (shows Reply button)
 * @param {function} onMentionPress - Callback when @mention is tapped (username, mentionedCommentId)
 * @param {boolean} isHighlighted - Whether this comment is currently highlighted
 * @param {boolean} isNewComment - Whether this comment should show entrance animation
 */
const CommentRow = ({
  comment,
  user,
  onReply,
  onLike,
  onDelete,
  onAvatarPress,
  currentUserId,
  isOwnerComment = false,
  canDelete = false,
  isLiked = false,
  isTopLevel = true,
  onMentionPress,
  isHighlighted = false,
  isNewComment = false,
}) => {
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(1)).current; // Start visible by default
  const hasAnimatedRef = useRef(false); // Track if entrance animation has played

  // Trigger highlight animation when isHighlighted changes
  useEffect(() => {
    if (isHighlighted) {
      // Animate: transparent -> purple tint -> transparent over 1.5s
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false, // backgroundColor doesn't support native driver
        }),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isHighlighted, highlightAnim]);

  // Trigger entrance animation on mount if new comment (only once)
  // Delayed to start AFTER scroll animation completes (~300ms)
  // useLayoutEffect runs synchronously before paint to prevent flash
  useLayoutEffect(() => {
    if (isNewComment && !hasAnimatedRef.current) {
      // Mark as animated to prevent re-runs
      hasAnimatedRef.current = true;

      // Immediately hide (runs before paint, no flash)
      entranceAnim.setValue(0);

      // Wait for scroll to complete before animating
      // Scroll takes ~300ms, so delay animation by 350ms
      setTimeout(() => {
        // Animate in: slide down + fade (retro timing: 150ms)
        Animated.timing(entranceAnim, {
          toValue: 1,
          duration: 150, // animations.normal - matches PixelSpinner frame rate
          useNativeDriver: true,
        }).start();
      }, 350);
    }
    // No else branch - existing comments stay visible (entranceAnim = 1 by default)
  }, [isNewComment, entranceAnim]);

  // Interpolate background color for highlight flash
  const highlightBackgroundColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.overlay.purpleTint], // Cyan highlight tint (15% opacity)
  });

  // Interpolate for entrance animation
  const entranceTranslateY = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-15, 0], // Slide down 15px (retro-style pop-in)
  });

  const entranceOpacity = entranceAnim; // Direct mapping 0→1
  logger.debug('CommentRow: Rendering', {
    commentId: comment?.id,
    hasMedia: !!comment?.mediaUrl,
    isOwnerComment,
    canDelete,
    isTopLevel,
  });

  const handleReplyPress = useCallback(() => {
    logger.info('CommentRow: Reply pressed', { commentId: comment?.id });
    if (onReply) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReply(comment);
    }
  }, [comment, onReply]);

  const handleLikePress = useCallback(() => {
    logger.info('CommentRow: Like pressed', { commentId: comment?.id, isLiked });
    if (onLike) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onLike(comment);
    }
  }, [comment, isLiked, onLike]);

  // Check if this is the current user's own comment
  const isOwnComment = comment?.userId === currentUserId;

  // Check if this is a deleted user (no profile navigation)
  const isDeletedUser = user?.isDeleted === true || user?.displayName === 'Deleted User';

  /**
   * Handle avatar press - navigate to user's profile
   * Disabled for own comments (comment.userId === currentUserId)
   * Disabled for deleted users (user no longer exists)
   */
  const handleAvatarPress = useCallback(() => {
    // Don't allow tap on own avatar or deleted user avatar
    if (isOwnComment || isDeletedUser) return;
    logger.info('CommentRow: Avatar pressed', { commentId: comment?.id, userId: comment?.userId });
    if (onAvatarPress && comment?.userId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAvatarPress(comment.userId, user?.displayName);
    }
  }, [comment?.id, comment?.userId, user?.displayName, onAvatarPress, isOwnComment, isDeletedUser]);

  const swipeableRef = useRef(null);

  const handleDelete = useCallback(() => {
    logger.info('CommentRow: Delete button pressed', { commentId: comment?.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Close the swipeable on cancel
            swipeableRef.current?.close();
          },
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
  }, [comment, onDelete]);

  const renderRightActions = useCallback(
    (progress, dragX) => {
      if (!canDelete) return null;

      const scale = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });

      const opacity = dragX.interpolate({
        inputRange: [-80, -40, 0],
        outputRange: [1, 0.8, 0],
        extrapolate: 'clamp',
      });

      return (
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
            <PixelIcon name="trash" size={20} color={colors.text.primary} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [canDelete, handleDelete]
  );

  if (!comment || !user) {
    logger.warn('CommentRow: Missing comment or user data');
    return null;
  }

  const { text, mediaUrl, mediaType, likeCount, createdAt } = comment;
  const { displayName, profilePhotoURL } = user;

  // Get initials for profile photo fallback
  const initials = displayName ? displayName[0].toUpperCase() : '?';

  return (
    <Animated.View
      style={{
        backgroundColor: highlightBackgroundColor,
        borderRadius: layout.borderRadius.xl,
      }}
    >
      <Animated.View
        style={{
          opacity: entranceOpacity,
          transform: [{ translateY: entranceTranslateY }],
        }}
      >
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          overshootRight={false}
          friction={2}
          rightThreshold={40}
        >
          <View style={styles.container}>
            {/* Profile Photo - tappable to navigate to user's profile (disabled for own comments and deleted users) */}
            <TouchableOpacity
              style={styles.profilePhotoContainer}
              onPress={handleAvatarPress}
              activeOpacity={isOwnComment || isDeletedUser ? 1 : 0.7}
              disabled={isOwnComment || isDeletedUser}
            >
              {profilePhotoURL ? (
                <Image
                  source={{ uri: profilePhotoURL, cacheKey: `avatar-${comment.userId}` }}
                  style={styles.profilePhoto}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                />
              ) : (
                <View style={styles.profilePhotoPlaceholder}>
                  <Text style={styles.profilePhotoInitial}>{initials}</Text>
                </View>
              )}
            </TouchableOpacity>

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

              {/* Comment Text - uses MentionText for @mention parsing */}
              {text ? (
                <MentionText
                  text={text}
                  onMentionPress={onMentionPress}
                  mentionedCommentId={comment.mentionedCommentId}
                  style={styles.commentText}
                />
              ) : null}

              {/* Media Thumbnail (if exists) */}
              {mediaUrl && (
                <Image
                  source={{ uri: mediaUrl, cacheKey: `comment-media-${comment.id}` }}
                  style={styles.mediaThumbnail}
                  contentFit="cover"
                  transition={200}
                />
              )}

              {/* Footer Row - Reply and Timestamp */}
              <View style={styles.footerRow}>
                {onReply && (
                  <>
                    <TouchableOpacity style={styles.replyButton} onPress={handleReplyPress}>
                      <Text style={styles.replyButtonText}>Reply</Text>
                    </TouchableOpacity>
                    <Text style={styles.dot}>·</Text>
                  </>
                )}
                <Text style={styles.timestamp}>{getTimeAgo(createdAt)}</Text>
              </View>
            </View>

            {/* Heart Icon */}
            <TouchableOpacity style={styles.heartContainer} onPress={handleLikePress}>
              <PixelIcon
                name={isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={isLiked ? colors.status.danger : colors.text.secondary}
              />
              {likeCount > 0 && <Text style={styles.likeCount}>{likeCount}</Text>}
            </TouchableOpacity>
          </View>
        </Swipeable>
      </Animated.View>
    </Animated.View>
  );
};

export default React.memo(CommentRow);
