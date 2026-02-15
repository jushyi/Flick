import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

/**
 * ColorPickerGrid
 *
 * Row of 4 preset color swatches + a "+" button to open a custom color picker.
 * The picker uses a hue bar + brightness bar built with LinearGradient and PanResponder.
 * Used in ContributionsScreen and EditProfileScreen.
 */

const PRESET_COLORS = [
  '#00D4FF', // Electric Cyan
  '#FF2D78', // Hot Magenta
  '#39FF14', // Neon Green
  '#FFD700', // Coin Gold
];

// Convert HSL to hex
const hslToHex = (h, s, l) => {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

// Hue bar colors (full rainbow at full saturation/50% lightness)
const HUE_COLORS = [
  '#FF0000',
  '#FF8000',
  '#FFFF00',
  '#80FF00',
  '#00FF00',
  '#00FF80',
  '#00FFFF',
  '#0080FF',
  '#0000FF',
  '#8000FF',
  '#FF00FF',
  '#FF0080',
  '#FF0000',
];

const BAR_HEIGHT = 32;
const THUMB_SIZE = 28;

const HueBar = ({ hue, onHueChange }) => {
  const barRef = useRef(null);
  const barWidth = useRef(0);
  const barPageX = useRef(0);

  const calcHue = useCallback(
    pageX => {
      if (barWidth.current <= 0) return;
      const x = Math.max(0, Math.min(pageX - barPageX.current, barWidth.current));
      onHueChange((x / barWidth.current) * 360);
    },
    [onHueChange]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: evt => calcHue(evt.nativeEvent.pageX),
      onPanResponderMove: evt => calcHue(evt.nativeEvent.pageX),
    })
  ).current;

  const thumbLeft =
    barWidth.current > 0
      ? Math.min(
          Math.max(0, (hue / 360) * barWidth.current - THUMB_SIZE / 2),
          barWidth.current - THUMB_SIZE
        )
      : 0;

  return (
    <View
      ref={barRef}
      style={styles.barContainer}
      onLayout={e => {
        barWidth.current = e.nativeEvent.layout.width;
        barRef.current?.measureInWindow(x => {
          barPageX.current = x;
        });
      }}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={HUE_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBar}
      />
      <View style={[styles.thumb, { left: thumbLeft }]} />
    </View>
  );
};

const BrightnessBar = ({ hue, brightness, onBrightnessChange }) => {
  const barRef = useRef(null);
  const barWidth = useRef(0);
  const barPageX = useRef(0);
  const pureColor = hslToHex(hue, 100, 50);

  const calcBrightness = useCallback(
    pageX => {
      if (barWidth.current <= 0) return;
      const x = Math.max(0, Math.min(pageX - barPageX.current, barWidth.current));
      onBrightnessChange((x / barWidth.current) * 100);
    },
    [onBrightnessChange]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: evt => calcBrightness(evt.nativeEvent.pageX),
      onPanResponderMove: evt => calcBrightness(evt.nativeEvent.pageX),
    })
  ).current;

  const thumbLeft =
    barWidth.current > 0
      ? Math.min(
          Math.max(0, (brightness / 100) * barWidth.current - THUMB_SIZE / 2),
          barWidth.current - THUMB_SIZE
        )
      : 0;

  return (
    <View
      ref={barRef}
      style={styles.barContainer}
      onLayout={e => {
        barWidth.current = e.nativeEvent.layout.width;
        barRef.current?.measureInWindow(x => {
          barPageX.current = x;
        });
      }}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={['#000000', pureColor, '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBar}
      />
      <View style={[styles.thumb, { left: thumbLeft }]} />
    </View>
  );
};

const ColorPickerGrid = ({ selectedColor, onColorSelect, onExpandPicker }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [hue, setHue] = useState(190);
  const [brightness, setBrightness] = useState(50);
  const isCustomColor = selectedColor && !PRESET_COLORS.includes(selectedColor);

  const customColor = hslToHex(hue, 100, brightness);

  const handlePresetPress = color => {
    setShowPicker(false);
    onColorSelect(color);
  };

  const handlePlusPress = () => {
    setShowPicker(prev => {
      if (!prev && onExpandPicker) {
        onExpandPicker();
      }
      return !prev;
    });
  };

  const handleSaveCustomColor = () => {
    onColorSelect(customColor);
    setShowPicker(false);
  };

  const handleResetPress = () => {
    setShowPicker(false);
    onColorSelect(null);
  };

  return (
    <View style={styles.container}>
      {/* Row: 4 presets + custom button */}
      <View style={styles.row}>
        {PRESET_COLORS.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.swatch,
              { backgroundColor: color },
              selectedColor === color && styles.swatchSelected,
            ]}
            onPress={() => handlePresetPress(color)}
            activeOpacity={0.7}
          >
            {selectedColor === color && (
              <PixelIcon name="checkmark" size={18} color={colors.background.primary} />
            )}
          </TouchableOpacity>
        ))}

        {/* Plus / custom color button */}
        <TouchableOpacity
          style={[
            styles.swatch,
            styles.plusSwatch,
            isCustomColor && { backgroundColor: selectedColor },
            showPicker && styles.swatchSelected,
          ]}
          onPress={handlePlusPress}
          activeOpacity={0.7}
        >
          {isCustomColor && !showPicker ? (
            <PixelIcon name="checkmark" size={18} color={colors.background.primary} />
          ) : (
            <PixelIcon
              name={showPicker ? 'close' : 'add'}
              size={24}
              color={isCustomColor ? colors.background.primary : colors.text.secondary}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Expanded custom picker */}
      {showPicker && (
        <View style={styles.pickerSection}>
          <Text style={styles.barLabel}>Hue</Text>
          <HueBar hue={hue} onHueChange={setHue} />

          <Text style={styles.barLabel}>Brightness</Text>
          <BrightnessBar hue={hue} brightness={brightness} onBrightnessChange={setBrightness} />

          {/* Preview + save row */}
          <View style={styles.pickerFooter}>
            <View style={styles.previewRow}>
              <View style={[styles.previewSwatch, { backgroundColor: customColor }]} />
              <Text style={[styles.previewName, { color: customColor }]}>Your Name</Text>
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveCustomColor}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reset to default */}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchSelected: {
    borderColor: colors.text.primary,
    borderWidth: 3,
  },
  plusSwatch: {
    backgroundColor: colors.background.secondary,
  },
  pickerSection: {
    marginBottom: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.md,
  },
  barLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  barContainer: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'visible',
    justifyContent: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  gradientBar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: colors.background.primary,
    top: (BAR_HEIGHT - THUMB_SIZE) / 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  pickerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  previewSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  previewName: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
  },
  saveButton: {
    backgroundColor: colors.brand.purple,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
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
