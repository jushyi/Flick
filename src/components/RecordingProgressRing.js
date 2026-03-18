/**
 * RecordingProgressRing - Animated circular progress ring for video recording
 *
 * Fills clockwise from 12 o'clock during recording.
 * Uses Reanimated animated props on SVG circle for smooth UI-thread animation.
 *
 * Usage:
 *   <RecordingProgressRing isRecording={true} maxDuration={30} size={80} />
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RecordingProgressRing = ({
  isRecording = false,
  maxDuration = 30,
  size = 80,
  strokeWidth = 4,
  color = '#FF3B30',
}) => {
  const progress = useSharedValue(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (isRecording) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: maxDuration * 1000,
        easing: Easing.linear,
      });
    } else {
      cancelAnimation(progress);
    }
  }, [isRecording, maxDuration, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background track ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.2}
        />
        {/* Foreground progress ring */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    transform: [{ rotateY: '0deg' }],
  },
});

export default RecordingProgressRing;
