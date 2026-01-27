import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

/**
 * Reusable StepIndicator component for multi-step flows
 * @param {number} currentStep - 1-based index of current step
 * @param {number} totalSteps - Total number of steps
 * @param {object} style - Additional container styles
 */
const StepIndicator = ({ currentStep, totalSteps, style }) => {
  const dots = [];

  for (let i = 1; i <= totalSteps; i++) {
    const isCurrentStep = i === currentStep;
    dots.push(
      <View key={i} style={[styles.dot, isCurrentStep ? styles.dotActive : styles.dotInactive]} />
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.dotsContainer}>{dots}</View>
      <Text style={styles.stepText}>
        Step {currentStep} of {totalSteps}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.text.primary,
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.text.tertiary,
  },
  stepText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
});

export default StepIndicator;
