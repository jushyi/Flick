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
  sourceRect, // Source card position for expand/collapse animation { x, y, width, height, borderRadius }
  // Interactive swipe support
  cubeProgress, // Animated.Value from PhotoDetailScreen for interactive gesture tracking
  onPrepareSwipeTransition, // (direction) => boolean - prepare transition at drag start
  onCommitSwipeTransition, // () => void - complete transition after commit animation
  onCancelSwipeTransition, // () => void - cancel transition after spring-back animation
}) => {
  // Stories mode: current photo index
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Immediately sync currentIndex when photos array changes (friend transition).
  // Uses React's "adjust state during render" pattern so the very first render
  // after a friend transition already has the correct index, eliminating a
  // stale-index frame where photos[oldIndex] could show the wrong photo.
  const [prevPhotosKey, setPrevPhotosKey] = useState(photos);
  if (photos !== prevPhotosKey) {
    setPrevPhotosKey(photos);
    const validIndex = Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1));
    setCurrentIndex(validIndex);
  }

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
  const MIN_DISPLAY_TIME = 30; // ms - minimum time each photo is displayed

  // Animated values for swipe gesture
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current; // Start invisible to prevent first-frame flash

  // Expand/collapse animation values
  const openProgress = useRef(new Animated.Value(0)).current; // 0=source, 1=full-screen (start at source)
  const dismissScale = useRef(new Animated.Value(1)).current; // shrinks during dismiss drag
  const suckTranslateX = useRef(new Animated.Value(0)).current; // X offset for suck-back
  const animatedBorderRadius = useRef(new Animated.Value(0)).current; // JS-driven, non-native

  // Source rect ref for close animation (stable across re-renders)
  const sourceRectRef = useRef(sourceRect);
  sourceRectRef.current = sourceRect;

  // Compute source transform from sourceRect
  const sourceTransform = useMemo(() => {
    if (!sourceRect) return null;
    const scaleX = sourceRect.width / SCREEN_WIDTH;
    const scaleY = sourceRect.height / SCREEN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const sourceCenterX = sourceRect.x + sourceRect.width / 2;
    const sourceCenterY = sourceRect.y + sourceRect.height / 2;
    return {
      scale,
      translateX: sourceCenterX - SCREEN_WIDTH / 2,
      translateY: sourceCenterY - SCREEN_HEIGHT / 2,
      borderRadius: sourceRect.borderRadius || 0,
    };
  }, [sourceRect]);

  // Opening animation - expand from source card to full screen
  const hasAnimatedOpen = useRef(false);
  useEffect(() => {
    if (visible && sourceTransform && !hasAnimatedOpen.current) {
      hasAnimatedOpen.current = true;
      // Start at source position
      openProgress.setValue(0);
      opacity.setValue(0);
      dismissScale.setValue(1);
      suckTranslateX.setValue(0);
      translateY.setValue(0);

      // Spring to full screen immediately
      Animated.parallel([
        Animated.spring(openProgress, {
          toValue: 1,
          tension: 180,
          friction: 16,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (visible && !sourceTransform && !hasAnimatedOpen.current) {
      // No source rect - instant show
      hasAnimatedOpen.current = true;
      openProgress.setValue(1);
      opacity.setValue(1);
    }
    if (!visible) {
      hasAnimatedOpen.current = false;
    }
  }, [visible, sourceTransform]);

  // Reset index when modal opens or initialIndex changes
  useEffect(() => {
    if (visible && mode === 'stories') {
      const validIndex = Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1));
      setCurrentIndex(validIndex);
      // Note: translateY/opacity resets handled by opening animation useEffect above
      logger.debug('usePhotoDetailModal: Stories mode opened', {
        photoCount: photos.length,
        startingIndex: validIndex,
      });
    }
  }, [visible, initialIndex, photos.length, mode]);

  // Derive current photo based on mode
  // Clamp index to valid range to prevent null during friend transitions
  // (new photos array may be shorter than old currentIndex before useEffect syncs)
  const currentPhoto = useMemo(() => {
    if (mode === 'stories') {
      if (photos.length === 0) return null;
      const safeIndex = Math.min(currentIndex, photos.length - 1);
      return photos[safeIndex] || null;
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
   * Close modal with animation
   * Two-phase if sourceRect exists: settle (soft lock) → suck-back to source
   * Fallback: simple slide-down + fade
   */
  const closeWithAnimation = useCallback(() => {
    const source = sourceRectRef.current;
    const transform = source
      ? {
          scale: Math.min(source.width / SCREEN_WIDTH, source.height / SCREEN_HEIGHT),
          translateX: source.x + source.width / 2 - SCREEN_WIDTH / 2,
          translateY: source.y + source.height / 2 - SCREEN_HEIGHT / 2,
          borderRadius: source.borderRadius || 0,
        }
      : null;

    const resetAll = () => {
      setTimeout(() => {
        translateY.setValue(0);
        opacity.setValue(0); // Keep invisible — screen is unmounting
        openProgress.setValue(0); // Keep at source — screen is unmounting
        dismissScale.setValue(1);
        suckTranslateX.setValue(0);
      }, 100);
    };

    if (!transform) {
      // Fallback: slide down + fade
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
        resetAll();
      });
      return;
    }

    // Suck-back — fast ease-in to source position
    const suckDuration = 200;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: transform.translateY,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(suckTranslateX, {
        toValue: transform.translateX,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dismissScale, {
        toValue: transform.scale,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: suckDuration,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      resetAll();
    });
  }, [translateY, opacity, openProgress, dismissScale, suckTranslateX, onClose]);

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
          closeWithAnimation();
        }
      } else if (locationX > SCREEN_WIDTH * 0.7) {
        // Right tap - next
        if (!goNext()) {
          closeWithAnimation();
        }
      }
      // Center 40% - no action (future: pause)
    },
    [mode, goPrev, goNext, closeWithAnimation, onPreviousFriendTransition]
  );

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
      Animated.spring(dismissScale, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity, dismissScale]);

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

  // Gesture axis lock - once a gesture is determined to be vertical or horizontal,
  // it stays locked for the entire gesture to prevent conflicts from diagonal finger movement
  const gestureLockRef = useRef(null); // null | 'vertical' | 'horizontal'

  // Track initial vertical direction so reversing mid-gesture doesn't trigger the opposite action
  const verticalDirectionRef = useRef(null); // null | 'down' | 'up'

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
        const isLeftSwipe = gestureState.dx < -10;
        const isRightSwipe = gestureState.dx > 10;
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
        const isLeftSwipe = gestureState.dx < -10;
        const isRightSwipe = gestureState.dx > 10;
        if (isHorizontalSwipe && (isLeftSwipe || isRightSwipe)) {
          const hasNext = isLeftSwipe && onFriendTransitionRef.current;
          const hasPrev = isRightSwipe && onPreviousFriendTransitionRef.current;
          return !!(hasNext || hasPrev);
        }

        return false;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;

        // HORIZONTAL - interactive cube tracking (already locked)
        if (isHorizontalSwipeActiveRef.current) {
          // Drive cubeProgress using signed displacement in the original swipe direction
          // so reversing past origin clamps to 0 instead of driving the cube backwards.
          // Offset by detection threshold (10px) so cube starts smoothly from 0.
          const signedDx = swipeDirectionRef.current === 'forward' ? -dx : dx;
          const adjustedDx = Math.max(0, signedDx - 10);
          const progress = Math.min(1, adjustedDx / SCREEN_WIDTH);
          if (cubeProgressRef.current) {
            cubeProgressRef.current.setValue(progress);
          }
          return;
        }

        // If already locked to vertical, skip horizontal detection
        if (gestureLockRef.current === 'vertical') {
          if (verticalDirectionRef.current === 'down') {
            // Swipe-down dismiss: clamp so reversing above origin resets to resting state
            const clampedDy = Math.max(0, dy);
            translateY.setValue(clampedDy);
            const dragRatio = Math.min(1, clampedDy / SCREEN_HEIGHT);
            dismissScale.setValue(1 - dragRatio * 0.15);
            const fadeAmount = Math.max(0, 1 - dragRatio * 0.8);
            opacity.setValue(fadeAmount);
          }
          // Swipe-up: no visual tracking needed (commits on release)
          return;
        }

        // If already locked to horizontal, only handle horizontal (waiting for prepare)
        if (gestureLockRef.current === 'horizontal') {
          return;
        }

        // No lock yet - determine axis from first significant movement
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Check if this should be an interactive horizontal swipe
        const isHorizontalGesture = absDx > absDy && absDx > 10;
        if (isHorizontalGesture) {
          gestureLockRef.current = 'horizontal';

          const direction = dx < 0 ? 'forward' : 'backward';

          // Check if transition callback is available
          const hasCallback =
            direction === 'forward'
              ? onFriendTransitionRef.current
              : onPreviousFriendTransitionRef.current;
          if (!hasCallback || !onPrepareSwipeTransitionRef.current) {
            gestureLockRef.current = null; // Reset lock - allow re-evaluation on next move
            return;
          }

          // Prepare transition (freezes snapshot, loads next friend data)
          const prepared = onPrepareSwipeTransitionRef.current(direction);
          if (!prepared) {
            gestureLockRef.current = null; // Reset lock - allow re-evaluation on next move
            return;
          }

          isHorizontalSwipeActiveRef.current = true;
          swipeDirectionRef.current = direction;

          // Immediately drive cubeProgress (offset by threshold so it starts at 0)
          const adjustedDx = Math.max(0, absDx - 10);
          const progress = Math.min(1, adjustedDx / SCREEN_WIDTH);
          if (cubeProgressRef.current) {
            cubeProgressRef.current.setValue(progress);
          }
          return;
        }

        // Vertical gesture detected - lock it and record initial direction
        if (absDy > absDx && absDy > 5) {
          gestureLockRef.current = 'vertical';
          verticalDirectionRef.current = dy > 0 ? 'down' : 'up';
        }

        // VERTICAL - only apply dismiss effects for downward gestures
        if (gestureLockRef.current === 'vertical' && verticalDirectionRef.current === 'down') {
          const clampedDy = Math.max(0, dy);
          translateY.setValue(clampedDy);
          const dragRatio = Math.min(1, clampedDy / SCREEN_HEIGHT);
          dismissScale.setValue(1 - dragRatio * 0.15);
          const fadeAmount = Math.max(0, 1 - dragRatio * 0.8);
          opacity.setValue(fadeAmount);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy, vx, vy } = gestureState;

        // HORIZONTAL SWIPES - interactive cube transition
        if (isHorizontalSwipeActiveRef.current) {
          // Use signed displacement in original direction (negative = reversed past origin)
          const signedDx = swipeDirectionRef.current === 'forward' ? -dx : dx;
          const clampedDx = Math.max(0, signedDx);
          const currentProgress = Math.min(1, clampedDx / SCREEN_WIDTH);

          // Only use velocity in the original swipe direction for commit check
          const signedVx = swipeDirectionRef.current === 'forward' ? -vx : vx;
          const forwardVx = Math.max(0, signedVx);

          const COMMIT_DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.25;
          const COMMIT_VELOCITY_THRESHOLD = 0.4;
          const shouldCommit =
            clampedDx > COMMIT_DISTANCE_THRESHOLD || forwardVx > COMMIT_VELOCITY_THRESHOLD;

          if (shouldCommit && cubeProgressRef.current) {
            // Commit: animate remaining distance to 1
            const remainingDistance = 1 - currentProgress;
            const baseDuration = remainingDistance * 220;
            const velocityFactor = Math.max(0.25, 1 - forwardVx * 0.4);
            const duration = Math.max(60, Math.min(180, baseDuration * velocityFactor));

            Animated.timing(cubeProgressRef.current, {
              toValue: 1,
              duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(() => {
              onCommitSwipeTransitionRef.current?.();
            });
          } else if (cubeProgressRef.current) {
            // Cancel: spring back to 0
            Animated.spring(cubeProgressRef.current, {
              toValue: 0,
              tension: 150,
              friction: 12,
              useNativeDriver: true,
            }).start(() => {
              onCancelSwipeTransitionRef.current?.();
            });
          }

          // Reset horizontal gesture state
          isHorizontalSwipeActiveRef.current = false;
          swipeDirectionRef.current = null;
          gestureLockRef.current = null;
          verticalDirectionRef.current = null;
          return;
        }

        const gestureDir = verticalDirectionRef.current;

        // Reset gesture lock for next gesture
        gestureLockRef.current = null;
        verticalDirectionRef.current = null;

        // SWIPE UP - open comments (only if gesture started upward)
        if (gestureDir === 'up' && (dy < -50 || vy < -0.5)) {
          if (onSwipeUpRef.current) {
            onSwipeUpRef.current();
          }
          return;
        }

        // SWIPE DOWN - close modal (only if gesture started downward)
        if (gestureDir === 'down') {
          const dismissThreshold = SCREEN_HEIGHT / 3;
          if (dy > dismissThreshold || vy > 0.5) {
            closeWithAnimation();
          } else {
            springBack();
          }
          return;
        }

        // Fallback: spring back if direction unclear
        springBack();
      },
      onPanResponderTerminate: () => {
        // Gesture interrupted by system - reset all locks
        gestureLockRef.current = null;
        verticalDirectionRef.current = null;

        // Cancel any active horizontal swipe
        if (isHorizontalSwipeActiveRef.current && cubeProgressRef.current) {
          Animated.spring(cubeProgressRef.current, {
            toValue: 0,
            tension: 150,
            friction: 12,
            useNativeDriver: true,
          }).start(() => {
            onCancelSwipeTransitionRef.current?.();
          });

          isHorizontalSwipeActiveRef.current = false;
          swipeDirectionRef.current = null;
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

    // Expand/collapse animation
    openProgress,
    dismissScale,
    suckTranslateX,
    animatedBorderRadius,
    sourceTransform,

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
