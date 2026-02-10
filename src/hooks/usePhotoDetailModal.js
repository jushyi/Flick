/**
 * usePhotoDetailModal Hook
 *
 * Encapsulates all PhotoDetailModal logic:
 * - Animation values for swipe-to-dismiss
 * - PanResponder gesture handling
 * - Reaction state management
 * - Emoji ordering with frozen state during rapid taps
 * - Stories mode: multi-photo navigation with progress bar
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Animated, PanResponder, Dimensions, Easing } from 'react-native';
import { reactionHaptic } from '../utils/haptics';
import logger from '../utils/logger';
import { getCuratedEmojis } from '../utils/emojiRotation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Custom hook for PhotoDetailModal logic
 *
 * @param {object} params - Hook parameters
 * @param {string} params.mode - View mode: 'feed' (default) or 'stories'
 * @param {object} params.photo - Photo object (used in feed mode)
 * @param {array} params.photos - Array of photos (used in stories mode)
 * @param {number} params.initialIndex - Starting photo index for stories mode
 * @param {function} params.onPhotoChange - Callback when photo changes in stories mode
 * @param {boolean} params.visible - Modal visibility state
 * @param {function} params.onClose - Callback to close modal
 * @param {function} params.onReactionToggle - Callback when emoji is toggled
 * @param {string} params.currentUserId - Current user's ID
 * @param {function} params.onSwipeUp - Callback when user swipes up on photo
 * @returns {object} Modal state and handlers
 */
