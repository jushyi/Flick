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
  ActivityIndicator,
  Keyboard,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CommentRow from './CommentRow';
import CommentInput from './CommentInput';
import useComments from '../../hooks/useComments';
import { colors } from '../../constants/colors';
import logger from '../../utils/logger';
import { styles, SHEET_HEIGHT } from '../../styles/CommentsBottomSheet.styles';

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
  const inputRef = useRef(null);
  const insets = useSafeAreaInsets(); // UAT-010 fix: safe area for bottom input
  const [keyboardVisible, setKeyboardVisible] = useState(false); // UAT-013 fix: keyboard state

  /**
   * PanResponder for swipe-to-close on handle bar (UAT-020 fix, UAT-030 fix)
   * UAT-030: Changed onStartShouldSetPanResponder to true - we want to capture
   * touches that start on the handle bar since the panResponder is scoped to it
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, // UAT-030 fix: capture touches on handle bar
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Respond to downward swipes
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Update swipeY to follow finger
          swipeY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Close if dragged down >1/4 of sheet or fast swipe
        if (gestureState.dy > SHEET_HEIGHT * 0.25 || gestureState.vy > 0.5) {
          // Animate out and close
          Animated.timing(swipeY, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            swipeY.setValue(0);
            if (onClose) {
              onClose();
            }
          });
        } else {
          // Spring back
          Animated.spring(swipeY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
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
      // UAT-029 fix: Move up 90% of keyboard height - clears suggestions bar
      // 60% didn't clear suggestions, 80% still tight, 100% had excess gap
      Animated.timing(sheetTranslateY, {
        toValue: -(keyboardHeight * 0.9),
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
    setReplyingTo,
    cancelReply,
    canDeleteComment,
    isOwnerComment,
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
      // Slide down animation
      translateY.setValue(SHEET_HEIGHT);
    }
  }, [visible, translateY, photoId]);

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
      await deleteComment(comment.id);
    },
    [deleteComment]
  );

  /**
   * Handle like comment (placeholder for Plan 04)
   */
  const handleLike = useCallback(comment => {
    logger.debug('CommentsBottomSheet: Like comment (placeholder)', {
      commentId: comment?.id,
    });
    // TODO: Implement in Plan 04
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  /**
   * Render individual comment row
   */
  const renderCommentItem = useCallback(
    ({ item: comment }) => {
      const isOwner = isOwnerComment(comment);
      const canDelete = canDeleteComment(comment);

      return (
        <View>
          {/* Main comment */}
          <CommentRow
            comment={comment}
            user={comment.user}
            onReply={handleReply}
            onLike={handleLike}
            onDelete={handleDelete}
            isOwnerComment={isOwner}
            canDelete={canDelete}
            isLiked={false} // TODO: Implement in Plan 04
          />

          {/* Replies (nested under parent) */}
          {comment.replies?.map(reply => (
            <View key={reply.id} style={styles.replyContainer}>
              <CommentRow
                comment={reply}
                user={reply.user}
                onReply={handleReply}
                onLike={handleLike}
                onDelete={handleDelete}
                isOwnerComment={isOwnerComment(reply)}
                canDelete={canDeleteComment(reply)}
                isLiked={false} // TODO: Implement in Plan 04
              />
            </View>
          ))}
        </View>
      );
    },
    [handleReply, handleLike, handleDelete, isOwnerComment, canDeleteComment]
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
          {/* Animated sheet (UAT-021 fix: moves UP when keyboard visible via sheetTranslateY) */}
          {/* UAT-020 fix: swipeY added for swipe-to-close gesture */}
          <Animated.View
            style={[
              styles.sheet,
              {
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
                style={styles.commentsList}
                contentContainerStyle={styles.commentsListContent}
                data={threadedComments}
                renderItem={renderCommentItem}
                keyExtractor={keyExtractor}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
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
        </View>
      </View>
    </Modal>
  );
};

export default CommentsBottomSheet;
