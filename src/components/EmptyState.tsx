/**
 * EmptyState
 *
 * Shared empty state component with pixel art icon, message, and optional CTA.
 * Used as ListEmptyComponent across all list views for consistent styling.
 *
 * Visual contract from 19-UI-SPEC:
 * - Container: flex 1, centered, paddingHorizontal 24px
 * - Icon: 48px PixelIcon, colors.text.tertiary (#4D4D6A)
 * - Message: 14px SpaceMono_400Regular, colors.text.secondary (#7B7B9E), centered
 * - CTA: 12px Silkscreen_700Bold, #00D4FF border+text, transparent background
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import PixelIcon from '@/components/PixelIcon';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  /** PixelIcon name (e.g., 'camera-outline') */
  icon: string;
  /** Message text (e.g., 'No photos yet') */
  message: string;
  /** Optional CTA button label (e.g., 'Add friends') */
  ctaLabel?: string;
  /** Optional CTA button press handler */
  onCtaPress?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmptyState({ icon, message, ctaLabel, onCtaPress }: EmptyStateProps) {
  return (
    <View testID="empty-state-container" style={styles.container}>
      <PixelIcon name={icon} size={48} color={colors.text.tertiary} />

      <Text style={styles.message}>{message}</Text>

      {ctaLabel && onCtaPress ? (
        <TouchableOpacity style={styles.ctaButton} onPress={onCtaPress} activeOpacity={0.7}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg, // 24px
  },
  message: {
    marginTop: spacing.md, // 16px
    fontSize: 14,
    fontFamily: 'SpaceMono_400Regular',
    color: colors.text.secondary, // #7B7B9E
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: spacing.lg, // 24px
    paddingVertical: spacing.xs, // 8px
    paddingHorizontal: spacing.md, // 16px
    borderWidth: 1,
    borderColor: colors.interactive.primary, // #00D4FF
    borderRadius: layout.borderRadius.md, // 4
    backgroundColor: 'transparent',
  },
  ctaText: {
    fontSize: 12,
    fontFamily: 'Silkscreen_700Bold',
    color: colors.interactive.primary, // #00D4FF
  },
});