export const usePhotoDetailModal = ({
  mode = 'feed',
  photo,
  photos = [],
  initialIndex = 0,
  onPhotoChange,
  visible,
  onClose,
  onReactionToggle,
  currentUserId,
  onFriendTransition, // Callback for friend-to-friend transition with cube animation (taps)
  onPreviousFriendTransition, // Callback for backward friend transition with reverse cube (taps)
  onSwipeUp, // Callback when user swipes up to open comments
  // Interactive swipe support
  cubeProgress, // Animated.Value from PhotoDetailScreen for interactive gesture tracking
  onPrepareSwipeTransition, // (direction) => boolean - prepare transition at drag start
  onCommitSwipeTransition, // () => void - complete transition after commit animation
  onCancelSwipeTransition, // () => void - cancel transition after spring-back animation
}) => {
  // Stories mode: current photo index
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // State to track if we should re-sort or freeze current order
  const [frozenOrder, setFrozenOrder] = useState(null);
  const sortTimerRef = useRef(null);

  // Custom emoji picker state
  const [customEmoji, setCustomEmoji] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Track custom emojis that have been confirmed (persist in reaction row)
  const [activeCustomEmojis, setActiveCustomEmojis] = useState([]);
  // Track newly added emoji for highlight animation (null when no highlight needed)
  const [newlyAddedEmoji, setNewlyAddedEmoji] = useState(null);

  // Minimum display time tracking for rapid taps (ensures each photo is briefly visible)
  const lastTapTimeRef = useRef(0);
  const MIN_DISPLAY_TIME = 80; // ms - minimum time each photo is displayed

  // Animated values for swipe gesture
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Reset index when modal opens or initialIndex changes
  useEffect(() => {
    if (visible && mode === 'stories') {
      const validIndex = Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1));
      setCurrentIndex(validIndex);
      translateY.setValue(0);
      opacity.setValue(1);
      logger.debug('usePhotoDetailModal: Stories mode opened', {
        photoCount: photos.length,
        startingIndex: validIndex,
      });
    }
  }, [visible, initialIndex, photos.length, mode]);

  // Derive current photo based on mode
  const currentPhoto = useMemo(() => {
    if (mode === 'stories') {
      return photos[currentIndex] || null;
    }
    return photo;
  }, [mode, photo, photos, currentIndex]);

  // Get curated emojis based on current photo ID (deterministic per photo)
  const curatedEmojis = useMemo(() => {
    return getCuratedEmojis(currentPhoto?.id, 5);
  }, [currentPhoto?.id]);

  // Reset emoji state when photo changes
  // - Reset frozenOrder so emojis sort correctly by count for new photo
  // - Initialize activeCustomEmojis with any custom emojis already in the photo's reactions
  // Read reactions directly from currentPhoto to avoid stale closure issue
  useEffect(() => {
    if (currentPhoto?.id) {
      // Reset frozen order so new photo shows emojis sorted by count
      setFrozenOrder(null);

      // Find custom emojis already in reactions (emojis that are NOT in curated list)
      // Read directly from currentPhoto to get fresh data
      const photoReactions = currentPhoto?.reactions || {};
      const reactionEmojis = new Set();
      Object.values(photoReactions).forEach(userReactions => {
        if (typeof userReactions === 'object') {
          Object.keys(userReactions).forEach(emoji => reactionEmojis.add(emoji));
        }
      });
      const existingEmojis = [...reactionEmojis].filter(emoji => !curatedEmojis.includes(emoji));
      setActiveCustomEmojis(existingEmojis);
      setCustomEmoji(null);
    }
  }, [currentPhoto?.id, currentPhoto?.reactions, curatedEmojis]); // Include reactions to ensure fresh data

  // Extract photo data from currentPhoto
  const { imageURL, capturedAt, reactions = {}, user = {} } = currentPhoto || {};
  const { username, displayName, profilePhotoURL } = user;

  /**
   * Get grouped reactions (emoji -> count)
   * Read reactions directly from currentPhoto inside useMemo and depend on
   * currentPhoto instead of destructured reactions variable. This ensures
   * recalculation when photo changes, as React's dependency comparison on
   * the destructured variable was unreliable.
   */
  const groupedReactions = useMemo(() => {
    // Read reactions directly from currentPhoto to ensure fresh data
    const photoReactions = currentPhoto?.reactions || {};
    const grouped = {};
    Object.entries(photoReactions).forEach(([userId, userReactions]) => {
      // userReactions is now an object: { '😂': 2, '❤️': 1 }
      if (typeof userReactions === 'object') {
        Object.entries(userReactions).forEach(([emoji, count]) => {
          if (!grouped[emoji]) {
            grouped[emoji] = 0;
          }
          grouped[emoji] += count;
        });
      }
    });
    return grouped;
  }, [currentPhoto]);

  /**
   * Get current user's reaction count for a specific emoji
   * Read from currentPhoto?.reactions directly for consistency
   */
  const getUserReactionCount = useCallback(
    emoji => {
      const photoReactions = currentPhoto?.reactions || {};
      if (!currentUserId || !photoReactions[currentUserId]) return 0;
      return photoReactions[currentUserId][emoji] || 0;
    },
    [currentUserId, currentPhoto]
  );

  /**
   * Handle emoji button press (curated or custom emoji)
   * Triggers highlight animation (purple border that fades over 1 second)
   */
  const handleEmojiPress = useCallback(
    emoji => {
      reactionHaptic();
      const currentCount = getUserReactionCount(emoji);
      onReactionToggle(emoji, currentCount);

      // If not frozen yet, freeze the current sorted order (all emojis, not just curated)
      if (!frozenOrder) {
        const customToAdd = activeCustomEmojis.filter(e => !curatedEmojis.includes(e));
        const allEmojis = [...customToAdd, ...curatedEmojis];
        const allEmojiData = allEmojis.map(e => ({
          emoji: e,
          totalCount: groupedReactions[e] || 0,
        }));
        const currentSortedOrder = [...allEmojiData]
          .sort((a, b) => b.totalCount - a.totalCount)
          .map(item => item.emoji);
        setFrozenOrder(currentSortedOrder);
      }

      // Clear existing timer
      if (sortTimerRef.current) {
        clearTimeout(sortTimerRef.current);
      }

      // Set new timer to unfreeze and allow re-sorting after 1.5 seconds of no taps
      sortTimerRef.current = setTimeout(() => {
        setFrozenOrder(null);
      }, 1500);

      // Trigger highlight animation (purple border that fades over 1 second)
      setNewlyAddedEmoji(emoji);
      setTimeout(() => {
        setNewlyAddedEmoji(null);
      }, 2000);
    },
    [
      getUserReactionCount,
      onReactionToggle,
      frozenOrder,
      groupedReactions,
      curatedEmojis,
      activeCustomEmojis,
    ]
  );

  /**
   * Get ordered emoji list (frozen or sorted by count)
   * ALL emojis (custom + curated) are sorted by total count (highest first)
   */
  const orderedEmojis = useMemo(() => {
    // Get custom emojis that aren't in curated list
    const customToAdd = activeCustomEmojis.filter(e => !curatedEmojis.includes(e));

    // Combine all emojis and map to count data
    const allEmojis = [...customToAdd, ...curatedEmojis];
    const allEmojiData = allEmojis.map(emoji => ({
      emoji,
      totalCount: groupedReactions[emoji] || 0,
    }));

    // Sort all emojis by count (highest first)
    const sortedAll = [...allEmojiData]
      .sort((a, b) => b.totalCount - a.totalCount)
      .map(item => item.emoji);

    if (frozenOrder) {
      // When frozen, keep emojis in frozen order
      // Only include emojis that are in current set (in case emoji was removed)
      const validFrozen = frozenOrder.filter(e => allEmojis.includes(e));
      // Add any new emojis that weren't in frozen order (at the end, sorted by count)
      const newEmojis = sortedAll.filter(e => !frozenOrder.includes(e));
      return [...validFrozen, ...newEmojis];
    }

    return sortedAll;
  }, [frozenOrder, groupedReactions, curatedEmojis, activeCustomEmojis]);

  /**
   * Open the custom emoji picker
   */
  const handleOpenEmojiPicker = useCallback(() => {
    setShowEmojiPicker(true);
  }, []);

  /**
   * Handle emoji selection from picker
   * Immediately adds emoji to front of row, reacts, and shows highlight for 2 seconds
   */
  const handleEmojiPickerSelect = useCallback(
    emojiObject => {
      const selectedEmoji = emojiObject.emoji;
      setShowEmojiPicker(false);

      // Immediately react with the selected emoji
      reactionHaptic();
      const currentCount = getUserReactionCount(selectedEmoji);
      onReactionToggle(selectedEmoji, currentCount);

      // Add to FRONT of activeCustomEmojis if not already there (and not in curated list)
      if (!activeCustomEmojis.includes(selectedEmoji) && !curatedEmojis.includes(selectedEmoji)) {
        setActiveCustomEmojis(prev => [selectedEmoji, ...prev]);
      }

      // Set for highlight animation (purple border for 2 seconds)
      setNewlyAddedEmoji(selectedEmoji);
      setTimeout(() => {
        setNewlyAddedEmoji(null);
      }, 2000);
    },
    [getUserReactionCount, onReactionToggle, activeCustomEmojis, curatedEmojis]
  );

  /**
   * Confirm and commit the custom emoji reaction
   * Adds emoji to FRONT of activeCustomEmojis so it appears first in the row
   * Sets newlyAddedEmoji for highlight animation
   */
  const handleCustomEmojiConfirm = useCallback(() => {
    if (customEmoji) {
      reactionHaptic();
      const currentCount = getUserReactionCount(customEmoji);
      onReactionToggle(customEmoji, currentCount);

      // Add to FRONT of activeCustomEmojis if not already there (and not in curated list)
      if (!activeCustomEmojis.includes(customEmoji) && !curatedEmojis.includes(customEmoji)) {
        setActiveCustomEmojis(prev => [customEmoji, ...prev]);
        // Set for highlight animation
        setNewlyAddedEmoji(customEmoji);
        // Clear highlight after animation completes
        setTimeout(() => {
          setNewlyAddedEmoji(null);
        }, 600);
      }

      // Clear preview state so "+" button shows "+" again
      setCustomEmoji(null);
    }
  }, [customEmoji, getUserReactionCount, onReactionToggle, activeCustomEmojis, curatedEmojis]);

  /**
   * Navigate to previous photo in stories mode
   * Returns true if navigated, false if at first photo (caller should close)
   * Uses minimum display time to ensure each photo is briefly visible during rapid tapping
   */
  const goPrev = useCallback(() => {
    if (mode !== 'stories') return false;

    // Check minimum display time for rapid tapping
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    if (timeSinceLastTap < MIN_DISPLAY_TIME) {
      // Too fast - ignore this tap to ensure current photo is visible
      return true; // Return true to prevent close, but don't navigate
    }
    lastTapTimeRef.current = now;

    if (currentIndex === 0) {
      logger.debug('usePhotoDetailModal: At first photo');
      return false;
    }

    const newIndex = currentIndex - 1;
    logger.debug('usePhotoDetailModal: Navigate previous', { newIndex });
    setCurrentIndex(newIndex);
    if (onPhotoChange && photos[newIndex]) {
      onPhotoChange(photos[newIndex], newIndex);
    }
    return true;
  }, [mode, currentIndex, photos, onPhotoChange]);

  /**
   * Navigate to next photo in stories mode
   * Returns true if navigated, false if at last photo (caller should close)
   * Uses minimum display time to ensure each photo is briefly visible during rapid tapping
   * If onFriendTransition is provided and at last photo, triggers friend transition instead of close
   */
  const goNext = useCallback(() => {
    if (mode !== 'stories') return false;

    // Check minimum display time for rapid tapping
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    if (timeSinceLastTap < MIN_DISPLAY_TIME) {
      // Too fast - ignore this tap to ensure current photo is visible
      return true; // Return true to prevent close, but don't navigate
    }
    lastTapTimeRef.current = now;

    if (currentIndex >= photos.length - 1) {
      logger.debug('usePhotoDetailModal: At last photo');
      // Try friend-to-friend transition if available
      if (onFriendTransition) {
        const transitioned = onFriendTransition();
        if (transitioned) {
          logger.debug('usePhotoDetailModal: Transitioning to next friend');
          return true;
        }
      }
      return false;
    }

    const newIndex = currentIndex + 1;
    logger.debug('usePhotoDetailModal: Navigate next', { newIndex });
    setCurrentIndex(newIndex);
    if (onPhotoChange && photos[newIndex]) {
      onPhotoChange(photos[newIndex], newIndex);
    }
    return true;
  }, [mode, currentIndex, photos, onPhotoChange, onFriendTransition]);

  /**
   * Handle tap navigation on photo area (stories mode only)
   * Left 30%: previous (or close if first)
   * Right 30%: next (or close if last)
   * Center 40%: no action
   */
  const handleTapNavigation = useCallback(
    event => {
      if (mode !== 'stories') return;

      const { locationX } = event.nativeEvent;

      if (locationX < SCREEN_WIDTH * 0.3) {
        // Left tap - previous photo, or previous friend if at first photo
        if (!goPrev()) {
          // At first photo - try going to previous friend
          if (onPreviousFriendTransition) {
            const transitioned = onPreviousFriendTransition();
            if (transitioned) {
              return;
            }
          }
          onClose();
        }
      } else if (locationX > SCREEN_WIDTH * 0.7) {
        // Right tap - next
        if (!goNext()) {
          onClose();
        }
      }
      // Center 40% - no action (future: pause)
    },
    [mode, goPrev, goNext, onClose, onPreviousFriendTransition]
  );

  /**
   * Close modal with animation
   */
  const closeWithAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      // Reset after a short delay to ensure smooth transition
      setTimeout(() => {
        translateY.setValue(0);
        opacity.setValue(1);
      }, 100);
    });
  }, [translateY, opacity, onClose]);

  /**
   * Spring back to original position
   */
  const springBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(opacity, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  // Store callbacks in refs for panResponder access (created once, needs current values)
  const onSwipeUpRef = useRef(onSwipeUp);
  useEffect(() => {
    onSwipeUpRef.current = onSwipeUp;
  }, [onSwipeUp]);

  const onFriendTransitionRef = useRef(onFriendTransition);
  useEffect(() => {
    onFriendTransitionRef.current = onFriendTransition;
  }, [onFriendTransition]);

  const onPreviousFriendTransitionRef = useRef(onPreviousFriendTransition);
  useEffect(() => {
    onPreviousFriendTransitionRef.current = onPreviousFriendTransition;
  }, [onPreviousFriendTransition]);

  // Interactive swipe transition refs
  const cubeProgressRef = useRef(cubeProgress);
  useEffect(() => {
    cubeProgressRef.current = cubeProgress;
  }, [cubeProgress]);

  const onPrepareSwipeTransitionRef = useRef(onPrepareSwipeTransition);
  useEffect(() => {
    onPrepareSwipeTransitionRef.current = onPrepareSwipeTransition;
  }, [onPrepareSwipeTransition]);

  const onCommitSwipeTransitionRef = useRef(onCommitSwipeTransition);
  useEffect(() => {
    onCommitSwipeTransitionRef.current = onCommitSwipeTransition;
  }, [onCommitSwipeTransition]);

  const onCancelSwipeTransitionRef = useRef(onCancelSwipeTransition);
  useEffect(() => {
    onCancelSwipeTransitionRef.current = onCancelSwipeTransition;
  }, [onCancelSwipeTransition]);

  // Gesture tracking state for interactive horizontal swipe
  const isHorizontalSwipeActiveRef = useRef(false);
  const swipeDirectionRef = useRef(null); // 'forward' | 'backward'
  const firstMoveSkippedRef = useRef(false);

  // Track if comments are visible (to disable swipe-to-dismiss when scrolling comments)
  const [commentsVisible, setCommentsVisible] = useState(false);
  const commentsVisibleRef = useRef(false);

  // Expose setter for parent to call when comments open/close
  const updateCommentsVisible = useCallback(visible => {
    commentsVisibleRef.current = visible;
    setCommentsVisible(visible);
  }, []);

  /**
   * Pan responder for swipe gestures:
   * - Swipe DOWN: dismiss photo detail (existing behavior)
   * - Swipe UP: open comments
   * Excludes footer area (bottom 100px) to allow emoji taps.
   * Better gesture detection - check vertical vs horizontal movement
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Don't capture initial touch - let TouchableWithoutFeedback handle taps
        return false;
      },
      onStartShouldSetPanResponderCapture: () => {
        // Don't capture initial touch - wait for move to determine if it's a swipe
        return false;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Don't respond if comments sheet is open (let it handle its own scrolling)
        if (commentsVisibleRef.current) return false;

        // Don't respond if touch started in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        if (touchY >= footerThreshold) return false;

        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);

        if (isVerticalSwipe) {
          // Respond to both downward (close) and upward (open comments) swipes
          const isDownward = gestureState.dy > 5;
          const isUpward = gestureState.dy < -10;
          return isDownward || isUpward;
        }

        // Horizontal swipe detection for friend-to-friend transitions
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isLeftSwipe = gestureState.dx < -15;
        const isRightSwipe = gestureState.dx > 15;
        if (isHorizontalSwipe && (isLeftSwipe || isRightSwipe)) {
          const hasNext = isLeftSwipe && onFriendTransitionRef.current;
          const hasPrev = isRightSwipe && onPreviousFriendTransitionRef.current;
          return !!(hasNext || hasPrev);
        }

        return false;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Don't capture if comments sheet is open (let it handle its own scrolling)
        if (commentsVisibleRef.current) return false;

        // Don't capture if touch is in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        if (touchY >= footerThreshold) return false;

        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);

        if (isVerticalSwipe) {
          const isDownward = gestureState.dy > 5;
          const isUpward = gestureState.dy < -10;
          return isDownward || isUpward;
        }

        // Capture horizontal swipes for friend transitions
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isLeftSwipe = gestureState.dx < -15;
        const isRightSwipe = gestureState.dx > 15;
        if (isHorizontalSwipe && (isLeftSwipe || isRightSwipe)) {
          const hasNext = isLeftSwipe && onFriendTransitionRef.current;
          const hasPrev = isRightSwipe && onPreviousFriendTransitionRef.current;
          return !!(hasNext || hasPrev);
        }

        return false;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;

        // HORIZONTAL - interactive cube tracking
        if (isHorizontalSwipeActiveRef.current) {
          // Skip first frame after prepare to let React render new transitionDirection
          if (!firstMoveSkippedRef.current) {
            firstMoveSkippedRef.current = true;
            return;
          }
          // Drive cubeProgress proportional to finger displacement
          const progress = Math.min(1, Math.max(0, Math.abs(dx) / SCREEN_WIDTH));
          if (cubeProgressRef.current) {
            cubeProgressRef.current.setValue(progress);
          }
          return;
        }

        // Check if this should be an interactive horizontal swipe
        const isHorizontalGesture = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15;
        if (isHorizontalGesture && !isHorizontalSwipeActiveRef.current) {
          const direction = dx < 0 ? 'forward' : 'backward';

          // Check if transition callback is available
          const hasCallback =
            direction === 'forward'
              ? onFriendTransitionRef.current
              : onPreviousFriendTransitionRef.current;
          if (!hasCallback || !onPrepareSwipeTransitionRef.current) return;

          // Prepare transition (freezes snapshot, loads next friend data)
          const prepared = onPrepareSwipeTransitionRef.current(direction);
          if (!prepared) return;

          isHorizontalSwipeActiveRef.current = true;
          swipeDirectionRef.current = direction;
          firstMoveSkippedRef.current = false;
          return; // Skip driving cubeProgress this frame
        }

        // VERTICAL - existing behavior (swipe down to dismiss)
        if (dy > 0) {
          translateY.setValue(dy);
          const fadeAmount = Math.max(0, 1 - dy / SCREEN_HEIGHT);
          opacity.setValue(fadeAmount);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy, vx, vy } = gestureState;

        // HORIZONTAL SWIPES - interactive cube transition
        if (isHorizontalSwipeActiveRef.current) {
          const absDx = Math.abs(dx);
          const absVx = Math.abs(vx);
          const currentProgress = Math.min(1, absDx / SCREEN_WIDTH);

          const COMMIT_DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.3;
          const COMMIT_VELOCITY_THRESHOLD = 0.5;
          const shouldCommit =
            absDx > COMMIT_DISTANCE_THRESHOLD || absVx > COMMIT_VELOCITY_THRESHOLD;

          if (shouldCommit && cubeProgressRef.current) {
            // Commit: animate remaining distance to 1
            const remainingDistance = 1 - currentProgress;
            const baseDuration = remainingDistance * 350;
            const velocityFactor = Math.max(0.3, 1 - absVx * 0.3);
            const duration = Math.max(80, Math.min(250, baseDuration * velocityFactor));

            Animated.timing(cubeProgressRef.current, {
              toValue: 1,
              duration,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }).start(() => {
              onCommitSwipeTransitionRef.current?.();
            });
          } else if (cubeProgressRef.current) {
            // Cancel: spring back to 0
            Animated.spring(cubeProgressRef.current, {
              toValue: 0,
              tension: 80,
              friction: 12,
              useNativeDriver: true,
            }).start(() => {
              onCancelSwipeTransitionRef.current?.();
            });
          }

          // Reset horizontal gesture state
          isHorizontalSwipeActiveRef.current = false;
          swipeDirectionRef.current = null;
          firstMoveSkippedRef.current = false;
          return;
        }

        // SWIPE UP - open comments
        if (dy < -50 || vy < -0.5) {
          if (onSwipeUpRef.current) {
            onSwipeUpRef.current();
          }
          return;
        }

        // SWIPE DOWN - close modal (existing behavior)
        const dismissThreshold = SCREEN_HEIGHT / 3;
        if (dy > dismissThreshold || vy > 0.5) {
          closeWithAnimation();
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: () => {
        // Gesture interrupted by system - cancel any active horizontal swipe
        if (isHorizontalSwipeActiveRef.current && cubeProgressRef.current) {
          Animated.spring(cubeProgressRef.current, {
            toValue: 0,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }).start(() => {
            onCancelSwipeTransitionRef.current?.();
          });

          isHorizontalSwipeActiveRef.current = false;
          swipeDirectionRef.current = null;
          firstMoveSkippedRef.current = false;
        }
      },
    })
  ).current;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (sortTimerRef.current) {
        clearTimeout(sortTimerRef.current);
      }
    };
  }, []);

  return {
    // Mode
    mode,
    showProgressBar: mode === 'stories',

    // Current photo data
    currentPhoto,
    imageURL,
    capturedAt,
    displayName,
    username,
    profilePhotoURL,

    // Stories navigation
    currentIndex,
    totalPhotos: photos.length,
    handleTapNavigation,
    goPrev,
    goNext,

    // Animation
    translateY,
    opacity,
    panResponder,

    // Reactions
    groupedReactions,
    orderedEmojis,
    curatedEmojis,
    getUserReactionCount,
    handleEmojiPress,

    // Custom emoji picker
    customEmoji,
    setCustomEmoji,
    showEmojiPicker,
    setShowEmojiPicker,
    handleOpenEmojiPicker,
    handleEmojiPickerSelect,
    handleCustomEmojiConfirm,
    newlyAddedEmoji,

    // Close handler
    handleClose: onClose,

    // Comments visibility (for disabling swipe-to-dismiss during comment scroll)
    updateCommentsVisible,
  };
};
