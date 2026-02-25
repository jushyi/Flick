/**
 * StreakIndicator - Streak-aware snap icon component
 *
 * Renders the snap-polaroid PixelIcon with streak-dependent coloring and overlay.
 * Drop-in replacement for direct PixelIcon snap-polaroid calls in:
 * - ConversationRow (messages list)
 * - ConversationHeader
 * - DMInput (snap camera shortcut)
 *
 * Visual states:
 * - default:  Muted gray icon, no overlay
 * - building: Warm tint icon, no overlay
 * - pending:  Warm tint icon, no overlay
 * - active:   Tier-colored icon + day count overlay
 * - warning:  Red icon + "!" overlay
 *
 * State transitions are instant (no animation per user decision).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import PixelIcon from './PixelIcon';

import { getStreakColor } from '../services/firebase/streakService';

import { typography } from '../constants/typography';

const StreakIndicator = ({ streakState = 'default', dayCount = 0, size = 18 }) => {
  const iconColor = getStreakColor(streakState, dayCount);
  const showOverlay = streakState === 'active' || streakState === 'warning';
  const overlayText = streakState === 'warning' ? '!' : String(dayCount);
  const fontSize = size * 0.6;

  return (
    <View style={styles.container}>
      <PixelIcon name="snap-polaroid" size={size} color={iconColor} />
      {showOverlay && (
        <Text style={[styles.countText, { fontSize, color: iconColor }]} allowFontScaling={false}>
          {overlayText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  countText: {
    fontFamily: typography.fontFamily.body,
    textAlign: 'center',
    marginTop: 1,
    backgroundColor: 'transparent',
  },
});

export default StreakIndicator;
