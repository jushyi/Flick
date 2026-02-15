import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import ColorPicker, { HueCircular, Panel3, Preview } from 'reanimated-color-picker';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

/**
 * ColorPickerGrid
 *
 * Reusable color picker component for selecting name colors.
 * Features a color wheel, brightness panel, preset quick-picks, and reset option.
 * Used in ContributionsScreen and EditProfileScreen.
 */

// Curated preset colors that look good on dark backgrounds
const PRESET_COLORS = [
  '#00D4FF', // Electric Cyan
  '#FF2D78', // Hot Magenta
  '#39FF14', // Neon Green
  '#FFD700', // Coin Gold
  '#B24BF3', // Pixel Purple
  '#FF6B6B', // Coral Pink
  '#00FFC6', // Mint Glow
  '#9D00FF', // Violet Beam
  '#FF3366', // Neon Rose
  '#FF1493', // Deep Pink
];

const ColorPickerGrid = ({ selectedColor, onColorSelect }) => {
  const [wheelColor, setWheelColor] = useState(selectedColor || '#00D4FF');

  const handleWheelComplete = ({ hex }) => {
    setWheelColor(hex);
    onColorSelect(hex);
  };

  const handlePresetPress = color => {
    setWheelColor(color);
    onColorSelect(color);
  };

  const handleResetPress = () => {
    onColorSelect(null); // null means default (white)
  };

  return (
    <View style={styles.container}>
      {/* Color wheel */}
      <View style={styles.wheelContainer}>
        <ColorPicker value={wheelColor} onComplete={handleWheelComplete} style={styles.picker}>
          <HueCircular containerStyle={styles.hueCircular} thumbShape="circle" thumbSize={28}>
            <Panel3 style={styles.panel} />
          </HueCircular>
        </ColorPicker>
      </View>

      {/* Preview of selected color */}
      {selectedColor && (
        <View style={styles.previewRow}>
          <View style={[styles.previewSwatch, { backgroundColor: selectedColor }]} />
          <Text style={[styles.previewText, { color: selectedColor }]}>Your Name</Text>
          <Text style={styles.previewHex}>{selectedColor.toUpperCase()}</Text>
        </View>
      )}

      {/* Quick preset colors */}
      <Text style={styles.presetsLabel}>Quick picks</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsRow}
      >
        {PRESET_COLORS.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.presetSwatch,
              { backgroundColor: color },
              selectedColor === color && styles.presetSwatchSelected,
            ]}
            onPress={() => handlePresetPress(color)}
            activeOpacity={0.7}
          />
        ))}
      </ScrollView>

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
  wheelContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  picker: {
    width: 260,
    alignItems: 'center',
  },
  hueCircular: {
    width: 260,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  previewSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  previewText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.displayBold,
    flex: 1,
  },
  previewHex: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
  },
  presetsLabel: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  presetSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  presetSwatchSelected: {
    borderColor: colors.text.primary,
    borderWidth: 3,
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
