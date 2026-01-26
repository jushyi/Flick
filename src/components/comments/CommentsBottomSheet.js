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
import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
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
  const inputRef = useRef(null);

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

        // Trigger callback
        if (onCommentAdded) {
          onCommentAdded();
        }
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

        {/* KeyboardAvoidingView for keyboard handling */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Animated sheet */}
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {/* Handle bar */}
            <View style={styles.handleBarContainer}>
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

            {/* Comment Input */}
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
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default CommentsBottomSheet;
