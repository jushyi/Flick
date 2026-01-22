import React, { useState, useCallback } from 'react';
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
const VERTICAL_THRESHOLD = 150;

// Exit animation configuration
const EXIT_DURATION = 250;

/**
 * SwipeablePhotoCard - Flick-style swipeable card for photo triage
 *
 * Features:
 * - Arc motion: Card curves downward as it moves horizontally (like flicking from wrist)
 * - Rotation: Card tilts in direction of swipe
 * - On-card overlays: Color overlays with icons fade in during swipe
 * - Three-stage haptic feedback: threshold, release, completion
 * - Spring-back animation when threshold not met
 *
 * Swipe directions:
 * - Left swipe → Archive (gray overlay, box icon)
 * - Right swipe → Journal (green overlay, checkmark icon)
 * - Down swipe → Delete (red overlay, X icon)
 *
 * @param {object} photo - Photo object to display
 * @param {function} onSwipeLeft - Callback when Archive action triggered (left swipe)
 * @param {function} onSwipeRight - Callback when Journal action triggered (right swipe)
 * @param {function} onSwipeDown - Callback when Delete action triggered (down swipe)
 */
const SwipeablePhotoCard = ({ photo, onSwipeLeft, onSwipeRight, onSwipeDown }) => {
  const [thresholdTriggered, setThresholdTriggered] = useState(false);

  // Animated values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

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

  // Pan gesture using new Gesture API
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(resetThreshold)();
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;

      // Check if threshold is reached
      const absX = Math.abs(translateX.value);
      const absY = translateY.value;

      if (absX > HORIZONTAL_THRESHOLD || absY > VERTICAL_THRESHOLD) {
        runOnJS(markThresholdTriggered)();
      }
    })
    .onEnd((event) => {
      'worklet';
      if (actionInProgress.value) return;

      const velocityX = event.velocityX;
      const velocityY = event.velocityY;

      // Determine action based on position and velocity
      const isLeftSwipe = translateX.value < -HORIZONTAL_THRESHOLD || velocityX < -500;
      const isRightSwipe = translateX.value > HORIZONTAL_THRESHOLD || velocityX > 500;
      const isDownSwipe = translateY.value > VERTICAL_THRESHOLD || velocityY > 500;

      if (isLeftSwipe && !isDownSwipe) {
        // Archive (left swipe) - arc to bottom-left
        actionInProgress.value = true;
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        });
        translateY.value = withTiming(SCREEN_HEIGHT * 0.5, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        });
        cardOpacity.value = withTiming(0, { duration: EXIT_DURATION }, () => {
          'worklet';
          runOnJS(handleArchive)();
        });
      } else if (isRightSwipe && !isDownSwipe) {
        // Journal (right swipe) - arc to bottom-right
        actionInProgress.value = true;
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        });
        translateY.value = withTiming(SCREEN_HEIGHT * 0.5, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        });
        cardOpacity.value = withTiming(0, { duration: EXIT_DURATION }, () => {
          'worklet';
          runOnJS(handleJournal)();
        });
      } else if (isDownSwipe) {
        // Delete (down swipe) - drop straight down
        actionInProgress.value = true;
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        });
        cardOpacity.value = withTiming(0, { duration: EXIT_DURATION }, () => {
          'worklet';
          runOnJS(handleDelete)();
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

  // Animated card style with arc motion and rotation
  const cardStyle = useAnimatedStyle(() => {
    // Arc motion: card curves downward as it moves horizontally
    const arcY = Math.abs(translateX.value) * 0.3;

    // Rotation based on horizontal movement (degrees)
    const rotation = translateX.value / 15;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + arcY },
        { rotate: `${rotation}deg` },
      ],
      opacity: cardOpacity.value,
    };
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

  // Delete overlay (down swipe) - red with X icon
  const deleteOverlayStyle = useAnimatedStyle(() => {
    const opacity = translateY.value > 0
      ? interpolate(translateY.value, [0, VERTICAL_THRESHOLD], [0, 0.7], 'clamp')
      : 0;

    return {
      opacity,
    };
  });

  if (!photo || !photo.imageURL) {
    logger.warn('SwipeablePhotoCard: Missing photo or imageURL', { photo });
    return null;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.cardContainer, cardStyle]}>
        {/* Photo Image */}
        <Image
          source={{ uri: photo.imageURL }}
          style={styles.photoImage}
          resizeMode="cover"
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

        {/* Archive Overlay (Left swipe) */}
        <Animated.View style={[styles.overlay, styles.archiveOverlay, archiveOverlayStyle]}>
          <View style={styles.iconContainer}>
            <View style={styles.boxIcon}>
              <View style={styles.boxIconInner} />
            </View>
          </View>
          <Text style={styles.overlayText}>Archive</Text>
        </Animated.View>

        {/* Journal Overlay (Right swipe) */}
        <Animated.View style={[styles.overlay, styles.journalOverlay, journalOverlayStyle]}>
          <View style={styles.iconContainer}>
            <View style={styles.checkmarkCircle}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          </View>
          <Text style={styles.overlayText}>Journal</Text>
        </Animated.View>

        {/* Delete Overlay (Down swipe) */}
        <Animated.View style={[styles.overlay, styles.deleteOverlay, deleteOverlayStyle]}>
          <View style={styles.iconContainer}>
            <View style={styles.xIcon}>
              <View style={[styles.xLine, styles.xLine1]} />
              <View style={[styles.xLine, styles.xLine2]} />
            </View>
          </View>
          <Text style={styles.overlayText}>Delete</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: SCREEN_WIDTH * 0.92,
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: '#2C2C2E',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#000000',
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
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
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
