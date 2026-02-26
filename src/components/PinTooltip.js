/**
 * PinTooltip — One-time explanatory tooltip for the pin feature
 *
 * Shows a dark bubble with a brief explanation of what pinning does.
 * Fades in when visible, fades out on dismiss.
 * Uses RN core Animated (not reanimated) per project convention for simple fades.
 *
 * Props:
 *   visible (boolean) — Whether the tooltip should be shown
 *   onDismiss (function) — Called when user dismisses the tooltip
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { animations } from '../constants/animations';

const PinTooltip = ({ visible, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: animations.duration.normal,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: animations.duration.fast,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.wrapper, { opacity }]}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onDismiss}
        accessibilityLabel="Dismiss tooltip"
      />
      <View style={styles.bubble}>
        <View style={styles.arrow} />
        <Text style={styles.text}>Pin this snap to their lock screen</Text>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton} activeOpacity={0.7}>
          <Text style={styles.dismissText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bubble: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    maxWidth: 260,
    shadowColor: colors.interactive.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  arrow: {
    position: 'absolute',
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.background.secondary,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.default,
    transform: [{ rotate: '45deg' }],
  },
  text: {
    fontFamily: typography.fontFamily.readable,
    fontSize: typography.size.sm,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  dismissButton: {
    backgroundColor: colors.interactive.primary,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  dismissText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    color: colors.text.inverse,
    textAlign: 'center',
  },
});

export default PinTooltip;
