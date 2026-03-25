import { useState, useCallback, useEffect, useImperativeHandle } from 'react';
import { Dimensions, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  runOnJS,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import logger from '../utils/logger';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const VERTICAL_THRESHOLD = 200;
const VELOCITY_THRESHOLD = 500;
const DIRECTION_LOCK_THRESHOLD = 30;
const CASCADE_DELAY_MS = 120;
const STACK_ENTRY_FADE_DURATION = 300;
const EXIT_DURATION = 350;
const CLEARANCE_DELAY: number = Platform.OS === 'android' ? 300 : 150;

const getStackScale = (idx: number): number => (idx === 0 ? 1 : idx === 1 ? 0.96 : 0.92);
const getStackOffset = (idx: number): number => (idx === 0 ? 0 : idx === 1 ? -20 : -40);
const getStackOpacity = (idx: number): number => (idx === 0 ? 1 : idx === 1 ? 0.85 : 0.7);

type PhotoLike = {
  id?: string;
  [key: string]: unknown;
};

type SwipeableCardParams = {
  photo: PhotoLike;
  onSwipeLeft?: () => Promise<void>;
  onSwipeRight?: () => Promise<void>;
  onSwipeDown?: () => Promise<void>;
  onDeleteComplete?: () => void;
  onExitClearance?: () => void;
  stackIndex?: number;
  isActive?: boolean;
  enterFrom?: 'up' | 'down' | 'delete' | null;
  isNewlyVisible?: boolean;
  keyboardVisible?: SharedValue<boolean> | null;
  ref?: React.Ref<SwipeableCardHandle>;
};

export type SwipeableCardHandle = {
  triggerArchive: () => void;
  triggerJournal: () => void;
  triggerDelete: () => void;
};

type SwipeableCardReturn = {
  cardStyle: ReturnType<typeof useAnimatedStyle>;
  archiveOverlayStyle: ReturnType<typeof useAnimatedStyle>;
  journalOverlayStyle: ReturnType<typeof useAnimatedStyle>;
  deleteOverlayStyle: ReturnType<typeof useAnimatedStyle>;
  panGesture: GestureType;
  isActive: boolean;
  stackIndex: number;
};

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
}: SwipeableCardParams): SwipeableCardReturn => {
  const [thresholdTriggered, setThresholdTriggered] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);

  const lockedDirection = useSharedValue(0);
  const isDeleteAction = useSharedValue(0);
  const hasAnimatedEntry = useSharedValue(false);

  const initialOpacity =
    isNewlyVisible && !hasAnimatedEntry.value ? 0 : getStackOpacity(stackIndex);
  const stackScaleAnim = useSharedValue(getStackScale(stackIndex));
  const stackOffsetAnim = useSharedValue(
    enterFrom === 'up'
      ? -SCREEN_HEIGHT
      : enterFrom === 'down' || enterFrom === 'delete'
        ? SCREEN_HEIGHT
        : getStackOffset(stackIndex)
  );
  const stackOpacityAnim = useSharedValue(initialOpacity);

  const prevStackIndex = useSharedValue(stackIndex);
  const isTransitioningToFront = useSharedValue(0);
  const actionInProgress = useSharedValue(false);
  const gestureActive = useSharedValue(0);
  const startY = useSharedValue(0);

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

  const resetThreshold = useCallback(() => {
    setThresholdTriggered(false);
  }, []);

  const scheduleClearanceCallback = useCallback(
    (delay: number) => {
      if (onExitClearance) {
        setTimeout(() => {
          onExitClearance();
        }, delay);
      }
    },
    [onExitClearance]
  );

  const markThresholdTriggered = useCallback(() => {
    if (!thresholdTriggered) {
      setThresholdTriggered(true);
      triggerLightHaptic();
      logger.debug('useSwipeableCard: Threshold reached', { photoId: photo?.id });
    }
  }, [thresholdTriggered, triggerLightHaptic, photo?.id]);

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

  const panGesture = Gesture.Pan()
    .enabled(isActive)
    .activeOffsetY([-5, 5])
    .onStart(() => {
      'worklet';
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

      if (lockedDirection.value === 0) {
        if (rawY < -DIRECTION_LOCK_THRESHOLD) {
          lockedDirection.value = 1;
        } else if (rawY > DIRECTION_LOCK_THRESHOLD) {
          lockedDirection.value = -1;
        }
      }

      translateY.value = startY.value + rawY;

      const absY = Math.abs(translateY.value);
      if (absY > VERTICAL_THRESHOLD) {
        runOnJS(markThresholdTriggered)();
      }
    })
    .onEnd(event => {
      'worklet';
      if (!gestureActive.value) return;
      if (actionInProgress.value) return;

      const velY = event.velocityY;

      const isUpAction = lockedDirection.value === 1 && translateY.value < -VERTICAL_THRESHOLD;
      const isUpVelocity = velY < -VELOCITY_THRESHOLD && event.translationY < 0;
      const isDownAction = lockedDirection.value === -1 && translateY.value > VERTICAL_THRESHOLD;
      const isDownVelocity = velY > VELOCITY_THRESHOLD && event.translationY > 0;

      const isUpSwipe = isUpAction || isUpVelocity;
      const isDownSwipe = isDownAction || isDownVelocity;

      if (isUpSwipe) {
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

  const cardStyle = useAnimatedStyle((): ViewStyle => {
    'worklet';
    const useStackAnimation = !actionInProgress.value && !gestureActive.value;

    const tx = useStackAnimation ? 0 : translateX.value;
    const ty = useStackAnimation ? stackOffsetAnim.value : translateY.value;
    const sc = useStackAnimation ? stackScaleAnim.value : cardScale.value;
    const op = useStackAnimation ? stackOpacityAnim.value : cardOpacity.value;

    return {
      transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
      opacity: op,
    } as ViewStyle;
  });

  const archiveOverlayStyle = useAnimatedStyle(() => {
    if (isDeleteAction.value) return { opacity: 0 };

    const opacity =
      translateY.value > 0
        ? interpolate(translateY.value, [0, VERTICAL_THRESHOLD], [0, 0.7], 'clamp')
        : 0;

    return { opacity };
  });

  const journalOverlayStyle = useAnimatedStyle(() => {
    const opacity =
      translateY.value < 0
        ? interpolate(Math.abs(translateY.value), [0, VERTICAL_THRESHOLD], [0, 0.7], 'clamp')
        : 0;

    return { opacity };
  });

  const deleteOverlayStyle = useAnimatedStyle(() => {
    if (!isDeleteAction.value) return { opacity: 0 };

    const opacity =
      translateY.value > 0
        ? interpolate(translateY.value, [0, VERTICAL_THRESHOLD], [0, 0.7], 'clamp')
        : 0;

    return { opacity };
  });

  return {
    cardStyle,
    archiveOverlayStyle,
    journalOverlayStyle,
    deleteOverlayStyle,
    panGesture,
    isActive,
    stackIndex,
  };
};

export default useSwipeableCard;
