import React, { useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Thresholds for action triggers
const HORIZONTAL_THRESHOLD = 100;
// Delete overlay threshold (used for button-triggered animation overlay only)
const DELETE_OVERLAY_THRESHOLD = 150;

// Exit animation configuration (UAT-008: increased from 250ms for more visible arc motion)
const EXIT_DURATION = 400;

// UAT-016: Button-triggered animations use slower duration for satisfying pace
// Swipe gestures have natural lead-in time from drag, but button taps are instant
// 1200ms (3x EXIT_DURATION) gives button animations similar perceived pace to swipes
const BUTTON_EXIT_DURATION = 1200;

/**
 * SwipeablePhotoCard - Flick-style swipeable card for photo triage
 *
 * Features:
 * - Arc motion: Card curves downward as it moves horizontally (like flicking from wrist)
 * - Rotation: Card tilts in direction of swipe
 * - On-card overlays: Color overlays with icons fade in during swipe
 * - Three-stage haptic feedback: threshold, release, completion
 * - Spring-back animation when threshold not met
 * - Imperative methods for button-triggered animations
 *
 * Swipe directions:
 * - Left swipe → Archive (gray overlay, box icon)
 * - Right swipe → Journal (green overlay, checkmark icon)
 * - Delete via button only (down-swipe disabled to prevent accidental deletions)
 *
 * @param {object} photo - Photo object to display
 * @param {function} onSwipeLeft - Callback when Archive action triggered (left swipe or button)
 * @param {function} onSwipeRight - Callback when Journal action triggered (right swipe or button)
 * @param {function} onSwipeDown - Callback when Delete action triggered (button only)
 * @param {number} stackIndex - Position in the stack (0=front, 1=behind, 2=furthest back)
 * @param {boolean} isActive - Whether this card is swipeable (only front card)
 * @param {ref} ref - Ref for imperative methods (triggerArchive, triggerJournal, triggerDelete)
 */
const SwipeablePhotoCard = forwardRef(({ photo, onSwipeLeft, onSwipeRight, onSwipeDown, onSwipeStart, stackIndex = 0, isActive = true, cascading = false }, ref) => {
  const [thresholdTriggered, setThresholdTriggered] = useState(false);

  // Animated values for gesture/front card
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  // Helper functions for stack styling (UAT-006, UAT-009, UAT-011)
  // Cards peek from TOP (negative Y = above front card)
  const getStackScale = (idx) => idx === 0 ? 1 : idx === 1 ? 0.96 : 0.92;
  const getStackOffset = (idx) => idx === 0 ? 0 : idx === 1 ? -20 : -40; // Negative = above
  const getStackOpacity = (idx) => idx === 0 ? 1 : idx === 1 ? 0.85 : 0.7;
  // UAT-011, UAT-013: Blur overlay opacity for depth-of-field effect on stack cards
  // Front card (0) = no overlay, stack cards have increasing blur intensity
  // Increased values for more visible depth effect (0.15→0.25, 0.30→0.45)
  const getStackBlurOpacity = (idx) => idx === 0 ? 0 : idx === 1 ? 0.25 : 0.45;

  // Animated values for smooth stack cascade animation (UAT-009, UAT-011)
  // These animate when stackIndex changes (card moves forward in stack)
  const stackScaleAnim = useSharedValue(getStackScale(stackIndex));
  const stackOffsetAnim = useSharedValue(getStackOffset(stackIndex));
  const stackOpacityAnim = useSharedValue(getStackOpacity(stackIndex));
  // UAT-011: Animated blur overlay opacity (fades out as card moves to front)
  const stackBlurOpacityAnim = useSharedValue(getStackBlurOpacity(stackIndex));

  // Animate stack values when stackIndex changes (card moves forward)
  useEffect(() => {
    stackScaleAnim.value = withSpring(getStackScale(stackIndex), { damping: 15, stiffness: 150 });
    stackOffsetAnim.value = withSpring(getStackOffset(stackIndex), { damping: 15, stiffness: 150 });
    stackOpacityAnim.value = withSpring(getStackOpacity(stackIndex), { damping: 15, stiffness: 150 });
    // UAT-011: Animate blur overlay opacity (fades out as card moves to front)
    stackBlurOpacityAnim.value = withSpring(getStackBlurOpacity(stackIndex), { damping: 15, stiffness: 150 });
  }, [stackIndex]);

  // UAT-012: When cascading=true, animate stack cards forward one position
  // This happens DURING the front card's exit animation, not after
  useEffect(() => {
    if (cascading && !isActive && stackIndex > 0) {
      // Animate to the position one step forward (e.g., stackIndex 1 → position 0)
      const targetIndex = stackIndex - 1;
      stackScaleAnim.value = withSpring(getStackScale(targetIndex), { damping: 15, stiffness: 150 });
      stackOffsetAnim.value = withSpring(getStackOffset(targetIndex), { damping: 15, stiffness: 150 });
      stackOpacityAnim.value = withSpring(getStackOpacity(targetIndex), { damping: 15, stiffness: 150 });
      stackBlurOpacityAnim.value = withSpring(getStackBlurOpacity(targetIndex), { damping: 15, stiffness: 150 });
    }
  }, [cascading]);

  // Track if action is in progress to prevent multiple triggers
  const actionInProgress = useSharedValue(false);

  // Context for gesture start position
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Haptic feedback helpers
  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const triggerMediumHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const triggerHeavyHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, []);

  const triggerWarningHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, []);

  // Reset threshold state
  const resetThreshold = useCallback(() => {
    setThresholdTriggered(false);
  }, []);

  // Mark threshold as triggered
  const markThresholdTriggered = useCallback(() => {
    if (!thresholdTriggered) {
      setThresholdTriggered(true);
      triggerLightHaptic();
      logger.debug('SwipeablePhotoCard: Threshold reached', { photoId: photo?.id });
    }
  }, [thresholdTriggered, triggerLightHaptic, photo?.id]);

  // UAT-012: Notify parent when swipe starts (triggers cascade animation)
  const notifySwipeStart = useCallback(() => {
    if (onSwipeStart) {
      onSwipeStart();
    }
  }, [onSwipeStart]);

  // Action handlers
  const handleArchive = useCallback(async () => {
    logger.info('SwipeablePhotoCard: Archive action triggered', { photoId: photo?.id });
    triggerMediumHaptic();
    if (onSwipeLeft) {
      await onSwipeLeft();
    }
    triggerHeavyHaptic();
  }, [photo?.id, onSwipeLeft, triggerMediumHaptic, triggerHeavyHaptic]);

  const handleJournal = useCallback(async () => {
    logger.info('SwipeablePhotoCard: Journal action triggered', { photoId: photo?.id });
    triggerMediumHaptic();
    if (onSwipeRight) {
      await onSwipeRight();
    }
    triggerHeavyHaptic();
  }, [photo?.id, onSwipeRight, triggerMediumHaptic, triggerHeavyHaptic]);

  const handleDelete = useCallback(async () => {
    logger.info('SwipeablePhotoCard: Delete action triggered', { photoId: photo?.id });
    triggerWarningHaptic();
    if (onSwipeDown) {
      await onSwipeDown();
    }
    triggerHeavyHaptic();
  }, [photo?.id, onSwipeDown, triggerWarningHaptic, triggerHeavyHaptic]);

  // Imperative methods for button-triggered animations (UAT-003)
  // UAT-012: Removed opacity fade - card stays opaque while flying off screen
  // This prevents blocking the view of cards behind during exit animation
  useImperativeHandle(ref, () => ({
    // Trigger archive animation (same as left swipe but slower for button)
    // UAT-016: Button animations use BUTTON_EXIT_DURATION (1200ms) for satisfying pace
    triggerArchive: () => {
      if (actionInProgress.value) return;
      logger.info('SwipeablePhotoCard: triggerArchive called', { photoId: photo?.id });
      actionInProgress.value = true;
      // Animate to archive position (arc to bottom-left)
      // Card stays opaque - flies off screen without fading
      translateX.value = withTiming(-SCREEN_WIDTH * 1.5, {
        duration: BUTTON_EXIT_DURATION,
        easing: Easing.out(Easing.cubic),
      }, () => {
        'worklet';
        runOnJS(handleArchive)();
      });
      translateY.value = withTiming(SCREEN_HEIGHT * 0.5, {
        duration: BUTTON_EXIT_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    },
    // Trigger journal animation (same as right swipe but slower for button)
    // UAT-016: Button animations use BUTTON_EXIT_DURATION (1200ms) for satisfying pace
    triggerJournal: () => {
      if (actionInProgress.value) return;
      logger.info('SwipeablePhotoCard: triggerJournal called', { photoId: photo?.id });
      actionInProgress.value = true;
      // Animate to journal position (arc to bottom-right)
      // Card stays opaque - flies off screen without fading
      translateX.value = withTiming(SCREEN_WIDTH * 1.5, {
        duration: BUTTON_EXIT_DURATION,
        easing: Easing.out(Easing.cubic),
      }, () => {
        'worklet';
        runOnJS(handleJournal)();
      });
      translateY.value = withTiming(SCREEN_HEIGHT * 0.5, {
        duration: BUTTON_EXIT_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    },
    // Trigger delete animation (drop straight down)
    // UAT-016: Button animations use BUTTON_EXIT_DURATION (1200ms) for satisfying pace
    triggerDelete: () => {
      if (actionInProgress.value) return;
      logger.info('SwipeablePhotoCard: triggerDelete called', { photoId: photo?.id });
      actionInProgress.value = true;
      // Animate to delete position (drop down)
      // Card stays opaque - flies off screen without fading
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: BUTTON_EXIT_DURATION,
        easing: Easing.out(Easing.cubic),
      }, () => {
        'worklet';
        runOnJS(handleDelete)();
      });
    },
  }), [photo?.id, actionInProgress, translateX, translateY, handleArchive, handleJournal, handleDelete]);

  // Pan gesture using new Gesture API
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = translateX.value;
      // startY not tracked - card follows fixed arc path based on X only (UAT-001)
      runOnJS(resetThreshold)();
    })
    .onUpdate((event) => {
      'worklet';
      // Only track horizontal finger position - card follows fixed arc path (UAT-001)
      // translateY is not tracked during gesture; arc effect is applied in cardStyle
      translateX.value = startX.value + event.translationX;
      // translateY stays at 0 during gesture; the visual arc comes from arcY calculation in cardStyle

      // Check if horizontal threshold is reached
      const absX = Math.abs(translateX.value);

      if (absX > HORIZONTAL_THRESHOLD) {
        runOnJS(markThresholdTriggered)();
      }
    })
    .onEnd((event) => {
      'worklet';
      if (actionInProgress.value) return;

      const velocityX = event.velocityX;

      // Determine action based on horizontal position and velocity only
      // Down-swipe delete gesture REMOVED to prevent accidental deletions (UAT-002)
      const isLeftSwipe = translateX.value < -HORIZONTAL_THRESHOLD || velocityX < -500;
      const isRightSwipe = translateX.value > HORIZONTAL_THRESHOLD || velocityX > 500;

      if (isLeftSwipe) {
        // Archive (left swipe) - arc to bottom-left
        // UAT-012: Card stays opaque - flies off screen without fading
        // Notify parent to start cascade animation on stack cards
        runOnJS(notifySwipeStart)();
        actionInProgress.value = true;
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        }, () => {
          'worklet';
          runOnJS(handleArchive)();
        });
        translateY.value = withTiming(SCREEN_HEIGHT * 0.5, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        });
      } else if (isRightSwipe) {
        // Journal (right swipe) - arc to bottom-right
        // UAT-012: Card stays opaque - flies off screen without fading
        // Notify parent to start cascade animation on stack cards
        runOnJS(notifySwipeStart)();
        actionInProgress.value = true;
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        }, () => {
          'worklet';
          runOnJS(handleJournal)();
        });
        translateY.value = withTiming(SCREEN_HEIGHT * 0.5, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        // Spring back to center
        translateX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        runOnJS(resetThreshold)();
      }
    });

  // Animated card style with FIXED arc motion, rotation, and stack transforms (UAT-001, UAT-005, UAT-006, UAT-009)
  // Card follows a mathematically consistent arc path regardless of finger movement
  // Stack cards use animated shared values that spring-animate when stackIndex changes
  const cardStyle = useAnimatedStyle(() => {
    // Fixed arc formula: y = 0.4 * |x| creates consistent downward curve
    // regardless of vertical finger position during gesture
    const arcY = Math.abs(translateX.value) * 0.4;

    // Rotation based on horizontal movement (degrees) - only for front card
    const rotation = isActive ? translateX.value / 15 : 0;

    // For front card: apply gesture transforms
    // For stack cards: use animated shared values (these spring-animate via useEffect on stackIndex change)
    if (isActive) {
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value + arcY },
          { rotate: `${rotation}deg` },
          { scale: 1 },
        ],
        opacity: cardOpacity.value,
      };
    } else {
      // Stack cards animate smoothly when stackIndex changes (UAT-009)
      // stackOffsetAnim animates from -40 → -20 → 0 (slides DOWN to front position)
      // stackScaleAnim animates from 0.92 → 0.96 → 1.0 (grows to full size)
      // stackOpacityAnim animates from 0.7 → 0.85 → 1.0 (brightens)
      return {
        transform: [
          { translateX: 0 },
          { translateY: stackOffsetAnim.value },
          { rotate: '0deg' },
          { scale: stackScaleAnim.value },
        ],
        opacity: stackOpacityAnim.value,
      };
    }
  });

  // Archive overlay (left swipe) - gray with box icon
  const archiveOverlayStyle = useAnimatedStyle(() => {
    const opacity = translateX.value < 0
      ? interpolate(Math.abs(translateX.value), [0, HORIZONTAL_THRESHOLD], [0, 0.7], 'clamp')
      : 0;

    return {
      opacity,
    };
  });

  // Journal overlay (right swipe) - green with checkmark icon
  const journalOverlayStyle = useAnimatedStyle(() => {
    const opacity = translateX.value > 0
      ? interpolate(translateX.value, [0, HORIZONTAL_THRESHOLD], [0, 0.7], 'clamp')
      : 0;

    return {
      opacity,
    };
  });

  // Delete overlay (button-triggered animation) - red with X icon
  const deleteOverlayStyle = useAnimatedStyle(() => {
    const opacity = translateY.value > 0
      ? interpolate(translateY.value, [0, DELETE_OVERLAY_THRESHOLD], [0, 0.7], 'clamp')
      : 0;

    return {
      opacity,
    };
  });

  // UAT-011: Stack blur overlay - creates depth-of-field effect on background cards
  // Semi-transparent dark overlay that fades out as card moves to front position
  const stackBlurOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: stackBlurOpacityAnim.value,
    };
  });

  if (!photo || !photo.imageURL) {
    logger.warn('SwipeablePhotoCard: Missing photo or imageURL', { photo });
    return null;
  }

  // Stack z-index: front card has highest z (3 - stackIndex)
  const zIndex = 3 - stackIndex;

  // Card content (shared between active and stack cards)
  const cardContent = (
    <Animated.View
      style={[
        styles.cardContainer,
        cardStyle,
        { zIndex },
        // Stack cards have no pointer events (UAT-005)
        !isActive && { pointerEvents: 'none' },
      ]}
    >
      {/* Photo Image */}
      {/* UAT-010: Added fadeDuration={0} to prevent gray flash during cascade animation */}
      {/* The stack cards already have images loaded, but Android's default Image fade-in */}
      {/* causes a brief gray flash when the card moves to front position. */}
      <Image
        source={{ uri: photo.imageURL }}
        style={styles.photoImage}
        resizeMode="cover"
        fadeDuration={0}
        onError={(error) =>
          logger.error('SwipeablePhotoCard: Image load error', {
            photoId: photo.id,
            error: error.nativeEvent.error,
          })
        }
        onLoad={() =>
          logger.debug('SwipeablePhotoCard: Image loaded successfully', {
            photoId: photo.id,
          })
        }
      />

      {/* UAT-011: Stack blur overlay - depth-of-field effect on background cards */}
      {/* Semi-transparent dark overlay that fades out during cascade animation */}
      {!isActive && (
        <Animated.View style={[styles.stackBlurOverlay, stackBlurOverlayStyle]} />
      )}

      {/* Archive Overlay (Left swipe) - only show on active card */}
      {isActive && (
        <Animated.View style={[styles.overlay, styles.archiveOverlay, archiveOverlayStyle]}>
          <View style={styles.iconContainer}>
            <View style={styles.boxIcon}>
              <View style={styles.boxIconInner} />
            </View>
          </View>
          <Text style={styles.overlayText}>Archive</Text>
        </Animated.View>
      )}

      {/* Journal Overlay (Right swipe) - only show on active card */}
      {isActive && (
        <Animated.View style={[styles.overlay, styles.journalOverlay, journalOverlayStyle]}>
          <View style={styles.iconContainer}>
            <View style={styles.checkmarkCircle}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          </View>
          <Text style={styles.overlayText}>Journal</Text>
        </Animated.View>
      )}

      {/* Delete Overlay (button-triggered) - only show on active card */}
      {isActive && (
        <Animated.View style={[styles.overlay, styles.deleteOverlay, deleteOverlayStyle]}>
          <View style={styles.iconContainer}>
            <View style={styles.xIcon}>
              <View style={[styles.xLine, styles.xLine1]} />
              <View style={[styles.xLine, styles.xLine2]} />
            </View>
          </View>
          <Text style={styles.overlayText}>Delete</Text>
        </Animated.View>
      )}
    </Animated.View>
  );

  // Only wrap in GestureDetector for active (swipeable) card
  if (isActive) {
    return <GestureDetector gesture={panGesture}>{cardContent}</GestureDetector>;
  }

  // Stack cards (not swipeable) - render directly
  return cardContent;
});

