import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

/**
 * Reusable Button Component
 * @param {string} title - Button text
 * @param {function} onPress - Function to call on press
 * @param {string} variant - 'primary', 'secondary', 'outline', 'danger'
 * @param {boolean} disabled - Whether button is disabled
 * @param {boolean} loading - Whether to show loading spinner
 * @param {object} style - Additional styles
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
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : '#000000'}
        />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Primary button (black background, white text)
  primaryButton: {
    backgroundColor: '#000000',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  // Secondary button (white background, black text)
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryButtonText: {
    color: '#000000',
  },
  // Outline button (transparent background, black border and text)
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000000',
  },
  outlineButtonText: {
    color: '#000000',
  },
  // Danger button (red background, white text)
  dangerButton: {
    backgroundColor: '#FF4444',
  },
  dangerButtonText: {
    color: '#FFFFFF',
  },
  // Disabled state
  disabledButton: {
    opacity: 0.5,
  },
});

export default Button;
