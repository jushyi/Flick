import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

/**
 * Retro 16-Bit Card Component
 * Blocky corners, subtle pixel border, CRT glow elevation
 */
const Card = ({ children, onPress, style, elevated = true }) => {
  const containerStyle = [styles.card, elevated && styles.elevated, style];

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  elevated: {
    ...layout.shadow.light,
  },
});

export default Card;
