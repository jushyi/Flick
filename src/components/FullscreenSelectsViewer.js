import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CYCLE_INTERVAL_MS = 750; // Faster cycling

/**
 * FullscreenSelectsViewer - Fullscreen modal for viewing another user's selects
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {Array} selects - Array of photo URIs
 * @param {number} initialIndex - Which photo to start on
 * @param {function} onClose - Callback when viewer is closed
 */
const FullscreenSelectsViewer = ({ visible, selects = [], initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  // Animated opacity for pause feedback
  const pauseOpacity = useSharedValue(1);

  // Reset index when opening with new initialIndex
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setIsPaused(false);
    }
  }, [visible, initialIndex]);

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

  // Handle tap to close
  const handleTap = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

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
    runOnJS(handleTap)();
  });

  // Exclusive: LongPress checked first, Tap wins if released before 150ms
  const composedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  // Animated style for pause feedback
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pauseOpacity.value,
  }));

  if (!visible || selects.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.container, animatedStyle]}>
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
              {/* Close button in top-right corner */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>

              {/* Fullscreen image */}
              <Image
                source={{ uri: selects[currentIndex] }}
                style={styles.image}
                resizeMode="contain"
              />

              {/* Pause indicator */}
              {isPaused && (
                <View style={styles.pauseIndicator}>
                  <Ionicons name="pause" size={24} color={colors.text.primary} />
                </View>
              )}
            </SafeAreaView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    bottom: 32,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});

export default FullscreenSelectsViewer;
