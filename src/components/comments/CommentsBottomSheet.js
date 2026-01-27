/**
 * CommentsBottomSheet Component
 *
 * Bottom sheet modal for displaying and adding comments:
 * - Custom Animated Modal (NOT @gorhom/bottom-sheet due to Expo 54 compatibility)
 * - KeyboardAvoidingView for proper keyboard handling on iOS/Android
 * - 60% screen height with photo visible above
 * - FlatList for comments with real-time updates
 * - CommentInput at bottom with reply state management
 * - Dark theme matching app aesthetics
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
  Keyboard,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CommentWithReplies from './CommentWithReplies';
import CommentInput from './CommentInput';
import useComments from '../../hooks/useComments';
import { colors } from '../../constants/colors';
import logger from '../../utils/logger';
import { styles, SHEET_HEIGHT, EXPANDED_HEIGHT } from '../../styles/CommentsBottomSheet.styles';

/**
 * CommentsBottomSheet Component
 *
 * @param {boolean} visible - Modal visibility state
 * @param {function} onClose - Callback when sheet dismissed
 * @param {string} photoId - Photo ID to load comments for
 * @param {string} photoOwnerId - Photo owner's user ID (for delete permissions)
 * @param {string} currentUserId - Current user's ID
 * @param {function} onCommentAdded - Callback after comment successfully added
 */
