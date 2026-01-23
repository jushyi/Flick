import React, { useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
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
// 18.4: Slowed to 800ms for smooth exponential arc visibility
const EXIT_DURATION = 800;

// UAT-016: Button-triggered animations use slower duration for satisfying pace
// Swipe gestures have natural lead-in time from drag, but button taps are instant
// 1200ms (3x EXIT_DURATION) gives button animations similar perceived pace to swipes
const BUTTON_EXIT_DURATION = 800;

// UAT-005 FIX: Delay for front card transition gives exiting card time to clear
// 18.6: Reduced to 0ms since onExitClearance now triggers cascade early
const CASCADE_DELAY_MS = 0;

// 18.6: Clearance delay - time at which card clears visual overlap with stack
// At ~60% of exit, card has moved one card width (clears overlap with stack)
// This is when we fire onExitClearance to trigger cascade animation early
const SWIPE_CLEARANCE_DELAY = Math.round(EXIT_DURATION * 0.6); // ~480ms for 800ms exit
const BUTTON_CLEARANCE_DELAY = Math.round(BUTTON_EXIT_DURATION * 0.6); // ~480ms for buttons

// UAT-004 FIX: Fade-in duration for new cards entering the visible stack
const STACK_ENTRY_FADE_DURATION = 300;

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
const SwipeablePhotoCard = forwardRef(({ photo, onSwipeLeft, onSwipeRight, onSwipeDown, onDeleteComplete, onExitClearance, stackIndex = 0, isActive = true, enterFrom = null, isNewlyVisible = false }, ref) => {
  const [thresholdTriggered, setThresholdTriggered] = useState(false);

  // Animated values for gesture/front card
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  // 18.3: Scale for delete suction animation (card shrinks as it gets sucked into delete button)
  const cardScale = useSharedValue(1);

  // Helper functions for stack styling (UAT-006, UAT-009, UAT-011)
  // Cards peek from TOP (negative Y = above front card)
  const getStackScale = (idx) => idx === 0 ? 1 : idx === 1 ? 0.96 : 0.92;
  const getStackOffset = (idx) => idx === 0 ? 0 : idx === 1 ? -20 : -40; // Negative = above
  const getStackOpacity = (idx) => idx === 0 ? 1 : idx === 1 ? 0.85 : 0.7;

  // UAT-004 FIX: Track if this card has completed its entry animation
  // Used to detect when a card is newly entering the visible stack
  const hasAnimatedEntry = useSharedValue(false);

  // Animated values for smooth stack cascade animation (UAT-009)
  // These animate when stackIndex changes (card moves forward in stack)
  // UAT-004 FIX: Start newly visible cards at opacity 0 for fade-in effect
  const initialOpacity = isNewlyVisible && !hasAnimatedEntry.value ? 0 : getStackOpacity(stackIndex);
  const stackScaleAnim = useSharedValue(getStackScale(stackIndex));
  const stackOffsetAnim = useSharedValue(getStackOffset(stackIndex));
  const stackOpacityAnim = useSharedValue(initialOpacity);

  // UAT-005 FIX: Consolidated animation - stackIndex useEffect is the SINGLE source of truth
  // Removed dual-animation approach (cascading useEffect + stackIndex useEffect) that caused race condition
  // The cascade animation was being interrupted by stackIndex useEffect, causing mid-flight snaps
  const prevStackIndex = useSharedValue(stackIndex);

  // UAT-006 FIX: Track whether card is transitioning to front position
  // When a card becomes isActive=true, the cardStyle switches from using stackOffsetAnim to translateX/Y
  // We need to continue using stackOffsetAnim during the transition animation, not switch immediately
  // This shared value is 1 during transition, 0 when complete
  const isTransitioningToFront = useSharedValue(0);

  useEffect(() => {
    // UAT-006 DEBUG: Log ALL useEffect invocations to understand timing
    console.log('[CASCADE DEBUG] stackIndex useEffect FIRED', {
      photoId: photo?.id?.substring(0, 8),
      stackIndex,
      prevStackIndex: prevStackIndex.value,
      currentScaleValue: stackScaleAnim.value,
      currentOffsetValue: stackOffsetAnim.value,
      currentOpacityValue: stackOpacityAnim.value,
      targetScale: getStackScale(stackIndex),
      targetOffset: getStackOffset(stackIndex),
      targetOpacity: getStackOpacity(stackIndex),
    });

    // Only animate if stackIndex actually changed
    if (prevStackIndex.value === stackIndex) {
      console.log('[CASCADE DEBUG] SKIPPING - prevStackIndex matches stackIndex');
      return;
    }

    const movingToFront = stackIndex === 0 && prevStackIndex.value > 0;
    console.log('[CASCADE DEBUG] ANIMATING', {
      movingToFront,
      from: prevStackIndex.value,
      to: stackIndex,
    });

    // Use timing animation for predictable, smooth motion
    const config = {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    };

    // Total animation time including delay
    const totalDuration = movingToFront ? CASCADE_DELAY_MS + 350 : 350;

    if (movingToFront) {
      // UAT-006 FIX: Mark as transitioning so cardStyle continues using stackOffsetAnim
      isTransitioningToFront.value = 1;
      console.log('[CASCADE DEBUG] isTransitioningToFront set to 1');

      // Card becoming front - add delay to let exiting card clear
      stackScaleAnim.value = withDelay(CASCADE_DELAY_MS, withTiming(getStackScale(stackIndex), config));
      stackOffsetAnim.value = withDelay(CASCADE_DELAY_MS, withTiming(getStackOffset(stackIndex), config));
      stackOpacityAnim.value = withDelay(CASCADE_DELAY_MS, withTiming(getStackOpacity(stackIndex), config, () => {
        'worklet';
        // Animation complete - clear transition flag
        isTransitioningToFront.value = 0;
        console.log('[CASCADE DEBUG] Transition animation complete, isTransitioningToFront set to 0');
      }));
    } else {
      // Other transitions - animate immediately
      stackScaleAnim.value = withTiming(getStackScale(stackIndex), config);
      stackOffsetAnim.value = withTiming(getStackOffset(stackIndex), config);
      stackOpacityAnim.value = withTiming(getStackOpacity(stackIndex), config);
    }

    prevStackIndex.value = stackIndex;
    console.log('[CASCADE DEBUG] Animation started, prevStackIndex updated to', stackIndex);
  }, [stackIndex]);

  // UAT-004 FIX: Fade-in animation for newly visible cards entering the stack
  // When a card first enters the visible stack (position 2), fade in smoothly
  useEffect(() => {
    if (isNewlyVisible && !hasAnimatedEntry.value && stackIndex === 2) {
      // Card is entering visible stack at the back - fade in from 0
      logger.debug('SwipeablePhotoCard: New card entering visible stack, starting fade-in', {
        photoId: photo?.id,
        stackIndex,
      });

      // Start at 0 opacity and animate to target
      stackOpacityAnim.value = 0;
      stackOpacityAnim.value = withTiming(getStackOpacity(stackIndex), {
        duration: STACK_ENTRY_FADE_DURATION,
        easing: Easing.out(Easing.cubic),
      });

      // Mark as animated so we don't re-trigger
      hasAnimatedEntry.value = true;
    }
  }, [isNewlyVisible, stackIndex]);

  // 18.1-02: Entry animation for undo (reverse of exit animation)
  // When enterFrom is set, card starts off-screen and animates to center
  const ENTRY_DURATION = 400;
  useEffect(() => {
    if (enterFrom && isActive) {
      // Start card off-screen in the direction it exited
      if (enterFrom === 'left') {
        translateX.value = -SCREEN_WIDTH * 1.5;
        translateY.value = SCREEN_HEIGHT * 0.5;
      } else if (enterFrom === 'right') {
        translateX.value = SCREEN_WIDTH * 1.5;
        translateY.value = SCREEN_HEIGHT * 0.5;
      } else if (enterFrom === 'down') {
        translateX.value = 0;
        translateY.value = SCREEN_HEIGHT;
      }

      // Animate to center position
      translateX.value = withTiming(0, {
        duration: ENTRY_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: ENTRY_DURATION,
        easing: Easing.out(Easing.cubic),
      });

      logger.debug('SwipeablePhotoCard: Entry animation started', {
        photoId: photo?.id,
        enterFrom,
      });
    }
  }, [enterFrom, isActive]);

  // Track if action is in progress to prevent multiple triggers
  const actionInProgress = useSharedValue(false);

  // UAT-008: Track when delete is button-triggered (vs gesture swipe)
  // Delete overlay should only show during button-triggered delete animation
  const isButtonDelete = useSharedValue(false);

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

  // UAT-005 FIX: Removed notifySwipeStart - cascade animation now driven by stackIndex changes

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
      // 18.6: Fire clearance callback early to trigger cascade while card still visible
      if (onExitClearance) {
        setTimeout(() => {
          onExitClearance();
        }, BUTTON_CLEARANCE_DELAY);
      }
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
      // 18.6: Fire clearance callback early to trigger cascade while card still visible
      if (onExitClearance) {
        setTimeout(() => {
          onExitClearance();
        }, BUTTON_CLEARANCE_DELAY);
      }
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
    // Trigger delete animation (vacuum suction toward delete button)
    // 18.3: Card shrinks and accelerates toward delete button position
    // Uses Easing.in for "being pulled in" feel (accelerates into target)
    triggerDelete: () => {
      if (actionInProgress.value) return;
      logger.info('SwipeablePhotoCard: triggerDelete called', { photoId: photo?.id });
      actionInProgress.value = true;
      isButtonDelete.value = true; // UAT-008: Mark as button-triggered delete

      // 18.3: Vacuum suction animation - shorter duration for snappy feel
      const SUCTION_DURATION = 450;

      // Card shrinks to 10% size as it gets "sucked in"
      // Put the completion callback on scale animation since it always changes (1 → 0.1)
      cardScale.value = withTiming(0.1, {
        duration: SUCTION_DURATION,
        easing: Easing.in(Easing.cubic), // Accelerates into target
      }, () => {
        'worklet';
        // Signal delete button to pulse, then trigger delete callback
        if (onDeleteComplete) {
          runOnJS(onDeleteComplete)();
        }
        runOnJS(handleDelete)();
      });

      // Card moves down toward delete button (bottom center of screen)
      // Delete button is approximately SCREEN_HEIGHT * 0.35 below card center
      translateY.value = withTiming(SCREEN_HEIGHT * 0.35, {
        duration: SUCTION_DURATION,
        easing: Easing.in(Easing.cubic),
      });

      // Center card horizontally (in case it was offset)
      translateX.value = withTiming(0, {
        duration: SUCTION_DURATION,
        easing: Easing.in(Easing.cubic),
      });
    },
  }), [photo?.id, actionInProgress, isButtonDelete, translateX, translateY, cardScale, handleArchive, handleJournal, handleDelete, onDeleteComplete, onExitClearance]);

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
        // UAT-005 FIX: Removed notifySwipeStart - cascade happens on stackIndex change
        actionInProgress.value = true;
        // 18.6: Fire clearance callback early to trigger cascade while card still visible
        if (onExitClearance) {
          setTimeout(() => {
            onExitClearance();
          }, SWIPE_CLEARANCE_DELAY);
        }
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
        // UAT-005 FIX: Removed notifySwipeStart - cascade happens on stackIndex change
        actionInProgress.value = true;
        // 18.6: Fire clearance callback early to trigger cascade while card still visible
        if (onExitClearance) {
          setTimeout(() => {
            onExitClearance();
          }, SWIPE_CLEARANCE_DELAY);
        }
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
    // 18.4: Exponential arc formula - starts flat, steepens as card accelerates off screen
    // Power curve: y = maxY * (normalizedX ^ exponent)
    // - At x=0: arcY ≈ 0 (starts flat/horizontal)
    // - At x=50% exit: arcY ≈ 18% of final Y (still mostly flat)
    // - At x=100% exit: arcY = 100% of final Y (reaches intended exit position)
    const normalizedX = Math.abs(translateX.value) / (SCREEN_WIDTH * 1.5);
    const curveProgress = Math.pow(normalizedX, 2.5); // Exponent 2.5 = gradual start, accelerating end
    const arcY = (SCREEN_HEIGHT * 0.5) * curveProgress;

    // Rotation based on horizontal movement (degrees) - original linear formula
    // 18.4: Keep linear rotation for natural feel, only arc path uses exponential curve
    const rotation = isActive ? translateX.value / 15 : 0;

    // 18.3 FIX: If actionInProgress, always use gesture transforms (for delete suction)
    // This ensures delete animation works even if card was still transitioning to front
    const actionActive = actionInProgress.value;

    // UAT-006 FIX: When card is transitioning to front position, continue using stack animation
    // The problem was: when isActive becomes true, cardStyle switched to translateX/Y immediately
    // but the cascade animation was running on stackOffsetAnim - so the animation was ignored
    // Now we check isTransitioningToFront and continue using stack values until animation completes
    // 18.3 FIX: But if action is in progress (delete suction), use gesture transforms immediately
    const useStackAnimation = !actionActive && (isTransitioningToFront.value === 1 || !isActive);

    if (useStackAnimation) {
      // Stack cards OR front card still transitioning from stack position
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
    } else {
      // Front card (not transitioning) OR action in progress - apply gesture transforms
      // 18.3: Include cardScale for delete suction animation
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value + arcY },
          { rotate: `${rotation}deg` },
          { scale: cardScale.value },
        ],
        opacity: cardOpacity.value,
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
  // UAT-008: Only show delete overlay during button-triggered delete animation
  const deleteOverlayStyle = useAnimatedStyle(() => {
    // Only show overlay when delete is triggered via button, not during gesture swipes
    if (!isButtonDelete.value) return { opacity: 0 };

    const opacity = translateY.value > 0
      ? interpolate(translateY.value, [0, DELETE_OVERLAY_THRESHOLD], [0, 0.7], 'clamp')
      : 0;

    return {
      opacity,
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
      {/* Photo Image - expo-image with native caching and transitions */}
      {/* UAT-003 FIX: expo-image provides native memory-disk caching and 200ms cross-dissolve */}
      {/* transition, eliminating the black flash caused by RN Image's unreliable caching */}
      <Image
        source={{ uri: photo.imageURL }}
        style={styles.photoImage}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        onError={(error) =>
          logger.error('SwipeablePhotoCard: Image load error', {
            photoId: photo.id,
            error: error.error,
          })
        }
        onLoad={() =>
          logger.debug('SwipeablePhotoCard: Image loaded successfully', {
            photoId: photo.id,
          })
        }
      />

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
    // Black background matches screen, prevents any flash
    // during cascade animation if image needs brief moment to render
    backgroundColor: '#000000',
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
