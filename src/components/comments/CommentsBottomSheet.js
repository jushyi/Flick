/**
 * CommentsBottomSheet Component
 *
 * Bottom sheet for displaying and adding comments:
 * - Uses Animated.View instead of Modal (survives navigation)
 * - 60% screen height with photo visible above
 * - FlatList for comments with real-time updates
 * - CommentInput at bottom with reply state management
 * - Dark theme matching app aesthetics
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Platform,
  Animated,
  Easing,
  Keyboard,
  PanResponder,
} from 'react-native';
import PixelSpinner from '../PixelSpinner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PixelIcon from '../PixelIcon';
import * as Haptics from 'expo-haptics';
import CommentWithReplies from './CommentWithReplies';
import CommentInput from './CommentInput';
import useComments from '../../hooks/useComments';
import useMentionSuggestions from '../../hooks/useMentionSuggestions';
import { colors } from '../../constants/colors';
import logger from '../../utils/logger';
import {
  styles,
  SHEET_HEIGHT,
  EXPANDED_HEIGHT,
  SCREEN_HEIGHT,
} from '../../styles/CommentsBottomSheet.styles';

/**
 * CommentsBottomSheet Component
 *
 * @param {boolean} visible - Modal visibility state
 * @param {function} onClose - Callback when sheet dismissed
 * @param {string} photoId - Photo ID to load comments for
 * @param {string} photoOwnerId - Photo owner's user ID (for delete permissions)
 * @param {string} currentUserId - Current user's ID
 * @param {function} onCommentAdded - Callback after comment successfully added
 * @param {function} onAvatarPress - Callback when avatar pressed (userId, displayName) -> navigate to profile
 */
