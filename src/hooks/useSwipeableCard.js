/**
 * useSwipeableCard hook
 *
 * Contains all stateful logic, animated values, gesture handling, and imperative methods.
 *
 * Features:
 * - Vertical swipe: Up swipe = Journal, Down swipe = Archive
 * - On-card overlays: Color overlays with icons fade in during swipe
 * - Three-stage haptic feedback: threshold, release, completion
 * - Spring-back animation when threshold not met
 * - Imperative methods for button-triggered animations
 */

import { useState, useCallback, useEffect, useImperativeHandle } from 'react';
import { Dimensions, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  runOnJS,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import logger from '../utils/logger';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Thresholds for action triggers
const VERTICAL_THRESHOLD = 200;
// Velocity threshold for fast swipe trigger (px/s)
const VELOCITY_THRESHOLD = 500;
// Threshold for locking swipe direction (prevents accidental opposite-action)
const DIRECTION_LOCK_THRESHOLD = 30;

// Delay for front card transition gives exiting card time to clear
const CASCADE_DELAY_MS = 120;

// Fade-in duration for new cards entering the visible stack
const STACK_ENTRY_FADE_DURATION = 300;

// Duration for exit animations (swipe off screen)
const EXIT_DURATION = 350;

// Delay before triggering cascade clearance.
// On Android, wait until the card is fully off-screen (~300ms into a 350ms easeIn animation)
// to avoid a transparent flash when the Animated.View unmounts mid-animation.
const CLEARANCE_DELAY = Platform.OS === 'android' ? 300 : 150;

/**
 * Get scale factor for card at given stack position.
 * @param {number} idx - Stack index (0=front, 1=behind, 2=furthest back)
 * @returns {number} Scale factor (1, 0.96, or 0.92)
 */
const getStackScale = idx => (idx === 0 ? 1 : idx === 1 ? 0.96 : 0.92);

/**
 * Get Y offset for card at given stack position.
 * Negative values mean cards peek from top (above front card).
 * @param {number} idx - Stack index (0=front, 1=behind, 2=furthest back)
 * @returns {number} Y offset in pixels (0, -20, or -40)
 */
const getStackOffset = idx => (idx === 0 ? 0 : idx === 1 ? -20 : -40);

/**
 * Get opacity for card at given stack position.
 * @param {number} idx - Stack index (0=front, 1=behind, 2=furthest back)
 * @returns {number} Opacity value (1, 0.85, or 0.7)
 */
const getStackOpacity = idx => (idx === 0 ? 1 : idx === 1 ? 0.85 : 0.7);

/**
 * Custom hook for swipeable photo card logic
 *
 * @param {object} params - Hook parameters
 * @param {object} params.photo - Photo object to display
 * @param {function} params.onSwipeLeft - Callback when Archive action triggered (down swipe or button)
 * @param {function} params.onSwipeRight - Callback when Journal action triggered (up swipe or button)
 * @param {function} params.onSwipeDown - Callback when Delete action triggered (button only)
 * @param {function} params.onDeleteComplete - Callback when delete animation completes
 * @param {function} params.onExitClearance - Callback when card has cleared enough for cascade
 * @param {number} params.stackIndex - Position in the stack (0=front, 1=behind, 2=furthest back)
 * @param {boolean} params.isActive - Whether this card is swipeable (only front card)
 * @param {string} params.enterFrom - Direction for entry animation ('up', 'down', 'delete', or null)
 * @param {boolean} params.isNewlyVisible - Whether card is newly entering visible stack
 * @param {React.Ref} params.ref - Ref for imperative methods
 *
 * @returns {object} - Animated styles, gesture handler, and state
 */
const useSwipeableCard = ({
  photo,
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  onDeleteComplete,
  onExitClearance,
  stackIndex = 0,
  isActive = true,
  enterFrom = null,
  isNewlyVisible = false,
  keyboardVisible = null,
  ref,
}) => {
  const [thresholdTriggered, setThresholdTriggered] = useState(false);

  // Animated values for gesture/front card
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);

  // Direction lock for gesture (0=none, 1=up, -1=down)
  const lockedDirection = useSharedValue(0);

  // Distinguishes delete from archive when both go downward
  const isDeleteAction = useSharedValue(0);

  // Track if this card has completed its entry animation
  const hasAnimatedEntry = useSharedValue(false);

  // Animated values for smooth stack cascade animation
  const initialOpacity =
    isNewlyVisible && !hasAnimatedEntry.value ? 0 : getStackOpacity(stackIndex);
  const stackScaleAnim = useSharedValue(getStackScale(stackIndex));
  // For undo entries, start offscreen: journal from top, archive/delete from bottom
  const stackOffsetAnim = useSharedValue(
    enterFrom === 'up'
      ? -SCREEN_HEIGHT
      : enterFrom === 'down' || enterFrom === 'delete'
        ? SCREEN_HEIGHT
        : getStackOffset(stackIndex)
  );
  const stackOpacityAnim = useSharedValue(initialOpacity);

  // Consolidated animation - stackIndex useEffect is the SINGLE source of truth
  const prevStackIndex = useSharedValue(stackIndex);

  // Track whether card is transitioning to front position
  const isTransitioningToFront = useSharedValue(0);

  // Track if action is in progress to prevent multiple triggers
  const actionInProgress = useSharedValue(false);

  // Track if a gesture is actively in progress (set on UI thread in onStart worklet)
  const gestureActive = useSharedValue(0);

  // Context for gesture start position
  const startY = useSharedValue(0);

  // Stack index animation effect
  useEffect(() => {
    if (prevStackIndex.value === stackIndex) {
      return;
    }

    const movingToFront = stackIndex === 0 && prevStackIndex.value > 0;

    const config = {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    };

    if (movingToFront) {
      isTransitioningToFront.value = 1;

      stackScaleAnim.value = withDelay(
        CASCADE_DELAY_MS,
        withTiming(getStackScale(stackIndex), config)
      );
      stackOffsetAnim.value = withDelay(
        CASCADE_DELAY_MS,
        withTiming(getStackOffset(stackIndex), config)
      );
      stackOpacityAnim.value = withDelay(
        CASCADE_DELAY_MS,
        withTiming(getStackOpacity(stackIndex), config, () => {
          'worklet';
          isTransitioningToFront.value = 0;
        })
      );
    } else {
      stackScaleAnim.value = withTiming(getStackScale(stackIndex), config);
      stackOffsetAnim.value = withTiming(getStackOffset(stackIndex), config);
      stackOpacityAnim.value = withTiming(getStackOpacity(stackIndex), config);
    }

    prevStackIndex.value = stackIndex;
  }, [stackIndex]);

  // Fade-in animation for newly visible cards entering the stack
  useEffect(() => {
    if (isNewlyVisible && !hasAnimatedEntry.value && stackIndex === 2) {
      logger.debug('useSwipeableCard: New card entering visible stack, starting fade-in', {
        photoId: photo?.id,
        stackIndex,
      });

      stackOpacityAnim.value = 0;
      stackOpacityAnim.value = withTiming(getStackOpacity(stackIndex), {
        duration: STACK_ENTRY_FADE_DURATION,
        easing: Easing.out(Easing.cubic),
      });

      hasAnimatedEntry.value = true;
    }
  }, [isNewlyVisible, stackIndex]);

  // Entry animation for undo — slide in from offscreen
  useEffect(() => {
    if (enterFrom && isActive) {
      stackOffsetAnim.value = withTiming(getStackOffset(0), {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      });
      logger.debug('useSwipeableCard: Undo slide-in animation started', {
        photoId: photo?.id,
        enterFrom,
      });
    }
  }, [enterFrom, isActive]);

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

  // Schedule clearance callback with delay (called via runOnJS from worklet)
  const scheduleClearanceCallback = useCallback(
    delay => {
      if (onExitClearance) {
        setTimeout(() => {
          onExitClearance();
        }, delay);
      }
    },
    [onExitClearance]
  );

  // Mark threshold as triggered
  const markThresholdTriggered = useCallback(() => {
    if (!thresholdTriggered) {
      setThresholdTriggered(true);
      triggerLightHaptic();
      logger.debug('useSwipeableCard: Threshold reached', { photoId: photo?.id });
    }
  }, [thresholdTriggered, triggerLightHaptic, photo?.id]);

  // Action handlers
  const handleArchive = useCallback(async () => {
    logger.info('useSwipeableCard: Archive action triggered', { photoId: photo?.id });
    triggerMediumHaptic();
    if (onSwipeLeft) {
      await onSwipeLeft();
    }
    triggerHeavyHaptic();
  }, [photo?.id, onSwipeLeft, triggerMediumHaptic, triggerHeavyHaptic]);

  const handleJournal = useCallback(async () => {
    logger.info('useSwipeableCard: Journal action triggered', { photoId: photo?.id });
    triggerMediumHaptic();
    if (onSwipeRight) {
      await onSwipeRight();
    }
    triggerHeavyHaptic();
  }, [photo?.id, onSwipeRight, triggerMediumHaptic, triggerHeavyHaptic]);

  const handleDelete = useCallback(async () => {
    logger.info('useSwipeableCard: Delete action triggered', { photoId: photo?.id });
    triggerWarningHaptic();
    if (onSwipeDown) {
      await onSwipeDown();
    }
    triggerHeavyHaptic();
  }, [photo?.id, onSwipeDown, triggerWarningHaptic, triggerHeavyHaptic]);

  // Clean archive animation — card slides down off screen
  const playArchiveAnimation = useCallback(() => {
    if (onExitClearance) {
      setTimeout(() => {
        onExitClearance();
      }, CLEARANCE_DELAY);
    }

    translateY.value = withTiming(
      SCREEN_HEIGHT * 1.5,
      {
        duration: EXIT_DURATION,
        easing: Easing.in(Easing.quad),
      },
      () => {
        'worklet';
        runOnJS(handleArchive)();
      }
    );
  }, [translateY, onExitClearance, handleArchive]);

  // Clean journal animation — card slides up off screen
  const playJournalAnimation = useCallback(() => {
    if (onExitClearance) {
      setTimeout(() => {
        onExitClearance();
      }, CLEARANCE_DELAY);
    }

    translateY.value = withTiming(
      -SCREEN_HEIGHT * 1.5,
      {
        duration: EXIT_DURATION,
        easing: Easing.in(Easing.quad),
      },
      () => {
        'worklet';
        runOnJS(handleJournal)();
      }
    );
  }, [translateY, onExitClearance, handleJournal]);

  // Imperative methods for button-triggered animations
  useImperativeHandle(
    ref,
    () => ({
      triggerArchive: () => {
        if (actionInProgress.value) return;
        logger.info('useSwipeableCard: triggerArchive called', { photoId: photo?.id });
        actionInProgress.value = true;
        isDeleteAction.value = 0;
        playArchiveAnimation();
      },
      triggerJournal: () => {
        if (actionInProgress.value) return;
        logger.info('useSwipeableCard: triggerJournal called', { photoId: photo?.id });
        actionInProgress.value = true;
        playJournalAnimation();
      },
      triggerDelete: () => {
        if (actionInProgress.value) return;
        logger.info('useSwipeableCard: triggerDelete called', { photoId: photo?.id });
        actionInProgress.value = true;
        isDeleteAction.value = 1;

        if (onExitClearance) {
          setTimeout(() => {
            onExitClearance();
          }, CLEARANCE_DELAY);
        }

        translateY.value = withTiming(
          SCREEN_HEIGHT * 1.5,
          {
            duration: EXIT_DURATION,
            easing: Easing.in(Easing.quad),
          },
          () => {
            'worklet';
            if (onDeleteComplete) {
              runOnJS(onDeleteComplete)();
            }
            runOnJS(handleDelete)();
          }
        );
      },
    }),
    [
      photo?.id,
      actionInProgress,
      isDeleteAction,
      translateY,
      playArchiveAnimation,
      playJournalAnimation,
      handleDelete,
      onDeleteComplete,
      onExitClearance,
    ]
  );

  // Pan gesture — vertical: up = journal, down = archive
  // .enabled() prevents gesture from firing on stack cards.
  // Keyboard visibility is checked inside worklets to avoid the Android native cast error
  // that occurs when passing a SharedValue/DerivedValue to .enabled().
  const panGesture = Gesture.Pan()
    .enabled(isActive)
    .activeOffsetY([-5, 5])
    .onStart(() => {
      'worklet';
      // Block gesture when keyboard is open (prevents accidental swipes while typing captions)
      if (keyboardVisible?.value) return;
      gestureActive.value = 1;
      startY.value = translateY.value;
      lockedDirection.value = 0;
      cardScale.value = 1;
      cardOpacity.value = 1;
      isDeleteAction.value = 0;
      runOnJS(resetThreshold)();
    })
    .onUpdate(event => {
      'worklet';
      if (!gestureActive.value) return;
      const rawY = event.translationY;

      // Lock direction on first significant movement
      if (lockedDirection.value === 0) {
        if (rawY < -DIRECTION_LOCK_THRESHOLD) {
          lockedDirection.value = 1; // up
        } else if (rawY > DIRECTION_LOCK_THRESHOLD) {
          lockedDirection.value = -1; // down
        }
      }

      // Card follows finger
      translateY.value = startY.value + rawY;

      const absY = Math.abs(translateY.value);
      if (absY > VERTICAL_THRESHOLD) {
        runOnJS(markThresholdTriggered)();
      }
    })
    .onEnd(event => {
      'worklet';
      if (actionInProgress.value) return;

      const velY = event.velocityY;

      const isUpAction = lockedDirection.value === 1 && translateY.value < -VERTICAL_THRESHOLD;
      const isUpVelocity = velY < -VELOCITY_THRESHOLD && event.translationY < 0;
      const isDownAction = lockedDirection.value === -1 && translateY.value > VERTICAL_THRESHOLD;
      const isDownVelocity = velY > VELOCITY_THRESHOLD && event.translationY > 0;

      const isUpSwipe = isUpAction || isUpVelocity;
      const isDownSwipe = isDownAction || isDownVelocity;

      if (isUpSwipe) {
        // Journal — fly up
        actionInProgress.value = true;
        translateY.value = withTiming(
          -SCREEN_HEIGHT * 1.5,
          {
            duration: EXIT_DURATION,
            easing: Easing.in(Easing.quad),
          },
          () => {
            'worklet';
            runOnJS(handleJournal)();
          }
        );
        runOnJS(scheduleClearanceCallback)(CLEARANCE_DELAY);
      } else if (isDownSwipe) {
        // Archive — fall down
        actionInProgress.value = true;
        translateY.value = withTiming(
          SCREEN_HEIGHT * 1.5,
          {
            duration: EXIT_DURATION,
            easing: Easing.in(Easing.quad),
          },
          () => {
            'worklet';
            runOnJS(handleArchive)();
          }
        );
        runOnJS(scheduleClearanceCallback)(CLEARANCE_DELAY);
      } else {
        // Clean snap back
        const snapConfig = { duration: 200, easing: Easing.out(Easing.cubic) };
        translateY.value = withTiming(0, snapConfig);
        translateX.value = withTiming(0, snapConfig);
        cardScale.value = withTiming(1, snapConfig, finished => {
          'worklet';
          if (finished) {
            gestureActive.value = 0;
          }
        });
        cardOpacity.value = withTiming(1, { duration: 150 });
        runOnJS(resetThreshold)();
      }
    });

  // Animated card style
  const cardStyle = useAnimatedStyle(() => {
    const useStackAnimation = !actionInProgress.value && !gestureActive.value;

    if (useStackAnimation) {
      return {
        transform: [
          { translateX: 0 },
          { translateY: stackOffsetAnim.value },
          { scale: stackScaleAnim.value },
        ],
        opacity: stackOpacityAnim.value,
      };
    } else {
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: cardScale.value },
        ],
        opacity: cardOpacity.value,
      };
    }
  });

  // Archive overlay (down swipe) — amber with box icon
  const archiveOverlayStyle = useAnimatedStyle(() => {
    if (isDeleteAction.value) return { opacity: 0 };

    const opacity =
      translateY.value > 0
        ? interpolate(translateY.value, [0, VERTICAL_THRESHOLD], [0, 0.7], 'clamp')
        : 0;

    return { opacity };
  });

  // Journal overlay (up swipe) — cyan with checkmark icon
  const journalOverlayStyle = useAnimatedStyle(() => {
    const opacity =
      translateY.value < 0
        ? interpolate(Math.abs(translateY.value), [0, VERTICAL_THRESHOLD], [0, 0.7], 'clamp')
        : 0;

    return { opacity };
  });

  // Delete overlay (button-triggered) — red with X icon
  const deleteOverlayStyle = useAnimatedStyle(() => {
    if (!isDeleteAction.value) return { opacity: 0 };

    const opacity =
      translateY.value > 0
        ? interpolate(translateY.value, [0, VERTICAL_THRESHOLD], [0, 0.7], 'clamp')
        : 0;

    return { opacity };
  });

  return {
    // Animated styles
    cardStyle,
    archiveOverlayStyle,
    journalOverlayStyle,
    deleteOverlayStyle,
    // Gesture handler
    panGesture,
    // State
    isActive,
    stackIndex,
  };
};

export default useSwipeableCard;