const styles = StyleSheet.create({
  cardContainer: {
    // Absolute positioning for stacking cards on top of each other (UAT-005)
    position: 'absolute',
    width: SCREEN_WIDTH * 0.92,
    alignSelf: 'center',
    // UAT-014: Reduced border radius from 24 to 6 for subtler rounded corners
    borderRadius: 6,
    // UAT-012: Black background matches screen, prevents gray flash during cascade
    backgroundColor: '#000000',
    overflow: 'hidden',
    // UAT-007: Black border removed per user request
    // iOS-style shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  photoImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    // UAT-010, UAT-012: Black background matches screen, prevents gray flash
    // during cascade animation if image needs brief moment to render
    backgroundColor: '#000000',
  },
  // UAT-011, UAT-013: Stack blur overlay for depth-of-field effect on background cards
  // z-index ensures overlay renders above the image
  // borderRadius removed (container already has overflow:hidden)
  stackBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    // UAT-014: Match reduced border radius
    borderRadius: 6,
  },
  archiveOverlay: {
    backgroundColor: '#8E8E93', // iOS system gray
  },
  journalOverlay: {
    backgroundColor: '#34C759', // iOS system green
  },
  deleteOverlay: {
    backgroundColor: '#FF3B30', // iOS system red
  },
  iconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  // Box icon for Archive
  boxIcon: {
    width: 48,
    height: 48,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxIconInner: {
    width: 24,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    marginTop: -12,
  },
  // Checkmark circle for Journal
  checkmarkCircle: {
    width: 52,
    height: 52,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // X icon for Delete
  xIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xLine: {
    position: 'absolute',
    width: 40,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  xLine1: {
    transform: [{ rotate: '45deg' }],
  },
  xLine2: {
    transform: [{ rotate: '-45deg' }],
  },
  overlayText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default SwipeablePhotoCard;
