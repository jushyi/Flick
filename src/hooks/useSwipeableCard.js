/**
 * useSwipeableCard hook
 *
 * Extracted from SwipeablePhotoCard.js as part of three-way separation refactoring.
 * Contains all stateful logic, animated values, gesture handling, and imperative methods.
 *
 * Features:
 * - Vertical swipe: Up swipe = Journal, Down swipe = Archive
 * - Rotation: Card tilts slightly during vertical drag
 * - On-card overlays: Color overlays with icons fade in during swipe
 * - Three-stage haptic feedback: threshold, release, completion
 * - Spring-back animation when threshold not met
 * - Imperative methods for button-triggered animations
 */

import { useState, useCallback, useEffect, useImperativeHandle } from 'react';
import { Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
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
// Velocity threshold for fast swipe trigger (px/s) - triggers full cinematic animation
const VELOCITY_THRESHOLD = 500;
// Threshold for locking swipe direction (prevents accidental opposite-action)
const DIRECTION_LOCK_THRESHOLD = 30;
// Distance (px) to observe before committing to fast vs slow swipe mode
const SWIPE_DETECTION_DISTANCE = 12;
// Delete overlay threshold (used for button-triggered animation overlay only)
const DELETE_OVERLAY_THRESHOLD = 150;

// Delay for front card transition gives exiting card time to clear
const CASCADE_DELAY_MS = 120;

// Fade-in duration for new cards entering the visible stack
const STACK_ENTRY_FADE_DURATION = 300;

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
 * @param {string} params.enterFrom - Direction for entry animation ('left', 'right', 'down', or null)
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
  ref,
}) => {
  const [thresholdTriggered, setThresholdTriggered] = useState(false);

  // Animated values for gesture/front card
  // For undo entries, start slightly scaled down and invisible for pop-in effect
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  // Scale for animations (delete suction, journal pickup pop)
  const cardScale = useSharedValue(1);
  // Horizontal scale modifier for journal pickup narrowing effect
  const cardScaleX = useSharedValue(1);

  // Glow overlay opacity for journal "item pickup" flash
  const journalGlowOpacity = useSharedValue(0);

  // Archive crush progress (drives scaleY: 0=full, 1=crushed)
  const boxClipProgress = useSharedValue(0);

  // Archive overlay flash (shows box icon before crush)
  const archiveFlashOpacity = useSharedValue(0);

  // Delete dissolve progress (0=idle, 0→1 during dissolve animation)
  const dissolveProgress = useSharedValue(0);

  // Direction lock for gesture (0=none, 1=up, -1=down)
  const lockedDirection = useSharedValue(0);

  // Swipe mode: 0=detecting, 1=slow (progressive effects), 2=fast (suppress visuals)
  const swipeMode = useSharedValue(0);
  // Records translationY at the moment detection commits to slow mode
  const gestureVisualOffset = useSharedValue(0);

  // Track if this card has completed its entry animation
  // Used to detect when a card is newly entering the visible stack
  const hasAnimatedEntry = useSharedValue(false);

  // Animated values for smooth stack cascade animation
  // These animate when stackIndex changes (card moves forward in stack)
  // Start newly visible cards at opacity 0 for fade-in effect
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
  // Removed dual-animation approach that caused race condition (cascade interrupted by stackIndex useEffect)
  const prevStackIndex = useSharedValue(stackIndex);

  // Track whether card is transitioning to front position
  // When a card becomes isActive=true, the cardStyle switches from using stackOffsetAnim to translateX/Y
  // We need to continue using stackOffsetAnim during the transition animation, not switch immediately
  // This shared value is 1 during transition, 0 when complete
  const isTransitioningToFront = useSharedValue(0);

  // Track if action is in progress to prevent multiple triggers
  const actionInProgress = useSharedValue(false);

  // Track if a gesture is actively in progress (set on UI thread in onStart worklet)
  // Used in cardStyle to avoid JS closure race — only shared values in the condition
  const gestureActive = useSharedValue(0);

  // Track when delete is button-triggered (vs gesture swipe)
  // Delete overlay should only show during button-triggered delete animation
  const isButtonDelete = useSharedValue(false);

  // Context for gesture start position
  const startY = useSharedValue(0);

  // Stack index animation effect
  useEffect(() => {
    // Only animate if stackIndex actually changed
    if (prevStackIndex.value === stackIndex) {
      return;
    }

    const movingToFront = stackIndex === 0 && prevStackIndex.value > 0;

    // Use timing animation for predictable, smooth motion
    const config = {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    };

    if (movingToFront) {
      // Mark as transitioning so cardStyle continues using stackOffsetAnim
      isTransitioningToFront.value = 1;

      // Card becoming front - add delay to let exiting card clear
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
          // Animation complete - clear transition flag
          isTransitioningToFront.value = 0;
        })
      );
    } else {
      // Other transitions - animate immediately
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

  // Entry animation for undo — pop-in with brief overlay flash
  // Card starts at scale 0.92 / opacity 0 (set via useSharedValue above)
  useEffect(() => {
    if (enterFrom && isActive) {
      // Slide from offscreen to stack position (stackOffsetAnim drives cardStyle in stack mode)
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

  // Shared archive "boxing up" animation - used by both button press and swipe
  // Sequential crush to small box, overlay stamps on, box drops away.
  const playArchiveCinematic = useCallback(() => {
    // Schedule clearance after crush, before drop
    if (onExitClearance) {
      setTimeout(() => {
        onExitClearance();
      }, 550);
    }

    // Phase 1: Height crushes to small box (scaleY 1 → 0.2)
    boxClipProgress.value = withTiming(1, {
      duration: 250,
      easing: Easing.in(Easing.cubic),
    });

    // Phase 2: Width crushes to match (scaleX 1 → 0.2) — small square box
    cardScaleX.value = withDelay(
      200,
      withTiming(0.2, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      })
    );

    // Phase 3: Box stamp overlay appears on the small box (looks like a package)
    archiveFlashOpacity.value = withDelay(
      380,
      withTiming(1, {
        duration: 80,
        easing: Easing.out(Easing.cubic),
      })
    );

    // Phase 4: Box drops off-screen through the footer
    translateY.value = withDelay(
      480,
      withTiming(
        SCREEN_HEIGHT * 1.5,
        {
          duration: 400,
          easing: Easing.in(Easing.quad),
        },
        () => {
          'worklet';
          runOnJS(handleArchive)();
        }
      )
    );
  }, [
    archiveFlashOpacity,
    cardScaleX,
    boxClipProgress,
    translateY,
    onExitClearance,
    handleArchive,
  ]);

  // Shared journal cinematic animation - used by both button press and fast swipe
  // Runs on JS thread so value resets from worklets take effect before animations start
  const playJournalCinematic = useCallback(() => {
    // Schedule clearance so pop/glow/thin play before cascade
    if (onExitClearance) {
      setTimeout(() => {
        onExitClearance();
      }, 500);
    }

    // Scale pop then settle back (height stays full)
    cardScale.value = withSequence(
      withTiming(1.08, { duration: 100, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
    );

    // Thin out horizontally (sides squeeze in)
    cardScaleX.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0.05, { duration: 600, easing: Easing.in(Easing.cubic) })
    );

    // Cyan glow flash
    journalGlowOpacity.value = withSequence(
      withTiming(0.6, { duration: 60 }),
      withTiming(0, { duration: 350 })
    );

    // Upward flight - hold briefly during pop, then accelerate upward
    translateY.value = withSequence(
      withTiming(0, { duration: 150 }),
      withTiming(
        -SCREEN_HEIGHT * 1.5,
        {
          duration: 750,
          easing: Easing.in(Easing.quad),
        },
        () => {
          'worklet';
          runOnJS(handleJournal)();
        }
      )
    );
  }, [cardScale, cardScaleX, journalGlowOpacity, translateY, onExitClearance, handleJournal]);

  // Imperative methods for button-triggered animations
  useImperativeHandle(
    ref,
    () => ({
      /**
       * Trigger archive animation (downward exit).
       * Called when user taps the archive button.
       * @returns {void}
       */
      triggerArchive: () => {
        if (actionInProgress.value) return;
        logger.info('useSwipeableCard: triggerArchive called', { photoId: photo?.id });
        actionInProgress.value = true;
        playArchiveCinematic();
      },
      /**
       * Trigger journal animation (upward "item pickup" exit).
       * Called when user taps the journal button.
       * Scale pop + cyan glow flash + rapid upward flight.
       * @returns {void}
       */
      triggerJournal: () => {
        if (actionInProgress.value) return;
        logger.info('useSwipeableCard: triggerJournal called', { photoId: photo?.id });
        actionInProgress.value = true;
        playJournalCinematic();
      },
      /**
       * Trigger delete animation (pixel dissolve).
       * Photo breaks into pixel blocks that scatter and fall.
       * @returns {void}
       */
      triggerDelete: () => {
        if (actionInProgress.value) return;
        logger.info('useSwipeableCard: triggerDelete called', { photoId: photo?.id });
        actionInProgress.value = true;

        // Schedule cascade clearance AFTER blocks have settled
        if (onExitClearance) {
          setTimeout(() => {
            onExitClearance();
          }, 550);
        }

        // Drive dissolve progress — blocks scatter based on this value
        dissolveProgress.value = withTiming(
          1,
          {
            duration: 800,
            easing: Easing.linear,
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
      dissolveProgress,
      translateX,
      translateY,
      cardScale,
      cardScaleX,
      journalGlowOpacity,
      playArchiveCinematic,
      playJournalCinematic,
      handleDelete,
      onDeleteComplete,
      onExitClearance,
    ]
  );

  // Pan gesture using new Gesture API (vertical: up = journal, down = archive)
  const panGesture = Gesture.Pan()
    .activeOffsetY([-5, 5])
    .onStart(() => {
      'worklet';
      gestureActive.value = 1;
      startY.value = translateY.value;
      lockedDirection.value = 0;
      cardScale.value = 1;
      cardScaleX.value = 1;
      journalGlowOpacity.value = 0;
      archiveFlashOpacity.value = 0;
      boxClipProgress.value = 0;
      dissolveProgress.value = 0;
      cardOpacity.value = 1;
      swipeMode.value = 0;
      gestureVisualOffset.value = 0;
      runOnJS(resetThreshold)();
    })
    .onUpdate(event => {
      'worklet';
      const rawY = event.translationY;

      // Lock direction on first significant movement (always runs — logical, not visual)
      if (lockedDirection.value === 0) {
        if (rawY < -DIRECTION_LOCK_THRESHOLD) {
          lockedDirection.value = 1; // up
        } else if (rawY > DIRECTION_LOCK_THRESHOLD) {
          lockedDirection.value = -1; // down
        }
      }

      // --- Detection phase: buffer initial movement to distinguish fast vs slow ---
      // Uses a much higher velocity bar than the action threshold because
      // initial gesture velocity is noisy — even slow drags can spike above
      // VELOCITY_THRESHOLD in the first few frames of finger acceleration.
      if (swipeMode.value === 0) {
        if (Math.abs(rawY) >= SWIPE_DETECTION_DISTANCE) {
          if (Math.abs(event.velocityY) >= VELOCITY_THRESHOLD * 3) {
            swipeMode.value = 2; // fast — suppress all visuals
          } else {
            swipeMode.value = 1; // slow — start progressive effects
            gestureVisualOffset.value = rawY;
          }
        }
        return; // No visual updates during detection
      }

      // Fast mode: suppress all visual updates (onEnd fires cinematic from pristine state)
      if (swipeMode.value === 2) {
        return;
      }

      // --- Slow mode: progressive visual effects with offset compensation ---
      const adjustedY = rawY - gestureVisualOffset.value;

      // Archive: card stays centered, drag distance drives crush only
      if (lockedDirection.value === -1 && adjustedY > 0) {
        // Don't update translateY — card stays in place while crushing
        const dragDist = adjustedY;

        if (dragDist > VERTICAL_THRESHOLD) {
          runOnJS(markThresholdTriggered)();
        }

        // Progressive archive "boxing up" effects
        if (dragDist < VERTICAL_THRESHOLD) {
          // Before threshold: height starts crushing (scaleY compresses)
          const preProgress = dragDist / VERTICAL_THRESHOLD;
          boxClipProgress.value = preProgress * 0.6; // 0 → 0.6 (scaleY: 1 → ~0.52)
          cardScaleX.value = 1;
          archiveFlashOpacity.value = 0;
        } else {
          // Past threshold: width crushes too, stamp starts fading in
          const postProgress = Math.min((dragDist - VERTICAL_THRESHOLD) / 200, 1);
          boxClipProgress.value = 0.6 + postProgress * 0.4; // 0.6 → 1.0 (scaleY → 0.2)
          cardScaleX.value = 1 - postProgress * 0.8; // 1.0 → 0.2 (width crushes)
          archiveFlashOpacity.value = postProgress * 0.7; // stamp fades in
        }
      } else {
        // Journal and neutral: card moves with finger (offset-compensated)
        translateY.value = startY.value + adjustedY;

        const absY = Math.abs(translateY.value);

        if (absY > VERTICAL_THRESHOLD) {
          runOnJS(markThresholdTriggered)();
        }

        // Progressive journal pickup effects during upward drag
        if (lockedDirection.value === 1 && translateY.value < 0) {
          if (absY < VERTICAL_THRESHOLD) {
            // Before threshold: scale pops up + glow builds (collecting moment)
            const preProgress = absY / VERTICAL_THRESHOLD;
            cardScale.value = 1 + preProgress * 0.08; // 1.0 → 1.08
            journalGlowOpacity.value = preProgress * 0.15;
            cardScaleX.value = 1;
          } else {
            // Past threshold: pop settles back, card thins horizontally (sides squeeze in)
            const postProgress = Math.min((absY - VERTICAL_THRESHOLD) / 200, 1);
            cardScale.value = 1.08 - postProgress * 0.08; // 1.08 → 1.0 (pop settles)
            cardScaleX.value = 1 - postProgress * 0.95; // 1.0 → 0.05 (thins out)
            journalGlowOpacity.value = 0.15 + postProgress * 0.45; // 0.15 → 0.6
          }
        } else {
          // Reset when not dragging in locked direction
          cardScale.value = 1;
          journalGlowOpacity.value = 0;
          cardScaleX.value = 1;
          boxClipProgress.value = 0;
          archiveFlashOpacity.value = 0;
        }
      }
    })
    .onEnd(event => {
      'worklet';
      if (actionInProgress.value) return;

      const velY = event.velocityY;

      // Detect upward/downward intent from direction lock or velocity
      // Archive uses event.translationY (translateY stays at 0 during archive drag)
      const isUpAction = lockedDirection.value === 1 && translateY.value < -VERTICAL_THRESHOLD;
      const isUpVelocity = velY < -VELOCITY_THRESHOLD && event.translationY < 0;
      const isDownAction = lockedDirection.value === -1 && event.translationY > VERTICAL_THRESHOLD;
      const isDownVelocity = velY > VELOCITY_THRESHOLD && event.translationY > 0;

      // Up swipe: either crossed position threshold or had enough velocity
      const isUpSwipe = isUpAction || isUpVelocity;
      const isDownSwipe = isDownAction || isDownVelocity;

      if (isUpSwipe) {
        actionInProgress.value = true;

        // Determine fast vs slow: check how much progressive thinning has applied
        // If cardScaleX still > 0.7, the user swiped fast through the zone (barely thinned)
        // If cardScaleX <= 0.7, the user dragged slowly and effects are well underway
        const wasFastSwipe = cardScaleX.value > 0.7;

        if (wasFastSwipe) {
          // Fast swipe - reset to clean state, then delegate to JS thread
          // for full cinematic (same as button press).
          // Resets take effect on UI thread immediately; playJournalCinematic
          // runs on JS thread next tick, so animations start from clean values.
          cardScale.value = 1;
          cardScaleX.value = 1;
          journalGlowOpacity.value = 0;
          translateY.value = 0;
          runOnJS(playJournalCinematic)();
        } else {
          // Slow drag - progressive effects already built up, smooth continue
          cardScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
          cardScaleX.value = withTiming(0.05, { duration: 450, easing: Easing.in(Easing.cubic) });
          journalGlowOpacity.value = withTiming(0, { duration: 200 });

          // Fly immediately - handler in completion callback keeps card alive
          translateY.value = withTiming(
            -SCREEN_HEIGHT * 1.5,
            {
              duration: 600,
              easing: Easing.in(Easing.quad),
            },
            () => {
              'worklet';
              runOnJS(handleJournal)();
            }
          );
          runOnJS(scheduleClearanceCallback)(500);
        }
      } else if (isDownSwipe) {
        // Archive - "boxing up" animation
        actionInProgress.value = true;

        // Determine fast vs slow: check how much progressive crushing has applied
        // If boxClipProgress < 0.3, the user swiped fast (barely crushed)
        // If boxClipProgress >= 0.3, effects are well underway
        const wasFastSwipe = boxClipProgress.value < 0.3;

        if (wasFastSwipe) {
          // Fast swipe - reset to clean state, play full cinematic
          cardScale.value = 1;
          cardScaleX.value = 1;
          translateY.value = 0;
          archiveFlashOpacity.value = 0;
          boxClipProgress.value = 0;
          cardOpacity.value = 1;
          runOnJS(playArchiveCinematic)();
        } else {
          // Slow drag - progressive crush already built up, smooth continue
          // Card is already centered (translateY stayed at 0 during drag)
          // Finish the crush from current state
          boxClipProgress.value = withTiming(1, {
            duration: 200,
            easing: Easing.in(Easing.cubic),
          });
          cardScaleX.value = withTiming(0.2, {
            duration: 250,
            easing: Easing.in(Easing.cubic),
          });
          // Stamp fully visible
          archiveFlashOpacity.value = withTiming(1, { duration: 100 });

          // Drop the box after crush finishes
          translateY.value = withDelay(
            280,
            withTiming(
              SCREEN_HEIGHT * 1.5,
              {
                duration: 400,
                easing: Easing.in(Easing.quad),
              },
              () => {
                'worklet';
                runOnJS(handleArchive)();
              }
            )
          );
          runOnJS(scheduleClearanceCallback)(450);
        }
      } else {
        // Clean snap back (no bounce)
        const snapConfig = { duration: 200, easing: Easing.out(Easing.cubic) };
        translateY.value = withTiming(0, snapConfig);
        translateX.value = withTiming(0, snapConfig);
        cardScale.value = withTiming(1, snapConfig, finished => {
          'worklet';
          if (finished) {
            gestureActive.value = 0;
          }
        });
        cardScaleX.value = withTiming(1, snapConfig);
        journalGlowOpacity.value = withTiming(0, { duration: 150 });
        archiveFlashOpacity.value = withTiming(0, { duration: 150 });
        boxClipProgress.value = withTiming(0, { duration: 150 });
        cardOpacity.value = withTiming(1, { duration: 150 });
        runOnJS(resetThreshold)();
      }
    });

  // Animated card style with vertical movement and stack transforms
  // IMPORTANT: condition uses ONLY shared values (no JS closure like isActive)
  // to avoid JS→UI thread race that caused intermittent 1-frame flash on card transition
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
          { scaleX: cardScaleX.value },
          { scaleY: interpolate(boxClipProgress.value, [0, 1], [1, 0.2], 'clamp') },
        ],
        opacity: cardOpacity.value,
        // Allow pixels to fall below card during dissolve
        overflow: dissolveProgress.value > 0 ? 'visible' : 'hidden',
      };
    }
  });

  // Archive overlay (down swipe) - gray with box icon (driven by crush progress)
  const archiveOverlayStyle = useAnimatedStyle(() => {
    // Driven by boxClipProgress since card stays centered during archive drag
    const opacity =
      boxClipProgress.value > 0
        ? interpolate(boxClipProgress.value, [0, 0.6], [0, 0.7], 'clamp')
        : 0;

    return {
      opacity,
    };
  });

  // Journal overlay (up swipe) - green with checkmark icon
  const journalOverlayStyle = useAnimatedStyle(() => {
    const opacity =
      translateY.value < 0
        ? interpolate(Math.abs(translateY.value), [0, VERTICAL_THRESHOLD], [0, 0.7], 'clamp')
        : 0;

    return {
      opacity,
    };
  });

  // Delete overlay (button-triggered animation) - red with X icon
  const deleteOverlayStyle = useAnimatedStyle(() => {
    if (!isButtonDelete.value) return { opacity: 0 };

    const opacity =
      translateY.value > 0
        ? interpolate(translateY.value, [0, DELETE_OVERLAY_THRESHOLD], [0, 0.7], 'clamp')
        : 0;

    return {
      opacity,
    };
  });

  // Journal pickup glow flash overlay (cyan)
  const journalGlowStyle = useAnimatedStyle(() => ({
    opacity: journalGlowOpacity.value,
  }));

  // Archive box stamp - solid box that appears on the crushed card
  const archiveBoxStyle = useAnimatedStyle(() => ({
    opacity: archiveFlashOpacity.value,
  }));

  // Photo fade during delete dissolve — photo vanishes quickly as pixels burst out
  const photoFadeStyle = useAnimatedStyle(() => {
    if (dissolveProgress.value <= 0) return { opacity: 1 };
    // Photo fades out fast in the first 15% of dissolve (instant shatter feel)
    const opacity = interpolate(dissolveProgress.value, [0, 0.15], [1, 0], 'clamp');
    return { opacity };
  });

  return {
    // Animated styles
    cardStyle,
    archiveOverlayStyle,
    journalOverlayStyle,
    deleteOverlayStyle,
    journalGlowStyle,
    archiveBoxStyle,
    photoFadeStyle,
    // Shared values for child components
    dissolveProgress,
    // Gesture handler
    panGesture,
    // State
    isActive,
    stackIndex,
  };
};

export default useSwipeableCard;
