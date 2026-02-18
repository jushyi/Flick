import React, { useRef, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

const CODE_LENGTH = 6;

/**
 * Retro 16-Bit AuthCodeInput
 * Square pixel boxes, display font digits, cyan glow on active
 */
const AuthCodeInput = ({
  value = '',
  onChange,
  onComplete,
  error = false,
  disabled = false,
  autoFocus = false,
  testID,
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (value.length === CODE_LENGTH && onComplete) {
      onComplete(value);
    }
  }, [value, onComplete]);

  const handleChangeText = text => {
    const numericText = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    onChange(numericText);
  };

  const handlePress = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  const renderBoxes = () => {
    const boxes = [];
    for (let i = 0; i < CODE_LENGTH; i++) {
      const digit = value[i] || '';
      const isActive = i === value.length && value.length < CODE_LENGTH;
      const isFilled = digit !== '';

      boxes.push(
        <View
          key={i}
          style={[
            styles.box,
            isActive && styles.boxActive,
            error && styles.boxError,
            isFilled && styles.boxFilled,
          ]}
        >
          <Text style={styles.digit}>{digit}</Text>
        </View>
      );
    }
    return boxes;
  };

  return (
    <Pressable style={styles.container} onPress={handlePress} testID={testID}>
      <View style={styles.boxesContainer}>{renderBoxes()}</View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        editable={!disabled}
        maxLength={CODE_LENGTH}
        caretHidden
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  boxesContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  box: {
    width: spacing.xxxl,
    height: spacing.huge,
    borderRadius: layout.borderRadius.xs,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: colors.interactive.primary,
    shadowColor: colors.interactive.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  boxFilled: {
    borderColor: colors.border.default,
  },
  boxError: {
    borderColor: colors.status.danger,
    shadowColor: colors.status.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  digit: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    ...Platform.select({ android: { lineHeight: 26 } }),
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    // Android marks opacity:0 inputs as non-focusable, which prevents keyboard from opening
    opacity: Platform.OS === 'android' ? 0.01 : 0,
  },
});

export default AuthCodeInput;
