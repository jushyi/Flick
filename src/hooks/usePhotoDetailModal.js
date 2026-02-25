/**
 * usePhotoDetailModal Hook
 *
 * Encapsulates all PhotoDetailModal logic:
 * - Animation values for swipe-to-dismiss (RN Animated)
 * - PanResponder for vertical gestures (dismiss, comments)
 * - Gesture.Pan for horizontal swipe (friend-to-friend cube transitions)
 * - Reaction state management
 * - Emoji ordering with frozen state during rapid taps
 * - Stories mode: multi-photo navigation with progress bar
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Animated, PanResponder, Dimensions, Easing } from 'react-native';
import { Image } from 'expo-image';

import { Gesture } from 'react-native-gesture-handler';
import {
  withTiming,
  withSpring,
  Easing as ReanimatedEasing,
  runOnJS,
} from 'react-native-reanimated';

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
  cubeProgress, // Reanimated SharedValue from PhotoDetailScreen for interactive gesture tracking
  onPrepareSwipeTransition, // (direction) => boolean - prepare transition at drag start
  onCommitSwipeTransition, // () => void - complete transition after commit animation
  onCancelSwipeTransition, // () => void - cancel transition after spring-back animation
  // Next-friend prefetching
  onGetNextFriendPhotoURL, // () => string|null - returns next friend's first photo URL for prefetching
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

  // Auto-skip on load failure: if image doesn't load within 5 seconds, skip to next photo
  const LOAD_FAILURE_TIMEOUT = 5000; // ms
  const loadFailureTimeoutRef = useRef(null);

  // Minimum display time tracking for rapid taps (ensures each photo is briefly visible)
  const lastTapTimeRef = useRef(0);
  const MIN_DISPLAY_TIME = 30; // ms - minimum time each photo is displayed

  // Tap queue: instead of dropping rapid taps, defer them so every tap navigates
  const queuedTapRef = useRef(null); // timeout ID for pending deferred tap
  const queuedTapDirectionRef = useRef(null); // 'next' | 'prev' - direction of queued tap

  // Animated values for swipe gesture (RN Animated - stays for vertical gestures)
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current; // Start invisible to prevent first-frame flash

  // Expand/collapse animation values (RN Animated - stays unchanged)
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
    if (!visible) {
      hasAnimatedOpen.current = false;
      return;
    }
    if (hasAnimatedOpen.current) return;

    if (sourceTransform) {
      // Source rect available — play expand animation immediately
      hasAnimatedOpen.current = true;
      openProgress.setValue(0);
      opacity.setValue(0);
      dismissScale.setValue(1);
      suckTranslateX.setValue(0);
      translateY.setValue(0);

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
      return;
    }

    // sourceTransform null on this render — defer one frame.
    // If context state propagates (sourceRect arrives), the effect re-runs with
    // truthy sourceTransform before the rAF fires, cancels this, and plays the animation.
    // If sourceRect genuinely never comes, instant-show after one frame.
    const rafId = requestAnimationFrame(() => {
      if (!hasAnimatedOpen.current) {
        hasAnimatedOpen.current = true;
        openProgress.setValue(1);
        opacity.setValue(1);
      }
    });
    return () => cancelAnimationFrame(rafId);
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

  // Batch prefetch first few photos when stories open for instant initial swiping
  useEffect(() => {
    if (!visible || mode !== 'stories' || photos.length === 0) return;

    // Prefetch up to 3 photos after initialIndex (current photo loads via <Image> directly)
    const startIdx = initialIndex + 1;
    const endIdx = Math.min(startIdx + 3, photos.length);
    const urlsToPrefetch = [];

    for (let i = startIdx; i < endIdx; i++) {
      if (photos[i]?.imageURL) {
        urlsToPrefetch.push(photos[i].imageURL);
      }
    }

    if (urlsToPrefetch.length > 0) {
      Image.prefetch(urlsToPrefetch, 'memory-disk').catch(() => {});
      logger.debug('usePhotoDetailModal: Batch prefetched initial story photos', {
        initialIndex,
        count: urlsToPrefetch.length,
      });
    }
  }, [visible, mode]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally sparse: only run on open/close

  // Prefetch adjacent photos for smooth stories navigation
  useEffect(() => {
    if (mode !== 'stories' || !visible || photos.length === 0) return;

    const urlsToPrefetch = [];

    // Prefetch next 2 photos for rapid tapping
    if (currentIndex < photos.length - 1 && photos[currentIndex + 1]?.imageURL) {
      urlsToPrefetch.push(photos[currentIndex + 1].imageURL);
    }
    if (currentIndex < photos.length - 2 && photos[currentIndex + 2]?.imageURL) {
      urlsToPrefetch.push(photos[currentIndex + 2].imageURL);
    }

    if (urlsToPrefetch.length > 0) {
      Image.prefetch(urlsToPrefetch, 'memory-disk').catch(() => {});
    }
  }, [mode, visible, currentIndex, photos]);

  // Prefetch next friend's first photo when near the end of current friend's story
  useEffect(() => {
    if (mode !== 'stories' || !visible) return;
    if (currentIndex >= photos.length - 2 && onGetNextFriendPhotoURL) {
      const nextURL = onGetNextFriendPhotoURL();
      if (nextURL) {
        Image.prefetch(nextURL, 'memory-disk').catch(() => {});
        logger.debug('usePhotoDetailModal: Prefetched next friend first photo');
      }
    }
  }, [mode, visible, currentIndex, photos.length, onGetNextFriendPhotoURL]);

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

  // Reset frozen order and custom emoji state when navigating to a different photo
  useEffect(() => {
    if (currentPhoto?.id) {
      setFrozenOrder(null);
      setCustomEmoji(null);
    }
  }, [currentPhoto?.id]);

  // Update activeCustomEmojis when reactions change (picks up new custom emojis)
  // Separated from the photo-change effect so reaction updates don't reset frozenOrder
  useEffect(() => {
    if (currentPhoto?.id) {
      const photoReactions = currentPhoto?.reactions || {};
      const reactionEmojis = new Set();
      Object.values(photoReactions).forEach(userReactions => {
        if (typeof userReactions === 'object') {
          Object.keys(userReactions).forEach(emoji => reactionEmojis.add(emoji));
        }
      });
      const existingEmojis = [...reactionEmojis].filter(emoji => !curatedEmojis.includes(emoji));
      setActiveCustomEmojis(existingEmojis);
    }
  }, [currentPhoto?.id, currentPhoto?.reactions, curatedEmojis]);

  // Extract photo data from currentPhoto
  const { imageURL, capturedAt, reactions = {}, user = {} } = currentPhoto || {};
  const { username, displayName, profilePhotoURL, nameColor } = user;

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
      // userReactions is now an object: { '..': 2, '..': 1 }
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

      // Set new timer to unfreeze and allow re-sorting after 3 seconds of no taps
      sortTimerRef.current = setTimeout(() => {
        setFrozenOrder(null);
      }, 3000);

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
  /**
   * Clear any pending queued tap (used on close, transition, or new tap executing)
   */
  const clearQueuedTap = useCallback(() => {
    if (queuedTapRef.current) {
      clearTimeout(queuedTapRef.current);
      queuedTapRef.current = null;
      queuedTapDirectionRef.current = null;
    }
  }, []);

  const goPrev = useCallback(() => {
    if (mode !== 'stories') return false;

    // Check minimum display time for rapid tapping
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    if (timeSinceLastTap < MIN_DISPLAY_TIME) {
      // Queue this tap to fire after remaining wait time instead of dropping it
      clearQueuedTap();
      const remaining = MIN_DISPLAY_TIME - timeSinceLastTap;
      queuedTapDirectionRef.current = 'prev';
      queuedTapRef.current = setTimeout(() => {
        queuedTapRef.current = null;
        queuedTapDirectionRef.current = null;
        goPrev();
      }, remaining);
      return true; // Return true to prevent close
    }
    lastTapTimeRef.current = now;
    clearQueuedTap(); // Clear any pending queued tap

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
  }, [mode, currentIndex, photos, onPhotoChange, clearQueuedTap]);

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
      // Queue this tap to fire after remaining wait time instead of dropping it
      clearQueuedTap();
      const remaining = MIN_DISPLAY_TIME - timeSinceLastTap;
      queuedTapDirectionRef.current = 'next';
      queuedTapRef.current = setTimeout(() => {
        queuedTapRef.current = null;
        queuedTapDirectionRef.current = null;
        goNext();
      }, remaining);
      return true; // Return true to prevent close
    }
    lastTapTimeRef.current = now;
    clearQueuedTap(); // Clear any pending queued tap

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
  }, [mode, currentIndex, photos, onPhotoChange, onFriendTransition, clearQueuedTap]);

  /**
   * Clear the load failure timeout (called on successful load, manual navigation, unmount)
   */
  const clearLoadTimer = useCallback(() => {
    if (loadFailureTimeoutRef.current) {
      clearTimeout(loadFailureTimeoutRef.current);
      loadFailureTimeoutRef.current = null;
    }
  }, []);

  /**
   * Start the load failure timeout (auto-skips to next photo after LOAD_FAILURE_TIMEOUT ms)
   * Only active in stories mode — feed mode has no auto-skip behavior
   */
  const startLoadTimer = useCallback(() => {
    clearLoadTimer();
    if (mode !== 'stories') return;
    loadFailureTimeoutRef.current = setTimeout(() => {
      logger.warn('usePhotoDetailModal: Image load timeout, auto-skipping', {
        photoId: currentPhoto?.id,
      });
      goNext();
    }, LOAD_FAILURE_TIMEOUT);
  }, [clearLoadTimer, mode, goNext, currentPhoto?.id]);

  /**
   * Close modal with animation
   * Two-phase if sourceRect exists: settle (soft lock) -> suck-back to source
   * Fallback: simple slide-down + fade
   */
  const closeWithAnimation = useCallback(() => {
    clearQueuedTap(); // Cancel any pending tap navigation
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
  }, [translateY, opacity, openProgress, dismissScale, suckTranslateX, onClose, clearQueuedTap]);

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

  // Store callbacks in refs for panResponder/gesture access (created once, needs current values)
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

  // Track initial vertical direction so reversing mid-gesture doesn't trigger the opposite action
  const verticalDirectionRef = useRef(null); // null | 'down' | 'up'

  // Track if comments are visible (to disable swipe-to-dismiss when scrolling comments)
  const [commentsVisible, setCommentsVisible] = useState(false);
  const commentsVisibleRef = useRef(false);

  // Expose setter for parent to call when comments open/close
  const updateCommentsVisible = useCallback(isVisible => {
    commentsVisibleRef.current = isVisible;
    setCommentsVisible(isVisible);
  }, []);

  /**
   * Helper: prepare horizontal swipe transition (called from Gesture.Pan via runOnJS)
   */
  const prepareHorizontalSwipe = useCallback((direction, absDx) => {
    const hasCallback =
      direction === 'forward'
        ? onFriendTransitionRef.current
        : onPreviousFriendTransitionRef.current;
    if (!hasCallback || !onPrepareSwipeTransitionRef.current) return;

    const prepared = onPrepareSwipeTransitionRef.current(direction);
    if (!prepared) return;

    isHorizontalSwipeActiveRef.current = true;
    swipeDirectionRef.current = direction;
  }, []);

  /**
   * Helper: complete horizontal swipe (called from Gesture.Pan via runOnJS)
   */
  const completeHorizontalSwipe = useCallback((dx, vx) => {
    if (!isHorizontalSwipeActiveRef.current) return;

    const signedDx = swipeDirectionRef.current === 'forward' ? -dx : dx;
    const clampedDx = Math.max(0, signedDx);

    const signedVx = swipeDirectionRef.current === 'forward' ? -vx : vx;
    const forwardVx = Math.max(0, signedVx);

    const COMMIT_DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.25;
    const COMMIT_VELOCITY_THRESHOLD = 0.4;
    const shouldCommit =
      clampedDx > COMMIT_DISTANCE_THRESHOLD || forwardVx > COMMIT_VELOCITY_THRESHOLD;

    if (shouldCommit && cubeProgressRef.current) {
      cubeProgressRef.current.value = withTiming(
        1,
        {
          duration: 150,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
        },
        finished => {
          'worklet';
          if (finished) {
            runOnJS(function commitTransition() {
              onCommitSwipeTransitionRef.current?.();
            })();
          }
        }
      );
    } else if (cubeProgressRef.current) {
      cubeProgressRef.current.value = withSpring(
        0,
        {
          damping: 18,
          stiffness: 200,
        },
        finished => {
          'worklet';
          if (finished) {
            runOnJS(function cancelTransition() {
              onCancelSwipeTransitionRef.current?.();
            })();
          }
        }
      );
    }

    isHorizontalSwipeActiveRef.current = false;
    swipeDirectionRef.current = null;
  }, []);

  /**
   * Gesture.Pan for horizontal friend-to-friend swipe transitions.
   * Runs on the UI thread via react-native-gesture-handler.
   * Only activates on horizontal movement; fails on vertical to let PanResponder handle dismiss/comments.
   */
  const horizontalGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-15, 15]) // Only activate after 15px horizontal movement
      .failOffsetY([-10, 10]) // Fail (let PanResponder take over) if vertical movement > 10px
      .onStart(() => {
        'worklet';
        // Reset tracking state at gesture start
      })
      .onUpdate(event => {
        'worklet';
        const { translationX } = event;

        if (!isHorizontalSwipeActiveRef.current) {
          // First significant horizontal movement — prepare transition
          const direction = translationX < 0 ? 'forward' : 'backward';
          runOnJS(prepareHorizontalSwipe)(direction, Math.abs(translationX));
          return;
        }

        // Drive cube progress from gesture
        const signedDx = swipeDirectionRef.current === 'forward' ? -translationX : translationX;
        const adjustedDx = Math.max(0, signedDx - 15);
        const progress = Math.min(1, adjustedDx / SCREEN_WIDTH);
        if (cubeProgressRef.current) {
          cubeProgressRef.current.value = progress;
        }
      })
      .onEnd(event => {
        'worklet';
        if (!isHorizontalSwipeActiveRef.current) return;
        runOnJS(completeHorizontalSwipe)(event.translationX, event.velocityX);
      })
      .onFinalize(() => {
        'worklet';
        // Handle gesture cancellation — if still active, cancel via JS thread
        if (isHorizontalSwipeActiveRef.current) {
          runOnJS(completeHorizontalSwipe)(0, 0);
        }
      });
  }, [prepareHorizontalSwipe, completeHorizontalSwipe]);

  /**
   * Pan responder for VERTICAL swipe gestures only:
   * - Swipe DOWN: dismiss photo detail
   * - Swipe UP: open comments
   * Horizontal swipes are handled by Gesture.Pan (horizontalGesture) above.
   * Excludes footer area (bottom 100px) to allow emoji taps.
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

        // Only respond to vertical swipes — horizontal is handled by Gesture.Pan
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        if (isVerticalSwipe) {
          const isDownward = gestureState.dy > 5;
          const isUpward = gestureState.dy < -10;
          return isDownward || isUpward;
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

        // Only capture vertical swipes — horizontal is handled by Gesture.Pan
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        if (isVerticalSwipe) {
          const isDownward = gestureState.dy > 5;
          const isUpward = gestureState.dy < -10;
          return isDownward || isUpward;
        }

        return false;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dy } = gestureState;

        // Record initial vertical direction on first move
        if (verticalDirectionRef.current === null) {
          verticalDirectionRef.current = dy > 0 ? 'down' : 'up';
        }

        // VERTICAL - only apply dismiss effects for downward gestures
        if (verticalDirectionRef.current === 'down') {
          const clampedDy = Math.max(0, dy);
          translateY.setValue(clampedDy);
          const dragRatio = Math.min(1, clampedDy / SCREEN_HEIGHT);
          dismissScale.setValue(1 - dragRatio * 0.15);
          const fadeAmount = Math.max(0, 1 - dragRatio * 0.8);
          opacity.setValue(fadeAmount);
        }
        // Swipe-up: no visual tracking needed (commits on release)
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        const gestureDir = verticalDirectionRef.current;

        // Reset vertical direction for next gesture
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
        // Gesture interrupted by system - reset vertical direction
        verticalDirectionRef.current = null;
      },
    })
  ).current;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (sortTimerRef.current) {
        clearTimeout(sortTimerRef.current);
      }
      clearQueuedTap();
      clearLoadTimer();
    };
  }, [clearQueuedTap, clearLoadTimer]);

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
    nameColor,

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

    // Close handler (animated)
    handleClose: closeWithAnimation,

    // Comments visibility (for disabling swipe-to-dismiss during comment scroll)
    updateCommentsVisible,

    // Horizontal gesture for friend-to-friend swipe (Gesture.Pan)
    horizontalGesture,

    // Load failure timer (for auto-skip on image load timeout)
    startLoadTimer,
    clearLoadTimer,
  };
};
