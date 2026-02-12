import React, { useRef, useEffect, memo } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';

import { colors } from '../constants/colors';
import { animations } from '../constants/animations';

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 20;
const THUMB_OFFSET = 4;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2;

/**
 * PixelToggle — 16-Bit Retro Toggle Switch
 * Blocky track + square thumb with CRT cyan glow when ON.
 * Drop-in replacement for native Switch.
 */
const PixelToggle = memo(({ value, onValueChange, disabled = false, style }) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: animations.duration.fast,
      useNativeDriver: false,
    }).start();
  }, [value, animatedValue]);

  const thumbTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_OFFSET, THUMB_OFFSET + THUMB_TRAVEL],
  });

  const trackBackgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.background.tertiary, colors.interactive.primary],
  });

  const trackBorderColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border.default, colors.interactive.primary],
  });

  const handlePress = () => {
    if (!disabled && onValueChange) {
      onValueChange(!value);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={style}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: trackBackgroundColor,
            borderColor: trackBorderColor,
          },
          value && styles.trackGlow,
          disabled && styles.disabled,
        ]}
      >
        <Animated.View style={[styles.thumb, { transform: [{ translateX: thumbTranslateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
});

PixelToggle.displayName = 'PixelToggle';

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 2,
    borderWidth: 2,
    justifyContent: 'center',
  },
  trackGlow: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 2,
    backgroundColor: colors.text.primary,
    position: 'absolute',
  },
  disabled: {
    opacity: 0.4,
  },
});

export default PixelToggle;
