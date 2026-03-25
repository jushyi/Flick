/**
 * RecordingProgressRing - Segmented circular progress ring for video recording
 *
 * Shows one segment per second of max recording duration.
 * Segments fill in clockwise from 12 o'clock, one per second, with
 * Reanimated-driven timing for perfectly linear pacing.
 *
 * Props:
 *   isRecording - whether recording is active
 *   maxDuration - total segments / seconds (default 30)
 *   size        - diameter of the ring
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Easing,
  useSharedValue,
  withTiming,
  cancelAnimation,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

type Props = {
  isRecording?: boolean;
  maxDuration?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
};

const RecordingProgressRing = ({
  isRecording = false,
  maxDuration = 30,
  size = 100,
  strokeWidth = 4,
  color = '#FF3B30',
}: Props) => {
  const progress = useSharedValue(0); // 0 → maxDuration over recording
  const [filledCount, setFilledCount] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segmentCount = maxDuration;
  const gapAngleDeg = 4;
  const gapLength = (gapAngleDeg / 360) * circumference;
  const segmentLength = circumference / segmentCount - gapLength;

  // Reanimated native-thread timer for perfectly linear progress
  useEffect(() => {
    if (isRecording) {
      progress.value = 0;
      progress.value = withTiming(maxDuration, {
        duration: maxDuration * 1000,
        easing: Easing.linear,
      });
    } else {
      cancelAnimation(progress);
      progress.value = 0;
      setFilledCount(0);
    }
  }, [isRecording, maxDuration, progress]);

  // Update React state when progress crosses an integer boundary
  useAnimatedReaction(
    () => Math.floor(progress.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setFilledCount)(current);
      }
    },
    [progress]
  );

  // Build dasharray: filled segments visible, unfilled hidden
  const buildForegroundDashArray = filled => {
    const parts = [];
    for (let i = 0; i < segmentCount; i++) {
      if (i < filled) {
        parts.push(segmentLength);
        parts.push(gapLength);
      } else {
        parts.push(0);
        parts.push(segmentLength + gapLength);
      }
    }
    return parts.join(' ');
  };

  const backgroundDashArray = `${segmentLength} ${gapLength}`;
  const foregroundDashArray = buildForegroundDashArray(filledCount);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background: faint segmented track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.15}
          strokeDasharray={backgroundDashArray}
          strokeLinecap="butt"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
        {/* Foreground: filled segments */}
        {filledCount > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={foregroundDashArray}
            strokeLinecap="butt"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
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
});

export default RecordingProgressRing;
