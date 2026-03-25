import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CYCLE_INTERVAL_MS = 750;

/**
 * FullscreenSelectsViewer - Fullscreen modal for viewing another user's selects
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {Array} selects - Array of photo URIs
 * @param {number} initialIndex - Which photo to start on
 * @param {function} onClose - Callback when viewer is closed
 */
type Props = {
  visible: boolean;
  selects?: string[];
  initialIndex?: number;
  onClose: () => void;
};

const FullscreenSelectsViewer = ({ visible, selects = [], initialIndex = 0, onClose }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();

  // Animated values
  const pauseOpacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const dismissScale = useSharedValue(1);
  const containerOpacity = useSharedValue(0);

  // Reset and animate in when opening
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setIsPaused(false);
      translateY.value = 0;
      dismissScale.value = 0.95;
      containerOpacity.value = 0;
      containerOpacity.value = withTiming(1, { duration: 200 });
      dismissScale.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = 0;
      dismissScale.value = 1;
      containerOpacity.value = 0;
    }
  }, [visible, initialIndex, translateY, dismissScale, containerOpacity]);

  // Start/restart auto-play interval
  const startAutoPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (selects.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % selects.length);
      }, CYCLE_INTERVAL_MS);
    }
  }, [selects.length]);

  // Stop auto-play
  const stopAutoPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (visible && !isPaused && selects.length > 1) {
      startAutoPlay();
    } else {
      stopAutoPlay();
    }

    return () => stopAutoPlay();
  }, [visible, isPaused, selects.length, startAutoPlay, stopAutoPlay]);

  // Handle pause state
  const handlePauseStart = useCallback(() => {
    setIsPaused(true);
    pauseOpacity.value = withTiming(0.85, { duration: 100 });
  }, [pauseOpacity]);

  const handlePauseEnd = useCallback(() => {
    setIsPaused(false);
    pauseOpacity.value = withTiming(1, { duration: 100 });
  }, [pauseOpacity]);

  // Animated close - slide down + fade out
  const handleAnimatedClose = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT * 0.3, {
      duration: 200,
      easing: Easing.in(Easing.cubic),
    });
    dismissScale.value = withTiming(0.9, { duration: 200 });
    containerOpacity.value = withTiming(0, { duration: 200 }, finished => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [translateY, dismissScale, containerOpacity, onClose]);

  // LongPress for hold-to-pause (activates after 150ms hold)
  const longPressGesture = Gesture.LongPress()
    .minDuration(150)
    .onStart(() => {
      'worklet';
      runOnJS(handlePauseStart)();
    })
    .onEnd(() => {
      'worklet';
      runOnJS(handlePauseEnd)();
    });

  // Tap for quick taps (< 150ms) to close
  const tapGesture = Gesture.Tap().onEnd(() => {
    'worklet';
    runOnJS(handleAnimatedClose)();
  });

  // Pan gesture for swipe-to-dismiss
  const panGesture = Gesture.Pan()
    .activeOffsetY(5)
    .failOffsetY(-5)
    .onUpdate(event => {
      'worklet';
      const dy = Math.max(0, event.translationY);
      translateY.value = dy;

      const dragRatio = Math.min(1, dy / SCREEN_HEIGHT);
      dismissScale.value = 1 - dragRatio * 0.15;
      containerOpacity.value = Math.max(0.2, 1 - dragRatio * 0.8);
    })
    .onEnd(event => {
      'worklet';
      const dy = event.translationY;
      const vy = event.velocityY;

      const shouldDismiss = dy > SCREEN_HEIGHT / 3 || vy > 500;

      if (shouldDismiss) {
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: 220,
          easing: Easing.in(Easing.cubic),
        });
        containerOpacity.value = withTiming(0, { duration: 220 }, finished => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
      } else {
        translateY.value = withSpring(0, { stiffness: 50, damping: 10 });
        dismissScale.value = withSpring(1, { stiffness: 50, damping: 10 });
        containerOpacity.value = withSpring(1, { stiffness: 50, damping: 10 });
      }
    });

  // Race: Pan wins if finger moves down 5px+, otherwise tap/longpress
  const composedGesture = Gesture.Race(panGesture, Gesture.Exclusive(longPressGesture, tapGesture));

  // Combined animated style
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value * pauseOpacity.value,
    transform: [{ translateY: translateY.value }, { scale: dismissScale.value }],
  }));

  if (!visible || selects.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="none" transparent={false} onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.container, animatedStyle]}>
            <View style={styles.safeArea}>
              {/* Close button in top-right corner */}
              <TouchableOpacity
                style={[styles.closeButton, { top: insets.top + spacing.xs }]}
                onPress={handleAnimatedClose}
                activeOpacity={0.7}
              >
                <PixelIcon name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>

              {/* Fullscreen image */}
              <Image
                source={{ uri: selects[currentIndex] }}
                style={styles.image}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
              />

              {/* Pause indicator */}
              {isPaused && (
                <View style={[styles.pauseIndicator, { bottom: insets.bottom + spacing.xl }]}>
                  <PixelIcon name="pause" size={24} color={colors.text.primary} />
                </View>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: layout.borderRadius.round,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  pauseIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});

export default FullscreenSelectsViewer;