const CommentsBottomSheet = ({
  visible,
  onClose,
  photoId,
  photoOwnerId,
  currentUserId,
  onCommentAdded,
  onAvatarPress,
}) => {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const sheetTranslateY = useRef(new Animated.Value(0)).current; // Sheet position offset for keyboard
  const swipeY = useRef(new Animated.Value(0)).current; // Swipe gesture tracking
  const sheetHeight = useRef(new Animated.Value(SHEET_HEIGHT)).current; // Animated height for expand/collapse
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isExpandedRef = useRef(false); // Ref (not state) so PanResponder closure reads current value
  const isAtTopRef = useRef(true); // Track if FlatList is scrolled to top

  /**
   * PanResponder for bidirectional expand/collapse on handle bar
   * - Swipe UP when collapsed: expand to fullscreen
   * - Swipe DOWN when expanded: collapse to 60%
   * - Swipe DOWN when collapsed: close sheet entirely
   * Velocity-based snapping: fast swipes (vy > 0.5) snap immediately
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, // Capture touches on handle bar
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Respond to vertical swipes (up or down)
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only track downward movement for swipeY (visual feedback for close gesture)
        if (gestureState.dy > 0 && !isExpandedRef.current) {
          swipeY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        const fastSwipe = Math.abs(vy) > 0.5;
        const expanded = isExpandedRef.current;

        // SWIPE UP: Expand sheet
        if (dy < -10) {
          if (!expanded && (fastSwipe || dy < -50)) {
            // Expand to fullscreen
            isExpandedRef.current = true; // Update ref immediately for next gesture
            Animated.spring(sheetHeight, {
              toValue: EXPANDED_HEIGHT,
              useNativeDriver: false, // Height animation requires JS driver
              damping: 20,
              stiffness: 100,
            }).start();
            logger.debug('CommentsBottomSheet: Expanding to fullscreen');
          }
          return;
        }

        // SWIPE DOWN: Collapse or close
        if (dy > 10) {
          if (expanded && (fastSwipe || dy > 50)) {
            // Collapse from fullscreen to normal
            isExpandedRef.current = false; // Update ref immediately for next gesture
            Animated.spring(sheetHeight, {
              toValue: SHEET_HEIGHT,
              useNativeDriver: false,
              damping: 20,
              stiffness: 100,
            }).start();
            logger.debug('CommentsBottomSheet: Collapsing to normal height');
          } else if (!expanded && (dy > SHEET_HEIGHT * 0.25 || fastSwipe)) {
            // Close sheet entirely (existing behavior)
            // Note: swipeY reset happens in useEffect when visible becomes false
            Animated.timing(swipeY, {
              toValue: SHEET_HEIGHT,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              if (onClose) {
                onClose();
              }
            });
            logger.debug('CommentsBottomSheet: Closing sheet');
          } else {
            // Spring back (slow drag without threshold)
            Animated.spring(swipeY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
          return;
        }

        // No significant gesture - spring back
        Animated.spring(swipeY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Track keyboard visibility and animate sheet up to clear suggestions bar
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      const keyboardHeight = event.endCoordinates.height;
      setKeyboardVisible(true);
      // Move up 88.5% of keyboard height to clear autocomplete suggestions bar
      Animated.timing(sheetTranslateY, {
        toValue: -(keyboardHeight * 0.885),
        duration: 250,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      // Animate sheet back to original position
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [sheetTranslateY]);

  // Use comments hook for state management
  const {
    threadedComments,
    loading,
    error,
    replyingTo,
    initialMention,
    highlightedCommentId,
    addComment,
    deleteComment,
    toggleLike,
    setReplyingTo,
    cancelReply,
    highlightComment,
    canDeleteComment,
    isOwnerComment,
    isLikedByUser,
  } = useComments(photoId, currentUserId, photoOwnerId);

  // @-mention autocomplete state
  const mentionSuggestions = useMentionSuggestions(photoOwnerId, currentUserId);
  const latestTextRef = useRef('');
  const latestCursorRef = useRef(0);

  // Track which reply sections to auto-expand for @mention navigation
  const [expandedReplyParents, setExpandedReplyParents] = useState({});

  logger.debug('CommentsBottomSheet: Render', {
    visible,
    photoId,
    commentCount: threadedComments?.length,
    loading,
    hasError: !!error,
  });

  /**
   * Animate sheet on visibility change.
   * Uses Animated.View with opacity and pointerEvents instead of Modal
   * so the sheet survives navigation events.
   */
  useEffect(() => {
    if (visible) {
      // Animate in: backdrop fade + sheet slide up
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 100,
        }),
      ]).start();

      logger.info('CommentsBottomSheet: Opened', { photoId });
    } else {
      // Reset all animated values for next open
      translateY.setValue(SHEET_HEIGHT);
      sheetHeight.setValue(SHEET_HEIGHT);
      swipeY.setValue(0); // Reset swipe position here, not in animation callback
      backdropOpacity.setValue(0);
      isExpandedRef.current = false;
    }
  }, [visible, translateY, photoId, sheetHeight, backdropOpacity]);

  const handleBackdropPress = useCallback(() => {
    logger.debug('CommentsBottomSheet: Backdrop pressed, closing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleClose = useCallback(() => {
    logger.debug('CommentsBottomSheet: Close button pressed');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  /**
   * Handle comment submit.
   * Sheet stays open after submit to allow continued interaction.
   */
  const handleSubmitComment = useCallback(
    async (text, mediaUrl, mediaType) => {
      logger.info('CommentsBottomSheet: Submitting comment', {
        photoId,
        textLength: text?.length,
        isReply: !!replyingTo,
      });

      // Dismiss mention suggestions on submit
      mentionSuggestions.dismissSuggestions();

      const result = await addComment(text, mediaUrl, mediaType);

      if (result.success) {
        logger.info('CommentsBottomSheet: Comment added successfully', {
          commentId: result.commentId,
        });

        // Trigger callback (but don't close sheet)
        if (onCommentAdded) {
          onCommentAdded();
        }

        // Refocus input to allow adding more comments
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        logger.error('CommentsBottomSheet: Failed to add comment', {
          error: result.error,
        });
      }
    },
    [photoId, replyingTo, addComment, onCommentAdded, mentionSuggestions]
  );

  const handleReply = useCallback(
    comment => {
      logger.info('CommentsBottomSheet: Reply to comment', {
        commentId: comment?.id,
      });
      setReplyingTo(comment);
      // Focus input when replying
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    },
    [setReplyingTo]
  );

  const handleDelete = useCallback(
    async comment => {
      logger.info('CommentsBottomSheet: Deleting comment', {
        commentId: comment?.id,
      });
      const result = await deleteComment(comment.id);

      if (result.success) {
        // Success haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Error haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [deleteComment]
  );

  const handleLike = useCallback(
    async comment => {
      logger.info('CommentsBottomSheet: Like comment', {
        commentId: comment?.id,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await toggleLike(comment.id);
    },
    [toggleLike]
  );

  /**
   * Handle text changes from CommentInput for @-mention detection.
   */
  const handleTextChangeForMentions = useCallback(
    (text, cursorPosition) => {
      latestTextRef.current = text;
      latestCursorRef.current = cursorPosition;
      mentionSuggestions.handleTextChange(text, cursorPosition);
    },
    [mentionSuggestions]
  );

  /**
   * Handle mention suggestion selection.
   * Replaces @query with @username in the input text.
   */
  const handleMentionSelect = useCallback(
    user => {
      const { newText } = mentionSuggestions.selectSuggestion(
        user,
        latestTextRef.current,
        latestCursorRef.current
      );
      inputRef.current?.setText(newText);
      inputRef.current?.focus();
    },
    [mentionSuggestions]
  );

  /**
   * Handle @mention profile press - navigate to user profile for non-reply mentions.
   * Searches comments and mutual friends for the username, then navigates.
   */
  const handleMentionProfilePress = useCallback(
    username => {
      logger.info('CommentsBottomSheet: @mention profile press', { username });

      if (!username) return;

      const lowerUsername = username.toLowerCase();

      // Helper: defer onAvatarPress to next frame so the navigation runs
      // outside the current React/Text.onPress event batch. Without this,
      // the new screen renders behind the Animated.View overlay.
      const navigateToProfile = (userId, displayName) => {
        logger.info('CommentsBottomSheet: @mention navigating to profile', { userId, displayName });
        requestAnimationFrame(() => {
          onAvatarPress(userId, displayName);
        });
      };

      // Search comments for a user with this username
      for (let i = 0; i < threadedComments.length; i++) {
        const comment = threadedComments[i];
        const commentUsername = (comment.user?.username || '').toLowerCase();
        const commentDisplayName = (comment.user?.displayName || '').toLowerCase();

        if (commentUsername === lowerUsername || commentDisplayName === lowerUsername) {
          if (comment.userId !== currentUserId && onAvatarPress) {
            navigateToProfile(comment.userId, comment.user?.displayName);
            return;
          }
        }

        // Search replies
        if (comment.replies) {
          for (const reply of comment.replies) {
            const replyUsername = (reply.user?.username || '').toLowerCase();
            const replyDisplayName = (reply.user?.displayName || '').toLowerCase();

            if (replyUsername === lowerUsername || replyDisplayName === lowerUsername) {
              if (reply.userId !== currentUserId && onAvatarPress) {
                navigateToProfile(reply.userId, reply.user?.displayName);
                return;
              }
            }
          }
        }
      }

      // Search mutual friends list
      for (const friend of mentionSuggestions.allMutualFriends) {
        const friendUsername = (friend.username || '').toLowerCase();
        const friendDisplayName = (friend.displayName || '').toLowerCase();

        if (friendUsername === lowerUsername || friendDisplayName === lowerUsername) {
          if (friend.userId !== currentUserId && onAvatarPress) {
            navigateToProfile(friend.userId, friend.displayName);
            return;
          }
        }
      }

      logger.debug('CommentsBottomSheet: @mention user not found for profile', { username });
    },
    [threadedComments, currentUserId, onAvatarPress, mentionSuggestions.allMutualFriends]
  );

  /**
   * Handle @mention press - scroll to referenced comment.
   * Finds the comment in threadedComments, scrolls to it, and highlights it.
   */
  const handleMentionPress = useCallback(
    (username, mentionedCommentId) => {
      logger.info('CommentsBottomSheet: @mention pressed', {
        username,
        mentionedCommentId,
      });

      // If no mentionedCommentId, this is a manually typed @mention - navigate to profile
      if (!mentionedCommentId) {
        logger.debug('CommentsBottomSheet: No mentionedCommentId, navigating to profile');
        handleMentionProfilePress(username);
        return;
      }

      // Don't scroll to own comments (prevent circular scroll if replying to self)
      // Find the target comment to check ownership
      let targetComment = null;
      let targetIndex = -1;
      let isReply = false;
      let parentIndex = -1;

      // Search for the comment in threadedComments (top-level and replies)
      for (let i = 0; i < threadedComments.length; i++) {
        const comment = threadedComments[i];

        // Check if this is the target comment (top-level)
        if (comment.id === mentionedCommentId) {
          targetComment = comment;
          targetIndex = i;
          isReply = false;
          break;
        }

        // Check replies
        if (comment.replies) {
          for (let j = 0; j < comment.replies.length; j++) {
            if (comment.replies[j].id === mentionedCommentId) {
              targetComment = comment.replies[j];
              targetIndex = i; // FlatList index is the parent
              isReply = true;
              parentIndex = i;
              break;
            }
          }
        }

        if (targetComment) break;
      }

      // If not found, search by username (fallback for manually typed @mentions)
      if (!targetComment) {
        for (let i = 0; i < threadedComments.length; i++) {
          const comment = threadedComments[i];
          const commentUsername = comment.user?.username || comment.user?.displayName;

          if (commentUsername && commentUsername.toLowerCase() === username.toLowerCase()) {
            targetComment = comment;
            targetIndex = i;
            isReply = false;
            break;
          }
        }
      }

      // If still not found, silent fail
      if (!targetComment || targetIndex === -1) {
        logger.debug('CommentsBottomSheet: Target comment not found', {
          mentionedCommentId,
          username,
        });
        return;
      }

      // Skip scroll-to if this is the current user's own comment
      if (targetComment.userId === currentUserId) {
        logger.debug('CommentsBottomSheet: Skipping scroll to own comment');
        return;
      }

      // If the target is a reply in a collapsed section, expand it
      if (isReply && parentIndex !== -1) {
        setExpandedReplyParents(prev => ({
          ...prev,
          [threadedComments[parentIndex].id]: true,
        }));
        // Small delay to allow expansion before scrolling
        setTimeout(() => {
          scrollToComment(targetIndex, mentionedCommentId);
        }, 100);
      } else {
        scrollToComment(targetIndex, mentionedCommentId);
      }

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadedComments, currentUserId, highlightComment, handleMentionProfilePress]
  );

  /**
   * Scroll to a comment and highlight it
   */
  const scrollToComment = useCallback(
    (index, commentId) => {
      if (flatListRef.current && index >= 0) {
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3, // Position in upper third of view
        });
      }

      // Highlight the comment
      highlightComment(commentId);
    },
    [highlightComment]
  );

  /**
   * Handle scrollToIndex failure (item not yet rendered)
   */
  const handleScrollToIndexFailed = useCallback(info => {
    logger.warn('CommentsBottomSheet: scrollToIndex failed', {
      index: info.index,
      averageItemLength: info.averageItemLength,
    });

    // Scroll to approximate position then retry
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: true,
        });
      }
    }, 100);
  }, []);

  const renderCommentItem = useCallback(
    ({ item: comment }) => {
      return (
        <CommentWithReplies
          comment={comment}
          onReply={handleReply}
          onLike={handleLike}
          onDelete={handleDelete}
          onAvatarPress={onAvatarPress}
          currentUserId={currentUserId}
          isOwnerComment={isOwnerComment}
          canDeleteComment={canDeleteComment}
          isLikedByUser={isLikedByUser}
          onMentionPress={handleMentionPress}
          highlightedCommentId={highlightedCommentId}
          forceExpanded={expandedReplyParents[comment.id]}
        />
      );
    },
    [
      handleReply,
      handleLike,
      handleDelete,
      onAvatarPress,
      currentUserId,
      isOwnerComment,
      canDeleteComment,
      isLikedByUser,
      handleMentionPress,
      highlightedCommentId,
      expandedReplyParents,
    ]
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <PixelIcon name="chatbubble-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No comments yet</Text>
        <Text style={styles.emptySubtext}>Be the first to comment</Text>
      </View>
    );
  }, [loading]);

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <PixelSpinner size="large" color={colors.brand.purple} />
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <PixelIcon name="alert-circle-outline" size={48} color={colors.status.danger} />
      <Text style={styles.errorText}>{error || 'Failed to load comments'}</Text>
    </View>
  );

  const keyExtractor = useCallback(item => item.id, []);

  /**
   * Track scroll position to detect when at top
   */
  const handleScroll = useCallback(event => {
    const offsetY = event.nativeEvent.contentOffset.y;
    isAtTopRef.current = offsetY <= 0;
  }, []);

  /**
   * Handle scroll end drag - collapse/close if pulled down from top
   * When user bounces past top of list (contentOffset.y < 0), trigger collapse/close
   */
  const handleScrollEndDrag = useCallback(
    event => {
      const { contentOffset } = event.nativeEvent;

      // If bounced significantly past top (pulled down), collapse or close
      if (contentOffset.y < -50) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (isExpandedRef.current) {
          // Collapse from fullscreen to normal
          isExpandedRef.current = false;
          Animated.spring(sheetHeight, {
            toValue: SHEET_HEIGHT,
            useNativeDriver: false,
            damping: 20,
            stiffness: 100,
          }).start();
          logger.debug('CommentsBottomSheet: Collapsing via scroll pull-down');
        } else {
          // Close sheet entirely - use timing with easing for clean close (no bounce)
          // Note: swipeY reset happens in useEffect when visible becomes false
          if (onClose) {
            Animated.timing(swipeY, {
              toValue: SHEET_HEIGHT,
              duration: 250,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(() => {
              onClose();
            });
            logger.debug('CommentsBottomSheet: Closing via scroll pull-down');
          }
        }
      }
    },
    [sheetHeight, swipeY, onClose]
  );

  const totalCommentCount = threadedComments.reduce(
    (count, comment) => count + 1 + (comment.replies?.length || 0),
    0
  );

  // Animated.View instead of Modal so sheet survives navigation.
  // When visible=false, pointerEvents='none' makes it non-interactive but keeps it in render tree.
  return (
    <Animated.View
      style={[styles.overlay, styles.animatedOverlay, { opacity: backdropOpacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Backdrop - tap to close */}
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet container - uses translateY instead of KeyboardAvoidingView */}
      <View style={styles.keyboardAvoidContainer} pointerEvents="box-none">
        {/* Outer: Height animation (JS driver) for expand/collapse */}
        <Animated.View style={{ height: sheetHeight }}>
          {/* Inner: Transform animations (native driver) for gestures */}
          <Animated.View
            style={[
              styles.sheet,
              {
                flex: 1, // Fill the height-animated container
                maxHeight: undefined, // Override fixed maxHeight for expansion
                transform: [
                  { translateY },
                  { translateY: sheetTranslateY },
                  { translateY: swipeY },
                ],
              },
            ]}
          >
            {/* Handle bar - swipe gestures for expand/collapse/close */}
            <View style={styles.handleBarContainer} {...panResponder.panHandlers}>
              <View style={styles.handleBar} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.headerTitle}>Comments</Text>
                {totalCommentCount > 0 && (
                  <Text style={styles.headerCount}>({totalCommentCount})</Text>
                )}
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <PixelIcon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            {loading ? (
              renderLoading()
            ) : error ? (
              renderError()
            ) : (
              <FlatList
                ref={flatListRef}
                style={styles.commentsList}
                contentContainerStyle={styles.commentsListContent}
                data={threadedComments}
                renderItem={renderCommentItem}
                keyExtractor={keyExtractor}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={5}
                removeClippedSubviews={true}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScroll={handleScroll}
                onScrollEndDrag={handleScrollEndDrag}
                scrollEventThrottle={16}
                onScrollToIndexFailed={handleScrollToIndexFailed}
              />
            )}

            {/* Comment Input */}
            <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
              <CommentInput
                ref={inputRef}
                onSubmit={handleSubmitComment}
                onImagePick={() => {
                  logger.debug('CommentsBottomSheet: Image picker');
                }}
                replyingTo={replyingTo}
                onCancelReply={() => {
                  cancelReply();
                  mentionSuggestions.dismissSuggestions();
                }}
                initialMention={initialMention}
                placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
                mentionSuggestions={mentionSuggestions.filteredSuggestions}
                showMentionSuggestions={mentionSuggestions.showSuggestions}
                mentionSuggestionsLoading={mentionSuggestions.loading}
                onTextChangeForMentions={handleTextChangeForMentions}
                onMentionSelect={handleMentionSelect}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

export default CommentsBottomSheet;
