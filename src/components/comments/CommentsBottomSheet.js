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
  FlatList,
  Platform,
  Animated,
  Easing,
  Keyboard,
  BackHandler,
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
import { styles, SHEET_HEIGHT, SCREEN_HEIGHT } from '../../styles/CommentsBottomSheet.styles';

/**
 * CommentsBottomSheet Component
 *
 * @param {boolean} visible - Modal visibility state
 * @param {function} onClose - Callback when sheet dismissed
 * @param {string} photoId - Photo ID to load comments for
 * @param {string} photoOwnerId - Photo owner's user ID (for delete permissions)
 * @param {string} currentUserId - Current user's ID
 * @param {function} onCommentAdded - Callback after comment successfully added
 * @param {function} onCommentCountChange - Callback for optimistic count updates (delta)
 * @param {function} onAvatarPress - Callback when avatar pressed (userId, displayName) -> navigate to profile
 */
const CommentsBottomSheet = ({
  visible,
  onClose,
  photoId,
  photoOwnerId,
  currentUserId,
  onCommentAdded,
  onCommentCountChange,
  onAvatarPress,
  initialScrollToCommentId,
}) => {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const swipeY = useRef(new Animated.Value(0)).current; // Swipe gesture tracking
  const sheetHeight = useRef(new Animated.Value(SHEET_HEIGHT)).current; // Animated height for expand/collapse
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);
  const flatListRef = useRef(null);
  const hasAutoScrolledRef = useRef(false); // Guard: prevent auto-scroll from firing more than once per open
  const contentHeightRef = useRef(0); // Actual content height from onContentSizeChange
  const viewportHeightRef = useRef(0); // Actual FlatList viewport height from onLayout
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false); // Ref (not state) so PanResponder closure reads current value
  const keyboardHeightRef = useRef(0); // For PanResponder closure access
  const isAtTopRef = useRef(true); // Track if FlatList is scrolled to top
  const scrollOffsetRef = useRef(0); // Track current scroll offset for two-phase reply scroll
  const expandedHeight = SCREEN_HEIGHT - Math.max(insets.top - 10, 0); // Full screen, pushed slightly above profile photo
  const expandedHeightRef = useRef(expandedHeight); // For PanResponder closure access
  expandedHeightRef.current = expandedHeight; // Keep in sync with insets

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
            setIsExpanded(true);
            Animated.spring(sheetHeight, {
              toValue: expandedHeightRef.current,
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
            setIsExpanded(false);
            Keyboard.dismiss(); // Dismiss keyboard when collapsing
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
            Animated.parallel([
              Animated.timing(swipeY, {
                toValue: SHEET_HEIGHT,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
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

        // No significant gesture - spring back and dismiss keyboard if visible
        Keyboard.dismiss();
        Animated.spring(swipeY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  /**
   * Backdrop PanResponder for swipe-up expand + tap-to-close
   * Allows swiping up on the backdrop area above the sheet to expand
   */
  const backdropPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        const fastSwipe = Math.abs(vy) > 0.5;

        // Swipe UP on backdrop: expand sheet to fullscreen
        if (dy < -10 && !isExpandedRef.current && (fastSwipe || dy < -50)) {
          isExpandedRef.current = true;
          setIsExpanded(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.spring(sheetHeight, {
            toValue: expandedHeightRef.current,
            useNativeDriver: false,
            damping: 20,
            stiffness: 100,
          }).start();
          logger.debug('CommentsBottomSheet: Expanding via backdrop swipe');
          return;
        }

        // Tap or swipe down on backdrop: close sheet
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: SHEET_HEIGHT,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (onClose) {
            onClose();
          }
        });
      },
    })
  ).current;

  // Track keyboard visibility and auto-expand sheet to fullscreen
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      const kbHeight = event.endCoordinates.height;
      setKeyboardVisible(true);
      setKeyboardHeight(kbHeight);
      keyboardHeightRef.current = kbHeight;

      // Auto-expand to fullscreen when keyboard opens (if not already expanded)
      if (!isExpandedRef.current) {
        isExpandedRef.current = true;
        setIsExpanded(true);
        Animated.spring(sheetHeight, {
          toValue: expandedHeight,
          useNativeDriver: false,
          damping: 20,
          stiffness: 100,
        }).start();
      }
      // No sheet translation — bottom padding handles keyboard avoidance
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      keyboardHeightRef.current = 0;
      // Stay expanded — don't collapse sheet on keyboard hide
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [sheetHeight, expandedHeight]);

  // Android: intercept hardware back press to close sheet before screen dismisses
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      animateClose();
      return true; // Prevent default back navigation
    });
    return () => subscription.remove();
  }, [visible, animateClose]);

  // Use comments hook for state management
  const {
    threadedComments,
    loading,
    error,
    replyingTo,
    initialMention,
    highlightedCommentId,
    justAddedReplyTo,
    addComment,
    deleteComment,
    toggleLike,
    setReplyingTo,
    cancelReply,
    highlightComment,
    canDeleteComment,
    isOwnerComment,
    isLikedByUser,
    isNewComment,
  } = useComments(photoId, currentUserId, photoOwnerId);

  // @-mention autocomplete state
  const mentionSuggestions = useMentionSuggestions(photoOwnerId, currentUserId);
  const latestTextRef = useRef('');
  const latestCursorRef = useRef(0);

  // Track which reply sections to auto-expand for @mention navigation
  const [expandedReplyParents, setExpandedReplyParents] = useState({});

  // Track pending scroll target after comment submission
  const [pendingScrollTarget, setPendingScrollTarget] = useState(null);

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
      setIsExpanded(false);
      setKeyboardHeight(0);
      keyboardHeightRef.current = 0;
      setPendingScrollTarget(null); // Clear pending scroll
    }
  }, [visible, translateY, photoId, sheetHeight, backdropOpacity]);

  /**
   * Auto-scroll to specific comment from notification deep link
   * Waits for sheet to be visible AND comments to load
   */
  useEffect(() => {
    if (!visible || !initialScrollToCommentId || threadedComments.length === 0 || loading) {
      if (!visible) hasAutoScrolledRef.current = false; // reset guard when sheet closes
      return;
    }
    if (hasAutoScrolledRef.current) return; // already initiated for this open
    hasAutoScrolledRef.current = true;

    logger.info('CommentsBottomSheet: Auto-scrolling to comment', {
      commentId: initialScrollToCommentId,
    });

    // Find comment index (same logic as handleMentionPress)
    let targetIndex = -1;
    let isReply = false;
    let parentId = null;

    for (let i = 0; i < threadedComments.length; i++) {
      const comment = threadedComments[i];

      // Check if this is the target comment (top-level)
      if (comment.id === initialScrollToCommentId) {
        targetIndex = i;
        break;
      }

      // Check replies
      if (comment.replies) {
        for (let j = 0; j < comment.replies.length; j++) {
          if (comment.replies[j].id === initialScrollToCommentId) {
            targetIndex = i; // Parent's index for scrolling
            isReply = true;
            parentId = comment.id;
            break;
          }
        }
      }

      if (targetIndex !== -1) break;
    }

    if (targetIndex === -1) {
      logger.warn('CommentsBottomSheet: Target comment not found', {
        commentId: initialScrollToCommentId,
      });
      return;
    }

    // Expand parent section if target is a reply
    if (isReply && parentId) {
      setExpandedReplyParents(prev => ({
        ...prev,
        [parentId]: true,
      }));
    }

    // Scroll after delay for animations to complete.
    // Use scrollToCommentRef so this effect doesn't re-run (and cancel its timer)
    // every time scrollToComment's identity changes due to unrelated re-renders.
    const scrollTimer = setTimeout(
      () => {
        scrollToCommentRef.current(targetIndex, initialScrollToCommentId, isReply);
      },
      isReply ? 500 : 400
    );

    return () => clearTimeout(scrollTimer);
  }, [visible, initialScrollToCommentId, threadedComments, loading]);

  /**
   * Handle pending scroll after comment added.
   * Waits for both pendingScrollTarget to be set AND threadedComments to update
   * (new comment appears via real-time subscription) before scrolling.
   * Uses scrollToEnd for top-level comments (avoids height estimation errors).
   * 300ms delay ensures the FlatList has fully laid out the new comment.
   */
  useEffect(() => {
    if (!pendingScrollTarget || !flatListRef.current || threadedComments.length === 0) {
      return;
    }

    const { type, parentId } = pendingScrollTarget;

    const timer = setTimeout(() => {
      if (!flatListRef.current) return;

      if (type === 'top-level') {
        // Use tracked dimensions for accurate scroll (scrollToEnd uses stale cached values)
        const contentH = contentHeightRef.current;
        const viewportH = viewportHeightRef.current;
        if (contentH > 0 && viewportH > 0 && contentH > viewportH) {
          flatListRef.current.scrollToOffset({
            offset: contentH - viewportH,
            animated: true,
          });
        } else {
          flatListRef.current.scrollToEnd({ animated: true });
        }
        logger.debug('CommentsBottomSheet: Scrolled to end for new top-level comment', {
          contentH,
          viewportH,
        });
      } else if (type === 'reply' && parentId) {
        const parentIndex = threadedComments.findIndex(c => c.id === parentId);
        if (parentIndex >= 0) {
          flatListRef.current.scrollToIndex({
            index: parentIndex,
            animated: true,
            viewPosition: 0,
          });
          logger.debug('CommentsBottomSheet: Scrolled to parent for new reply', {
            parentIndex,
            parentId,
          });
        }
      }

      setPendingScrollTarget(null);
    }, 300);

    return () => clearTimeout(timer);
  }, [threadedComments, pendingScrollTarget]);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onClose) {
        onClose();
      }
    });
  }, [backdropOpacity, translateY, onClose]);

  const handleClose = useCallback(() => {
    logger.debug('CommentsBottomSheet: Close button pressed');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateClose();
  }, [animateClose]);

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

      // Calculate if top-level BEFORE adding (for optimistic update)
      const isTopLevel = !replyingTo;
      // Track parent for scrolling
      const parentCommentId = replyingTo?.parentId || replyingTo?.id;

      // Dismiss mention suggestions on submit
      mentionSuggestions.dismissSuggestions();

      const result = await addComment(text, mediaUrl, mediaType);

      if (result.success) {
        logger.info('CommentsBottomSheet: Comment added successfully', {
          commentId: result.commentId,
        });

        // Optimistically update count if top-level comment
        if (isTopLevel && onCommentCountChange) {
          onCommentCountChange(1); // Increment by 1
        }

        // Trigger callback (but don't close sheet)
        if (onCommentAdded) {
          onCommentAdded();
        }

        // Set pending scroll target - useEffect will scroll when comment appears in list
        if (isTopLevel) {
          setPendingScrollTarget({
            type: 'top-level',
            commentId: result.commentId,
          });
        } else if (parentCommentId) {
          setPendingScrollTarget({
            type: 'reply',
            commentId: result.commentId,
            parentId: parentCommentId,
          });
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
    [photoId, replyingTo, addComment, onCommentAdded, onCommentCountChange, mentionSuggestions]
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
   * Scroll to a comment and highlight it.
   * For replies (isReply=true), uses viewPosition:0 so the parent is at the
   * top of the viewport, giving Phase 2 (handleHighlightedReplyLayout) maximum
   * space below to reveal the actual reply.
   */
  const scrollToComment = useCallback(
    (index, commentId, isReply = false) => {
      if (flatListRef.current && index >= 0) {
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: isReply ? 0 : 0.3,
        });
      }

      // Highlight the comment
      highlightComment(commentId);
    },
    [highlightComment]
  );

  // Stable ref so the auto-scroll effect can call the latest scrollToComment
  // without listing it as a dependency (which causes timer-cancellation races).
  const scrollToCommentRef = useRef(scrollToComment);
  useEffect(() => {
    scrollToCommentRef.current = scrollToComment;
  }, [scrollToComment]);

  /**
   * Phase 2 of the two-phase reply scroll.
   * Called by CommentWithReplies via onLayout when the highlighted reply renders.
   * layoutY = the reply's Y offset relative to the CommentWithReplies root view.
   * After Phase 1 put the parent at viewPosition:0, the FlatList scroll offset
   * equals the parent item's content offset, so adding layoutY scrolls to the reply.
   */
  const handleHighlightedReplyLayout = useCallback(layoutY => {
    setTimeout(() => {
      if (flatListRef.current) {
        const targetOffset = scrollOffsetRef.current + layoutY - 80; // 80px top margin
        flatListRef.current.scrollToOffset({
          offset: Math.max(0, targetOffset),
          animated: true,
        });
      }
    }, 150);
  }, []);

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
      // Combine @mention expansion with just-added-reply expansion
      const shouldForceExpand = expandedReplyParents[comment.id] || justAddedReplyTo === comment.id;

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
          forceExpanded={shouldForceExpand}
          isNewComment={isNewComment}
          onHighlightedReplyLayout={handleHighlightedReplyLayout}
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
      justAddedReplyTo,
      handleHighlightedReplyLayout,
      isNewComment,
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
    scrollOffsetRef.current = offsetY;
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
          setIsExpanded(false);
          Keyboard.dismiss(); // Dismiss keyboard when collapsing
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
            Animated.parallel([
              Animated.timing(swipeY, {
                toValue: SHEET_HEIGHT,
                duration: 250,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start(() => {
              onClose();
            });
            logger.debug('CommentsBottomSheet: Closing via scroll pull-down');
          }
        }
      }
    },
    [sheetHeight, swipeY, onClose]
  );

  /**
   * Track FlatList content height and viewport height for accurate scrollToOffset.
   * These refs provide the actual measured values that scrollToEnd() gets wrong
   * when removeClippedSubviews replaces measured heights with estimates.
   */
  const handleContentSizeChange = useCallback((contentWidth, contentHeight) => {
    contentHeightRef.current = contentHeight;
  }, []);

  const handleListLayout = useCallback(event => {
    viewportHeightRef.current = event.nativeEvent.layout.height;
  }, []);

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
      {/* Backdrop - tap to close, swipe up to expand */}
      <View style={styles.backdrop} {...backdropPanResponder.panHandlers} />

      {/* Sheet container - bottom padding handles keyboard avoidance */}
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
                transform: [{ translateY }, { translateY: swipeY }],
              },
            ]}
          >
            {/* Handle bar + Header - swipe gestures for expand/collapse/close */}
            <View {...panResponder.panHandlers}>
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
                  <PixelIcon name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Comments List */}
            {loading ? (
              renderLoading()
            ) : error ? (
              renderError()
            ) : (
              <FlatList
                testID="comments-list"
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
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScroll={handleScroll}
                onScrollEndDrag={handleScrollEndDrag}
                scrollEventThrottle={16}
                onScrollToIndexFailed={handleScrollToIndexFailed}
                onContentSizeChange={handleContentSizeChange}
                onLayout={handleListLayout}
              />
            )}

            {/* Comment Input - paddingBottom accounts for keyboard or safe area */}
            <View
              testID="comment-input-area"
              style={{
                paddingBottom: keyboardVisible ? keyboardHeight : Math.max(insets.bottom, 8),
              }}
            >
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
