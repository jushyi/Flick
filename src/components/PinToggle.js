/**
 * PinToggle — Pin-to-screen toggle chip for the snap send screen
 *
 * Horizontal pill with a pixel icon, label text, and toggle indicator.
 * iOS-only: returns null on Android (Live Activities not supported).
 * Triggers light haptic feedback on toggle.
 *
 * Props:
 *   enabled (boolean) — Current toggle state
 *   onToggle (function) — Called with new boolean value on press
 *   disabled (boolean, optional) — Reduces opacity and disables presses
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

import * as Haptics from 'expo-haptics';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const PinToggle = memo(({ enabled, onToggle, disabled = false }) => {
  // iOS-only — Live Activities not available on Android
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
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      accessibilityLabel="Pin to screen"
    >
      <View
        style={[styles.container, enabled && styles.containerEnabled, disabled && styles.disabled]}
      >
        <PixelIcon
          name="pricetag-outline"
          size={18}
          color={enabled ? colors.status.developing : colors.icon.secondary}
        />
        <Text style={[styles.label, enabled && styles.labelEnabled]}>Pin to screen</Text>
        <View style={[styles.indicator, enabled && styles.indicatorEnabled]} />
      </View>
    </TouchableOpacity>
  );
});

PinToggle.displayName = 'PinToggle';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 8,
  },
  containerEnabled: {
    borderColor: colors.status.developing,
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  labelEnabled: {
    color: colors.status.developing,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.icon.tertiary,
    marginLeft: 2,
  },
  indicatorEnabled: {
    backgroundColor: colors.status.developing,
    shadowColor: colors.status.developing,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
});

export default PinToggle;
