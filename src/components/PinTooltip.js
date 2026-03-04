/**
 * PinTooltip - One-time explanatory tooltip for pin feature
 *
 * Appears above or near the PinToggle to explain what pinning does.
 * Fades in/out using RN core Animated API.
 *
 * Props:
 *   visible (boolean) - Whether tooltip is shown
 *   onDismiss (function) - Called when user dismisses the tooltip
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const FADE_DURATION = 250;

const PinTooltip = ({ visible, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.wrapper, { opacity }]}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss} />
      <View style={styles.bubble}>
        <View style={styles.arrow} />
        <Text style={styles.text}>Pin this snap to their lock screen</Text>
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginBottom: 8,
    zIndex: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    top: -200,
    bottom: -200,
    left: -200,
    right: -200,
  },
  bubble: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    alignItems: 'center',
    maxWidth: 260,
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
    marginBottom: 8,
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dismissText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    color: colors.brand.purple,
  },
});

export default PinTooltip;
