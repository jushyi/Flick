/**
 * PhotoDetailScreen - Navigation screen version of photo viewer
 *
 * Uses transparentModal presentation to keep previous screen visible.
 * Gets state from PhotoDetailContext instead of props.
 *
 * Features:
 * - Full-screen photo display
 * - Swipe-down-to-dismiss gesture
 * - Profile header
 * - Inline horizontal emoji picker in footer
 * - Multiple reactions per user with counts
 * - Stories mode: progress bar, tap navigation, multi-photo
 * - 3D cube rotation for friend-to-friend transitions (Reanimated UI thread)
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StatusBar,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import ReanimatedModule, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing as ReanimatedEasing,
  runOnJS,
} from 'react-native-reanimated';
import PixelIcon from '../components/PixelIcon';
import StrokedNameText from '../components/StrokedNameText';
import EmojiPicker from 'rn-emoji-keyboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getTimeAgo } from '../utils/timeUtils';
import { usePhotoDetailModal } from '../hooks/usePhotoDetailModal';
import { usePhotoDetail } from '../context/PhotoDetailContext';
import { styles } from '../styles/PhotoDetailScreen.styles';
import CommentsBottomSheet from '../components/comments/CommentsBottomSheet';
import {
  softDeletePhoto,
  archivePhoto,
  restorePhoto,
  updatePhotoTags,
  updateCaption,
  subscribePhoto,
} from '../services/firebase/photoService';
import DropdownMenu from '../components/DropdownMenu';
import { TagFriendsModal, TaggedPeopleModal } from '../components';
import { colors } from '../constants/colors';
import { profileCacheKey } from '../utils/imageUtils';
import { addTaggedPhotoToFeed } from '../services/firebase/photoTagService';
import logger from '../utils/logger';

// Reanimated View component for cube face transforms (UI-thread animation)
const ReanimatedView = ReanimatedModule.View;

// Progress bar constants - matches photo marginHorizontal (8px)
const PROGRESS_BAR_HORIZONTAL_PADDING = 8;
const PROGRESS_BAR_GAP = 2;
const MIN_SEGMENT_WIDTH = 4;
const MAX_VISIBLE_SEGMENTS = 20;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * PhotoDetailScreen Component
 *
 * Navigation screen that displays photo detail view.
 * Gets all state from PhotoDetailContext.
 */
const PhotoDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // Read taggedPhotoContext from route params (passed by ConversationScreen for tagged photo messages)
  const { taggedPhotoContext } = route.params || {};

  // Get state and callbacks from context
  const {
    currentPhoto: contextPhoto,
    photos: contextPhotos,
    currentIndex: contextInitialIndex,
    mode: contextMode,
    isOwnStory: contextIsOwnStory,
    hasNextFriend: contextHasNextFriend,
    hasPreviousFriend: contextHasPreviousFriend,
    currentUserId: contextUserId,
    sourceRect: contextSourceRect,
    initialShowComments,
    targetCommentId,
    showComments,
    setShowComments,
    handleReactionToggle,
    handlePhotoChange,
    handleRequestNextFriend,
    handleRequestPreviousFriend,
    handleCancelFriendTransition,
    handleAvatarPress: contextAvatarPress,
    handleClose: contextClose,
    handlePhotoStateChanged,
    updateCurrentPhoto,
    updatePhotoAtIndex,
    getCallbacks,
  } = usePhotoDetail();

  // Cube transition animation for friend-to-friend (two-view simultaneous rotation)
  // Uses Reanimated SharedValue for UI-thread animation performance
  const cubeProgress = useSharedValue(1);
  const transitionDirectionValue = useSharedValue(1); // 1 = forward, -1 = backward
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);
  const [transitionDirection, setTransitionDirection] = useState('forward'); // 'forward' | 'backward'
  const swipeDirectionRef = useRef('forward'); // Sync ref for cancel callback access
  const snapshotRef = useRef({});

  // Progress bar scroll ref for auto-scrolling
  const progressScrollRef = useRef(null);

  // Emoji scroll ref for auto-scrolling when new emoji added
  const emojiScrollRef = useRef(null);

  // Highlight fade animation for newly added emoji (1 second fade)
  const highlightOpacity = useRef(new Animated.Value(1)).current;

  // Photo menu state (for owner actions: delete, archive, restore)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Tag modal state
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [taggedPeopleModalVisible, setTaggedPeopleModalVisible] = useState(false);

  // Caption inline edit state
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const captionInputRef = useRef(null);
  const lastSavedCaptionRef = useRef('');

  // Keyboard tracking for caption input offset
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Image loading state - shows spinner when photo is loading from network
  const [imageLoading, setImageLoading] = useState(true);
  const handleImageLoadStart = useCallback(() => setImageLoading(true), []);
  const handleImageLoadEnd = useCallback(() => setImageLoading(false), []);

  // Reset loading state when photo changes (new photo starts loading)
  const prevPhotoIdRef = useRef(null);
  if (contextPhoto?.id !== prevPhotoIdRef.current) {
    prevPhotoIdRef.current = contextPhoto?.id;
    // Only set loading if the photo actually changed (avoids flicker on re-renders)
    if (contextPhoto?.id) {
      setImageLoading(true);
    }
  }

  // Reset cube state when screen mounts
  useEffect(() => {
    cubeProgress.value = 1;
    isTransitioningRef.current = false;
    setIsTransitioning(false);
  }, []);

  // Apply initialShowComments after mount - delayed so opening animation renders photo first
  useEffect(() => {
    if (initialShowComments) {
      const timer = setTimeout(() => setShowComments(true), 300);
      return () => clearTimeout(timer);
    }
  }, []);

  // Subscribe to current photo for real-time updates (tags, reactions, etc.)
  useEffect(() => {
    if (!contextPhoto?.id) return;

    logger.debug('PhotoDetailScreen: Setting up photo subscription', { photoId: contextPhoto.id });

    const unsubscribe = subscribePhoto(contextPhoto.id, result => {
      if (result.success && result.photo) {
        logger.debug('PhotoDetailScreen: Photo updated from subscription', {
          photoId: result.photo.id,
          tagCount: result.photo.taggedUserIds?.length || 0,
        });

        updateCurrentPhoto(result.photo);
      } else {
        logger.warn('PhotoDetailScreen: Photo subscription error', { error: result.error });
      }
    });

    return () => {
      logger.debug('PhotoDetailScreen: Cleaning up photo subscription', {
        photoId: contextPhoto.id,
      });
      unsubscribe();
    };
  }, [contextPhoto?.id, updateCurrentPhoto]);

  // Sync caption local state when navigating between photos
  useEffect(() => {
    const caption = contextPhoto?.caption || '';
    setCaptionText(caption);
    lastSavedCaptionRef.current = caption;
    setIsEditingCaption(false);
  }, [contextPhoto?.id]);

  const handleClose = useCallback(() => {
    // Call context close handler
    contextClose();
    // Navigate back
    navigation.goBack();
  }, [contextClose, navigation]);

  /**
   * Transition complete callback - called via runOnJS from Reanimated worklet
   */
  const handleTransitionComplete = useCallback(() => {
    isTransitioningRef.current = false;
    setIsTransitioning(false);
  }, []);

  /**
   * Handle friend-to-friend transition with 3D cube animation
   * Uses two simultaneous views: outgoing rotates away, incoming rotates in
   * Both pivot on the shared right edge for a true cube effect
   */
  const handleFriendTransition = useCallback(() => {
    if (isTransitioningRef.current) return false;
    if (!contextHasNextFriend) {
      return false; // Let hook handle animated close
    }

    // Mark transitioning synchronously so snapshotRef freezes on next render
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    transitionDirectionValue.value = 1; // forward

    // Outgoing face is always in the tree — set cubeProgress to 0 so UI thread
    // instantly reveals it (no waiting for React render)
    cubeProgress.value = 0;

    // Swap to next friend's content (incoming face is hidden at cubeProgress=0)
    handleRequestNextFriend();

    // Defer animation to next frame so React renders new friend's data on the incoming
    // face before it becomes visible (prevents flash of outgoing friend's photo)
    requestAnimationFrame(() => {
      cubeProgress.value = withTiming(
        1,
        {
          duration: 250,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
        },
        finished => {
          'worklet';
          if (finished) {
            runOnJS(handleTransitionComplete)();
          }
        }
      );
    });

    return true;
  }, [
    contextHasNextFriend,
    handleRequestNextFriend,
    cubeProgress,
    transitionDirectionValue,
    handleTransitionComplete,
  ]);

  /**
   * Backward transition complete callback - called via runOnJS from Reanimated worklet
   */
  const handleBackwardTransitionComplete = useCallback(() => {
    isTransitioningRef.current = false;
    setIsTransitioning(false);
    setTransitionDirection('forward');
    transitionDirectionValue.value = 1; // reset to forward
  }, [transitionDirectionValue]);

  /**
   * Handle backward friend-to-friend transition with reverse 3D cube animation
   * Incoming face enters from the left, outgoing exits to the right
   */
  const handlePreviousFriendTransition = useCallback(() => {
    if (isTransitioningRef.current) return false;
    if (!contextHasPreviousFriend) {
      return false; // Let hook handle animated close
    }

    isTransitioningRef.current = true;
    setTransitionDirection('backward');
    transitionDirectionValue.value = -1; // backward
    setIsTransitioning(true);

    cubeProgress.value = 0;
    handleRequestPreviousFriend();

    // Defer animation to next frame so React renders new friend's data on the incoming
    // face before it becomes visible (prevents flash of outgoing friend's photo)
    requestAnimationFrame(() => {
      cubeProgress.value = withTiming(
        1,
        {
          duration: 250,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
        },
        finished => {
          'worklet';
          if (finished) {
            runOnJS(handleBackwardTransitionComplete)();
          }
        }
      );
    });

    return true;
  }, [
    contextHasPreviousFriend,
    handleRequestPreviousFriend,
    cubeProgress,
    transitionDirectionValue,
    handleBackwardTransitionComplete,
  ]);

  /**
   * Prepare for an interactive horizontal swipe transition.
   * Called by the hook at the START of a horizontal drag.
   * Freezes snapshot, sets transition direction, loads next/previous friend data.
   */
  const handlePrepareSwipeTransition = useCallback(
    direction => {
      if (isTransitioningRef.current) return false;
      if (direction === 'forward' && !contextHasNextFriend) return false;
      if (direction === 'backward' && !contextHasPreviousFriend) return false;

      isTransitioningRef.current = true;
      setIsTransitioning(true);
      setTransitionDirection(direction);
      transitionDirectionValue.value = direction === 'forward' ? 1 : -1;
      swipeDirectionRef.current = direction;
      cubeProgress.value = 0;

      if (direction === 'forward') {
        handleRequestNextFriend();
      } else {
        handleRequestPreviousFriend();
      }

      return true;
    },
    [
      contextHasNextFriend,
      contextHasPreviousFriend,
      handleRequestNextFriend,
      handleRequestPreviousFriend,
      cubeProgress,
      transitionDirectionValue,
    ]
  );

  /**
   * Complete an interactive swipe transition (user committed the swipe).
   * Called by the hook after the completion animation finishes.
   */
  const handleCommitSwipeTransition = useCallback(() => {
    isTransitioningRef.current = false;
    setIsTransitioning(false);
    setTransitionDirection('forward');
    swipeDirectionRef.current = 'forward';
  }, []);

  /**
   * Cancel an interactive swipe transition (user didn't swipe far enough).
   * Called by the hook after the spring-back animation finishes.
   * Restores original friend data via FeedScreen cancel callback.
   */
  const handleCancelSwipeTransition = useCallback(() => {
    handleCancelFriendTransition();

    // Wait for React to render the restored data before unfreezing snapshot
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTransitioningRef.current = false;
        setIsTransitioning(false);
        setTransitionDirection('forward');
        transitionDirectionValue.value = 1; // reset to forward
        swipeDirectionRef.current = 'forward';
        cubeProgress.value = 1;
      });
    });
  }, [handleCancelFriendTransition, cubeProgress, transitionDirectionValue]);

  // Reanimated animated styles for cube face transforms (runs on UI thread)
  const incomingCubeStyle = useAnimatedStyle(() => {
    const dir = transitionDirectionValue.value; // 1=forward, -1=backward
    return {
      backfaceVisibility: 'hidden',
      transform: [
        { perspective: 650 },
        { translateX: interpolate(cubeProgress.value, [0, 1], [dir * SCREEN_WIDTH, 0]) },
        { translateX: -dir * (SCREEN_WIDTH / 2) },
        { rotateY: `${interpolate(cubeProgress.value, [0, 1], [dir * 90, 0])}deg` },
        { translateX: dir * (SCREEN_WIDTH / 2) },
      ],
    };
  });

  const outgoingCubeStyle = useAnimatedStyle(() => {
    const dir = transitionDirectionValue.value;
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backfaceVisibility: 'hidden',
      transform: [
        { perspective: 650 },
        { translateX: interpolate(cubeProgress.value, [0, 1], [0, -dir * SCREEN_WIDTH]) },
        { translateX: dir * (SCREEN_WIDTH / 2) },
        { rotateY: `${interpolate(cubeProgress.value, [0, 1], [0, -dir * 90])}deg` },
        { translateX: -dir * (SCREEN_WIDTH / 2) },
      ],
    };
  });

  // Opens comments on swipe-up if not already visible
  const handleSwipeUpToOpenComments = useCallback(() => {
    if (!showComments) {
      setShowComments(true);
    }
  }, [showComments, setShowComments]);

  const {
    // Mode
    showProgressBar,

    // Photo data
    currentPhoto,
    imageURL,
    capturedAt,
    displayName,
    profilePhotoURL,
    nameColor,

    // Stories navigation
    currentIndex,
    totalPhotos,
    handleTapNavigation,

    // Animation
    translateY,
    opacity,
    panResponder,

    // Expand/collapse animation
    openProgress,
    dismissScale,
    suckTranslateX,
    animatedBorderRadius,
    sourceTransform,

    // Reactions
    groupedReactions,
    orderedEmojis,
    getUserReactionCount,
    handleEmojiPress,

    // Custom emoji picker
    showEmojiPicker,
    setShowEmojiPicker,
    handleOpenEmojiPicker,
    handleEmojiPickerSelect,
    newlyAddedEmoji,

    // Close handler (animated - plays suck-back/slide-down before calling onClose)
    handleClose: animatedClose,

    // Comments visibility (for disabling swipe-to-dismiss during comment scroll)
    updateCommentsVisible,
  } = usePhotoDetailModal({
    mode: contextMode,
    photo: contextPhoto,
    photos: contextPhotos,
    initialIndex: contextInitialIndex,
    onPhotoChange: handlePhotoChange,
    visible: true, // Always visible since it's a screen
    onClose: handleClose,
    onReactionToggle: handleReactionToggle,
    currentUserId: contextUserId,
    onFriendTransition: contextMode === 'stories' ? handleFriendTransition : null,
    onPreviousFriendTransition: contextMode === 'stories' ? handlePreviousFriendTransition : null,
    onSwipeUp: handleSwipeUpToOpenComments,
    sourceRect: contextSourceRect,
    // Interactive swipe support
    cubeProgress,
    onPrepareSwipeTransition: handlePrepareSwipeTransition,
    onCommitSwipeTransition: handleCommitSwipeTransition,
    onCancelSwipeTransition: handleCancelSwipeTransition,
  });

  // Calculate segment width based on total photos
  // Must be computed BEFORE snapshot capture so outgoing cube face has correct widths
  const { segmentWidth, needsScroll } = useMemo(() => {
    if (totalPhotos <= 0) return { segmentWidth: MIN_SEGMENT_WIDTH, needsScroll: false };

    const availableWidth = SCREEN_WIDTH - PROGRESS_BAR_HORIZONTAL_PADDING * 2;
    const totalGapWidth = (totalPhotos - 1) * PROGRESS_BAR_GAP;
    const widthForSegments = availableWidth - totalGapWidth;
    const calculatedWidth = widthForSegments / totalPhotos;

    // If segments would be smaller than min, use min width and enable scrolling
    if (calculatedWidth < MIN_SEGMENT_WIDTH) {
      return { segmentWidth: MIN_SEGMENT_WIDTH, needsScroll: true };
    }

    // If more than MAX_VISIBLE_SEGMENTS, cap width and scroll
    if (totalPhotos > MAX_VISIBLE_SEGMENTS) {
      const cappedWidth =
        (availableWidth - (MAX_VISIBLE_SEGMENTS - 1) * PROGRESS_BAR_GAP) / MAX_VISIBLE_SEGMENTS;
      return { segmentWidth: Math.max(cappedWidth, MIN_SEGMENT_WIDTH), needsScroll: true };
    }

    return { segmentWidth: calculatedWidth, needsScroll: false };
  }, [totalPhotos]);

  // Keep snapshot ref updated with current display data for cube transition
  // Freeze during transitions so outgoing face keeps the old friend's data
  if (!isTransitioningRef.current) {
    snapshotRef.current = {
      imageURL,
      displayName,
      profilePhotoURL,
      nameColor,
      capturedAt,
      totalPhotos,
      currentIndex,
      showProgressBar,
      segmentWidth,
      commentCount: currentPhoto?.commentCount || 0,
      orderedEmojis: orderedEmojis,
      groupedReactions: groupedReactions,
      photoId: currentPhoto?.id,
      userId: currentPhoto?.userId,
      isOwnPhoto: currentPhoto?.userId === contextUserId,
      taggedUserIds: currentPhoto?.taggedUserIds,
      caption: currentPhoto?.caption,
      hasMenuOptions: true,
      contextMode: contextMode,
    };
  }

  // Compute combined expand/collapse + dismiss transforms
  const expandScale = useMemo(() => {
    if (!sourceTransform) return dismissScale;
    return Animated.multiply(
      openProgress.interpolate({ inputRange: [0, 1], outputRange: [sourceTransform.scale, 1] }),
      dismissScale
    );
  }, [sourceTransform, openProgress, dismissScale]);

  const expandTranslateX = useMemo(() => {
    if (!sourceTransform) return suckTranslateX;
    return Animated.add(
      openProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceTransform.translateX, 0],
      }),
      suckTranslateX
    );
  }, [sourceTransform, openProgress, suckTranslateX]);

  const expandTranslateY = useMemo(() => {
    if (!sourceTransform) return translateY;
    return Animated.add(
      openProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceTransform.translateY, 0],
      }),
      translateY
    );
  }, [sourceTransform, openProgress, translateY]);

  // Sync comments visibility with hook (so panResponder knows not to capture gestures)
  useEffect(() => {
    updateCommentsVisible(showComments);
  }, [showComments, updateCommentsVisible]);

  // Check if viewing own photo (disable avatar tap)
  const isOwnPhoto = currentPhoto?.userId === contextUserId;

  // Disabled for own photos
  const handleAvatarPress = useCallback(() => {
    if (isOwnPhoto) return;
    if (contextAvatarPress && currentPhoto) {
      contextAvatarPress(currentPhoto.userId, displayName);
    }
  }, [contextAvatarPress, currentPhoto, displayName, isOwnPhoto]);

  /**
   * Handle attribution press - navigate to photographer's profile
   * Uses contextAvatarPress (ProfileFromPhotoDetail fullScreenModal) so the profile
   * renders above the transparent PhotoDetail modal, not behind it.
   */
  const handlePhotographerPress = useCallback(
    (photographerId, photographerDisplayName) => {
      if (contextAvatarPress) {
        contextAvatarPress(photographerId, photographerDisplayName);
      }
    },
    [contextAvatarPress]
  );

  // Tagged photo "Add to feed" state
  const [isAddingToFeed, setIsAddingToFeed] = useState(false);
  const [hasAddedToFeed, setHasAddedToFeed] = useState(
    () => !!taggedPhotoContext?.addedToFeedBy?.[contextUserId]
  );

  // Determine if Add to feed button should be shown
  const showAddToFeedButton = taggedPhotoContext && currentPhoto?.userId !== contextUserId;

  /**
   * Handle "Add to feed" button press for tagged photo context
   */
  const handleAddToFeed = useCallback(async () => {
    if (!taggedPhotoContext || isAddingToFeed || hasAddedToFeed) return;
    setIsAddingToFeed(true);
    try {
      const result = await addTaggedPhotoToFeed(
        taggedPhotoContext.photoId,
        taggedPhotoContext.conversationId,
        taggedPhotoContext.messageId
      );
      if (result.success) {
        setHasAddedToFeed(true);
      } else {
        logger.warn('Failed to add tagged photo to feed', { error: result.error });
      }
    } catch (error) {
      logger.error('Error adding tagged photo to feed', { error: error.message });
    } finally {
      setIsAddingToFeed(false);
    }
  }, [taggedPhotoContext, isAddingToFeed, hasAddedToFeed]);

  /**
   * Handle avatar press from comments - navigate to user's profile
   * Keep comments open - when user returns they'll be right where they were
   */
  const handleCommentAvatarPress = useCallback(
    (userId, userName) => {
      // Navigate directly - comments and PhotoDetail stay open underneath
      // When user goes back from profile, they return to PhotoDetail with comments still visible
      if (contextAvatarPress) {
        contextAvatarPress(userId, userName);
      }
    },
    [contextAvatarPress]
  );

  /**
   * Handle optimistic comment count update when user adds a comment
   * Updates context state and propagates to feed if in feed mode
   */
  const handleCommentCountChange = useCallback(
    delta => {
      if (!currentPhoto) return;

      const photoId = currentPhoto.id;

      // Optimistically update photo count
      const updatedPhoto = {
        ...currentPhoto,
        commentCount: (currentPhoto.commentCount || 0) + delta,
      };

      // Update context state (for this screen and modal)
      updateCurrentPhoto(updatedPhoto);

      // If in feed mode, also update feed state via callback
      if (contextMode === 'feed') {
        const callbacks = getCallbacks();
        if (callbacks.onCommentCountChange) {
          callbacks.onCommentCountChange(photoId, delta);
        }
      }

      logger.debug('PhotoDetailScreen: Optimistically updated comment count', {
        photoId,
        delta,
        newCount: updatedPhoto.commentCount,
        mode: contextMode,
      });
    },
    [currentPhoto, contextMode, updateCurrentPhoto, getCallbacks]
  );

  /**
   * Save caption on blur/endEditing — guards against double-save and unnecessary writes
   */
  const handleSaveCaption = useCallback(async () => {
    if (!isEditingCaption) return;
    const trimmed = captionText.trim();
    const savedCaption = lastSavedCaptionRef.current || '';
    setIsEditingCaption(false);
    if (trimmed === savedCaption) return;

    const updatedPhoto = { ...currentPhoto, caption: trimmed || null };
    const rollbackPhoto = { ...currentPhoto, caption: savedCaption || null };

    // Optimistic update — show new caption immediately
    lastSavedCaptionRef.current = trimmed || '';
    if (contextMode === 'stories') {
      updatePhotoAtIndex(currentIndex, updatedPhoto);
    }
    updateCurrentPhoto(updatedPhoto);

    const result = await updateCaption(currentPhoto?.id, trimmed);
    if (!result.success) {
      // Rollback on failure
      logger.warn('Failed to save caption', { error: result.error });
      lastSavedCaptionRef.current = savedCaption;
      if (contextMode === 'stories') {
        updatePhotoAtIndex(currentIndex, rollbackPhoto);
      }
      updateCurrentPhoto(rollbackPhoto);
    }
  }, [
    isEditingCaption,
    captionText,
    currentPhoto,
    currentIndex,
    contextMode,
    updateCurrentPhoto,
    updatePhotoAtIndex,
  ]);

  /**
   * Trigger inline caption editing from menu
   */
  const handleEditCaption = useCallback(() => {
    setCaptionText(currentPhoto?.caption || '');
    setIsEditingCaption(true);
    // Auto-focus the input after state update
    setTimeout(() => {
      captionInputRef.current?.focus();
    }, 100);
  }, [currentPhoto?.caption]);

  const handleArchive = useCallback(() => {
    setShowPhotoMenu(false);
    Alert.alert(
      'Remove from Journal',
      'This photo will be hidden from your stories and feed but remain in your albums. You can restore it anytime.',
      Platform.OS === 'android'
        ? [
            {
              text: 'Remove',
              onPress: async () => {
                const result = await archivePhoto(currentPhoto.id, contextUserId);
                if (result.success) {
                  handlePhotoStateChanged?.();
                  handleClose();
                } else {
                  Alert.alert('Error', result.error || 'Failed to archive photo');
                }
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        : [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              onPress: async () => {
                const result = await archivePhoto(currentPhoto.id, contextUserId);
                if (result.success) {
                  handlePhotoStateChanged?.();
                  handleClose();
                } else {
                  Alert.alert('Error', result.error || 'Failed to archive photo');
                }
              },
            },
          ]
    );
  }, [currentPhoto?.id, contextUserId, handleClose, handlePhotoStateChanged]);

  const handleRestore = useCallback(async () => {
    setShowPhotoMenu(false);
    const result = await restorePhoto(currentPhoto.id, contextUserId);
    if (result.success) {
      handlePhotoStateChanged?.(); // Refresh feed/stories
      // Show success message - photo will now appear in feed/stories again
      Alert.alert('Restored', 'Photo has been restored to your journal.');
    } else {
      Alert.alert('Error', result.error || 'Failed to restore photo');
    }
  }, [currentPhoto?.id, contextUserId, handlePhotoStateChanged]);

  // Soft delete: moves to Recently Deleted with 30-day grace period
  const handleDeleteConfirm = useCallback(() => {
    setShowPhotoMenu(false);
    Alert.alert(
      'Delete Photo',
      'This photo will be moved to Recently Deleted. You can restore it within 30 days from Settings.',
      Platform.OS === 'android'
        ? [
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                const result = await softDeletePhoto(currentPhoto.id, contextUserId);
                if (result.success) {
                  handlePhotoStateChanged?.();
                  handleClose();
                } else {
                  Alert.alert('Error', result.error || 'Failed to delete photo');
                }
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        : [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                const result = await softDeletePhoto(currentPhoto.id, contextUserId);
                if (result.success) {
                  handlePhotoStateChanged?.();
                  handleClose();
                } else {
                  Alert.alert('Error', result.error || 'Failed to delete photo');
                }
              },
            },
          ]
    );
  }, [currentPhoto?.id, contextUserId, handleClose, handlePhotoStateChanged]);

  const handleReport = useCallback(() => {
    setShowPhotoMenu(false);
    navigation.navigate('ReportUser', {
      userId: currentPhoto?.userId,
      username: displayName,
      displayName: displayName,
      profilePhotoURL: profilePhotoURL,
    });
  }, [navigation, currentPhoto?.userId, displayName, profilePhotoURL]);

  const menuOptions = useMemo(() => {
    if (!isOwnPhoto) {
      return [
        {
          label: 'Report',
          icon: 'flag-outline',
          onPress: handleReport,
          destructive: true,
        },
      ];
    }

    const options = [];

    if (currentPhoto?.photoState === 'journal') {
      options.push({
        label: 'Remove from Journal',
        icon: 'archive-outline',
        onPress: handleArchive,
      });
    } else if (currentPhoto?.photoState === 'archive') {
      options.push({
        label: 'Restore to Journal',
        icon: 'refresh-outline',
        onPress: handleRestore,
      });
    }

    options.push({
      label: currentPhoto?.caption ? 'Edit Caption' : 'Add Caption',
      icon: 'pencil-outline',
      onPress: handleEditCaption,
    });

    options.push({
      label: 'Delete',
      icon: 'trash-outline',
      onPress: handleDeleteConfirm,
      destructive: true,
    });

    return options;
  }, [
    isOwnPhoto,
    currentPhoto?.photoState,
    currentPhoto?.caption,
    handleArchive,
    handleRestore,
    handleEditCaption,
    handleDeleteConfirm,
    handleReport,
  ]);

  const handleMenuButtonLayout = useCallback(event => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setMenuAnchor({ x, y, width, height });
  }, []);

  // Auto-scroll emoji row to start and fade highlight when new emoji is added
  useEffect(() => {
    if (newlyAddedEmoji) {
      // Scroll to start to show the new emoji
      if (emojiScrollRef.current) {
        emojiScrollRef.current.scrollTo({ x: 0, animated: true });
      }

      // Start fade animation: fully visible, then fade to 0 over 1 second
      highlightOpacity.setValue(1);
      Animated.timing(highlightOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }
  }, [newlyAddedEmoji, highlightOpacity]);

  // Auto-scroll progress bar to keep current segment visible
  useEffect(() => {
    if (needsScroll && progressScrollRef.current && totalPhotos > 0) {
      const segmentTotalWidth = segmentWidth + PROGRESS_BAR_GAP;
      const visibleWidth = SCREEN_WIDTH - PROGRESS_BAR_HORIZONTAL_PADDING * 2;
      const totalContentWidth = totalPhotos * segmentWidth + (totalPhotos - 1) * PROGRESS_BAR_GAP;

      // Calculate scroll position to center current segment (or keep it in view)
      const currentSegmentStart = currentIndex * segmentTotalWidth;
      const currentSegmentCenter = currentSegmentStart + segmentWidth / 2;

      // Scroll so current segment is about 1/3 from left edge
      const targetScrollX = Math.max(0, currentSegmentCenter - visibleWidth / 3);
      const maxScrollX = Math.max(0, totalContentWidth - visibleWidth);

      progressScrollRef.current.scrollTo({
        x: Math.min(targetScrollX, maxScrollX),
        animated: true,
      });
    }
  }, [currentIndex, needsScroll, segmentWidth, totalPhotos]);

  // Don't render if no photo
  if (!currentPhoto) return null;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background overlay - fades independently from content */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay.darker, opacity }]}
      />

      {/* Expand/collapse wrapper - scales + translates content from/to source card */}
      <Animated.View
        style={{
          flex: 1,
          overflow: 'hidden',
          opacity,
          transform: [
            { translateX: expandTranslateX },
            { translateY: expandTranslateY },
            { scale: expandScale },
          ],
        }}
      >
        {/* Main content wrapper - incoming face during cube transition (Reanimated) */}
        <ReanimatedView style={[styles.contentWrapper, incomingCubeStyle]}>
          {/* Header with close button */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity onPress={animatedClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Photo - TouchableWithoutFeedback for swipe-to-close gesture support */}
          <TouchableWithoutFeedback
            onPress={
              isEditingCaption
                ? () => {
                    Keyboard.dismiss();
                    handleSaveCaption();
                  }
                : contextMode === 'stories'
                  ? handleTapNavigation
                  : undefined
            }
          >
            <View style={styles.photoScrollView}>
              <Image
                source={{ uri: imageURL, cacheKey: `photo-${currentPhoto?.id}` }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
                onLoadStart={handleImageLoadStart}
                onLoadEnd={handleImageLoadEnd}
              />
              {imageLoading && (
                <ActivityIndicator
                  size="small"
                  color="rgba(255, 255, 255, 0.6)"
                  style={localStyles.imageLoadingSpinner}
                />
              )}
            </View>
          </TouchableWithoutFeedback>

          {/* Profile photo - overlapping top left of photo, tappable to navigate to profile */}
          <TouchableOpacity
            style={styles.profilePicContainer}
            onPress={handleAvatarPress}
            activeOpacity={isOwnPhoto ? 1 : 0.7}
            disabled={isOwnPhoto}
          >
            {profilePhotoURL ? (
              <Image
                source={{
                  uri: profilePhotoURL,
                  cacheKey: profileCacheKey(`profile-${currentPhoto?.userId}`, profilePhotoURL),
                }}
                style={styles.profilePic}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            ) : (
              <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
                <Text style={styles.profilePicText}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* User info + caption - bottom left of photo */}
          <View
            style={[
              styles.userInfoOverlay,
              {
                bottom:
                  isEditingCaption && keyboardHeight > 0
                    ? keyboardHeight + 16
                    : (contextMode === 'stories' ? 110 : 100) +
                      (Platform.OS === 'android' ? Math.max(0, insets.bottom - 8) : 0),
              },
            ]}
          >
            <View style={styles.userInfoRow}>
              <StrokedNameText
                style={styles.displayName}
                nameColor={currentPhoto?.user?.nameColor}
                numberOfLines={1}
              >
                {displayName || 'Unknown User'}
              </StrokedNameText>
              <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
            </View>
            {currentPhoto?.attribution && (
              <TouchableOpacity
                onPress={() =>
                  handlePhotographerPress(
                    currentPhoto.attribution.photographerId,
                    currentPhoto.attribution.photographerDisplayName
                  )
                }
                activeOpacity={0.7}
                style={localStyles.attributionRow}
              >
                <PixelIcon name="camera" size={14} color={colors.text.tertiary} />
                <Text style={localStyles.attributionText}>
                  Photo by @{currentPhoto.attribution.photographerUsername}
                </Text>
              </TouchableOpacity>
            )}
            {isEditingCaption ? (
              <View style={localStyles.captionEditRow}>
                <TextInput
                  ref={captionInputRef}
                  style={[styles.captionEditInput, { flex: 1 }]}
                  value={captionText}
                  onChangeText={text => setCaptionText(text.slice(0, 100))}
                  onBlur={handleSaveCaption}
                  onEndEditing={handleSaveCaption}
                  maxLength={100}
                  multiline
                  scrollEnabled={false}
                  keyboardAppearance="dark"
                  cursorColor={colors.interactive.primary}
                  selectionColor={colors.interactive.primary}
                  placeholder="Add a caption..."
                  placeholderTextColor={colors.text.tertiary}
                />
                <TouchableOpacity
                  style={localStyles.captionDoneButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSaveCaption();
                  }}
                  activeOpacity={0.7}
                >
                  <PixelIcon name="checkmark" size={18} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
            ) : currentPhoto?.caption ? (
              <Text style={styles.captionText} numberOfLines={3}>
                {currentPhoto.caption}
              </Text>
            ) : null}
          </View>

          {/* Tag button - visible for owner always, non-owner only when tags exist */}
          {(isOwnPhoto || currentPhoto?.taggedUserIds?.length > 0) && (
            <TouchableOpacity
              style={[
                styles.tagButton,
                Platform.OS === 'android' && { bottom: styles.tagButton.bottom + insets.bottom },
              ]}
              onPress={() => {
                if (isOwnPhoto) {
                  setTagModalVisible(true);
                } else {
                  setTaggedPeopleModalVisible(true);
                }
              }}
              activeOpacity={0.7}
            >
              <PixelIcon
                name={isOwnPhoto ? 'person-add-outline' : 'people-outline'}
                size={18}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          )}

          {/* Photo menu button */}
          {menuOptions.length > 0 && (
            <TouchableOpacity
              style={[
                styles.photoMenuButton,
                Platform.OS === 'android' && {
                  bottom: styles.photoMenuButton.bottom + insets.bottom,
                },
              ]}
              onPress={() => setShowPhotoMenu(true)}
              onLayout={handleMenuButtonLayout}
              activeOpacity={0.7}
            >
              <PixelIcon name="ellipsis-vertical" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          )}

          {/* Add to feed button - visible when viewing tagged photo as recipient */}
          {showAddToFeedButton && (
            <View
              style={[
                localStyles.addToFeedContainer,
                Platform.OS === 'android' && { bottom: 150 + insets.bottom },
              ]}
            >
              <TouchableOpacity
                style={[
                  localStyles.addToFeedButton,
                  (hasAddedToFeed || isAddingToFeed) && localStyles.addToFeedButtonDisabled,
                ]}
                onPress={handleAddToFeed}
                disabled={hasAddedToFeed || isAddingToFeed}
                activeOpacity={0.7}
              >
                <PixelIcon
                  name="image-outline"
                  size={16}
                  color={hasAddedToFeed ? 'rgba(10, 10, 26, 0.5)' : '#0A0A1A'}
                />
                <Text
                  style={[
                    localStyles.addToFeedText,
                    hasAddedToFeed && localStyles.addToFeedTextDisabled,
                  ]}
                >
                  {isAddingToFeed ? 'Adding...' : hasAddedToFeed ? 'Added to feed' : 'Add to feed'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Progress bar - stories mode only */}
          {showProgressBar && totalPhotos > 0 && (
            <ScrollView
              ref={progressScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={needsScroll}
              style={styles.progressBarScrollView}
              contentContainerStyle={styles.progressBarContainer}
            >
              {Array.from({ length: totalPhotos }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressSegment,
                    { width: segmentWidth },
                    index <= currentIndex
                      ? styles.progressSegmentActive
                      : styles.progressSegmentInactive,
                  ]}
                />
              ))}
            </ScrollView>
          )}

          {/* Footer - Comment Input + Emoji Pills (hidden when caption keyboard is open) */}
          <View
            style={[
              styles.footer,
              Platform.OS === 'android' && {
                paddingBottom: styles.footer.paddingBottom + insets.bottom,
              },
              isEditingCaption && keyboardHeight > 0 && { opacity: 0 },
            ]}
            pointerEvents={isEditingCaption && keyboardHeight > 0 ? 'none' : 'auto'}
          >
            {/* Comment input trigger - left side */}
            <TouchableOpacity
              style={styles.commentInputTrigger}
              onPress={() => setShowComments(true)}
              activeOpacity={0.8}
            >
              <PixelIcon name="chatbubble-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.commentInputTriggerText} numberOfLines={1}>
                {currentPhoto?.commentCount > 0
                  ? `${currentPhoto.commentCount} comment${currentPhoto.commentCount === 1 ? '' : 's'}`
                  : 'Add a comment...'}
              </Text>
            </TouchableOpacity>

            {/* Emoji pills - right side */}
            <ScrollView
              ref={emojiScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiPickerContainer}
              style={[styles.emojiPickerScrollView, contextIsOwnStory && styles.disabledEmojiRow]}
            >
              {orderedEmojis.map(emoji => {
                const totalCount = groupedReactions[emoji] || 0;
                const userCount = getUserReactionCount(emoji);
                const isSelected = userCount > 0;
                const isNewlyAdded = emoji === newlyAddedEmoji;

                // For own stories, render as non-interactive View
                if (contextIsOwnStory) {
                  return (
                    <View key={emoji} style={{ position: 'relative' }}>
                      <View style={[styles.emojiPill, isSelected && styles.emojiPillSelected]}>
                        <Text style={styles.emojiPillEmoji}>{emoji}</Text>
                        {totalCount > 0 && <Text style={styles.emojiPillCount}>{totalCount}</Text>}
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={emoji} style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={[styles.emojiPill, isSelected && styles.emojiPillSelected]}
                      onPress={() => handleEmojiPress(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emojiPillEmoji}>{emoji}</Text>
                      {totalCount > 0 && <Text style={styles.emojiPillCount}>{totalCount}</Text>}
                    </TouchableOpacity>
                    {/* Purple highlight overlay that fades out */}
                    {isNewlyAdded && (
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.emojiHighlightOverlay, { opacity: highlightOpacity }]}
                      />
                    )}
                  </View>
                );
              })}

              {/* Add custom emoji button - hidden for own stories */}
              {!contextIsOwnStory && (
                <TouchableOpacity
                  style={[styles.emojiPill, styles.addEmojiButton]}
                  onPress={handleOpenEmojiPicker}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addEmojiText}>+</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </ReanimatedView>

        {/* Outgoing cube face - always rendered, naturally hidden at cubeProgress=1
           (off-screen left + rotated -90deg). Reanimated reveals it instantly
           when cubeProgress goes to 0, eliminating the flash. */}
        <ReanimatedView pointerEvents="none" style={[styles.contentWrapper, outgoingCubeStyle]}>
          {snapshotRef.current.imageURL && (
            <>
              {/* Header with close button */}
              <View style={styles.header}>
                <View style={styles.headerSpacer} />
                <View style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </View>
              </View>

              {/* Photo */}
              <View style={styles.photoScrollView}>
                <Image
                  source={{
                    uri: snapshotRef.current.imageURL,
                    cacheKey: snapshotRef.current.photoId
                      ? `photo-${snapshotRef.current.photoId}`
                      : undefined,
                  }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                />
              </View>

              {/* Profile photo */}
              <View style={styles.profilePicContainer}>
                {snapshotRef.current.profilePhotoURL ? (
                  <Image
                    source={{
                      uri: snapshotRef.current.profilePhotoURL,
                      cacheKey: snapshotRef.current.userId
                        ? `profile-${snapshotRef.current.userId}`
                        : undefined,
                    }}
                    style={styles.profilePic}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                ) : (
                  <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
                    <Text style={styles.profilePicText}>
                      {snapshotRef.current.displayName?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>

              {/* User info + caption - bottom offset matches incoming face calculation */}
              <View
                style={[
                  styles.userInfoOverlay,
                  {
                    bottom: snapshotRef.current.contextMode === 'stories' ? 110 : 100,
                  },
                ]}
              >
                <View style={styles.userInfoRow}>
                  <StrokedNameText
                    style={styles.displayName}
                    nameColor={snapshotRef.current.nameColor}
                    numberOfLines={1}
                  >
                    {snapshotRef.current.displayName || 'Unknown User'}
                  </StrokedNameText>
                  <Text style={styles.timestamp}>{getTimeAgo(snapshotRef.current.capturedAt)}</Text>
                </View>
                {snapshotRef.current.caption ? (
                  <Text style={styles.captionText} numberOfLines={3}>
                    {snapshotRef.current.caption}
                  </Text>
                ) : null}
              </View>

              {/* Tag button */}
              {(snapshotRef.current.isOwnPhoto ||
                snapshotRef.current.taggedUserIds?.length > 0) && (
                <View style={styles.tagButton}>
                  <PixelIcon
                    name={snapshotRef.current.isOwnPhoto ? 'person-add-outline' : 'people-outline'}
                    size={18}
                    color={colors.text.primary}
                  />
                </View>
              )}

              {/* Menu button */}
              {snapshotRef.current.hasMenuOptions && (
                <View style={styles.photoMenuButton}>
                  <PixelIcon name="ellipsis-vertical" size={28} color={colors.text.primary} />
                </View>
              )}

              {/* Progress bar */}
              {snapshotRef.current.showProgressBar && snapshotRef.current.totalPhotos > 0 && (
                <View style={[styles.progressBarScrollView, { overflow: 'hidden' }]}>
                  <View style={styles.progressBarContainer}>
                    {Array.from({ length: snapshotRef.current.totalPhotos }).map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.progressSegment,
                          { width: snapshotRef.current.segmentWidth },
                          index <= snapshotRef.current.currentIndex
                            ? styles.progressSegmentActive
                            : styles.progressSegmentInactive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.commentInputTrigger}>
                  <PixelIcon name="chatbubble-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.commentInputTriggerText} numberOfLines={1}>
                    {snapshotRef.current.commentCount > 0
                      ? `${snapshotRef.current.commentCount} comment${snapshotRef.current.commentCount === 1 ? '' : 's'}`
                      : 'Add a comment...'}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.emojiPickerContainer}
                  style={styles.emojiPickerScrollView}
                >
                  {(snapshotRef.current.orderedEmojis || []).map(emoji => {
                    const totalCount = snapshotRef.current.groupedReactions?.[emoji] || 0;
                    return (
                      <View key={emoji} style={styles.emojiPill}>
                        <Text style={styles.emojiPillEmoji}>{emoji}</Text>
                        {totalCount > 0 && <Text style={styles.emojiPillCount}>{totalCount}</Text>}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </ReanimatedView>

        {/* Close expand/collapse wrapper */}
      </Animated.View>

      {/* Comments Bottom Sheet */}
      <CommentsBottomSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        photoId={currentPhoto?.id}
        photoOwnerId={currentPhoto?.userId}
        currentUserId={contextUserId}
        onAvatarPress={handleCommentAvatarPress}
        onCommentCountChange={handleCommentCountChange}
        initialScrollToCommentId={targetCommentId}
      />

      {/* Custom Emoji Picker */}
      <EmojiPicker
        onEmojiSelected={handleEmojiPickerSelect}
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        enableRecentlyUsed={false}
        enableSearchBar={true}
        theme={{
          backdrop: colors.overlay.dark,
          knob: colors.text.secondary,
          container: colors.background.secondary,
          header: colors.text.primary,
          skinTonesContainer: colors.background.secondary,
          category: {
            icon: colors.text.secondary,
            iconActive: colors.text.primary,
            container: colors.background.secondary,
            containerActive: colors.brand.purple,
          },
          search: {
            text: colors.text.primary,
            placeholder: colors.text.secondary,
            icon: colors.text.secondary,
            background: colors.background.tertiary,
          },
          emoji: {
            selected: colors.brand.purple,
          },
        }}
      />

      {/* Photo Menu Dropdown (for owner actions) */}
      <DropdownMenu
        visible={showPhotoMenu}
        onClose={() => setShowPhotoMenu(false)}
        options={menuOptions}
        anchorPosition={menuAnchor}
      />

      {/* Tag Friends Modal (for owner tagging) */}
      <TagFriendsModal
        visible={tagModalVisible}
        onClose={() => setTagModalVisible(false)}
        initialSelectedIds={currentPhoto?.taggedUserIds || []}
        onConfirm={async selectedIds => {
          await updatePhotoTags(currentPhoto.id, selectedIds);
          setTagModalVisible(false);
        }}
      />

      {/* Tagged People Modal (for non-owner viewing) */}
      <TaggedPeopleModal
        visible={taggedPeopleModalVisible}
        onClose={() => setTaggedPeopleModalVisible(false)}
        taggedUserIds={currentPhoto?.taggedUserIds || []}
        onPersonPress={(userId, userName) => {
          setTaggedPeopleModalVisible(false);
          contextAvatarPress?.(userId, userName);
        }}
      />
    </View>
  );
};

const localStyles = StyleSheet.create({
  imageLoadingSpinner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -10,
    marginLeft: -10,
  },
  captionEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  captionDoneButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Attribution row for reshared photos
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  attributionText: {
    fontSize: 11,
    fontFamily: 'Silkscreen_400Regular',
    color: colors.text.tertiary,
    textShadowColor: colors.overlay.darker,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Centering container for add to feed button
  addToFeedContainer: {
    position: 'absolute',
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  // Add to feed button for tagged photo context
  addToFeedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.interactive.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  addToFeedButtonDisabled: {
    opacity: 0.5,
  },
  addToFeedText: {
    fontSize: 12,
    fontFamily: 'Silkscreen_700Bold',
    color: '#0A0A1A',
  },
  addToFeedTextDisabled: {
    color: 'rgba(10, 10, 26, 0.5)',
  },
});

export default PhotoDetailScreen;
