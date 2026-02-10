import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import PixelSpinner from './PixelSpinner';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

/**
 * Retro 16-Bit Button Component
 * Blocky pixel borders, pixel font, CRT glow on primary
 */
const Button = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return [styles.button, styles.primaryButton, disabled && styles.disabledButton];
      case 'secondary':
        return [styles.button, styles.secondaryButton, disabled && styles.disabledButton];
      case 'outline':
        return [styles.button, styles.outlineButton, disabled && styles.disabledButton];
      case 'danger':
        return [styles.button, styles.dangerButton, disabled && styles.disabledButton];
      default:
        return [styles.button, styles.primaryButton];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return [styles.buttonText, styles.primaryButtonText];
      case 'secondary':
        return [styles.buttonText, styles.secondaryButtonText];
      case 'outline':
        return [styles.buttonText, styles.outlineButtonText];
      case 'danger':
        return [styles.buttonText, styles.dangerButtonText];
      default:
        return [styles.buttonText, styles.primaryButtonText];
    }
  };

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <PixelSpinner color={colors.text.primary} />
      ) : (
        <Text style={getTextStyle()}>{title?.toUpperCase()}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    letterSpacing: 1,
  },
  // Primary - electric cyan with dark text, CRT glow
  primaryButton: {
    backgroundColor: colors.interactive.primary,
    borderColor: colors.interactive.primary,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.text.inverse,
  },
  // Secondary - dark surface with pixel border
  secondaryButton: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.border.default,
  },
  secondaryButtonText: {
    color: colors.text.primary,
  },
  // Outline - transparent with retro border
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  outlineButtonText: {
    color: colors.text.primary,
  },
  // Danger - pixel red
  dangerButton: {
    backgroundColor: colors.status.danger,
    borderColor: colors.status.danger,
  },
  dangerButtonText: {
    color: colors.text.primary,
  },
  // Disabled state
  disabledButton: {
    opacity: 0.4,
  },
});

export default Button;
