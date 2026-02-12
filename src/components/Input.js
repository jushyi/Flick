import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import PixelIcon from './PixelIcon';
import PixelSpinner from './PixelSpinner';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

/**
 * Retro 16-Bit Input Component
 * Terminal-style with pixel font, blocky borders, cyan glow on focus
 */
const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  error,
  style,
  showPasswordToggle = false,
  rightIcon = null,
  maxLength,
  showCharacterCount = false,
  ...props
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const previousLengthRef = useRef(value?.length || 0);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 4,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -4,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 4,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnimation]);

  const handleChangeText = useCallback(
    text => {
      const currentLength = text?.length || 0;
      const prevLength = previousLengthRef.current;

      if (maxLength && prevLength === maxLength && currentLength >= maxLength) {
        triggerShake();
      }

      previousLengthRef.current = currentLength;
      onChangeText?.(text);
    },
    [maxLength, onChangeText, triggerShake]
  );

  const handleFocus = useCallback(
    e => {
      setIsFocused(true);
      props.onFocus?.(e);
    },
    [props.onFocus]
  );

  const handleBlur = useCallback(
    e => {
      setIsFocused(false);
      props.onBlur?.(e);
    },
    [props.onBlur]
  );

  const currentLength = value?.length || 0;
  const showCounter = showCharacterCount && maxLength && isFocused;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label.toUpperCase()}</Text>}
      <Animated.View
        style={[styles.inputContainer, { transform: [{ translateX: shakeAnimation }] }]}
      >
        <TextInput
          style={[styles.input, isFocused && styles.inputFocused, error && styles.inputError]}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          cursorColor={colors.interactive.primary}
          selectionColor={colors.interactive.primary}
          {...props}
        />
        {showPasswordToggle && secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={togglePasswordVisibility}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.eyeIconText}>{isPasswordVisible ? '👁️' : '👁️‍🗨️'}</Text>
          </TouchableOpacity>
        )}
        {rightIcon === 'loading' && (
          <View style={styles.rightIcon}>
            <PixelSpinner size="small" color={colors.text.secondary} />
          </View>
        )}
        {rightIcon === 'check' && (
          <View style={styles.rightIcon}>
            <PixelIcon name="checkmark-circle" size={20} color={colors.status.ready} />
          </View>
        )}
      </Animated.View>
      {showCounter && (
        <Text style={styles.characterCounter}>
          {currentLength}/{maxLength}
        </Text>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    letterSpacing: 2,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    height: layout.dimensions.inputHeight,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    borderRadius: layout.borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    letterSpacing: 0,
  },
  inputFocused: {
    borderColor: colors.interactive.primary,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  inputError: {
    borderColor: colors.status.danger,
  },
  errorText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.status.danger,
    marginTop: spacing.xxs,
  },
  eyeIcon: {
    position: 'absolute',
    right: spacing.md,
    top: 14,
    padding: spacing.xxs,
  },
  eyeIconText: {
    fontSize: 20,
  },
  rightIcon: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
  },
  characterCounter: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing.xxs,
  },
});

export default Input;