const CommentsBottomSheet = ({
  visible,
  onClose,
  photoId,
  photoOwnerId,
  currentUserId,
  onCommentAdded,
}) => {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const sheetTranslateY = useRef(new Animated.Value(0)).current; // UAT-021 fix: sheet position for keyboard
  const swipeY = useRef(new Animated.Value(0)).current; // UAT-020 fix: swipe gesture tracking
  const sheetHeight = useRef(new Animated.Value(SHEET_HEIGHT)).current; // 36.1-01: animated height for expand/collapse
  const inputRef = useRef(null);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets(); // UAT-010 fix: safe area for bottom input
  const [keyboardVisible, setKeyboardVisible] = useState(false); // UAT-013 fix: keyboard state
  const isExpandedRef = useRef(false); // 36.1-01: ref for PanResponder closure access
  const isAtTopRef = useRef(true); // Track if FlatList is scrolled to top

  /**
   * PanResponder for bidirectional expand/collapse on handle bar (36.1-01)
   * - Swipe UP when collapsed: expand to fullscreen
   * - Swipe DOWN when expanded: collapse to 60%
   * - Swipe DOWN when collapsed: close sheet entirely
   * Velocity-based snapping: fast swipes (vy > 0.5) snap immediately
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, // UAT-030 fix: capture touches on handle bar
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
              useNativeDriver: false, // height animation requires JS driver
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

  // Track keyboard visibility and animate sheet up (UAT-021 fix, UAT-029 fix)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      const keyboardHeight = event.endCoordinates.height;
      setKeyboardVisible(true);
      // UAT-029 fix: Move up 87% of keyboard height - clears suggestions bar
      // 60% didn't clear suggestions, 80% still tight, 90% slightly high, 100% had excess gap
      Animated.timing(sheetTranslateY, {
        toValue: -(keyboardHeight * 0.885),
        duration: 250,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      // Animate sheet back to original position (UAT-021 fix)
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
    addComment,
    deleteComment,
    toggleLike,
    setReplyingTo,
    cancelReply,
    canDeleteComment,
    isOwnerComment,
    isLikedByUser,
  } = useComments(photoId, currentUserId, photoOwnerId);

  logger.debug('CommentsBottomSheet: Render', {
    visible,
    photoId,
    commentCount: threadedComments?.length,
    loading,
    hasError: !!error,
  });

  /**
   * Animate sheet on visibility change
   */
  useEffect(() => {
    if (visible) {
      // Slide up animation
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 100,
      }).start();

      logger.info('CommentsBottomSheet: Opened', { photoId });
    } else {
      // Reset all animated values for next open (36.1-01)
      translateY.setValue(SHEET_HEIGHT);
      sheetHeight.setValue(SHEET_HEIGHT);
      swipeY.setValue(0); // Reset swipe position here, not in animation callback
      isExpandedRef.current = false;
    }
  }, [visible, translateY, photoId, sheetHeight]);

  /**
   * Handle backdrop press to close
   */
  const handleBackdropPress = useCallback(() => {
    logger.debug('CommentsBottomSheet: Backdrop pressed, closing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  /**
   * Handle close button press
   */
  const handleClose = useCallback(() => {
    logger.debug('CommentsBottomSheet: Close button pressed');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  /**
   * Handle comment submit
   * Note: Sheet stays open after submit (UAT-003 fix) to allow continued interaction
   */
  const handleSubmitComment = useCallback(
    async (text, mediaUrl, mediaType) => {
      logger.info('CommentsBottomSheet: Submitting comment', {
        photoId,
        textLength: text?.length,
        isReply: !!replyingTo,
      });

      const result = await addComment(text, mediaUrl, mediaType);

      if (result.success) {
        logger.info('CommentsBottomSheet: Comment added successfully', {
          commentId: result.commentId,
        });

        // Trigger callback (but don't close sheet - UAT-003 fix)
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
    [photoId, replyingTo, addComment, onCommentAdded]
  );

  /**
   * Handle reply button press on comment
   */
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

  /**
   * Handle delete comment
   */
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

  /**
   * Handle like comment
   */
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
   * Render individual comment row with replies
   */
  const renderCommentItem = useCallback(
    ({ item: comment }) => {
      return (
        <CommentWithReplies
          comment={comment}
          onReply={handleReply}
          onLike={handleLike}
          onDelete={handleDelete}
          isOwnerComment={isOwnerComment}
          canDeleteComment={canDeleteComment}
          isLikedByUser={isLikedByUser}
        />
      );
    },
    [handleReply, handleLike, handleDelete, isOwnerComment, canDeleteComment, isLikedByUser]
  );

  /**
   * Render empty state
   */
  const renderEmpty = useCallback(() => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubble-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No comments yet</Text>
        <Text style={styles.emptySubtext}>Be the first to comment</Text>
      </View>
    );
  }, [loading]);

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.brand.purple} />
    </View>
  );

  /**
   * Render error state
   */
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.status.danger} />
      <Text style={styles.errorText}>{error || 'Failed to load comments'}</Text>
    </View>
  );

  // Key extractor for FlatList
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

  // Comment count for header
  const totalCommentCount = threadedComments.reduce(
    (count, comment) => count + 1 + (comment.replies?.length || 0),
    0
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop - tap to close */}
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Sheet container - no KeyboardAvoidingView needed with translateY approach (UAT-021 fix) */}
        <View style={styles.keyboardAvoidContainer}>
          {/* Outer: Height animation (JS driver) - 36.1-01 expand/collapse */}
          <Animated.View style={{ height: sheetHeight }}>
            {/* Inner: Transform animations (native driver) - UAT-020/021 gestures */}
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
              {/* Handle bar - swipe-to-close gesture (UAT-020 fix) */}
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
                  <Ionicons name="close" size={24} color={colors.text.primary} />
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
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  onScroll={handleScroll}
                  onScrollEndDrag={handleScrollEndDrag}
                  scrollEventThrottle={16}
                />
              )}

              {/* Comment Input - with safe area padding (UAT-010 fix) */}
              <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
                <CommentInput
                  ref={inputRef}
                  onSubmit={handleSubmitComment}
                  onImagePick={() => {
                    logger.debug('CommentsBottomSheet: Image picker (Plan 06)');
                  }}
                  replyingTo={replyingTo}
                  onCancelReply={cancelReply}
                  placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
                />
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

export default CommentsBottomSheet;
