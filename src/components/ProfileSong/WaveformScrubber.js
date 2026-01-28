/**
 * WaveformScrubber Component
 *
 * Displays audio timeline with dual-handle range selection.
 * Uses a simulated waveform visual (no native modules) for compatibility.
 *
 * Features:
 * - Visual waveform-like representation
 * - Draggable start and end handles
 * - Visual feedback for selected range
 * - Time display for handles
 */

import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../constants/colors';

const MIN_CLIP_GAP = 5; // Minimum 5 seconds between start and end
const HANDLE_WIDTH = 4;
const HANDLE_TOUCH_SIZE = 40;
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
  initialStart = 0,
  initialEnd = 30,
  duration = 30,
  onRangeChange,
  containerWidth = DEFAULT_WIDTH,
  currentTime = 0, // Current playback position in seconds (0 if not playing)
}) => {
  // Range state for display
  const [startSec, setStartSec] = useState(initialStart);
  const [endSec, setEndSec] = useState(initialEnd);

  // Generate waveform data based on songId
  const waveformData = useMemo(() => generateWaveformData(songId), [songId]);

  // Calculate pixels per second for worklet use
  const pixelsPerSecond = containerWidth / duration;
  const minGapPixels = MIN_CLIP_GAP * pixelsPerSecond;

  // Animated values for handle positions (in pixels)
  const startX = useSharedValue(initialStart * pixelsPerSecond);
  const endX = useSharedValue(initialEnd * pixelsPerSecond);

  // Context for gesture tracking
  const startContext = useSharedValue(0);
  const endContext = useSharedValue(0);

  // Playback position indicator
  const playbackX = useSharedValue(0);

  // Update playback position when currentTime changes
  useEffect(() => {
    if (currentTime > 0) {
      // Position relative to clip start, within the selected range
      const relativePosition = (currentTime / (endSec - startSec)) * (endX.value - startX.value);
      // Use linear easing for smooth constant-speed movement matching audio playback
      // Duration matches audioPlayer's 50ms progress update interval
      playbackX.value = withTiming(startX.value + relativePosition, {
        duration: 50,
        easing: Easing.linear,
      });
    } else {
      // Reset to start position without animation when stopping
      playbackX.value = startX.value;
    }
  }, [currentTime, startSec, endSec]);

  // Use animated reaction to sync shared values to state
  useAnimatedReaction(
    () => startX.value,
    currentValue => {
      'worklet';
      const seconds = Math.max(0, Math.min(currentValue / pixelsPerSecond, duration));
      runOnJS(setStartSec)(Math.round(seconds * 10) / 10);
    },
    [pixelsPerSecond, duration]
  );

  useAnimatedReaction(
    () => endX.value,
    currentValue => {
      'worklet';
      const seconds = Math.max(0, Math.min(currentValue / pixelsPerSecond, duration));
      runOnJS(setEndSec)(Math.round(seconds * 10) / 10);
    },
    [pixelsPerSecond, duration]
  );

  // Notify parent of range change
  useEffect(() => {
    if (onRangeChange) {
      onRangeChange(startSec, endSec);
    }
  }, [startSec, endSec, onRangeChange]);

  // Start handle gesture
  const startPanGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startContext.value = startX.value;
    })
    .onUpdate(e => {
      'worklet';
      const newX = startContext.value + e.translationX;
      const maxX = endX.value - minGapPixels;
      startX.value = Math.min(Math.max(0, newX), maxX);
    })
    .onEnd(() => {
      'worklet';
      startX.value = withSpring(startX.value, { damping: 15 });
    });

  // End handle gesture
  const endPanGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      endContext.value = endX.value;
    })
    .onUpdate(e => {
      'worklet';
      const newX = endContext.value + e.translationX;
      const minX = startX.value + minGapPixels;
      endX.value = Math.max(minX, Math.min(newX, containerWidth));
    })
    .onEnd(() => {
      'worklet';
      endX.value = withSpring(endX.value, { damping: 15 });
    });

  // Animated styles for handles
  const startHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: startX.value - HANDLE_WIDTH / 2 }],
  }));

  const endHandleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endX.value - HANDLE_WIDTH / 2 }],
  }));

  // Animated style for left dimmed region
  const leftDimStyle = useAnimatedStyle(() => ({
    width: startX.value,
  }));

  // Animated style for right dimmed region
  const rightDimStyle = useAnimatedStyle(() => ({
    width: containerWidth - endX.value,
    right: 0,
  }));

  // Animated style for playback position indicator
  const playbackIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playbackX.value }],
  }));

  // Calculate bar width
  const barWidth = (containerWidth - (BAR_COUNT - 1) * 2) / BAR_COUNT;

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      {/* Simulated waveform visualization */}
      <View style={styles.waveformContainer}>
        {/* Waveform bars */}
        <View style={styles.barsContainer}>
          {waveformData.map((height, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  width: Math.max(2, barWidth),
                  height: height * 60,
                },
              ]}
            />
          ))}
        </View>

        {/* Range selection overlay */}
        <View style={styles.overlayContainer}>
          {/* Left dimmed region */}
          <Animated.View style={[styles.dimRegion, styles.dimRegionLeft, leftDimStyle]} />

          {/* Right dimmed region */}
          <Animated.View style={[styles.dimRegion, styles.dimRegionRight, rightDimStyle]} />

          {/* Start handle */}
          <GestureDetector gesture={startPanGesture}>
            <Animated.View style={[styles.handleContainer, startHandleStyle]}>
              <View style={styles.handle} />
              <View style={styles.handleKnob} />
            </Animated.View>
          </GestureDetector>

          {/* End handle */}
          <GestureDetector gesture={endPanGesture}>
            <Animated.View style={[styles.handleContainer, endHandleStyle]}>
              <View style={styles.handle} />
              <View style={styles.handleKnob} />
            </Animated.View>
          </GestureDetector>

          {/* Playback position indicator - only visible when playing */}
          {currentTime > 0 && (
            <Animated.View style={[styles.playbackIndicator, playbackIndicatorStyle]} />
          )}
        </View>
      </View>

      {/* Time labels */}
      <View style={styles.timeContainer}>
        <Text style={styles.timeLabel}>{formatTime(startSec)}</Text>
        <Text style={styles.timeLabelDuration}>{formatTime(endSec - startSec)} selected</Text>
        <Text style={styles.timeLabel}>{formatTime(endSec)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
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
    backgroundColor: colors.text.tertiary,
    borderRadius: 1,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dimRegion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.background.primary,
    opacity: 0.7,
  },
  dimRegionLeft: {
    left: 0,
  },
  dimRegionRight: {
    // width set by animated style
  },
  handleContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_TOUCH_SIZE,
    marginLeft: -HANDLE_TOUCH_SIZE / 2 + HANDLE_WIDTH / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    width: HANDLE_WIDTH,
    height: '100%',
    backgroundColor: colors.brand.purple,
    borderRadius: HANDLE_WIDTH / 2,
  },
  handleKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand.purple,
    borderWidth: 2,
    borderColor: colors.text.primary,
  },
  playbackIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.text.primary,
    borderRadius: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  timeLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  timeLabelDuration: {
    fontSize: 12,
    color: colors.brand.purple,
    fontWeight: '600',
  },
});

export default WaveformScrubber;
