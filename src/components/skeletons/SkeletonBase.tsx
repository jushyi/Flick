import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet, ViewStyle, DimensionValue } from 'react-native';

import { colors } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SHIMMER_WIDTH = 100;

/**
 * Hook that creates a looping shimmer animation.
 * Returns an Animated.Value that sweeps from -SHIMMER_WIDTH to SCREEN_WIDTH
 * over 800ms in an infinite loop.
 */
export function useShimmer(): Animated.Value {
  const shimmerPosition = useRef(new Animated.Value(-SHIMMER_WIDTH)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerPosition, {
        toValue: SCREEN_WIDTH,
        duration: 800,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerPosition]);

  return shimmerPosition;
}

interface SkeletonShapeProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  shimmerPosition: Animated.Value;
  style?: ViewStyle;
  testID?: string;
}

/**
 * A single skeleton placeholder shape with shimmer animation.
 * Renders a rectangle with the tertiary background color and
 * a semi-transparent white bar sweeping across it.
 */
export function SkeletonShape({
  width,
  height,
  borderRadius = 0,
  shimmerPosition,
  style,
  testID,
}: SkeletonShapeProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.shape,
        { width, height, borderRadius },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            width: SHIMMER_WIDTH,
            transform: [{ translateX: shimmerPosition }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shape: {
    backgroundColor: colors.background.tertiary,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
