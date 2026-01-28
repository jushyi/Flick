/**
 * WaveformScrubber Component
 *
 * Displays audio timeline with tap-to-seek functionality.
 * Uses a simulated waveform visual (no native modules) for compatibility.
 *
 * Features:
 * - Visual waveform-like representation
 * - Tap anywhere to seek to that position
 * - Playback position indicator
 * - Time display (current / total)
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '../../constants/colors';

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
  onSeek, // Callback when user taps to seek: (seconds) => void
  containerWidth = DEFAULT_WIDTH,
}) => {
  // Generate waveform data based on songId
  const waveformData = useMemo(() => generateWaveformData(songId), [songId]);

  // Calculate pixels per second
  const pixelsPerSecond = containerWidth / duration;

  // Playback position indicator
  const playbackX = useSharedValue(0);

  // Update playback position when currentTime changes
  useAnimatedReaction(
    () => currentTime,
    time => {
      'worklet';
      const targetX = time * pixelsPerSecond;
      // Use linear easing for smooth constant-speed movement matching audio playback
      playbackX.value = withTiming(targetX, {
        duration: 50,
        easing: Easing.linear,
      });
    },
    [currentTime, pixelsPerSecond]
  );

  // Animated style for playback position indicator
  const playbackIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playbackX.value }],
  }));

  // Handle tap to seek
  const handlePress = event => {
    if (onSeek) {
      const { locationX } = event.nativeEvent;
      const seekTime = Math.max(0, Math.min((locationX / containerWidth) * duration, duration));
      onSeek(seekTime);
    }
  };

  // Calculate bar width
  const barWidth = (containerWidth - (BAR_COUNT - 1) * 2) / BAR_COUNT;

  // Calculate progress percentage for bar coloring
  const progressRatio = currentTime / duration;

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      {/* Simulated waveform visualization - tappable */}
      <Pressable onPress={handlePress} style={styles.waveformContainer}>
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
      </Pressable>

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
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
});

export default WaveformScrubber;
