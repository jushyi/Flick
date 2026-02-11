import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';

/**
 * Retro 16-Bit StepIndicator
 * Pixel squares instead of dots, "STAGE X/Y" in display font
 */
const StepIndicator = ({ currentStep, totalSteps, style }) => {
  const squares = [];

  for (let i = 1; i <= totalSteps; i++) {
    const isCurrentStep = i === currentStep;
    const isCompleted = i < currentStep;
    squares.push(
      <View
        key={i}
        style={[
          styles.square,
          isCurrentStep
            ? styles.squareActive
            : isCompleted
              ? styles.squareCompleted
              : styles.squareInactive,
        ]}
      />
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.squaresContainer}>{squares}</View>
      <Text style={styles.stepText}>
        STAGE {currentStep}/{totalSteps}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  squaresContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.xs,
  },
  square: {
    width: 10,
    height: 10,
    borderRadius: 0,
  },
  squareActive: {
    backgroundColor: colors.interactive.primary,
    shadowColor: colors.interactive.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  squareCompleted: {
    backgroundColor: colors.status.ready,
  },
  squareInactive: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.text.tertiary,
  },
  stepText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.display,
    color: colors.text.secondary,
    letterSpacing: 1,
  },
});

export default StepIndicator;
