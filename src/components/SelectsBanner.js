import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const BANNER_HEIGHT = 250;
const CYCLE_INTERVAL_MS = 750; // Faster cycling

/**
 * SelectsBanner - Auto-playing slideshow of user's highlight photos
 *
 * @param {Array} selects - Array of photo URIs
 * @param {boolean} isOwnProfile - Whether viewing own profile
 * @param {function} onTap - Callback when banner is tapped
 */
const SelectsBanner = ({ selects = [], isOwnProfile = true, onTap }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  // Animated opacity for pause feedback
  const pauseOpacity = useSharedValue(1);

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
    if (!isPaused && selects.length > 1) {
      startAutoPlay();
    } else {
      stopAutoPlay();
    }

    return () => stopAutoPlay();
  }, [isPaused, selects.length, startAutoPlay, stopAutoPlay]);

  // Reset index when selects change
  useEffect(() => {
    setCurrentIndex(0);
  }, [selects]);

  // Handle pause state
  const handlePauseStart = useCallback(() => {
    setIsPaused(true);
    pauseOpacity.value = withTiming(0.9, { duration: 100 });
  }, [pauseOpacity]);

  const handlePauseEnd = useCallback(() => {
    setIsPaused(false);
    pauseOpacity.value = withTiming(1, { duration: 100 });
  }, [pauseOpacity]);

  // Handle tap
  const handleTap = useCallback(() => {
    if (onTap) {
      onTap();
    }
  }, [onTap]);

  // Gestures
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

  // Tap for quick taps (< 150ms)
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

  // Empty state - own profile
  if (selects.length === 0 && isOwnProfile) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={tapGesture}>
          <View style={styles.emptyContainer}>
            <Ionicons name="camera-outline" size={48} color={colors.text.secondary} />
            <Text style={styles.emptyText}>Tap to add highlights</Text>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }

  // Empty state - other profile
  if (selects.length === 0 && !isOwnProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="sad-outline" size={48} color={colors.text.secondary} />
        <Text style={styles.emptyText}>This user has no highlights</Text>
      </View>
    );
  }

  // Photo slideshow
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <Image source={{ uri: selects[currentIndex] }} style={styles.image} resizeMode="cover" />
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    height: BANNER_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    height: BANNER_HEIGHT,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 16,
    marginTop: 12,
  },
});

export default SelectsBanner;
