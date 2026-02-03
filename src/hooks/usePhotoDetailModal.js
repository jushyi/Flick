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
import { Animated, PanResponder, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
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
  onFriendTransition, // Callback for friend-to-friend transition with cube animation
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
  // - Reset frozenOrder so emojis sort correctly by count for new photo (ISS-008 fix)
  // - Initialize activeCustomEmojis with any custom emojis already in the photo's reactions
  // ISS-009 fix: Read reactions directly from currentPhoto to avoid stale closure issue
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
   * ISS-009 fix: Read reactions directly from currentPhoto inside useMemo
   * and depend on currentPhoto instead of destructured reactions variable.
   * This ensures recalculation when photo changes, as React's dependency
   * comparison on the destructured variable was unreliable.
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
   * ISS-009 fix: Read from currentPhoto?.reactions directly for consistency
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          return true;
        }
      }
      return false;
    }

    const newIndex = currentIndex + 1;
    logger.debug('usePhotoDetailModal: Navigate next', { newIndex });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        // Left tap - previous
        if (!goPrev()) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onClose();
        }
      } else if (locationX > SCREEN_WIDTH * 0.7) {
        // Right tap - next
        if (!goNext()) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onClose();
        }
      }
      // Center 40% - no action (future: pause)
    },
    [mode, goPrev, goNext, onClose]
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

  /**
   * Pan responder for swipe-down-to-close gesture.
   * Excludes footer area (bottom 100px) to allow emoji taps.
   * Dismisses modal when swiped 1/3 of screen height or with velocity > 0.5.
   * UAT-028 fix: Better gesture detection - check vertical vs horizontal movement
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
        // Don't respond if touch started in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        if (touchY >= footerThreshold) return false;

        // UAT-028 fix: Check for vertical swipe (dy > dx) and downward movement
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const isDownward = gestureState.dy > 5;
        return isVerticalSwipe && isDownward;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Don't capture if touch is in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        if (touchY >= footerThreshold) return false;

        // UAT-028 fix: Capture gesture when vertical swipe is detected
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const isDownward = gestureState.dy > 5;
        return isVerticalSwipe && isDownward;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipes
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
          // Fade out as user swipes down
          const fadeAmount = Math.max(0, 1 - gestureState.dy / SCREEN_HEIGHT);
          opacity.setValue(fadeAmount);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 1/3 of screen or fast swipe (velocity), close the modal
        const dismissThreshold = SCREEN_HEIGHT / 3;
        if (gestureState.dy > dismissThreshold || gestureState.vy > 0.5) {
          closeWithAnimation();
        } else {
          springBack();
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
  };
};
