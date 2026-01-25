/**
 * usePhotoDetailModal Hook
 *
 * Encapsulates all PhotoDetailModal logic:
 * - Animation values for swipe-to-dismiss
 * - PanResponder gesture handling
 * - Reaction state management
 * - Emoji ordering with frozen state during rapid taps
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';
import { reactionHaptic } from '../utils/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Available reaction emojis (8 options)
 */
const REACTION_EMOJIS = ['😂', '❤️', '🔥', '😍', '👏', '😮', '😢', '💯'];

/**
 * Custom hook for PhotoDetailModal logic
 *
 * @param {object} params - Hook parameters
 * @param {object} params.photo - Photo object with reactions and user data
 * @param {boolean} params.visible - Modal visibility state
 * @param {function} params.onClose - Callback to close modal
 * @param {function} params.onReactionToggle - Callback when emoji is toggled
 * @param {string} params.currentUserId - Current user's ID
 * @returns {object} Modal state and handlers
 */
export const usePhotoDetailModal = ({
  photo,
  visible,
  onClose,
  onReactionToggle,
  currentUserId,
}) => {
  // State to track if we should re-sort or freeze current order
  const [frozenOrder, setFrozenOrder] = useState(null);
  const sortTimerRef = useRef(null);

  // Animated values for swipe gesture
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Extract photo data
  const { imageURL, capturedAt, reactions = {}, user = {} } = photo || {};
  const { username, displayName, profilePhotoURL } = user;

  /**
   * Get grouped reactions (emoji -> count)
   */
  const groupedReactions = useMemo(() => {
    const grouped = {};
    Object.entries(reactions).forEach(([userId, userReactions]) => {
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
  }, [reactions]);

  /**
   * Get current user's reaction count for a specific emoji
   */
  const getUserReactionCount = useCallback(
    emoji => {
      if (!currentUserId || !reactions[currentUserId]) return 0;
      return reactions[currentUserId][emoji] || 0;
    },
    [currentUserId, reactions]
  );

  /**
   * Handle emoji button press
   */
  const handleEmojiPress = useCallback(
    emoji => {
      reactionHaptic();
      const currentCount = getUserReactionCount(emoji);
      onReactionToggle(emoji, currentCount);

      // If not frozen yet, freeze the current sorted order
      if (!frozenOrder) {
        const emojiData = REACTION_EMOJIS.map(e => ({
          emoji: e,
          totalCount: groupedReactions[e] || 0,
        }));
        const currentSortedOrder = [...emojiData]
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
    },
    [getUserReactionCount, onReactionToggle, frozenOrder, groupedReactions]
  );

  /**
   * Get ordered emoji list (frozen or sorted by count)
   */
  const orderedEmojis = useMemo(() => {
    if (frozenOrder) {
      return frozenOrder;
    }
    // Sort by count (highest to lowest)
    const emojiData = REACTION_EMOJIS.map(emoji => ({
      emoji,
      totalCount: groupedReactions[emoji] || 0,
    }));
    return [...emojiData].sort((a, b) => b.totalCount - a.totalCount).map(item => item.emoji);
  }, [frozenOrder, groupedReactions]);

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

  // Pan responder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: evt => {
        // Don't capture if touch is in footer area (bottom ~100px)
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        return touchY < footerThreshold;
      },
      onStartShouldSetPanResponderCapture: evt => {
        // Don't capture if touch is in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        return touchY < footerThreshold;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Don't respond if touch started in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        // Only respond to downward swipes (dy > 10) outside footer
        return gestureState.dy > 10 && touchY < footerThreshold;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Don't capture if touch is in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        // Capture gesture if it's a clear downward swipe outside footer
        return gestureState.dy > 10 && touchY < footerThreshold;
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
    // Photo data
    imageURL,
    capturedAt,
    displayName,
    username,
    profilePhotoURL,

    // Animation
    translateY,
    opacity,
    panResponder,

    // Reactions
    groupedReactions,
    orderedEmojis,
    getUserReactionCount,
    handleEmojiPress,

    // Close handler
    handleClose: onClose,
  };
};

export { REACTION_EMOJIS };
