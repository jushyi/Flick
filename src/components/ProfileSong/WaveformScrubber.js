/**
 * WaveformScrubber Component
 *
 * Displays audio timeline with drag-to-seek functionality.
 * Uses a simulated waveform visual (no native modules) for compatibility.
 *
 * Features:
 * - Visual waveform-like representation
 * - Drag to seek through the audio
 * - Playback position indicator
 * - Time display (current / total)
 */

import { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';

const BAR_COUNT = 60; // Number of bars in waveform visualization

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_WIDTH = SCREEN_WIDTH - 64; // Account for padding

/**
 * Format seconds to MM:SS display
 */
const formatTime = seconds => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Generate pseudo-random waveform heights based on song ID
 * Creates a consistent but varied pattern for visual appeal
 */
const generateWaveformData = songId => {
  const seed = songId ? songId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 12345;
  const bars = [];

  for (let i = 0; i < BAR_COUNT; i++) {
    // Create varied heights using sine waves and pseudo-random variation
    const base = Math.sin((i / BAR_COUNT) * Math.PI) * 0.3 + 0.4;
    const variation = Math.sin((i * 7 + seed) * 0.5) * 0.3;
    const height = Math.max(0.15, Math.min(1, base + variation));
    bars.push(height);
  }

  return bars;
};

const WaveformScrubber = ({
  songId,
  duration = 30,
  currentTime = 0, // Current playback position in seconds
  onSeek, // Callback when user drags to seek: (seconds) => void
  containerWidth = DEFAULT_WIDTH,
}) => {
  const waveformData = useMemo(() => generateWaveformData(songId), [songId]);
  const pixelsPerSecond = containerWidth / duration;
  const playbackX = useSharedValue(currentTime * pixelsPerSecond);

  // Track if user is currently dragging
  // Use both: shared value for worklet, regular ref for JS useEffect
  const isDraggingShared = useSharedValue(false);
  const isDraggingJS = useRef(false);

  // Update playback position when currentTime changes (only if not dragging)
  useEffect(() => {
    if (!isDraggingJS.current) {
      const targetX = currentTime * pixelsPerSecond;
      playbackX.value = withTiming(targetX, {
        duration: 50,
        easing: Easing.linear,
      });
    }
  }, [currentTime, pixelsPerSecond, playbackX]);

  const handleSeekJS = seconds => {
    if (onSeek) {
      onSeek(seconds);
    }
  };

  // JS-side dragging state setters (called from worklet via runOnJS)
  const setDraggingTrue = () => {
    isDraggingJS.current = true;
  };

  const setDraggingFalse = () => {
    isDraggingJS.current = false;
  };

  // Pan gesture for dragging to seek
  const panGesture = Gesture.Pan()
    .onBegin(e => {
      'worklet';
      isDraggingShared.value = true;
      runOnJS(setDraggingTrue)();
      // Jump to touch position immediately
      const clampedX = Math.max(0, Math.min(e.x, containerWidth));
      playbackX.value = clampedX;
      const seekTime = (clampedX / containerWidth) * duration;
      runOnJS(handleSeekJS)(seekTime);
    })
    .onUpdate(e => {
      'worklet';
      // Follow finger position
      const clampedX = Math.max(0, Math.min(e.x, containerWidth));
      playbackX.value = clampedX;
      const seekTime = (clampedX / containerWidth) * duration;
      runOnJS(handleSeekJS)(seekTime);
    })
    .onEnd(() => {
      'worklet';
      isDraggingShared.value = false;
      runOnJS(setDraggingFalse)();
    })
    .onFinalize(() => {
      'worklet';
      isDraggingShared.value = false;
      runOnJS(setDraggingFalse)();
    });

  const playbackIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playbackX.value }],
  }));

  const barWidth = (containerWidth - (BAR_COUNT - 1) * 2) / BAR_COUNT;
  const progressRatio = currentTime / duration;

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      {/* Simulated waveform visualization - draggable */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.waveformContainer}>
          {/* Waveform bars */}
          <View style={styles.barsContainer}>
            {waveformData.map((height, index) => {
              const barProgress = index / BAR_COUNT;
              const isPlayed = barProgress < progressRatio;
              return (
                <View
                  key={index}
                  style={[
                    styles.bar,
                    {
                      width: Math.max(2, barWidth),
                      height: height * 60,
                      backgroundColor: isPlayed ? colors.brand.purple : colors.text.tertiary,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Playback position indicator */}
          <Animated.View style={[styles.playbackIndicator, playbackIndicatorStyle]} />
        </Animated.View>
      </GestureDetector>

      {/* Time labels */}
      <View style={styles.timeContainer}>
        <Text style={styles.timeLabel}>{formatTime(currentTime)}</Text>
        <Text style={styles.timeLabelDuration}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  waveformContainer: {
    height: 80,
    position: 'relative',
    justifyContent: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
  },
  bar: {
    borderRadius: 1,
  },
  playbackIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.text.primary,
    borderRadius: 1.5,
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xxs,
  },
  timeLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  timeLabelDuration: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
});

export default WaveformScrubber;
