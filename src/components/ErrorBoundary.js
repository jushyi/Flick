/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors in the component tree below it and displays
 * a fallback UI instead of a white screen crash.
 *
 * Features:
 * - Catches React rendering errors
 * - Logs errors using logger utility
 * - Shows user-friendly error message
 * - Provides "Try Again" button to reset state
 * - Consistent styling with app design
 *
 * Usage:
 * Wrap this component around any component tree that might throw errors.
 * Typically placed at the app root level.
 *
 * Note: Error boundaries do NOT catch:
 * - Event handlers (use try/catch)
 * - Async code (use .catch())
 * - Server-side rendering
 * - Errors in the error boundary itself
 */

import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import logger from '../utils/logger';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state to show fallback UI when an error occurs
   * Called during "render" phase - no side effects allowed
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Log error details when an error occurs
   * Called during "commit" phase - side effects allowed
   */
  componentDidCatch(error, errorInfo) {
    // Log error details
    logger.error('ErrorBoundary: Caught error in component tree', {
      errorMessage: error?.message,
      errorStack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });

    // Store error info for potential debugging
    this.setState({ errorInfo });
  }

  /**
   * Reset error state and attempt to re-render children
   */
  handleTryAgain = () => {
    logger.info('ErrorBoundary: User pressed Try Again');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            {/* Error Icon */}
            <Text style={styles.icon}>!</Text>

            {/* Error Title */}
            <Text style={styles.title}>Something went wrong</Text>

            {/* Error Description */}
            <Text style={styles.description}>
              The app encountered an unexpected error. Please try again.
            </Text>

            {/* Try Again Button */}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleTryAgain}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Development-only error details */}
            {__DEV__ && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{this.state.error.message || 'Unknown error'}</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      );
    }

    // No error - render children normally
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: layout.borderRadius.round,
    backgroundColor: colors.status.danger,
    color: colors.text.primary,
    fontSize: typography.size.giant,
    fontFamily: typography.fontFamily.display,
    textAlign: 'center',
    lineHeight: 80,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  title: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.brand.purple,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    borderRadius: layout.borderRadius.md,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
  },
  debugContainer: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: '#FFF3CD', // Warning yellow (dev-only)
    borderRadius: layout.borderRadius.sm,
    width: '100%',
  },
  debugTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: '#856404', // Warning text (dev-only)
    marginBottom: spacing.xs,
  },
  debugText: {
    fontSize: typography.size.sm,
    color: '#856404', // Warning text (dev-only)
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
