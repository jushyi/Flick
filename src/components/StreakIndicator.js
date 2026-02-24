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
  const fontSize =
    overlayText.length > 2 ? size * 0.3 : overlayText.length > 1 ? size * 0.35 : size * 0.4;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <PixelIcon name="snap-polaroid" size={size} color={iconColor} />
      {showOverlay && (
        <View style={styles.overlayContainer}>
          <Text
            style={[
              styles.overlayText,
              {
                fontSize,
                lineHeight: fontSize * 1.2,
                color: '#FFFFFF',
              },
            ]}
            allowFontScaling={false}
          >
            {overlayText}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    fontFamily: typography.fontFamily.body, // Silkscreen
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default StreakIndicator;
