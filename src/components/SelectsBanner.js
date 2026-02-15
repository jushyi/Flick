import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import PixelIcon from './PixelIcon';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

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

  const stopAutoPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

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

  const handlePauseStart = useCallback(() => {
    setIsPaused(true);
    pauseOpacity.value = withTiming(0.9, { duration: 100 });
  }, [pauseOpacity]);

  const handlePauseEnd = useCallback(() => {
    setIsPaused(false);
    pauseOpacity.value = withTiming(1, { duration: 100 });
  }, [pauseOpacity]);

  const handleTap = useCallback(() => {
    if (onTap) {
      onTap();
    }
  }, [onTap]);

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

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pauseOpacity.value,
  }));

  if (selects.length === 0 && isOwnProfile) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <GestureDetector gesture={tapGesture}>
          <View style={styles.emptyContainer}>
            <PixelIcon name="camera-outline" size={48} color={colors.text.secondary} />
            <Text style={styles.emptyText}>Tap to add highlights</Text>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }

  if (selects.length === 0 && !isOwnProfile) {
    return (
      <View style={styles.emptyContainer}>
        <PixelIcon name="sad-outline" size={48} color={colors.text.secondary} />
        <Text style={styles.emptyText}>This user has no highlights</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <Image
            source={{ uri: selects[currentIndex] }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={150}
          />
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
    borderRadius: layout.borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    height: BANNER_HEIGHT,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    marginTop: spacing.sm,
  },
});

export default SelectsBanner;
