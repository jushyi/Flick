/**
 * SnapProgressRing - Amber circular progress ring for snap upload state
 *
 * SVG-based indeterminate spinner that wraps around content (camera icon).
 * Uses RN core Animated for simple rotation per project convention.
 *
 * Usage:
 *   <SnapProgressRing size={40} color="#F5A623">
 *     <PixelIcon name="camera" size={20} color="#F5A623" />
 *   </SnapProgressRing>
 */

import React, { useRef, useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

import Svg, { Circle } from 'react-native-svg';

const SnapProgressRing = ({ size = 40, color = '#F5A623', strokeWidth = 3, children }) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Show 70% of the ring as a visible arc
  const dashArray = `${circumference * 0.7} ${circumference * 0.3}`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[styles.ringContainer, { transform: [{ rotate: spin }] }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
      <View style={styles.childrenContainer}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringContainer: {
    position: 'absolute',
  },
  childrenContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SnapProgressRing;
