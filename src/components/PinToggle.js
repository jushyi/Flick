/**
 * PinToggle - Pixel-art styled toggle for "pin to screen" feature
 *
 * Renders a dark pill/chip with a pin indicator and toggle switch.
 * iOS-only: returns null on Android.
 *
 * Props:
 *   enabled (boolean) - Current toggle state
 *   onToggle (function) - Called with new boolean value on press
 *   disabled (boolean, optional) - Reduces opacity and ignores presses
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

import * as Haptics from 'expo-haptics';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const PIN_AMBER = '#F5A623';
const PIN_MUTED = colors.icon.tertiary;

const PinToggle = ({ enabled, onToggle, disabled = false }) => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(!enabled);
  };

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled]}
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled}
    >
      <View style={styles.iconContainer}>
        <PixelIcon name="notifications-outline" size={18} color={enabled ? PIN_AMBER : PIN_MUTED} />
      </View>

      <Text style={[styles.label, enabled && styles.labelEnabled]}>Pin to screen</Text>

      <View style={[styles.track, enabled && styles.trackEnabled]}>
        <View style={[styles.thumb, enabled && styles.thumbEnabled]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  disabled: {
    opacity: 0.4,
  },
  iconContainer: {
    marginRight: 8,
  },
  label: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  labelEnabled: {
    color: colors.text.primary,
  },
  track: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  trackEnabled: {
    backgroundColor: PIN_AMBER,
    borderColor: PIN_AMBER,
  },
  thumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.icon.secondary,
  },
  thumbEnabled: {
    alignSelf: 'flex-end',
    backgroundColor: colors.text.primary,
  },
});

export default PinToggle;
