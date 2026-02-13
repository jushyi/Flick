import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

/**
 * ColorPickerGrid
 *
 * Reusable color picker component for selecting name colors.
 * Shows a grid of preset colors plus a "Reset to default" option.
 * Used in ContributionsScreen and EditProfileScreen.
 */

// Curated colors that look good on dark backgrounds
const PRESET_COLORS = [
  { value: '#00D4FF', label: 'Electric Cyan' },
  { value: '#FF2D78', label: 'Hot Magenta' },
  { value: '#39FF14', label: 'Neon Green' },
  { value: '#FFD700', label: 'Coin Gold' },
  { value: '#FF8C00', label: 'Retro Amber' },
  { value: '#B24BF3', label: 'Pixel Purple' },
  { value: '#FF6B6B', label: 'Coral Pink' },
  { value: '#00FFC6', label: 'Mint Glow' },
  { value: '#FF9900', label: 'Neon Orange' },
  { value: '#9D00FF', label: 'Violet Beam' },
  { value: '#FF3366', label: 'Neon Rose' },
  { value: '#00FF88', label: 'Spring Green' },
  { value: '#FFFF00', label: 'Lemon Zest' },
  { value: '#FF1493', label: 'Deep Pink' },
  { value: '#00CED1', label: 'Dark Turquoise' },
  { value: '#FFA500', label: 'Sunset Orange' },
];

const ColorPickerGrid = ({ selectedColor, onColorSelect }) => {
  const handleColorPress = color => {
    onColorSelect(color);
  };

  const handleResetPress = () => {
    onColorSelect(null); // null means default (white)
  };

  return (
    <View style={styles.container}>
      {/* Color grid */}
      <View style={styles.colorGrid}>
        {PRESET_COLORS.map(color => (
          <TouchableOpacity
            key={color.value}
            style={[
              styles.colorSwatch,
              { backgroundColor: color.value },
              selectedColor === color.value && styles.colorSwatchSelected,
            ]}
            onPress={() => handleColorPress(color.value)}
            activeOpacity={0.7}
          >
            {selectedColor === color.value && (
              <View style={styles.checkmarkContainer}>
                <PixelIcon name="checkmark" size={20} color={colors.background.primary} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Reset to default button */}
      <TouchableOpacity
        style={[styles.resetButton, selectedColor === null && styles.resetButtonSelected]}
        onPress={handleResetPress}
        activeOpacity={0.7}
      >
        <Text style={styles.resetButtonText}>Reset to default (white)</Text>
        {selectedColor === null && (
          <PixelIcon name="checkmark" size={20} color={colors.brand.purple} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  colorSwatch: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchSelected: {
    borderColor: colors.text.primary,
    borderWidth: 3,
  },
  checkmarkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  resetButtonSelected: {
    borderColor: colors.brand.purple,
  },
  resetButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
});

export default ColorPickerGrid;
